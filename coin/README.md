# Coindrop · Money-box Jack

Interactive 3D reference build for the Time Travellers Guild coin box. Drop a pound and Jack, clerk of the Guild, says thank you.

Plain static files. No build step, no server code. All paths are relative, so the folder works wherever it is placed.

## Deploy

Canonical home: `timetravellersguild.com/coin/`. The site is served from the `ffilm.org/timetravellersguild` folder, so over SSH that is:

```
rsync -av coindrop/ <your-ssh-host>:<path-to>/timetravellersguild/coin/
```

Then open `https://timetravellersguild.com/coin/`.

The page also carries the till wiring: `coin-pay.js` talks to `pay.php` (Stripe checkout, currently paused server-side so no payment can be made) and `coin.php` (server-verified coin issue and one-time drop). Jack's recorded blessing (`audio.mp3`, the voice note) is the prize for every £1 dropped, rehearsal or paid.

The brand mark in the top left links to `../`, the Guild home page.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page |
| `assets/config.js` | **Edit this.** Jack's thank-you lines, voice settings, recorded audio paths |
| `assets/coindrop.js` | 3D model, controls, coin run, speech |
| `assets/jack.js` | Jack's puppet (the 9 × 9 punchcard face, now with arms and legs), held frames at 12 fps |
| `assets/jack-sigil.jpg` | The Guild sigil plate photo on the back of Jack's card (from the supplied photo) |
| `assets/coindrop.css` | Styles |
| `assets/build-sheet.svg` | The original reference build sheet, shown in the Build sheet dialog |
| `assets/vendor/` | three.js r128 and OrbitControls, bundled so nothing loads from a CDN |
| `audio.mp3` | Jack's recorded blessing (the voice note), the prize for every drop |
| `audio/` | Put Jack's recorded lines here |

Fonts load from Google Fonts. Offline they fall back to the system monospace and serif.

## Jack's voice

Each coin plays the next line in `config.js`, in order, like the SD card's 0001.mp3, 0002.mp3 …

* With no recording, the visitor's device reads the line in its built-in voice (en-GB where available). Voices differ between phones and computers.
* To use a real recording, put the file in `audio/` and set its line's `audio`, for example `"audio/0001.mp3"`. The recording plays and Jack's mouth follows its loudness.
* Tags like `[bow]`, `[nod]`, `[hop]`, `[unsure]` in a line make Jack gesture at that point. They are not spoken.
* Tap Jack and he turns his card over (`flip`): the back carries the Guild sigil plate. His mouth follows the recording's loudness through a Web Audio analyser; the tap also opens the audio context so sound and lip-sync start with the first coin.
* The five lines shipped are English placeholders. Replace them with the real script.
* A coin that lands while Jack is still speaking is counted but does not start a new line, matching the firmware rule (BUSY low).

Browsers only allow sound after a visitor taps something. The Drop £1 button is that tap, so speech works from the first coin. The Sound button in the top bar mutes it.

## What departs from the 2D build sheet

1. Coin slot drawn vertical (coins pass through these mechs on edge, as far as known; check against the real unit).
2. Coin chute and removable coin box added at the rear floor, clear of the speaker.
3. COIN input: external 10k pull-up to 3.3 V, series resistor 1k–2.2k.
4. Power jacks moved above the rear hatch. Grey COUNTER wire shown capped.

The CH-926 body is a placeholder size. Measure the real unit before cutting anything.

Reference design, unbuilt.

