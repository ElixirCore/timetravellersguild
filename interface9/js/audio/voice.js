/* INTERFACE v9 — one note of a sampled instrument: a slice of the buffer,
   played at a rate, through a short envelope, into whatever node it is given
   (a track's chain, live; or the same chain in an offline render).

   It is either a ONE-SHOT (the slice plays out, whatever happens to the
   key) or a HELD note (the slice loops until the note is released). */

const ATTACK = 0.004;

export function startVoice(ctx, dest, buf, o) {
  const { time, rate, from, span, loop, vel } = o;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, time);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vel, time + ATTACK);
  src.connect(g);
  g.connect(dest);

  let endAt = Infinity;
  if (loop) {
    src.loop = true;
    src.loopStart = from;
    src.loopEnd = from + span;
    src.start(time, from);
  } else {
    /* a one-shot lasts as long as the slice does at this rate */
    const real = span / rate;
    endAt = time + real;
    g.gain.setValueAtTime(vel, Math.max(time + ATTACK, endAt - 0.008));
    g.gain.linearRampToValueAtTime(0, endAt);
    src.start(time, from);
    src.stop(endAt + 0.01);
  }

  const voice = {
    src, g, time, endAt, done: false,
    /* let go at `t` (context time); `tau` is how quickly it fades */
    release(t, tau = 0.012) {
      if (voice.done) return;
      const at = Math.max(t, time + ATTACK + 0.001, ctx.currentTime);
      try {
        g.gain.cancelScheduledValues(at);
        g.gain.setTargetAtTime(0, at, tau);
        src.stop(at + tau * 8 + 0.02);
      } catch { /* already stopped */ }
    },
  };
  src.onended = () => {
    voice.done = true;
    try { g.disconnect(); } catch { /* gone */ }
    voice.onend?.();
  };
  return voice;
}
