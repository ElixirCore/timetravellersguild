/* Coindrop config — edit this file, no build step needed.
   lines: Jack's thank-you lines, played in order (0001, 0002 …), like the SD card.
     text     what Jack says and what appears on his ticket. [hop] [nod] [bow] [unsure] etc. fire gestures.
     audio    optional path to a recorded line, e.g. "audio/0001.mp3". When set, the recording plays
              and Jack's mouth follows its loudness. When null, the device's built-in voice reads the text.
   These lines are placeholders in English. Swap in the real script and recordings when you have them. */
window.COINDROP_CONFIG = {
  voice: { lang: "en-GB", rate: 0.95, pitch: 0.85 },
  lines: [
    { text: "Thank you for the pound. [bow] Received, counted and filed.", audio: null },
    { text: "One pound, logged in the Guild's books. [nod] Thank you, time traveller.", audio: null },
    { text: "Much obliged. [hop] Jack, clerk of the Guild, at your service.", audio: null },
    { text: "Thank you. Your coin is in the box, and the records are tidy.", audio: null },
    { text: "Thank you for the pound. Where will it take us? [unsure] I don't know. Unknown is not false.", audio: null }
  ]
};
