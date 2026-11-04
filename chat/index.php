<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
ttg_graph_boot_session();
$csrf = ttg_graph_csrf();

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>JACK — Time Travellers Guild</title>
<meta name="description" content="Jack, a robot of punched card stock. Click him, allow the microphone, and speak. His mouth moves while he talks.">
<meta name="theme-color" content="#111214">
<style>
:root{
  --paper:#d9cb9e;
  --paper-2:#cfc19a;
  --well:#efe6c8;
  --ink:#161814;
  --navy:#1e3a5f;
  --scarlet:#c41e3a;
  --gold:#c9a227;
  --dim:#6f6754;
  --font:"Courier New", Courier, "Lucida Console", monospace;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;min-height:100%;background:#111214;color:var(--ink);font-family:var(--font);font-size:14px;line-height:1.45}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;padding:24px 12px}
#grain{position:fixed;inset:0;z-index:2;pointer-events:none;
  background:
    radial-gradient(ellipse at 50% 36%, transparent 18%, rgba(241,228,196,.16) 78%, rgba(10,10,8,.22) 100%),
    repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(22,24,20,.03) 3px);
}
.card{position:relative;z-index:3;width:min(24rem, calc(100vw - 24px));
  background:var(--paper);border:2px solid var(--navy);
  clip-path:polygon(24px 0,100% 0,100% 100%,0 100%,0 24px);
  box-shadow:0 18px 40px rgba(16,18,12,.4);
  padding:0 0 .9rem}
.card::before{content:"";display:block;height:26px;border-bottom:1.5px solid var(--navy);
  background-image:radial-gradient(circle at 50% 50%, var(--ink) 1.4px, transparent 1.6px),
                   radial-gradient(circle at 50% 50%, #7b8070 1px, transparent 1.2px);
  background-size:26px 26px, 13px 26px;background-position:6px 0, 0 0;opacity:.85}
#jack{display:block;width:216px;height:216px;margin:1.1rem auto .4rem;image-rendering:pixelated;
  background:var(--paper-2);border:1.5px solid var(--navy);cursor:pointer}
#jack:focus-visible{outline:2px solid var(--scarlet);outline-offset:3px}
h1{margin:.5rem 0 0;text-align:center;letter-spacing:.34em;font-size:15px;color:var(--scarlet);font-weight:400}
#status{margin:.25rem 0 0;text-align:center;letter-spacing:.2em;text-transform:uppercase;font-size:10px;color:var(--navy);min-height:1.2em}
#blurb{margin:.8rem auto 0;width:min(24rem, calc(100vw - 24px));position:relative;z-index:3;
  color:var(--paper);text-align:center;font-size:12px}
#blurb p{margin:0;color:#b9b3a2}
.doors{position:relative;z-index:3;display:flex;gap:1.2rem;justify-content:center;margin-top:.9rem;
  letter-spacing:.16em;text-transform:uppercase;font-size:10px}
.doors a{color:var(--dim);text-decoration:none}
.doors a:hover,.doors a:focus-visible{color:var(--paper)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
</style>
</head>
<body>
<div id="grain" aria-hidden="true"></div>

<main id="content">
  <div class="card">
    <canvas id="jack" width="22" height="24" role="button" tabindex="0" aria-label="Talk to Jack. Activate to start the call; activate again to hang up."></canvas>
    <h1>JACK</h1>
    <p id="status" aria-live="polite">STANDING BY</p>
  </div>
  <div id="blurb">
    <p>A robot of punched card stock. Click Jack, allow the microphone, and speak. Click again to hang up.</p>
  </div>
  <nav class="doors" aria-label="Doors">
    <a href="https://ffilm.org/">FFILM.ORG</a>
    <a href="https://timetravellersguild.com/jack">JACK'S CUBE</a>
    <a href="https://ffilm.org/fieldnotes/">FIELDNOTES</a>
  </nav>
</main>

<script>window.TTG_VOICE=<?= json_encode(['csrf' => $csrf, 'jack' => '/now/jack', 'agent' => ttg_voice_agent_id()], JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="https://unpkg.com/@elevenlabs/client@1.28.0/dist/lib.iife.js"></script>
<script src="https://ffilm.org/elevenlabs/ffilm-agent.js"></script>
<script src="/assets/jack-guild-tools.js?v=2"></script>

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
     Guild tools lodge through /now/jack. ffilm-agent.js still supplies page tools. */
  var AGENT_ID = (window.TTG_VOICE && window.TTG_VOICE.agent) || 'agent_8101m54eqp47ez6baj4ed5kv7tkv';
  var conversation = null;
  var starting = false;
  var cancelRequested = false;

  function pageContext() {
    if (window.JackGuild && window.JackGuild.pageContext) {
      try { return window.JackGuild.pageContext(); } catch (e) {}
    }
    return '';
  }

  function pageTools() {
    if (window.JackGuild && window.JackGuild.clientTools) {
      try { return window.JackGuild.clientTools(); } catch (e) {}
    }
    return {};
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
    var sitting = window.JackGuild && window.JackGuild.sitting ? window.JackGuild.sitting() : Promise.resolve('');
    sitting.then(function (token) {
      var page = { page_title: document.title, page_url: location.href, page_context: pageContext() };
      return window.ElevenLabsClient.Conversation.startSession({
      agentId: AGENT_ID,
      dynamicVariables: page,
      /* Jack's brain (/jack/llm) reads the sitting from here. Never the CSRF slip. */
      customLlmExtraBody: Object.assign({ sitting: token }, page),
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
      });
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
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>