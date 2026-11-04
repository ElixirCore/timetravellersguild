/* Jack’s warehouse on fire. The lens sits behind Arianrhod. One aisle stays open. The other doors burn. */
(function () {
  'use strict';

  var stage = document.getElementById('stage');
  var fail = document.getElementById('fail');
  var formLine = document.getElementById('formLine');
  var coordRead = document.getElementById('coordRead');
  var hint = document.getElementById('hint');
  var endEl = document.getElementById('end');
  var endCopy = document.getElementById('endCopy');
  if (!stage || typeof THREE === 'undefined' || !window.Arianrhod) {
    if (fail) fail.hidden = false;
    return;
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var keys = { w: 0, a: 0, s: 0, d: 0, ' ': 0, q: 0 };
  var look = { x: 0, y: 0.2 };
  var inShed = false;
  var praying = false;
  var found = false;
  var psychic = 0;
  var psychicLine = 0;
  var analog = { drive: 0, steer: 0 };
  var heat = 0;
  var over = false;
  var escaped = false;
  var burning = false;
  var shrivel = 0;
  var spreadAt = 0;
  var syncLine = null;
  var walls = [];
  var floorCells = [];
  var fires = [];
  var fireMap = {};

  var COLS = 11;
  var ROWS = 11;
  var CELL = 1.85;
  var MAP = [];
  var LEVELS = [
    { title: 'THE YARD', cols: 11, rows: 11, seed: 5081, fireCap: 4, spread: 7.4, chance: 0.22, alcove: 6 },
    { title: 'THE SHED', cols: 15, rows: 15, seed: 7341, fireCap: 8, spread: 4.6, chance: 0.34, alcove: 4 },
    { title: 'THE KILN', cols: 17, rows: 17, seed: 2203, fireCap: 12, spread: 3.0, chance: 0.46, alcove: 3 }
  ];
  var levelIndex = 0;
  var levelTitle = LEVELS[0].title;
  var fireCap = LEVELS[0].fireCap;
  var spreadEvery = LEVELS[0].spread;
  var spreadChance = LEVELS[0].chance;
  var wallMeshes = [];
  var smoothDrive = 0;
  var smoothTurn = 0;

  function carveLabyrinth(seed) {
    function rand() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
    var grid = [];
    var r, c, d, nc, nr, i, j, t, dirs;
    for (r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (c = 0; c < COLS; c++) grid[r][c] = '#';
    }
    function carve(cc, rr) {
      grid[rr][cc] = '.';
      dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
      for (i = dirs.length - 1; i > 0; i--) {
        j = (rand() * (i + 1)) | 0;
        t = dirs[i];
        dirs[i] = dirs[j];
        dirs[j] = t;
      }
      for (d = 0; d < dirs.length; d++) {
        nc = cc + dirs[d][0];
        nr = rr + dirs[d][1];
        if (nc <= 0 || nr <= 0 || nc >= COLS - 1 || nr >= ROWS - 1) continue;
        if (grid[nr][nc] !== '#') continue;
        grid[rr + dirs[d][1] / 2][cc + dirs[d][0] / 2] = '.';
        carve(nc, nr);
      }
    }
    carve(1, 1);
    grid[1][1] = 'S';
    var exitC = COLS - (COLS % 2 === 0 ? 3 : 2);
    var exitR = ROWS - (ROWS % 2 === 0 ? 3 : 2);
    grid[exitR][exitC] = 'E';
    MAP = grid.map(function (row) { return row.join(''); });
  }

  function cellWorld(c, r) {
    return {
      x: (c - (COLS - 1) / 2) * CELL,
      z: (r - (ROWS - 1) / 2) * CELL
    };
  }
  function worldCell(x, z) {
    return {
      c: Math.round(x / CELL + (COLS - 1) / 2),
      r: Math.round(z / CELL + (ROWS - 1) / 2)
    };
  }
  function keyOf(c, r) { return c + ',' + r; }

  var start = { c: 1, r: 1 };
  var exitAt = COLS - (COLS % 2 === 0 ? 3 : 2);
  var exit = { c: exitAt, r: exitAt };
  var seeds = [];
  var reserved = {};
  var solution = [];

  function neighbors(c, r) {
    return [{ c: c + 1, r: r }, { c: c - 1, r: r }, { c: c, r: r + 1 }, { c: c, r: r - 1 }];
  }
  function setCell(c, r, ch) {
    var row = MAP[r].split('');
    row[c] = ch;
    MAP[r] = row.join('');
  }
  function ensureExit() {
    var q = [{ c: start.c, r: start.r }];
    var seen = {};
    var prev = {};
    var dist = {};
    var sk = keyOf(start.c, start.r);
    seen[sk] = true;
    dist[sk] = 0;
    var far = { c: start.c, r: start.r };
    var best = 0;
    var head = 0;
    var cur, n, nxt, k, d0, i;
    while (head < q.length) {
      cur = q[head++];
      d0 = dist[keyOf(cur.c, cur.r)];
      if (d0 > best) { best = d0; far = { c: cur.c, r: cur.r }; }
      n = neighbors(cur.c, cur.r);
      for (i = 0; i < n.length; i++) {
        nxt = n[i];
        if (nxt.r < 0 || nxt.r >= ROWS || nxt.c < 0 || nxt.c >= COLS) continue;
        if (MAP[nxt.r].charAt(nxt.c) === '#') continue;
        k = keyOf(nxt.c, nxt.r);
        if (seen[k]) continue;
        seen[k] = true;
        dist[k] = d0 + 1;
        prev[k] = cur;
        q.push(nxt);
      }
    }
    if (!seen[keyOf(exit.c, exit.r)]) {
      setCell(exit.c, exit.r, '#');
      exit = { c: far.c, r: far.r };
      setCell(exit.c, exit.r, 'E');
    }
    cur = { c: exit.c, r: exit.r };
    var chain = [];
    var guard = 0;
    while (cur && guard++ < 800) {
      chain.push({ c: cur.c, r: cur.r });
      reserved[keyOf(cur.c, cur.r)] = true;
      cur = prev[keyOf(cur.c, cur.r)];
    }
    solution = chain.reverse();
    var ai, acell, an, aj, alcove;
    var alcoveStep = (LEVELS[levelIndex] && LEVELS[levelIndex].alcove) || 4;
    for (ai = 4; ai < solution.length - 1; ai += alcoveStep) {
      acell = solution[ai];
      an = neighbors(acell.c, acell.r);
      for (aj = 0; aj < an.length; aj++) {
        alcove = an[aj];
        if (alcove.r <= 0 || alcove.r >= ROWS - 1 || alcove.c <= 0 || alcove.c >= COLS - 1) continue;
        if (MAP[alcove.r].charAt(alcove.c) !== '#') continue;
        setCell(alcove.c, alcove.r, '.');
        break;
      }
    }
  }

  function layMaze(spec) {
    COLS = spec.cols;
    ROWS = spec.rows;
    levelTitle = spec.title;
    fireCap = spec.fireCap;
    spreadEvery = spec.spread;
    spreadChance = spec.chance;
    seeds = [];
    reserved = {};
    solution = [];
    start = { c: 1, r: 1 };
    exitAt = COLS - (COLS % 2 === 0 ? 3 : 2);
    exit = { c: exitAt, r: exitAt };
    carveLabyrinth(spec.seed);
    ensureExit();
  }
  layMaze(LEVELS[0]);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7a7e74);
  scene.fog = new THREE.Fog(0x7a7e74, 4, 16);
  var camera = new THREE.PerspectiveCamera(58, 1, 0.06, 80);
  var renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = false;
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene.add(new THREE.AmbientLight(0xc8c2b0, 0.2));
  scene.add(new THREE.HemisphereLight(0xc5c8b4, 0x2a241c, 0.42));
  var key = new THREE.DirectionalLight(0xf4f6e4, 0.18);
  key.position.set(8, 22, 6);
  scene.add(key);
  var pinkRim = new THREE.DirectionalLight(0xff2bd6, 0.05);
  pinkRim.position.set(-6, 4, -8);
  scene.add(pinkRim);

  var tubes = [];
  var tubeMat = new THREE.MeshBasicMaterial({ color: 0xf4f7d4 });
  var fixtureMat = new THREE.MeshLambertMaterial({ color: 0xc8ccb4 });
  var gi, gj, gx, gz, tube, fixture, bulb;
  for (gi = 0; gi < 3; gi++) {
    for (gj = 0; gj < 3; gj++) {
      gx = (gi - 1) * (COLS * CELL / 3.2);
      gz = (gj - 1) * (ROWS * CELL / 3.2);
      fixture = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.12, 0.55), fixtureMat);
      fixture.position.set(gx, 12.4, gz);
      scene.add(fixture);
      tube = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.07, 0.22), tubeMat);
      tube.position.set(gx, 12.28, gz);
      scene.add(tube);
      bulb = new THREE.PointLight(0xe7e2c4, 0.95, 22, 1);
      bulb.position.set(gx, 11.9, gz);
      scene.add(bulb);
      tubes.push({ light: bulb, mesh: tube, fixture: fixture, base: 0.7, phase: gi * 3 + gj });
    }
  }

  function tex(draw, size, rx, ry) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function grit(g, s, n) {
    var i;
    for (i = 0; i < n; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.14) + ')';
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 5, 1 + Math.random() * 3);
    }
  }
  var concrete = tex(function (g, s) {
    g.fillStyle = '#6a5a48';
    g.fillRect(0, 0, s, s);
    var i;
    for (i = 0; i < 36; i++) {
      g.fillStyle = i % 2 ? '#5a4c3c' : '#7a6a56';
      g.fillRect(Math.random() * s, Math.random() * s, 16 + Math.random() * 36, 8 + Math.random() * 24);
    }
    grit(g, s, 180);
  }, 256, 12, 12);
  var rust = tex(function (g, s) {
    g.fillStyle = '#2a2420';
    g.fillRect(0, 0, s, s);
    var y, i;
    for (y = 0; y < s; y += 7) {
      g.fillStyle = y % 14 === 0 ? '#3a322c' : '#221e1a';
      g.fillRect(0, y, s, 5);
    }
    for (i = 0; i < 28; i++) {
      g.fillStyle = 'rgba(150,60,20,' + (0.18 + Math.random() * 0.3) + ')';
      g.beginPath();
      g.arc(Math.random() * s, Math.random() * s, 5 + Math.random() * 14, 0, Math.PI * 2);
      g.fill();
    }
    grit(g, s, 70);
  }, 256, 2, 2);
  var timber = tex(function (g, s) {
    var y;
    for (y = 0; y < s; y++) {
      g.fillStyle = y % 17 < 2 ? '#4a2e18' : (y % 3 ? '#6a4224' : '#5a361c');
      g.fillRect(0, y, s, 1);
    }
    grit(g, s, 40);
  }, 128, 1, 2);

  var wallMat = new THREE.MeshLambertMaterial({ map: rust, color: 0x5c574f });
  var floorMat = new THREE.MeshLambertMaterial({ map: concrete, color: 0x7a6c5c });
  var crateMat = new THREE.MeshLambertMaterial({ map: timber, color: 0x6a5340 });
  function flameMat(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }
  var fireMat = flameMat(0xff3c08, 0.55);
  var midMat = flameMat(0xffb020, 0.7);
  var coreMat = flameMat(0xfff4d2, 0.9);
  var glowTex = (function () {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(32, 42, 1, 32, 34, 30);
    grd.addColorStop(0, 'rgba(255,248,220,0.95)');
    grd.addColorStop(0.22, 'rgba(255,170,40,0.55)');
    grd.addColorStop(0.5, 'rgba(255,50,0,0.18)');
    grd.addColorStop(1, 'rgba(40,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  })();
  var glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xfff2d0,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });

  var floor = new THREE.Mesh(new THREE.PlaneGeometry(COLS * CELL, ROWS * CELL), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  var WALL_H = 1.7;
  var wallDummy = new THREE.Object3D();
  function buildWalls() {
    walls = [];
    floorCells = [];
    var rustWalls = [];
    var crateWalls = [];
    var r, c, ch, p;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        ch = MAP[r].charAt(c);
        if (ch === 'S') start = { c: c, r: r };
        if (ch === 'E') exit = { c: c, r: r };
        if (ch === '#') {
          p = cellWorld(c, r);
          walls.push({ x: p.x, z: p.z, hw: CELL * 0.4, hd: CELL * 0.4 });
          ((c + r) % 2 ? rustWalls : crateWalls).push(p);
        } else floorCells.push({ c: c, r: r });
      }
    }
    function stampWalls(list, mat) {
      if (!list.length) return;
      var inst = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.8, WALL_H, CELL * 0.8), mat, list.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      var i, pos;
      for (i = 0; i < list.length; i++) {
        pos = list[i];
        wallDummy.position.set(pos.x, WALL_H / 2, pos.z);
        wallDummy.updateMatrix();
        inst.setMatrixAt(i, wallDummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);
      wallMeshes.push(inst);
    }
    stampWalls(rustWalls, wallMat);
    stampWalls(crateWalls, crateMat);
  }
  buildWalls();

  var p = cellWorld(exit.c, exit.r);
  var exitLight = new THREE.PointLight(0xf2d322, 1.8, 9, 2);
  exitLight.position.set(p.x, 1.5, p.z);
  scene.add(exitLight);
  var exitMark = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 16),
    new THREE.MeshBasicMaterial({ color: 0xf2d322, side: THREE.DoubleSide })
  );
  exitMark.rotation.x = -Math.PI / 2;
  exitMark.position.set(p.x, 0.03, p.z);
  scene.add(exitMark);
  function placeExit() {
    var at = cellWorld(exit.c, exit.r);
    exitLight.position.set(at.x, 1.5, at.z);
    exitMark.position.set(at.x, 0.03, at.z);
  }
  function fitFloor() {
    floor.geometry.dispose();
    floor.geometry = new THREE.PlaneGeometry(COLS * CELL, ROWS * CELL);
  }
  function placeTubes() {
    var i = 0, gi, gj, gx, gz;
    for (gi = 0; gi < 3; gi++) {
      for (gj = 0; gj < 3; gj++) {
        gx = (gi - 1) * (COLS * CELL / 3.2);
        gz = (gj - 1) * (ROWS * CELL / 3.2);
        if (!tubes[i]) return;
        tubes[i].light.position.set(gx, 11.9, gz);
        tubes[i].mesh.position.set(gx, 12.28, gz);
        if (tubes[i].fixture) tubes[i].fixture.position.set(gx, 12.4, gz);
        i++;
      }
    }
  }
  function clearStorey() {
    if (syncLine) {
      scene.remove(syncLine);
      syncLine.geometry.dispose();
      syncLine = null;
    }
    fires.forEach(function (f) { scene.remove(f.mesh); });
    fires = [];
    fireMap = {};
    wallMeshes.forEach(function (m) {
      scene.remove(m);
      if (m.geometry) m.geometry.dispose();
    });
    wallMeshes = [];
    walls = [];
    floorCells = [];
  }
  function idleLine() {
    return 'LEVEL ' + (levelIndex + 1) + ' · ' + levelTitle;
  }
  function enterLevel(index) {
    levelIndex = index;
    clearStorey();
    layMaze(LEVELS[levelIndex]);
    seedFires();
    buildWalls();
    fitFloor();
    placeTubes();
    placeExit();
    spawn = cellWorld(start.c, start.r);
    if (spider) {
      spider.root.position.set(spawn.x, 0, spawn.z);
      spider.root.scale.set(1, 1, 1);
      faceOpenAisle();
      spider.update(0.016, { vx: 0, vz: 0, facing: spider.getYaw(), pray: false, reduced: true, shrivel: 0 });
    }
    heat = 0;
    spreadAt = 0;
    smoothDrive = 0;
    smoothTurn = 0;
    resetFire();
    if (formLine) formLine.textContent = idleLine();
  }

  function ignite(c, r) {
    var k = keyOf(c, r);
    if (fireMap[k] || !canIgnite(c, r)) return;
    var w = cellWorld(c, r);
    var g = new THREE.Group();
    var outer = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.55, 7), fireMat);
    outer.position.y = 0.78;
    g.add(outer);
    var mid = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.15, 6), midMat);
    mid.position.y = 0.62;
    g.add(mid);
    var core = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.72, 5), coreMat);
    core.position.y = 0.42;
    g.add(core);
    var sprite = new THREE.Sprite(glowMat);
    sprite.position.y = 0.85;
    sprite.scale.set(1.35, 1.9, 1);
    g.add(sprite);
    var glow = null;
    if (fires.length < 8) {
      glow = new THREE.PointLight(0xff5a12, 4.2, 9, 2);
      glow.position.y = 0.7;
      g.add(glow);
    }
    g.position.set(w.x, 0, w.z);
    scene.add(g);
    fireMap[k] = { c: c, r: r, mesh: g, outer: outer, mid: mid, core: core, sprite: sprite, glow: glow, age: 0 };
    fires.push(fireMap[k]);
  }

  function resetFire() {
    fires.forEach(function (f) { scene.remove(f.mesh); });
    fires = [];
    fireMap = {};
    seeds.forEach(function (s) { ignite(s.c, s.r); });
  }

  function walkable(c, r, extraFire) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    if (MAP[r].charAt(c) === '#') return false;
    if (fireMap[keyOf(c, r)]) return false;
    if (extraFire && extraFire[keyOf(c, r)]) return false;
    return true;
  }

  function hasPath(from, to, extraFire) {
    var q = [from];
    var seen = {};
    seen[keyOf(from.c, from.r)] = true;
    var i, cur, n, nxt, k;
    while (q.length) {
      cur = q.shift();
      if (cur.c === to.c && cur.r === to.r) return true;
      n = neighbors(cur.c, cur.r);
      for (i = 0; i < n.length; i++) {
        nxt = n[i];
        k = keyOf(nxt.c, nxt.r);
        if (seen[k] || !walkable(nxt.c, nxt.r, extraFire)) continue;
        seen[k] = true;
        q.push(nxt);
      }
    }
    return false;
  }

  function seedFires() {
    seeds = [];
    var mouths = [];
    var seenMouth = {};
    var i, cell, n, j, nxt, k, head, cur, depth, q, d0;
    for (i = 2; i < solution.length; i++) {
      cell = solution[i];
      n = neighbors(cell.c, cell.r);
      for (j = 0; j < n.length; j++) {
        nxt = n[j];
        if (nxt.r < 0 || nxt.r >= ROWS || nxt.c < 0 || nxt.c >= COLS) continue;
        if (MAP[nxt.r].charAt(nxt.c) === '#') continue;
        k = keyOf(nxt.c, nxt.r);
        if (reserved[k] || seenMouth[k]) continue;
        seenMouth[k] = true;
        mouths.push({ c: nxt.c, r: nxt.r });
      }
    }
    q = [];
    var dist = {};
    for (i = 0; i < mouths.length; i++) {
      k = keyOf(mouths[i].c, mouths[i].r);
      dist[k] = 1;
      q.push(mouths[i]);
      if (Math.abs(mouths[i].c - start.c) + Math.abs(mouths[i].r - start.r) < 3) continue;
      seeds.push({ c: mouths[i].c, r: mouths[i].r });
    }
    head = 0;
    while (head < q.length && seeds.length < fireCap) {
      cur = q[head++];
      d0 = dist[keyOf(cur.c, cur.r)];
      n = neighbors(cur.c, cur.r);
      for (j = 0; j < n.length; j++) {
        nxt = n[j];
        if (nxt.r < 0 || nxt.r >= ROWS || nxt.c < 0 || nxt.c >= COLS) continue;
        if (MAP[nxt.r].charAt(nxt.c) === '#') continue;
        k = keyOf(nxt.c, nxt.r);
        if (reserved[k] || dist[k]) continue;
        depth = d0 + 1;
        dist[k] = depth;
        q.push(nxt);
        if (depth % 2 === 0 && seeds.length < fireCap && Math.abs(nxt.c - start.c) + Math.abs(nxt.r - start.r) >= 3) {
          seeds.push({ c: nxt.c, r: nxt.r });
        }
      }
    }
  }
  seedFires();

  function canIgnite(c, r) {
    if (reserved[keyOf(c, r)]) return false;
    if ((c === start.c && r === start.r) || (c === exit.c && r === exit.r)) return false;
    if (MAP[r] && MAP[r].charAt(c) === '#') return false;
    var extra = {};
    extra[keyOf(c, r)] = true;
    return hasPath(start, exit, extra);
  }

  function spreadFire() {
    var live = fires.slice();
    var i, n, j, cell;
    for (i = 0; i < live.length; i++) {
      n = neighbors(live[i].c, live[i].r);
      for (j = 0; j < n.length; j++) {
        cell = n[j];
        if (!canIgnite(cell.c, cell.r)) continue;
        if (Math.random() < spreadChance) ignite(cell.c, cell.r);
      }
    }
  }

  var lens = Arianrhod.Lens && Arianrhod.Lens.attach
    ? Arianrhod.Lens.attach(THREE, renderer, scene, camera, { reduced: reduced })
    : null;

  var spider = Arianrhod.buildBody(THREE);
  var spawn = cellWorld(start.c, start.r);
  spider.root.position.set(spawn.x, 0, spawn.z);
  scene.add(spider.root);
  var bodyLight = new THREE.PointLight(0xffe4c4, 0.55, 4.2, 1);
  bodyLight.position.set(0, 0.55, 0.1);
  spider.root.add(bodyLight);
  function faceOpenAisle() {
    if (solution.length < 2) return;
    var here = cellWorld(solution[0].c, solution[0].r);
    var next = cellWorld(solution[1].c, solution[1].r);
    spider.setYaw(Math.atan2(next.x - here.x, next.z - here.z));
  }
  faceOpenAisle();

  var psychicEl = document.createElement('p');
  psychicEl.id = 'psychic';
  psychicEl.hidden = true;
  document.body.appendChild(psychicEl);
  var LINES = [
    'I was behind the lens.',
    'The join is the aisle that is not yet burning.',
    'Jack overheated. Post yourself to the cube.'
  ];

  function sayPsychic(text) {
    psychicEl.hidden = false;
    psychicEl.textContent = 'MABEL — ' + text;
    formLine.textContent = 'MABEL IS SPEAKING';
    document.body.classList.add('mabel-out');
    psychic = 6;
  }

  function discover() {
    if (found) return;
    found = true;
    psychicLine = 1;
    sayPsychic(LINES[0]);
  }

  function blocked(nx, nz) {
    var i, w;
    for (i = 0; i < walls.length; i++) {
      w = walls[i];
      if (Math.abs(nx - w.x) < w.hw + 0.28 && Math.abs(nz - w.z) < w.hd + 0.28) return true;
    }
    return false;
  }

  function inFire(x, z) {
    var cell = worldCell(x, z);
    return !!fireMap[keyOf(cell.c, cell.r)];
  }

  function fireNear(x, z) {
    var best = 99;
    var i, w;
    for (i = 0; i < fires.length; i++) {
      w = cellWorld(fires[i].c, fires[i].r);
      best = Math.min(best, Math.hypot(x - w.x, z - w.z));
    }
    return best;
  }

  function atExit(x, z) {
    var e = cellWorld(exit.c, exit.r);
    return Math.hypot(x - e.x, z - e.z) < CELL * 0.42;
  }

  function pathTowardExit(x, z) {
    var startCell = worldCell(x, z);
    var q = [startCell];
    var seen = {};
    seen[keyOf(startCell.c, startCell.r)] = true;
    var prev = {};
    var i, cur, n, k, nxt;
    while (q.length) {
      cur = q.shift();
      if (cur.c === exit.c && cur.r === exit.r) break;
      n = neighbors(cur.c, cur.r);
      for (i = 0; i < n.length; i++) {
        nxt = n[i];
        if (nxt.r < 0 || nxt.r >= ROWS || nxt.c < 0 || nxt.c >= COLS) continue;
        if (MAP[nxt.r].charAt(nxt.c) === '#') continue;
        if (fireMap[keyOf(nxt.c, nxt.r)]) continue;
        k = keyOf(nxt.c, nxt.r);
        if (seen[k]) continue;
        seen[k] = true;
        prev[k] = cur;
        q.push(nxt);
      }
    }
    var chain = [];
    cur = { c: exit.c, r: exit.r };
    if (!prev[keyOf(cur.c, cur.r)] && !(cur.c === startCell.c && cur.r === startCell.r)) return [];
    while (cur) {
      chain.push(cellWorld(cur.c, cur.r));
      cur = prev[keyOf(cur.c, cur.r)];
    }
    return chain.reverse();
  }

  function finish(won) {
    over = true;
    escaped = !!won;
    if (won) {
      try { sessionStorage.setItem('ttg.arianrhod.posted', '1'); } catch (e) {}
    }
    if (endEl) endEl.hidden = false;
    if (endCopy) {
      endCopy.textContent = won
        ? 'JACK OVERHEATED. THE WAREHOUSE IS GONE.'
        : 'THE AISLE IS STILL OPEN. TRY AGAIN.';
    }
    var post = document.getElementById('postCube');
    if (post) post.hidden = !won;
    formLine.textContent = won ? 'SHE POSTS HERSELF TO THE CUBE' : 'STILL POSSIBLE';
  }

  function beginAgain() {
    burning = false;
    shrivel = 0;
    heat = 0;
    over = false;
    escaped = false;
    if (endEl) endEl.hidden = true;
    spider.root.position.set(spawn.x, 0, spawn.z);
    spider.root.scale.set(1, 1, 1);
    faceOpenAisle();
    spider.update(0.016, { vx: 0, vz: 0, facing: 0, pray: false, reduced: true, shrivel: 0 });
    resetFire();
    formLine.textContent = idleLine();
  }

  function restart() {
    if (escaped) enterLevel(0);
    else beginAgain();
    escaped = false;
    over = false;
    if (endEl) endEl.hidden = true;
    formLine.textContent = idleLine();
  }

  function catchFire() {
    if (burning || over) return;
    burning = true;
    shrivel = 0;
    formLine.textContent = 'SHE SHRIVELS. SHE IS IMMORTAL.';
  }

  function size() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (lens && lens.resize) lens.resize(w, h);
  }
  size();
  window.addEventListener('resize', size);

  function setKey(k, on) {
    k = String(k).toLowerCase();
    if (k === 'arrowup') k = 'w';
    if (k === 'arrowleft') k = 'a';
    if (k === 'arrowdown') k = 's';
    if (k === 'arrowright') k = 'd';
    if (k in keys) keys[k] = on ? 1 : 0;
    if (k === 'q' && on && inShed && !over) discover();
    if (k === ' ' && on) praying = true;
    if (k === ' ' && !on) praying = false;
    document.body.classList.toggle('praying', praying);
    var btn = document.querySelector('#prayBtn[data-k="' + (k === ' ' ? ' ' : k) + '"], #behindBtn[data-k="' + k + '"]');
    if (btn) btn.classList.toggle('on', !!on);
  }

  window.addEventListener('keydown', function (e) {
    if (!inShed) return;
    if (e.key.toLowerCase() === 'r' && over) { e.preventDefault(); restart(); return; }
    if (['w', 'a', 's', 'd', ' ', 'q'].indexOf(e.key.toLowerCase()) >= 0 || e.key.indexOf('Arrow') === 0) {
      e.preventDefault();
      setKey(e.key, true);
    }
  });
  window.addEventListener('keyup', function (e) {
    setKey(e.key, false);
  });

  var steerPtr = null;
  var steerOrigin = null;
  var stickEl = document.createElement('div');
  stickEl.id = 'pointerStick';
  stickEl.hidden = true;
  stickEl.innerHTML = '<i></i>';
  document.body.appendChild(stickEl);

  var thumb = document.getElementById('thumb');
  var knob = document.getElementById('thumbKnob');
  var thumbPtr = null;
  function setAnalog(dx, dy, maxR) {
    var len = Math.hypot(dx, dy);
    if (len > maxR && maxR > 0) {
      dx *= maxR / len;
      dy *= maxR / len;
      len = maxR;
    }
    analog.steer = len < 8 ? 0 : dx / maxR;
    analog.drive = len < 8 ? 0 : -(dy / maxR);
    if (knob && thumbPtr != null) knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    var pip = stickEl.querySelector('i');
    if (pip && steerPtr != null) pip.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  function clearAnalog() {
    analog.drive = 0;
    analog.steer = 0;
    thumbPtr = null;
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
  }
  function clearSteer() {
    steerPtr = null;
    steerOrigin = null;
    stickEl.hidden = true;
    var pip = stickEl.querySelector('i');
    if (pip) pip.style.transform = '';
    if (thumbPtr == null) {
      analog.drive = 0;
      analog.steer = 0;
    }
  }
  stage.addEventListener('pointerdown', function (e) {
    if (!inShed || over || burning) return;
    if (e.target.closest('#thumb, #prayBtn, #behindBtn, #dock, a, button')) return;
    if (e.button != null && e.button !== 0) return;
    steerPtr = e.pointerId;
    steerOrigin = { x: e.clientX, y: e.clientY };
    stage.setPointerCapture(e.pointerId);
    stickEl.hidden = false;
    stickEl.style.left = e.clientX + 'px';
    stickEl.style.top = e.clientY + 'px';
    setAnalog(0, 0, 86);
  });
  stage.addEventListener('pointermove', function (e) {
    if (steerPtr !== e.pointerId || !steerOrigin) return;
    e.preventDefault();
    setAnalog(e.clientX - steerOrigin.x, e.clientY - steerOrigin.y, 86);
  });
  stage.addEventListener('pointerup', function (e) {
    if (steerPtr === e.pointerId) clearSteer();
  });
  stage.addEventListener('pointercancel', function (e) {
    if (steerPtr === e.pointerId) clearSteer();
  });
  if (thumb) {
    thumb.addEventListener('pointerdown', function (e) {
      if (!inShed) return;
      e.preventDefault();
      e.stopPropagation();
      thumb.setPointerCapture(e.pointerId);
      thumbPtr = e.pointerId;
      var r = thumb.getBoundingClientRect();
      setAnalog(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width * 0.38);
    });
    thumb.addEventListener('pointermove', function (e) {
      if (thumbPtr !== e.pointerId) return;
      e.preventDefault();
      var r = thumb.getBoundingClientRect();
      setAnalog(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width * 0.38);
    });
    thumb.addEventListener('pointerup', function (e) {
      if (thumbPtr === e.pointerId) clearAnalog();
    });
    thumb.addEventListener('pointercancel', clearAnalog);
  }
  ['prayBtn', 'behindBtn'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setKey(btn.getAttribute('data-k'), true);
    });
    btn.addEventListener('pointerup', function () { setKey(btn.getAttribute('data-k'), false); });
    btn.addEventListener('pointerleave', function () { setKey(btn.getAttribute('data-k'), false); });
  });

  document.getElementById('slipClose').addEventListener('click', function () {
    inShed = true;
    document.body.classList.add('in-shed');
    resetFire();
    chaseCam(1);
    if (hint) hint.textContent = 'DRAG THE WAY SHE SHOULD GO · ARROWS · SPACE READS THE AISLE';
    formLine.textContent = idleLine();
  });
  var again = document.getElementById('again');
  if (again) again.addEventListener('click', restart);

  function chaseCam(dt) {
    var yaw = spider.getYaw() + look.x * 0.55;
    var dist = 2.15;
    var height = 0.78 + look.y * 0.16;
    var fx = Math.sin(yaw);
    var fz = Math.cos(yaw);
    while (dist > 0.5 && blocked(
      spider.root.position.x - fx * dist,
      spider.root.position.z - fz * dist
    )) dist -= 0.18;
    var want = new THREE.Vector3(
      spider.root.position.x - fx * dist,
      height,
      spider.root.position.z - fz * dist
    );
    camera.position.lerp(want, reduced ? 1 : 0.16);
    camera.lookAt(
      spider.root.position.x + fx * 0.9,
      0.22,
      spider.root.position.z + fz * 0.9
    );
  }

  var last = performance.now();
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var i, f;
    for (i = 0; i < fires.length; i++) {
      f = fires[i];
      f.age += dt;
      if (!reduced) {
        var flick = 0.82 + Math.sin(now * 0.017 + i * 1.7) * 0.18 + Math.sin(now * 0.041 + i) * 0.08;
        if (f.outer) {
          f.outer.scale.y = flick;
          f.outer.rotation.y += dt * 1.6;
        }
        if (f.mid) {
          f.mid.scale.y = 0.9 + Math.sin(now * 0.023 + i) * 0.2;
          f.mid.rotation.y -= dt * 2.2;
        }
        if (f.core) f.core.scale.y = 0.75 + Math.sin(now * 0.031 + i * 0.6) * 0.25;
        if (f.sprite) f.sprite.scale.set(1.2 + flick * 0.25, 1.7 + flick * 0.35, 1);
        if (f.glow) f.glow.intensity = 3.2 + flick * 2.2;
      }
    }
    var t = now * 0.001;
    for (i = 0; i < tubes.length; i++) {
      var tube = tubes[i];
      var flicker = 1;
      if (!reduced) {
        flicker = 0.86 + Math.sin(t * 41 + tube.phase) * Math.sin(t * 9.2 + tube.phase * 0.7) * 0.08;
        if (((Math.sin(t * 0.63 + tube.phase * 1.7) + 1) * 0.5) > 0.97) flicker *= 0.42;
      }
      tube.light.intensity = tube.base * flicker;
    }
    if (inShed && !over) {
      if (burning) {
        shrivel = Math.min(1, shrivel + dt * (reduced ? 2.4 : 1.15));
        spider.update(dt, { vx: 0, vz: 0, pray: true, reduced: reduced, shrivel: shrivel });
        chaseCam(dt);
        formLine.textContent = 'SHE SHRIVELS. SHE IS IMMORTAL.';
        if (shrivel >= 1) beginAgain();
      } else {
      var drive = Math.max(-1, Math.min(1, analog.drive + keys.w - keys.s));
      var turn = Math.max(-1, Math.min(1, analog.steer + keys.d - keys.a));
      smoothDrive += (drive - smoothDrive) * Math.min(1, dt * 9);
      smoothTurn += (turn - smoothTurn) * Math.min(1, dt * 12);
      var facing = spider.getYaw() + smoothTurn * 3.1 * dt;
      var forward = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
      var wish = new THREE.Vector3();
      if (!praying) wish.copy(forward).multiplyScalar(smoothDrive * 2.65 * dt);
      var nx = spider.root.position.x + wish.x;
      var nz = spider.root.position.z + wish.z;
      if (blocked(nx, spider.root.position.z)) nx = spider.root.position.x;
      if (blocked(nx, nz)) nz = spider.root.position.z;
      spider.update(dt, {
        vx: nx - spider.root.position.x,
        vz: nz - spider.root.position.z,
        facing: facing,
        pray: praying,
        reduced: reduced,
        lookX: Math.sin(look.x),
        lookY: 0.05
      });
      chaseCam(dt);

      var near = fireNear(spider.root.position.x, spider.root.position.z);
      if (inFire(spider.root.position.x, spider.root.position.z)) catchFire();
      else if (near < 1.05) heat = Math.min(1, heat + dt * (1.05 - near) * 2.2);
      else heat = Math.max(0, heat - dt * 0.42);
      if (heat >= 1) catchFire();
      var warm = heat;
      scene.fog.color.setRGB(0.48 + warm * 0.38, 0.46 - warm * 0.14, 0.40 - warm * 0.2);
      scene.background.copy(scene.fog.color);

      spreadAt += dt;
      if (spreadAt > spreadEvery) {
        spreadAt = 0;
        if (!reduced) spreadFire();
        else if (fires.length < 8) spreadFire();
      }

      if (praying) {
        formLine.textContent = 'SHE READS THE AISLE THAT IS NOT YET BURNING';
        if (!syncLine) {
          var path = pathTowardExit(spider.root.position.x, spider.root.position.z);
          if (path.length > 1) {
            var pts = path.map(function (n) { return new THREE.Vector3(n.x, 0.16, n.z); });
            syncLine = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(pts),
              new THREE.LineBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.85 })
            );
            scene.add(syncLine);
          }
        }
      } else if (syncLine) {
        scene.remove(syncLine);
        syncLine = null;
        if (!found) formLine.textContent = idleLine();
      }

      if (found && psychicLine === 1 && psychic < 4.2) {
        psychicLine = 2;
        sayPsychic(LINES[1]);
      }
      if (found && psychicLine === 2 && psychic < 4.2) {
        psychicLine = 3;
        sayPsychic(LINES[2]);
      }
      if (psychic > 0) {
        psychic -= dt;
        if (psychic <= 0) psychicEl.hidden = true;
      }

      if (!burning && atExit(spider.root.position.x, spider.root.position.z)) {
        if (levelIndex < LEVELS.length - 1) enterLevel(levelIndex + 1);
        else finish(true);
      }

      var cell = worldCell(spider.root.position.x, spider.root.position.z);
      coordRead.textContent = 'L' + (levelIndex + 1) + ' HEAT ' + String(Math.round((burning ? shrivel : heat) * 100)).padStart(2, '0') +
        ' · COL ' + cell.c + ' · ROW ' + cell.r +
        (escaped ? ' · OUT' : (burning ? ' · SHRIVEL' : (found ? ' · MABEL OUT' : ' · ' + levelTitle)));
      }
    } else {
      chaseCam(dt);
      spider.update(reduced ? 0 : 0.016, { vx: 0, vz: 0, pray: false, reduced: true });
    }
    if (lens && lens.setAmount) lens.setAmount(reduced ? 0 : 0.0016 + heat * 0.003);
    if (lens && lens.render) lens.render(now * 0.001);
    else renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
