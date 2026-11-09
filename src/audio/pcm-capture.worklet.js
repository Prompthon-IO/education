class PrompthonPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sequence = 0;
    this.blockSize = Math.max(128, Math.round(sampleRate * 0.02));
    this.block = new Float32Array(this.blockSize);
    this.offset = 0;
    this.active = true;
    this.port.onmessage = (event) => {
      if (event.data?.type === "stop") {
        this.active = false;
      }
      if (event.data?.type === "reset") {
        this.offset = 0;
      }
    };
  }

  process(inputs) {
    if (!this.active) {
      return false;
    }
    const channel = inputs[0]?.[0];
    if (!channel) {
      return true;
    }

    let readOffset = 0;
    while (readOffset < channel.length) {
      const copyLength = Math.min(channel.length - readOffset, this.blockSize - this.offset);
      this.block.set(channel.subarray(readOffset, readOffset + copyLength), this.offset);
      this.offset += copyLength;
      readOffset += copyLength;

      if (this.offset === this.blockSize) {
        const samples = this.block;
        this.port.postMessage({
          schemaVersion: 1,
          type: "pcm",
          sequence: this.sequence,
          capturedAt: currentTime * 1000,
          sampleRate,
          samples: samples.buffer
        }, [samples.buffer]);
        this.sequence += 1;
        this.block = new Float32Array(this.blockSize);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("prompthon-pcm-capture", PrompthonPcmCaptureProcessor);
