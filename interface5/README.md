# INTERFACE v4 — solarpunk DAW (Guild prompt-to-sound + /lab tech)

Built from the procrastinatrix.net/lab rig (arpbuilder mk·III), reskinned
solarpunk, with the /interface2 prompt-to-sound generator planted inside as
the SEEDBED unit.

## What it is

One page: a bar-synced Web Audio rig.

- MASTER — transport, tempo, MP3 record of the whole mix
- SCENE BOX — six rig snapshots (arp, bass, drums, field, stylus, pedals,
  seedbed lanes and steps) with save/recall
- SEEDBED — prompt -> clip (music/fx, ElevenLabs), shared clip library,
  plant clips onto 4 lanes and sequence them on a 16-step grid; per-step
  rate bend (drag vertically); lane mute; EJECT clears a lane
- LAB — the arp builder (unchanged)
- BEATBOX / FIELD TAP / STYLUS / LOWBUILDER / LOOPSMITH / pedalboard —
  ported unchanged from the lab

## Backend

SEEDBED talks to the existing /interface2 endpoints, so the clip library
and the shared 33/day generation cap stay shared with /interface and
/interface2:

- GET  {API_BASE}/clips.php
- POST {API_BASE}/generate.php   {mode, prompt, seconds}
- GET  {API_BASE}/serve.php?f=<id>[&dl=1]

API_BASE is the single constant at the top of js/api.js (currently
'/interface2', same-origin on timetravellersguild.com). No secrets live in
this tree; the ElevenLabs key stays in /interface2/config.php, untouched.

## Deploy

Static files only (index.html, js/, styles/, .htaccess). Drop the folder
next to /interface2. Serving from any path works as long as API_BASE
points at the interface2 endpoints.

## State

Rig state persists in localStorage ('interface3-rig-v1'); scenes in
'interface3-rig-scenes-v1'; FIELD TAP mic samples in IndexedDB
('arpbuilder-field-v1', 'arpbuilder-field-scenes-v1'). Seed lanes persist
clip ids only; audio is re-fetched from the library on load.


## v4 changes (on top of v3)

- Loops: music prompts get a "seamless loop" instruction (LOOP toggle by GROW,
  stripped from displayed names). A LOOP lane trims dead air, crossfades tail
  into head, fits to a whole number of bars at the master tempo and runs
  bar-locked; steps gate it. A freshly grown loop plants itself in LOOP mode.
- Step mangling: vertical drag = pitch in semitones (SNAP on/off), horizontal
  drag = paint steps, long-press = ratchet 1-4, right-click resets a step.
  One-shot hits now choke the previous hit with a short fade, ratchets slice.
- Lane tools: SHOT/LOOP, REV, shift, DICE, WIPE.
- New clips appear at the top of the list.
- Storage keys are interface4-*; they seed from v3 saves (v3 data untouched).
- Deploy as /interface4 beside /interface3; API_BASE unchanged.

## v5 changes (on top of v4)

- FIELD TAP AUTO button (next to REC). Arm it once: every sound the mic hears
  above the GATE is cut into a sub-second one-shot (max 0.95 s, silence trimmed,
  short fade-out, attack kept via a pre-roll), stored on the current pad, and the
  next pad takes over (P1 to P8, then round again). A pad whose row had no steps
  gets two light hits so it is heard at once. REC/STOP arms and stops as before;
  AUTO off gives the old single-shot capture.
- v5 uses its own storage (interface5-rig-*, arpbuilder-field-v5 and
  arpbuilder-field-scenes-v5). First run copies the v4/v3 pads and scenes across;
  the old ones are only read, so the live v3/v4 rigs are never overwritten.
