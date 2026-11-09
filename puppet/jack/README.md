# Jack / Field — timetravellersguild.com/puppet

Jack, clerk of the Guild, a robot of punched card stock, living on his own in a field.

Plain static files: no build step, no server code, relative paths. Upload the `puppet` folder so it sits at `timetravellersguild.com/puppet/`:

```
rsync -av puppet/ <your-ssh-host>:<path-to>/timetravellersguild/puppet/
```

## What he does on his own

Jack runs a small mind with three needs (tidiness, curiosity, company) and picks what to do next from them. The panel on the right shows his goal, his current step, his needs and a log of every decision.

| Goal | When | What happens |
|---|---|---|
| Fetch a pound | a coin is on the ground (always first) | walks to it, crouches, picks it up, carries it to the money box, files it, says thank you |
| Tidy the records | loose punchcards have blown into the grass | picks one up and feeds it into the hopper on the desk; the filed stack grows |
| Check the TimePod | curiosity runs high | opens the door, steps in, the pod flashes while he's on the network, he steps back out |
| Walk the field | in between | picks a spot, looks around, sometimes looks up at the sky |
| Say hello | he's been alone a while | turns to you and waves |
| Stand by | resting | breathes, blinks |

Cards blow in on the wind every 20–35 seconds, so there is always something to tidy.

## What visitors can do

* **Tap the field** to drop a £1. He drops what he's doing (unless his hands are full) and fetches it.
* **Tap Jack** and he turns, waves and says hello.
* **Talk to Jack**: type a question. He turns to listen, thinks, and answers.
* **Sound** (off by default) reads his lines in the device's built-in voice. **Follow** keeps the camera on him. **12 fps** holds frames like the cube cards; switch to Smooth if you prefer.

## His answers, and plugging in a real brain

`assets/config.js` holds every line he says: thank-yous, hellos, musings, and local answers matched by keyword. All of it is English placeholder text built from Guild canon. Anything he doesn't recognise gets "I don't know. Unknown is not false."

To give him a real brain, set `brain.url`. Visitor messages are then POSTed there as JSON:

```json
{ "message": "who are you?", "world": { "goal": "...", "pounds_filed": 2, "cards_filed": 5, "cards_loose": 1, "coins_on_ground": 0 } }
```

and the reply is read as `{ "say": "...", "gesture": "wave|nod|bow|unsure", "goal": "tidy|pod|wander|greet|rest" }`. If the call fails or times out, he falls back to the local answers. A small PHP endpoint in front of JackRuntime could return this shape; the exact mapping depends on what JackRuntime returns.

## Driving him from other code (the suit)

```js
await JackSuit.do({ say: "Hello. [wave]" });
await JackSuit.do({ walkTo: [200, 100], think: "Over here." });
await JackSuit.do({ goal: "pod" });
JackSuit.dropCoin(120, 200);
JackSuit.state;   // { goal, step, position, pounds_filed, cards_filed }
// or from a parent page:
frame.contentWindow.postMessage({ jack: { say: "Hello." }, id: 1 }, "*");   // replies { jackDone: 1 }
```

On the live site, check `event.origin` before obeying a postMessage.

## One Jack

`assets/jack-core.js` is Jack: his face map, the site palette (card `#d9cb9e`, ink `#111214`, red `#c8203c`), blinking, the red third eye, mouth shapes, speech ticket and voice. The same file ships in `/coindrop`. Change his face there once and copy it to both folders, so he looks the same everywhere.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page |
| `assets/config.js` | **Edit this.** Lines, answers, voice, brain URL |
| `assets/puppet.js` | Body, field, objects, movement, mind |
| `assets/jack-core.js` | Jack himself (shared with /coindrop) |
| `assets/puppet.css` | Styles |
| `assets/vendor/` | three.js r128 and OrbitControls, bundled |
