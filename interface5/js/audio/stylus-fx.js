import { state } from '../state.js';
import { getCtx, nodes, makeImpulse } from './context.js';

let impulse = null;

export function buildStylusFx(ctx) {
  const input = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';

  const dry = ctx.createGain();
  const chorusWet = ctx.createGain();
  chorusWet.gain.value = 0;
  const chorusDelay = ctx.createDelay(0.06);
  chorusDelay.delayTime.value = 0.024;
  const chorusLfo = ctx.createOscillator();
  const chorusLfoGain = ctx.createGain();
  chorusLfoGain.gain.value = 0.003;
  chorusLfo.frequency.value = 0.22;
  chorusLfo.connect(chorusLfoGain).connect(chorusDelay.delayTime);
  chorusLfo.start();

  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;
  const reverb = ctx.createConvolver();

  const output = ctx.createGain();
  input.connect(filter);
  filter.connect(dry).connect(output);
  filter.connect(chorusDelay).connect(chorusWet).connect(output);
  filter.connect(reverbWet).connect(reverb).connect(output);

  nodes.stylusIn = input;
  nodes.stylusFilter = filter;
  nodes.stylusDry = dry;
  nodes.stylusChorusWet = chorusWet;
  nodes.stylusReverbWet = reverbWet;
  nodes.stylusReverb = reverb;
  nodes.stylusFxOut = output;

  return output;
}

export function applyStylusFx() {
  const ctx = getCtx();
  if (!ctx || !nodes.stylusFilter) return;
  const fx = state.stylus.fx;
  const t = ctx.currentTime;

  const warm = fx.warm / 100;
  nodes.stylusFilter.frequency.setTargetAtTime(700 + warm * 4800, t, 0.06);
  nodes.stylusFilter.Q.setTargetAtTime(0.3 + warm * 0.35, t, 0.06);

  const chor = fx.chorusOn ? warm * 0.38 : 0;
  const rev = fx.reverbOn ? (fx.space / 100) * 0.5 : 0;
  nodes.stylusChorusWet.gain.setTargetAtTime(chor, t, 0.06);
  nodes.stylusReverbWet.gain.setTargetAtTime(rev, t, 0.06);
  nodes.stylusDry.gain.setTargetAtTime(chor + rev > 0.04 ? 0.7 : 0.9, t, 0.06);

  if (fx.reverbOn && !impulse) {
    impulse = makeImpulse(ctx, 2.6);
    nodes.stylusReverb.buffer = impulse;
  }
}
