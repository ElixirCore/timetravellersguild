<?php
declare(strict_types=1);

require_once __DIR__ . '/inc/graph.php';
ttg_graph_boot_session();
$viewer = ttg_graph_viewer();
$guild = ttg_guild_member($viewer);
require_once __DIR__ . '/inc/voice-status.php';
// Out of ElevenLabs credit: Jack cannot talk, so the desk becomes the door to /now.
$voiceOpen = ttg_voice_credit() !== false;

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
#jackDesk.closed .card{display:block;color:inherit;text-decoration:none;cursor:pointer}
#jackDesk.closed .card:hover,#jackDesk.closed .card:focus-visible{outline:2px solid var(--scarlet);outline-offset:3px}
#jackDesk.closed #jack{cursor:pointer}
body.line-closed #jack-face{display:none!important}
#deskAsk{display:flex;gap:.4rem;margin:.4rem auto 0;width:min(20rem,90%)}
#deskAsk[hidden]{display:none}
#deskAsk input{flex:1;background:var(--well);border:1.5px solid var(--navy);color:var(--ink);font:inherit;font-size:12px;padding:.35rem .5rem}
#deskAsk button{background:var(--scarlet);color:var(--paper);border:0;font:inherit;font-size:11px;letter-spacing:.14em;padding:.35rem .8rem;cursor:pointer}
#deskReply{margin:.7rem auto 0;width:min(24rem,calc(100vw - 24px));color:var(--paper);text-align:center;font-size:13px;min-height:1.2em}
</style>
<script>window.TTG_JACK_LINE_OPEN=<?= $voiceOpen ? 'true' : 'false' ?>;</script>
<script src="/assets/jack-line.js?v=3"></script>
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

<?php if ($voiceOpen): ?>
<main id="jackDesk">
  <div class="card">
    <canvas id="jack" width="22" height="24" role="button" tabindex="0" aria-label="Talk to Jack. Activate to open the desk slip."></canvas>
    <h1>JACK</h1>
    <p id="status" aria-live="polite">STANDING BY</p>
    <form id="deskAsk" hidden autocomplete="off"><input id="deskQ" type="text" maxlength="500" placeholder="Ask him something" aria-label="Ask Jack"><button type="button" id="deskMic" hidden aria-label="Ask aloud">SPEAK</button><button type="submit">ASK</button></form>
  </div>
  <p id="deskReply" aria-live="polite"></p>
  <p id="blurb">Hi, I'm Jack, the Guild's clerk: a robot of punched card stock. People bring me what they remember, and I take it down. Click me and tell me something you remember; I answer aloud. Rather write? <a href="/lodge">The desk takes statements</a>.</p>
</main>

<?php else: ?>
<main id="jackDesk" class="closed">
  <a class="card" href="/now" aria-label="Enter NOW, the tree">
    <canvas id="jack" width="22" height="24" aria-hidden="true"></canvas>
    <h1>NOW</h1>
    <p id="status">ENTER THE TREE</p>
  </a>
  <p id="blurb">Jack's voice line is closed for the present. The tree is public: <a href="/now">walk it</a>. Rather leave a statement? <a href="/lodge">The desk takes them in writing</a>.</p>
</main>
<?php endif; ?>

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

  var VOICE_OPEN = <?= $voiceOpen ? 'true' : 'false' ?>;
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

  /* The line is closed: the desk becomes the door to /now. Server-side when the
     quota is known to be spent; here when a call fails for want of credit. */
  var desk = document.getElementById('jackDesk');
  function closeLine() {
    /* The speech budget is spent. The desk stays a desk: the slip still takes
       questions, the clerk still answers in writing (and the device voice when
       it can); only his Deepgram voice rests. The tree is reached by its own
       link below, never by tapping the card. */
    if (desk.classList.contains('closed')) return;
    desk.classList.add('closed');
    statusEl.textContent = 'THE VOICE LINE RESTS';
    document.getElementById('blurb').innerHTML = 'Jack\u2019s Deepgram voice is resting \u2014 the day\u2019s speech budget is spent. The slip still writes and he still answers. The tree is public: <a href="/now">walk it</a>.';
  }
  var NO_CREDIT = /quota|credit|insufficient|payment|limit|exceed|subscription|billing/i;

  var LABELS = {
    idle: 'STANDING BY',
    ready: 'READY',
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
    blinkTimer = setTimeout(blinkOnce, 2600 + Math.random() * 4200);
    if (state !== 'idle' && state !== 'listening' && state !== 'ready') return;
    draw(FRAMES.blink);
    setTimeout(function () { draw(FRAMES.idle); }, 140);
  }

  function apply(next) {
    if (next === state) return;
    state = next;
    statusEl.textContent = (desk.classList.contains('closed') && next === 'idle') ? 'THE VOICE LINE RESTS' : (LABELS[next] || LABELS.idle);
    clearTimeout(mouthTimer);
    mouthTimer = null;
    if (next === 'speaking') {
      chatter();
    } else {
      draw(FRAMES.idle);
    }
    if (next === 'idle') maybeRelisten();
  }

  /* The desk slip. Click Jack and the card takes a question, spoken (the
     browser's own speech recognition writes it onto the slip) or typed; the
     engine answers (/now/jack) and the clerk reads his own slip aloud through
     the site's voice (/jack/speak.php). When the speech budget is spent his
     Deepgram voice rests; the conversation continues in writing. */
  var askForm = document.getElementById('deskAsk');
  var askInput = document.getElementById('deskQ');
  var replyEl = document.getElementById('deskReply');
  var csrfToken = '';
  var asking = false;
  var thread = [];
  var audio = null;

  /* Browsers refuse sound that starts long after a click, and his reply takes
     seconds to arrive. An AudioContext woken during the click stays allowed,
     so his voice plays through it whenever the reply lands. */
  var soundCtx = null, soundSrc = null, soundWoken = false;
  function unlockSound() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      try {
        if (!soundCtx) soundCtx = new Ctx();
        if (soundCtx.state === 'suspended') soundCtx.resume();
        var tick = soundCtx.createBufferSource();
        tick.buffer = soundCtx.createBuffer(1, 1, 22050);
        tick.connect(soundCtx.destination);
        tick.start(0);
      } catch (e) {}
    }
    if (!soundWoken && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      soundWoken = true;
      try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}
    }
  }

  /* Resolves true once he has finished; false if this route cannot play it. */
  function playDecoded(blob, last) {
    return new Promise(function (resolve) {
      if (!soundCtx || soundCtx.state !== 'running' || !blob.arrayBuffer) { resolve(false); return; }
      blob.arrayBuffer().then(function (buf) {
        soundCtx.decodeAudioData(buf, function (decoded) {
          if (soundSrc) { try { soundSrc.stop(); } catch (e) {} }
          var src = soundCtx.createBufferSource();
          src.buffer = decoded;
          src.connect(soundCtx.destination);
          soundSrc = src;
          src.onended = function () {
            if (soundSrc === src) soundSrc = null;
            if (last) apply('idle');
            resolve(true);
          };
          apply('speaking');
          src.start(0);
        }, function () { resolve(false); });
      }, function () { resolve(false); });
    });
  }
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var micBtn = document.getElementById('deskMic');
  var recog = null;

  function getCsrf() {
    if (csrfToken) return Promise.resolve(csrfToken);
    return fetch('/jack/', { credentials: 'same-origin', signal: AbortSignal.timeout(15000) })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var m = html.match(/"csrf":"([a-f0-9]{32})"/);
        if (!m) throw new Error('no_csrf');
        csrfToken = m[1];
        return csrfToken;
      });
  }

  /* One part of his slip from the reader: 1 is his opening sentence, 2 the rest.
     He starts as soon as the opening is ready, and the rest is made while he says
     it. The clerk reads only his own queued slip: sending the answer text back
     lets him refuse (403) when another tab's answer has taken the queue, so this
     tab never plays someone else's reply aloud. Null means this part cannot play. */
  function fetchSpeech(replyText, part, retried) {
    var sbody = 'csrf=' + encodeURIComponent(csrfToken) + '&part=' + part;
    if (replyText) sbody += '&text=' + encodeURIComponent(replyText);
    return fetch('/jack/speak.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: sbody,
      signal: AbortSignal.timeout(45000)
    }).then(function (res) {
      if (res.status === 429) { closeLine(true); return null; }
      if (res.status === 400 && !retried) {
        return res.json().then(function (j) {
          if (!j || !/unsigned slip/.test(String(j.error || ''))) return null;
          csrfToken = '';
          return getCsrf().then(function () { return fetchSpeech(replyText, part, true); });
        }, function () { return null; });
      }
      if (!res.ok) return null;
      var more = res.headers.get('X-Jack-More') === '1';
      return res.blob().then(function (blob) {
        if (!blob || !blob.size || !/^audio\//.test(blob.type || '')) return null;
        return { blob: blob, more: more };
      });
    }).catch(function () { return null; });
  }

  /* Plays one part and resolves once it has finished. Only the last part lets his mouth rest. */
  function playBlob(blob, last) {
    return playDecoded(blob, last).then(function (played) {
      if (played) return true;
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(blob);
        if (audio) { try { audio.pause(); } catch (e) {} }
        audio = new Audio(url);
        var done = function (ok) {
          URL.revokeObjectURL(url);
          if (last || !ok) apply('idle');
          resolve(ok);
        };
        audio.onended = function () { done(true); };
        audio.onerror = function () { done(false); };
        apply('speaking');
        audio.play().then(function () {}, function () { done(false); });
      });
    });
  }

  function speakReply(replyText) {
    return fetchSpeech(replyText, 1, false).then(function (first) {
      if (!first) return false;
      var rest = first.more ? fetchSpeech(replyText, 2, false) : null;
      return playBlob(first.blob, !rest).then(function (ok) {
        if (!ok || !rest) return ok;
        return rest.then(function (second) {
          if (!second) { apply('idle'); return true; }
          return playBlob(second.blob, true).then(function () { return true; });
        });
      });
    });
  }

  function deviceSpeak(text) {
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 0.72;
      apply('speaking');
      u.onend = u.onerror = function () { apply('idle'); };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  /* One POST of the question. A stale desk token (a page left open past the
     session's life) earns the clerk's 'unsigned slip' 400: take a fresh token
     from /jack/ and try the same slip once more. Any other 400 is a real
     refusal and is not retried. */
  function postAsk(clean, retried) {
    return getCsrf().then(function (token) {
      var data = new FormData();
      data.set('csrf', token);
      data.set('q', clean.slice(0, 2000));
      data.set('intent', 'ask');
      data.set('site', 'jack');
      data.set('thread', thread.join('\n').slice(-1500));
      return fetch('/now/jack', {
        method: 'POST',
        body: data,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(40000)
      });
    }).then(function (res) {
      if (res.status === 429) { closeLine(true); throw new Error('line_closed'); }
      if (res.status === 400 && !retried) {
        return res.json().then(function (j) {
          if (!j || !/unsigned slip/.test(String(j.error || ''))) throw new Error('no_answer');
          csrfToken = '';
          return postAsk(clean, true);
        }, function () { throw new Error('no_answer'); });
      }
      if (!res.ok) throw new Error('no_answer');
      return res.json();
    });
  }

  function ask(ques) {
    var clean = String(ques || '').replace(/\s+/g, ' ').trim();
    if (!clean || asking) return;
    asking = true;
    apply('connecting');
    postAsk(clean).then(function (j) {
      var text = (j && j.text) ? j.text : 'The clerk is away from the desk. The room remains.';
      thread.push('you: ' + clean, 'clerk: ' + text);
      if (thread.length > 8) thread = thread.slice(-8);
      if (replyEl) replyEl.textContent = text;
      return speakReply(text).then(function (played) {
        if (!played && !deviceSpeak(text)) apply('idle');
      });
    }).catch(function (err) {
      if (String((err && err.message) || '') === 'line_closed') return;
      if (replyEl) replyEl.textContent = 'The line went quiet. The room did not.';
      apply('idle');
    }).then(function () {
      asking = false;
      if (state !== 'speaking') apply('idle');
      maybeRelisten();
    });
  }

  function toggle() {
    if (forced) return;
    if (!askForm) return;
    unlockSound();
    if (askForm.hidden) {
      askForm.hidden = false;
      apply('ready');
      /* One touch starts the whole conversation: the ear asks its permission
         here, in this same tap, then Jack listens and answers in turns.
         Refuse the microphone (or have none) and the slip stays a writing
         slip - typing is untouched. */
      if (SpeechRec && micBtn && !asking) {
        convo = true;
        startEar();
      } else {
        try { askInput.focus(); } catch (e) {}
      }
    } else {
      askForm.hidden = true;
      stopConvo();
      if (!asking && state !== 'speaking') apply('idle');
    }
  }

  if (askForm) {
    askForm.addEventListener('submit', function (e) {
      e.preventDefault();
      unlockSound();
      var v = askInput.value;
      askInput.value = '';
      ask(v);
    });
  }

  /* Conversation mode. One touch - on Jack's card or on the microphone
     button - asks the ear's permission and starts the conversation: he
     listens, a second's pause sends on its own, he answers aloud, and the
     ear opens again by itself once he falls quiet. He never listens while
     he is speaking, so his own voice cannot come back in as your next
     question. The microphone button reads STOP for as long as the
     conversation is live. */
  var convo = false;
  var relistenT = null;

  function cancelRelisten() {
    if (relistenT) { clearTimeout(relistenT); relistenT = null; }
  }

  function micLabel() {
    if (micBtn) micBtn.textContent = (convo || recog) ? 'STOP' : 'SPEAK';
  }

  function stopConvo() {
    convo = false;
    cancelRelisten();
    if (recog) { try { recog.stop(); } catch (e) {} recog = null; }
    micLabel();
    if (state === 'listening') apply('ready');
  }

  function joinHeard(base, add) {
    /* Join a new fragment without repeating words the ear already wrote:
       where one fragment's start repeats the other's end the overlap is
       trimmed, and only ever at a word boundary, so "stop" + "stopwatch"
       can never merge. */
    add = add || '';
    if (!base) return add;
    if (!add) return base;
    var b = base.trim().toLowerCase(), a = add.trim().toLowerCase();
    if (!a) return base;
    if (b === a) return base;
    if (a.length > b.length && a.slice(0, b.length) === b && /\s/.test(a.charAt(b.length))) return add;
    if (b.length > a.length && b.slice(b.length - a.length) === a && b.charAt(b.length - a.length - 1) === ' ') return base;
    var max = Math.min(base.length, add.length);
    for (var k = max; k > 0; k--) {
      if (k < add.length && !/\s/.test(add.charAt(k))) continue;
      if (base.slice(base.length - k).toLowerCase() === add.slice(0, k).toLowerCase()) return base + add.slice(k);
    }
    return base + add;
  }

  function maybeRelisten() {
    /* Called whenever the desk goes quiet. In conversation mode the ear
       opens again half a second later - long enough for the last of his
       voice in the earphones to die away. */
    if (!convo || recog || asking || forced) return;
    if (!askForm || askForm.hidden) return;
    cancelRelisten();
    relistenT = setTimeout(function () {
      relistenT = null;
      if (convo && !recog && !asking && state !== 'speaking') startEar();
    }, 500);
  }

  function startEar() {
    if (recog || !SpeechRec || !convo) return;
    var r = new SpeechRec();
    recog = r;
    r.lang = 'en-GB';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    var silence = null, maxT = null, sent = false, finalTx = '';
    var finish = function (submit) {
      clearTimeout(silence);
      clearTimeout(maxT);
      try { r.stop(); } catch (e) {}
      if (recog === r) { recog = null; micLabel(); }
      var said = askInput.value.trim();
      if (submit && said && !sent) {
        sent = true;
        askInput.value = '';
        ask(said);
        return;
      }
      if (state === 'listening') apply('ready');
    };
    r.onresult = function (e) {
      /* Build from resultIndex onward, overlap-trimming each final. Re-reading
         the whole result list - or a speech service that re-issues an old
         fragment - is what made the visitor's own words come back doubled. */
      var interim = '';
      for (var i = (e.resultIndex || 0); i < e.results.length; i++) {
        try {
          var res = e.results[i];
          if (res.isFinal) finalTx = joinHeard(finalTx, res[0].transcript);
          else interim = res[0].transcript;
        } catch (err) {}
      }
      askInput.value = joinHeard(finalTx, interim).trim();
      /* A second's pause sends the question on its own. */
      clearTimeout(silence);
      silence = setTimeout(function () { finish(true); }, 1000);
    };
    r.onerror = function (e) {
      clearTimeout(silence);
      clearTimeout(maxT);
      var hard = e && (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture');
      if (hard) { convo = false; cancelRelisten(); }
      micLabel();
      if (hard && replyEl) {
        replyEl.textContent = (e.error === 'audio-capture')
          ? 'The ear found no microphone. The slip still takes writing.'
          : 'The microphone would not answer. The slip still takes writing.';
      } else if (replyEl && !convo && !(askInput.value || '').trim()) {
        replyEl.textContent = 'The ear failed. The slip still takes writing.';
      }
      if (state === 'listening' && (!convo || hard)) apply('ready');
    };
    r.onend = function () {
      if (recog !== r) return;
      recog = null;
      micLabel();
      if (sent) return;
      if (convo && state === 'listening') {
        /* The browser's ear dozed in the quiet; open it again so the
           conversation simply carries on. */
        cancelRelisten();
        relistenT = setTimeout(function () {
          relistenT = null;
          if (convo && !recog && state === 'listening') startEar();
        }, 350);
        return;
      }
      if (state === 'listening') apply('ready');
    };
    apply('listening');
    micLabel();
    try { r.start(); } catch (e) {
      recog = null;
      convo = false;
      micLabel();
      apply('ready');
      return;
    }
    maxT = setTimeout(function () { finish(true); }, 20000);
  }

  if (SpeechRec && micBtn) {
    micBtn.hidden = false;
    micBtn.addEventListener('click', function () {
      unlockSound();
      /* The button is STOP for as long as the conversation is live - while
         he listens, while he thinks, while he talks. A second's pause
         already sends on its own. */
      if (forced) return;
      if (recog || convo) { stopConvo(); return; }
      if (asking) return;
      convo = true;
      startEar();
    });
  }

  if (!VOICE_OPEN) {
    closeLine();
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
      if (e && e.preventDefault) e.preventDefault();
      /* No navigation: the desk stays put; the tree is reached by its own links. */
      finish();
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
  <a href="/chat">CHAT</a>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($viewer) ?>
</nav>

<!-- the little Jack: press the face, he listens and speaks -->
<?php if ($voiceOpen): ?>
<?php endif; ?>
</body>
</html>

