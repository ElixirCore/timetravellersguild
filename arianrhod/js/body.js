/* Arianrhod. Spindly black house spider.
   Prosoma and opisthosoma, joined by a pedicel.
   Eight legs, mirrored, each of seven segments, coxae on the sternum. */
(function (A) {
  'use strict';

  var EYE_COUNT = 8;
  var LEG_COUNT = 8;
  var SEGMENTS = ['coxa', 'trochanter', 'femur', 'patella', 'tibia', 'metatarsus', 'tarsus'];
  var D = Math.PI / 180;
  var PINK = 0xff2bd6;
  var BLACK = 0x0c0c10;
  /* Two rows of four. Anterior median, anterior lateral, posterior median, posterior lateral. */
  var EYE_DEFS = [
    { id: 'AME_L', x: -0.020, y: 0.030, z: 0.108, r: 0.012 },
    { id: 'AME_R', x:  0.020, y: 0.030, z: 0.108, r: 0.012 },
    { id: 'ALE_L', x: -0.052, y: 0.018, z: 0.086, r: 0.009 },
    { id: 'ALE_R', x:  0.052, y: 0.018, z: 0.086, r: 0.009 },
    { id: 'PME_L', x: -0.018, y: 0.050, z: 0.062, r: 0.008 },
    { id: 'PME_R', x:  0.018, y: 0.050, z: 0.062, r: 0.008 },
    { id: 'PLE_L', x: -0.058, y: 0.032, z: 0.028, r: 0.007 },
    { id: 'PLE_R', x:  0.058, y: 0.032, z: 0.028, r: 0.007 }
  ];
  /* Four sockets on the right sternum rim. The left side is the exact mirror.
     Yaw is the compass of the leg: 0 is forward. Leg IV is the longest, as on a house spider. */
  var PAIRS = [
    { n: 1, yaw:  32 * D, x: 0.058, z:  0.046, scale: 1.00 },
    { n: 2, yaw:  74 * D, x: 0.066, z:  0.006, scale: 0.92 },
    { n: 3, yaw: 112 * D, x: 0.058, z: -0.034, scale: 0.84 },
    { n: 4, yaw: 156 * D, x: 0.044, z: -0.064, scale: 1.08 }
  ];
  /* Bend of each segment relative to the one before it. Positive lifts, negative drops.
     Coxa leaves the shell, femur rises, tibia and tarsus come down to the floor. */
  var BEND = [2, 0, 24, -4, -50, -18, -16];
  var SWING = { L1: 1, R2: 1, L3: 1, R4: 1 };

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function markTex(THREE) {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#0c0c10';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ff2bd6';
    var i;
    for (i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(64, 18 + i * 18);
      g.lineTo(64 - (22 - i * 3), 34 + i * 18);
      g.lineTo(64 + (22 - i * 3), 34 + i * 18);
      g.closePath();
      g.fill();
    }
    g.fillRect(58, 8, 12, 18);
    var t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.LinearFilter;
    return t;
  }

  function mats(THREE) {
    var chitin = new THREE.MeshPhongMaterial({
      color: BLACK,
      specular: 0x332244,
      shininess: 42,
      emissive: 0x050308
    });
    var pink = new THREE.MeshPhongMaterial({
      color: PINK,
      emissive: PINK,
      emissiveIntensity: 0.55,
      specular: 0xffffff,
      shininess: 80
    });
    return {
      chitin: chitin,
      pink: pink,
      abdomen: new THREE.MeshPhongMaterial({
        color: BLACK,
        map: markTex(THREE),
        specular: 0x442255,
        shininess: 36,
        emissive: 0x1a0014,
        emissiveIntensity: 0.35
      }),
      eye: new THREE.MeshPhongMaterial({ color: 0x141018, specular: 0xff2bd6, shininess: 120 }),
      pupil: new THREE.MeshBasicMaterial({ color: 0xff2bd6 }),
      sternum: new THREE.MeshPhongMaterial({ color: 0x161018, specular: 0xff2bd6, shininess: 20 })
    };
  }

  function bone(THREE, len, r0, r1, mat, ringMat) {
    var g = new THREE.Group();
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 6), mat);
    mesh.rotation.z = -Math.PI / 2;
    mesh.position.x = len / 2;
    mesh.castShadow = true;
    g.add(mesh);
    var knob = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, r0 * 1.35), 7, 6), ringMat);
    knob.castShadow = true;
    g.add(knob);
    g.userData.len = len;
    return g;
  }

  function buildEyes(THREE, ceph, M) {
    var eyes = [];
    var i, d, g, ball, pupil;
    for (i = 0; i < EYE_DEFS.length; i++) {
      d = EYE_DEFS[i];
      g = new THREE.Group();
      g.name = d.id;
      g.position.set(d.x, d.y, d.z);
      ball = new THREE.Mesh(new THREE.SphereGeometry(d.r, 8, 6), M.eye);
      pupil = new THREE.Mesh(new THREE.SphereGeometry(d.r * 0.28, 5, 4), M.pupil);
      pupil.position.z = d.r * 0.72;
      g.add(ball);
      g.add(pupil);
      g.userData.pupil = pupil;
      g.userData.ball = ball;
      ceph.add(g);
      eyes.push(g);
    }
    return eyes;
  }

  function buildLeg(THREE, spec, M) {
    var s = spec.scale;
    var lens = {
      coxa: 0.050 * s,
      trochanter: 0.020 * s,
      femur: 0.230 * s,
      patella: 0.030 * s,
      tibia: 0.200 * s,
      metatarsus: 0.155 * s,
      tarsus: 0.085 * s
    };
    var radii = [0.020, 0.016, 0.013, 0.011, 0.009, 0.007, 0.005];
    var names = SEGMENTS;
    var parts = [];
    var i, part, prev;
    for (i = 0; i < names.length; i++) {
      part = bone(THREE, lens[names[i]], radii[i] * (0.85 + s * 0.15), radii[i] * 0.8, M.chitin, M.pink);
      part.name = spec.id + ':' + names[i];
      if (prev) {
        prev.add(part);
        part.position.x = prev.userData.len;
      }
      parts.push(part);
      prev = part;
    }
    var claw = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.028, 4), M.pink);
    claw.rotation.z = -Math.PI / 2;
    claw.position.x = lens.tarsus + 0.01;
    parts[6].add(claw);

    var socket = new THREE.Group();
    socket.name = spec.id;
    socket.position.set(spec.x, -0.045, spec.z);
    socket.add(parts[0]);
    return {
      id: spec.id,
      yaw: spec.yaw,
      socket: socket,
      parts: parts,
      lens: lens
    };
  }

  function poseLeg(leg, lift, yawPull) {
    var yaw = leg.yaw * (1 - yawPull * 0.35);
    var bends = BEND.slice();
    bends[2] += lift * 28;
    bends[4] -= lift * 10;
    leg.socket.rotation.set(0, yaw - Math.PI / 2, 0);
    var i;
    for (i = 0; i < leg.parts.length; i++) {
      leg.parts[i].rotation.set(0, 0, bends[i] * D);
    }
  }

  function buildMabel(THREE) {
    var g = new THREE.Group();
    g.name = 'Mabel';
    var cyan = new THREE.MeshLambertMaterial({ color: 0x638B94 });
    var ink = new THREE.MeshLambertMaterial({ color: 0x1a2438 });
    var paper = new THREE.MeshLambertMaterial({ color: 0xf1e4c4 });
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.28, 7), cyan);
    torso.position.y = 0.34;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 7), paper);
    head.position.y = 0.56;
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), ink);
    hair.position.y = 0.60;
    hair.scale.set(1, 0.7, 0.95);
    var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), ink);
    var eyeR = eyeL.clone();
    eyeL.position.set(-0.028, 0.57, 0.078);
    eyeR.position.set(0.028, 0.57, 0.078);
    var skirt = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 7), cyan);
    skirt.position.y = 0.16;
    var i, a, arm, limb;
    for (i = 0; i < 2; i++) {
      a = i === 0 ? -1 : 1;
      arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.22, 5), paper);
      arm.position.set(a * 0.11, 0.38, 0);
      arm.rotation.z = a * 0.35;
      g.add(arm);
      limb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.22, 5), ink);
      limb.position.set(a * 0.045, 0.11, 0);
      g.add(limb);
    }
    g.add(torso, head, hair, eyeL, eyeR, skirt);
    g.userData.alive = true;
    return g;
  }

  A.EYE_COUNT = EYE_COUNT;
  A.LEG_COUNT = LEG_COUNT;
  A.SEGMENTS = SEGMENTS;
  A.PINK = '#ff2bd6';
  A.BLACK = '#0c0c10';
  A.buildMabel = buildMabel;

  A.buildBody = function (THREE) {
    var M = mats(THREE);
    var root = new THREE.Group();
    root.name = 'Arianrhod';
    var body = new THREE.Group();
    var ceph = new THREE.Group();
    var abdomen = new THREE.Group();

    var cephMesh = new THREE.Mesh(new THREE.SphereGeometry(0.108, 12, 9), M.chitin);
    cephMesh.scale.set(1.05, 0.58, 1.22);
    cephMesh.castShadow = true;
    ceph.add(cephMesh);
    var blaze = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.pink);
    blaze.scale.set(0.5, 0.16, 0.85);
    blaze.position.set(0, 0.048, 0.02);
    ceph.add(blaze);
    var sternum = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.sternum);
    sternum.scale.set(1.15, 0.22, 1.05);
    sternum.position.set(0, -0.05, -0.01);
    ceph.add(sternum);

    var palps = [];
    var p, s;
    for (s = -1; s <= 1; s += 2) {
      p = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.10, 6), M.chitin);
      p.position.set(s * 0.030, -0.01, 0.11);
      p.rotation.x = 1.15;
      p.rotation.z = s * 0.18;
      ceph.add(p);
      palps.push(p);
    }
    var fang;
    for (s = -1; s <= 1; s += 2) {
      fang = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.034, 5), M.pink);
      fang.position.set(s * 0.016, -0.02, 0.122);
      fang.rotation.x = 2.2;
      ceph.add(fang);
    }
    var eyes = buildEyes(THREE, ceph, M);

    var abd = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 9), M.abdomen);
    abd.scale.set(0.82, 0.72, 1.28);
    abd.castShadow = true;
    abdomen.add(abd);
    abdomen.position.set(0, 0.015, -0.32);
    var spin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.032, 6), M.pink);
    spin.position.set(0, -0.055, -0.16);
    abdomen.add(spin);
    var pedicel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 6), M.chitin);
    pedicel.rotation.x = Math.PI / 2;
    pedicel.position.set(0, -0.008, -0.16);
    body.add(ceph, pedicel, abdomen);
    body.position.y = 0.20;
    root.add(body);

    var legs = [];
    var pi, side, spec, leg;
    for (pi = 0; pi < PAIRS.length; pi++) {
      for (side = -1; side <= 1; side += 2) {
        spec = {
          id: (side < 0 ? 'L' : 'R') + PAIRS[pi].n,
          yaw: side * PAIRS[pi].yaw,
          x: side * PAIRS[pi].x,
          z: PAIRS[pi].z,
          scale: PAIRS[pi].scale
        };
        leg = buildLeg(THREE, spec, M);
        ceph.add(leg.socket);
        legs.push(leg);
        poseLeg(leg, 0, 0);
      }
    }

    var yaw = 0;
    var phase = 0;
    var blink = 0;
    var look = new THREE.Vector3();

    function update(dt, info) {
      info = info || {};
      var vx = info.vx || 0;
      var vz = info.vz || 0;
      var pray = !!info.pray;
      var shrivel = Math.max(0, Math.min(1, info.shrivel || 0));
      var reduced = !!info.reduced;
      if (shrivel > 0) pray = true;
      var husk = 1 - shrivel * 0.88;
      root.scale.set(husk, husk * (1 - shrivel * 0.45), husk);
      var speed = Math.hypot(vx, vz);
      if (typeof info.facing === 'number' && isFinite(info.facing)) yaw = info.facing;
      else if (speed > 0.04) yaw = Math.atan2(vx, vz);
      root.rotation.y = yaw;
      root.position.x += vx;
      root.position.z += vz;
      body.position.y = 0.20 + (reduced || pray ? 0 : Math.sin(phase * Math.PI * 2) * 0.012 * Math.min(1, speed * 5));
      abdomen.rotation.x = pray ? -0.12 : Math.sin(phase * 4) * 0.03 * Math.min(1, speed + 0.15);
      palps[0].rotation.x = 1.15 + (pray ? -0.35 : Math.sin(phase * 8) * 0.12);
      palps[1].rotation.x = 1.15 + (pray ? -0.35 : Math.cos(phase * 8) * 0.12);

      if (speed > 0.02 && !pray && !reduced) phase = (phase + dt * (1.35 + speed * 2.2)) % 1;
      else if (!reduced) phase *= 0.92;

      var i, slot, lift, pull;
      for (i = 0; i < legs.length; i++) {
        leg = legs[i];
        lift = 0;
        pull = pray ? 0.55 + shrivel * 0.4 : 0;
        if (speed > 0.02 && !pray && !reduced) {
          slot = ((SWING[leg.id] ? phase : phase + 0.5) % 1);
          if (slot < 0.45) lift = Math.sin((slot / 0.45) * Math.PI);
        } else if (pray) {
          lift = 0.35 + shrivel * 0.5;
        }
        poseLeg(leg, lift, pull);
      }

      blink -= dt;
      var shut = blink > -0.08 && blink < 0;
      if (blink < -2.8) blink = 0.12;
      look.set(info.lookX || 0, info.lookY || 0.1, 1);
      for (i = 0; i < eyes.length; i++) {
        eyes[i].userData.pupil.position.x = clamp(look.x * 0.006, -0.005, 0.005);
        eyes[i].userData.pupil.position.y = clamp(look.y * 0.005, -0.004, 0.004);
        eyes[i].userData.ball.scale.y = shut && i < 2 ? 0.15 : 1;
      }
    }

    return {
      root: root,
      eyes: eyes,
      legs: legs,
      body: body,
      update: update,
      getYaw: function () { return yaw; },
      setYaw: function (n) { yaw = n; root.rotation.y = n; }
    };
  };
})(window.Arianrhod = window.Arianrhod || {});
