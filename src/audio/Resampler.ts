export class StreamingLinearResampler {
  private previousSample: number | null = null;
  private sourcePosition = 0;

  constructor(
    readonly inputSampleRate: number,
    readonly outputSampleRate: number
  ) {
    if (inputSampleRate <= 0 || outputSampleRate <= 0) {
      throw new Error("Sample rates must be positive.");
    }
  }

  reset() {
    this.previousSample = null;
    this.sourcePosition = 0;
  }

  process(input: Float32Array) {
    if (!input.length) {
      return new Float32Array(0);
    }
    if (this.inputSampleRate === this.outputSampleRate) {
      return input.slice();
    }

    const hasPrevious = this.previousSample !== null;
    const source = new Float32Array(input.length + (hasPrevious ? 1 : 0));
    if (hasPrevious) {
      source[0] = this.previousSample as number;
      source.set(input, 1);
    } else {
      source.set(input);
    }

    const step = this.inputSampleRate / this.outputSampleRate;
    let position = this.sourcePosition;
    const output: number[] = [];
    while (position + 1 < source.length) {
      const lowerIndex = Math.floor(position);
      const fraction = position - lowerIndex;
      const lower = source[lowerIndex];
      const upper = source[lowerIndex + 1];
      output.push(lower + (upper - lower) * fraction);
      position += step;
    }

    this.previousSample = source[source.length - 1];
    this.sourcePosition = position - (source.length - 1);
    return Float32Array.from(output);
  }
}
