# INTERFACE v12 — the disc DAW

v8 was v7 plus the sequencer

v7 (the sample-based Tree of Life with a tesseract at its heart) with FIELD
TAP made programmable: each pad is now also a layer of steps you can lay
down, so a caught sound can be sequenced instead of only tapped. The record
input at the crown and the cube heart are unchanged. Glyphs, not words.
Nothing is generated and nothing is uploaded.

## The map

The ten sephirot are the ten parts of the instrument. The 22 paths are drawn;
the ones that carry sound light up and pulse with what is flowing through
them. Routing is fixed and follows the tree from the crown (where sound
comes in) down to the kingdom (the speaker):

    KETER    the sampler: REC (tap to start, tap to keep, a minute at most),
             the input (tap to step through the mic and any line inputs),
             input meter, take ring
    CHOKMAH  the sample library (tap to add as a track, ↓ wav, ✕✕ delete)
    BINAH    FIELD TAP: 8 pads, REC, AUTO, gate, level, clear, input meter —
             and THE GRID: each pad a programmable layer of steps, with the
             transport (play, tempo, bars)
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

## The grid and the transport (new in v8)

The steps glyph at Binah opens the grid. Each of the eight pads is a
programmable layer: a row of steps. Tap a step to lay the pad's sound down
there (it plays as you lay it); drag a step up or down to bend that hit's
pitch (0.25×–4×); M silences a layer without losing its steps. A pad still
plays when tapped by hand, sequenced or not — the grid is a more
programmable FIELD TAP, not a replacement for it.

What a step means in time is the timing model in js/seqmodel.js, in
Toby's words: "if it's 16 beats to the bar it triggers quick and fast; if
it's long say 16 bars it's long slow and pad like. Everything needs to be
quantised to a beat." So every layer is always 16 steps, and BARS stretches
the same 16 steps over 1, 2, 4, 8 or 16 bars — short is quick and fast,
long is slow and pad-like, and the powers-of-two stops keep every step
exactly on a beat (1/4, 1/2, 1, 2 or 4 beats each). The transport (▶, BPM)
is in
the grid's header and runs wherever you are on the tree; the ECHO pedal
keeps its own fixed tempo as in v7.

## What v12 is: a disc DAW

One record, played by an arm. Every loaded track is a ring of a single stacked
disc; the arm (the spinner) turns once per round of 16 steps at the tempo, so
the whole arrangement is on one face and plays as it turns.

- **The open ring.** The chosen track's ring opens wide as a circular piano
  roll: a petal per step, the petal's length is its note. Tap a bud to grow a
  petal, drag its tip out / in to change the note (right in removes it).
  Every other ring closes to a groove with a dot per step; tap a groove to
  open it. The dice rolls a new line.
- **Three kinds of sound, one ring.** An empty track offers three pages
  (AI / KIT / LP): *sounds* - sub-second one-shots from ElevenLabs sound
  generation; *kit* - the /interface5 kick, snare, hats, clap, tom, sub and
  acid bass, rendered in the browser; *loops* - ElevenLabs music, trimmed,
  fitted to whole bars at the tempo and blended end-to-start so it has no
  seam. A new sound is laid out as a line and set going.
- **Loops follow the transport.** A loop starts on the downbeat with the
  arm and stops with it, stretched to its bars at the current tempo (the
  tempo knob re-fits it while it runs). A loop is a ring of bar marks.
- **The song.** The small ring at the middle has eight laps; each is a
  pattern A-D or nothing (tap to cycle). One lap is one round of the steps.
  A B C D are four patterns per track (tap to swap, hold to copy).
- **Without a server.** If the sound service cannot be reached the page
  falls back to a built-in synth for sounds and to built-in grooves for loops,
  and says so, so a track is never silent.
- **iPhone silent switch.** The page asks for the playback audio session and
  keeps a silent <audio> alive; standard fix, not tested on a device.
- The playhead is now counted from what has been scheduled, so changing the
  tempo while it plays moves the arm on smoothly.

Gone from v11/v10: the length and level discs (one gate knob sets how long
notes are held). Saved mixes keep their tracks, patterns and song; a loop
track keeps its length in bars with the sample.

### Server part (PHP)

    generate.php   asks ElevenLabs for a sound or a music loop (key stays here)
    serve.php      hands the stored mp3 back to the page
    config.php     YOU add this: copy config.sample.php, put the key in
                   (or copy the config.php from /interface2)
    store/         made on first use, closed to the web

Needs PHP with curl and a writable folder. Daily caps (60 sounds, 12 music
loops, 3 s between) are in config.php. Credits: about 40 per second of sound
effect, about 15 per second of music, so a loop is a few hundred.

Not verified: any call to ElevenLabs (my build sandbox cannot reach it; the
page and the PHP were exercised against a mock), that 0.5 s is the shortest
sound it accepts, the music length limits (10-30 s asked for here), audio by
ear, real mic latency, MIDI hardware, phone touch precision.

## The melody discs (new in v9)

At Tiferet the cube stays in the middle and the chosen track's melody is a
stack of discs round it, each a ring of petals. A petal's length is the note
information; drag its tip out or in.

- PITCH (outer disc): 16 petals, one per step. Out = higher, up the chosen
  scale (pentatonic, major, minor or chromatic; the scale glyph on the rim
  steps through them, the octave knob shifts the window). Drag right in to
  silence a step. Tap a step to switch it on (it takes the last note played)
  or off.
- LENGTH (next in): how long the note is held, 1/8 of a step up to playing the
  sample out. LEVEL (next): how loud. Tap cycles the value.
- SONG (inner disc): eight petals, each a pattern A-D (or nothing). One petal
  lasts one trip round the 16 steps; all tracks follow. Tap cycles the letter.
  Each track holds four patterns; the discs show the one the song is on (or the
  one you last chose, when stopped). With no petals the chosen pattern loops.
- The spinner is the playhead: it turns once per trip round the steps, at the
  tempo, and the rings pulse on every beat (also when stopped). The middle
  glyph starts and stops it. Tempo and bars (1-16: the same 16 steps stretched
  longer = slower, more pad-like) are knobs on the rim. A sequenced track is one
  voice, like a chip channel: a new step cuts the last.
- A track is an instrument: the computer keyboard (A W S E D F T G Y H U J K O L P ;,
  Z/X octave, space = start/stop) and any MIDI keyboard (plug glyph, tap once to
  allow; Chromium browsers) play the chosen track. The rec glyph on the rim
  records those notes onto the nearest step as the spinner turns.
- An empty track is a record button. Tap it: with a click, one trip round the
  steps (a whole number of bars at the tempo) is taken from the input starting
  on beat 1, trimmed to exactly that length, kept in the library, put in the
  track and laid on the first step so it plays in time as the spinner passes.
  Latency is corrected only roughly (output + block latency), so a take is
  close to, not sample-exact on, the grid. Tap again while it waits to cancel.
- The thin ring at the middle is the sample with its loop points (drag it);
  notes play the loop region. The loop glyph on the rim still plays the sample
  freely as before.
- Tracks, patterns and the song are kept with SAVE (a kept mix), as tracks
  always were: not between visits. Export renders one pass of the song.
- No squares: the XY dish, the FIELD TAP step grid and its panel (v8) are gone;
  FIELD TAP pads are tapped as in v7.

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
the folder in as /interface11. The mic needs https (the site has it). Three.js r180 is vendored in js/vendor/
(three.module.min.js + three.core.min.js, MIT, licence alongside).

## State

- Pedals, looper knobs, FIELD TAP settings, the chosen input and the
  sequencer (tempo, bars, every layer's steps): localStorage
  'interface9-rig-v1' (a first visit starts from the v8, else v7, else v6, else v5,
  else v4 settings; those are only read).
- Samples: IndexedDB 'interface9-samples-v1', one wav each; first run copies
  v8's samples across (v8's store is only read).
- Kept mixes: 'ttg_if9_mixes' (earlier versions' mixes are left where they live).
- FIELD TAP pads: IndexedDB 'interface9-field-v1', first filled from v8's
  pads (else v6's, else v5's, else v3/v4's). The old stores are only read.
- Samples live only in the browser they were recorded in: download the wav
  to keep one elsewhere.
- Tracks are not kept between visits, as in /interface2: keep them as a mix.

## Differences from where the parts came from

- v9: stacked petal discs for each track's melody, a song disc, a tempo spinner, record-on-the-beat; the v8 pad grid and the filter x pitch square are removed.
- v8: FIELD TAP gains the grid (the v5 step grammar: tap to lay, drag for
  pitch) and a transport; everything else is v7 as deployed.
- v7: Keter samples instead of generating; Chokmah is your samples instead of
  the generated library (no daily allowance, no server, no hiding: delete).
- v7 opens unaffected: every pedal starts switched off (knob settings are
  kept), and a new track starts dry at 1× (v2's default pitch played at
  0.71×) with the filter open.
- v7 never starts sound by itself: an added sample or a loaded mix waits for
  ▶ at the cube (v1/v2 started a clip as soon as it was added).

- No transport drives the /interface2 tracks (they loop freely), so
  LOOPSMITH starts and closes on the press instead of on the next bar. The
  ECHO pedal's divisions sit on 112 BPM (v5's default), independent of the
  sequencer's tempo.
- Export renders the audible tracks through the pedal chain as set, plus the
  running loop; hand-played and sequenced pads are not in the render.
