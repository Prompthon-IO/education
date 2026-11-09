export const AUDIO_PROTOCOL_VERSION = 1 as const;
export const VOICE_MODEL_SAMPLE_RATE = 16_000;
export const VOICE_PCM_BLOCK_DURATION_MS = 20;
export const VOICE_PRE_ROLL_MS = 250;
export const VOICE_NOISE_CALIBRATION_MS = 3_000;

export type VoicePipelineMode = "legacy" | "foundation" | "personalized";
export type AudioFoundationStatus = "idle" | "requesting-permission" | "starting" | "ready" | "calibrating" | "error";

export type VoiceCommandEvent = {
  command: "flap";
  strength: number;
  keywordConfidence: number;
  speakerConfidence: number;
  snrDb: number;
  detectedAt: number;
};

export type NoiseProfile = {
  overallDb: number;
  bandPower: number[];
  bandVariance: number[];
  transientRate: number;
  capturedAt: number;
};

export type MicrophoneSettingsSnapshot = {
  deviceId?: string;
  label?: string;
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
};

export type MicrophoneDiagnostics = {
  sequence: number;
  nativeSampleRate: number;
  modelSampleRate: number;
  rms: number;
  dbfs: number;
  peak: number;
  clippingRatio: number;
  bandPower: number[];
  transientRate: number;
  processingMs: number;
  workerLatencyMs: number;
  capturedAt: number;
};

export type AudioInputDevice = {
  deviceId: string;
  groupId: string;
  label: string;
};

export type AudioFoundationSnapshot = {
  status: AudioFoundationStatus;
  settings: MicrophoneSettingsSnapshot | null;
  diagnostics: MicrophoneDiagnostics | null;
  noiseProfile: NoiseProfile | null;
  warnings: string[];
  error: string | null;
};

export type VoiceProfile = {
  schemaVersion: number;
  userId: string;
  microphoneFingerprint: {
    deviceLabelHash?: string;
    sampleRate?: number;
    channelCount?: number;
  };
  speaker: {
    generalEmbedding?: number[];
    flapEmbedding: number[];
    enrollmentEmbeddings?: number[][];
    modelId: string;
    modelVersion: string;
  };
  keyword: {
    keyword: "flap";
    templateFeatures?: number[][];
    modelId: string;
    modelVersion: string;
  };
  loudness: {
    softDb: number;
    normalDb: number;
    loudDb: number;
    clippingDb: number;
  };
  baselineNoise: NoiseProfile;
  thresholds: {
    keywordAccept: number;
    speakerAccept: number;
    speakerReject: number;
    minimumSnrDb: number;
  };
  createdAt: string;
  updatedAt: string;
};

export interface VoiceProfileRepository {
  save(profile: VoiceProfile): Promise<void>;
  load(userId: string): Promise<VoiceProfile | null>;
  delete(userId: string): Promise<void>;
  exists(userId: string): Promise<boolean>;
}

export interface VadModel {
  reset(): void;
  processFrame(frame: Float32Array): Promise<number>;
}

export type KeywordResult = {
  label: "flap" | "other-speech" | "noise" | "silence";
  confidence: number;
};

export interface KeywordModel {
  classify(audio: Float32Array): Promise<KeywordResult>;
}

export interface SpeakerModel {
  extractEmbedding(audio: Float32Array): Promise<Float32Array>;
  compare(current: Float32Array, enrolled: Float32Array): number;
}

export interface TargetSpeakerExtractor {
  extract(mixedAudio: Float32Array, speakerEmbedding: Float32Array): Promise<{
    targetAudio?: Float32Array;
    targetMask?: Float32Array;
    residualAudio?: Float32Array;
    confidence: number;
  }>;
}
