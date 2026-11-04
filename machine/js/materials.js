/* Worn navy enamel + steel maps for TIME MACHINE №13. */
(function (global) {
  'use strict';

  function makeCanvas(size) {
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return c;
  }

  function wearTexture(THREE, size, opts) {
    opts = opts || {};
    size = size || 512;
    var c = makeCanvas(size);
    var ctx = c.getContext('2d');
    var base = opts.base || '#1a3558';
    var scratch = opts.scratch || 'rgba(200,210,220,0.4)';
    var dirt = opts.dirt || 'rgba(8,10,16,0.35)';

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    for (var i = 0; i < 100; i++) {
      var x = Math.random() * size;
      var y = Math.random() * size;
      var r = 10 + Math.random() * 50;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, dirt);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Corner rub only — no full-frame stroke (that tiles into a grid)
    ctx.fillStyle = 'rgba(170,180,190,0.22)';
    [[0, 0], [size - 48, 0], [0, size - 48], [size - 48, size - 48]].forEach(function (p) {
      ctx.fillRect(p[0], p[1], 48, 48);
    });

    ctx.lineCap = 'round';
    for (var s = 0; s < 70; s++) {
      ctx.strokeStyle = scratch;
      ctx.globalAlpha = 0.2 + Math.random() * 0.35;
      ctx.lineWidth = 0.6 + Math.random() * 1.6;
      var x0 = Math.random() * size;
      var y0 = Math.random() * size;
      var len = 18 + Math.random() * 90;
      var ang = Math.random() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (var m = 0; m < 6; m++) {
      var mx = 50 + Math.random() * (size - 100);
      var my = 50 + Math.random() * (size - 100);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function roughnessTexture(THREE, size) {
    size = size || 256;
    var c = makeCanvas(size);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 0, size, size);
    for (var i = 0; i < 2000; i++) {
      var v = (80 + Math.random() * 120) | 0;
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
    }
    for (var s = 0; s < 40; s++) {
      ctx.strokeStyle = 'rgba(220,220,220,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      var x0 = Math.random() * size;
      var y0 = Math.random() * size;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.random() * 80, y0 + (Math.random() - 0.5) * 10);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function enamel(THREE) {
    var map = wearTexture(THREE, 512, { base: '#2a4f7a' });
    map.repeat.set(1.25, 1.25);
    var rough = roughnessTexture(THREE, 256);
    rough.repeat.set(2, 2);
    return new THREE.MeshStandardMaterial({
      color: 0x3a5f8a,
      map: map,
      roughnessMap: rough,
      roughness: 0.62,
      metalness: 0.28,
    });
  }

  function steel(THREE) {
    var map = wearTexture(THREE, 256, {
      base: '#4a5568',
      scratch: 'rgba(220,225,230,0.45)',
    });
    return new THREE.MeshStandardMaterial({
      color: 0x5a6578,
      map: map,
      roughness: 0.48,
      metalness: 0.55,
    });
  }

  function brass(THREE) {
    return new THREE.MeshStandardMaterial({
      color: 0xa8883a,
      roughness: 0.4,
      metalness: 0.85,
    });
  }

  function bakelite(THREE) {
    return new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.55,
      metalness: 0.12,
    });
  }

  function paper(THREE) {
    return new THREE.MeshStandardMaterial({
      color: 0xe8dcc0,
      roughness: 0.9,
      metalness: 0.02,
    });
  }

  global.TTGMachineMats = {
    enamel: enamel,
    steel: steel,
    brass: brass,
    bakelite: bakelite,
    paper: paper,
    wearTexture: wearTexture,
  };
})(window);
