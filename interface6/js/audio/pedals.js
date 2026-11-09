/* The v5 pedalboard (DIRT > WAH > CHORUS > PHASER > ECHO > VERB), same DSP.
   v6 builds it per AudioContext so the live rig and the offline mix render
   run through the same chain. */
import { zone, TIME_STEPS, TIME_MULT, PEDAL_DEFS, FIXED_BPM } from '../state.js';

const FADE = 0.02;

export function makeImpulse(c, seconds, decayPow = 2.2) {
  const n = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decayPow;
  }
  return b;
}

function driveCurve(amount) {
  const n = 256;
  const curve = new Float32Array(n);
  const k = Math.max(0, amount) * 0.08;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

export function buildBoard(ctx) {
  const pedals = {};

  function makeShell(insert) {
    const input = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const output = ctx.createGain();
    wet.gain.value = 0;
    input.connect(dry).connect(output);
    wet.connect(output);
    return { input, dry, wet, output, insert };
  }

  function buildDrive() {
    const p = makeShell(true);
    p.shaper = ctx.createWaveShaper();
    p.shaper.oversample = '2x';
    p.toneLP = ctx.createBiquadFilter();
    p.toneLP.type = 'lowpass';
    p.level = ctx.createGain();
    p.input.connect(p.shaper).connect(p.toneLP).connect(p.level).connect(p.wet);
    return p;
  }

  function buildWah() {
    const p = makeShell(true);
    p.bp = ctx.createBiquadFilter();
    p.bp.type = 'peaking';
    p.level = ctx.createGain();
    p.lfo = ctx.createOscillator();
    p.lfoGain = ctx.createGain();
    p.lfoGain.gain.value = 0;
    p.lfo.connect(p.lfoGain).connect(p.bp.frequency);
    p.lfo.start();
    p.input.connect(p.bp).connect(p.level).connect(p.wet);
    return p;
  }

  function buildChorus() {
    const p = makeShell(false);
    p.delay = ctx.createDelay(0.06);
    p.delay.delayTime.value = 0.018;
    p.lfo = ctx.createOscillator();
    p.lfoGain = ctx.createGain();
    p.lfoGain.gain.value = 0.004;
    p.lfo.connect(p.lfoGain).connect(p.delay.delayTime);
    p.lfo.start();
    p.input.connect(p.delay).connect(p.wet);
    return p;
  }

  function buildPhaser() {
    const p = makeShell(false);
    p.stages = [];
    p.lfo = ctx.createOscillator();
    p.lfoGain = ctx.createGain();
    p.lfo.connect(p.lfoGain);
    p.lfo.start();
    let prev = p.input;
    [400, 800, 1200, 1600].forEach((f) => {
      const ap = ctx.createBiquadFilter();
      ap.type = 'allpass';
      ap.frequency.value = f;
      ap.Q.value = 0.6;
      p.lfoGain.connect(ap.frequency);
      prev.connect(ap);
      prev = ap;
      p.stages.push(ap);
    });
    prev.connect(p.wet);
    return p;
  }

  function buildDelay() {
    const p = makeShell(false);
    p.delay = ctx.createDelay(2);
    p.fb = ctx.createGain();
    p.delay.connect(p.fb).connect(p.delay);
    p.input.connect(p.delay).connect(p.wet);
    return p;
  }

  function buildReverb() {
    const p = makeShell(false);
    p.verb = ctx.createConvolver();
    p.toneLP = ctx.createBiquadFilter();
    p.toneLP.type = 'lowpass';
    p.impulses = {};
    p.sizeZone = -1;
    p.input.connect(p.verb).connect(p.toneLP).connect(p.wet);
    return p;
  }

  const BUILDERS = {
    drive: buildDrive, wah: buildWah, chorus: buildChorus,
    phaser: buildPhaser, delay: buildDelay, reverb: buildReverb,
  };

  let prev = null;
  let input = null;
  for (const def of PEDAL_DEFS) {
    const p = BUILDERS[def.id]();
    pedals[def.id] = p;
    if (prev) prev.output.connect(p.input);
    else input = p.input;
    prev = p;
  }

  function apply(id, cfg) {
    const p = pedals[id];
    if (!p || !cfg) return;
    const t = ctx.currentTime;

    if (id === 'drive') {
      p.shaper.curve = driveCurve(cfg.drive);
      p.toneLP.frequency.setTargetAtTime(600 * 20 ** (cfg.tone / 100), t, FADE);
      p.level.gain.setTargetAtTime(0.25 + (cfg.level / 100) * 0.95, t, FADE);
    } else if (id === 'wah') {
      const base = 320 * 14 ** (cfg.freq / 100);
      const q = 0.9 + (cfg.reso / 100) * 8;
      const peakDb = 5 + (cfg.reso / 100) * 13;
      p.bp.frequency.setTargetAtTime(base, t, FADE);
      p.bp.Q.setTargetAtTime(q, t, FADE);
      p.bp.gain.setTargetAtTime(peakDb, t, FADE);
      const speed = cfg.speed / 100;
      p.lfo.frequency.setTargetAtTime(0.1 + speed * 5.5, t, FADE);
      p.lfoGain.gain.setTargetAtTime(speed === 0 ? 0 : base * 0.62, t, FADE);
      p.level.gain.setValueAtTime(cfg.on ? 1.12 : 1, t);
    } else if (id === 'chorus') {
      p.lfo.frequency.setTargetAtTime(0.15 + (cfg.rate / 100) * 3.5, t, FADE);
      p.lfoGain.gain.setTargetAtTime((cfg.depth / 100) * 0.009, t, FADE);
    } else if (id === 'phaser') {
      p.lfo.frequency.setTargetAtTime(0.05 + (cfg.rate / 100) * 1.6, t, FADE);
      p.lfoGain.gain.setTargetAtTime(200 + (cfg.depth / 100) * 1000, t, FADE);
    } else if (id === 'delay') {
      const timeName = TIME_STEPS[zone(cfg.time, TIME_STEPS.length)];
      p.delay.delayTime.setTargetAtTime((60 / FIXED_BPM) * TIME_MULT[timeName], t, 0.05);
      p.fb.gain.setTargetAtTime((cfg.feedback / 100) * 0.75, t, FADE);
    } else if (id === 'reverb') {
      const sz = zone(cfg.size, 3);
      if (sz !== p.sizeZone) {
        p.sizeZone = sz;
        if (!p.impulses[sz]) p.impulses[sz] = makeImpulse(ctx, [1.2, 2.2, 3.5][sz]);
        p.verb.buffer = p.impulses[sz];
      }
      p.toneLP.frequency.setTargetAtTime(800 * 14 ** (cfg.tone / 100), t, FADE);
    }

    const mixKeyed = cfg.mix !== undefined;
    const wetOn = mixKeyed ? (cfg.mix / 100) * (id === 'phaser' ? 1.1 : 0.95) : 1;
    const wetLevel = cfg.on ? wetOn : 0;
    const dryLevel = cfg.on && p.insert ? 0 : 1;
    p.wet.gain.setValueAtTime(wetLevel, t);
    p.dry.gain.setValueAtTime(dryLevel, t);
  }

  function applyAll(cfgs) {
    for (const def of PEDAL_DEFS) apply(def.id, cfgs[def.id]);
  }

  return { input, output: prev.output, pedals, apply, applyAll };
}
