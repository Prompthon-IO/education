import { percentile, type AudioFrameFeatures } from "./AudioFeatureExtractor";
import type { NoiseProfile } from "./types";

export class NoiseCalibrationAccumulator {
  private readonly dbfsValues: number[] = [];
  private readonly bandValues: number[][] = [];
  private transientCount = 0;

  add(features: AudioFrameFeatures) {
    this.dbfsValues.push(features.dbfs);
    this.transientCount += features.transient;
    features.bandPower.forEach((value, index) => {
      (this.bandValues[index] ??= []).push(value);
    });
  }

  get frameCount() {
    return this.dbfsValues.length;
  }

  build(capturedAt = Date.now()): NoiseProfile {
    return {
      overallDb: percentile(this.dbfsValues, 0.9),
      bandPower: this.bandValues.map(mean),
      bandVariance: this.bandValues.map(variance),
      transientRate: this.frameCount ? this.transientCount / this.frameCount : 0,
      capturedAt
    };
  }
}

function mean(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function variance(values: readonly number[]) {
  if (!values.length) {
    return 0;
  }
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
}
