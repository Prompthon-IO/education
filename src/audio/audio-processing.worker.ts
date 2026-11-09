import { extractAudioFrameFeatures } from "./AudioFeatureExtractor";
import { NoiseCalibrationAccumulator } from "./NoiseCalibration";
import { FloatRingBuffer } from "./RingBuffer";
import { StreamingLinearResampler } from "./Resampler";
import {
  isAudioWorkerRequest,
  type AudioWorkerRequest,
  type AudioWorkerResponse,
  type AudioWorkerResponsePayload
} from "./protocol";
import { AUDIO_PROTOCOL_VERSION } from "./types";

type WorkerScope = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: AudioWorkerResponse): void;
  close(): void;
};

const workerScope = self as unknown as WorkerScope;
let nativeSampleRate = 0;
let modelSampleRate = 0;
let resampler: StreamingLinearResampler | null = null;
let preRoll: FloatRingBuffer | null = null;
let previousDbfs: number | undefined;
let lastDiagnosticsAt = Number.NEGATIVE_INFINITY;
let calibration: {
  requestId: string;
  remainingSamples: number;
  accumulator: NoiseCalibrationAccumulator;
} | null = null;

workerScope.onmessage = (event) => {
  const message = event.data;
  if (!isAudioWorkerRequest(message)) {
    postError("Invalid audio worker message.");
    return;
  }

  try {
    if (message.type === "configure") {
      configure(message.nativeSampleRate, message.modelSampleRate, message.preRollMs);
      return;
    }
    if (message.type === "pcm") {
      processPcm(message);
      return;
    }
    if (message.type === "start-calibration") {
      if (!modelSampleRate) {
        throw new Error("Audio worker is not configured.");
      }
      calibration = {
        requestId: message.requestId,
        remainingSamples: Math.max(1, Math.round((message.durationMs / 1000) * modelSampleRate)),
        accumulator: new NoiseCalibrationAccumulator()
      };
      return;
    }
    if (message.type === "reset") {
      resampler?.reset();
      preRoll?.clear();
      previousDbfs = undefined;
      lastDiagnosticsAt = Number.NEGATIVE_INFINITY;
      calibration = null;
      return;
    }
    workerScope.close();
  } catch (error) {
    postError(error instanceof Error ? error.message : "Audio worker failed.");
  }
};

function configure(nextNativeSampleRate: number, nextModelSampleRate: number, preRollMs: number) {
  if (nextNativeSampleRate <= 0 || nextModelSampleRate <= 0) {
    throw new Error("Audio sample rates must be positive.");
  }
  nativeSampleRate = nextNativeSampleRate;
  modelSampleRate = nextModelSampleRate;
  resampler = new StreamingLinearResampler(nativeSampleRate, modelSampleRate);
  preRoll = new FloatRingBuffer(Math.max(1, Math.ceil((preRollMs / 1000) * modelSampleRate)));
  previousDbfs = undefined;
  lastDiagnosticsAt = Number.NEGATIVE_INFINITY;
  calibration = null;
  post({ type: "ready", nativeSampleRate, modelSampleRate });
}

function processPcm(message: Extract<AudioWorkerRequest, { type: "pcm" }>) {
  if (!resampler || !preRoll) {
    throw new Error("PCM received before audio worker configuration.");
  }
  const processingStartedAt = performance.now();
  const nativeSamples = new Float32Array(message.samples);
  const modelSamples = resampler.process(nativeSamples);
  preRoll.write(modelSamples);
  const features = extractAudioFrameFeatures(modelSamples, modelSampleRate, previousDbfs);
  previousDbfs = features.dbfs;

  if (calibration) {
    calibration.accumulator.add(features);
    calibration.remainingSamples -= modelSamples.length;
    if (calibration.remainingSamples <= 0) {
      post({
        type: "calibration-complete",
        requestId: calibration.requestId,
        profile: calibration.accumulator.build()
      });
      calibration = null;
    }
  }

  const now = performance.now();
  if (now - lastDiagnosticsAt < 80) {
    return;
  }
  lastDiagnosticsAt = now;
  post({
    type: "diagnostics",
    diagnostics: {
      sequence: message.sequence,
      nativeSampleRate,
      modelSampleRate,
      ...features,
      transientRate: features.transient,
      processingMs: performance.now() - processingStartedAt,
      workerLatencyMs: Math.max(0, processingStartedAt - message.enqueuedAt),
      capturedAt: message.capturedAt
    }
  });
}

function post(message: AudioWorkerResponsePayload) {
  workerScope.postMessage({ schemaVersion: AUDIO_PROTOCOL_VERSION, ...message } as AudioWorkerResponse);
}

function postError(message: string) {
  post({ type: "error", message });
}
