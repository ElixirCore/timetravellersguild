# DISC

One small instrument made of circles. Four rings of sixteen steps turn under an arm.

- **Tap a step** to put the last note you played on it. **Drag round a ring** to paint. **Tap a lit step** to take it away.
- **The ring of petals in the middle** plays the chosen ring's sound (computer keys A S D F G H J K too). The last note you play is what steps take.
- **Middle button** (or space): play / stop. **Red dot**: record. Play the keys while it turns and they land on the nearest step.
- **Round buttons along the top:** tempo (drag up/down), scale, dice (a new line for the chosen ring), clear, mute, record, MIDI keyboard, save one lap as a looping WAV.
- **Row of sounds underneath:** eight built in (no server needed), the spark = describe a sound in words (ElevenLabs, under a second), the dot = record one second from the microphone, then the numbered ones you made.

## Put it on your host
Drop the folder on the server. It works as it is, with the built-in sounds and the microphone.
For "describe a sound": PHP needed. Copy `config.sample.php` to `config.php` and put your own ElevenLabs key in it. (No key is included in this zip.) `.htaccess` blocks config.php from the web.

## Not verified (honestly)
- Real ElevenLabs calls (tested only against a mock; the 0.5 s minimum length is untested).
- How it sounds by ear, real phone touch precision on the thin rings, real MIDI hardware.
- The iPhone silent-switch workaround, on a real iPhone.
