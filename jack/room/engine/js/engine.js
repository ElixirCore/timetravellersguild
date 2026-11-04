/* The engine is the cube. Talk sits on it. Projection is not storage. */
(function (J) {
  'use strict';

  var TALK_KEY = 'ttg.jack.engine.talk';
  var bounds = { minX: -3.6, maxX: 3.6, minZ: -3.6, maxZ: 3.6, height: 3.6 };
  var CUBE = {
    floor: '#FFD500',
    ceil: '#F5F5F5',
    north: '#C41E3A',
    south: '#FF6A00',
    west: '#0051BA',
    east: '#009E60'
  };
  var PLASTIC = '#111214';
  var jackObj = { id: 'obj-jack', x: 0, y: 0.82, z: 0, h: 0.7, w: 0.4, d: 0.28 };
  var doorRoom = {
    id: 'obj-door-room', label: 'DOOR · ROOM', type: 'door',
    x: -3.42, y: 0, z: 0.15, w: 0.14, h: 2.25, d: 1.15,
    color: '#1e3a5f', href: '/jack/room/'
  };
  var doorHopper = {
    id: 'obj-door-hopper', label: 'DOOR · HOPPER', type: 'door',
    x: 3.42, y: 0, z: 0.15, w: 0.14, h: 2.25, d: 1.15,
    color: '#1e3a5f', href: '/jack/room/#hopper'
  };
  var state = {
    body: {
      position: { x: 0, y: 1.45, z: 2.15 },
      yaw: Math.PI,
      pitch: 0.04,
      yawV: 0,
      energy: 1,
      pressure: 0.08,
      focus: 'obj-jack',
      limbs: {
        head: { status: 'idle', yaw: Math.PI },
        heart: {},
        leftArm: {},
        rightArm: {},
        leftLeg: {},
        rightLeg: {}
      }
    },
    context: { phase: 'SENSE', mode: 'ROOM', history: [] },
    room: { bounds: bounds, selectedObject: 'obj-jack', objects: [jackObj, doorRoom, doorHopper] }
  };

  J.State = {
    get: function () { return state; },
    setPhase: function (p) { state.context.phase = p; }
  };

  var canvas;
  var ctx;
  var w = 1;
  var h = 1;
  var fov = 420;
  var tiles = [];
  var pulse = 0;
  var keys = { w: false, a: false, s: false, d: false };
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var moved = 0;
  var session = null;
  var asking = false;
  var focused = false;
  var last = 0;

  function $(id) { return document.getElementById(id); }

  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }

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
    fov = Math.min(w, h) * 1.02;
  }

  function project(x, y, z) {
    var b = state.body;
    var dx = x - b.position.x;
    var dy = y - b.position.y;
    var dz = z - b.position.z;
    var cy = Math.cos(-b.yaw);
    var sy = Math.sin(-b.yaw);
    var rx = dx * cy - dz * sy;
    var rz = dx * sy + dz * cy;
    var cp = Math.cos(-b.pitch);
    var sp = Math.sin(-b.pitch);
    var ry = dy * cp - rz * sp;
    rz = dy * sp + rz * cp;
    if (rz < 0.12) return null;
    var f = fov / rz;
    return { x: w * 0.5 + rx * f, y: h * 0.42 - ry * f, z: rz, s: f };
  }

  function poly(pts, fill, stroke, width) {
    var ok = 0, i;
    for (i = 0; i < pts.length; i++) if (pts[i]) ok++;
    if (ok < 3) return;
    ctx.beginPath();
    var started = false;
    for (i = 0; i < pts.length; i++) {
      if (!pts[i]) continue;
      if (!started) { ctx.moveTo(pts[i].x, pts[i].y); started = true; }
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.stroke(); }
  }

  function wallQuad(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, fill) {
    var p = [project(x0, y0, z0), project(x1, y1, z1), project(x2, y2, z2), project(x3, y3, z3)];
    poly(p, fill, PLASTIC, 1.2);
  }

  function stickerQuad(face, col, row) {
    var gutter = 0.1;
    var x0 = bounds.minX, x1 = bounds.maxX, z0 = bounds.minZ, z1 = bounds.maxZ, yh = bounds.height;
    var wx = x1 - x0, wz = z1 - z0;
    var cx, cz, cy, tw, th;
    if (face === 'floor' || face === 'ceil') {
      tw = (wx - gutter * 4) / 3;
      th = (wz - gutter * 4) / 3;
      cx = x0 + gutter + col * (tw + gutter);
      cz = z0 + gutter + row * (th + gutter);
      cy = face === 'floor' ? 0.01 : yh - 0.01;
      return [[cx, cy, cz], [cx + tw, cy, cz], [cx + tw, cy, cz + th], [cx, cy, cz + th]];
    }
    if (face === 'north' || face === 'south') {
      tw = (wx - gutter * 4) / 3;
      th = (yh - gutter * 4) / 3;
      cx = x0 + gutter + col * (tw + gutter);
      cy = gutter + row * (th + gutter);
      cz = face === 'north' ? z0 + 0.02 : z1 - 0.02;
      return [[cx, cy, cz], [cx + tw, cy, cz], [cx + tw, cy + th, cz], [cx, cy + th, cz]];
    }
    tw = (wz - gutter * 4) / 3;
    th = (yh - gutter * 4) / 3;
    cz = z0 + gutter + col * (tw + gutter);
    cy = gutter + row * (th + gutter);
    cx = face === 'west' ? x0 + 0.02 : x1 - 0.02;
    return [[cx, cy, cz], [cx, cy, cz + tw], [cx, cy + th, cz + tw], [cx, cy + th, cz]];
  }

  function buildTiles() {
    tiles = [];
    var faces = ['floor', 'ceil', 'north', 'south', 'west', 'east'];
    var r, c, f, q;
    for (f = 0; f < faces.length; f++) {
      for (r = 0; r < 3; r++) {
        for (c = 0; c < 3; c++) {
          q = stickerQuad(faces[f], c, r);
          tiles.push({ face: faces[f], color: CUBE[faces[f]], quad: q });
        }
      }
    }
  }

  function drawCube() {
    var x0 = bounds.minX, x1 = bounds.maxX, z0 = bounds.minZ, z1 = bounds.maxZ, yh = bounds.height;
    wallQuad(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1, PLASTIC);
    wallQuad(x0, yh, z0, x1, yh, z0, x1, yh, z1, x0, yh, z1, PLASTIC);
    wallQuad(x0, 0, z0, x1, 0, z0, x1, yh, z0, x0, yh, z0, PLASTIC);
    wallQuad(x0, 0, z1, x1, 0, z1, x1, yh, z1, x0, yh, z1, PLASTIC);
    wallQuad(x0, 0, z0, x0, 0, z1, x0, yh, z1, x0, yh, z0, PLASTIC);
    wallQuad(x1, 0, z0, x1, 0, z1, x1, yh, z1, x1, yh, z0, PLASTIC);
    var i, q, p;
    for (i = 0; i < tiles.length; i++) {
      q = tiles[i].quad;
      p = [project(q[0][0], q[0][1], q[0][2]), project(q[1][0], q[1][1], q[1][2]), project(q[2][0], q[2][1], q[2][2]), project(q[3][0], q[3][1], q[3][2])];
      poly(p, tiles[i].color, PLASTIC, 2);
    }
  }

  function drawDoor(o) {
    var hw = (o.w || 0.14) / 2, hd = (o.d || 1.1) / 2;
    var y0 = o.y || 0, y1 = y0 + (o.h || 2.2);
    var x = o.x, z = o.z;
    var faces = [
      [[x - hw, y0, z - hd], [x + hw, y0, z - hd], [x + hw, y1, z - hd], [x - hw, y1, z - hd]],
      [[x - hw, y0, z + hd], [x + hw, y0, z + hd], [x + hw, y1, z + hd], [x - hw, y1, z + hd]],
      [[x - hw, y0, z - hd], [x - hw, y0, z + hd], [x - hw, y1, z + hd], [x - hw, y1, z - hd]],
      [[x + hw, y0, z - hd], [x + hw, y0, z + hd], [x + hw, y1, z + hd], [x + hw, y1, z - hd]]
    ];
    var i, p, j;
    for (i = 0; i < faces.length; i++) {
      p = [];
      for (j = 0; j < 4; j++) p[j] = project(faces[i][j][0], faces[i][j][1], faces[i][j][2]);
      poly(p, '#1e3a5f', '#111214', 1.4);
    }
    var leafX = x + (x > 0 ? -hw - 0.02 : hw + 0.02);
    poly([
      project(leafX, y0 + 0.12, z - hd + 0.16),
      project(leafX, y0 + 0.12, z + hd - 0.16),
      project(leafX, y1 - 0.12, z + hd - 0.16),
      project(leafX, y1 - 0.12, z - hd + 0.16)
    ], '#d9cb9e', '#1e3a5f', 1.2);
    var top = project(x, y1 + 0.14, z);
    if (top && top.z < 14) {
      ctx.font = '600 ' + Math.max(10, Math.min(18, 300 / top.z)) + 'px "Courier New", monospace';
      ctx.fillStyle = '#f1e4c4';
      ctx.textAlign = 'center';
      ctx.fillText(o.label, top.x, top.y);
    }
  }

  function drawJack() {
    if (!J.Sprite || !J.Sprite.drawInWorld) return;
    var glitch = asking || (Math.floor(pulse * 7) % 23 === 0);
    if (glitch) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      var ghost = { x: jackObj.x + 0.04, y: jackObj.y, z: jackObj.z, h: jackObj.h };
      J.Sprite.drawInWorld(ctx, project, ghost, false, pulse);
      ctx.restore();
    }
    J.Sprite.drawInWorld(ctx, project, jackObj, true, pulse);
  }

  function render(t) {
    pulse = t || 0;
    if (!ctx) return;
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PLASTIC;
    ctx.fillRect(0, 0, w, h);
    drawCube();
    drawDoor(doorRoom);
    drawDoor(doorHopper);
    drawJack();
  }

  function look(dx, dy) {
    state.body.yaw += dx;
    state.body.pitch = clamp(state.body.pitch + dy, -0.7, 0.5);
    state.body.limbs.head.yaw = state.body.yaw;
    J.State.setPhase('ORIENT');
  }

  function move(dt) {
    var b = state.body;
    var lat = 0;
    var depth = 0;
    if (!focused) {
      if (keys.w) depth += 1;
      if (keys.s) depth -= 1;
      if (keys.a) lat -= 1;
      if (keys.d) lat += 1;
    }
    b.yaw += b.yawV;
    b.yawV *= 0.94;
    if (Math.abs(b.yawV) < 0.0004) b.yawV = 0;
    if (lat || depth) {
      var speed = 2.05;
      var sy = Math.sin(b.yaw);
      var cy = Math.cos(b.yaw);
      b.position.x += (sy * depth + cy * lat) * speed * dt;
      b.position.z += (cy * depth - sy * lat) * speed * dt;
      b.position.x = clamp(b.position.x, bounds.minX + 0.5, bounds.maxX - 0.5);
      b.position.z = clamp(b.position.z, bounds.minZ + 0.5, bounds.maxZ - 0.5);
      J.State.setPhase('MOVE');
    } else if (state.context.phase === 'MOVE') {
      J.State.setPhase('SENSE');
    }
  }

  function talkList() {
    var raw = sessionStorage.getItem(TALK_KEY);
    if (!raw) return [];
    try {
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveTalk(list) {
    sessionStorage.setItem(TALK_KEY, JSON.stringify(list.slice(-40)));
  }

  function appendTalk(who, text) {
    var line = String(text || '').trim();
    if (!line) return;
    var list = talkList();
    list.push({ who: who, text: line, at: new Date().toISOString() });
    saveTalk(list);
    renderTalk();
  }

  function renderTalk() {
    var log = $('talkLog');
    if (!log) return;
    var wait = $('talkWait');
    var talk = talkList();
    if (wait) wait.hidden = talk.length > 0;
    var old = log.querySelectorAll('.talk-turn');
    var i;
    for (i = 0; i < old.length; i++) old[i].remove();
    for (i = 0; i < talk.length; i++) {
      var t = talk[i];
      var el = document.createElement('div');
      el.className = 'talk-turn ' + (t.who === 'visitor' ? 'visitor' : 'clerk');
      var who = document.createElement('span');
      who.className = 'who';
      who.textContent = t.who === 'visitor' ? 'VISITOR' : 'JACK';
      var p = document.createElement('p');
      p.textContent = t.text || '';
      el.appendChild(who);
      el.appendChild(p);
      log.appendChild(el);
    }
    log.scrollTop = log.scrollHeight;
  }

  function setClerk(text, kind) {
    var el = $('clerkLine');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('live', 'away');
    if (kind) el.classList.add(kind);
  }

  function thread() {
    return talkList().slice(-8).map(function (t) {
      return (t.who === 'visitor' ? 'Visitor: ' : 'Jack: ') + String(t.text || '');
    }).join('\n').slice(0, 1500);
  }

  function parseJson(res) {
    return res.text().then(function (raw) {
      var data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
      if (!res.ok) {
        var err = new Error((data && data.error) || ('http_' + res.status));
        err.payload = data;
        throw err;
      }
      return data;
    });
  }

  function connect() {
    if (session && session.csrf) return Promise.resolve(session);
    setClerk('POURING…', 'away');
    return fetch('../boot.php', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(parseJson).then(function (boot) {
      if (!boot || !boot.csrf) throw new Error('no_csrf');
      session = boot;
      if (boot.clerk && boot.clerk.available) setClerk('TAP OPEN · LIVE', 'live');
      else setClerk('TAP OPEN · QUIET', 'away');
      if (!talkList().length) {
        appendTalk('clerk', 'The cube is closed. The tap is open. Nothing we say here is a slip.');
      } else {
        renderTalk();
      }
      return session;
    }).catch(function () {
      session = null;
      setClerk('THE TAP WOULD NOT OPEN', 'away');
      if (!talkList().length) {
        appendTalk('clerk', 'I am here. The clerk’s line is quiet. We can still sit with the cube.');
      }
      return null;
    });
  }

  function speak(text) {
    var line = String(text || '').trim();
    if (!line) return;
    if (window.JackVoice && JackVoice.say) {
      JackVoice.say(line);
      return;
    }
    if (window.speechSynthesis) {
      var u = new SpeechSynthesisUtterance(line);
      u.rate = 0.92;
      u.pitch = 0.72;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  function ask() {
    var ta = $('consoleIn');
    var q = ta ? String(ta.value || '').trim() : '';
    if (!q) {
      appendTalk('clerk', 'Say it. This tap does not take a blank glass.');
      return;
    }
    if (asking) return;
    asking = true;
    J.State.setPhase('VOICE');
    if (J.Sprite && J.Sprite.punch) J.Sprite.punch(pulse);
    var btn = $('btnAsk');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    if (ta) ta.value = '';
    appendTalk('visitor', q);
    var ready = session && session.csrf ? Promise.resolve(session) : connect();
    ready.then(function (boot) {
      if (!boot || !boot.csrf) throw new Error('no_csrf');
      var data = new FormData();
      data.set('csrf', boot.csrf);
      data.set('q', q.slice(0, 2000));
      data.set('intent', 'ask');
      data.set('site', 'engine');
      data.set('thread', thread());
      data.set('focus', 'ENGINE · RUBIK CUBE');
      return fetch(boot.jack_endpoint || '/now/jack', {
        method: 'POST',
        body: data,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      }).then(parseJson);
    }).then(function (res) {
      var speech = (res && res.text) || 'I do not have that as a record. I can still sit with it.';
      appendTalk('clerk', speech);
      speak(speech);
    }).catch(function () {
      appendTalk('clerk', 'The line went quiet. The cube did not.');
    }).then(function () {
      asking = false;
      J.State.setPhase('SENSE');
      if (btn) { btn.disabled = false; btn.textContent = 'TALK'; }
    });
  }

  function onBar(el) {
    return !!(el && el.closest && el.closest('#bar'));
  }

  function bind() {
    canvas = $('stage');
    ctx = canvas.getContext('2d');
    resize();
    buildTiles();
    if (J.Sprite && $('jackPet')) J.Sprite.attachPortrait($('jackPet'));
    canvas.addEventListener('pointerdown', function (e) {
      if (onBar(e.target)) return;
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      var hint = $('hint');
      if (hint) hint.classList.add('hide');
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      look(-dx * 0.0055, dy * 0.0035);
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointerup', function () { dragging = false; });
    window.addEventListener('pointercancel', function () { dragging = false; });
    window.addEventListener('keydown', function (e) {
      if (focused) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
        return;
      }
      if (e.code === 'KeyW') keys.w = true;
      if (e.code === 'KeyS') keys.s = true;
      if (e.code === 'KeyA') keys.a = true;
      if (e.code === 'KeyD') keys.d = true;
    });
    window.addEventListener('keyup', function (e) {
      if (e.code === 'KeyW') keys.w = false;
      if (e.code === 'KeyS') keys.s = false;
      if (e.code === 'KeyA') keys.a = false;
      if (e.code === 'KeyD') keys.d = false;
    });
    window.addEventListener('resize', resize);
    var ta = $('consoleIn');
    if (ta) {
      ta.addEventListener('focus', function () { focused = true; });
      ta.addEventListener('blur', function () { focused = false; });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          ask();
        }
      });
    }
    $('btnAsk') && $('btnAsk').addEventListener('click', ask);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function tick(now) {
    var t = now / 1000;
    var dt = last ? Math.min(0.05, t - last) : 0.016;
    last = t;
    move(dt);
    if (J.Doors && J.Doors.tick) J.Doors.tick(dt, state.room.objects, state.body.position, null);
    if (J.Sprite) J.Sprite.tick(t, state);
    render(t);
    requestAnimationFrame(tick);
  }

  function boot() {
    bind();
    renderTalk();
    connect();
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.Jack = window.Jack || {});
