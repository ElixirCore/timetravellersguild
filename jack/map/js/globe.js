/* Earth + tetra lattice + postal nerves. No fabricated live traffic. */
(function (M) {
  'use strict';

  var R = 1.0;
  var PAPER = 0xe8d2a4;
  var NAVY = 0x1e3a5f;
  var SCARLET = 0xc41e3a;
  var GOLD = 0xc9a227;
  var INK = 0x1a2438;
  var DIM = 0x7a6f58;

  var ANATOMY = {
    HEAD: NAVY,
    HEART: SCARLET,
    SPINE: GOLD,
    LUNG: 0xb2533e,
    HAND: NAVY,
    LEG: DIM,
    'COLD ARCHIVE': INK,
    'PUBLIC RELAY': GOLD,
    'FIELD NODE': SCARLET,
    MIRROR: 0x638B94,
    IMMUNE: 0x3a4a1a,
    MEMORY: 0xb2533e
  };

  var NERVE = {
    sensory: NAVY,
    motor: SCARLET,
    association: GOLD,
    memory: 0x8a7348,
    autonomic: DIM,
    reflex: SCARLET,
    scar: 0x9a8b70,
    phantom: 0x9a8b70
  };

  var LAND = [
    [[70,-20],[66,-18],[62,-7],[59,10],[70,25],[71,52],[66,40],[60,5],[54,8],[51,-4],[48,-4],[43,-9],[36,-6],[36,-5],[28,-13],[14,-17],[5,-4],[0,9],[-5,12],[-15,12],[-22,14],[-28,18],[-34,18],[-35,26],[-28,32],[-22,38],[-15,40],[-5,40],[4,47],[12,43],[22,38],[30,32],[34,28],[10,50],[-20,50],[-34,18]],
    [[71,-8],[58,-5],[51,-4],[48,-1],[43,-2],[36,-5],[43,2],[50,5],[54,10],[60,5],[66,-2]],
    [[36,-5],[31,35],[28,48],[25,55],[22,70],[15,74],[8,78],[3,73],[12,45],[22,38],[28,32],[34,28],[36,20],[36,-5]],
    [[8,78],[-2,102],[8,120],[20,140],[30,130],[45,142],[60,160],[70,170],[75,140],[70,100],[62,80],[54,73],[36,138],[22,114],[8,98]],
    [[-12,130],[-28,140],[-38,146],[-32,152],[-15,150],[-12,130]],
    [[83,-75],[70,-70],[60,-45],[55,-80],[65,-120],[72,-165],[68,170],[62,140],[70,100],[80,20],[83,-40]],
    [[15,-16],[5,-4],[-5,5],[-15,12],[-22,14],[-28,18],[-34,18],[-30,10],[-20,12],[-5,10],[5,-8],[15,-16]],
    [[12,-16],[4,-8],[-5,8],[-15,12],[-28,14],[-34,18],[-28,32],[-15,40],[4,47],[12,43],[22,14],[15,-8]],
    [[72,-80],[68,-140],[60,-165],[55,170],[50,140],[55,100],[62,80],[70,-40],[72,-80]],
    [[50,-128],[42,-124],[32,-116],[25,-110],[18,-100],[15,-90],[25,-80],[35,-90],[48,-124]],
    [[10,-80],[-5,-75],[-20,-70],[-35,-73],[-50,-75],[-55,-70],[-22,-40],[-2,-50],[8,-60],[10,-80]],
    [[12,-70],[5,-55],[-10,-40],[-20,-45],[-5,-70],[12,-70]],
    [[-15,-70],[-35,-58],[-50,-70],[-55,-80],[-40,-75],[-22,-70]],
    [[-55,-70],[-50,-58],[-35,-58],[-22,-40],[-10,-40],[0,-50],[-15,-70]],
    [[8,-78],[-55,-68],[-55,-80],[-20,-75],[8,-78]]
  ];

  var scene, camera, renderer, root, tetraGroup, nodeGroup, nerveGroup, labelLayer;
  var pickables = [];
  var dragging = false;
  var lastX = 0, lastY = 0, lastDist = 0;
  var yaw = 0.85, pitch = 0.35, dist = 3.4;
  var target = { yaw: 0.85, pitch: 0.35, dist: 3.4 };
  var hoverId = null;
  var selectedId = null;
  var lit = {};
  var at = '9999-12-31';
  var onPick = null;
  var topology = null;
  var robotPos = null;

  function $(id) { return document.getElementById(id); }

  function vec3(v) {
    return new THREE.Vector3(v[0], v[1], v[2]);
  }

  function geoPos(lat, lon, r) {
    var v = M.Tetra.latLonToVec(lat, lon);
    return new THREE.Vector3(v[0], v[1], v[2]).multiplyScalar(r || R);
  }

  function anatomyColor(name) {
    return ANATOMY[String(name || '').toUpperCase()] || NAVY;
  }

  function visibleAt(obj) {
    var created = obj.created || '0000-01-01';
    return created <= at;
  }

  function buildLand() {
    var g = new THREE.Group();
    var i, j, ring, pts, geo, line, lat, lon;
    var grid = new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.12 });
    for (lat = -60; lat <= 60; lat += 30) {
      pts = [];
      for (lon = -180; lon <= 180; lon += 10) pts.push(geoPos(lat, lon, R + 0.002));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), grid));
    }
    for (lon = -180; lon < 180; lon += 30) {
      pts = [];
      for (lat = -80; lat <= 80; lat += 10) pts.push(geoPos(lat, lon, R + 0.002));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), grid));
    }
    for (i = 0; i < LAND.length; i++) {
      ring = LAND[i];
      pts = [];
      for (j = 0; j < ring.length; j++) pts.push(geoPos(ring[j][0], ring[j][1], R + 0.004));
      geo = new THREE.BufferGeometry().setFromPoints(pts);
      line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.55 }));
      g.add(line);
    }
    return g;
  }

  function buildTetra(depth) {
    if (tetraGroup) root.remove(tetraGroup);
    tetraGroup = new THREE.Group();
    var faces = M.Tetra.facesAtDepth(depth);
    var i, f, a, b, c, pts, geo;
    var mat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22 });
    for (i = 0; i < faces.length; i++) {
      f = faces[i];
      a = vec3(f.a).multiplyScalar(R * 1.02);
      b = vec3(f.b).multiplyScalar(R * 1.02);
      c = vec3(f.c).multiplyScalar(R * 1.02);
      pts = [a, b, c, a];
      geo = new THREE.BufferGeometry().setFromPoints(pts);
      tetraGroup.add(new THREE.Line(geo, mat));
    }
    root.add(tetraGroup);
  }

  function arcPoints(a, b, lift) {
    var pts = [];
    var i, t, p;
    var n = 28;
    for (i = 0; i <= n; i++) {
      t = i / n;
      p = new THREE.Vector3().copy(a).lerp(b, t);
      if (p.length() < 0.001) p = a.clone();
      p.normalize().multiplyScalar(R + (lift || 0.08) * Math.sin(Math.PI * t));
      pts.push(p);
    }
    return pts;
  }

  function lineOf(pts, color, opacity, dashed) {
    var geo = new THREE.BufferGeometry().setFromPoints(pts);
    var mat = dashed
      ? new THREE.LineDashedMaterial({ color: color, transparent: true, opacity: opacity, dashSize: 0.04, gapSize: 0.03 })
      : new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity });
    var line = new THREE.Line(geo, mat);
    if (dashed && line.computeLineDistances) line.computeLineDistances();
    return line;
  }

  function clearGroup(g) {
    while (g.children.length) {
      var ch = g.children[0];
      g.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
    }
  }

  function nodeVisible(n) {
    if (!visibleAt(n)) return false;
    var zoomed = dist < 2.15;
    if (n.parent && String(n.id).indexOf('station-') !== 0 && n.kind !== 'robot') return zoomed;
    return true;
  }

  function rebuildBody() {
    if (!topology) return;
    clearGroup(nodeGroup);
    clearGroup(nerveGroup);
    pickables = [];
    var nodes = topology.nodes || [];
    var nerves = topology.nerves || [];
    var byId = {};
    var i, n, mesh, pos, col, geo, mat, e, a, b, from, to, pts, lift, dashed, op, c;

    for (i = 0; i < nodes.length; i++) byId[nodes[i].id] = nodes[i];

    robotPos = new THREE.Vector3(0, 1.42, 0);
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (!nodeVisible(n)) continue;
      if (n.kind === 'robot') pos = robotPos.clone();
      else if (n.geography && n.geography.lat != null) pos = geoPos(n.geography.lat, n.geography.lon, R + 0.03);
      else continue;
      col = anatomyColor(n.anatomy);
      if (lit[n.id]) col = SCARLET;
      geo = new THREE.SphereGeometry(n.kind === 'robot' ? 0.055 : (String(n.id).indexOf('station-') === 0 ? 0.028 : 0.016), 10, 8);
      mat = new THREE.MeshBasicMaterial({ color: col });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData.id = n.id;
      nodeGroup.add(mesh);
      pickables.push(mesh);
      if (n.kind === 'robot') {
        nodeGroup.add(lineOf([
          new THREE.Vector3(pos.x - 0.08, pos.y, pos.z),
          new THREE.Vector3(pos.x + 0.08, pos.y, pos.z)
        ], SCARLET, 0.7, false));
        nodeGroup.add(lineOf([
          new THREE.Vector3(pos.x, pos.y - 0.08, pos.z),
          new THREE.Vector3(pos.x, pos.y + 0.08, pos.z)
        ], SCARLET, 0.7, false));
      }
    }

    for (i = 0; i < nerves.length; i++) {
      e = nerves[i];
      if (e.created && e.created > at) continue;
      from = byId[e.from];
      to = byId[e.to];
      if (!from || !to) continue;
      if (!nodeVisible(from) && e.carrier !== 'shuffle') continue;
      if (from.kind === 'robot') a = robotPos.clone();
      else if (from.geography) a = geoPos(from.geography.lat, from.geography.lon, R + 0.02);
      else continue;
      if (to.kind === 'robot') b = robotPos.clone();
      else if (to.geography) b = geoPos(to.geography.lat, to.geography.lon, R + 0.02);
      else continue;
      c = NERVE[e.type] || DIM;
      if (lit[e.id] || lit[e.from] && lit[e.to]) c = SCARLET;
      dashed = e.type === 'phantom' || e.carrier === 'shuffle';
      op = e.carrier === 'shuffle' ? 0.18 : (lit[e.id] ? 0.95 : 0.45);
      lift = e.carrier === 'shuffle' ? 0.35 : 0.1 + Math.min(0.18, (e.days || 1) * 0.012);
      if (e.carrier === 'shuffle') pts = [a, b];
      else pts = arcPoints(a, b, lift);
      nerveGroup.add(lineOf(pts, c, op, dashed));
    }
    paintLabels();
  }

  function paintLabels() {
    if (!labelLayer || !topology) return;
    var w = window.innerWidth, h = window.innerHeight;
    var html = [];
    var nodes = topology.nodes || [];
    var i, n, pos, v, x, y, show;
    var zoomed = dist < 2.15;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (!nodeVisible(n)) continue;
      show = n.kind === 'robot' || String(n.id).indexOf('station-') === 0 || (zoomed && n.parent);
      if (!show) continue;
      if (n.kind === 'robot') pos = robotPos;
      else if (n.geography) pos = geoPos(n.geography.lat, n.geography.lon, R + 0.06);
      else continue;
      v = pos.clone().project(camera);
      if (v.z > 1) continue;
      x = (v.x * 0.5 + 0.5) * w;
      y = (-v.y * 0.5 + 0.5) * h;
      if (x < 8 || y < 8 || x > w - 8 || y > h - 80) continue;
      html.push('<button type="button" class="globe-lab' + (n.id === selectedId ? ' on' : '') + (lit[n.id] ? ' lit' : '') + '" data-id="' + n.id + '" style="left:' + x + 'px;top:' + y + 'px">' + (n.geography && n.geography.place ? n.geography.place.toUpperCase() : n.name) + '</button>');
    }
    labelLayer.innerHTML = html.join('');
  }

  function tetraDepth() {
    if (dist > 3.2) return 1;
    if (dist > 2.2) return 2;
    return 3;
  }

  var lastDepth = -1;
  function frame() {
    yaw += (target.yaw - yaw) * 0.08;
    pitch += (target.pitch - pitch) * 0.08;
    dist += (target.dist - dist) * 0.08;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    dist = Math.max(1.35, Math.min(6.2, dist));
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      Math.cos(yaw) * Math.cos(pitch) * dist
    );
    camera.lookAt(0, 0, 0);
    var d = tetraDepth();
    if (d !== lastDepth) {
      lastDepth = d;
      buildTetra(d);
      rebuildBody();
    } else {
      paintLabels();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function resize() {
    if (!renderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  function pick(x, y) {
    if (!camera) return null;
    var ray = new THREE.Raycaster();
    var ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pickables, false);
    return hits.length ? hits[0].object.userData.id : null;
  }

  function bindInput(el) {
    el.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('#hud')) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      hoverId = pick(e.clientX, e.clientY);
      if (!dragging) return;
      target.yaw -= (e.clientX - lastX) * 0.005;
      target.pitch -= (e.clientY - lastY) * 0.004;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      var moved = Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
      if (moved < 14) {
        var id = pick(e.clientX, e.clientY);
        if (id && onPick) onPick(id);
      }
    });
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      target.dist += e.deltaY * 0.003;
    }, { passive: false });
    el.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (lastDist) target.dist += (lastDist - d) * 0.01;
        lastDist = d;
      }
    }, { passive: false });
    el.addEventListener('touchend', function () { lastDist = 0; });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    if (labelLayer) {
      labelLayer.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-id]');
        if (btn && onPick) onPick(btn.getAttribute('data-id'));
      });
    }
  }

  function attach(canvas, labels) {
    if (!window.THREE) return false;
    labelLayer = labels;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1e4c4);
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 40);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    resize();
    root = new THREE.Group();
    scene.add(root);
    root.add(new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 32),
      new THREE.MeshBasicMaterial({ color: PAPER })
    ));
    root.add(buildLand());
    nodeGroup = new THREE.Group();
    nerveGroup = new THREE.Group();
    root.add(nerveGroup);
    root.add(nodeGroup);
    buildTetra(1);
    bindInput(canvas);
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
    return true;
  }

  function lookAt(lat, lon) {
    var v = M.Tetra.latLonToVec(lat, lon);
    target.yaw = Math.atan2(v[0], v[2]);
    target.pitch = Math.asin(Math.max(-1, Math.min(1, v[1])));
    target.dist = 2.05;
  }

  function lookRobot() {
    target.yaw = 0.2;
    target.pitch = 1.05;
    target.dist = 2.4;
  }

  M.Globe = {
    attach: attach,
    load: function (data) {
      topology = data;
      lastDepth = -1;
      rebuildBody();
      lookAt(51.48, -3.18);
      target.dist = 3.15;
    },
    select: function (id) { selectedId = id; paintLabels(); },
    light: function (ids) {
      lit = {};
      (ids || []).forEach(function (id) { lit[id] = true; });
      rebuildBody();
    },
    setTime: function (iso) { at = iso || '9999-12-31'; rebuildBody(); },
    lookAt: lookAt,
    lookRobot: lookRobot,
    onPick: function (fn) { onPick = fn; },
    resize: resize,
    hasGL: function () { return !!renderer; }
  };
})(window.JackMap = window.JackMap || {});
