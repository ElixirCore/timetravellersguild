<?php
declare(strict_types=1);

require_once __DIR__ . '/inc/graph.php';
ttg_graph_boot_session();
$viewer = ttg_graph_viewer();
$guild = ttg_guild_member($viewer);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>JACK — Time Travellers Guild</title>
<meta name="description" content="The clerk is present. A record has been opened. One line is missing. Speak to Jack, then walk the public tree.">
<meta name="theme-color" content="#111214">
<link rel="stylesheet" href="/assets/intro.css?v=16">
<style>
html,body{background:#111214}
body{min-height:100dvh;display:flex;flex-direction:column;align-items:center}
.site-mark{align-self:flex-start;position:relative;z-index:3}
#grain{position:fixed;inset:0;z-index:2;pointer-events:none;
  background:radial-gradient(ellipse at 50% 36%, transparent 18%, rgba(241,228,196,.16) 78%, rgba(10,10,8,.22) 100%),
    repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(22,24,20,.03) 3px)}
.always-on{position:relative;z-index:3}
#jackDesk{position:relative;z-index:3;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;padding:1rem 0}
.card{position:relative;width:min(24rem, calc(100vw - 24px));background:var(--paper);border:2px solid var(--navy);
  clip-path:polygon(24px 0,100% 0,100% 100%,0 100%,0 24px);box-shadow:0 18px 40px rgba(16,18,12,.4);padding:0 0 .9rem}
.card::before{content:"";display:block;height:26px;border-bottom:1.5px solid var(--navy);
  background-image:radial-gradient(circle at 50% 50%, var(--ink) 1.4px, transparent 1.6px),
                   radial-gradient(circle at 50% 50%, #7b8070 1px, transparent 1.2px);
  background-size:26px 26px, 13px 26px;background-position:6px 0, 0 0;opacity:.85}
#jack{display:block;width:216px;height:216px;margin:1.1rem auto .4rem;image-rendering:pixelated;
  background:var(--well);border:1.5px solid var(--navy);cursor:pointer}
#jack:focus-visible{outline:2px solid var(--scarlet);outline-offset:3px}
#jackDesk h1{margin:.5rem 0 0;text-align:center;letter-spacing:.34em;font-size:15px;color:var(--scarlet);font-weight:400}
#status{margin:.25rem 0 0;text-align:center;letter-spacing:.2em;text-transform:uppercase;font-size:10px;color:var(--navy);min-height:1.2em}
#blurb{margin:.8rem auto 0;width:min(24rem, calc(100vw - 24px));color:#b9b3a2;text-align:center;font-size:12px}
#blurb a{color:#b9b3a2;text-decoration:underline}
body.booting #jackDesk{visibility:hidden}
</style>
</head>
<body class="booting">
<a id="titleFlash" href="/now" aria-label="The Time Travellers Guild — enter NOW">
  <canvas id="titleCard" width="800" height="352" aria-hidden="true"></canvas>
  <p class="title-skip">CLICK TO ENTER NOW · OR WAIT</p>
</a>
<div id="grain" aria-hidden="true"></div>
<noscript>
<style>
#titleFlash{display:none!important}
body.booting .site-mark,body.booting .always-on,body.booting #jackDesk{visibility:visible}
</style>
  <p style="position:relative;z-index:3;color:#d9cb9e">The clerk is present. The voice needs scripting; <a href="/lodge" style="color:#d9cb9e">the desk interview</a> does not. <a href="/now" style="color:#d9cb9e">NOW — the tree</a></p>
</noscript>

<?= ttg_html_site_mark() ?>

<p class="doors always-on" aria-label="Instruments">
  <a class="door primary" href="/now"><b>NOW</b> THE TREE</a>
  <a class="door" href="/cube"><b>CUBE</b> JACK</a>
</p>

<main id="jackDesk">
  <div class="card">
    <canvas id="jack" width="22" height="24" role="button" tabindex="0" aria-label="Talk to Jack. Activate to start the call; activate again to hang up."></canvas>
    <h1>JACK</h1>
    <p id="status" aria-live="polite">STANDING BY</p>
  </div>
  <p id="blurb">A robot of punched card stock. Click Jack, allow the microphone, and speak. Click again to hang up. Rather type? <a href="/lodge">The desk takes statements</a>.</p>
</main>

<script src="https://unpkg.com/@elevenlabs/client@1.28.0/dist/lib.iife.js"></script>
<script src="https://ffilm.org/elevenlabs/ffilm-agent.js"></script>

<script>
(function () {
  'use strict';

  /* Jack, 24x24, nearest-neighbour, no assets. Punch-card idiom after timetravellersguild.com/jack. */
  var PAL = {
    '.': null,
    k: '#161814', /* ink */
    g: '#6a7280', /* metal */
    G: '#9aa0a8', /* light metal */
    n: '#1e3a5f', /* navy */
    s: '#c41e3a', /* scarlet */
    b: '#c9a227', /* brass */
    p: '#d9cb9e', /* card stock */
    w: '#f7f2e6'  /* pale */
  };

  /* Frames: idle (mouth shut), speak-mid, speak-open, blink. */
  var FRAMES = {
    idle: [
      '..........bb..........',
      '..........kk..........',
      '....kkkkkkkkkkkkkk....',
      '...kggggggggggggggk...',
      '...kgGGGGGGGGGGGGgk...',
      '...kgGggggggggggGgk...',
      '...kgGgkkggggkkgGgk...',
      '...kgGgknkggknkgGgk...',
      '...kgGgkkggggkkgGgk...',
      '...kgGggggggggggGgk...',
      '...kgGggggggggggGgk...',
      '...kgGgkkkkkkkkgGgk...',
      '...kgGggggggggggGgk...',
      '...kgGGGGGGGGGGGGgk...',
      '...kggggggggggggggk...',
      '....kkkkkkkkkkkkkk....',
      '......kk......kk......',
      '....pppppppppppppp....',
      '....pkpkkppkppkkpk....',
      '....pppppppppppppp....',
      '....pkppkpkpkppkpk....',
      '....pppppppppppppp....',
      '......................',
      '......................'
    ],
    mid: [
      '..........bb..........',
      '..........kk..........',
      '....kkkkkkkkkkkkkk....',
      '...kggggggggggggggk...',
      '...kgGGGGGGGGGGGGgk...',
      '...kgGggggggggggGgk...',
      '...kgGgkkggggkkgGgk...',
      '...kgGgknkggknkgGgk...',
      '...kgGgkkggggkkgGgk...',
      '...kgGggggggggggGgk...',
      '...kgGgkkkkkkkkgGgk...',
      '...kgGgksssssskgGgk...',
      '...kgGgkkkkkkkkgGgk...',
      '...kgGGGGGGGGGGGGgk...',
      '...kggggggggggggggk...',
      '....kkkkkkkkkkkkkk....',
      '......kk......kk......',
      '....pppppppppppppp....',
      '....pkpkkppkppkkpk....',
      '....pppppppppppppp....',
      '....pkppkpkpkppkpk....',
      '....pppppppppppppp....',
      '......................',
      '......................'
    ],
    open: [
      '..........bb..........',
      '..........kk..........',
      '....kkkkkkkkkkkkkk....',
      '...kggggggggggggggk...',
      '...kgGGGGGGGGGGGGgk...',
      '...kgGggggggggggGgk...',
      '...kgGgkkggggkkgGgk...',
      '...kgGgknkggknkgGgk...',
      '...kgGgkkggggkkgGgk...',
      '...kgGggggggggggGgk...',
      '...kgGgkkkkkkkkgGgk...',
      '...kgGgksssssskgGgk...',
      '...kgGgkswwwwskgGgk...',
      '...kgGGkkkkkkkkGGgk...',
      '...kggggggggggggggk...',
      '....kkkkkkkkkkkkkk....',
      '......kk......kk......',
      '....pppppppppppppp....',
      '....pkpkkppkppkkpk....',
      '....pppppppppppppp....',
      '....pkppkpkpkppkpk....',
      '....pppppppppppppp....',
      '......................',
      '......................'
    ],
    blink: [
      '..........bb..........',
      '..........kk..........',
      '....kkkkkkkkkkkkkk....',
      '...kggggggggggggggk...',
      '...kgGGGGGGGGGGGGgk...',
      '...kgGggggggggggGgk...',
      '...kgGgkkggggkkgGgk...',
      '...kgGgkkkkkkkkgGgk...',
      '...kgGgkkggggkkgGgk...',
      '...kgGggggggggggGgk...',
      '...kgGggggggggggGgk...',
      '...kgGgkkkkkkkkgGgk...',
      '...kgGggggggggggGgk...',
      '...kgGGGGGGGGGGGGgk...',
      '...kggggggggggggggk...',
      '....kkkkkkkkkkkkkk....',
      '......kk......kk......',
      '....pppppppppppppp....',
      '....pkpkkppkppkkpk....',
      '....pppppppppppppp....',
      '....pkppkpkpkppkpk....',
      '....pppppppppppppp....',
      '......................',
      '......................'
    ]
  };

  var canvas = document.getElementById('jack');
  var ctx = canvas.getContext('2d');
  var statusEl = document.getElementById('status');

  function draw(frame) {
    ctx.clearRect(0, 0, 22, 24);
    for (var y = 0; y < 24; y++) {
      var row = frame[y];
      for (var x = 0; x < 22; x++) {
        var c = PAL[row[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  /* Demo hook: ?mouth=speaking forces the chatter without a call. */
  var forced = null;
  var q = new URLSearchParams(location.search);
  if (q.get('mouth')) forced = q.get('mouth');

  var LABELS = {
    idle: 'STANDING BY',
    connecting: 'WARMING THE VALVES',
    listening: 'LISTENING',
    speaking: 'SPEAKING'
  };

  var state = 'idle';
  var mouthTimer = null;
  var blinkTimer = null;

  function chatter() {
    var seq = ['mid', 'open', 'mid', 'open', 'idle', 'mid', 'open'];
    draw(FRAMES[seq[Math.floor(Math.random() * seq.length)]]);
    mouthTimer = setTimeout(chatter, 70 + Math.random() * 110);
  }

  function blinkOnce() {
    if (state !== 'idle' && state !== 'listening') return;
    draw(FRAMES.blink);
    setTimeout(function () { draw(FRAMES.idle); }, 140);
    blinkTimer = setTimeout(blinkOnce, 2600 + Math.random() * 4200);
  }

  function apply(next) {
    if (next === state) return;
    state = next;
    statusEl.textContent = LABELS[next] || LABELS.idle;
    clearTimeout(mouthTimer);
    mouthTimer = null;
    if (next === 'speaking') {
      chatter();
    } else {
      draw(FRAMES.idle);
    }
  }

  /* The call. ElevenLabs' own client SDK (window.ElevenLabsClient), no widget,
     so Jack is the whole interface: click him to start, click again to hang up.
     The click is the user gesture the microphone permission needs.
     ffilm-agent.js still supplies page context and client tools. */
  var AGENT_ID = 'agent_8101m54eqp47ez6baj4ed5kv7tkv';
  var conversation = null;
  var starting = false;
  var cancelRequested = false;

  function pageContext() {
    if (window.ffilmAgent && window.ffilmAgent.buildContext) {
      try { return window.ffilmAgent.buildContext(); } catch (e) {}
    }
    return '';
  }

  function pageTools() {
    return (window.ffilmAgent && window.ffilmAgent.clientTools) || {};
  }

  function startCall() {
    if (starting || conversation) return;
    if (!window.ElevenLabsClient || !window.ElevenLabsClient.Conversation) {
      statusEl.textContent = 'STILL LOADING';
      return;
    }
    starting = true;
    cancelRequested = false;
    apply('connecting');
    window.ElevenLabsClient.Conversation.startSession({
      agentId: AGENT_ID,
      dynamicVariables: {
        page_title: document.title,
        page_url: location.href,
        page_context: pageContext()
      },
      clientTools: pageTools(),
      onModeChange: function (p) {
        apply(p && p.mode === 'speaking' ? 'speaking' : 'listening');
      },
      onDisconnect: function () {
        conversation = null;
        apply('idle');
      },
      onError: function (msg) {
        console.warn('[jack]', msg);
      }
    }).then(function (c) {
      starting = false;
      if (cancelRequested) {
        try { c.endSession(); } catch (e) {}
        return;
      }
      conversation = c;
    }).catch(function (err) {
      starting = false;
      conversation = null;
      apply('idle');
      var m = String((err && err.message) || err || '');
      statusEl.textContent = /not allowed|denied|permission|microphone|device/i.test(m)
        ? 'MIC NEEDED' : 'NO ANSWER';
    });
  }

  function endCall() {
    var c = conversation;
    conversation = null;
    apply('idle');
    if (c) {
      try { c.endSession(); } catch (e) {}
    }
  }

  function toggle() {
    if (forced) return;
    if (starting) { cancelRequested = true; apply('idle'); return; }
    if (conversation) { endCall(); return; }
    startCall();
  }

  canvas.addEventListener('click', toggle);
  canvas.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });

  draw(FRAMES.idle);
  blinkTimer = setTimeout(blinkOnce, 3200);
  if (forced) {
    setInterval(function () { apply(forced); }, 180);
  }
})();
</script>

<script>
/* The title flash, lifted verbatim from /assets/intro.js so the front page keeps
   the boot splash without the desk interview machinery. Differences: no TTG_INTRO
   config (skip target hardcoded to /now), and the done path does not add the
   'briefing' class - there is no briefing here and it would hide the dock. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var flashDone = false;
  var flashRaf = 0;
  var FONT5 = {
    ' ': [0, 0, 0, 0, 0, 0, 0],
    A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
    E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
    T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    V: [0x11, 0x11, 0x11, 0x11, 0x0a, 0x0a, 0x04]
  };
  var HOLLERITH = {
    A: [12, 1], B: [12, 2], C: [12, 3], D: [12, 4], E: [12, 5], F: [12, 6], G: [12, 7], H: [12, 8], I: [12, 9],
    J: [11, 1], K: [11, 2], L: [11, 3], M: [11, 4], N: [11, 5], O: [11, 6], P: [11, 7], Q: [11, 8], R: [11, 9],
    S: [0, 2], T: [0, 3], U: [0, 4], V: [0, 5], W: [0, 6], X: [0, 7], Y: [0, 8], Z: [0, 9],
    ' ': []
  };
  var PUNCH_ROWS = [12, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  var TITLE_LINES = ['THE TIME', 'TRAVELLERS GUILD'];
  var TITLE_PUNCH = 'THE TIME TRAVELLERS GUILD';
  function punchSlot(ctx, x, y, w, h, ink) {
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(241,228,196,0.22)';
    ctx.fillRect(x + 1, y + 1, Math.max(1, w - 2), 1);
  }
  function drawGlyph(ctx, ch, ox, oy, cell, ink, colCap) {
    var rows = FONT5[ch] || FONT5[' '];
    var r, c, bit, x, y, slot;
    slot = Math.max(2, Math.floor(cell * 0.78));
    for (r = 0; r < 7; r++) {
      for (c = 0; c < 5; c++) {
        if (colCap >= 0 && c > colCap) continue;
        bit = (rows[r] >> (4 - c)) & 1;
        if (!bit) continue;
        x = ox + c * cell;
        y = oy + r * cell;
        punchSlot(ctx, x, y, slot, slot, ink);
      }
    }
  }
  function lineWidth(text, cell, gap) {
    return text.length * (5 * cell + gap) - gap;
  }
  function makeStock(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var g = c.getContext('2d');
    var i, x;
    g.fillStyle = '#d9cb9e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#cfc19a';
    g.fillRect(0, 0, w, Math.floor(h * 0.11));
    for (i = 0; i < w * h / 22; i++) {
      g.fillStyle = Math.random() > 0.55 ? 'rgba(30,58,95,0.05)' : 'rgba(196,30,58,0.035)';
      g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    g.fillStyle = 'rgba(30,58,95,0.07)';
    for (x = 28; x < w - 10; x += 9) g.fillRect(x, Math.floor(h * 0.42), 1, Math.floor(h * 0.5));
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.floor(h * 0.09), 0);
    g.lineTo(0, Math.floor(h * 0.09));
    g.closePath();
    g.fillStyle = '#1e3a5f';
    g.fill();
    g.fillStyle = '#c41e3a';
    g.fillRect(0, 0, w, Math.floor(h * 0.11));
    g.fillStyle = '#d9cb9e';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.floor(h * 0.09), 0);
    g.lineTo(0, Math.floor(h * 0.09));
    g.closePath();
    g.fill();
    g.strokeStyle = '#1e3a5f';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
    var holesY = Math.floor(h * 0.155);
    var holesH = Math.floor(h * 0.045);
    for (i = 0; i < 80; i++) {
      x = 28 + i * ((w - 42) / 80);
      g.fillStyle = i % 10 === 9 ? '#1e3a5f' : '#efe6c8';
      g.beginPath();
      g.ellipse(x + 2, holesY, 2.1, holesH / 2, 0, 0, Math.PI * 2);
      g.fill();
      if (i % 10 === 9) {
        g.fillStyle = '#1e3a5f';
        g.fillRect(x + 1, holesY + holesH, 2, 3);
      }
    }
    return c;
  }
  function paintTitle(ctx, w, h, stock, cols) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(stock, 0, 0);
    var cell = Math.max(5, Math.floor(w / 100));
    var gap = Math.max(2, Math.floor(cell * 0.45));
    var advance = 5 * cell + gap;
    var y0 = Math.floor(h * 0.24);
    var y1 = y0 + 8 * cell;
    var ink = '#1e3a5f';
    var i, ch, ox, used = 0, cap;
    function drawLine(text, y) {
      ox = Math.floor((w - lineWidth(text, cell, gap)) / 2);
      for (i = 0; i < text.length; i++) {
        ch = text.charAt(i);
        cap = cols - used;
        if (cap > 0) drawGlyph(ctx, ch, ox + i * advance, y, cell, ink, Math.min(4, cap - 1));
        used += 5;
      }
    }
    drawLine(TITLE_LINES[0], y0);
    drawLine(TITLE_LINES[1], y1);
    ctx.fillStyle = '#d9cb9e';
    ctx.font = '600 13px "Courier New", Courier, monospace';
    ctx.fillText('IBM 5081 · 80 COL', 34, Math.floor(h * 0.078));
    var punchTop = Math.floor(h * 0.72);
    var punchH = Math.floor(h * 0.2);
    var rh = punchH / PUNCH_ROWS.length;
    var left = 28;
    var cw = (w - 40) / TITLE_PUNCH.length;
    var punched = Math.max(0, Math.min(TITLE_PUNCH.length, Math.floor(cols / 5)));
    for (i = 0; i < punched; i++) {
      var holes = HOLLERITH[TITLE_PUNCH.charAt(i)] || [];
      var hi, r;
      for (hi = 0; hi < holes.length; hi++) {
        r = PUNCH_ROWS.indexOf(holes[hi]);
        if (r < 0) continue;
        ctx.beginPath();
        ctx.ellipse(left + i * cw + cw / 2, punchTop + r * rh + rh / 2, Math.max(1.6, cw * 0.28), Math.max(1.4, rh * 0.28), 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1e3a5f';
        ctx.fill();
      }
    }
  }
  function startTitleFlash(doneFn) {
    var canvas = $('titleCard');
    var flash = $('titleFlash');
    if (!canvas || !flash) {
      if (typeof doneFn === 'function') doneFn();
      return;
    }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 800, h = 352;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var stock = makeStock(w, h);
    var totalCols = (TITLE_LINES[0].length + TITLE_LINES[1].length) * 5;
    var t0 = 0;
    var holdAfter = reduce ? 280 : 900;
    var punchMs = reduce ? 0 : 2200;
    var armed = false;
    var fading = false;
    var fadeT = 0;
    var watchdog = setTimeout(function () { finish(); }, punchMs + holdAfter + 500);

    function finish() {
      if (flashDone) return;
      flashDone = true;
      clearTimeout(watchdog);
      paintTitle(ctx, w, h, stock, totalCols);
      if (flashRaf) cancelAnimationFrame(flashRaf);
      fading = true;
      fadeT = performance.now();
      flashRaf = requestAnimationFrame(fade);
    }
    function fade(now) {
      var k = reduce ? 1 : Math.min(1, (now - fadeT) / 380);
      if (k < 1) {
        flashRaf = requestAnimationFrame(fade);
        return;
      }
      document.body.classList.remove('booting');
      if (typeof doneFn === 'function') doneFn();
    }
    function frame(now) {
      if (flashDone) return;
      if (!t0) t0 = now;
      var elapsed = now - t0;
      var cols = punchMs <= 0 ? totalCols : Math.min(totalCols, Math.floor((elapsed / punchMs) * totalCols));
      paintTitle(ctx, w, h, stock, cols);
      if (cols >= totalCols && !armed) {
        armed = true;
        setTimeout(finish, holdAfter);
        return;
      }
      if (!armed) flashRaf = requestAnimationFrame(frame);
    }
    function skip(e) {
      if (flashDone) return;
      flashDone = true;
      clearTimeout(watchdog);
      if (flashRaf) cancelAnimationFrame(flashRaf);
      if (e && e.preventDefault) e.preventDefault();
      window.location.assign((cfg && cfg.tree) || '/now');
    }
    flash.addEventListener('click', skip);
    canvas.addEventListener('click', skip);
    flashRaf = requestAnimationFrame(frame);
    startTitleFlash.skip = skip;
  }

  startTitleFlash(function () {});
  document.addEventListener('keydown', function (e) {
    if (flashDone) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      if (startTitleFlash.skip) startTitleFlash.skip(e);
    }
  });
})();
</script>

<nav id="dock" aria-label="Guild">
  <a href="/now">NOW</a>
  <a href="/cube">CUBE</a>
  <a href="/chat">JACK</a>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($viewer) ?>
</nav>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>