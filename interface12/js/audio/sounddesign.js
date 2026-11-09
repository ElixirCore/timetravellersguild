/* INTERFACE v12 — sound design. A few words become a sub-second sound that is
   kept as a sample and played as a melody on the petal ring.

   The words go to ElevenLabs' sound-generation through generate.php (the key
   stays on the server). If that is not there (a static host, no key, over the
   daily cap, offline) a small built-in synth makes the sound instead, so a
   track is never silent. Either way the result is trimmed, faded and
   normalised so it starts on the beat and can be played at any pitch. */
import { ensureAudio } from './engine.js';
import { storeSound } from './samples.js';
import { state } from '../state.js';
import { KIT, makeKitSound, renderVoice } from './kits.js';

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
async function fromServer(words, secs, mode = 'sfx') {
  let res;
  try {
    res = await fetch('generate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'music'
        ? { mode, prompt: words.slice(0, 400), seconds: Math.round(secs) }
        : { mode, prompt: (words + SUFFIX).slice(0, 400), seconds: Math.min(1, Math.max(0.5, secs)) }),
    });
  } catch { throw new Error('no server'); }
  let j = null;
  try { j = await res.json(); } catch { /* not json: a static host answering */ }
  if (!j || !j.ok) throw new Error(j?.error || `no sound service (${res.status})`);
  const audio = await fetch(`serve.php?f=${encodeURIComponent(j.id)}`);
  if (!audio.ok) throw new Error('could not fetch the sound');
  const ctx = ensureAudio();
  const buf = await ctx.decodeAudioData(await audio.arrayBuffer());
  return { data: mode === 'music' ? mono(buf) : tidy(mono(buf), buf.sampleRate), rate: buf.sampleRate, left: j.left_today };
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


/* ---------- loops: music that locks to the tempo ---------- */
export const LOOPS = [
  { tag: 'bb', name: 'dusty boom bap', words: 'dusty boom bap loop, swung drums with a warm vinyl crackle and a mellow rhodes chord', groove: 'boombap' },
  { tag: 'hs', name: 'deep house', words: 'deep house groove, four on the floor kick, offbeat open hats, rolling sub bass', groove: 'house' },
  { tag: 'db', name: 'dub', words: 'dub reggae loop, heavy sub bass, rimshot, spring reverb chords with tape echo', groove: 'dub' },
  { tag: 'am', name: 'ambient pad', words: 'slow evolving ambient pad, warm analog drones with a soft shimmer, no drums', groove: 'pad' },
  { tag: 'dn', name: 'drum and bass', words: 'drum and bass loop, chopped break with a reese bass', groove: 'dnb' },
  { tag: 'tr', name: 'trap', words: 'trap loop, rolling hi-hats, 808 sub bass, dark bell melody', groove: 'trap' },
  { tag: 'fk', name: 'funk', words: 'funky groove, tight drums, slap bass and a clavinet riff', groove: 'funk' },
  { tag: 'ch', name: 'chip', words: 'chiptune loop, square wave arpeggios over a bouncy bass and noise drums', groove: 'chip' },
];

/* the smallest whole number of bars that is at least ~10 s at this tempo */
function barsFor(bpm) {
  for (const b of [1, 2, 4, 8, 16]) if ((b * 240) / bpm >= 10) return b;
  return 16;
}

/* trim, stretch to exactly N bars, and blend the end into the start so the
   loop has no seam */
function fitLoop(data, rate, bpm, bars) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const floor = peak * 0.015;
  let a = 0;
  let b = data.length;
  while (a < b - 1 && Math.abs(data[a]) < floor) a++;
  while (b > a + 1 && Math.abs(data[b - 1]) < floor) b--;
  const src = data.subarray(a, b);
  const target = Math.round(((bars * 240) / bpm) * rate);
  const xf = Math.min(Math.floor(rate * 0.04), Math.floor(target / 8));
  const len = target + xf;
  const ratio = (src.length - 1) / Math.max(1, len - 1);
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const p = i * ratio;
    const j = Math.floor(p);
    const f = p - j;
    x[i] = src[j] * (1 - f) + (src[Math.min(src.length - 1, j + 1)] * f);
  }
  const out = x.slice(0, target);
  for (let i = 0; i < xf; i++) {
    const w = i / xf;
    out[i] = x[i] * Math.sin(w * Math.PI / 2) + x[target + i] * Math.cos(w * Math.PI / 2);
  }
  return out;
}

/* ---------- the built-in loops (when the music service is not there) ---------- */
const G = {
  boombap: { k: 'x.....x.x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', b: [[0, 0], [6, 0], [8, -2], [10, 0]] },
  house: { k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', b: [[2, 0], [6, 0], [10, 3], [14, 0]] },
  dub: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.', b: [[0, 0], [3, 0], [8, -2], [11, -2]], long: true },
  dnb: { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', b: [[0, 0], [3, 0], [10, 3], [12, 0]] },
  trap: { k: 'x.....x...x.....', s: '........x.......', h: 'xxxxxxxxxxxxxxxx', b: [[0, 0], [6, -5], [10, 0]], long: true },
  funk: { k: 'x..x..x...x..x..', s: '....x..x.x..x...', h: 'x.xxx.xxx.xxx.xx', b: [[0, 0], [3, 0], [6, 3], [8, 0], [11, 5], [13, 3]] },
};

async function synthLoop(groove, bpm, bars = 2) {
  const sr = ensureAudio().sampleRate;
  const step = (60 / bpm) / 4;
  const len = Math.round(bars * 16 * step * sr);
  const out = new Float32Array(len);
  const put = (buf, at, gain = 1, rate = 1) => {
    const start = Math.round(at * step * sr);
    for (let i = 0; i < buf.length / rate; i++) {
      const p = i * rate;
      const j = Math.floor(p);
      const v = buf[j] * (1 - (p - j)) + (buf[Math.min(buf.length - 1, j + 1)] * (p - j));
      out[(start + i) % len] += v * gain;
    }
  };
  if (groove === 'pad') { // a slow chord whose partials fit the loop exactly: no seam
    const T = len / sr;
    [130.81, 155.56, 196.0, 233.08, 261.63].forEach((f0, k) => {
      const f = Math.max(1, Math.round(f0 * T)) / T;
      const f2 = Math.max(1, Math.round((f0 * 1.004) * T)) / T;
      const lfo = Math.max(1, Math.round(0.25 * T)) / T;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        out[i] += (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.12 * (0.7 + 0.3 * Math.sin(2 * Math.PI * (lfo * (k + 1)) * t));
      }
    });
    return out;
  }
  if (groove === 'chip') {
    const notes = [0, 4, 7, 12, 7, 4, 0, 7, 0, 4, 7, 12, 9, 7, 4, 2];
    for (let b = 0; b < bars; b++) {
      for (let i = 0; i < 16; i++) {
        const f = 261.63 * 2 ** (notes[i] / 12);
        const st = Math.round((b * 16 + i) * step * sr);
        for (let j = 0; j < step * sr * 0.9; j++) {
          const t = j / sr;
          const idx = st + j;
          if (idx < len) out[idx] += (((t * f) % 1) < 0.25 ? 1 : -1) * 0.18 * Math.exp(-t * 14);
        }
      }
    }
    const hat = await renderVoice('hat', 0.12);
    const kick = await renderVoice('kick', 0.5);
    for (let b = 0; b < bars; b++) for (let i = 0; i < 16; i += 2) put(hat, b * 16 + i, 0.5);
    for (let b = 0; b < bars; b++) [0, 8].forEach((i) => put(kick, b * 16 + i, 0.8));
    return out;
  }
  const g = G[groove] || G.boombap;
  const [kick, snare, hat, ohat, clap, sub] = await Promise.all(['kick', 'snare', 'hat', 'ohat', 'clap', 'sub'].map((v) => renderVoice(v, v === 'sub' ? 0.7 : 0.5)));
  for (let b = 0; b < bars; b++) {
    for (let i = 0; i < 16; i++) {
      const at = b * 16 + i;
      if (g.k && g.k[i] === 'x') put(kick, at, 0.9);
      if (g.s && g.s[i] === 'x') put(snare, at, 0.8);
      if (g.c && g.c[i] === 'x') put(clap, at, 0.8);
      if (g.h && g.h[i] === 'x') put(hat, at, 0.45 + 0.15 * (i % 4 === 0));
      if (g.o && g.o[i] === 'x') put(ohat, at, 0.5);
    }
    (g.b || []).forEach(([i, n]) => put(sub, b * 16 + i, 0.8, 2 ** (n / 12)));
  }
  return out;
}

/* a loop: from the music service if it answers, else the built-in groove */
async function designLoop({ words, groove, name }) {
  const bpm = state.seq.bpm;
  let bars = barsFor(bpm);
  let data;
  let how = 'elevenlabs';
  let why = '';
  try {
    const secs = Math.min(30, Math.ceil((bars * 240) / bpm) + 1);
    const r = await fromServer(`${words}. ${bpm} BPM, seamless loop, no intro, no ending, no fade, instrumental.`, secs, 'music');
    data = fitLoop(r.data, r.rate, bpm, bars);
  } catch (e) {
    how = 'synth';
    why = e.message;
    bars = 2;
    data = await synthLoop(groove, bpm, bars);
  }
  const rec = await storeSound(data, name, 'loop', { bars, role: 'loop' });
  return { rec, how, why };
}

/* ---------- the three pages of an empty track ---------- */
export const PAGES = [
  { key: 'sound', name: 'sounds', tag: 'AI', beads: PRESETS.map((p) => ({ tag: ['gl', 'sb', 'be', 'zp', 'wk', 'oh', '8b', 'dr'][PRESETS.indexOf(p)], name: p.name })) },
  { key: 'kit', name: 'kit', tag: 'KIT', beads: KIT.map((k) => ({ tag: k.tag, name: k.name })) },
  { key: 'loop', name: 'loops', tag: 'LP', beads: LOOPS.map((l) => ({ tag: l.tag, name: l.name })) },
];

/* page key + bead -> a stored sample.
   Resolves { rec, how, why, seed } (seed: a first line for a kit sound) */
export async function makeSound(page, k, typed = '') {
  if (page === 'kit') {
    const rec = await makeKitSound(k);
    return { rec, how: 'kit', why: '', seed: KIT[k].seed };
  }
  if (page === 'loop') {
    const l = LOOPS[k];
    return designLoop({ words: typed || l.words, groove: l.groove, name: typed ? typed.slice(0, 20) : l.name });
  }
  const pr = PRESETS[k];
  return designSound(typed
    ? { words: typed, secs: 0.6, synth: pr.synth }
    : { words: pr.words, secs: pr.secs, synth: pr.synth, preset: pr.name });
}
