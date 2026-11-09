import type {
  AudioWorkerRequest,
  AudioWorkerRequestPayload,
  AudioWorkerResponse,
  AudioWorkletPcmMessage
} from "./protocol";
import { isAudioWorkerResponse } from "./protocol";
import {
  AUDIO_PROTOCOL_VERSION,
  VOICE_MODEL_SAMPLE_RATE,
  VOICE_NOISE_CALIBRATION_MS,
  VOICE_PCM_BLOCK_DURATION_MS,
  VOICE_PRE_ROLL_MS,
  type AudioFoundationSnapshot,
  type AudioInputDevice,
  type MicrophoneDiagnostics,
  type MicrophoneSettingsSnapshot,
  type NoiseProfile
} from "./types";

export type AudioCaptureDependencies = {
  mediaDevices: Pick<MediaDevices, "getUserMedia" | "enumerateDevices">;
  createAudioContext: () => AudioContext;
  createWorker: () => Worker;
  createWorkletNode: (context: AudioContext) => AudioWorkletNode;
  workletModuleUrl: URL;
  now: () => number;
};

type AudioCaptureStartOptions = {
  deviceId?: string;
};

type SnapshotListener = (snapshot: AudioFoundationSnapshot) => void;

const INITIAL_SNAPSHOT: AudioFoundationSnapshot = {
  status: "idle",
  settings: null,
  diagnostics: null,
  noiseProfile: null,
  warnings: [],
  error: null
};

export class AudioCaptureService {
  private readonly dependencies: AudioCaptureDependencies;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly calibrationRequests = new Map<string, {
    resolve: (profile: NoiseProfile) => void;
    reject: (error: Error) => void;
  }>();
  private snapshot: AudioFoundationSnapshot = INITIAL_SNAPSHOT;
  private settingsWarnings: string[] = [];
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private worker: Worker | null = null;
  private configuredSampleRate = 0;
  private syntheticSequence = 0;
  private lifecycleToken = 0;

  constructor(dependencies: Partial<AudioCaptureDependencies> = {}) {
    this.dependencies = createDependencies(dependencies);
  }

  subscribe(listener: SnapshotListener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.snapshot;
  }

  async listInputDevices(): Promise<AudioInputDevice[]> {
    const devices = await this.dependencies.mediaDevices.enumerateDevices();
    let microphoneIndex = 0;
    return devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => {
        microphoneIndex += 1;
        return {
          deviceId: device.deviceId,
          groupId: device.groupId,
          label: device.label || `Microphone ${microphoneIndex}`
        };
      });
  }

  async start(options: AudioCaptureStartOptions = {}) {
    const lifecycleToken = ++this.lifecycleToken;
    await this.releaseResources();
    assertCurrentLifecycle(lifecycleToken, this.lifecycleToken);
    this.settingsWarnings = [];
    this.update({
      status: "requesting-permission",
      settings: null,
      diagnostics: null,
      noiseProfile: null,
      error: null,
      warnings: []
    });

    let pendingStream: MediaStream | null = null;
    try {
      pendingStream = await this.dependencies.mediaDevices.getUserMedia({
        audio: {
          deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1
        },
        video: false
      });
      assertCurrentLifecycle(lifecycleToken, this.lifecycleToken);
      const stream = pendingStream;
      pendingStream = null;
      this.stream = stream;
      const track = stream.getAudioTracks()[0];
      if (!track) {
        throw new Error("No microphone audio track was provided.");
      }
      const settings = track.getSettings();
      const devices = await this.listInputDevices().catch(() => []);
      assertCurrentLifecycle(lifecycleToken, this.lifecycleToken);
      const selectedDevice = devices.find((device) => device.deviceId === settings.deviceId);
      const settingsSnapshot: MicrophoneSettingsSnapshot = {
        deviceId: settings.deviceId,
        label: selectedDevice?.label,
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: settings.autoGainControl
      };
      this.settingsWarnings = validateMicrophoneSettings(settingsSnapshot);
      this.update({ status: "starting", settings: settingsSnapshot, warnings: this.settingsWarnings });

      const context = this.dependencies.createAudioContext();
      this.context = context;
      if (!context.audioWorklet) {
        throw new Error("AudioWorklet is unavailable in this browser.");
      }
      await context.audioWorklet.addModule(this.dependencies.workletModuleUrl);
      assertCurrentLifecycle(lifecycleToken, this.lifecycleToken);
      await this.ensureWorker(context.sampleRate);
      assertCurrentLifecycle(lifecycleToken, this.lifecycleToken);

      const source = context.createMediaStreamSource(stream);
      const workletNode = this.dependencies.createWorkletNode(context);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      workletNode.port.onmessage = (event: MessageEvent<AudioWorkletPcmMessage>) => this.forwardPcm(event.data);
      source.connect(workletNode);
      workletNode.connect(silentGain);
      silentGain.connect(context.destination);
      this.source = source;
      this.workletNode = workletNode;
      this.silentGain = silentGain;
      await context.resume();
      assertCurrentLifecycle(lifecycleToken, this.lifecycleToken);
      this.update({ status: "ready", settings: settingsSnapshot, warnings: this.settingsWarnings, error: null });
      return this.snapshot;
    } catch (error) {
      pendingStream?.getTracks().forEach((track) => track.stop());
      if (lifecycleToken !== this.lifecycleToken) {
        throw createCancellationError();
      }
      await this.releaseResources();
      const normalizedError = error instanceof Error ? error : new Error("Unable to start microphone diagnostics.");
      this.update({ status: "error", error: normalizedError.message });
      throw normalizedError;
    }
  }

  async calibrateNoise(durationMs = VOICE_NOISE_CALIBRATION_MS) {
    if (!this.worker || this.snapshot.status !== "ready") {
      throw new Error("Start audio diagnostics before calibration.");
    }
    const requestId = createRequestId();
    this.update({ status: "calibrating", error: null });
    const result = new Promise<NoiseProfile>((resolve, reject) => {
      this.calibrationRequests.set(requestId, { resolve, reject });
    });
    const calibrationDurationMs = Math.max(250, durationMs);
    this.postWorker({ type: "start-calibration", requestId, durationMs: calibrationDurationMs });
    if (this.snapshot.settings?.deviceId === "synthetic") {
      this.postSyntheticBlocks(
        Math.ceil(calibrationDurationMs / VOICE_PCM_BLOCK_DURATION_MS),
        this.snapshot.settings.sampleRate ?? 48_000,
        0.003
      );
    }
    return result;
  }

  async runSyntheticDiagnostic() {
    const lifecycleToken = ++this.lifecycleToken;
    await this.releaseResources();
    assertCurrentLifecycle(lifecycleToken, this.lifecycleToken);
    const sampleRate = 48_000;
    this.settingsWarnings = ["Synthetic input; microphone is not active."];
    await this.ensureWorker(sampleRate);
    this.update({
      status: "ready",
      settings: {
        deviceId: "synthetic",
        label: "Synthetic 440 Hz fixture",
        sampleRate,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      warnings: this.settingsWarnings,
      error: null
    });

    this.postSyntheticBlocks(50, sampleRate, 0.08);
  }

  private postSyntheticBlocks(blockCount: number, sampleRate: number, amplitude: number) {
    const blockLength = Math.round(sampleRate * (VOICE_PCM_BLOCK_DURATION_MS / 1_000));
    for (let blockIndex = 0; blockIndex < blockCount; blockIndex += 1) {
      const samples = new Float32Array(blockLength);
      for (let index = 0; index < blockLength; index += 1) {
        const sampleIndex = this.syntheticSequence * blockLength + index;
        samples[index] = Math.sin((2 * Math.PI * 440 * sampleIndex) / sampleRate) * amplitude;
      }
      this.postPcm(samples, this.syntheticSequence, this.dependencies.now());
      this.syntheticSequence += 1;
    }
  }

  async stop(updateSnapshot = true) {
    this.lifecycleToken += 1;
    await this.releaseResources();
    if (updateSnapshot) {
      this.update({
        status: "idle",
        settings: null,
        diagnostics: null,
        warnings: [],
        error: null
      });
    }
  }

  private async ensureWorker(nativeSampleRate: number) {
    if (!this.worker) {
      const worker = this.dependencies.createWorker();
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (this.worker === worker) {
          this.handleWorkerMessage(event.data);
        }
      };
      worker.onerror = () => {
        if (this.worker === worker) {
          this.update({ status: "error", error: "Audio processing worker failed." });
        }
      };
      this.worker = worker;
    }
    if (this.configuredSampleRate !== nativeSampleRate) {
      this.configuredSampleRate = nativeSampleRate;
      this.postWorker({
        type: "configure",
        nativeSampleRate,
        modelSampleRate: VOICE_MODEL_SAMPLE_RATE,
        preRollMs: VOICE_PRE_ROLL_MS
      });
    }
  }

  private forwardPcm(message: AudioWorkletPcmMessage) {
    if (message.schemaVersion !== AUDIO_PROTOCOL_VERSION || message.type !== "pcm") {
      return;
    }
    this.postPcm(new Float32Array(message.samples), message.sequence, this.dependencies.now());
  }

  private postPcm(samples: Float32Array, sequence: number, capturedAt: number) {
    if (!this.worker) {
      return;
    }
    const transferableSamples = samples.buffer instanceof ArrayBuffer
      && samples.byteOffset === 0
      && samples.byteLength === samples.buffer.byteLength
      ? samples
      : new Float32Array(samples);
    const samplesBuffer = transferableSamples.buffer as ArrayBuffer;
    const request: AudioWorkerRequest = {
      schemaVersion: AUDIO_PROTOCOL_VERSION,
      type: "pcm",
      sequence,
      capturedAt,
      enqueuedAt: this.dependencies.now(),
      samples: samplesBuffer
    };
    this.worker.postMessage(request, [samplesBuffer]);
  }

  private postWorker(message: AudioWorkerRequestPayload) {
    this.worker?.postMessage({ schemaVersion: AUDIO_PROTOCOL_VERSION, ...message } as AudioWorkerRequest);
  }

  private handleWorkerMessage(value: unknown) {
    if (!isAudioWorkerResponse(value)) {
      return;
    }
    const message: AudioWorkerResponse = value;
    if (message.type === "diagnostics") {
      const warnings = diagnosticsWarnings(this.settingsWarnings, message.diagnostics);
      this.update({ diagnostics: message.diagnostics, warnings });
      return;
    }
    if (message.type === "calibration-complete") {
      this.calibrationRequests.get(message.requestId)?.resolve(message.profile);
      this.calibrationRequests.delete(message.requestId);
      this.update({ status: "ready", noiseProfile: message.profile });
      return;
    }
    if (message.type === "error") {
      this.update({ status: "error", error: message.message });
    }
  }

  private async releaseResources() {
    this.workletNode?.port.postMessage({ type: "stop" });
    this.source?.disconnect();
    this.workletNode?.disconnect();
    this.silentGain?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.worker?.postMessage({ schemaVersion: AUDIO_PROTOCOL_VERSION, type: "stop" } satisfies AudioWorkerRequest);
    this.worker?.terminate();
    for (const request of this.calibrationRequests.values()) {
      request.reject(new Error("Audio calibration was cancelled."));
    }
    this.calibrationRequests.clear();
    const context = this.context;
    this.stream = null;
    this.context = null;
    this.source = null;
    this.workletNode = null;
    this.silentGain = null;
    this.worker = null;
    this.configuredSampleRate = 0;
    if (context && context.state !== "closed") {
      await context.close();
    }
  }

  private update(patch: Partial<AudioFoundationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}

function createDependencies(overrides: Partial<AudioCaptureDependencies>): AudioCaptureDependencies {
  const mediaDevices = overrides.mediaDevices ?? navigator.mediaDevices;
  if (!mediaDevices) {
    throw new Error("Media devices are unavailable.");
  }
  return {
    mediaDevices,
    createAudioContext: overrides.createAudioContext ?? (() => {
      const AudioContextClass = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio is unavailable in this browser.");
      }
      return new AudioContextClass();
    }),
    createWorker: overrides.createWorker ?? (() => new Worker(new URL("./audio-processing.worker.ts", import.meta.url), { type: "module" })),
    createWorkletNode: overrides.createWorkletNode ?? ((context) => new AudioWorkletNode(context, "prompthon-pcm-capture", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1
    })),
    workletModuleUrl: overrides.workletModuleUrl ?? new URL("./pcm-capture.worklet.js", import.meta.url),
    now: overrides.now ?? (() => performance.now())
  };
}

function validateMicrophoneSettings(settings: MicrophoneSettingsSnapshot) {
  const warnings: string[] = [];
  if (settings.channelCount !== undefined && settings.channelCount !== 1) {
    warnings.push(`Microphone reported ${settings.channelCount} channels; mono was requested.`);
  }
  if (settings.autoGainControl) {
    warnings.push("Browser automatic gain control is active; strength calibration may be less reliable.");
  }
  if (settings.echoCancellation === false) {
    warnings.push("Browser did not enable the requested echo cancellation.");
  }
  if (settings.noiseSuppression === false) {
    warnings.push("Browser did not enable the requested noise suppression.");
  }
  if (!settings.sampleRate) {
    warnings.push("Browser did not report the microphone sample rate.");
  }
  return warnings;
}

function diagnosticsWarnings(settingsWarnings: readonly string[], diagnostics: MicrophoneDiagnostics) {
  const warnings = [...settingsWarnings];
  if (diagnostics.clippingRatio > 0.03) {
    warnings.push("Input is clipping. Reduce microphone gain or move farther away.");
  } else if (diagnostics.dbfs < -65) {
    warnings.push("Input level is extremely low. Check the selected microphone.");
  }
  return warnings;
}

function createRequestId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `calibration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assertCurrentLifecycle(expectedToken: number, currentToken: number) {
  if (expectedToken !== currentToken) {
    throw createCancellationError();
  }
}

function createCancellationError() {
  return new Error("Audio capture start was cancelled.");
}
