/* Physical meters — outputs of the emergy computation, not decoration. */
(function (global) {
  'use strict';

  function labelTexture(THREE, text, opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas');
    canvas.width = opts.w || 256;
    canvas.height = opts.h || 64;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.bg || '#1a1408';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = opts.fg || '#d4b45a';
    ctx.font = 'bold ' + (opts.size || 28) + 'px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    var tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function makeEmergyGauge(THREE, mats) {
    var g = new THREE.Group();
    g.name = 'EmergyGauge';

    var face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.04, 36),
      mats.steel || new THREE.MeshStandardMaterial({ color: 0x3a4555, metalness: 0.55, roughness: 0.45 })
    );
    face.rotation.x = Math.PI / 2;
    g.add(face);

    var dial = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 36),
      new THREE.MeshBasicMaterial({ color: 0x0a100c })
    );
    dial.position.z = 0.022;
    g.add(dial);

    for (var i = 0; i <= 10; i++) {
      var ang = Math.PI - (i / 10) * Math.PI;
      var tick = new THREE.Mesh(
        new THREE.BoxGeometry(i % 5 === 0 ? 0.04 : 0.022, 0.006, 0.004),
        new THREE.MeshBasicMaterial({ color: 0x8fd9a8 })
      );
      tick.position.set(Math.cos(ang) * 0.2, Math.sin(ang) * 0.2, 0.028);
      tick.rotation.z = ang;
      g.add(tick);
    }

    var title = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.06),
      new THREE.MeshBasicMaterial({
        map: labelTexture(THREE, 'EMERGY E', { w: 256, h: 48, size: 32, bg: '#0a100c', fg: '#d8ffe8' }),
        toneMapped: false,
      })
    );
    title.position.set(0, -0.08, 0.03);
    g.add(title);

    var pivot = new THREE.Group();
    pivot.position.set(0, 0, 0.03);
    var arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.01, 0.005),
      new THREE.MeshStandardMaterial({
        color: 0xc9a227,
        emissive: 0x885500,
        emissiveIntensity: 0.7,
        metalness: 0.5,
        roughness: 0.35,
      })
    );
    arm.position.x = 0.1;
    pivot.add(arm);
    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12),
      mats.brass || new THREE.MeshStandardMaterial({ color: 0xa8883a, metalness: 0.8, roughness: 0.35 })
    );
    hub.rotation.x = Math.PI / 2;
    pivot.add(hub);
    g.add(pivot);

    g.userData.needle = pivot;
    g.userData.kind = 'emergyGauge';
    g.userData.label = 'EMERGY';
    g.userData.tip =
      'EMERGY — instrument output E = M / R^(κ·ΔC), sigmoid-normalised. Needle tracks display level from mind, matter, κ, ΔC.';

    g.setLevel = function (display) {
      var v = Math.max(0, Math.min(1, display || 0));
      pivot.rotation.z = Math.PI - v * Math.PI;
    };
    g.setLevel(0.4);
    return g;
  }

  function makeJackPlaque(THREE, mats) {
    var g = new THREE.Group();
    var plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.025),
      mats.brass || new THREE.MeshStandardMaterial({ color: 0xa8883a, metalness: 0.8, roughness: 0.4 })
    );
    g.add(plate);
    var face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.11),
      new THREE.MeshBasicMaterial({
        map: labelTexture(THREE, 'JACK', { w: 256, h: 64, size: 36, bg: '#3a2a10', fg: '#f0d080' }),
        toneMapped: false,
      })
    );
    face.position.z = 0.014;
    g.add(face);
    g.userData.kind = 'jackPlaque';
    g.userData.label = 'JACK';
    g.userData.tip = 'JACK — clerk channel. Opens the desk. Operator action.';
    return g;
  }

  global.TTGMachineInstruments = {
    makeEmergyGauge: makeEmergyGauge,
    makeJackPlaque: makeJackPlaque,
    labelTexture: labelTexture,
  };
})(window);
