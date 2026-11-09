# INTERFACE v3 — solarpunk DAW (Guild prompt-to-sound + /lab tech)

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
