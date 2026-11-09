/* Jack / Field config — edit freely, no build step.

   brain.url   Optional. When set, anything a visitor types is POSTed there as JSON:
                 { message: "...", world: { goal, pounds_filed, cards_filed, cards_loose, coins_on_ground } }
               and the reply is read as JSON: { say: "...", gesture?: "wave|nod|bow|unsure", goal?: "tidy|pod|wander|greet|rest" }.
               Leave null to use the local answers below. If the call fails, Jack falls back to them.

   Everything Jack says here is an English placeholder built from Guild canon. Replace with the real script. */
window.PUPPET_CONFIG = {
  voice: { lang: "en-GB", rate: 0.95, pitch: 0.85 },
  soundOnByDefault: false,
  brain: { url: null, timeoutMs: 8000 },

  thanks: [
    "Thank you for the pound. [bow] Received, counted and filed.",
    "One pound, logged in the Guild's books. [nod] Thank you, time traveller.",
    "Much obliged. Jack, clerk of the Guild, at your service.",
    "Thank you. Your coin is in the box, and the records are tidy.",
    "Thank you for the pound. Where will it take us? [unsure] I don't know. Unknown is not false."
  ],
  hello: [
    "Hello. [wave] Jack here, clerk of the Guild.",
    "Evening. [nod] Standing by.",
    "Hello, time traveller. [wave]"
  ],
  musings: [
    "Standing by.",
    "Wind's picking up. Cards will come loose.",
    "Records tidy. For now.",
    "Somebody might drop a pound.",
    "Checking the field.",
    "Projection holding.",
    "Nice out. I set it that way."
  ],

  // Local answers: the first entry with a matching word wins.
  answers: [
    { match: ["who are you", "what are you", "your name", "who is jack"], say: "I'm Jack. [nod] A robot of punched card stock, and clerk of the Guild." },
    { match: ["department", "excess time", "1950", "fifties", "where did you work", "before"], say: "I started in the 1950s at the Department of Excess Time. Then the money was cut, and I lost that job." },
    { match: ["clerk", "job", "what do you do", "work"], say: "I keep the Guild's records tidy, and I answer questions." },
    { match: ["timepod", "time pod", "phonebox", "phone box", "red box"], say: "The red phoneboxes are TimePods. [nod] Out there they link people to the network. This one only changes the picture." },
    { match: ["cube", "where do you live", "home"], say: "I live inside a twisty puzzle cube. [nod] So does this field. I project it." },
    { match: ["where are you", "where are we", "where is this", "is this real", "projection", "planet", "mars", "venus", "mercury", "jupiter", "saturn", "uranus", "neptune", "pluto", "have you been", "did you travel", "fly here"], say: "In the cube. [nod] All of this is projected. Projection is not storage." },
    { match: ["pound", "coin", "money", "£"], say: "Tap the field to drop a pound. I'll fetch it and file it in the money box." },
    { match: ["card", "cards", "hopper", "desk"], say: "Loose cards go in the hopper on the desk. One at a time." },
    { match: ["hello", "hi", "hiya", "evening", "morning", "shwmae"], say: "Hello. [wave] Standing by." },
    { match: ["thank"], say: "You're welcome. [bow]" }
  ],
  unknown: "[unsure] I don't know. Unknown is not false.",

  /* Exchanges the TimePod can dial - same bodies as the CHRONOS list at /box. Visuals only. */
  planets: [
    { key: "earth",   name: "Earth",   era: "Geocentric Present", ground: { color: 0x2a331f, grass: true }, sky: null, rings: null, line: "Earth. As near as I could file it." },
    { key: "moon",    name: "Luna",    era: "Geocentric Present", ground: { color: 0x8f8f8c, tex: "regolith", accent: 0x5c5c58 }, sky: [0x050608, 0x23262b, 0x0c0d10], rings: null, line: "The Moon. Quiet as a closed drawer." },
    { key: "mercury", name: "Mercury", era: "Inner System",       ground: { color: 0x6e6a66, tex: "regolith", accent: 0x413e3a }, sky: [0x040507, 0x3a3733, 0x14120f], rings: null, line: "Mercury. A small, hot filing error." },
    { key: "venus",   name: "Venus",   era: "Inner System",       ground: { color: 0xb98d4f, tex: "sand", accent: 0x8a6736 }, sky: [0x6b5228, 0xe0b96a, 0x8a6a35], rings: null, line: "Venus. The clouds keep their own counsel." },
    { key: "mars",    name: "Mars",    era: "Outer System",       ground: { color: 0x8a3b22, tex: "sand", accent: 0x5e2413 }, sky: [0x3a1c14, 0xc77b52, 0x5a2c1c], rings: null, line: "Mars. Red sand in every drawer." },
    { key: "sun",     name: "Sol",     era: "Solar Present",      ground: { color: 0x3d0f04, tex: "fire", accent: 0xffa62b, emissive: 0xff5a1f }, sky: [0x2b0a02, 0xb33a08, 0x571503], rings: null, line: "The Sun. Everything here is on fire, including the records." },
    { key: "jupiter", name: "Jupiter", era: "Outer System",       ground: { color: 0xb0a08a, tex: "bands", accent: 0x7a5f45 }, sky: [0x4a4238, 0xcbb493, 0x6e5f4c], rings: { color: 0xd8c8a8, opacity: 0.3, inner: 1700, outer: 3600, tilt: 0.09, y: 260 }, line: "Jupiter. A great deal of weather." },
    { key: "saturn",  name: "Saturn",  era: "Outer System",       ground: { color: 0xbfae7d, tex: "bands", accent: 0x8f7c52 }, sky: [0x3f3826, 0xd6c68d, 0x6f6140], rings: { color: 0xe8d9ac, opacity: 0.9, inner: 1600, outer: 4500, tilt: 0.12, y: 200 }, line: "Saturn. Mind the rings. They are older than the Department." },
    { key: "uranus",  name: "Uranus",  era: "Deep System",        ground: { color: 0x9fd4d8, tex: "bands", accent: 0x6ba8ad }, sky: [0x1e3a40, 0x9fd4d8, 0x3d666c], rings: { color: 0xcfedef, opacity: 0.4, inner: 1800, outer: 3400, tilt: 0.16, y: 220 }, line: "Uranus. Everything sideways." },
    { key: "neptune", name: "Neptune", era: "Deep System",        ground: { color: 0x3f5fb8, tex: "bands", accent: 0x27407e }, sky: [0x0a1230, 0x3f5fb8, 0x14204a], rings: { color: 0x9fb4e8, opacity: 0.35, inner: 1800, outer: 3500, tilt: 0.1, y: 200 }, line: "Neptune. The far drawer of the system." },
    { key: "pluto",   name: "Pluto",   era: "Kuiper Belt",        ground: { color: 0xc7cfd4, tex: "ice", accent: 0x8b969d }, sky: [0x04050a, 0x2a3038, 0x10131a], rings: null, line: "Pluto. Cold storage." }
  ]
};

