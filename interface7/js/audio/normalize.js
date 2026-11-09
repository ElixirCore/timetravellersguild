/* How loud a captured sound comes back. Level never decides whether a take
   survives: only digital silence (peak exactly zero) is answered with
   "too quiet". Anything with a signal is kept and peak-normalised to the
   ceiling, as it always was - so the softest sound the mic picked up plays
   back at full level. */

/* sampler takes: one gain shared by both channels, ceiling 0.89 as before */
export function normalizeTake(channels) {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  }
  if (peak <= 0) return null;
  const g = 0.89 / peak;
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) out[i] = ch[i] * g;
    return out;
  });
}

/* FIELD TAP pads: the pad voice's own normalisation, ceiling 0.9 as before */
export function normalizeFloat32(data) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  if (peak <= 0) return null;
  const out = new Float32Array(data.length);
  const g = 0.9 / peak;
  for (let i = 0; i < data.length; i++) out[i] = data[i] * g;
  return out;
}