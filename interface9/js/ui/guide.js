/* How to play each sephira: a round card, opened from the (i) at top right
   while you are at a station. Each line starts with the glyph it explains.
   Tap anywhere, or Esc, to close. */
import { glyphURL } from './glyphs.js';

const HOT = '#e8b93c';

const NOTES = {
  keter: [
    ['rec', 'record what comes in; tap again to keep it (up to a minute)'],
    ['sample', 'each take goes to the library and into a free track;', 'play', 'plays it at the cube'],
    ['mic', 'the input: tap to step through mic and', 'aux', 'line inputs'],
    ['vol', 'the inner ring is the input level; the outer, the take'],
  ],
  chokmah: [
    ['library', 'your samples, kept in this browser: tap one to add it as a track'],
    ['download', 'save the wav'],
    ['remove', 'tap twice to delete'],
  ],
  binah: [
    ['mic', 'tap a numbered pad to choose and play it'],
    ['rec', 'catch the next loud sound into it'],
    ['auto', 'keep catching, pad after pad'],
    ['gate', 'how loud is loud (the gold tick)'],
    ['vol', 'level', 'clear', 'empty the pad'],
  ],
  tiferet: [
    ['cube', 'the small cubes on the rim choose a track; the hypercube turns to it'],
    ['petals', 'the stacked discs are the track\'s melody, 16 steps round. Outer disc: drag a petal\'s tip out or in for its note (right in = silent); tap to switch a step on or off'],
    ['etime', 'next disc in: how long the note is held', 'vol', 'next: how loud'],
    ['chain', 'the inner disc is the song: eight petals, each a pattern A–D (out for later letters, tap to cycle). One petal is one round of the steps; every track follows'],
    ['play', 'the middle starts / stops the spinner, which turns once per round at the tempo'],
    ['time', 'tempo', 'bars', 'how many bars one round lasts (steps get slower and padlike)', 'scale', 'which notes the petals offer', 'pitch', 'octave'],
    ['hold', 'one-shot or held: a held note loops its sample until its length is up'],
    ['rec', 'record notes from a keyboard (A W S E D F …) or MIDI onto the nearest step as the spinner turns'],
    ['midi', 'allow a MIDI keyboard to play the chosen track'],
    ['rec', 'an empty track is a record button: tap, and one round is taken from the input on beat 1, with a click, then laid in the loop'],
    ['whole', 'drag the thin ring at the middle to loop part of the sample; tap to reset'],
    ['mute', 'mute', 'solo', 'solo', 'loop', 'play the sample freely', 'remove', 'remove'],
    ['pitch', 'the ring of knobs is the track\'s sound, in signal order'],
    ['dials', 'mixer', 'keys', 'play: the track as an instrument', 'chain', 'song: the structure'],
    ['keys', 'PLAY: the ring of keys is a keyboard (C at the top, sharps inside; your computer\'s A W S E D F … too). Z / X change octave'],
    ['steps', 'the outer ring is 16 steps: tap to lay a note, drag it out or in to bend it a semitone at a time. A new step takes the last note you played'],
    ['pitch', 'octave', 'chop', 'cut the sample into 1 – 16 chops', 'hold', 'a note loops while held'],
    ['chop', 'switch what dragging a step changes: its note, or which chop it plays'],
    ['clear', 'hold to empty the pattern; A – D are four patterns per track'],
    ['chain', 'SONG: eight beads, each a pattern - tap one to put the chosen letter there, hold to clear. One bead = one trip round the steps; every track follows'],
    ['midi', 'a MIDI keyboard plays the chosen track'],
  ],
  gevurah: [
    ['dirt', 'DIRT, then', 'wah', 'WAH: tap the big glyph to switch each on'],
    ['bolt', 'drive', 'tone', 'tone', 'vol', 'level'],
    ['freq', 'sweep', 'res', 'peak', 'speed', 'wah speed'],
  ],
  chesed: [
    ['chorus', 'CHORUS, then', 'phaser', 'PHASER: tap the big glyph to switch each on'],
    ['rate', 'speed', 'depth', 'depth', 'mix', 'how much'],
  ],
  netzach: [
    ['echo', 'ECHO: tap the big glyph to switch it on'],
    ['time', 'repeat time (four steps)', 'feedback', 'how many repeats'],
    ['mix', 'how much'],
  ],
  hod: [
    ['hall', 'VERB: tap the big glyph to switch it on'],
    ['size', 'room size (S M L)', 'tone', 'brightness'],
    ['mix', 'how much'],
  ],
  yesod: [
    ['recdub', 'record what comes out of VERB; again to close the loop; again to layer over it'],
    ['stopclr', 'stop; again to clear'],
    ['loopspeed', 'loop speed', 'onex', 'back to 1×'],
    ['glitch', 'stutter', 'crush', 'grit', 'vol', 'loop level'],
  ],
  malkuth: [
    ['stopall', 'stop every track'],
    ['save', 'keep this mix as a numbered bead'],
    ['export', 'download the mix as a wav'],
    ['speaker', 'tap a bead to load it, hold to remove it; the ring is the output level'],
  ],
};

const ALWAYS = [
  ['home', 'the whole tree · pinch or wheel to zoom'],
];

export function createGuide(nav, stations) {
  const btn = document.getElementById('info');
  const card = document.getElementById('guide');
  btn.querySelector('img').src = glyphURL('info');

  function line(parts) {
    const p = document.createElement('p');
    for (let i = 0; i < parts.length; i += 2) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = glyphURL(parts[i], HOT);
      const span = document.createElement('span');
      span.textContent = parts[i + 1];
      p.append(img, span);
    }
    return p;
  }

  function open() {
    const key = nav.focus;
    if (!key) return;
    const inner = card.firstElementChild;
    inner.replaceChildren();
    const head = document.createElement('img');
    head.className = 'head';
    head.alt = key;
    head.src = glyphURL(stations[key].glyph, HOT);
    inner.append(head);
    for (const parts of [...NOTES[key], ...ALWAYS]) inner.append(line(parts));
    card.hidden = false;
    inner.scrollTop = 0;
  }

  function close() { card.hidden = true; }

  btn.addEventListener('click', open);
  card.addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden) { e.stopImmediatePropagation(); close(); }
  }, true);
  nav.onChange((key) => { btn.hidden = !key; close(); });

  return { open, close };
}
