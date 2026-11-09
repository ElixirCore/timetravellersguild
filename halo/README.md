# HALO

A tiny instrument for any sound. One circle turning.

**Time goes round, pitch goes out.** Sixteen steps go round the circle. Eight lanes go out from the middle, low at the centre and high at the rim. Everything snaps to the beat and to the mood's scale, so nothing you place can be out of key or out of time.

- **Tap the middle** to play or stop. **Drag it up or down** to change the tempo.
- **Tap the circle** to place the chosen sound there. **Tap a dot** to lift it off. **Drag a dot** to move it, or flick it off the edge to throw it away. **Drag across empty space** to paint.
- **Pebbles** (the coloured circles) are your sounds. **Tap one** to choose it and hear it. **Drag one** onto the circle to drop it in. **Hold one** to let it go.
- **The row of round buttons:** undo · mood (dusk / dawn / east / drift: every dot keeps its place and finds the new scale) · dice (a new line for the chosen sound) · clear · save one turn as a seamless WAV · **make** (spark) · **mic**.
- **Computer keys:** A S D F G H J K play the chosen sound low to high, and while it plays they write onto the nearest step. Space plays or stops. Z undoes.

## Any sound
- **Make (spark):** describe a sound ("a wet glass tap") and you get a one-shot that plays at every pitch. Describe music ("dusty soul drum loop") and the switch turns to *music*: ElevenLabs composes two turns of the circle at your tempo, and HALO chops it into eight slices. The lanes become the slices (1 at the middle, 8 at the rim), so you rearrange the music by moving its dots. The guess flips by itself as you type; tap the switch to overrule it.
- **Music is instrumental** unless your words ask for a voice (vocals, singing, lyrics, choir, rap…). Unless they do, HALO sends `force_instrumental: true` and adds "instrumental" to the prompt.
- **Mic:** records one second, and it plays at every pitch too.
- There are eight pebbles at most. Eight sounds are built in and need no server.

## Put it on your host
Drop the `halo` folder on the server. It works as it is, with the built-in sounds and the microphone.
Making sounds needs PHP. Copy `config.sample.php` to `config.php` and put your ElevenLabs key in it. No key is in this zip. `.htaccess` keeps config.php and the stored clips off the web. There are daily caps: 60 sounds and 12 music clips.

## Not verified
- The real ElevenLabs calls. The page and PHP were tested only against a mock. The music request (`/v1/music/stream`, `music_length_ms`, `force_instrumental`) follows ElevenLabs' current docs. Whether the music actually holds the asked tempo and starts on the beat (which decides whether the slices land on beats) is unknown until it is tried.
- How it sounds by ear, touch on a real phone, and the iPhone silent-switch workaround.
