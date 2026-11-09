const FFT_SIZE = 512;
const CLIPPING_THRESHOLD = 0.99;
const BAND_EDGES_HZ = [80, 160, 315, 630, 1_250, 2_500, 4_000, 6_000, 8_000];

export type AudioFrameFeatures = {
  rms: number;
  dbfs: number;
  peak: number;
  clippingRatio: number;
  bandPower: number[];
  transient: number;
};

export function extractAudioFrameFeatures(samples: Float32Array, sampleRate: number, previousDbfs?: number): AudioFrameFeatures {
  if (!samples.length || sampleRate <= 0) {
    return {
      rms: 0,
      dbfs: -160,
      peak: 0,
      clippingRatio: 0,
      bandPower: Array.from({ length: BAND_EDGES_HZ.length - 1 }, () => -160),
      transient: 0
    };
  }

  let squaredSum = 0;
  let peak = 0;
  let clippedSamples = 0;
  for (const sample of samples) {
    const magnitude = Math.abs(sample);
    squaredSum += sample * sample;
    peak = Math.max(peak, magnitude);
    if (magnitude >= CLIPPING_THRESHOLD) {
      clippedSamples += 1;
    }
  }
  const rms = Math.sqrt(squaredSum / samples.length);
  const dbfs = amplitudeToDb(rms);

  return {
    rms,
    dbfs,
    peak,
    clippingRatio: clippedSamples / samples.length,
    bandPower: calculateBandPower(samples, sampleRate),
    transient: previousDbfs !== undefined && dbfs - previousDbfs >= 6 ? 1 : 0
  };
}

export function percentile(values: readonly number[], percentileValue: number) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const clamped = Math.min(1, Math.max(0, percentileValue));
  const position = (sorted.length - 1) * clamped;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function amplitudeToDb(amplitude: number) {
  return Math.max(-160, 20 * Math.log10(Math.max(amplitude, 1e-8)));
}

function calculateBandPower(samples: Float32Array, sampleRate: number) {
  const real = new Float64Array(FFT_SIZE);
  const imaginary = new Float64Array(FFT_SIZE);
  const copyLength = Math.min(samples.length, FFT_SIZE);
  for (let index = 0; index < copyLength; index += 1) {
    const window = copyLength > 1 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (copyLength - 1)) : 1;
    real[index] = samples[index] * window;
  }
  fft(real, imaginary);

  return BAND_EDGES_HZ.slice(0, -1).map((lowerHz, bandIndex) => {
    const upperHz = Math.min(BAND_EDGES_HZ[bandIndex + 1], sampleRate / 2);
    if (upperHz <= lowerHz) {
      return -160;
    }
    const lowerBin = Math.max(1, Math.ceil((lowerHz * FFT_SIZE) / sampleRate));
    const upperBin = Math.min(FFT_SIZE / 2, Math.floor((upperHz * FFT_SIZE) / sampleRate));
    let power = 0;
    let bins = 0;
    for (let bin = lowerBin; bin <= upperBin; bin += 1) {
      power += real[bin] * real[bin] + imaginary[bin] * imaginary[bin];
      bins += 1;
    }
    const normalizedPower = bins ? power / (bins * FFT_SIZE * FFT_SIZE) : 0;
    return Math.max(-160, 10 * Math.log10(Math.max(normalizedPower, 1e-16)));
  });
}

function fft(real: Float64Array, imaginary: Float64Array) {
  const length = real.length;
  for (let index = 1, reversed = 0; index < length; index += 1) {
    let bit = length >> 1;
    for (; reversed & bit; bit >>= 1) {
      reversed ^= bit;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }

  for (let size = 2; size <= length; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const half = size >> 1;
    for (let start = 0; start < length; start += size) {
      for (let offset = 0; offset < half; offset += 1) {
        const cosine = Math.cos(angle * offset);
        const sine = Math.sin(angle * offset);
        const evenIndex = start + offset;
        const oddIndex = evenIndex + half;
        const oddReal = real[oddIndex] * cosine - imaginary[oddIndex] * sine;
        const oddImaginary = real[oddIndex] * sine + imaginary[oddIndex] * cosine;
        real[oddIndex] = real[evenIndex] - oddReal;
        imaginary[oddIndex] = imaginary[evenIndex] - oddImaginary;
        real[evenIndex] += oddReal;
        imaginary[evenIndex] += oddImaginary;
      }
    }
  }
}
