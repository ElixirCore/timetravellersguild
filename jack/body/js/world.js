/* First-person punchcard office. Manila stock, IBM 5081 faces, desk photograph. */
(function (J) {
  'use strict';

  var canvas;
  var ctx;
  var w = 1;
  var h = 1;
  var fov = 420;
  var hoverId = null;
  var pulse = 0;
  var seedRoom = null;
  var PAPER = '#e8d2a4';
  var NAVY = '#1e3a5f';
  var SCARLET = '#c41e3a';
  var INK = '#1a2438';
  var PLASTIC = '#111214';
  var CUBE = {
    floor: '#FFD500',
    ceil: '#F5F5F5',
    north: '#C41E3A',
    south: '#FF6A00',
    west: '#0051BA',
    east: '#009E60'
  };
  var tiles = [];
  var pointer = { x: 0, y: 0, on: false };
  var horizonY = 1;

  function $(id) { return document.getElementById(id); }

  function layoutSize() {
    var vv = window.visualViewport;
    if (vv && vv.scale > 1.02) {
      return { w: Math.round(vv.width), h: Math.round(vv.height) };
    }
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function measureVisible(dpr) {
    horizonY = h * 0.46;
    var visH = h;
    var narrow = window.innerWidth < 820;
    var el = $('console');
    if (narrow && el) {
      var r = el.getBoundingClientRect();
      var vv = window.visualViewport;
      var layoutH = vv ? vv.height : window.innerHeight;
      var top = r.top - (vv ? vv.offsetTop : 0);
      var cover = Math.max(0, layoutH - Math.max(0, top));
      visH = Math.max(layoutH * 0.28, layoutH - cover) * dpr;
      horizonY = visH * 0.48;
    }
    fov = narrow ? w * 1.12 : Math.min(w, visH) * 0.92;
  }

  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = layoutSize();
    var cw = size.w;
    var ch = size.h;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
    }
    w = canvas.width;
    h = canvas.height;
    measureVisible(dpr);
  }

  function project(x, y, z) {
    var st = J.State.get();
    var b = st.body;
    var dx = x - b.position.x;
    var dy = y - b.position.y;
    var dz = z - b.position.z;
    var yaw = b.yaw + (J.Mabel && J.Mabel.yawOffset ? J.Mabel.yawOffset() : 0);
    var cy = Math.cos(-yaw);
    var sy = Math.sin(-yaw);
    var rx = dx * cy - dz * sy;
    var rz = dx * sy + dz * cy;
    var cp = Math.cos(-b.pitch);
    var sp = Math.sin(-b.pitch);
    var ry = dy * cp - rz * sp;
    rz = dy * sp + rz * cp;
    if (rz < 0.12) return null;
    var f = fov / rz;
    return { x: w * 0.5 + rx * f, y: horizonY - ry * f, z: rz, s: f };
  }

  function shade(hex, z, lift) {
    var t = Math.max(0.28, Math.min(1, 1.05 - z / 18 + (lift || 0)));
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * t);
    var g = Math.round(((n >> 8) & 255) * t);
    var b = Math.round((n & 255) * t);
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
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.stroke(); }
  }

  function drawLine(a, b, col, width) {
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = col;
    ctx.lineWidth = width || 1;
    ctx.stroke();
  }

  /* Affine textured triangle. */
  function texTri(img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
    if (!img) return;
    var iw = img.width || img.canvas && img.canvas.width;
    var ih = img.height || img.canvas && img.canvas.height;
    if (!iw) { iw = img.width; ih = img.height; }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath();
    ctx.clip();
    var denom = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
    if (Math.abs(denom) < 1e-6) { ctx.restore(); return; }
    var m11 = -(v0 * (x2 - x1) - v1 * (x2 - x0) + v2 * (x1 - x0)) / denom * iw;
    var m12 = (v0 * (y2 - y1) - v1 * (y2 - y0) + v2 * (y1 - y0)) / denom * iw;
    var m21 = (u0 * (x2 - x1) - u1 * (x2 - x0) + u2 * (x1 - x0)) / denom * ih;
    var m22 = -(u0 * (y2 - y1) - u1 * (y2 - y0) + u2 * (y1 - y0)) / denom * ih;
    var dx = (u0 * (v1 * x2 - v2 * x1) - u1 * (v0 * x2 - v2 * x0) + u2 * (v0 * x1 - v1 * x0)) / denom;
    var dy = (u0 * (v1 * y2 - v2 * y1) - u1 * (v0 * y2 - v2 * y0) + u2 * (v0 * y1 - v1 * y0)) / denom;
    ctx.setTransform(m11, m12, m21, m22, dx, dy);
    ctx.drawImage(img, 0, 0, iw, ih);
    ctx.restore();
  }

  function texQuad(img, p0, p1, p2, p3) {
    if (!img || !p0 || !p1 || !p2 || !p3) return;
    texTri(img, p0.x, p0.y, p1.x, p1.y, p3.x, p3.y, 0, 0, 1, 0, 0, 1);
    texTri(img, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, 1, 0, 1, 1, 0, 1);
  }

  function wallQuad(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, img, fill) {
    var p = [project(x0, y0, z0), project(x1, y1, z1), project(x2, y2, z2), project(x3, y3, z3)];
    var z = 8;
    var n = 0;
    for (var i = 0; i < 4; i++) if (p[i]) { z += p[i].z; n++; }
    if (n < 4) return;
    poly(p, fill || shade(PAPER, z / n), shade(NAVY, z / n), 1.2);
    if (img) texQuad(img, p[3], p[2], p[1], p[0]);
  }

  function boundsOf() {
    return J.State.get().room.bounds || { minX: -3.6, maxX: 3.6, minZ: -3.6, maxZ: 3.6, height: 3.6 };
  }

  function stickerQuad(face, col, row, b) {
    var gutter = 0.1;
    var x0 = b.minX, x1 = b.maxX, z0 = b.minZ, z1 = b.maxZ, yh = b.height;
    var wx = x1 - x0, wz = z1 - z0;
    var cx, cz, cy, w, h;
    if (face === 'floor' || face === 'ceil') {
      w = (wx - gutter * 4) / 3;
      h = (wz - gutter * 4) / 3;
      cx = x0 + gutter + col * (w + gutter);
      cz = z0 + gutter + row * (h + gutter);
      cy = face === 'floor' ? 0.01 : yh - 0.01;
      return [
        [cx, cy, cz], [cx + w, cy, cz], [cx + w, cy, cz + h], [cx, cy, cz + h]
      ];
    }
    if (face === 'north' || face === 'south') {
      w = (wx - gutter * 4) / 3;
      h = (yh - gutter * 4) / 3;
      cx = x0 + gutter + col * (w + gutter);
      cy = gutter + row * (h + gutter);
      cz = face === 'north' ? z0 + 0.02 : z1 - 0.02;
      return [
        [cx, cy, cz], [cx + w, cy, cz], [cx + w, cy + h, cz], [cx, cy + h, cz]
      ];
    }
    w = (wz - gutter * 4) / 3;
    h = (yh - gutter * 4) / 3;
    cz = z0 + gutter + col * (w + gutter);
    cy = gutter + row * (h + gutter);
    cx = face === 'west' ? x0 + 0.02 : x1 - 0.02;
    return [
      [cx, cy, cz], [cx, cy, cz + w], [cx, cy + h, cz + w], [cx, cy + h, cz]
    ];
  }

  function buildTiles() {
    tiles = [];
    var b = boundsOf();
    var faces = ['floor', 'ceil', 'north', 'south', 'west', 'east'];
    var names = { floor: 'YELLOW FACE', ceil: 'WHITE FACE', north: 'RED FACE', south: 'ORANGE FACE', west: 'BLUE FACE', east: 'GREEN FACE' };
    var r, c, f, q, mid;
    for (f = 0; f < faces.length; f++) {
      for (r = 0; r < 3; r++) {
        for (c = 0; c < 3; c++) {
          q = stickerQuad(faces[f], c, r, b);
          mid = [
            (q[0][0] + q[2][0]) / 2,
            (q[0][1] + q[2][1]) / 2,
            (q[0][2] + q[2][2]) / 2
          ];
          tiles.push({
            id: 'tile-' + faces[f] + '-' + c + r,
            label: names[faces[f]] + ' · ' + (r * 3 + c + 1),
            type: 'cube-tile',
            face: faces[f],
            color: CUBE[faces[f]],
            x: mid[0], y: mid[1], z: mid[2],
            w: 1.05, h: 1.05, d: 0.08,
            quad: q,
            metadata: {
              role: 'inner face of the cube',
              note: 'The room is the inside of a cube. This sticker is part of the machine, not a person.',
              face: faces[f],
              cell: r * 3 + c + 1
            }
          });
        }
      }
    }
  }

  function drawCube() {
    var b = boundsOf();
    var x0 = b.minX, x1 = b.maxX, z0 = b.minZ, z1 = b.maxZ, yh = b.height;
    wallQuad(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1, null, PLASTIC);
    wallQuad(x0, yh, z0, x1, yh, z0, x1, yh, z1, x0, yh, z1, null, PLASTIC);
    wallQuad(x0, 0, z0, x1, 0, z0, x1, yh, z0, x0, yh, z0, null, PLASTIC);
    wallQuad(x0, 0, z1, x1, 0, z1, x1, yh, z1, x0, yh, z1, null, PLASTIC);
    wallQuad(x0, 0, z0, x0, 0, z1, x0, yh, z1, x0, yh, z0, null, PLASTIC);
    wallQuad(x1, 0, z0, x1, 0, z1, x1, yh, z1, x1, yh, z0, null, PLASTIC);
    var i, q, p, selected, fill;
    for (i = 0; i < tiles.length; i++) {
      q = tiles[i].quad;
      p = [project(q[0][0], q[0][1], q[0][2]), project(q[1][0], q[1][1], q[1][2]), project(q[2][0], q[2][1], q[2][2]), project(q[3][0], q[3][1], q[3][2])];
      if (!p[0] || !p[1] || !p[2] || !p[3]) continue;
      selected = J.State.get().room.selectedObject === tiles[i].id || hoverId === tiles[i].id;
      fill = selected ? '#ffe08a' : tiles[i].color;
      poly(p, fill, selected ? '#1a2438' : PLASTIC, selected ? 3 : 2);
    }
  }

  function drawBox3(o, selected) {
    var hw = (o.w || 0.6) / 2, hd = (o.d || 0.5) / 2;
    var y0 = o.y || 0, y1 = y0 + (o.h || 0.8);
    var x = o.x, z = o.z;
    var faces = [
      [[x - hw, y0, z - hd], [x + hw, y0, z - hd], [x + hw, y1, z - hd], [x - hw, y1, z - hd]],
      [[x - hw, y0, z + hd], [x + hw, y0, z + hd], [x + hw, y1, z + hd], [x - hw, y1, z + hd]],
      [[x - hw, y0, z - hd], [x - hw, y0, z + hd], [x - hw, y1, z + hd], [x - hw, y1, z - hd]],
      [[x + hw, y0, z - hd], [x + hw, y0, z + hd], [x + hw, y1, z + hd], [x + hw, y1, z - hd]],
      [[x - hw, y1, z - hd], [x + hw, y1, z - hd], [x + hw, y1, z + hd], [x - hw, y1, z + hd]]
    ];
    var i, p, zsum, n, j;
    for (i = 0; i < faces.length; i++) {
      p = []; zsum = 0; n = 0;
      for (j = 0; j < 4; j++) {
        p[j] = project(faces[i][j][0], faces[i][j][1], faces[i][j][2]);
        if (p[j]) { zsum += p[j].z; n++; }
      }
      if (n < 3) continue;
      poly(p, shade(o.color || PAPER, zsum / n, selected ? 0.12 : 0), selected ? SCARLET : NAVY, selected ? 2.4 : 1);
    }
    var top = project(x, y1 + 0.12, z);
    if (top && top.z < 11) {
      ctx.font = '600 ' + Math.max(10, Math.min(18, 300 / top.z)) + 'px "Courier New", monospace';
      ctx.fillStyle = selected ? SCARLET : INK;
      ctx.textAlign = 'center';
      ctx.fillText(o.label, top.x, top.y);
    }
  }

  function drawRoom() {
    if (!tiles.length) buildTiles();
    drawCube();
  }

  function cardFace(o, selected) {
    var hw = (o.w || 0.7) / 2;
    var y0 = o.y || 0;
    var y1 = y0 + (o.h || 1.5);
    var z = o.z;
    var punch = Math.sin(pulse * 6) * (o.id === 'obj-jack-clerk' ? 0.03 : 0);
    var p0 = project(o.x - hw, y1, z + punch);
    var p1 = project(o.x + hw, y1, z + punch);
    var p2 = project(o.x + hw, y0, z);
    var p3 = project(o.x - hw, y0, z);
    var img = J.Textures.faceFor(o);
    if (p0 && p1 && p2 && p3) {
      poly([p0, p1, p2, p3], shade(PAPER, (p0.z + p2.z) / 2), selected ? SCARLET : NAVY, selected ? 3 : 1.5);
      texQuad(img, p0, p1, p2, p3);
    }
    /* thickness */
    var p1b = project(o.x + hw, y1, z + (o.d || 0.08));
    var p2b = project(o.x + hw, y0, z + (o.d || 0.08));
    poly([p1, p1b, p2b, p2], shade('#c9b48a', 8), NAVY, 1);
    var top = project(o.x, y1 + 0.16, z);
    if (top && top.z < 13) {
      ctx.font = '600 ' + Math.max(11, Math.min(22, 340 / top.z)) + 'px "Courier New", monospace';
      ctx.fillStyle = selected ? SCARLET : INK;
      ctx.textAlign = 'center';
      ctx.fillText(o.label, top.x, top.y);
    }
  }

  function drawDoor(o, selected) {
    var hw = (o.w || 0.14) / 2, hd = (o.d || 1.1) / 2;
    var y0 = o.y || 0, y1 = y0 + (o.h || 2.2);
    var x = o.x, z = o.z;
    var jamb = selected ? SCARLET : NAVY;
    var panel = selected ? '#2a4a72' : '#1e3a5f';
    var faces = [
      [[x - hw, y0, z - hd], [x + hw, y0, z - hd], [x + hw, y1, z - hd], [x - hw, y1, z - hd]],
      [[x - hw, y0, z + hd], [x + hw, y0, z + hd], [x + hw, y1, z + hd], [x - hw, y1, z + hd]],
      [[x - hw, y0, z - hd], [x - hw, y0, z + hd], [x - hw, y1, z + hd], [x - hw, y1, z - hd]],
      [[x + hw, y0, z - hd], [x + hw, y0, z + hd], [x + hw, y1, z + hd], [x + hw, y1, z - hd]]
    ];
    var i, p, zsum, n, j;
    for (i = 0; i < faces.length; i++) {
      p = []; zsum = 0; n = 0;
      for (j = 0; j < 4; j++) {
        p[j] = project(faces[i][j][0], faces[i][j][1], faces[i][j][2]);
        if (p[j]) { zsum += p[j].z; n++; }
      }
      if (n < 3) continue;
      poly(p, shade(panel, zsum / n, selected ? 0.16 : 0), jamb, selected ? 2.6 : 1.4);
    }
    var inset = 0.16;
    var leaf = [
      [x + (x > 0 ? -hw - 0.02 : hw + 0.02), y0 + 0.12, z - hd + inset],
      [x + (x > 0 ? -hw - 0.02 : hw + 0.02), y0 + 0.12, z + hd - inset],
      [x + (x > 0 ? -hw - 0.02 : hw + 0.02), y1 - 0.12, z + hd - inset],
      [x + (x > 0 ? -hw - 0.02 : hw + 0.02), y1 - 0.12, z - hd + inset]
    ];
    p = [project(leaf[0][0], leaf[0][1], leaf[0][2]), project(leaf[1][0], leaf[1][1], leaf[1][2]), project(leaf[2][0], leaf[2][1], leaf[2][2]), project(leaf[3][0], leaf[3][1], leaf[3][2])];
    poly(p, shade('#d9cb9e', 6, selected ? 0.1 : 0), jamb, 1.2);
    var knobZ = z + hd * 0.28;
    var knob = project(x + (x > 0 ? -hw - 0.05 : hw + 0.05), y0 + 1.05, knobZ);
    if (knob && knob.z < 12) {
      ctx.fillStyle = SCARLET;
      ctx.beginPath();
      ctx.arc(knob.x, knob.y, Math.max(3, 28 / knob.z), 0, Math.PI * 2);
      ctx.fill();
    }
    var top = project(x, y1 + 0.14, z);
    if (top && top.z < 14) {
      ctx.font = '600 ' + Math.max(10, Math.min(18, 300 / top.z)) + 'px "Courier New", monospace';
      ctx.fillStyle = selected ? SCARLET : PAPER;
      ctx.textAlign = 'center';
      ctx.fillText(o.label, top.x, top.y);
    }
  }

  function drawJackSpirit(o, selected) {
    var punch = (Math.sin(pulse * 5.2) + 1) * 0.03;
    var arm = J.Textures.card && J.Textures.card('default');
    if (arm) {
      wallQuad(o.x + 0.18, 0.81, -0.22 + punch, o.x + 0.62, 0.81, -0.22 + punch, o.x + 0.62, 0.81, 0.08 + punch, o.x + 0.18, 0.81, 0.08 + punch, arm, PAPER);
    }
    if (J.Sprite && J.Sprite.drawInWorld) J.Sprite.drawInWorld(ctx, project, o, selected, pulse);
  }

  function pointInPoly(x, y, pts) {
    var inside = false;
    var i, j, xi, yi, xj, yj;
    for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      xi = pts[i].x; yi = pts[i].y; xj = pts[j].x; yj = pts[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }

  function projectedHit(o) {
    var pts = [];
    var i, p, z = 0;
    if (o.quad && o.quad.length >= 4) {
      for (i = 0; i < 4; i++) {
        p = project(o.quad[i][0], o.quad[i][1], o.quad[i][2]);
        if (!p || p.z < 0.4) return null;
        pts.push(p);
        z += p.z;
      }
      return { id: o.id, tile: true, pts: pts, z: z / 4 };
    }
    var hw = (o.w || 0.6) / 2, hd = (o.d || 0.5) / 2;
    var y0 = o.y || 0, y1 = y0 + (o.h || 0.8);
    var corners = [
      [o.x - hw, y0, o.z - hd], [o.x + hw, y0, o.z - hd],
      [o.x + hw, y1, o.z + hd], [o.x - hw, y1, o.z + hd],
      [o.x, y0 + (o.h || 0.8) * 0.5, o.z]
    ];
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, n = 0;
    for (i = 0; i < corners.length; i++) {
      p = project(corners[i][0], corners[i][1], corners[i][2]);
      if (!p) continue;
      n++; z += p.z;
      if (p.x < minx) minx = p.x;
      if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y;
      if (p.y > maxy) maxy = p.y;
    }
    if (n < 2 || z / n < 0.4) return null;
    return { id: o.id, tile: false, minx: minx, maxx: maxx, miny: miny, maxy: maxy, z: z / n };
  }

  function pickables() {
    var things = [];
    var walls = [];
    var objs = J.State.get().room.objects;
    var i, hit, o;
    for (i = 0; i < objs.length; i++) {
      o = objs[i];
      hit = projectedHit(o);
      if (!hit) continue;
      if (o.type === 'cube-tile' || hit.tile) walls.push(hit);
      else things.push(hit);
    }
    things.sort(function (a, b) { return a.z - b.z; });
    walls.sort(function (a, b) { return a.z - b.z; });
    return things.concat(walls);
  }

  function objectAt(sx, sy) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var vv = window.visualViewport;
    var x = (sx - (vv ? vv.offsetLeft : 0)) * dpr;
    var y = (sy - (vv ? vv.offsetTop : 0)) * dpr;
    var hits = pickables();
    var pad = 10 * dpr;
    var hit;
    for (var i = 0; i < hits.length; i++) {
      hit = hits[i];
      if (hit.pts) {
        if (pointInPoly(x, y, hit.pts)) return hit.id;
        continue;
      }
      if (x >= hit.minx - pad && x <= hit.maxx + pad && y >= hit.miny - pad && y <= hit.maxy + pad) {
        return hit.id;
      }
    }
    return null;
  }

  function focusFromGaze() {
    var hits = pickables();
    var cx = w * 0.5;
    var cy = horizonY;
    var best = null;
    var bestD = 1e9;
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].z > 10) continue;
      var mx = (hits[i].minx + hits[i].maxx) / 2;
      var my = (hits[i].miny + hits[i].maxy) / 2;
      var d = Math.hypot(mx - cx, my - cy);
      var inside = cx >= hits[i].minx && cx <= hits[i].maxx && cy >= hits[i].miny && cy <= hits[i].maxy;
      if (inside && d < bestD) { bestD = d; best = hits[i].id; }
    }
    hoverId = best;
    return best;
  }

  function render(t) {
    pulse = t || 0;
    if (!ctx) return;
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PLASTIC;
    ctx.fillRect(0, 0, w, h);

    drawRoom();
    var st = J.State.get();
    var selected = st.room.selectedObject;
    var objs = st.room.objects.slice().filter(function (o) { return o.type !== 'cube-tile'; }).sort(function (a, b) {
      var pa = project(a.x, a.y, a.z);
      var pb = project(b.x, b.y, b.z);
      return (pb ? pb.z : 0) - (pa ? pa.z : 0);
    });
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      var on = o.id === selected || o.id === hoverId;
      if (o.id === 'obj-jack-clerk') drawJackSpirit(o, on);
      else if (o.type === 'door') drawDoor(o, on);
      else if (o.type !== 'portal') drawBox3(o, on);
    }
    if (J.Aperture && J.Aperture.draw) J.Aperture.draw(ctx, project);
    if (J.Mabel && J.Mabel.draw) J.Mabel.draw(ctx, project);
    if (canvas) canvas.style.cursor = hoverId ? 'pointer' : 'crosshair';

    var rels = st.room.relations || [];
    for (var r = 0; r < rels.length; r++) {
      var a = J.State.byId(rels[r].from);
      var b = J.State.byId(rels[r].to);
      if (!a || !b || typeof a.x !== 'number' || typeof b.x !== 'number') continue;
      drawLine(project(a.x, 0.04, a.z), project(b.x, 0.04, b.z), 'rgba(196,30,58,0.28)', 1);
    }

    var gazed = pointer.on ? objectAt(pointer.x, pointer.y) : focusFromGaze();
    hoverId = gazed;
    var line = $('focusLine');
    if (line) {
      var obj = gazed ? J.State.byId(gazed) : (selected ? J.State.byId(selected) : null);
      line.textContent = obj ? ('FOCUS ' + obj.label) : 'FOCUS —';
    }
  }

  function load() {
    return J.Textures.boot().then(function () {
      return fetch('data/room.json', { cache: 'no-store' });
    }).then(function (res) {
      if (!res.ok) throw new Error('room_missing');
      return res.json();
    }).then(function (room) {
      seedRoom = room;
      J.State.applySeed(room, J.State.loadPersisted());
      buildTiles();
      var i;
      for (i = 0; i < tiles.length; i++) {
        if (!J.State.byId(tiles[i].id)) J.State.get().room.objects.push(tiles[i]);
      }
      J.State.nerve('heart', 'sense', room.id || 'room', 'loaded');
      return room;
    });
  }

  J.World = {
    attach: function (el) { canvas = el; ctx = el.getContext('2d'); resize(); },
    resize: resize,
    render: render,
    load: load,
    seed: function () { return seedRoom; },
    objectAt: objectAt,
    focusFromGaze: focusFromGaze,
    hoverId: function () { return hoverId; },
    pointer: function (x, y, on) {
      pointer.x = x;
      pointer.y = y;
      pointer.on = on !== false;
    }
  };
})(window.Jack = window.Jack || {});
