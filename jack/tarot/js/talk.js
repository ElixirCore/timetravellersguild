/* JACK · TAROT · TALK — hear Jack read the hopper aloud, then talk it through.
   Same ElevenLabs agent as the front page (public agent ID, ElevenLabs' own
   client SDK, no widget). The draw goes in as page_context and a contextual
   update; one user turn asks him to read it. After that it is a conversation.
   The button click is the gesture the microphone permission needs. */
(function () {
  'use strict';
  var AGENT_ID = 'agent_8101m54eqp47ez6baj4ed5kv7tkv';
  var btn = document.getElementById('talk-btn');
  var status = document.getElementById('talk-status');
  if (!btn) return;

  var conversation = null;
  var starting = false;
  var cancelRequested = false;

  var FRAME = [
    'You are Jack, the Guild clerk, and you have just dealt this punchcard tarot reading at /jack/tarot.',
    'Speak it aloud in simple, everyday words. Short sentences. No mysticism and no predictions.',
    'Frame: each card is a punched slip. A punch is a pattern the visitor already carries: a habit, a worry, a want.',
    'Face-up means the pattern is out in the open; face-down means it is working underneath, unnoticed.',
    'Each station is a question to look at, not a fate. Treat the reading as a mirror for reflection, the way a counsellor would.',
    'Read the stations one at a time, link each to what they held, then ask one plain question back and listen.',
    'If they want to talk, follow them. Working slip. Not canon. If anything sounds like real distress, be kind and suggest talking to someone they trust.'
  ].join(' ');

  function setStatus(text) {
    if (status) status.textContent = text || '';
  }

  function draw() {
    var t = window.JACK_TAROT;
    return t && typeof t.last === 'function' ? t.last() : null;
  }

  function slipLines(d) {
    var cards = d.cards || [];
    var positions = d.positions || [];
    return cards.map(function (c, i) {
      var s = (d.slips && d.slips[i]) || {};
      return '- ' + (positions[i] || ('Station ' + (i + 1))) + ': '
        + (s.title || c.name)
        + (s.title && s.title !== c.name ? ' (stamp ' + c.name + ')' : '')
        + ', ' + (c.reversed ? 'face-down' : 'face-up')
        + (s.sense ? '. Sense: ' + s.sense : '');
    }).join('\n');
  }

  function readingContext(d) {
    var reading = String(d.reading || '').replace(/\s+\n/g, '\n').trim();
    if (reading.length > 3500) reading = reading.slice(0, 3500) + ' [cut]';
    return [
      FRAME,
      'SPREAD: ' + (d.label || d.spread || ''),
      d.question ? 'THEY HELD: "' + d.question + '"' : 'THEY HELD: nothing named (an open draw).',
      'SLIPS:\n' + slipLines(d),
      'THE WRITTEN READING JACK GAVE:\n' + reading
    ].join('\n\n');
  }

  function apply(state) {
    btn.classList.toggle('live', state === 'listening' || state === 'speaking');
    btn.setAttribute('aria-pressed', state === 'idle' ? 'false' : 'true');
    btn.textContent = state === 'idle' ? 'HEAR JACK READ IT'
      : state === 'connecting' ? 'RINGING THE DESK…' : 'HANG UP';
    setStatus(state === 'speaking' ? 'JACK IS SPEAKING'
      : state === 'listening' ? 'JACK IS LISTENING · SPEAK BACK ANY TIME' : '');
  }

  function start() {
    var d = draw();
    if (!d || !d.reading) { setStatus('PUNCH THE HOPPER FIRST'); return; }
    var SDK = window.ElevenLabsClient;
    if (!SDK || !SDK.Conversation) { setStatus('STILL LOADING'); return; }
    var ctx = readingContext(d);
    starting = true;
    cancelRequested = false;
    apply('connecting');
    SDK.Conversation.startSession({
      agentId: AGENT_ID,
      dynamicVariables: {
        page_title: 'Punchcard tarot reading',
        page_url: location.href,
        page_context: ctx
      },
      onModeChange: function (p) {
        apply(p && p.mode === 'speaking' ? 'speaking' : 'listening');
      },
      onDisconnect: function () {
        conversation = null;
        apply('idle');
      },
      onError: function (msg) {
        console.warn('[jack tarot]', msg);
      }
    }).then(function (c) {
      starting = false;
      if (cancelRequested) {
        try { c.endSession(); } catch (e) {}
        return;
      }
      conversation = c;
      try {
        if (c.sendContextualUpdate) c.sendContextualUpdate(ctx);
        if (c.sendUserMessage) {
          c.sendUserMessage('Jack, read me my tarot reading out loud, in plain words, slip by slip. What is it saying about me?');
        }
      } catch (e) {}
    }).catch(function (err) {
      starting = false;
      conversation = null;
      apply('idle');
      var m = String((err && err.message) || err || '');
      setStatus(/not allowed|denied|permission|microphone|device/i.test(m) ? 'MICROPHONE NEEDED TO TALK' : 'NO ANSWER FROM THE DESK');
    });
  }

  function stop() {
    var c = conversation;
    conversation = null;
    apply('idle');
    if (c) {
      try { c.endSession(); } catch (e) {}
    }
  }

  btn.addEventListener('click', function () {
    if (starting) { cancelRequested = true; apply('idle'); return; }
    if (conversation) { stop(); return; }
    start();
  });

  /* A new hopper ends the call: the slips it was reading are gone. */
  var again = document.getElementById('new-reading-btn');
  if (again) again.addEventListener('click', function () {
    if (conversation || starting) { cancelRequested = true; stop(); }
  });
  window.addEventListener('pagehide', stop);

  apply('idle');
})();
