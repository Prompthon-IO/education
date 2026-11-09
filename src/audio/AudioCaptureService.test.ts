import { describe, expect, it, vi } from "vitest";
import { AudioCaptureService, type AudioCaptureDependencies } from "./AudioCaptureService";
import { AUDIO_PROTOCOL_VERSION, VOICE_MODEL_SAMPLE_RATE, type NoiseProfile } from "./types";

describe("AudioCaptureService", () => {
  it("requests the intended constraints, reports actual settings, calibrates, and cleans up", async () => {
    const harness = createHarness({
      channelCount: 2,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true
    });
    const service = new AudioCaptureService(harness.dependencies);

    const snapshot = await service.start({ deviceId: "mic-1" });
    const constraints = harness.getUserMedia.mock.calls[0][0] as unknown as MediaStreamConstraints;
    expect(constraints).toEqual({
      audio: {
        deviceId: { exact: "mic-1" },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: 1
      },
      video: false
    });
    expect(snapshot.status).toBe("ready");
    expect(snapshot.settings).toMatchObject({
      deviceId: "mic-1",
      label: "Desk microphone",
      sampleRate: 48_000,
      channelCount: 2,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true
    });
    expect(snapshot.warnings).toEqual(expect.arrayContaining([
      "Microphone reported 2 channels; mono was requested.",
      "Browser automatic gain control is active; strength calibration may be less reliable.",
      "Browser did not enable the requested echo cancellation.",
      "Browser did not enable the requested noise suppression."
    ]));
    expect(harness.contexts[0].addModule).toHaveBeenCalledTimes(1);
    expect(harness.workers[0].postMessage.mock.calls[0][0]).toMatchObject({
      schemaVersion: AUDIO_PROTOCOL_VERSION,
      type: "configure",
      nativeSampleRate: 48_000,
      modelSampleRate: VOICE_MODEL_SAMPLE_RATE
    });

    emitWorkerMessage(harness.workers[0], {
      schemaVersion: AUDIO_PROTOCOL_VERSION,
      type: "diagnostics",
      diagnostics: diagnosticsFixture({ dbfs: -72 })
    });
    expect(service.getSnapshot().warnings).toContain("Input level is extremely low. Check the selected microphone.");

    const calibrationPromise = service.calibrateNoise();
    const workerCalls = harness.workers[0].postMessage.mock.calls;
    const calibrationRequest = workerCalls[workerCalls.length - 1][0] as {
      type: string;
      requestId: string;
      durationMs: number;
    };
    expect(calibrationRequest).toMatchObject({ type: "start-calibration", durationMs: 3_000 });
    expect(service.getSnapshot().status).toBe("calibrating");
    await expect(service.calibrateNoise()).rejects.toThrow("Start audio diagnostics before calibration.");
    const profile = noiseProfileFixture();
    emitWorkerMessage(harness.workers[0], {
      schemaVersion: AUDIO_PROTOCOL_VERSION,
      type: "calibration-complete",
      requestId: calibrationRequest.requestId,
      profile
    });
    await expect(calibrationPromise).resolves.toEqual(profile);
    expect(service.getSnapshot()).toMatchObject({ status: "ready", noiseProfile: profile });

    await service.stop();
    await service.stop();
    expect(harness.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(harness.contexts[0].close).toHaveBeenCalledTimes(1);
    expect(harness.workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(service.getSnapshot()).toMatchObject({ status: "idle", settings: null, diagnostics: null });
  });

  it("restarts with fresh resources and releases the previous capture", async () => {
    const harness = createHarness();
    const service = new AudioCaptureService(harness.dependencies);

    await service.start();
    await service.start();

    expect(harness.streams).toHaveLength(2);
    expect(harness.contexts).toHaveLength(2);
    expect(harness.workers).toHaveLength(2);
    expect(harness.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(harness.contexts[0].close).toHaveBeenCalledTimes(1);
    expect(harness.workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(harness.streams[1].track.stop).not.toHaveBeenCalled();

    await service.stop();
    expect(harness.streams[1].track.stop).toHaveBeenCalledTimes(1);
  });

  it("surfaces permission failures without allocating audio resources", async () => {
    const harness = createHarness();
    harness.getUserMedia.mockRejectedValueOnce(new Error("Permission denied"));
    const service = new AudioCaptureService(harness.dependencies);

    await expect(service.start()).rejects.toThrow("Permission denied");
    expect(service.getSnapshot()).toMatchObject({ status: "error", error: "Permission denied" });
    expect(harness.contexts).toHaveLength(0);
    expect(harness.workers).toHaveLength(0);
  });

  it("continues capture when input device enumeration is unavailable", async () => {
    const harness = createHarness();
    harness.enumerateDevices.mockRejectedValueOnce(new Error("Enumeration blocked"));
    const service = new AudioCaptureService(harness.dependencies);

    await expect(service.start()).resolves.toMatchObject({ status: "ready" });
    expect(service.getSnapshot().settings?.label).toBeUndefined();

    await service.stop();
  });

  it("stops a microphone stream that resolves after capture was cancelled", async () => {
    const harness = createHarness();
    const delayedStream = createFakeStream();
    let resolvePermission!: (stream: MediaStream) => void;
    harness.getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>((resolve) => {
      resolvePermission = resolve;
    }));
    const service = new AudioCaptureService(harness.dependencies);

    const startPromise = service.start();
    await vi.waitFor(() => expect(harness.getUserMedia).toHaveBeenCalledTimes(1));
    await service.stop();
    resolvePermission(delayedStream.stream);

    await expect(startPromise).rejects.toThrow("Audio capture start was cancelled.");
    expect(delayedStream.track.stop).toHaveBeenCalledTimes(1);
    expect(service.getSnapshot().status).toBe("idle");
    expect(harness.contexts).toHaveLength(0);
  });

  it("runs the synthetic PCM path without requesting microphone permission", async () => {
    const harness = createHarness();
    const service = new AudioCaptureService(harness.dependencies);

    await service.runSyntheticDiagnostic();

    expect(harness.getUserMedia).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toMatchObject({
      status: "ready",
      settings: { deviceId: "synthetic", sampleRate: 48_000 }
    });
    expect(harness.workers[0].postMessage).toHaveBeenCalledTimes(51);
    expect(harness.workers[0].postMessage.mock.calls[1][0]).toMatchObject({
      type: "pcm",
      sequence: 0
    });

    const calibrationPromise = service.calibrateNoise();
    const calibrationRequest = harness.workers[0].postMessage.mock.calls[51][0] as { requestId: string };
    expect(harness.workers[0].postMessage).toHaveBeenCalledTimes(202);
    const profile = noiseProfileFixture();
    emitWorkerMessage(harness.workers[0], {
      schemaVersion: AUDIO_PROTOCOL_VERSION,
      type: "calibration-complete",
      requestId: calibrationRequest.requestId,
      profile
    });
    await expect(calibrationPromise).resolves.toEqual(profile);

    await service.stop();
  });
});

type FakeWorker = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

function createHarness(settings: Partial<MediaTrackSettings> = {}) {
  const streams: ReturnType<typeof createFakeStream>[] = [];
  const contexts: Array<{
    addModule: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  const workers: FakeWorker[] = [];
  const getUserMedia = vi.fn(async (_constraints?: MediaStreamConstraints) => {
    const record = createFakeStream(settings);
    streams.push(record);
    return record.stream;
  });
  const enumerateDevices = vi.fn(async () => [{
    deviceId: "mic-1",
    groupId: "group-1",
    kind: "audioinput",
    label: "Desk microphone",
    toJSON: () => ({})
  } as MediaDeviceInfo]);

  const dependencies: AudioCaptureDependencies = {
    mediaDevices: {
      getUserMedia: getUserMedia as unknown as MediaDevices["getUserMedia"],
      enumerateDevices: enumerateDevices as unknown as MediaDevices["enumerateDevices"]
    },
    createAudioContext: () => {
      const addModule = vi.fn(async () => undefined);
      const resume = vi.fn(async () => undefined);
      const close = vi.fn(async () => undefined);
      const source = { connect: vi.fn(), disconnect: vi.fn() };
      const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
      const context = {
        sampleRate: 48_000,
        state: "running",
        destination: {},
        audioWorklet: { addModule },
        createMediaStreamSource: vi.fn(() => source),
        createGain: vi.fn(() => gain),
        resume,
        close
      };
      contexts.push({ addModule, resume, close });
      return context as unknown as AudioContext;
    },
    createWorker: () => {
      const worker: FakeWorker = {
        onmessage: null,
        onerror: null,
        postMessage: vi.fn(),
        terminate: vi.fn()
      };
      workers.push(worker);
      return worker as unknown as Worker;
    },
    createWorkletNode: () => ({
      port: { onmessage: null, postMessage: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn()
    } as unknown as AudioWorkletNode),
    workletModuleUrl: new URL("https://example.test/pcm-capture.worklet.js"),
    now: vi.fn(() => 100)
  };

  return { dependencies, streams, contexts, workers, getUserMedia, enumerateDevices };
}

function createFakeStream(settings: Partial<MediaTrackSettings> = {}) {
  const track = {
    getSettings: vi.fn(() => ({
      deviceId: "mic-1",
      sampleRate: 48_000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      ...settings
    })),
    stop: vi.fn()
  };
  const stream = {
    getAudioTracks: vi.fn(() => [track]),
    getTracks: vi.fn(() => [track])
  } as unknown as MediaStream;
  return { stream, track };
}

function emitWorkerMessage(worker: FakeWorker, data: unknown) {
  worker.onmessage?.({ data } as MessageEvent<unknown>);
}

function diagnosticsFixture(overrides: Record<string, number> = {}) {
  return {
    sequence: 1,
    nativeSampleRate: 48_000,
    modelSampleRate: 16_000,
    rms: 0.01,
    dbfs: -40,
    peak: 0.02,
    clippingRatio: 0,
    bandPower: Array.from({ length: 8 }, () => -50),
    transientRate: 0,
    processingMs: 0.4,
    workerLatencyMs: 0.2,
    capturedAt: 90,
    ...overrides
  };
}

function noiseProfileFixture(): NoiseProfile {
  return {
    overallDb: -48,
    bandPower: Array.from({ length: 8 }, () => -55),
    bandVariance: Array.from({ length: 8 }, () => 1.5),
    transientRate: 0.02,
    capturedAt: 1234
  };
}
