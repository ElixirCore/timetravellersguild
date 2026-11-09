// A tap on the input: forwards what arrives, one render block at a time, so
// the sampler (Keter) and FIELD TAP (Binah) can keep it. Replaces the old
// ScriptProcessor nodes.
class CaptureTapProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0];
    if (ch && ch.length && ch[0] && ch[0].length) {
      const l = Float32Array.from(ch[0]);
      const r = ch[1] ? Float32Array.from(ch[1]) : Float32Array.from(ch[0]);
      this.port.postMessage({ l, r }, [l.buffer, r.buffer]);
    }
    return true;
  }
}

registerProcessor('capture-tap', CaptureTapProcessor);