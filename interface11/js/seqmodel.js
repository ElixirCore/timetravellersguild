/* INTERFACE v8 — the sequencer's timing model: the ONE place that decides
   what a grid cell is, settled by Toby's word (25 Oct 2026):
     "If it's 16 beats to the bar it triggers quick and fast; if it's long
      say 16 bars it's long slow and pad like. Everything needs to be
      quantised to a beat."
   So a layer is always 16 cells, and the BARS control stretches the same 16
   cells across that many bars: short is quick and fast, long is slow and
   pad-like. The stretch stops are the powers of two, so every cell edge
   lands exactly on a beat (1/4, 1/2, 1, 2 or 4 beats each) — nothing fires
   off the grid. */
export const SEQ_CELLS = 16;
export const SEQ_BAR_STOPS = [1, 2, 4, 8, 16];
export const SEQ_BARS_MAX = 16;
export const SEQ_DEFAULT_BARS = 1;

/* beats spanned by one cell at a given stretch */
export function cellBeats(bars) {
  return (bars * 4) / SEQ_CELLS;
}

/* nearest stretch stop for any saved/asked bar count */
export function snapBars(n) {
  let best = SEQ_BAR_STOPS[0];
  for (const s of SEQ_BAR_STOPS) {
    if (Math.abs(s - n) < Math.abs(best - n)) best = s;
  }
  return best;
}
