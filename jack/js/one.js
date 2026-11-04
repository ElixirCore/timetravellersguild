/* ONE — a single composed habitat. Click a station, Jack changes state. */
(function () {
  'use strict';

  var cfg = window.TTG_JACK || window.TTG_ONE || {};
  var canvas, ctx, w = 1, h = 1, fov = 520, horizonY = 1, pulse = 0;
  var hover = null, dragging = false, moved = 0, lastX = 0, lastY = 0;
  var yaw = 0, pitch = 0.04, tyaw = 0, tpitch = 0.04;
  var cam = { x: 0, y: 1.46, z: 0.4 };
  var stance = 'jack';
  var asking = false;
  var thread = [];
  var sitting = [];
  var copyReset = null;
  var greeted = false;
  var tapeWaiting = false;
  var tapeOffset = 0;
  var tapeAcc = 0;
  var tapeCol = 1;
  var lastT = 0;
  var TAPE_WAIT = ['SIGN SLIP', 'OPEN DRAWER', 'SEARCH FIELD', 'READ THREAD', 'PUNCH COL', 'HOLD LEAF', 'ASK CLERK', 'WAIT REPLY'];
  var nineName = 'PUNCH COL';
  var WORK_FORMS = ['punch', 'deal', 'card', 'speak'];
  var jackAt = { x: 0.12, y: 0.76, z: 2.4, h: 0.48 };

  var PAPER = '#e8d2a4';
  var NAVY = '#1e3a5f';
  var SCARLET = '#c41e3a';
  var INK = '#161814';
  var GOLD = '#c9a227';
  var AMBER = '#c46a1e';
  var ZINC = '#9a968e';
  var WOOD = '#8a6234';
  var PLASTIC = '#111214';
  var CUBE = {
    floor: '#FFD500',
    ceil: '#F5F5F5',
    north: '#C41E3A',
    south: '#FF6A00',
    west: '#0051BA',
    east: '#009E60'
  };
  var CUBE_BOUNDS = { minX: -2.12, maxX: 2.12, minZ: -0.18, maxZ: 3.92, height: 3.08 };

  var STANCES = {
    jack: {
      title: 'WITH JACK',
      form: 'HE IS HERE',
      hint: 'He is not on duty. He is present.',
      opening: 'This is my room inside the cube. Desk, tap, hopper, and me. Click a station if you want the clerk on duty — or stay here and ask me anything.',
      look: { yaw: 0, pitch: 0.05 },
      bartime: false
    },
    desk: {
      title: 'AT THE DESK',
      form: 'ON DUTY',
      hint: 'Official. He will file what you bring.',
      opening: 'The desk is open. What needs filing?',
      look: { yaw: 0.02, pitch: -0.08 },
      bartime: false
    },
    tap: {
      title: 'AT THE TAP',
      form: 'LAST ORDERS',
      hint: 'Easy. Off the record. Time travel as talk.',
      opening: 'The cube is closed. The tap is open. Sit down. We can talk about time.',
      look: { yaw: 0.34, pitch: 0.02 },
      bartime: true
    },
    tarot: {
      title: 'AT THE HOPPER',
      form: 'PUNCHCARD TAROT',
      hint: 'Seventy-eight slips. A working draw, not fortune.',
      opening: 'The hopper is ready. Hold a question, or leave it open.',
      look: { yaw: -0.32, pitch: -0.1 },
      bartime: false
    }
  };

  var POSTS = {
    jack: { x: 0.12, y: 0.76, z: 2.4, h: 0.48, w: 0.4, d: 0.28 },
    desk: { x: 0.06, y: 0.76, z: 2.36, h: 0.44, w: 0.4, d: 0.28 },
    tarot: { x: -0.28, y: 0.76, z: 2.4, h: 0.48, w: 0.4, d: 0.28 },
    tap: { x: 0.78, y: 0, z: 2.12, h: 0.72, w: 0.36, d: 0.3 }
  };

  var STATIONS = [
    { id: 'desk', label: 'DESK', x: 0, y: 0, z: 2.7, w: 1.58, h: 0.78, d: 0.8 },
    { id: 'tarot', label: 'HOPPER', x: -0.5, y: 0.78, z: 2.6, w: 0.46, h: 0.4, d: 0.36 },
    { id: 'tap', label: 'TAP', x: 1.16, y: 0, z: 2.28, w: 0.78, h: 1.28, d: 0.64 }
  ];

  function $(id) { return document.getElementById(id); }

  window.Jack = window.Jack || {};
  Jack.State = {
    get: function () {
      return {
        body: { position: cam, yaw: yaw, pitch: pitch },
        context: { phase: tapeWaiting ? 'CARD' : (asking ? 'VOICE' : (stance === 'tarot' ? 'CARD' : 'SENSE')) }
      };
    }
  };

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = window.innerWidth, ch = window.innerHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
    }
    w = canvas.width;
    h = canvas.height;
    horizonY = h * 0.4;
    var el = $('console');
    if (el) {
      var top = el.getBoundingClientRect().top * dpr;
      var vis = Math.max(h * 0.34, Math.min(h, top));
      horizonY = vis * 0.48;
      fov = Math.min(w * 0.56, vis * 1.02);
    } else {
      fov = Math.min(w, h) * 0.62;
    }
  }

  function project(x, y, z) {
    var dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    var cy = Math.cos(-yaw), sy = Math.sin(-yaw);
    var rx = dx * cy - dz * sy;
    var rz = dx * sy + dz * cy;
    var cp = Math.cos(-pitch), sp = Math.sin(-pitch);
    var ry = dy * cp - rz * sp;
    rz = dy * sp + rz * cp;
    if (rz < 0.16) return null;
    var f = fov / rz;
    return { x: w * 0.5 + rx * f, y: horizonY - ry * f, z: rz };
  }

  function lampLift(x, y, z) {
    var lx, ly, lz, k;
    if (stance === 'desk') { lx = 0.48; ly = 1.05; lz = 2.48; k = 0.28; }
    else if (stance === 'tap') { lx = 1.08; ly = 1.16; lz = 2.16; k = 0.24; }
    else if (stance === 'tarot') { lx = -0.5; ly = 1.02; lz = 2.6; k = 0.22; }
    else { lx = 0.1; ly = 1.15; lz = 2.62; k = 0.1; }
    var dx = x - lx, dy = y - ly, dz = z - lz;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return k / (1 + d * 1.7);
  }

  function shade(hex, z, lift, wx, wy, wz) {
    var t = Math.max(0.4, Math.min(1.14, 1.14 - z / 13 + (lift || 0)));
    if (wx !== undefined) t += lampLift(wx, wy, wz);
    if (stance === 'tap') t *= 1.05;
    if (stance === 'desk') t *= 0.98;
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * t);
    var g = Math.round(((n >> 8) & 255) * t);
    var b = Math.round((n & 255) * t);
    if (stance === 'tap') { r = Math.min(255, r + 18); g = Math.min(255, g + 4); b = Math.max(0, b - 8); }
    if (stance === 'desk') { b = Math.min(255, b + 14); r = Math.max(0, r - 4); }
    if (stance === 'tarot') { r = Math.min(255, r + 16); b = Math.max(0, b - 4); }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
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
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1.15; ctx.stroke(); }
  }

  function quad(a, b, c, d, fill, stroke, width) {
    poly([project(a[0], a[1], a[2]), project(b[0], b[1], b[2]), project(c[0], c[1], c[2]), project(d[0], d[1], d[2])], fill, stroke, width);
  }

  function face(pts, fill, stroke, width) {
    var p = [], zsum = 0, n = 0, i, q;
    for (i = 0; i < pts.length; i++) {
      q = project(pts[i][0], pts[i][1], pts[i][2]);
      p[i] = q;
      if (q) { zsum += q.z; n++; }
    }
    if (n < 3) return;
    var mid = pts[0];
    poly(p, shade(fill, zsum / n, 0, mid[0], mid[1], mid[2]), stroke, width);
  }

  function box(o, fill, selected) {
    var hw = o.w / 2, hd = o.d / 2, y0 = o.y, y1 = o.y + o.h, x = o.x, z = o.z;
    var faces = [
      [[x - hw, y0, z + hd], [x + hw, y0, z + hd], [x + hw, y1, z + hd], [x - hw, y1, z + hd]],
      [[x - hw, y0, z - hd], [x + hw, y0, z - hd], [x + hw, y1, z - hd], [x - hw, y1, z - hd]],
      [[x - hw, y0, z - hd], [x - hw, y0, z + hd], [x - hw, y1, z + hd], [x - hw, y1, z - hd]],
      [[x + hw, y0, z - hd], [x + hw, y0, z + hd], [x + hw, y1, z + hd], [x + hw, y1, z - hd]],
      [[x - hw, y1, z - hd], [x + hw, y1, z - hd], [x + hw, y1, z + hd], [x - hw, y1, z + hd]]
    ];
    var i, p, zsum, n, j, mid;
    for (i = 0; i < faces.length; i++) {
      p = []; zsum = 0; n = 0;
      for (j = 0; j < 4; j++) {
        p[j] = project(faces[i][j][0], faces[i][j][1], faces[i][j][2]);
        if (p[j]) { zsum += p[j].z; n++; }
      }
      if (n < 3) continue;
      mid = faces[i][0];
      poly(p, shade(fill, zsum / n, selected ? 0.16 : 0, mid[0], mid[1], mid[2]), selected ? SCARLET : 'rgba(22,24,20,.55)', selected ? 2.2 : 1);
    }
  }

  function disc(x, y, z, r, fill) {
    var p = project(x, y, z);
    if (!p || p.z > 14) return;
    ctx.fillStyle = fill || shade('#2a2218', p.z, 0, x, y, z);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, Math.max(4, (r * fov) / p.z), Math.max(2, (r * 0.35 * fov) / p.z), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function label(o, text, selected) {
    var top = project(o.x, o.y + o.h + 0.1, o.z);
    if (!top || top.z > 11) return;
    ctx.save();
    ctx.font = '600 ' + Math.max(11, Math.min(18, 300 / top.z)) + 'px "Courier New", monospace';
    ctx.fillStyle = selected ? SCARLET : INK;
    ctx.textAlign = 'center';
    ctx.fillText(text, top.x, top.y);
    ctx.restore();
  }

  function stickerShade(hex, z, lift) {
    var t = Math.max(0.78, Math.min(1.06, 1.04 - z / 20 + (lift || 0)));
    if (stance === 'tap') t *= 1.03;
    if (stance === 'desk') t *= 0.98;
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * t);
    var g = Math.round(((n >> 8) & 255) * t);
    var b = Math.round((n & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function stickerQuad(face, col, row, b) {
    var gutter = 0.11;
    var x0 = b.minX, x1 = b.maxX, z0 = b.minZ, z1 = b.maxZ, yh = b.height;
    var wx = x1 - x0, wz = z1 - z0;
    var cx, cz, cy, tw, th;
    if (face === 'floor' || face === 'ceil') {
      tw = (wx - gutter * 4) / 3;
      th = (wz - gutter * 4) / 3;
      cx = x0 + gutter + col * (tw + gutter);
      cz = z0 + gutter + row * (th + gutter);
      cy = face === 'floor' ? 0.012 : yh - 0.012;
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

  function drawSticker(q, fill) {
    var p = [project(q[0][0], q[0][1], q[0][2]), project(q[1][0], q[1][1], q[1][2]), project(q[2][0], q[2][1], q[2][2]), project(q[3][0], q[3][1], q[3][2])];
    var z = 0, n = 0, i;
    for (i = 0; i < 4; i++) {
      if (!p[i] || p[i].z < 0.4) return;
      z += p[i].z;
      n++;
    }
    if (n < 4) return;
    poly(p, stickerShade(fill, z / n, 0.04), PLASTIC, 2.2);
  }

  function drawShell() {
    var b = CUBE_BOUNDS;
    var x0 = b.minX, x1 = b.maxX, z0 = b.minZ, z1 = b.maxZ, yh = b.height;
    var faces = ['floor', 'ceil', 'north', 'south', 'west', 'east'];
    var r, c, f;
    face([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], PLASTIC, PLASTIC, 1);
    face([[x0, yh, z0], [x1, yh, z0], [x1, yh, z1], [x0, yh, z1]], PLASTIC, PLASTIC, 1);
    face([[x0, 0, z0], [x1, 0, z0], [x1, yh, z0], [x0, yh, z0]], PLASTIC, PLASTIC, 1);
    face([[x0, 0, z1], [x1, 0, z1], [x1, yh, z1], [x0, yh, z1]], PLASTIC, PLASTIC, 1);
    face([[x0, 0, z0], [x0, 0, z1], [x0, yh, z1], [x0, yh, z0]], PLASTIC, PLASTIC, 1);
    face([[x1, 0, z0], [x1, 0, z1], [x1, yh, z1], [x1, yh, z0]], PLASTIC, PLASTIC, 1);
    for (f = 0; f < faces.length; f++) {
      for (r = 0; r < 3; r++) {
        for (c = 0; c < 3; c++) {
          drawSticker(stickerQuad(faces[f], c, r, b), CUBE[faces[f]]);
        }
      }
    }
  }

  function drawCabinet() {
    box({ x: -1.62, y: 0, z: 3.42, w: 0.46, h: 0.7, d: 0.34 }, '#5c4630', false);
    box({ x: -1.62, y: 0.36, z: 3.26, w: 0.4, h: 0.03, d: 0.04 }, GOLD, false);
  }

  function drawDesk() {
    var on = stance === 'desk' || hover === 'desk';
    box({ x: -0.62, y: 0, z: 2.78, w: 0.1, h: 0.7, d: 0.1 }, WOOD, false);
    box({ x: 0.62, y: 0, z: 2.78, w: 0.1, h: 0.7, d: 0.1 }, WOOD, false);
    box({ x: -0.62, y: 0, z: 2.48, w: 0.1, h: 0.7, d: 0.1 }, WOOD, false);
    box({ x: 0.62, y: 0, z: 2.48, w: 0.1, h: 0.7, d: 0.1 }, WOOD, false);
    box({ x: 0, y: 0.08, z: 2.7, w: 1.5, h: 0.62, d: 0.72 }, '#6e4e2c', on);
    box({ x: 0, y: 0.7, z: 2.7, w: 1.58, h: 0.06, d: 0.8 }, '#d9cb9e', on);
    box({ x: 0.08, y: 0.77, z: 2.66, w: 0.72, h: 0.012, d: 0.42 }, '#c41e3a', false);
    box({ x: 0.42, y: 0.77, z: 2.82, w: 0.24, h: 0.02, d: 0.16 }, PAPER, false);
    box({ x: 0.46, y: 0.79, z: 2.84, w: 0.2, h: 0.02, d: 0.13 }, '#efe6c8', false);
    box({ x: 0.48, y: 0.76, z: 2.48, w: 0.07, h: 0.28, d: 0.07 }, GOLD, stance === 'desk');
    box({ x: 0.48, y: 1.02, z: 2.48, w: 0.22, h: 0.08, d: 0.18 }, '#2f5a38', stance === 'desk');
    box({ x: 0.28, y: 0.76, z: 2.44, w: 0.08, h: 0.1, d: 0.08 }, '#2a2018', false);
    if (tapeWaiting && window.NineBit && NineBit.sheet) {
      NineBit.paint(nineName, Math.floor(pulse * 4));
      var a = project(-0.18, 0.79, 2.48);
      var b = project(0.28, 0.79, 2.48);
      var c = project(0.28, 0.79, 2.78);
      var d = project(-0.18, 0.79, 2.78);
      if (a && b && c && d) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.clip();
        var x0 = Math.min(a.x, b.x, c.x, d.x);
        var y0 = Math.min(a.y, b.y, c.y, d.y);
        var x1 = Math.max(a.x, b.x, c.x, d.x);
        var y1 = Math.max(a.y, b.y, c.y, d.y);
        ctx.drawImage(NineBit.sheet(), x0, y0, x1 - x0, y1 - y0);
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    if (stance === 'desk') {
      var lamp = project(0.48, 1.0, 2.42);
      if (lamp && lamp.z < 12) {
        var lg = ctx.createRadialGradient(lamp.x, lamp.y + 18, 6, lamp.x, lamp.y + 80, 200);
        lg.addColorStop(0, 'rgba(232,210,140,.3)');
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(lamp.x - 220, lamp.y - 36, 440, 280);
      }
    }
  }

  function drawHopper() {
    var on = stance === 'tarot' || hover === 'tarot';
    box({ x: -0.5, y: 0.76, z: 2.6, w: 0.46, h: 0.34, d: 0.36 }, '#e6d3a8', on);
    box({ x: -0.5, y: 1.08, z: 2.6, w: 0.42, h: 0.04, d: 0.32 }, '#1e3a5f', on);
    box({ x: -0.6, y: 0.88, z: 2.44, w: 0.07, h: 0.14, d: 0.02 }, SCARLET, on);
    box({ x: -0.5, y: 0.88, z: 2.44, w: 0.07, h: 0.14, d: 0.02 }, NAVY, on);
    box({ x: -0.4, y: 0.88, z: 2.44, w: 0.07, h: 0.14, d: 0.02 }, GOLD, on);
    if (stance === 'tarot') {
      var slip = 0.04 + Math.abs(Math.sin(pulse * 2.2)) * 0.1;
      box({ x: -0.5, y: 1.1, z: 2.54, w: 0.16, h: slip, d: 0.02 }, PAPER, true);
    }
  }

  function drawBar() {
    var on = stance === 'tap' || hover === 'tap';
    box({ x: 1.18, y: 0, z: 2.32, w: 0.76, h: 0.86, d: 0.58 }, ZINC, on);
    box({ x: 1.18, y: 0.86, z: 2.32, w: 0.82, h: 0.05, d: 0.62 }, '#d0ccc4', on);
    box({ x: 1.18, y: 0.92, z: 2.1, w: 0.62, h: 0.03, d: 0.14 }, '#6a6660', false);
    box({ x: 1.08, y: 0.91, z: 2.18, w: 0.15, h: 0.52, d: 0.15 }, GOLD, on);
    box({ x: 1.08, y: 1.4, z: 2.08, w: 0.24, h: 0.07, d: 0.18 }, '#e0b84a', on);
    box({ x: 1.38, y: 1.08, z: 2.48, w: 0.08, h: 0.38, d: 0.08 }, '#6a2018', false);
    box({ x: 1.26, y: 1.14, z: 2.5, w: 0.08, h: 0.32, d: 0.08 }, '#1e3a5f', false);
    box({ x: 1.16, y: 1.18, z: 2.5, w: 0.07, h: 0.28, d: 0.07 }, '#c41e3a', false);
    box({ x: 1.48, y: 1.2, z: 2.46, w: 0.06, h: 0.22, d: 0.06 }, '#c9a227', false);
    box({ x: 0.92, y: 0.91, z: 2.16, w: 0.1, h: 0.14, d: 0.1 }, '#d9cb9e', false);
    box({ x: 0.8, y: 0.91, z: 2.22, w: 0.1, h: 0.16, d: 0.1 }, '#efe6c8', false);
    var dripY = 1.34 - ((pulse * 1.35) % 0.38);
    var drip = project(1.08, dripY, 2.02);
    if (drip && drip.z < 10) {
      ctx.fillStyle = shade('#7ec8ff', drip.z, 0.28, 1.08, dripY, 2.02);
      ctx.beginPath();
      ctx.arc(drip.x, drip.y, Math.max(2.4, 16 / drip.z), 0, Math.PI * 2);
      ctx.fill();
    }
    if (stance === 'tap') {
      var tap = project(1.08, 1.16, 2.16);
      if (tap && tap.z < 12) {
        var tg = ctx.createRadialGradient(tap.x, tap.y, 8, tap.x, tap.y, 200);
        tg.addColorStop(0, 'rgba(196,106,30,.26)');
        tg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = tg;
        ctx.fillRect(tap.x - 220, tap.y - 160, 440, 360);
      }
    }
  }

  function drawJack() {
    var on = hover === 'jack';
    disc(jackAt.x, 0.02, jackAt.z, 0.22, 'rgba(16,14,10,.28)');
    var sprite = {
      x: jackAt.x, y: jackAt.y, z: jackAt.z, h: jackAt.h, w: 0.46, d: 0.32
    };
    if (Jack.Sprite && Jack.Sprite.drawInWorld) {
      Jack.Sprite.drawInWorld(ctx, project, sprite, on, pulse);
    } else {
      box(sprite, '#8a6a3a', on);
      label(sprite, 'JACK', on);
    }
  }

  function drawSet() {
    drawShell();
    drawCabinet();
    drawDesk();
    drawHopper();
    drawBar();
    drawJack();
    label(STATIONS[0], 'DESK', hover === 'desk' || stance === 'desk');
    label(STATIONS[1], 'HOPPER', hover === 'tarot' || stance === 'tarot');
    label(STATIONS[2], 'TAP', hover === 'tap' || stance === 'tap');
  }

  function hitOf(o) {
    var hw = o.w / 2, hd = o.d / 2, y0 = o.y, y1 = o.y + o.h;
    var pts = [
      [o.x - hw, y0, o.z - hd], [o.x + hw, y0, o.z - hd],
      [o.x + hw, y1, o.z + hd], [o.x - hw, y1, o.z + hd],
      [o.x, (y0 + y1) / 2, o.z]
    ];
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, z = 0, n = 0, i, p;
    for (i = 0; i < pts.length; i++) {
      p = project(pts[i][0], pts[i][1], pts[i][2]);
      if (!p || p.z < 0.4) continue;
      n++; z += p.z;
      if (p.x < minx) minx = p.x;
      if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y;
      if (p.y > maxy) maxy = p.y;
    }
    if (n < 2) return null;
    return { id: o.id, minx: minx, maxx: maxx, miny: miny, maxy: maxy, z: z / n };
  }

  function jackHit() {
    return hitOf({
      id: 'jack',
      x: jackAt.x, y: jackAt.y, z: jackAt.z,
      w: 0.5, h: jackAt.h, d: 0.4
    });
  }

  function stationAt(sx, sy) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var x = sx * dpr, y = sy * dpr;
    var hits = [];
    var i, hit;
    hit = jackHit();
    if (hit) hits.push(hit);
    for (i = 0; i < STATIONS.length; i++) {
      hit = hitOf(STATIONS[i]);
      if (hit) hits.push(hit);
    }
    hits.sort(function (a, b) {
      if (a.id === 'jack' && b.id !== 'jack') return -1;
      if (b.id === 'jack' && a.id !== 'jack') return 1;
      if (a.id === 'tarot' && b.id === 'desk') return -1;
      if (b.id === 'tarot' && a.id === 'desk') return 1;
      return a.z - b.z;
    });
    var pad = 14 * dpr;
    for (i = 0; i < hits.length; i++) {
      hit = hits[i];
      if (x >= hit.minx - pad && x <= hit.maxx + pad && y >= hit.miny - pad && y <= hit.maxy + pad) {
        return hit.id;
      }
    }
    return null;
  }

  function setStance(id, speakIt) {
    if (!STANCES[id]) return;
    stance = id;
    document.body.setAttribute('data-stance', id);
    var s = STANCES[id];
    tyaw = s.look.yaw;
    tpitch = s.look.pitch;
    $('jackForm').textContent = s.form;
    $('stanceLine').textContent = s.title;
    $('stanceHint').textContent = s.hint;
    $('hint').textContent = s.title + ' · CLICK A STATION';
    $('hopper').hidden = id !== 'tarot';
    if (Jack.Sprite) {
      if (id === 'tarot') Jack.Sprite.deal(3);
      else if (id === 'desk') Jack.Sprite.setForm('sit');
      else if (id === 'tap') Jack.Sprite.setForm('speak');
      else Jack.Sprite.setForm('sit');
    }
    if (speakIt !== false) {
      appendTalk('clerk', s.opening);
    }
  }

  function speak(line) {
    document.body.classList.add('speaking');
    if (window.JackVoice && JackVoice.say) JackVoice.say(line);
    else document.body.classList.remove('speaking');
  }

  function tapeHoles(text) {
    var src = String(text || 'JACK');
    var bits = [];
    var i, c;
    for (i = 0; i < 12; i++) {
      c = src.charCodeAt(i % src.length) || 17;
      bits.push(((c * (i + 3)) + src.length) % 5 === 0);
    }
    return bits;
  }

  function tapeCell(action, target, result) {
    var el = document.createElement('div');
    el.className = 'tape-cell';
    var holes = document.createElement('span');
    holes.className = 'tape-holes';
    var bits = tapeHoles(action + target + result);
    var i, hole;
    for (i = 0; i < bits.length; i++) {
      hole = document.createElement('i');
      if (bits[i]) hole.className = 'on';
      holes.appendChild(hole);
    }
    var line = document.createElement('span');
    line.className = 'tape-line';
    line.textContent = (action + '  ' + target + (result ? '  → ' + result : '')).slice(0, 72);
    el.appendChild(holes);
    el.appendChild(line);
    return el;
  }

  function tapeFeed(action, target, result) {
    var track = $('tapeTrack');
    if (!track) return;
    track.appendChild(tapeCell(action, target, result));
    while (track.children.length > 36) track.removeChild(track.firstChild);
  }

  function showNine(name) {
    nineName = name;
    var label = $('nineName');
    if (label) label.textContent = name;
    if (window.NineBit && NineBit.blit) NineBit.blit($('nine'), pulse, name);
    if (Jack.Sprite && Jack.Sprite.setForm) {
      Jack.Sprite.setForm(WORK_FORMS[TAPE_WAIT.indexOf(name) % WORK_FORMS.length]);
    }
  }

  function tapeWait(on) {
    tapeWaiting = !!on;
    document.body.classList.toggle('waiting', tapeWaiting);
    $('mods').hidden = !tapeWaiting;
    if (tapeWaiting) {
      $('said').textContent = '';
      $('said').hidden = true;
      document.body.classList.remove('speaking');
      try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
      tapeAcc = 0;
      showNine(TAPE_WAIT[0]);
      tapeFeed('PUNCH', 'COL ' + (tapeCol < 10 ? '0' : '') + tapeCol, 'IN FLIGHT');
    } else {
      $('said').hidden = false;
    }
  }

  function tapePump(dt) {
    var track = $('tapeTrack');
    if (!tapeWaiting) return;
    if (window.NineBit && NineBit.blit) NineBit.blit($('nine'), pulse, nineName);
    if (!track) return;
    tapeAcc += dt;
    if (tapeAcc > 0.42) {
      tapeAcc = 0;
      var label = TAPE_WAIT[tapeCol % TAPE_WAIT.length];
      var n = (tapeCol < 10 ? '0' : '') + tapeCol;
      tapeCol = tapeCol >= 80 ? 1 : tapeCol + 1;
      showNine(label);
      tapeFeed(label === 'PUNCH COL' ? 'PUNCH' : label, 'COL ' + n, 'WORKING');
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    tapeOffset -= dt * 110;
    if (track.scrollWidth > 8 && -tapeOffset > track.scrollWidth) tapeOffset = 0;
    track.style.transform = 'translateX(' + Math.round(tapeOffset) + 'px)';
  }

  function appendTalk(who, text) {
    var line = String(text || '').trim();
    if (!line) return;
    var row = (who === 'you' ? 'YOU · ' : 'JACK · ') + line;
    thread.push((who === 'you' ? 'Visitor: ' : 'Clerk: ') + line);
    sitting.push(row);
    if (thread.length > 10) thread = thread.slice(-10);
    if (sitting.length > 200) sitting = sitting.slice(-200);
    var log = $('talkLog');
    if (log) {
      var p = document.createElement('p');
      p.className = who === 'you' ? 'you' : 'clerk';
      p.textContent = (who === 'you' ? 'YOU · ' : 'JACK · ') + line;
      log.appendChild(p);
    }
    if (who === 'you') {
      $('asked').hidden = false;
      $('asked').textContent = 'YOU · ' + line;
    } else {
      $('said').textContent = line;
      $('said').scrollTop = 0;
      speak(line);
    }
  }

  function sittingText() {
    if (!sitting.length) return 'No talk in this sitting.';
    return 'TIMETRAVELLERSGUILD.COM · JACK\n\n' + sitting.join('\n\n');
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  function copyChat() {
    var btn = $('btnCopyChat');
    if (!btn) return;
    var text = sittingText();
    var done = function (ok) {
      btn.classList.toggle('done', !!ok);
      btn.setAttribute('aria-label', ok ? 'Copied' : 'Copy failed');
      btn.title = ok ? 'Copied' : 'Copy failed';
      clearTimeout(copyReset);
      copyReset = setTimeout(function () {
        btn.classList.remove('done');
        btn.setAttribute('aria-label', 'Copy chat');
        btn.title = 'Copy chat';
      }, 1800);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }).catch(function () {
        done(legacyCopy(text));
      });
      return;
    }
    done(legacyCopy(text));
  }

  function ask(q) {
    q = String(q || '').replace(/\s+/g, ' ').trim();
    if (!q || asking) return;
    asking = true;
    $('btnAsk').disabled = true;
    $('btnAsk').textContent = '…';
    appendTalk('you', q);
    tapeWait(true);
    if (window.JackVoice && JackVoice.unlock) JackVoice.unlock();
    var data = new FormData();
    data.set('csrf', cfg.csrf || '');
    data.set('q', q.slice(0, 2000));
    data.set('intent', 'ask');
    data.set('site', 'jack');
    data.set('stance', stance);
    data.set('focus', STANCES[stance].title);
    data.set('thread', thread.join('\n').slice(0, 1500));
    fetch(cfg.jack || '/now/jack', {
      method: 'POST',
      body: data,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) { return res.json(); }).then(function (j) {
      tapeWait(false);
      var text = (j && j.text) ? j.text : 'The clerk is away from the desk. The room remains.';
      appendTalk('clerk', text);
    }).catch(function () {
      tapeWait(false);
      appendTalk('clerk', 'The line went quiet. The room did not.');
    }).then(function () {
      tapeWait(false);
      asking = false;
      $('btnAsk').disabled = false;
      $('btnAsk').textContent = 'ASK';
    });
  }

  function punchHopper() {
    if (!window.JACK_TAROT || !JACK_TAROT.punch) return;
    $('hopperLoad').hidden = false;
    tapeWait(true);
    if (Jack.Sprite) Jack.Sprite.deal(3);
    JACK_TAROT.punch({
      spread: 'three-stations',
      question: $('askQ').value || '',
      mount: $('hopperGrid'),
      csrf: cfg.csrf || '',
      endpoint: '/jack/tarot/read.php',
      onReading: function (reading) {
        $('hopperLoad').hidden = true;
        tapeWait(false);
        appendTalk('clerk', reading);
      }
    }).catch(function () {
      $('hopperLoad').hidden = true;
      tapeWait(false);
    });
  }

  function stepJack() {
    var to = POSTS[stance] || POSTS.jack;
    jackAt.x += (to.x - jackAt.x) * 0.07;
    jackAt.y += (to.y - jackAt.y) * 0.07;
    jackAt.z += (to.z - jackAt.z) * 0.07;
    jackAt.h += (to.h - jackAt.h) * 0.07;
  }

  function render(t) {
    var dt = lastT ? Math.min(0.05, t - lastT) : 0.016;
    lastT = t;
    pulse = t;
    resize();
    yaw += (tyaw - yaw) * 0.08;
    pitch += (tpitch - pitch) * 0.08;
    stepJack();
    tapePump(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PLASTIC;
    ctx.fillRect(0, 0, w, h);
    if (Jack.Sprite && Jack.Sprite.tick) {
      Jack.Sprite.tick(t, Jack.State.get());
    }
    drawSet();
    canvas.style.cursor = hover ? 'pointer' : 'crosshair';
    requestAnimationFrame(function (now) { render(now / 1000); });
  }

  function bind() {
    canvas = $('stage');
    ctx = canvas.getContext('2d');
    if (Jack.Sprite && Jack.Sprite.attachPortrait) Jack.Sprite.attachPortrait($('jackPet'));
    if (window.JackVoice) {
      JackVoice.onend = function () {
        if (!window.speechSynthesis || !speechSynthesis.speaking) {
          document.body.classList.remove('speaking');
        }
      };
    }
    setStance('jack', false);

    canvas.addEventListener('pointerdown', function (e) {
      if (window.JackVoice && JackVoice.unlock) JackVoice.unlock();
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      if (!greeted) {
        greeted = true;
        appendTalk('clerk', STANCES.jack.opening);
      }
    });
    window.addEventListener('pointermove', function (e) {
      hover = stationAt(e.clientX, e.clientY);
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      tyaw = Math.max(-0.82, Math.min(0.82, tyaw - dx * 0.004));
      tpitch = Math.max(-0.28, Math.min(0.32, tpitch + dy * 0.003));
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      if (moved < 10) {
        var id = stationAt(e.clientX, e.clientY);
        if (id) setStance(id, true);
      }
    });

    $('askForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('askQ').value;
      $('askQ').value = '';
      ask(q);
    });
    $('askQ').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var q = $('askQ').value;
        $('askQ').value = '';
        ask(q);
      }
    });
    function syncViewport() {
      var vv = window.visualViewport;
      if (!vv) return;
      var kb = (window.innerHeight - vv.height) > 90;
      document.body.classList.toggle('kb-open', kb);
      document.documentElement.style.setProperty('--vv-top', vv.offsetTop + 'px');
      document.documentElement.style.setProperty('--vv-height', vv.height + 'px');
    }
    syncViewport();
    window.addEventListener('resize', syncViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncViewport);
      window.visualViewport.addEventListener('scroll', syncViewport);
    }
    $('askQ').addEventListener('focus', function () {
      setTimeout(syncViewport, 50);
      setTimeout(syncViewport, 300);
    });
    $('askQ').addEventListener('blur', function () {
      setTimeout(syncViewport, 50);
      setTimeout(syncViewport, 300);
    });
    $('btnCopyChat').addEventListener('click', copyChat);
    $('btnPunch').addEventListener('click', punchHopper);
    $('btnHopperClose').addEventListener('click', function () { setStance('jack', false); });
    requestAnimationFrame(function (now) { render(now / 1000); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
