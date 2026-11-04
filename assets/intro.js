/* Jack’s front briefing. A conversation at the desk. Then NOW. */
(function () {
  'use strict';

  var cfg = window.TTG_INTRO || {};
  var ORDER = ['jack', 'you', 'tree'];
  var TOPICS = {
    jack: {
      label: 'THE CLERK',
      form: 'speak',
      text: 'The clerk is present.\nYou are not late. That is the first thing to establish.\nNames travel badly between records. Give me the name you want on this visit.\nIf another file knows you differently, I will join the entries. I will not split you.'
    },
    you: {
      label: 'THE INTERVIEW',
      form: 'speak',
      text: 'The Guild keeps two presents.\nLocal time is not the same as the record.\nBefore I open the field, tell me where you are speaking from and what brought you to the desk.\nA useful arrival notices what does not quite belong.'
    },
    tree: {
      label: 'NOW',
      form: 'card',
      text: 'NOW is the public tree — not a destination.\nThe record holds 2026 and 17 April 2033 at once.\nThe clerk has not corrected either.\nThe doors are NOW and the cube.'
    }
  };
  var saved = cfg.brief || {};
  var sitting = cfg.play || {};
  var topic = 'jack';
  var seen = { jack: true };
  var typing = false;
  var timer = null;
  var hopperPhase = 'VOICE';
  var thread = [];
  var done = !!saved.done;
  var forgotten = !!saved.forgotten;
  var seenNodes = Array.isArray(saved.nodes) ? saved.nodes.slice(0, 4) : [];
  var started = saved.started || '';
  var persistTimer = null;
  var playTimer = null;
  var interviewed = !!sitting.interviewed;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var punchTimers = [];
  var punchInterval = 0;
  var asking = false;
  var voiceEnabled = false;
  var speechText = '';

  (saved.seen || []).forEach(function (id) { seen[id] = true; });

  function b64url(s) {
    return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function snapshot() {
    var keys = [], id;
    for (id in seen) if (seen[id]) keys.push(id);
    return {
      v: 1,
      seen: keys,
      done: done,
      forgotten: forgotten,
      nodes: seenNodes,
      asks: [],
      started: started || undefined,
      updated: new Date().toISOString()
    };
  }

  function persist() {
    var state = snapshot();
    if (!started) started = state.updated;
    state.started = started;
    try {
      document.cookie = 'ttg_brief=' + b64url(JSON.stringify(state)) + '; Path=/; Max-Age=2592000; SameSite=Lax';
    } catch (e) {}
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      fetch(cfg.act || '/intro/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ csrf: cfg.csrf || '', brief: state })
      }).catch(function () {});
    }, 80);
  }

  function persistPlay(patch) {
    sitting = Object.assign({}, sitting, patch || {});
    if (sitting.name) interviewed = true;
    clearTimeout(playTimer);
    playTimer = setTimeout(function () {
      fetch(cfg.playAct || '/play/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ csrf: cfg.csrf || '', play: patch || sitting })
      }).then(function (res) { return res.json(); }).then(function (j) {
        if (j && j.play) sitting = j.play;
        interviewed = !!(sitting && sitting.interviewed);
      }).catch(function () {});
    }, 40);
  }

  function $(id) { return document.getElementById(id); }

  function addThread(who, text) {
    var wrap = $('thread');
    if (!wrap || !text) return;
    var turn = document.createElement('article');
    turn.className = 'thread-turn ' + (who === 'YOU' ? 'visitor' : 'clerk');
    var label = document.createElement('p');
    label.className = 'thread-who';
    label.textContent = who;
    var copy = document.createElement('p');
    copy.className = 'thread-copy';
    copy.textContent = text;
    turn.appendChild(label);
    turn.appendChild(copy);
    wrap.appendChild(turn);
    var count = $('threadCount');
    if (count) count.textContent = wrap.children.length + (wrap.children.length === 1 ? ' ENTRY' : ' ENTRIES');
    wrap.scrollTop = wrap.scrollHeight;
  }

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
  var booting = true;
  var flashDone = false;
  var flashRaf = 0;

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
      booting = false;
      document.body.classList.remove('booting');
      document.body.classList.add('briefing');
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

  function setFormLine(text) {
    var el = $('jackForm');
    if (el) el.textContent = text;
  }

  function pose(form) {
    var Spr = window.Jack && window.Jack.Sprite;
    if (!Spr) return;
    if (form === 'deal' && Spr.deal) Spr.deal(3);
    else if (form === 'punch' && Spr.punch) Spr.punch();
    else if (Spr.setForm) Spr.setForm(form);
    hopperPhase = form === 'deal' ? 'CARD' : (form === 'punch' ? 'OPERATE' : 'VOICE');
  }

  function paintBeat(beat, full) {
    $('beatLabel').textContent = beat.label;
    $('beatText').textContent = '';
    if (full || reduce) {
      $('beatText').textContent = beat.text;
      typing = false;
      return;
    }
    typing = true;
    var n = 0;
    var caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    function step() {
      if (!typing) return;
      n += 1;
      $('beatText').textContent = beat.text.slice(0, n);
      $('beatText').appendChild(caret);
      if (n >= beat.text.length) {
        typing = false;
        caret.remove();
        return;
      }
      var ch = beat.text.charAt(n - 1);
      var wait = ch === '\n' ? 120 : (ch === '.' || ch === '?' ? 70 : 18);
      timer = setTimeout(step, wait);
    }
    step();
  }

  function askBox() {
    return '' +
      '<div class="talk">' +
        '<div id="jackProcess" class="jack-reader" hidden>' +
          '<div class="jack-reader-track" aria-hidden="true">' +
            '<span class="jack-reader-lamp"></span>' +
            '<span class="ibm-slip"></span>' +
            '<span class="ibm-slip"></span>' +
            '<span class="ibm-slip"></span>' +
            '<span class="jack-reader-gate"></span>' +
          '</div>' +
          '<div class="punch-belt" id="jackBelt" aria-hidden="true"></div>' +
          '<p id="jackStage" class="punch-stage" aria-live="polite"></p>' +
        '</div>' +
        '<form id="askForm" class="ask">' +
          '<label class="sr" for="askQ">Input statement</label>' +
          '<input id="askQ" name="q" type="text" maxlength="2000" autocomplete="off" placeholder="Input statement…">' +
          '<button type="submit">SEND</button>' +
        '</form>' +
        '<button type="button" id="voiceToggle" aria-pressed="false">VOICE: OFF</button>' +
      '</div>';
  }

  function clearPunchTimers() {
    punchTimers.forEach(function (id) { clearTimeout(id); });
    punchTimers = [];
    if (punchInterval) { clearInterval(punchInterval); punchInterval = 0; }
  }

  function buildBelt() {
    var belt = $('jackBelt');
    if (!belt || belt.childElementCount) return;
    var i;
    for (i = 0; i < 80 * 6; i++) belt.appendChild(document.createElement('i'));
  }

  function punchSome(n) {
    var belt = $('jackBelt');
    if (!belt || !belt.childElementCount) return;
    var holes = belt.children;
    var i, idx;
    for (i = 0; i < n; i++) {
      idx = Math.floor(Math.random() * holes.length);
      holes[idx].classList.add('in');
    }
  }

  function resetPunches() {
    var belt = $('jackBelt');
    if (!belt) return;
    Array.prototype.forEach.call(belt.children, function (el) {
      el.classList.remove('in');
    });
  }

  function setPunchStage(text) {
    var stage = $('jackStage');
    if (stage) stage.textContent = text || '';
  }

  function startPunchProcess() {
    var proc = $('jackProcess');
    buildBelt();
    if (proc) proc.hidden = false;
    document.body.classList.add('jack-busy');
    resetPunches();
    punchSome(14);
    clearPunchTimers();
    setPunchStage('Slip received. Card punched.');
    [
      { at: 360, text: 'Checking the unsigned slip.' },
      { at: 880, text: 'Consulting the field index.' },
      { at: 1680, text: 'Addressing the clerk.' }
    ].forEach(function (s) {
      punchTimers.push(setTimeout(function () {
        setPunchStage(s.text);
        punchSome(8);
      }, s.at));
    });
    if (!reduce) {
      punchInterval = setInterval(function () { punchSome(5); }, 420);
    }
  }

  function stopPunchProcess() {
    clearPunchTimers();
    var proc = $('jackProcess');
    document.body.classList.remove('jack-busy');
    if (proc) proc.hidden = true;
    setPunchStage('');
  }

  function renderWork(id) {
    var el = $('work');
    if (!el) return;
    var extra = '';
    if (id === 'you') {
      extra =
        '<form id="sitForm" class="sit">' +
          '<label class="sr" for="sitName">State your name.</label>' +
          '<input id="sitName" name="name" type="text" maxlength="80" autocomplete="name" placeholder="Name for the record" required>' +
          '<label class="sr" for="sitEmail">Email</label>' +
          '<input id="sitEmail" name="email" type="email" maxlength="160" autocomplete="email" placeholder="Email for the slip" required>' +
          '<input id="sitPlace" name="place" type="text" maxlength="80" autocomplete="off" placeholder="Where are you speaking from?">' +
          '<textarea id="sitNote" name="note" maxlength="280" rows="3" placeholder="What brought you here? What do you notice that does not belong?"></textarea>' +
          '<button type="submit">FILE YOUR ARRIVAL</button>' +
          '<p class="join-status" id="joinStatus" role="status"></p>' +
        '</form>';
    }
    if (id === 'tree') {
      extra = '<p class="work-row"><a class="go" href="' + (cfg.tree || '/now') + '">WALK THE TREE — NOW</a></p>';
    }
    el.innerHTML = extra + askBox();
    if (id === 'you') {
      if (sitting.name) $('sitName').value = sitting.name;
      if (sitting.email) $('sitEmail').value = sitting.email;
      if (sitting.place) $('sitPlace').value = sitting.place;
      if (sitting.note) $('sitNote').value = sitting.note;
      bindSit();
    }
    bindAsk();
    bindVoice();
  }

  function talk(text) {
    speechText = String(text || '').replace(/\s+/g, ' ').trim();
    if (voiceEnabled && window.JackVoice && JackVoice.say) JackVoice.say(speechText);
  }

  function bindVoice() {
    var toggle = $('voiceToggle');
    if (!toggle || toggle.dataset.bound) return;
    toggle.dataset.bound = '1';
    if (window.JackVoice && JackVoice.setServer) JackVoice.setServer(cfg.voiceAct || '/intro/voice');
    toggle.addEventListener('click', function () {
      voiceEnabled = !voiceEnabled;
      toggle.setAttribute('aria-pressed', voiceEnabled ? 'true' : 'false');
      toggle.textContent = voiceEnabled ? 'VOICE: ON' : 'VOICE: OFF';
      if (voiceEnabled && window.JackVoice) {
        if (JackVoice.unlock) JackVoice.unlock();
        if (JackVoice.say) JackVoice.say(speechText || 'The clerk is present.');
      }
    });
  }

  function bindSit() {
    var form = $('sitForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (window.JackVoice && JackVoice.unlock) JackVoice.unlock();
      var name = String($('sitName').value || '').replace(/\s+/g, ' ').trim();
      var email = String($('sitEmail').value || '').replace(/\s+/g, ' ').trim();
      var place = String($('sitPlace').value || '').replace(/\s+/g, ' ').trim();
      var note = String($('sitNote').value || '').replace(/\s+/g, ' ').trim();
      if (!name) {
        $('beatText').textContent = 'A name, please. Even a false one will do for the blotter.';
        talk('A name, please. Even a false one will do for the blotter.');
        $('sitName').focus();
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        $('beatText').textContent = 'An email address, please. The clerk needs somewhere to send the receipt.';
        talk('An email address, please. The clerk needs somewhere to send the receipt.');
        $('sitEmail').focus();
        return;
      }
      var submit = form.querySelector('button[type="submit"]');
      var status = $('joinStatus');
      if (submit) submit.disabled = true;
      if (status) status.textContent = 'The clerk is holding the slip.';
      var identity = name + (cfg.viewer && cfg.viewer.name && cfg.viewer.name.toLowerCase() !== name.toLowerCase()
        ? ' (also known as ' + cfg.viewer.name + ')' : '');
      persistPlay({ name: name, email: email, place: place, note: note, interviewed: true, identity: identity });
      interviewed = true;
      sitting.name = name;
      sitting.email = email;
      sitting.place = place;
      sitting.note = note;
      sitting.interviewed = true;
      var identityLine = 'Name for the record: ' + name + (place ? '. Speaking from ' + place + '.' : '.');
      thread.push('Visitor: ' + identityLine);
      addThread('YOU', identityLine);
      var joinData = {
        csrf: cfg.csrf || '', name: name, email: email, location: place,
        mode: 'arrival', message: note, avatar_pixels: '[]'
      };
      pose('speak');
      fetch(cfg.joinAct || '/join/act.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(joinData)
      }).then(function (res) { return res.json().then(function (j) { return { ok: res.ok && j && j.ok, data: j || {} }; }); })
        .then(function (out) {
          if (!out.ok) throw new Error(out.data.error || 'The slip was not accepted.');
          var line = 'Filed under ' + identity + (place ? ', speaking from ' + place : '') + '.\nThe Guild keeps arrivals provisional so the record can change without pretending the past did.\nYou are carrying your first discrepancy into a field with two presents. Proceed to the tree.';
          addThread('JACK', line);
          $('beatLabel').textContent = 'JACK';
          $('beatText').textContent = line;
          talk(line);
          setFormLine('THE CLERK IS IN');
          if (status) status.textContent = 'Coordinates held. Your arrival is attached to the record.';
          if (submit) submit.disabled = false;
        }).catch(function (err) {
          if (status) status.textContent = err.message || 'The slip was not accepted.';
          if (submit) submit.disabled = false;
          setFormLine('THE CLERK IS IN');
        });
    });
  }

  function bindAsk() {
    var form = $('askForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (window.JackVoice && JackVoice.unlock) JackVoice.unlock();
      var box = $('askQ');
      var q = box ? String(box.value || '').replace(/\s+/g, ' ').trim() : '';
      if (!q) return;
      if (box) box.value = '';
      askJack(q);
    });
  }

  function askJack(q) {
    if (asking) return;
    asking = true;
    pose('punch');
    setFormLine('PUNCHING');
    thread.push('Visitor: ' + q);
    $('beatLabel').textContent = 'YOU';
    $('beatText').textContent = q;
    addThread('YOU', q);
    var askBtn = $('askForm') && $('askForm').querySelector('button');
    if (askBtn) askBtn.disabled = true;
    startPunchProcess();
    var data = new FormData();
    data.set('csrf', cfg.csrf || '');
    data.set('q', q);
    data.set('intent', 'ask');
    data.set('site', 'intro');
    data.set('focus', 'Front door conversation');
    data.set('thread', thread.join('\n').slice(0, 2000));
    fetch(cfg.jack || '/now/jack', {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    }).then(function (res) { return res.json(); }).then(function (j) {
      var text = (j && j.text) ? j.text : 'The clerk is away from the desk. Keep the statement; the field remains.';
      thread.push('Clerk: ' + text);
      stopPunchProcess();
      $('beatLabel').textContent = 'JACK';
      $('beatText').textContent = text;
      addThread('JACK', text);
      setFormLine('THE CLERK IS IN');
      talk(text);
      if (window.Jack && Jack.Sprite && Jack.Sprite.setForm) Jack.Sprite.setForm('sit');
    }).catch(function () {
      var away = 'The clerk is away from the desk. Keep the statement; the field remains.';
      thread.push('Clerk: ' + away);
      stopPunchProcess();
      $('beatLabel').textContent = 'JACK';
      $('beatText').textContent = away;
      addThread('JACK', away);
      setFormLine('THE CLERK IS IN');
    }).then(function () {
      asking = false;
      if (askBtn) askBtn.disabled = false;
    });
  }

  function showInvite() {
    done = true;
    seen.tree = true;
    $('invite').hidden = false;
    $('controls').hidden = true;
    $('advance').textContent = 'HEAR THAT AGAIN';
    setFormLine('ORIENTATION OVER');
    pose('deal');
    document.body.classList.remove('briefing');
    document.body.classList.add('oriented');
    persist();
  }

  function play(id, full) {
    clearTimeout(timer);
    typing = false;
    topic = id;
    seen[id] = true;
    var beat = TOPICS[id];
    if (id === 'you' && interviewed && sitting.name) {
      beat = {
        label: beat.label,
        form: beat.form,
        text: 'I have you as ' + sitting.name + '.\nCorrect the file if I have it wrong. Then we continue.'
      };
    }
    setFormLine(beat.label);
    pose(beat.form);
    paintBeat(beat, !!full);
    addThread('JACK', beat.text);
    talk(beat.text);
    renderWork(id);
    $('advance').textContent = 'NEXT';
    if (done) {
      $('invite').hidden = false;
      $('controls').hidden = true;
    } else {
      $('controls').hidden = false;
    }
    persist();
  }

  function next() {
    if (typing) {
      typing = false;
      clearTimeout(timer);
      var beat = TOPICS[topic];
      $('beatText').textContent = (topic === 'you' && interviewed && sitting.name)
        ? 'I have you as ' + sitting.name + '.\nCorrect the file if I have it wrong. Then we continue.'
        : beat.text;
      return;
    }
    if (topic === 'you' && !interviewed) {
      $('beatText').textContent = 'File your name. Then we continue.';
      talk('File your name. Then we continue.');
      if ($('sitName')) $('sitName').focus();
      return;
    }
    var idx = ORDER.indexOf(topic);
    if (idx >= ORDER.length - 1) {
      showInvite();
      return;
    }
    play(ORDER[idx + 1], false);
  }

  function bindJack() {
    var Spr = window.Jack && window.Jack.Sprite;
    var pet = $('jackPet');
    if (!Spr || !pet) return;
    Spr.attachPortrait(pet);
    Spr.setForm('speak');
    (function loop(now) {
      Spr.tick(now / 1000, {
        context: { phase: hopperPhase },
        body: { pressure: 0.12 }
      });
      requestAnimationFrame(loop);
    }(performance.now()));
  }

  function endBriefing(copy) {
    typing = false;
    clearTimeout(timer);
    play('tree', true);
    showInvite();
    $('beatLabel').textContent = 'ORIENTATION OVER';
    $('beatText').textContent = copy;
  }

  function bind() {
    $('advance').addEventListener('click', function () {
      next();
    });
    $('skip').textContent = 'SKIP TO NOW';
    $('skip').addEventListener('click', function () {
      endBriefing('Enough for now.\nThe clerk has already filed the slip.\nNOW is the public tree. The cube remains open.');
    });
    $('jackHit').addEventListener('click', function () {
      if (window.JackVoice && JackVoice.unlock) JackVoice.unlock();
      next();
    });
    document.addEventListener('keydown', function (e) {
      if (booting) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          if (startTitleFlash.skip) startTitleFlash.skip(e);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        next();
      }
    });
    startTitleFlash(function () {
      bindJack();
      if (done) {
        endBriefing('Jack still has the briefing. The clerk keeps the slip.\nThe doors remain: NOW and the cube.');
      } else {
        play('jack', false);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
