class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.windowSize = 2048;
    this.size = 0;
    this.sum = 0;
    this.peak = 0;
    this.port2 = null;
    this.port.onmessage = (event) => {
      if (event.data.type === "PORT") {
        this.port2 = event.data.port;
        this.port.postMessage({ type: "PORT_RECEIVED" });
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const data = input[0];
    if (!data || data.length === 0) return true;

    if (this.port2) {
      const copy = new Float32Array(data);
      this.port2.postMessage({ type: "AUDIO_DATA", data: copy }, [copy.buffer]);
    }

    for (let i = 0; i < data.length; i++) {
      const value = data[i] || 0;
      const abs = Math.abs(value);
      this.sum += value * value;
      if (abs > this.peak) this.peak = abs;
    }

    this.size += data.length;
    if (this.size >= this.windowSize) {
      const rms = Math.sqrt(this.sum / this.size);
      const level = Math.min(1, Math.max(rms * 2.8, this.peak * 0.9));
      this.port.postMessage({ type: "LEVEL", level, peak: this.peak });
      this.size = 0;
      this.sum = 0;
      this.peak = 0;
    }

    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
