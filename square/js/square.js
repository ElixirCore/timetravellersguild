/* Gillett Square. Jack outdoors. Three r128, no modules. */
(function () {
  'use strict';

  var cfg = window.TTG_SQUARE || {};
  var awake = true;
  var nightMode = true;
  var orbitOn = false;
  var thread = [];

  function $(id) { return document.getElementById(id); }

  function say(text) {
    var line = $('jackLine');
    if (line) line.innerHTML = '<b>JACK:</b> ' + String(text || '').replace(/</g, '&lt;');
    if (window.JackVoice && JackVoice.say) JackVoice.say(text);
  }

  function status(html) {
    var el = $('status');
    if (el) el.innerHTML = html;
  }

  var POSCA = ['#ff2d95', '#ff6a00', '#ffe600', '#39ff14', '#00e5ff', '#7b5cff', '#ffffff', '#ff3355'];

  function rng(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function poscaTex(w, h, seed, paint) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    paint(ctx, w, h, rng(seed));
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function fat(ctx, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function blob(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function star(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    var i;
    for (i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      var b = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(b) * r * 0.4, y + Math.sin(b) * r * 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }

  function tag(ctx, text, x, y, color, size, rnd) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((rnd ? rnd() : 0.5) - 0.5) * 0.22);
    ctx.font = '900 ' + size + 'px Courier, monospace';
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drip(ctx, x, y, color, rnd) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 4 + rnd() * 4, 12 + rnd() * 28);
    blob(ctx, x + 3, y + 18 + rnd() * 20, 3 + rnd() * 3, color);
  }

  function paintAsphalt(ctx, w, h, rnd) {
    var i, c, x, y;
    ctx.fillStyle = '#3a2a48';
    ctx.fillRect(0, 0, w, h);
    for (i = 0; i < 28; i++) {
      c = POSCA[i % POSCA.length];
      ctx.globalAlpha = 0.18 + rnd() * 0.22;
      ctx.fillStyle = c;
      ctx.fillRect(rnd() * w, rnd() * h, 40 + rnd() * 120, 28 + rnd() * 90);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < 700; i++) {
      ctx.fillStyle = rnd() > 0.5 ? '#4a3858' : '#2a1c38';
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 4);
    }
    for (i = 0; i < 10; i++) {
      x = 30 + (i % 5) * 46;
      y = h * 0.55 + Math.floor(i / 5) * 46;
      ctx.strokeStyle = i % 2 ? '#ffe600' : '#ffffff';
      ctx.lineWidth = 6;
      ctx.strokeRect(x, y, 40, 40);
      ctx.fillStyle = POSCA[i % POSCA.length];
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + 4, y + 4, 32, 32);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a1430';
      ctx.font = '900 18px Courier, monospace';
      ctx.fillText(String(i + 1), x + 12, y + 26);
    }
    for (i = 0; i < 26; i++) {
      c = POSCA[i % POSCA.length];
      ctx.globalAlpha = 0.75 + rnd() * 0.25;
      fat(ctx, rnd() * w, rnd() * h, rnd() * w, rnd() * h, c, 10 + rnd() * 22);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < 22; i++) drip(ctx, rnd() * w, rnd() * h * 0.7, POSCA[i % POSCA.length], rnd);
    for (i = 0; i < 55; i++) blob(ctx, rnd() * w, rnd() * h, 5 + rnd() * 14, POSCA[(i + 3) % POSCA.length]);
    for (i = 0; i < 12; i++) star(ctx, rnd() * w, rnd() * h, 12 + rnd() * 20, POSCA[i % POSCA.length]);
    tag(ctx, 'TTG', 36, 64, '#ffe600', 48, rnd);
    tag(ctx, '1951', w * 0.62, h * 0.22, '#00e5ff', 32, rnd);
    tag(ctx, 'PLAY', w * 0.14, h * 0.38, '#ff2d95', 30, rnd);
    tag(ctx, 'NOW', w * 0.7, h * 0.88, '#39ff14', 26, rnd);
  }

  function paintStage(ctx, w, h, rnd) {
    var i;
    ctx.fillStyle = '#ffe8a8';
    ctx.fillRect(0, 0, w, h);
    for (i = 0; i < 10; i++) {
      ctx.fillStyle = POSCA[i % POSCA.length];
      ctx.globalAlpha = 0.16;
      ctx.fillRect(rnd() * w, rnd() * h, 50 + rnd() * 140, 40 + rnd() * 90);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e4c88a';
    for (i = 0; i < 80; i++) ctx.fillRect(rnd() * w, rnd() * h, 8, 8);
    ctx.strokeStyle = '#1a2438';
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    fat(ctx, 40, 40, w - 40, 40, '#ff2d95', 16);
    fat(ctx, 40, h - 40, w - 40, h - 40, '#00e5ff', 16);
    fat(ctx, 40, 40, 40, h - 40, '#ffe600', 16);
    fat(ctx, w - 40, 40, w - 40, h - 40, '#39ff14', 16);
    for (i = 0; i < 28; i++) {
      fat(ctx, rnd() * w, rnd() * h, rnd() * w, rnd() * h, POSCA[i % POSCA.length], 7 + rnd() * 14);
    }
    for (i = 0; i < 14; i++) drip(ctx, 50 + rnd() * (w - 100), 30, POSCA[i % POSCA.length], rnd);
    for (i = 0; i < 22; i++) blob(ctx, 60 + rnd() * (w - 120), 60 + rnd() * (h - 120), 7 + rnd() * 12, POSCA[i % POSCA.length]);
    star(ctx, w * 0.5, h * 0.48, 40, '#ff3355');
    star(ctx, w * 0.5, h * 0.48, 20, '#ffe600');
    tag(ctx, 'GILLETT', w * 0.16, h * 0.22, '#7b5cff', 38, rnd);
    tag(ctx, 'SQUARE', w * 0.5, h * 0.86, '#ff6a00', 36, rnd);
    tag(ctx, 'JACK', w * 0.68, h * 0.3, '#1a2438', 24, rnd);
  }

  function paintStep(ctx, w, h, rnd) {
    var i;
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(0, 0, w, h);
    for (i = 0; i < 14; i++) {
      ctx.fillStyle = POSCA[i % POSCA.length];
      ctx.fillRect(i * (w / 14), 0, w / 14, h);
    }
    ctx.globalAlpha = 0.65;
    for (i = 0; i < 10; i++) fat(ctx, rnd() * w, 4, rnd() * w, h - 4, POSCA[i % POSCA.length], 5);
    ctx.globalAlpha = 1;
  }

  function paintBark(ctx, w, h, rnd) {
    var i;
    ctx.fillStyle = '#6a3d1e';
    ctx.fillRect(0, 0, w, h);
    for (i = 0; i < 20; i++) fat(ctx, rnd() * w, 0, rnd() * w, h, rnd() > 0.5 ? '#4a2810' : '#8a5428', 3);
    for (i = 0; i < 6; i++) {
      ctx.fillStyle = POSCA[i % POSCA.length];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, h * (0.12 + i * 0.14), w, 10 + rnd() * 8);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < 12; i++) blob(ctx, rnd() * w, rnd() * h, 4 + rnd() * 7, POSCA[i % POSCA.length]);
    tag(ctx, 'TTG', 8, h * 0.55, '#ffe600', 18, rnd);
  }

  function paintLeaf(ctx, w, h, rnd) {
    var i, c;
    ctx.fillStyle = '#1a8a32';
    ctx.fillRect(0, 0, w, h);
    for (i = 0; i < 40; i++) {
      c = i % 5 === 0 ? '#ff2d95' : (i % 5 === 1 ? '#ffe600' : (i % 5 === 2 ? '#00e5ff' : (i % 5 === 3 ? '#39ff14' : '#7b5cff')));
      blob(ctx, rnd() * w, rnd() * h, 8 + rnd() * 18, c);
    }
    star(ctx, w * 0.4, h * 0.35, 14, '#ffffff');
    star(ctx, w * 0.72, h * 0.62, 10, '#ffe600');
  }

  function paintSide(ctx, w, h, rnd) {
    var i;
    ctx.fillStyle = '#c9a36a';
    ctx.fillRect(0, 0, w, h);
    for (i = 0; i < 16; i++) fat(ctx, 0, rnd() * h, w, rnd() * h, POSCA[i % POSCA.length], 10);
    for (i = 0; i < 8; i++) drip(ctx, rnd() * w, 0, POSCA[i % POSCA.length], rnd);
    tag(ctx, 'POSCA', 10, h * 0.62, '#1a2438', 22, rnd);
  }

  function paintPole(ctx, w, h, rnd) {
    var i;
    ctx.fillStyle = '#1a1430';
    ctx.fillRect(0, 0, w, h);
    for (i = 0; i < 10; i++) {
      ctx.fillStyle = POSCA[i % POSCA.length];
      ctx.fillRect(0, i * (h / 10), w, h / 10 - 2);
    }
    for (i = 0; i < 6; i++) drip(ctx, rnd() * w, rnd() * h * 0.4, POSCA[i % POSCA.length], rnd);
  }

  function askJack(q) {
    q = String(q || '').replace(/\s+/g, ' ').trim();
    if (!q) return;
    if (q.length > 2000) q = q.slice(0, 2000);
    say('…');
    thread.push('Visitor: ' + q);
    if (thread.length > 8) thread = thread.slice(-8);
    var data = new FormData();
    data.set('csrf', cfg.csrf || '');
    data.set('q', q);
    data.set('intent', 'ask');
    data.set('site', 'square');
    data.set('focus', 'Gillett Square · the outdoor cube');
    data.set('thread', thread.join('\n').slice(0, 1500));
    fetch(cfg.jack || '/now/jack', {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    }).then(function (res) { return res.json(); }).then(function (j) {
      var text = (j && j.text) ? j.text : 'The clerk is away from the desk. The square remains.';
      thread.push('Clerk: ' + text);
      say(text);
      if (window.Jack && Jack.Sprite && Jack.Sprite.setForm) Jack.Sprite.setForm('sit');
    }).catch(function () {
      say('The clerk is away from the desk. The square remains.');
    });
  }

  function bindTalk() {
    var form = $('askForm');
    var box = $('askQ');
    if (!form || !box) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = box.value;
      box.value = '';
      if (window.Jack && Jack.Sprite && Jack.Sprite.setForm) Jack.Sprite.setForm('speak');
      askJack(q);
    });
  }

  function bindJoin() {
    var form = $('joinForm');
    var note = $('formNote');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var body = {
        csrf: fd.get('csrf') || cfg.csrf || '',
        name: fd.get('name') || '',
        email: fd.get('email') || '',
        location: 'Gillett Square',
        mode: 'arrival',
        door: 'square',
        message: [fd.get('entry') || '', fd.get('message') || ''].filter(Boolean).join(' — ')
      };
      if (note) note.textContent = 'The clerk is punching the slip.';
      fetch('/join/act.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok && data && data.ok, data: data || {} }; });
      }).then(function (out) {
        if (!out.ok) {
          if (note) note.textContent = out.data.error || 'The slip was not accepted.';
          return;
        }
        form.reset();
        if (note) note.textContent = (out.data.first || 'Arrival') + ' is on the hopper. Held, not canon.';
        say('Your slip is in the hopper. I have not made it canon.');
      }).catch(function () {
        if (note) note.textContent = 'The hopper is jammed. Try the programme at /join/.';
      });
    });
  }

  function hasGL() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
  }

  function bootWorld() {
    var wrap = $('canvas-wrap');
    if (!wrap || !window.THREE || !hasGL()) {
      document.body.classList.add('no-gl');
      return null;
    }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0a28);
    var camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(7.2, 5.2, 7.8);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    wrap.appendChild(renderer.domElement);

    var target = new THREE.Vector3(0, 0.7, 0);
    var yaw = 0.82, pitch = 0.55, dist = 11.2;
    var tyaw = yaw, tpitch = pitch, tdist = dist;
    var dragging = false, lastX = 0, lastY = 0, lastPinch = 0, moved = 0;

    function applyCam() {
      yaw += (tyaw - yaw) * 0.08;
      pitch += (tpitch - pitch) * 0.08;
      dist += (tdist - dist) * 0.08;
      pitch = Math.max(0.18, Math.min(1.25, pitch));
      dist = Math.max(4, Math.min(18, dist));
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * Math.cos(pitch) * dist
      );
      camera.lookAt(target);
    }

    scene.add(new THREE.HemisphereLight(0xffc8f0, 0x3a2060, 1.15));
    var sun = new THREE.DirectionalLight(0xfff0c8, 1.85);
    sun.position.set(5, 9, 4);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.PointLight(0xff2d95, 0.55, 18)).position.set(-4, 3, 2);
    scene.add(new THREE.PointLight(0x00e5ff, 0.45, 16)).position.set(4, 3, -2);

    var root = new THREE.Group();
    scene.add(root);

    var asphalt = poscaTex(512, 512, 1951, paintAsphalt);
    asphalt.repeat.set(2, 2);
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 13, 10, 10),
      new THREE.MeshLambertMaterial({ map: asphalt })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.rotation.z = 0.018;
    ground.position.y = -0.04;
    ground.receiveShadow = true;
    root.add(ground);

    var grid = new THREE.GridHelper(16, 16, 0xff2d95, 0x00e5ff);
    grid.scale.z = 0.82;
    grid.position.y = 0.014;
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    root.add(grid);

    var stageMap = poscaTex(512, 512, 5081, paintStage);
    var sideMap = poscaTex(256, 128, 77, paintSide);
    var platMats = [
      new THREE.MeshLambertMaterial({ map: sideMap }),
      new THREE.MeshLambertMaterial({ map: sideMap }),
      new THREE.MeshLambertMaterial({ map: stageMap }),
      new THREE.MeshLambertMaterial({ map: sideMap }),
      new THREE.MeshLambertMaterial({ map: sideMap }),
      new THREE.MeshLambertMaterial({ map: sideMap })
    ];
    var platform = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.42, 6.4), platMats);
    platform.position.y = 0.18;
    platform.rotation.z = 0.012;
    platform.castShadow = true;
    platform.receiveShadow = true;
    root.add(platform);

    var stepMap = poscaTex(256, 64, 11, paintStep);
    function step(w, h, d, x, y, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: stepMap }));
      m.position.set(x, y, z);
      m.castShadow = true;
      root.add(m);
    }
    step(6.8, 0.16, 0.7, 0, 0.08, 3.56);
    step(6.8, 0.12, 0.62, 0, 0.03, 4.15);
    step(0.7, 0.16, 6.8, 3.56, 0.08, 0);
    step(0.62, 0.12, 6.8, 4.15, 0.03, 0);

    var barkMap = poscaTex(128, 256, 3, paintBark);
    var leafMap = poscaTex(256, 256, 9, paintLeaf);
    function makeTree(x, z) {
      var g = new THREE.Group();
      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.18, 1.65, 8),
        new THREE.MeshLambertMaterial({ map: barkMap })
      );
      trunk.position.y = 1.02;
      trunk.castShadow = true;
      g.add(trunk);
      var crownMat = new THREE.MeshLambertMaterial({ map: leafMap });
      [[0, 2.0, 0, 0.68], [-0.35, 1.9, 0.12, 0.48], [0.33, 1.92, -0.12, 0.52], [0.05, 2.38, 0.02, 0.44]].forEach(function (c) {
        var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(c[3], 1), crownMat);
        crown.position.set(c[0], c[1], c[2]);
        crown.castShadow = true;
        g.add(crown);
      });
      g.position.set(x, 0.36, z);
      root.add(g);
    }
    [[-2.75, -2.75], [2.75, -2.75], [-2.75, 2.75], [2.75, 2.75]].forEach(function (p) { makeTree(p[0], p[1]); });

    var cubeGroup = new THREE.Group();
    var cubeCols = [0xffe600, 0xff2d95, 0x00e5ff, 0x39ff14];
    cubeGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.25, 2.25, 2.25)),
      new THREE.LineBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.95 })
    ));
    var i, y, geo;
    for (i = -2; i <= 2; i++) {
      y = i * 0.34;
      geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1, y, -1), new THREE.Vector3(1, y, -1),
        new THREE.Vector3(1, y, -1), new THREE.Vector3(1, y, 1),
        new THREE.Vector3(1, y, 1), new THREE.Vector3(-1, y, 1),
        new THREE.Vector3(-1, y, 1), new THREE.Vector3(-1, y, -1)
      ]);
      cubeGroup.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: cubeCols[(i + 2) % cubeCols.length], transparent: true, opacity: 0.45 })));
    }
    cubeGroup.position.set(0, 2.35, 0);
    root.add(cubeGroup);

    var jackBill = null;
    var jackTex = null;
    var pet = document.createElement('canvas');
    pet.width = 96;
    pet.height = 96;
    if (window.Jack && Jack.Sprite && Jack.Sprite.attachPortrait) {
      Jack.Sprite.attachPortrait(pet);
      Jack.Sprite.setForm('sit');
      jackTex = new THREE.CanvasTexture(pet);
      jackTex.magFilter = THREE.NearestFilter;
      jackTex.minFilter = THREE.NearestFilter;
      jackBill = new THREE.Sprite(new THREE.SpriteMaterial({ map: jackTex, transparent: true }));
      jackBill.scale.set(1.35, 1.35, 1);
      jackBill.position.set(0, 1.15, 0.2);
      jackBill.userData.kind = 'jack';
      root.add(jackBill);
    } else {
      var jack = new THREE.Group();
      var jackMat = new THREE.MeshLambertMaterial({ color: 0x17233b });
      var jackTan = new THREE.MeshLambertMaterial({ color: 0xd9b36a });
      function vox(x, yy, z, sx, sy, sz, mat) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
        m.position.set(x, yy, z);
        m.castShadow = true;
        jack.add(m);
      }
      vox(0, 0.55, 0, 0.55, 0.7, 0.32, jackTan);
      vox(0, 1.07, 0, 0.68, 0.46, 0.34, jackMat);
      jack.position.set(0, 0.48, 0);
      jack.userData.kind = 'jack';
      root.add(jack);
      jackBill = jack;
    }

    var nerves = [];
    function nerveTo(x, z, color) {
      var a = new THREE.Vector3(0, 2.35, 0);
      var b = new THREE.Vector3(x, 2.15, z);
      var mid = a.clone().lerp(b, 0.5);
      mid.y += 1.1;
      var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      root.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
        new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.48 })
      ));
      var pulse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: color }));
      root.add(pulse);
      nerves.push({ curve: curve, pulse: pulse, t: Math.random() });
    }
    nerveTo(-2.75, -2.75, 0xff2d95);
    nerveTo(2.75, -2.75, 0xffe600);
    nerveTo(-2.75, 2.75, 0x39ff14);
    nerveTo(2.75, 2.75, 0x00e5ff);

    var glyphCols = [0xff2d95, 0xffe600, 0x00e5ff, 0x39ff14];
    [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].forEach(function (p, gi) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 8), new THREE.MeshBasicMaterial({ color: glyphCols[gi], side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p[0], 0.4, p[1]);
      root.add(ring);
    });

    var poles = [];
    var poleMap = poscaTex(64, 256, 42, paintPole);
    [['JOIN', -5.6, 0, 0xff3355], ['PLAY', 5.6, 0, 0x39ff14], ['ARCHIVE', 0, -5.1, 0xffe600], ['JACK', 0, 5.1, 0x00e5ff]].forEach(function (row) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), new THREE.MeshLambertMaterial({ map: poleMap, color: row[3] }));
      pole.position.set(row[1], 0.8, row[2]);
      pole.userData.kind = row[0].toLowerCase();
      root.add(pole);
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: row[3] }));
      orb.position.set(row[1], 1.65, row[2]);
      orb.userData.kind = row[0].toLowerCase();
      root.add(orb);
      poles.push(pole, orb);
    });

    var pickables = poles.concat([jackBill, platform, cubeGroup]);
    var ray = new THREE.Raycaster();
    var last = performance.now();

    function resize() {
      var r = wrap.getBoundingClientRect();
      var w = Math.max(1, r.width), h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    function pick(x, y) {
      var r = wrap.getBoundingClientRect();
      var ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(pickables, true);
      return hits.length ? hits[0].object : null;
    }

    function use(obj) {
      if (!obj) return;
      var kind = obj.userData.kind;
      var p = obj.parent;
      while (!kind && p) { kind = p.userData.kind; p = p.parent; }
      if (kind === 'jack' || kind === 'cube') {
        awake = true;
        $('cube') && $('cube').setAttribute('aria-pressed', 'true');
        status('JACK ONLINE / SQUARE LISTENING<br>CLICK JACK · ASK BELOW');
        $('askQ') && $('askQ').focus();
        if (window.Jack && Jack.Sprite && Jack.Sprite.setForm) Jack.Sprite.setForm('speak');
        if (window.JackVoice && JackVoice.unlock) JackVoice.unlock();
        var spoken = $('jackLine') ? String($('jackLine').textContent || '').replace(/^JACK:\s*/i, '') : '';
        if (spoken && window.JackVoice && JackVoice.say) JackVoice.say(spoken);
        return;
      }
      if (kind === 'join') {
        var join = $('join');
        if (join) join.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (kind === 'play') {
        orbitOn = !orbitOn;
        $('orbit') && $('orbit').setAttribute('aria-pressed', orbitOn ? 'true' : 'false');
        return;
      }
      if (kind === 'archive') {
        location.href = '/jack/map/';
      }
    }

    wrap.addEventListener('pointerdown', function (e) {
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      wrap.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      tyaw -= dx * 0.006;
      tpitch += dy * 0.004;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    wrap.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      if (moved < 10) use(pick(e.clientX, e.clientY));
    });
    wrap.addEventListener('wheel', function (e) {
      e.preventDefault();
      tdist += e.deltaY * 0.012;
    }, { passive: false });
    wrap.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (lastPinch) tdist += (lastPinch - d) * 0.02;
        lastPinch = d;
      }
    }, { passive: false });
    wrap.addEventListener('touchend', function () { lastPinch = 0; });

    $('home') && $('home').addEventListener('click', function () {
      tyaw = 0.82; tpitch = 0.55; tdist = 11.2;
    });
    $('orbit') && $('orbit').addEventListener('click', function () {
      orbitOn = !orbitOn;
      this.setAttribute('aria-pressed', orbitOn ? 'true' : 'false');
      this.textContent = orbitOn ? 'STOP ORBIT' : 'AUTO ORBIT';
    });
    $('cube') && $('cube').addEventListener('click', function () {
      awake = !awake;
      this.setAttribute('aria-pressed', awake ? 'true' : 'false');
      this.textContent = awake ? 'SLEEP CUBE' : 'WAKE CUBE';
      status(awake
        ? 'JACK ONLINE / SQUARE LISTENING<br>DRAG TO ORBIT · SCROLL / PINCH TO ZOOM'
        : 'JACK QUIET / HOPPER CLOSED<br>THE SQUARE REMAINS OPEN');
      if (awake && window.Jack && Jack.Sprite && Jack.Sprite.setForm) Jack.Sprite.setForm('speak');
    });
    $('night') && $('night').addEventListener('click', function () {
      nightMode = !nightMode;
      scene.background.setHex(nightMode ? 0x1a0a28 : 0x7ec8ff);
      sun.intensity = nightMode ? 1.85 : 2.6;
      this.setAttribute('aria-pressed', nightMode ? 'true' : 'false');
    });

    function frame(now) {
      requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (orbitOn) tyaw += dt * 0.12;
      applyCam();
      if (window.Jack && Jack.Sprite && Jack.Sprite.tick) {
        Jack.Sprite.tick(now / 1000, { context: { phase: awake ? 'VOICE' : 'SENSE' }, body: { pressure: awake ? 0.2 : 0.08 } });
        if (jackTex) jackTex.needsUpdate = true;
      }
      if (jackBill && jackBill.isSprite) jackBill.position.x = Math.sin(now * 0.0004) * 0.15;
      if (awake) {
        cubeGroup.rotation.y += dt * 0.18;
        cubeGroup.rotation.x = Math.sin(now * 0.00022) * 0.07;
        cubeGroup.position.y = 2.35 + Math.sin(now * 0.0012) * 0.06;
        nerves.forEach(function (n, idx) {
          n.t = (n.t + dt * (0.11 + idx * 0.018)) % 1;
          n.pulse.position.copy(n.curve.getPoint(n.t));
        });
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
    return true;
  }

  function boot() {
    bindTalk();
    bindJoin();
    if (!bootWorld()) status('SCHEMATIC UNAVAILABLE<br>JACK STILL TAKES QUESTIONS BELOW');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
