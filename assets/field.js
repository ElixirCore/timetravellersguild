/* Five projections of one field. Canvas is a projection. The JSON is the store. */
(function () {
  'use strict';

  var DATA = window.TTG_FIELD || {};
  var AXES = [
    { id: 'TEMPORAL', label: 'TEMPORAL', short: 'TIME' },
    { id: 'SOCIAL', label: 'SOCIAL', short: 'PEOPLE' },
    { id: 'SPATIAL', label: 'SPATIAL', short: 'PLACE' },
    { id: 'INSTITUTIONAL', label: 'INSTITUTIONAL', short: 'HOUSE' },
    { id: 'SYMBOLIC', label: 'SYMBOLIC', short: 'SIGN' }
  ];
  var PAPER = '#d9cb9e';
  var WELL = '#cfc19a';
  var NAVY = '#1e3a5f';
  var INK = '#161814';
  var TERRA = '#b2533e';
  var DIM = '#7b8070';
  var SCARLET = '#c41e3a';

  var canvas, ctx, w = 1, h = 1;
  var laid = [];
  var selected = null;
  var hover = null;
  var focusAxis = '';
  var cam = { rot: 0.08 };
  var auto = true;
  var pointer = { x: 0, y: 0, down: false, px: 0, dragged: false };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var listening = false;
  var rec = null;
  var busy = false;
  var hopperPhase = 'VOICE';

  function $(id) { return document.getElementById(id); }

  function hash(s) {
    var n = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
    return (n >>> 0) / 4294967296;
  }

  function axisFor(node) {
    var t = String((node && node.type) || 'UNKNOWN').toUpperCase();
    if (t === 'MOMENT' || t === 'EVENT') return 'TEMPORAL';
    if (t === 'PERSON') return 'SOCIAL';
    if (t === 'PLACE') return 'SPATIAL';
    if (t === 'INSTITUTION' || t === 'DOCUMENT' || t === 'MISSION') return 'INSTITUTIONAL';
    return 'SYMBOLIC';
  }

  function axisAngle(i, t) {
    return -Math.PI / 2 + i * (Math.PI * 2 / 5) + cam.rot + (reduce ? 0 : Math.sin(t * 0.08) * 0.012);
  }

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = window.innerWidth;
    var ch = window.innerHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
    }
    w = canvas.width;
    h = canvas.height;
  }

  function centre() {
    return { x: w * 0.5, y: h * (window.innerWidth < 700 ? 0.34 : 0.38) };
  }

  function radius() {
    return Math.min(w, h) * (window.innerWidth < 700 ? 0.28 : 0.32);
  }

  function lay() {
    laid = [];
    var nodes = DATA.field || [];
    var counts = {};
    nodes.forEach(function (n) {
      var ax = axisFor(n);
      counts[ax] = (counts[ax] || 0) + 1;
      var i = counts[ax];
      var axis = AXES.findIndex(function (a) { return a.id === ax; });
      if (axis < 0) axis = 4;
      laid.push({
        node: n,
        axis: ax,
        axisI: axis,
        u: 0.28 + hash(n.slug || n.title) * 0.62,
        v: ((i % 5) - 2) * 0.055,
        r: 0.55 + hash((n.slug || '') + 'r') * 0.45
      });
    });
  }

  function projectItem(item, t) {
    var c = centre();
    var R = radius();
    var ang = axisAngle(item.axisI, t);
    var perp = ang + Math.PI / 2;
    var u = item.u * R;
    var x = c.x + Math.cos(ang) * u + Math.cos(perp) * item.v * R;
    var y = c.y + Math.sin(ang) * u + Math.sin(perp) * item.v * R;
    return { x: x, y: y, s: 11 + item.r * 7 };
  }

  function drawHole(x, y, s, on, dim, pending) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, on ? s + 2 : s, 0, Math.PI * 2);
    ctx.globalAlpha = dim ? 0.22 : 1;
    ctx.fillStyle = on ? SCARLET : (pending ? TERRA : NAVY);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2.2, s * 0.38), 0, Math.PI * 2);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.restore();
  }

  function paint(now) {
    var t = (now || 0) / 1000;
    resize();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    var c = centre();
    var R = radius();
    var i, a, ang, x2, y2, item, p, dim, on;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = NAVY;
    for (i = 0; i < 36; i++) {
      ctx.beginPath();
      ctx.arc(28 + (i * 47) % w, 22 + ((i * 31) % 48), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (i = 0; i < AXES.length; i++) {
      a = AXES[i];
      ang = axisAngle(i, t);
      x2 = c.x + Math.cos(ang) * R;
      y2 = c.y + Math.sin(ang) * R;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = focusAxis && focusAxis !== a.id ? DIM : NAVY;
      ctx.globalAlpha = focusAxis && focusAxis !== a.id ? 0.25 : 0.9;
      ctx.lineWidth = focusAxis === a.id ? 3 : 1.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = focusAxis === a.id ? SCARLET : NAVY;
      ctx.font = '11px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.label, c.x + Math.cos(ang) * (R + 22), c.y + Math.sin(ang) * (R + 22));
    }

    ctx.beginPath();
    ctx.arc(c.x, c.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = WELL;
    ctx.fill();
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = TERRA;
    ctx.font = '9px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', c.x, c.y + 3);

    laid.forEach(function (item) {
      p = projectItem(item, t);
      dim = focusAxis && focusAxis !== item.axis;
      on = selected && selected.node && selected.node.slug === item.node.slug;
      drawHole(p.x, p.y, 5 + item.r * 3.2, on, dim, !!item.node.pending);
      item._x = p.x;
      item._y = p.y;
      item._s = p.s;
    });
    if (hover && hover.node) {
      p = projectItem(hover, t);
      ctx.fillStyle = INK;
      ctx.font = '11px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(hover.node.title || '').toUpperCase(), p.x, p.y - 16);
    }

    if (listening) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 28 + Math.sin(t * 8) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = SCARLET;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function hit(x, y) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    x *= dpr;
    y *= dpr;
    var i, it, dx, dy, best = null, bd = 28 * dpr;
    for (i = laid.length - 1; i >= 0; i--) {
      it = laid[i];
      dx = x - (it._x || 0);
      dy = y - (it._y || 0);
      if (Math.hypot(dx, dy) < Math.max(bd, (it._s || 12) * 1.8)) {
        best = it;
        break;
      }
    }
    if (best) return { kind: 'node', item: best };
    var c = centre();
    var R = radius();
    var t = performance.now() / 1000;
    for (i = 0; i < AXES.length; i++) {
      var ang = axisAngle(i, t);
      var ax = c.x + Math.cos(ang) * (R + 22);
      var ay = c.y + Math.sin(ang) * (R + 22);
      if (Math.hypot(x - ax, y - ay) < 36 * dpr) return { kind: 'axis', id: AXES[i].id };
    }
    return null;
  }

  function setForm(text) {
    var el = $('jackForm');
    if (el) el.textContent = text;
  }

  function pose(form) {
    var Spr = window.Jack && window.Jack.Sprite;
    if (!Spr) return;
    hopperPhase = form === 'punch' ? 'OPERATE' : (form === 'deal' ? 'CARD' : 'VOICE');
    if (form === 'punch' && Spr.punch) Spr.punch();
    else if (form === 'deal' && Spr.deal) Spr.deal(2);
    else if (Spr.setForm) Spr.setForm(form);
  }

  function showSlip(item) {
    selected = item;
    var n = item.node;
    $('slipAxis').textContent = item.axis + ' · ' + String(n.type || '');
    $('slipTitle').textContent = n.title || 'Untitled';
    $('slipMeta').textContent = (n.pending ? 'PENDING · ' : '') + (n.place || n.zone || '');
    $('slipBody').textContent = n.body || n.note || '';
    $('slipOpen').href = n.href || ('/n/' + encodeURIComponent(n.slug || '') + '/');
    $('slip').hidden = false;
    $('axisRead').textContent = item.axis;
    focusAxis = item.axis;
  }

  function hideSlip() {
    selected = null;
    $('slip').hidden = true;
  }

  function appendLog(who, text) {
    var log = $('log');
    if (!log || !text) return;
    var p = document.createElement('p');
    p.className = who;
    p.textContent = (who === 'you' ? 'YOU · ' : 'JACK · ') + text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function speakQueued() {
    if (!DATA.jack || !DATA.jack.voice) return;
    var data = new FormData();
    data.set('csrf', DATA.csrf || '');
    fetch('/jack/speak', { method: 'POST', body: data, credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.blob() : null; })
      .then(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        var audio = new Audio(url);
        audio.play().catch(function () {});
      })
      .catch(function () {});
  }

  function send(intent) {
    var q = (($('story') && $('story').value) || '').trim();
    if (!q || busy) return;
    busy = true;
    pose('punch');
    setForm(intent === 'lodge' ? 'HOLDING THE STORY' : 'THE CLERK IS LISTENING');
    $('status').textContent = intent === 'lodge' ? 'The hopper is taking the story. Not canon.' : 'Jack is taking the story.';
    appendLog('you', q.length > 220 ? q.slice(0, 217) + '…' : q);
    var data = new FormData();
    data.set('csrf', DATA.csrf || '');
    data.set('q', q);
    data.set('intent', intent || 'ask');
    data.set('site', 'field');
    fetch(DATA.jack_endpoint || '/now/jack', {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    }).then(function (res) { return res.json(); })
      .then(function (j) {
        busy = false;
        var text = (j && j.text) ? j.text : 'The clerk is away from the desk. The field remains.';
        $('jackLine').textContent = text;
        appendLog('jack', text);
        pose('deal');
        setForm(j && j.ingested ? 'HELD · NOT CANON' : 'COORDINATES HEARD');
        $('status').textContent = j && j.ingested
          ? 'Held as pending testimony. A keeper writes canon.'
          : 'Jack heard it. Lodge if you want the hopper to keep the slip.';
        if ($('story')) $('story').value = '';
        if (j && j.voice !== false) speakQueued();
      })
      .catch(function () {
        busy = false;
        pose('sit');
        setForm('THE FIELD REMAINS');
        $('status').textContent = 'The clerk could not be reached.';
      });
  }

  function setTalkLabel() {
    var btn = $('talkBtn');
    if (!btn) return;
    btn.textContent = listening ? 'LISTENING' : 'HOLD TO TALK';
    btn.classList.toggle('listening', listening);
    btn.setAttribute('aria-pressed', listening ? 'true' : 'false');
  }

  function setupTalk() {
    var btn = $('talkBtn');
    if (!btn) return;
    var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      $('status').textContent = 'This browser will not take dictation. Type the story, then ASK JACK. Safari or Chrome on a phone will talk.';
      return;
    }
    rec = new Rec();
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = function (ev) {
      var t = '';
      var i;
      for (i = ev.resultIndex; i < ev.results.length; i++) {
        t += ev.results[i][0].transcript;
      }
      if ($('story')) $('story').value = t;
      if (ev.results[ev.results.length - 1].isFinal) {
        listening = false;
        setTalkLabel();
        send('ask');
      }
    };
    rec.onerror = function () {
      listening = false;
      setTalkLabel();
      setForm('THE FIELD IS OPEN');
      $('status').textContent = 'The telephone did not catch it. Try again, or type.';
    };
    rec.onend = function () {
      if (listening) {
        try { rec.start(); } catch (e) { listening = false; setTalkLabel(); }
      } else setTalkLabel();
    };
    btn.addEventListener('click', function () {
      listening = !listening;
      setTalkLabel();
      if (listening) {
        pose('punch');
        setForm('THE FIELD IS LISTENING');
        $('status').textContent = 'Speak into the telephone. Jack will take the story.';
        try { rec.start(); } catch (e) { listening = false; setTalkLabel(); }
      } else {
        try { rec.stop(); } catch (e) {}
        setForm('THE FIELD IS OPEN');
      }
    });
  }

  function bindPointer() {
    function pos(ev) {
      if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      return { x: ev.clientX, y: ev.clientY };
    }
    function down(ev) {
      if (ev.target !== canvas) return;
      var p = pos(ev);
      pointer.down = true;
      pointer.dragged = false;
      pointer.px = p.x;
      pointer.x = p.x;
      auto = false;
    }
    function move(ev) {
      var p = pos(ev);
      pointer.x = p.x;
      if (pointer.down) {
        cam.rot += (p.x - pointer.px) * 0.006;
        if (Math.abs(p.x - pointer.px) > 6) pointer.dragged = true;
        pointer.px = p.x;
      } else {
        var found = hit(p.x, p.y);
        hover = found && found.kind === 'node' ? found.item : null;
        canvas.style.cursor = found ? 'pointer' : 'grab';
      }
    }
    function up(ev) {
      if (!pointer.down) return;
      pointer.down = false;
      if (pointer.dragged) return;
      var p = pos(ev.changedTouches ? ev.changedTouches[0] : ev);
      var found = hit(p.x, p.y);
      if (!found) {
        hideSlip();
        focusAxis = '';
        $('axisRead').textContent = 'YOU ARE HERE';
        return;
      }
      if (found.kind === 'axis') {
        focusAxis = focusAxis === found.id ? '' : found.id;
        $('axisRead').textContent = focusAxis || 'YOU ARE HERE';
        hideSlip();
        return;
      }
      showSlip(found.item);
    }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    canvas.addEventListener('touchstart', down, { passive: true });
    canvas.addEventListener('touchmove', move, { passive: true });
    addEventListener('touchend', up);
  }

  function bindJack() {
    var Spr = window.Jack && window.Jack.Sprite;
    var pet = $('jackPet');
    if (!Spr || !pet) return;
    Spr.attachPortrait(pet);
  }

  function loop(now) {
    if (auto && !reduce) cam.rot += 0.0007;
    paint(now);
    var Spr = window.Jack && window.Jack.Sprite;
    if (Spr) {
      Spr.tick((now || 0) / 1000, {
        context: { phase: hopperPhase },
        body: { pressure: listening || busy ? 0.4 : 0.1 }
      });
    }
    requestAnimationFrame(loop);
  }

  function bind() {
    canvas = $('field');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    lay();
    bindJack();
    bindPointer();
    setupTalk();
    $('askBtn').addEventListener('click', function () { send('ask'); });
    $('lodgeBtn').addEventListener('click', function () { send('lodge'); });
    $('slipClose').addEventListener('click', hideSlip);
    addEventListener('resize', resize);
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
