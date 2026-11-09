import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { extractAudioFrameFeatures, percentile, type AudioFrameFeatures } from "./AudioFeatureExtractor";
import { NoiseCalibrationAccumulator } from "./NoiseCalibration";
import { isAudioWorkerRequest, isAudioWorkerResponse } from "./protocol";
import { FloatRingBuffer } from "./RingBuffer";
import { StreamingLinearResampler } from "./Resampler";
import {
  AUDIO_PROTOCOL_VERSION,
  VOICE_MODEL_SAMPLE_RATE,
  VOICE_PCM_BLOCK_DURATION_MS,
  VOICE_PRE_ROLL_MS
} from "./types";

describe("FloatRingBuffer", () => {
  it("retains the newest samples in order after wrapping", () => {
    const ring = new FloatRingBuffer(5);
    ring.write(Float32Array.from([1, 2, 3]));
    ring.write(Float32Array.from([4, 5, 6, 7]));

    expect(Array.from(ring.readLatest())).toEqual([3, 4, 5, 6, 7]);
    expect(Array.from(ring.readLatest(3))).toEqual([5, 6, 7]);
  });

  it("handles writes larger than its capacity and clears deterministically", () => {
    const ring = new FloatRingBuffer(3);
    ring.write(Float32Array.from([1, 2, 3, 4, 5]));
    expect(Array.from(ring.readLatest())).toEqual([3, 4, 5]);

    ring.clear();
    expect(ring.length).toBe(0);
    expect(Array.from(ring.readLatest())).toEqual([]);
  });
});

describe("PCM worklet batching", () => {
  it("emits transferable 20 ms mono blocks across render-quantum boundaries", () => {
    const source = readFileSync(new URL("./pcm-capture.worklet.js", import.meta.url), "utf8");
    const postedMessages: Array<{ message: Record<string, unknown>; transfer: ArrayBuffer[] }> = [];
    let Processor: (new () => {
      process(inputs: Float32Array[][]): boolean;
    }) | undefined;

    class FakeAudioWorkletProcessor {
      port = {
        onmessage: null as ((event: { data: unknown }) => void) | null,
        postMessage: (message: Record<string, unknown>, transfer: ArrayBuffer[]) => {
          postedMessages.push({ message, transfer });
        }
      };
    }

    const registerProcessor = vi.fn((name: string, implementation: typeof Processor) => {
      expect(name).toBe("prompthon-pcm-capture");
      Processor = implementation;
    });
    const loadWorklet = new Function(
      "AudioWorkletProcessor",
      "sampleRate",
      "currentTime",
      "registerProcessor",
      source
    );
    loadWorklet(FakeAudioWorkletProcessor, 48_000, 1.25, registerProcessor);
    expect(Processor).toBeDefined();
    const processor = new (Processor as NonNullable<typeof Processor>)();

    let sampleValue = 0;
    for (let quantum = 0; quantum < 7; quantum += 1) {
      const samples = Float32Array.from({ length: 128 }, () => sampleValue++);
      expect(processor.process([[samples]])).toBe(true);
    }
    expect(postedMessages).toHaveLength(0);

    const eighthQuantum = Float32Array.from({ length: 128 }, () => sampleValue++);
    processor.process([[eighthQuantum]]);
    expect(postedMessages).toHaveLength(1);
    const firstMessage = postedMessages[0].message;
    const firstBuffer = firstMessage.samples as ArrayBuffer;
    expect(firstMessage).toMatchObject({
      schemaVersion: AUDIO_PROTOCOL_VERSION,
      type: "pcm",
      sequence: 0,
      sampleRate: 48_000,
      capturedAt: 1_250
    });
    expect(new Float32Array(firstBuffer)).toHaveLength(48_000 * VOICE_PCM_BLOCK_DURATION_MS / 1_000);
    expect(postedMessages[0].transfer).toEqual([firstBuffer]);

    for (let quantum = 0; quantum < 7; quantum += 1) {
      processor.process([[new Float32Array(128)]]);
    }
    expect(postedMessages).toHaveLength(2);
    expect(postedMessages[1].message.sequence).toBe(1);
  });
});

describe("StreamingLinearResampler", () => {
  it("preserves duration and tone frequency across uneven chunks", () => {
    const inputRate = 48_000;
    const outputRate = VOICE_MODEL_SAMPLE_RATE;
    const input = sineWave(1_000, inputRate, 0.1, 0.7);
    const resampler = new StreamingLinearResampler(inputRate, outputRate);
    const chunks: Float32Array[] = [];
    const chunkSizes = [137, 509, 83, 1_024, 311];
    let offset = 0;
    let chunkIndex = 0;
    while (offset < input.length) {
      const end = Math.min(input.length, offset + chunkSizes[chunkIndex % chunkSizes.length]);
      chunks.push(resampler.process(input.subarray(offset, end)));
      offset = end;
      chunkIndex += 1;
    }
    const output = concatenate(chunks);

    expect(Math.abs(output.length - 1_600)).toBeLessThanOrEqual(1);
    const positiveCrossings = countPositiveCrossings(output);
    const measuredFrequency = positiveCrossings / (output.length / outputRate);
    expect(measuredFrequency).toBeCloseTo(1_000, -1);
  });

  it("returns a copy when the sample rates match", () => {
    const input = Float32Array.from([0.1, 0.2, 0.3]);
    const output = new StreamingLinearResampler(16_000, 16_000).process(input);
    expect(Array.from(output)).toEqual(Array.from(input));
    expect(output).not.toBe(input);
  });
});

describe("audio feature extraction", () => {
  it("measures silence, dBFS, clipping, and transients", () => {
    const silence = extractAudioFrameFeatures(new Float32Array(320), 16_000);
    expect(silence).toMatchObject({ rms: 0, dbfs: -160, peak: 0, clippingRatio: 0 });

    const steady = extractAudioFrameFeatures(new Float32Array(320).fill(0.5), 16_000, -20);
    expect(steady.rms).toBeCloseTo(0.5, 6);
    expect(steady.dbfs).toBeCloseTo(-6.0206, 3);
    expect(steady.transient).toBe(1);

    const clipped = extractAudioFrameFeatures(Float32Array.from([1, -1, 0.2, 0]), 16_000);
    expect(clipped.peak).toBe(1);
    expect(clipped.clippingRatio).toBe(0.5);
  });

  it("places a 1 kHz tone in the expected log-spaced band", () => {
    const tone = extractAudioFrameFeatures(sineWave(1_000, 16_000, 512 / 16_000, 0.8), 16_000);
    const strongestBand = tone.bandPower.indexOf(Math.max(...tone.bandPower));
    expect(tone.bandPower).toHaveLength(8);
    expect(strongestBand).toBe(3);
  });
});

describe("noise calibration", () => {
  it("uses the 90th-percentile level and summarizes spectral variance", () => {
    const accumulator = new NoiseCalibrationAccumulator();
    for (let index = 0; index < 10; index += 1) {
      accumulator.add(frameFeatures(index));
    }
    const profile = accumulator.build(1234);

    expect(percentile([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.9)).toBeCloseTo(8.1, 6);
    expect(profile.overallDb).toBeCloseTo(8.1, 6);
    expect(profile.bandPower[0]).toBeCloseTo(4.5, 6);
    expect(profile.bandVariance[0]).toBeCloseTo(8.25, 6);
    expect(profile.transientRate).toBe(0.5);
    expect(profile.capturedAt).toBe(1234);
  });
});

describe("versioned worker protocol", () => {
  it("accepts complete messages and rejects malformed payloads", () => {
    expect(isAudioWorkerRequest({
      schemaVersion: AUDIO_PROTOCOL_VERSION,
      type: "configure",
      nativeSampleRate: 48_000,
      modelSampleRate: VOICE_MODEL_SAMPLE_RATE,
      preRollMs: VOICE_PRE_ROLL_MS
    })).toBe(true);
    expect(isAudioWorkerRequest({
      schemaVersion: AUDIO_PROTOCOL_VERSION,
      type: "pcm",
      sequence: 1,
      capturedAt: 10,
      enqueuedAt: 11,
      samples: new ArrayBuffer(8)
    })).toBe(true);
    expect(isAudioWorkerRequest({ schemaVersion: AUDIO_PROTOCOL_VERSION, type: "pcm" })).toBe(false);
    expect(isAudioWorkerResponse({ schemaVersion: 999, type: "error", message: "bad" })).toBe(false);
    expect(isAudioWorkerResponse({ schemaVersion: AUDIO_PROTOCOL_VERSION, type: "error" })).toBe(false);
    expect(isAudioWorkerResponse({ schemaVersion: AUDIO_PROTOCOL_VERSION, type: "error", message: "bad" })).toBe(true);
  });
});

function sineWave(frequency: number, sampleRate: number, durationSeconds: number, amplitude: number) {
  const sampleCount = Math.round(sampleRate * durationSeconds);
  return Float32Array.from({ length: sampleCount }, (_, index) => (
    Math.sin((2 * Math.PI * frequency * index) / sampleRate) * amplitude
  ));
}

function concatenate(chunks: Float32Array[]) {
  const output = new Float32Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function countPositiveCrossings(samples: Float32Array) {
  let crossings = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index - 1] <= 0 && samples[index] > 0) {
      crossings += 1;
    }
  }
  return crossings;
}

function frameFeatures(value: number): AudioFrameFeatures {
  return {
    rms: 0.1,
    dbfs: value,
    peak: 0.2,
    clippingRatio: 0,
    bandPower: Array.from({ length: 8 }, (_, index) => value + index),
    transient: value % 2
  };
}
