import {
  AUDIO_PROTOCOL_VERSION,
  type MicrophoneDiagnostics,
  type NoiseProfile
} from "./types";

type ProtocolEnvelope = {
  schemaVersion: typeof AUDIO_PROTOCOL_VERSION;
};

type WithoutProtocolVersion<T extends ProtocolEnvelope> = T extends unknown
  ? Omit<T, "schemaVersion">
  : never;

export type AudioWorkerRequest = ProtocolEnvelope & (
  | {
      type: "configure";
      nativeSampleRate: number;
      modelSampleRate: number;
      preRollMs: number;
    }
  | {
      type: "pcm";
      sequence: number;
      capturedAt: number;
      enqueuedAt: number;
      samples: ArrayBuffer;
    }
  | {
      type: "start-calibration";
      requestId: string;
      durationMs: number;
    }
  | { type: "reset" }
  | { type: "stop" }
);

export type AudioWorkerResponse = ProtocolEnvelope & (
  | { type: "ready"; nativeSampleRate: number; modelSampleRate: number }
  | { type: "diagnostics"; diagnostics: MicrophoneDiagnostics }
  | { type: "calibration-complete"; requestId: string; profile: NoiseProfile }
  | { type: "error"; message: string }
);

export type AudioWorkerRequestPayload = WithoutProtocolVersion<AudioWorkerRequest>;
export type AudioWorkerResponsePayload = WithoutProtocolVersion<AudioWorkerResponse>;

export type AudioWorkletPcmMessage = ProtocolEnvelope & {
  type: "pcm";
  sequence: number;
  capturedAt: number;
  sampleRate: number;
  samples: ArrayBuffer;
};

export function isAudioWorkerRequest(value: unknown): value is AudioWorkerRequest {
  if (!isProtocolMessage(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "configure") {
    return isPositiveNumber(candidate.nativeSampleRate)
      && isPositiveNumber(candidate.modelSampleRate)
      && isPositiveNumber(candidate.preRollMs);
  }
  if (candidate.type === "pcm") {
    return isFiniteNumber(candidate.sequence)
      && isFiniteNumber(candidate.capturedAt)
      && isFiniteNumber(candidate.enqueuedAt)
      && candidate.samples instanceof ArrayBuffer;
  }
  if (candidate.type === "start-calibration") {
    return typeof candidate.requestId === "string"
      && candidate.requestId.length > 0
      && isPositiveNumber(candidate.durationMs);
  }
  return candidate.type === "reset" || candidate.type === "stop";
}

export function isAudioWorkerResponse(value: unknown): value is AudioWorkerResponse {
  if (!isProtocolMessage(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "ready") {
    return isPositiveNumber(candidate.nativeSampleRate) && isPositiveNumber(candidate.modelSampleRate);
  }
  if (candidate.type === "diagnostics") {
    return isMicrophoneDiagnostics(candidate.diagnostics);
  }
  if (candidate.type === "calibration-complete") {
    return typeof candidate.requestId === "string"
      && candidate.requestId.length > 0
      && isNoiseProfile(candidate.profile);
  }
  return candidate.type === "error" && typeof candidate.message === "string";
}

function isProtocolMessage(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === AUDIO_PROTOCOL_VERSION && typeof candidate.type === "string";
}

function isMicrophoneDiagnostics(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const diagnostics = value as Record<string, unknown>;
  return [
    "sequence",
    "nativeSampleRate",
    "modelSampleRate",
    "rms",
    "dbfs",
    "peak",
    "clippingRatio",
    "transientRate",
    "processingMs",
    "workerLatencyMs",
    "capturedAt"
  ].every((key) => isFiniteNumber(diagnostics[key])) && isNumberArray(diagnostics.bandPower, 8);
}

function isNoiseProfile(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const profile = value as Record<string, unknown>;
  return isFiniteNumber(profile.overallDb)
    && isNumberArray(profile.bandPower, 8)
    && isNumberArray(profile.bandVariance, 8)
    && isFiniteNumber(profile.transientRate)
    && isFiniteNumber(profile.capturedAt);
}

function isNumberArray(value: unknown, length: number) {
  return Array.isArray(value)
    && value.length === length
    && value.every((item) => isFiniteNumber(item));
}

function isPositiveNumber(value: unknown) {
  return isFiniteNumber(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
