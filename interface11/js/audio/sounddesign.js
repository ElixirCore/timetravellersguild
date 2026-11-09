/* INTERFACE v11 — sound design. A few words become a sub-second sound that is
   kept as a sample and played as a melody on the petal ring.

   The words go to ElevenLabs' sound-generation through generate.php (the key
   stays on the server). If that is not there (a static host, no key, over the
   daily cap, offline) a small built-in synth makes the sound instead, so a
   track is never silent. Either way the result is trimmed, faded and
   normalised so it starts on the beat and can be played at any pitch. */
import { ensureAudio } from './engine.js';
import { storeSound } from './samples.js';

/* each preset: a name for the readout, the words sent, a length, and the
   built-in synth voice used when the words cannot be sent */
export const PRESETS = [
  { name: 'glass pluck', synth: 'pluck', secs: 0.6, words: 'a single plucked glass marimba note, bright, woody attack, very short decay' },
  { name: 'sub thump', synth: 'thump', secs: 0.5, words: 'a deep round sub bass thump, 808 style kick tone, tight, one hit' },
  { name: 'bell', synth: 'bell', secs: 0.9, words: 'a small tuned metal bell strike, pure, shimmering partials, quick fade' },
  { name: 'laser zap', synth: 'zap', secs: 0.5, words: 'a short retro laser zap, pitch falling fast, clean synth, one shot' },
  { name: 'wood knock', synth: 'knock', secs: 0.5, words: 'a hollow wooden block knock, dry, close microphone, one hit' },
  { name: 'vocal oh', synth: 'vowel', secs: 0.8, words: 'a soft sung vowel oh, breathy female voice, a single short note' },
  { name: 'chip blip', synth: 'blip', secs: 0.5, words: 'an 8-bit square wave blip, game console chiptune note, crisp' },
  { name: 'water drop', synth: 'drop', secs: 0.6, words: 'a single water droplet plink into a still pool, resonant and clear' },
];

const SUFFIX = ' Single isolated one-shot sound, dry, no background noise, no reverb tail, starts immediately.';

/* ---------- processing: trim, fade, mono ---------- */
function tidy(data, rate) {
  let a = 0;
  let b = data.length;
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak === 0) return new Float32Array(Math.floor(rate * 0.1));
  const floor = peak * 0.02;
  while (a < b && Math.abs(data[a]) < floor) a++;
  while (b > a && Math.abs(data[b - 1]) < floor) b--;
  a = Math.max(0, a - Math.floor(rate * 0.002));
  b = Math.min(data.length, b + Math.floor(rate * 0.02));
  const out = data.slice(a, b);
  const fi = Math.min(out.length, Math.floor(rate * 0.002));
  for (let i = 0; i < fi; i++) out[i] *= i / fi;
  const fo = Math.min(out.length, Math.floor(rate * 0.02));
  for (let i = 0; i < fo; i++) out[out.length - 1 - i] *= i / fo;
  return out;
}

function mono(buf) {
  const n = buf.length;
  const out = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}

/* ---------- the built-in synth (the fallback voice) ---------- */
function rnd(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; }

const VOICES = {
  pluck(r, n) { // a plucked string, Karplus-Strong
    const p = Math.round(r / 261.63);
    const buf = new Float32Array(p);
    const x = rnd(7);
    for (let i = 0; i < p; i++) buf[i] = x();
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const j = i % p;
      o[i] = buf[j];
      buf[j] = 0.5 * (buf[j] + buf[(j + 1) % p]) * 0.996;
    }
    return o;
  },
  thump(r, n) {
    const o = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / r;
      ph += (2 * Math.PI * (48 + 110 * Math.exp(-t * 28))) / r;
      o[i] = Math.sin(ph) * Math.exp(-t * 7);
    }
    return o;
  },
  bell(r, n) {
    const o = new Float32Array(n);
    const parts = [[1, 1, 3.2], [2.76, 0.6, 4.5], [5.4, 0.4, 6], [8.93, 0.25, 9]];
    for (let i = 0; i < n; i++) {
      const t = i / r;
      let v = 0;
      for (const [m, a, d] of parts) v += a * Math.sin(2 * Math.PI * 523.25 * m * t) * Math.exp(-t * d);
      o[i] = v;
    }
    return o;
  },
  zap(r, n) {
    const o = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / r;
      ph += (2 * Math.PI * (160 + 2400 * Math.exp(-t * 14))) / r;
      o[i] = Math.sign(Math.sin(ph)) * 0.5 * Math.exp(-t * 6);
    }
    return o;
  },
  knock(r, n) {
    const o = new Float32Array(n);
    const x = rnd(3);
    for (let i = 0; i < n; i++) {
      const t = i / r;
      o[i] = (Math.sin(2 * Math.PI * 360 * t) * 0.8 + Math.sin(2 * Math.PI * 790 * t) * 0.4 + x() * 0.15 * Math.exp(-t * 80)) * Math.exp(-t * 24);
    }
    return o;
  },
  vowel(r, n) { // a buzzy source through two formants, "oh"
    const o = new Float32Array(n);
    const f0 = 220;
    const form = [[570, 90], [840, 110]];
    const st = form.map(() => [0, 0]);
    for (let i = 0; i < n; i++) {
      const t = i / r;
      const src = ((t * f0) % 1) * 2 - 1;
      let v = 0;
      form.forEach(([fc, bw], k) => {
        const w = 2 * Math.PI * fc / r;
        const q = Math.exp(-Math.PI * bw / r);
        const [y1, y2] = st[k];
        const y = src * (1 - q) + 2 * q * Math.cos(w) * y1 - q * q * y2;
        st[k] = [y, y1];
        v += y;
      });
      o[i] = v * Math.min(1, t * 30) * Math.exp(-t * 2.2);
    }
    return o;
  },
  blip(r, n) {
    const o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / r;
      o[i] = (((t * 523.25) % 1) < 0.25 ? 1 : -1) * 0.5 * Math.exp(-t * 9);
    }
    return o;
  },
  drop(r, n) {
    const o = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / r;
      ph += (2 * Math.PI * (700 + 1800 * (1 - Math.exp(-t * 40)))) / r;
      o[i] = Math.sin(ph) * Math.exp(-t * 16);
    }
    return o;
  },
};

export function synthSound(kind, secs = 0.6) {
  const r = ensureAudio().sampleRate;
  const n = Math.floor(r * secs);
  return tidy((VOICES[kind] || VOICES.pluck)(r, n), r);
}

/* ---------- ElevenLabs, through the PHP proxy ---------- */
async function fromServer(words, secs) {
  let res;
  try {
    res = await fetch('generate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: (words + SUFFIX).slice(0, 400), seconds: Math.min(1, Math.max(0.5, secs)) }),
    });
  } catch { throw new Error('no server'); }
  let j = null;
  try { j = await res.json(); } catch { /* not json: a static host answering */ }
  if (!j || !j.ok) throw new Error(j?.error || `no sound service (${res.status})`);
  const audio = await fetch(`serve.php?f=${encodeURIComponent(j.id)}`);
  if (!audio.ok) throw new Error('could not fetch the sound');
  const ctx = ensureAudio();
  const buf = await ctx.decodeAudioData(await audio.arrayBuffer());
  return { data: tidy(mono(buf), buf.sampleRate), left: j.left_today };
}

/* words (and which preset's synth to fall back on) -> a stored sample.
   Resolves { rec, how: 'elevenlabs' | 'synth', why } */
export async function designSound({ words, secs = 0.6, synth = 'pluck', preset = null }) {
  let data = null;
  let how = 'elevenlabs';
  let why = '';
  try {
    ({ data } = await fromServer(words, secs));
  } catch (e) {
    how = 'synth';
    why = e.message;
    data = synthSound(synth, Math.max(0.5, secs));
  }
  const tag = (preset || words).slice(0, 24);
  const rec = await storeSound(data, tag, how === 'elevenlabs' ? 'ai' : 'synth');
  return { rec, how, why };
}
