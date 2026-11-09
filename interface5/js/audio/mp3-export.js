let lameReady;

function loadLame() {
  if (lameReady) return lameReady;
  lameReady = new Promise((resolve, reject) => {
    if (globalThis.lamejs?.Mp3Encoder) {
      resolve(globalThis.lamejs);
      return;
    }
    const script = document.createElement('script');
    script.src = new URL('../vendor/lame.min.js', import.meta.url).href;
    script.onload = () => {
      if (globalThis.lamejs?.Mp3Encoder) resolve(globalThis.lamejs);
      else reject(new Error('MP3 encoder failed to load'));
    };
    script.onerror = () => reject(new Error('MP3 encoder failed to load'));
    document.head.appendChild(script);
  });
  return lameReady;
}

export function preloadMp3Encoder() {
  loadLame().catch(() => {});
}

function floatTo16(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export async function encodeAudioBufferToMp3(audioBuffer, kbps = 192) {
  const lamejs = await loadLame();
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const left = floatTo16(audioBuffer.getChannelData(0));
  const right = channels > 1 ? floatTo16(audioBuffer.getChannelData(1)) : left;
  const blockSize = 1152;
  const parts = [];

  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right.subarray(i, i + blockSize);
    const chunk = channels === 1 ? encoder.encodeBuffer(l) : encoder.encodeBuffer(l, r);
    if (chunk.length > 0) parts.push(new Uint8Array(chunk));
  }

  const tail = encoder.flush();
  if (tail.length > 0) parts.push(new Uint8Array(tail));
  return new Blob(parts, { type: 'audio/mpeg' });
}

export function downloadBlob(blob, filename) {
  if (!blob || blob.size === 0) throw new Error('Empty file');
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
