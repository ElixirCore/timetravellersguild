# INTERFACE v6 — the Tree of Life, with a tesseract at its heart

The /interface2 sample mixer (the best of v1–v5), with FIELD TAP, LOOPSMITH
and the pedal chain from v5, drawn in Three.js as the instrument itself.
Glyphs, not words.

## The map

The ten sephirot are the ten parts of the instrument. The 22 paths are drawn;
the ones that carry sound light up and pulse with what is flowing through
them. Routing is fixed and follows the tree from the crown (a word becomes a
sound) down to the kingdom (the speaker):

    KETER    generate: prompt, music/fx, length, grow; one dot per daily generation
    CHOKMAH  the clip library (tap to add as a track, ↓ mp3, ✕ hide from this menu)
    BINAH    FIELD TAP: 8 pads, REC, AUTO, gate, level, clear, input meter
    TIFERET  the tesseract: 8 cells = 8 tracks (the /interface2 mixer)
    GEVURAH  DIRT + WAH            CHESED   CHORUS + PHASER
    HOD      VERB                  NETZACH  ECHO
    YESOD    LOOPSMITH: rec/dub, stop/clear, level, varispeed, 1×, glitch, crush
    MALKUTH  out: stop all, keep mix, export wav, kept mixes, output meter

    tracks ─┐
    pads ───┴─> mix (Tiferet) > DIRT > WAH (Gevurah) > CHORUS > PHASER (Chesed)
               > ECHO (Netzach) > VERB (Hod) ─┬─> master > limiter > out (Malkuth)
                                               └─> LOOPSMITH (Yesod) ─> master

At Tiferet the chosen track's whole chain lies round the centre in signal
order: the clip (its waveform as a ring; drag on the ring to set the loop
points) > pitch > drive > filter > reson > wobble rate > wobble > echo length >
echo > hall > volume. Below: mute, solo, whole clip, remove, and the
filter × pitch dish. The eight small cubes at the top choose the track; the
hypercube turns through the fourth dimension until that track's cell is the
inner cube.

## Getting around

Everything is in one view to begin with. Tap a sephira to travel to it; its
controls then play. Tap a neighbour (or a marker at the screen edge) to follow
a path on; the tree glyph top left (or Esc) pulls back to the whole. Knobs:
drag up/down (mouse or finger, several fingers at once), or the mouse wheel.
A mix bead at Malkuth loads on tap and is removed on a long press.
Pinch with two fingers (off the controls) to zoom in or out and drag the
view; with a mouse, a trackpad pinch or the wheel away from the knobs does the
same. Travelling to a station, the tree glyph or Esc sets the view back.
At every station the (i) glyph at top right opens a round card on how to play
it: each line starts with the glyph it explains. Tap anywhere or Esc to close.

## Backend

Same endpoints as v3–v5, through /interface2, so the library and the shared
33/day cap stay shared with /interface and /interface2:

- GET  {API_BASE}/clips.php
- POST {API_BASE}/generate.php   {mode, prompt, seconds}
- GET  {API_BASE}/serve.php?f=<id>[&dl=1]

API_BASE is the single constant at the top of js/api.js ('/interface2').
No secrets live in this tree.

## Deploy

Static files only (index.html, js/, styles/, .htaccess). Drop the folder next
to /interface2 as /interface6. Three.js r180 is vendored in js/vendor/
(three.module.min.js + three.core.min.js, MIT, licence alongside).

## State

- Pedals, looper knobs and FIELD TAP settings: localStorage 'interface6-rig-v1'
  (a first visit starts from the v5, else v4, settings; those are only read).
- Kept mixes: 'ttg_if6_mixes'; hidden clips: 'ttg_if6_hidden'. A first visit
  copies /interface2's lists; v2's own are never written.
- FIELD TAP pads: IndexedDB 'interface6-field-v1', first filled from v5's
  pads (or v3/v4's). The old stores are only read.
- Tracks are not kept between visits, as in /interface2: keep them as a mix.

## Differences from where the parts came from

- No transport or tempo (the /interface2 tracks loop freely), so LOOPSMITH
  starts and closes on the press instead of on the next bar, and the ECHO
  pedal's divisions sit on 112 BPM (v5's default).
- FIELD TAP has no step grid here: a pad sounds when tapped (and AUTO no
  longer writes starter steps). Trim-by-waveform is not carried over.
- Export renders the audible tracks through the pedal chain as set, plus the
  running loop; hand-played pads are not in the render.
