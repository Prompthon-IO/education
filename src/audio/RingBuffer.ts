export class FloatRingBuffer {
  private readonly values: Float32Array;
  private writeIndex = 0;
  private storedLength = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Ring buffer capacity must be a positive integer.");
    }
    this.values = new Float32Array(capacity);
  }

  get capacity() {
    return this.values.length;
  }

  get length() {
    return this.storedLength;
  }

  clear() {
    this.writeIndex = 0;
    this.storedLength = 0;
    this.values.fill(0);
  }

  write(input: Float32Array) {
    if (input.length >= this.capacity) {
      this.values.set(input.subarray(input.length - this.capacity));
      this.writeIndex = 0;
      this.storedLength = this.capacity;
      return;
    }

    for (let index = 0; index < input.length; index += 1) {
      this.values[this.writeIndex] = input[index];
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
    }
    this.storedLength = Math.min(this.capacity, this.storedLength + input.length);
  }

  readLatest(length = this.storedLength) {
    const resultLength = Math.min(Math.max(0, Math.floor(length)), this.storedLength);
    const result = new Float32Array(resultLength);
    const start = (this.writeIndex - resultLength + this.capacity) % this.capacity;
    for (let index = 0; index < resultLength; index += 1) {
      result[index] = this.values[(start + index) % this.capacity];
    }
    return result;
  }
}
