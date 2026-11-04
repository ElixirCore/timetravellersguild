/*
  screen/player.js — three recordings composited and algorithmically edited.

  All viewers share the same clock (via server Date header sync) so the
  algorithm fires at the same moments for everyone: a shared live edit.

  The scheduler assigns which clip plays in each of the three layers.
  The algorithm controls opacity, CSS blend mode, and periodic timeline
  jumps (seeks) — all deterministically from the current phrase number.
*/
(function () {
  'use strict';

  var S = window.ScreenScheduler;
  var NW = 3;
  var manifestURL = new URL('manifest.json', location.href);
  var clips = [], byId = {}, skew = 0;
  var vids = [];
  var assignedKeys = [null, null, null];
  var ui = { master: 0.9, masterMuted: false, tunedIn: false };
  var STORE = 'ttg-screen-comp-v1';
  var PHRASE = 9; // seconds per edit phrase

  var $ = function (s) { return document.querySelector(s); };
  var stage = $('#stage'), gate = $('#gate');
  function noop() {}

  /* ── saved settings ── */
  try {
    var saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && typeof saved === 'object') {
      if (typeof saved.master === 'number') ui.master = Math.min(1, Math.max(0, saved.master));
      if (saved.masterMuted === true) ui.masterMuted = true;
    }
  } catch (e) {}
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ master: ui.master, masterMuted: ui.masterMuted })); } catch (e) {}
  }

  /* ── shared clock ── */
  function nowSec() { return (Date.now() - skew) / 1000; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ── deterministic random (seed → [0,1)) ── */
  // LCG so it works without Math.imul polyfill concerns
  function rnd(seed) {
    var s = ((seed * 1664525) + 1013904223) & 0x7fffffff;
    s = ((s * 1664525) + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  }

  /* ── algorithm ── */
  // Curated blend combos. Layer 0 is always 'normal' (base over black).
  // Layers 1 and 2 blend on top of the composite below them.
  var COMBOS = [
    ['normal', 'screen',     'difference'],
    ['normal', 'multiply',   'screen'],
    ['normal', 'screen',     'multiply'],
    ['normal', 'difference', 'screen'],
    ['normal', 'overlay',    'difference'],
    ['normal', 'multiply',   'difference'],
    ['normal', 'screen',     'overlay'],
    ['normal', 'exclusion',  'screen'],
    ['normal', 'hard-light', 'difference'],
    ['normal', 'screen',     'exclusion'],
    ['normal', 'multiply',   'overlay'],
    ['normal', 'difference', 'multiply'],
  ];

  var alg = {
    phrase: -1,
    dom: 0,
    opacities: [1, 0.45, 0.3],
    blends: ['normal', 'screen', 'difference'],
    seeksPending: [null, null, null],
  };

  function computePhrase(phrase) {
    var s = phrase;

    // Which layer is most visible (0-2); rotates plus some randomness
    var dom = Math.floor(phrase / 3) % 3;
    if (rnd(s * 7 + 1) < 0.35) dom = Math.floor(rnd(s * 7 + 2) * 3);

    // Opacities: dominant is near-full, others vary
    var ops = [0, 0, 0];
    ops[dom]           = 0.85 + rnd(s + 11) * 0.15;
    ops[(dom + 1) % 3] = 0.25 + rnd(s + 12) * 0.45;
    ops[(dom + 2) % 3] = 0.1  + rnd(s + 13) * 0.35;

    // Blend combo
    var combo = COMBOS[Math.floor(rnd(s + 14) * COMBOS.length)];

    // Seeks: ~55% chance per layer; fraction within current clip
    var seeks = [
      rnd(s + 20) < 0.55 ? rnd(s + 21) : null,
      rnd(s + 22) < 0.55 ? rnd(s + 23) : null,
      rnd(s + 24) < 0.55 ? rnd(s + 25) : null,
    ];

    return { dom: dom, opacities: ops, blends: combo, seeksPending: seeks };
  }

  function applyVisuals() {
    for (var i = 0; i < NW; i++) {
      vids[i].style.opacity    = alg.opacities[i];
      vids[i].style.mixBlendMode = alg.blends[i] || 'normal';
    }
  }

  function applySeeks(st) {
    for (var i = 0; i < NW; i++) {
      if (alg.seeksPending[i] === null) continue;
      var seg = st[i];
      if (!seg) { alg.seeksPending[i] = null; continue; }
      var info = byId[seg.clip];
      if (!info) { alg.seeksPending[i] = null; continue; }
      var t = alg.seeksPending[i] * info.duration;
      t = Math.min(Math.max(0, t), info.duration - 0.5);
      try { vids[i].currentTime = t; } catch (e) {}
      alg.seeksPending[i] = null;
    }
  }

  /* ── audio ── */
  function applyAudio() {
    // Audio comes only from the dominant layer so blends don't produce
    // three simultaneous sound tracks.
    var vol = (ui.masterMuted ? 0 : ui.master) * ui.master;
    for (var i = 0; i < NW; i++) {
      var isdom = (i === alg.dom);
      vids[i].volume = isdom ? Math.min(1, vol) : 0;
      vids[i].muted  = !isdom || vol < 0.001;
    }
    $('#mmute').setAttribute('aria-pressed', String(ui.masterMuted));
    $('#master').value = Math.round(ui.master * 100);
  }

  /* ── user gesture → start playback ── */
  function engage() {
    if (ui.tunedIn) return;
    ui.tunedIn = true;
    gate.hidden = true;
    vids.forEach(function (v) { v.play().catch(noop); });
    applyAudio();
  }

  /* ── clip loading ── */
  function urlFor(id) { return new URL(byId[id].file, manifestURL).href; }

  function loadVid(i, seg, key) {
    var v = vids[i];
    assignedKeys[i] = key;
    v.dataset.key = key;
    v.muted = true;
    v.src = urlFor(seg.clip);
    var target = seg.start;
    v.addEventListener('loadedmetadata', function onMeta() {
      v.removeEventListener('loadedmetadata', onMeta);
      if (v.dataset.key !== key) return;
      try { v.currentTime = Math.min(Math.max(0, target), (v.duration || target) - 0.1); } catch (e) {}
      if (ui.tunedIn) v.play().catch(noop);
    });
    v.load();
  }

  /* ── main tick (250 ms) ── */
  function tick() {
    if (!clips.length) return;
    var t = nowSec();
    var st = S.stateAt(clips, t);
    if (!st.length) { stage.classList.add('nosignal'); return; }
    stage.classList.remove('nosignal');

    // Advance phrase
    var phrase = Math.floor(t / PHRASE);
    if (phrase !== alg.phrase) {
      alg.phrase = phrase;
      var next = computePhrase(phrase);
      alg.dom          = next.dom;
      alg.opacities    = next.opacities;
      alg.blends       = next.blends;
      alg.seeksPending = next.seeksPending;
      applyVisuals();
      applyAudio();
    }

    // Load / keep videos alive
    for (var i = 0; i < NW; i++) {
      var s = st[i];
      if (!s) continue;
      if (assignedKeys[i] !== s.key) {
        loadVid(i, s.seg, s.key);
      } else {
        var v = vids[i];
        if (v.paused && !v.ended && v.readyState >= 2 && ui.tunedIn) v.play().catch(noop);
      }
    }

    // Fire pending seeks (after clip state confirmed)
    applySeeks(st);

    // Clock
    var d = new Date(t * 1000);
    $('#clock').textContent = 'UTC ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
  }

  /* ── manifest ── */
  function loadManifest(first) {
    var t0 = performance.now();
    return fetch(manifestURL.href, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      var d = Date.parse(r.headers.get('Date') || '');
      if (!isNaN(d)) skew = Date.now() - (d + 500 + (performance.now() - t0) / 2);
      return r.json();
    }).then(function (j) {
      var list = (j && j.clips || []).filter(function (c) { return c && c.file && c.duration >= 5; });
      byId = {}; list.forEach(function (c) { byId[c.id] = c; });
      clips = list;
      if (!S.stateAt(clips, nowSec()).length) stage.classList.add('nosignal');
    }).catch(function () {
      if (first) setTimeout(function () { loadManifest(true); }, 15000);
    });
  }

  /* ── controls ── */
  $('#tune').addEventListener('click',  function () { engage(); applyAudio(); });
  $('#quiet').addEventListener('click', function () { gate.hidden = true; });

  function toggleMute() { ui.masterMuted = !ui.masterMuted; if (!ui.masterMuted) engage(); save(); applyAudio(); }
  $('#master').addEventListener('input', function () {
    ui.master = this.value / 100; ui.masterMuted = false; engage(); save(); applyAudio();
  });
  $('#mmute').addEventListener('click', toggleMute);

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (stage.requestFullscreen) stage.requestFullscreen().catch(noop);
  }
  $('#full').addEventListener('click', fullscreen);
  if (!stage.requestFullscreen) $('#full').hidden = true;

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.toLowerCase() === 'm') toggleMute();
    if (e.key.toLowerCase() === 'f') fullscreen();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });

  /* ── build compositor ── */
  var comp = $('#comp');
  for (var n = 0; n < NW; n++) {
    var v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.muted = true;
    v.preload = 'auto';
    v.tabIndex = -1;
    comp.appendChild(v);
    vids.push(v);
  }
  applyVisuals();
  applyAudio();

  loadManifest(true).then(function () { tick(); });
  setInterval(tick, 250);
  setInterval(function () { loadManifest(false); }, 15 * 60 * 1000);
})();
