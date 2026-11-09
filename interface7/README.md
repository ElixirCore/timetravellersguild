# INTERFACE v7 — v6, sample based

v6 (the Tree of Life with a tesseract at its heart) with the AI taken out:
the sounds come in from a mic or an aux (line) input at the crown, are kept
in this browser, and are played by the /interface2 sample mixer, FIELD TAP,
LOOPSMITH and the v5 pedal chain, drawn in Three.js as the instrument itself.
Glyphs, not words. Nothing is generated and nothing is uploaded.

## The map

The ten sephirot are the ten parts of the instrument. The 22 paths are drawn;
the ones that carry sound light up and pulse with what is flowing through
them. Routing is fixed and follows the tree from the crown (where sound
comes in) down to the kingdom (the speaker):

    KETER    the sampler: REC (tap to start, tap to keep, a minute at most),
             the input (tap to step through the mic and any line inputs),
             input meter, take ring
    CHOKMAH  the sample library (tap to add as a track, ↓ wav, ✕✕ delete)
    BINAH    FIELD TAP: 8 pads, REC, AUTO, gate, level, clear, input meter
    TIFERET  the tesseract: 8 cells = 8 tracks (the /interface2 mixer)
    GEVURAH  DIRT + WAH            CHESED   CHORUS + PHASER
    HOD      VERB                  NETZACH  ECHO
    YESOD    LOOPSMITH: rec/dub, stop/clear, level, varispeed, 1×, glitch, crush
    MALKUTH  out: stop all, keep mix, export wav, kept mixes, output meter

    input (Keter) ─┬─> sampler > library (Chokmah) > tracks
                   └─> FIELD TAP (Binah) > pads
    tracks ─┐
    pads ───┴─> mix (Tiferet) > DIRT > WAH (Gevurah) > CHORUS > PHASER (Chesed)
               > ECHO (Netzach) > VERB (Hod) ─┬─> master > limiter > out (Malkuth)
                                               └─> LOOPSMITH (Yesod) ─> master

At Tiferet the chosen track's whole chain lies round the centre in signal
order: the sample (its waveform as a ring; drag on the ring to set the loop
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

## Sampling

The input is opened with the browser's voice processing off (no echo
cancelling, noise suppression or auto gain) and asks for two channels, so a
line input arrives as it is. Which device a browser offers depends on the
browser and the machine: on a computer every audio input shows up (a USB
interface, a line in); on a phone it is the built-in mic or whatever is
plugged in. The input is not monitored through the speakers. A take is
peak-normalised and kept as a wav. Takes shorter than a tenth of a second, or
silent, are not kept.

## Deploy

Static files only (index.html, js/, styles/, .htaccess), no backend. Drop
the folder in as /interface7. The mic needs https (the site has it). Three.js r180 is vendored in js/vendor/
(three.module.min.js + three.core.min.js, MIT, licence alongside).

## State

- Pedals, looper knobs, FIELD TAP settings and the chosen input:
  localStorage 'interface7-rig-v1' (a first visit starts from the v6, else
  v5, else v4, settings; those are only read).
- Samples: IndexedDB 'interface7-samples-v1', one wav each.
- Kept mixes: 'ttg_if7_mixes' (they name samples, so v6's mixes of
  generated clips are not copied).
- FIELD TAP pads: IndexedDB 'interface7-field-v1', first filled from v6's
  pads (else v5's, else v3/v4's). The old stores are only read.
- Samples live only in the browser they were recorded in: download the wav
  to keep one elsewhere.
- Tracks are not kept between visits, as in /interface2: keep them as a mix.

## Differences from where the parts came from

- v7: Keter samples instead of generating; Chokmah is your samples instead of
  the generated library (no daily allowance, no server, no hiding: delete).
- v7 opens unaffected: every pedal starts switched off (knob settings are
  kept), and a new track starts dry at 1× (v2's default pitch played at
  0.71×) with the filter open.
- v7 never starts sound by itself: an added sample or a loaded mix waits for
  ▶ at the cube (v1/v2 started a clip as soon as it was added).

- No transport or tempo (the /interface2 tracks loop freely), so LOOPSMITH
  starts and closes on the press instead of on the next bar, and the ECHO
  pedal's divisions sit on 112 BPM (v5's default).
- FIELD TAP has no step grid here: a pad sounds when tapped (and AUTO no
  longer writes starter steps). Trim-by-waveform is not carried over.
- Export renders the audible tracks through the pedal chain as set, plus the
  running loop; hand-played pads are not in the render.
