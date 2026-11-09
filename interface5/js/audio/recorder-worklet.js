// Sample-accurate capture between two context times, for the bar-synced looper.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.job = null;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.cmd === 'arm') {
        this.job = { start: d.start, end: d.end, tag: d.tag, chunks: [[], []] };
      } else if (d.cmd === 'close' && this.job) {
        this.job.end = Math.min(this.job.end, d.end);
      } else if (d.cmd === 'cancel') {
        this.job = null;
      }
    };
  }

  finalize() {
    const job = this.job;
    this.job = null;
    const total = job.chunks[0].reduce((n, c) => n + c.length, 0);
    const channels = job.chunks.map((chunkList) => {
      const out = new Float32Array(total);
      let off = 0;
      for (const c of chunkList) {
        out.set(c, off);
        off += c.length;
      }
      return out;
    });
    this.port.postMessage(
      { tag: job.tag, start: job.start, end: job.end, channels },
      channels.map((c) => c.buffer),
    );
  }

  process(inputs, outputs) {
    const job = this.job;
    if (job) {
      const input = inputs[0];
      const n = input[0] ? input[0].length : 128;
      const blockStart = currentTime;
      const blockEnd = blockStart + n / sampleRate;
      if (input[0] && blockEnd > job.start && blockStart < job.end) {
        const from = Math.max(0, Math.round((job.start - blockStart) * sampleRate));
        const to = Math.min(n, Math.round((job.end - blockStart) * sampleRate));
        if (to > from) {
          const l = input[0];
          const r = input[1] || input[0];
          job.chunks[0].push(l.slice(from, to));
          job.chunks[1].push(r.slice(from, to));
        }
      }
      if (blockEnd >= job.end) this.finalize();
    }
    return true;
  }
}

registerProcessor('capture', CaptureProcessor);
