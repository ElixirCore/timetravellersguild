/* The timetree as Jack files it. Canvas is a projection. The JSON is the store. */
(function () {
  'use strict';

  var TREE = window.TTG_TREE || { nodes: [], edges: [], viewer: {}, present: {} };
  var canvas, ctx, w = 1, h = 1, fov = 520;
  var glyphs = {};
  var laid = [];
  var edges = [];
  var sap = [];
  var filter = 'all';
  var query = '';
  var selected = null;
  var hover = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pointer = { x: 0, y: 0, down: false, px: 0, py: 0, dragged: false };
  var cam = { yaw: 0.72, pitch: 0.42, dist: 13.4, lookY: 0.2 };
  var auto = true;
  var hopperPhase = 'VOICE';
  var PAPER = '#d9cb9e';
  var WELL = '#cfc19a';
  var NAVY = '#1e3a5f';
  var INK = '#161814';
  var TERRA = '#b2533e';
  var DIM = '#7b8070';
  var SCARLET = '#c41e3a';
  var RADIUS = { root: 1.05, trunk: 1.85, branch: 3.35, leaf: 4.55, fruit: 2.95 };
  var lastLook = '';
  var delConfirming = false;

  function $(id) { return document.getElementById(id); }

  function hash(s) {
    var n = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
    return (n >>> 0) / 4294967296;
  }

  function shade(hex, t) {
    t = Math.max(0.22, Math.min(1.08, t));
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * t);
    var g = Math.round(((n >> 8) & 255) * t);
    var b = Math.round((n & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function band(z) {
    if (z > 16) return 0.42;
    if (z > 11) return 0.62;
    if (z > 7) return 0.82;
    return 1;
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
    fov = Math.min(w, h) * 0.86;
  }

  function project(x, y, z) {
    var cy = Math.cos(-cam.yaw);
    var sy = Math.sin(-cam.yaw);
    var rx = x * cy - z * sy;
    var rz = x * sy + z * cy;
    var cp = Math.cos(-cam.pitch);
    var sp = Math.sin(-cam.pitch);
    var dy = y - cam.lookY;
    var ry = dy * cp - rz * sp;
    rz = dy * sp + rz * cp;
    rz += cam.dist;
    if (rz < 0.35) return null;
    var f = fov / rz;
    return { x: w * 0.5 + rx * f, y: h * 0.52 - ry * f, z: rz, s: f };
  }

  function bakeGlyphs() {
    var ids = [
      'glyph-00-unclassified', 'glyph-01-operator', 'glyph-02-mabel', 'glyph-03-territory',
      'glyph-04-ledger', 'glyph-05-department', 'glyph-06-edge', 'glyph-07-moonly',
      'glyph-08-provenance', 'glyph-09-jack', 'glyph-10-wheel', 'glyph-11-consent',
      'glyph-12-pretravel', 'glyph-13-station13', 'glyph-14-chronometer', 'glyph-15-elixircorp',
      'glyph-16-house', 'glyph-17-signal', 'glyph-18-anamnesia', 'glyph-19-recollection',
      'glyph-20-audit', 'glyph-21-graph', 'glyph-suit-programme', 'glyph-suit-recollection',
      'glyph-suit-classification', 'glyph-suit-record'
    ];
    var ser = new XMLSerializer();
    ids.forEach(function (id) {
      var g = document.getElementById(id);
      if (!g) return;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="90 190 180 220" width="256" height="312">' +
        ser.serializeToString(g) + '</svg>';
      var img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      glyphs[id] = img;
    });
  }

  function layout() {
    var nodes = TREE.nodes || [];
    var years = nodes.map(function (n) { return n.year || 2026; });
    var ymin = Math.min.apply(null, years.concat([1951]));
    var ymax = Math.max.apply(null, years.concat([2033]));
    if (ymax === ymin) ymax = ymin + 1;
    laid = nodes.map(function (n, i) {
      var u = ((n.year || 2026) - ymin) / (ymax - ymin);
      var zone = n.zone || 'trunk';
      var r = RADIUS[zone] || 2;
      if (n.pending) r += 0.55;
      var a = hash(n.slug || n.id || String(i)) * Math.PI * 2 + u * 2.4;
      var lift = (n.importance || 0.3) * 0.15;
      return {
        n: n,
        a: a,
        r: r,
        y: (u - 0.48) * 7.2 + lift,
        u: u,
        bob: hash((n.slug || '') + 'b') * Math.PI * 2
      };
    });
    var bySlug = {};
    laid.forEach(function (row) {
      if (row.n.slug) bySlug[row.n.slug] = row;
    });
    edges = (TREE.edges || []).map(function (e) {
      return { e: e, a: bySlug[e.source], b: bySlug[e.target] };
    }).filter(function (row) { return row.a && row.b; });
    sap = [];
    if (!reduce) {
      edges.forEach(function (row, i) {
        sap.push({ i: i, t: hash(row.e.source + row.e.target) });
        if (i % 2 === 0) sap.push({ i: i, t: (hash(row.e.target + row.e.source) + 0.5) % 1 });
      });
    }
  }

  function pos(row, t) {
    var bob = row.n.pending && !reduce ? Math.sin(t * 1.5 + row.bob) * 0.14 : 0;
    return {
      x: Math.cos(row.a) * row.r,
      y: row.y + bob,
      z: Math.sin(row.a) * row.r
    };
  }

  function visible(row) {
    if (filter === 'canon' && row.n.pending) return false;
    if (filter === 'pending' && !row.n.pending) return false;
    if (filter !== 'all' && filter !== 'canon' && filter !== 'pending' && (row.n.zone || '') !== filter) return false;
    if (!query) return true;
    var n = row.n || {};
    var hay = [
      n.title, n.body, n.slug, n.place, n.type, n.status, n.standing
    ].join(' ').toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function drawTrunk(t) {
    var rings = 14;
    var i, k, pts, p, ang;
    for (i = 0; i < rings; i++) {
      var y = -3.4 + i * 0.52;
      pts = [];
      for (k = 0; k < 8; k++) {
        ang = (k / 8) * Math.PI * 2 + t * 0.04;
        p = project(Math.cos(ang) * 0.42, y, Math.sin(ang) * 0.42);
        if (p) pts.push(p);
      }
      if (pts.length < 4) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.closePath();
      ctx.fillStyle = shade(i % 2 ? WELL : PAPER, band(pts[0].z) * 0.9);
      ctx.fill();
      ctx.strokeStyle = shade(NAVY, band(pts[0].z));
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function drawHoop(y, label, color, dash) {
    var pts = [];
    var k, p;
    for (k = 0; k < 48; k++) {
      var ang = (k / 48) * Math.PI * 2;
      p = project(Math.cos(ang) * 5.1, y, Math.sin(ang) * 5.1);
      if (p) pts.push(p);
    }
    if (pts.length < 8) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    if (dash) ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    var tag = project(5.3, y, 0);
    if (tag && tag.z < 18) {
      ctx.fillStyle = color;
      ctx.font = '600 11px "Courier New", monospace';
      ctx.fillText(label, tag.x, tag.y);
    }
  }

  function drawEdge(row, t) {
    if (!visible(row.a) || !visible(row.b)) return;
    var A = pos(row.a, t);
    var B = pos(row.b, t);
    var mx = (A.x + B.x) * 0.5;
    var my = (A.y + B.y) * 0.5 + 0.55;
    var mz = (A.z + B.z) * 0.5;
    var pa = project(A.x, A.y, A.z);
    var pm = project(mx, my, mz);
    var pb = project(B.x, B.y, B.z);
    if (!pa || !pm || !pb) return;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.quadraticCurveTo(pm.x, pm.y, pb.x, pb.y);
    ctx.strokeStyle = shade(row.e.pending ? TERRA : NAVY, band((pa.z + pb.z) * 0.5));
    ctx.lineWidth = row.e.pending ? 1.4 : 1.8;
    ctx.setLineDash(row.e.pending ? [5, 5] : [10, 7]);
    ctx.lineDashOffset = reduce ? 0 : -t * 28;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawSap(t) {
    sap.forEach(function (s) {
      var row = edges[s.i];
      if (!row || !visible(row.a) || !visible(row.b)) return;
      var u = (s.t + t * 0.08) % 1;
      var A = pos(row.a, t);
      var B = pos(row.b, t);
      var omu = 1 - u;
      var x = omu * omu * A.x + 2 * omu * u * (A.x + B.x) * 0.5 + u * u * B.x;
      var y = omu * omu * A.y + 2 * omu * u * ((A.y + B.y) * 0.5 + 0.55) + u * u * B.y;
      var z = omu * omu * A.z + 2 * omu * u * (A.z + B.z) * 0.5 + u * u * B.z;
      var p = project(x, y, z);
      if (!p || p.z > 20) return;
      ctx.fillStyle = shade(row.e.pending ? TERRA : SCARLET, band(p.z));
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.4, p.s * 0.012), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawCard(row, t) {
    if (!visible(row)) return null;
    var P = pos(row, t);
    var p = project(P.x, P.y, P.z);
    if (!p) return null;
    var sel = selected && selected.n.slug === row.n.slug;
    var hot = hover && hover.n.slug === row.n.slug;
    var size = (0.42 + (row.n.importance || 0.3) * 0.28) * (sel ? 1.28 : 1);
    var hw = size * 0.62 * p.s;
    var hh = size * p.s;
    var lift = band(p.z);
    var fill = row.n.pending ? shade('#e2c49a', lift) : shade(WELL, lift);
    var ink = shade(row.n.pending ? TERRA : NAVY, lift);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(row.a + cam.yaw) * 0.08);
    ctx.fillStyle = 'rgba(22,24,20,' + (0.16 * lift) + ')';
    ctx.beginPath();
    ctx.moveTo(-hw + 10, -hh + 6);
    ctx.lineTo(hw + 6, -hh + 6);
    ctx.lineTo(hw + 6, hh + 8);
    ctx.lineTo(-hw + 4, hh + 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-hw + 10, -hh);
    ctx.lineTo(hw, -hh);
    ctx.lineTo(hw, hh);
    ctx.lineTo(-hw, hh);
    ctx.lineTo(-hw, -hh + 10);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = sel || hot ? shade(SCARLET, lift) : ink;
    ctx.lineWidth = sel ? 3 : 1.6;
    if (row.n.pending) ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(-hw, -hh + 10);
    ctx.lineTo(-hw + 10, -hh + 10);
    ctx.lineTo(-hw + 10, -hh);
    ctx.fill();
    var g = glyphs[(row.n.standing && row.n.standing.glyph) || 'glyph-00-unclassified'];
    if (g && g.complete && g.naturalWidth) {
      var gw = hw * 1.15;
      var gh = hh * 0.72;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(g, -gw / 2, -hh * 0.62, gw, gh);
      ctx.globalAlpha = 1;
    }
    var punched = row.n.punch && row.n.punch.hash;
    if (punched) drawHoles(ctx, punched, -hw + 6, -hh + 14, hw * 1.7, hh * 0.38, lift);
    if (p.z < 13 || sel) {
      ctx.fillStyle = shade(INK, lift);
      ctx.font = '600 ' + Math.max(9, Math.min(15, hh * 0.16)) + 'px "Courier New", monospace';
      ctx.textAlign = 'center';
      var title = String(row.n.title || '').slice(0, 22);
      ctx.fillText(title, 0, hh * 0.72);
    }
    ctx.restore();
    return { row: row, x: p.x, y: p.y, r: Math.max(hw, hh) * 0.72, z: p.z };
  }

  function paint(now) {
    resize();
    var t = now / 1000;
    if (!reduce && auto && !pointer.down) cam.yaw += 0.12 * (1 / 60);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);

    drawTrunk(t);
    var present = TREE.present || {};
    var years = laid.map(function (r) { return r.n.year || 2026; });
    var ymin = Math.min.apply(null, years.concat([1951]));
    var ymax = Math.max.apply(null, years.concat([2033]));
    if (ymax === ymin) ymax = ymin + 1;
    var netY = ((parseInt(String(present.network || '2033').slice(0, 4), 10) - ymin) / (ymax - ymin) - 0.48) * 7.2;
    var locY = ((parseInt(String(present.local || '2026').slice(0, 4), 10) - ymin) / (ymax - ymin) - 0.48) * 7.2;
    drawHoop(netY, present.network_label || '17.04.2033', shade(NAVY, 0.9), false);
    drawHoop(locY, 'LOCAL PRESENT', shade(TERRA, 0.85), true);
    edges.forEach(function (row) { drawEdge(row, t); });
    if (!reduce) drawSap(t);

    var ordered = laid.slice().sort(function (a, b) {
      var A = pos(a, t);
      var B = pos(b, t);
      var pa = project(A.x, A.y, A.z);
      var pb = project(B.x, B.y, B.z);
      return ((pb && pb.z) || 0) - ((pa && pa.z) || 0);
    });
    var hits = [];
    ordered.forEach(function (row) {
      var hit = drawCard(row, t);
      if (hit) hits.push(hit);
    });
    paint._hits = hits;

    var Spr = window.Jack && window.Jack.Sprite;
    if (Spr) {
      Spr.tick(t, { context: { phase: hopperPhase }, body: { pressure: selected && selected.n.pending ? 0.4 : 0.12 } });
    }
    requestAnimationFrame(paint);
  }

  function pick(x, y) {
    var hits = paint._hits || [];
    var best = null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    x *= dpr;
    y *= dpr;
    hits.forEach(function (c) {
      var d = Math.hypot(c.x - x, c.y - y);
      if (d < c.r && (!best || c.z < best.z)) best = c;
    });
    return best ? best.row : null;
  }

  function hexBits(hex) {
    var bits = [];
    hex = String(hex || '').replace(/[^0-9a-f]/gi, '').toLowerCase();
    var i, n, b;
    for (i = 0; i < hex.length; i++) {
      n = parseInt(hex.charAt(i), 16);
      for (b = 3; b >= 0; b--) bits.push((n >> b) & 1);
    }
    return bits;
  }

  function drawHoles(c, hex, x, y, ww, hh, lift) {
    var bits = hexBits(hex);
    var cols = 22;
    var rows = 12;
    var cw = ww / cols;
    var rh = hh / rows;
    var i, on;
    c.fillStyle = shade(INK, lift * 0.9);
    for (i = 0; i < cols * rows; i++) {
      on = bits[i % bits.length];
      if (!on) continue;
      c.fillRect(x + (i % cols) * cw + 0.4, y + Math.floor(i / cols) * rh + 0.3, Math.max(1, cw - 0.8), Math.max(1, rh - 0.5));
    }
  }

  function holeGrid(hex) {
    var bits = hexBits(hex);
    var html = '';
    var i;
    for (i = 0; i < 22 * 12; i++) {
      html += bits[i % bits.length] ? '<i class="on"></i>' : '<i></i>';
    }
    return html;
  }

  function shortHash(hex) {
    hex = String(hex || '');
    return hex.length > 12 ? hex.slice(0, 12) : hex;
  }

  function addTapeCard(punch, fresh) {
    var track = $('tapeTrack');
    if (!track || !punch || !punch.hash) return;
    if (track.querySelector('[data-hash="' + punch.hash + '"]')) return;
    var el = document.createElement('article');
    el.className = 'punch-card' + (punch.action === 'WRITE_CANON' ? ' write' : '') + (fresh ? ' punching' : '');
    el.setAttribute('data-hash', punch.hash);
    var who = punch.who || {};
    var whoName = who.name || punch.actor || 'Unsigned';
    if (who.keeper) whoName += ' · KEEPER';
    else if (who.known === false || String(punch.actor || '').indexOf('unsigned:') === 0) whoName = who.name || 'Unsigned';
    el.innerHTML = '<p class="punch-act">' + (punch.action || 'PUNCH') + '</p>' +
      '<p class="punch-who"></p>' +
      '<p class="punch-title"></p>' +
      '<div class="punch-holes">' + holeGrid(punch.hash) + '</div>' +
      '<p class="punch-hash">' + shortHash(punch.hash) + '</p>';
    el.querySelector('.punch-who').textContent = whoName;
    el.querySelector('.punch-title').textContent = punch.title || punch.slug || punch.action || '';
    track.appendChild(el);
    track.scrollLeft = track.scrollWidth;
    if ($('tapeTip')) $('tapeTip').textContent = punch.hash;
    TREE.punch_tip = punch.hash;
    if (!(TREE.punches || []).some(function (p) { return p.hash === punch.hash; })) {
      TREE.punches = (TREE.punches || []).concat([punch]);
    }
  }

  function paintPresent(list) {
    var row = $('tapePresent');
    if (!row) return;
    row.innerHTML = '';
    (list || []).forEach(function (p) {
      var el = document.createElement(p.href ? 'a' : 'span');
      if (p.href) el.href = p.href;
      el.className = p.keeper ? 'keeper' : (p.known ? '' : 'unsigned');
      el.textContent = p.keeper ? ((p.name || p.actor) + ' · KEEPER') : (p.known ? (p.name || p.actor) : (p.name || 'Unsigned'));
      row.appendChild(el);
    });
    if (!list || !list.length) {
      var empty = document.createElement('span');
      empty.className = 'unsigned';
      empty.textContent = 'Nobody signed is on the tape';
      row.appendChild(empty);
    }
  }

  function paintTape(list) {
    var track = $('tapeTrack');
    if (!track) return;
    track.innerHTML = '';
    (list || []).forEach(function (p) { addTapeCard(p, false); });
    paintPresent(TREE.on_tape || []);
  }

  function setFormLine(text) {
    var el = $('jackForm');
    if (el) el.textContent = text;
  }

  function pose(form) {
    var Spr = window.Jack && window.Jack.Sprite;
    hopperPhase = form === 'deal' ? 'CARD' : (form === 'punch' ? 'OPERATE' : 'VOICE');
    if (!Spr) return;
    if (form === 'deal' && Spr.deal) Spr.deal(2);
    else if (form === 'punch' && Spr.punch) Spr.punch();
    else if (Spr.setForm) Spr.setForm(form);
  }

  function showSlip(row) {
    selected = row;
    if (delConfirming) {
      delConfirming = false;
      var dBtn = $('btnDelete');
      if (dBtn) { dBtn.textContent = 'DELETE RECORD'; dBtn.removeAttribute('data-confirming'); }
    }
    var slip = $('slip');
    if (!row) {
      slip.hidden = true;
      pointer.down = false;
      if (canvas) canvas.style.pointerEvents = '';
      setFormLine('WALKING THE TREE');
      pose('sit');
      return;
    }
    var n = row.n;
    var st = n.standing || {};
    $('slipStanding').textContent = (st.roman ? st.roman + ' · ' : '') + (st.title || 'UNCLASSIFIED');
    $('slipTitle').textContent = n.title || 'Untitled';
    $('slipMeta').textContent = [
      n.pending ? 'PENDING' : 'CANON',
      n.type,
      n.zone,
      n.year || '—',
      n.place || 'unplaced'
    ].join(' · ');
    $('slipBody').textContent = n.body || '';
    $('slipWhy').textContent = ((n.why && n.why.reasons) || []).join(' ');
    $('slipOpen').href = n.href || ('/n/' + encodeURIComponent(n.slug || '') + '/');
    var originA = $('slipOrigin');
    if (originA) {
      if (n.origin) {
        originA.href = '/navigator/origin.php?slug=' + encodeURIComponent(n.slug || '');
        originA.style.display = '';
      } else {
        originA.style.display = 'none';
      }
    }
    var confirm = $('btnConfirm');
    var reject = $('btnReject');
    var del = $('btnDelete');
    var edit = $('btnEdit');
    var editForm = $('slipEditForm');
    var punched = !!(n.punch && n.punch.hash);
    if (confirm) confirm.hidden = !n.pending || punched;
    if (reject) reject.hidden = !n.pending || punched;
    if (del) del.hidden = !!n.pending;
    if (edit) edit.hidden = !n.pending || punched;
    if (editForm) editForm.hidden = true;
    var hashEl = $('slipHash');
    if (hashEl) {
      hashEl.hidden = !punched;
      hashEl.textContent = punched ? ('PUNCH ' + n.punch.hash) : '';
    }
    slip.hidden = false;
    if (canvas) canvas.style.pointerEvents = 'none';
    setFormLine(n.pending ? 'THE HOPPER IS OPEN' : (punched ? 'PUNCHED' : (st.title || 'ON FILE')));
    pose(n.pending ? 'deal' : (punched ? 'punch' : 'speak'));
    if (n.slug) history.replaceState(null, '', '#/' + encodeURIComponent(n.slug));
    if (n.slug && n.slug !== lastLook) {
      lastLook = n.slug;
      punchAction('look', n.slug);
    }
  }

  // Swipe/arrow stepping through the cards of the current selection (filter + search),
  // in the tree's own time order (year), so the slip stays open between cards.
  function stepSlip(dir) {
    if (!selected) return;
    var ef = $('slipEditForm');
    if (ef && !ef.hidden) return;
    var list = laid.map(function (r, i) { return { r: r, i: i }; })
      .filter(function (o) { return visible(o.r); })
      .sort(function (a, b) { return ((a.r.n.year || 0) - (b.r.n.year || 0)) || (a.i - b.i); })
      .map(function (o) { return o.r; });
    var at = -1;
    list.forEach(function (r, i) { if (r.n.slug === selected.n.slug) at = i; });
    var to = at < 0 ? (dir > 0 ? 0 : list.length - 1) : at + dir;
    if (to < 0 || to >= list.length) return;
    showSlip(list[to]);
    var sl = $('slip');
    if (sl) sl.scrollTop = 0;
  }

  function counts() {
    var c = 0, p = 0;
    (TREE.nodes || []).forEach(function (n) {
      if (n.pending) p++;
      else c++;
    });
    $('countCanon').textContent = String(c);
    $('countPending').textContent = String(p);
  }

  function post(action, slug, detail, data) {
    var body = { action: action, slug: slug || '', detail: detail || '', csrf: TREE.csrf || '' };
    if (data) body.data = data;
    return fetch('/navigator/act.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  function punchAction(action, slug, detail) {
    return post(action, slug, detail).then(function (res) {
      if (res && res.on_tape) {
        TREE.on_tape = res.on_tape;
        paintPresent(res.on_tape);
      }
      if (res && res.punch) {
        addTapeCard(res.punch, true);
        if (action === 'confirm' || action === 'reject' || action === 'return') pose('punch');
      }
      return res;
    });
  }

  function bind() {
    canvas = $('tree');
    ctx = canvas.getContext('2d');
    bakeGlyphs();
    layout();
    counts();
    paintTape(TREE.punches || []);
    var Spr = window.Jack && window.Jack.Sprite;
    if (Spr && $('jackPet')) Spr.attachPortrait($('jackPet'));

    $('filters').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      filter = btn.getAttribute('data-filter');
      Array.prototype.forEach.call($('filters').querySelectorAll('button'), function (b) {
        b.classList.toggle('on', b === btn);
      });
      punchAction('filter', filter, filter);
    });

    var search = $('treeSearch');
    if (search) {
      search.addEventListener('input', function () {
        query = String(search.value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var hits = laid.filter(visible);
        if (hits.length === 1 && hits[0]) {
          showSlip(hits[0]);
        }
      });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          search.value = '';
          query = '';
          search.blur();
        }
      });
    }

    canvas.addEventListener('pointerdown', function (e) {
      pointer.down = true;
      pointer.dragged = false;
      pointer.px = e.clientX;
      pointer.py = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      hover = pick(e.clientX, e.clientY);
      canvas.style.cursor = hover ? 'pointer' : 'grab';
      if (!pointer.down) return;
      var dx = e.clientX - pointer.px;
      var dy = e.clientY - pointer.py;
      if (Math.abs(dx) + Math.abs(dy) > 4) pointer.dragged = true;
      cam.yaw += dx * 0.005;
      cam.pitch = Math.max(-0.2, Math.min(1.1, cam.pitch + dy * 0.004));
      pointer.px = e.clientX;
      pointer.py = e.clientY;
      auto = false;
    });
    canvas.addEventListener('pointerup', function (e) {
      if (pointer.down && !pointer.dragged) showSlip(pick(e.clientX, e.clientY));
      pointer.down = false;
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.dist = Math.max(6.5, Math.min(22, cam.dist + e.deltaY * 0.01));
      auto = false;
    }, { passive: false });

    var pinch = { active: false, dist: 0 };
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinch.active = true;
        pinch.dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      } else {
        pinch.active = false;
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (!pinch.active || e.touches.length !== 2) return;
      e.preventDefault();
      var d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      cam.dist = Math.max(6.5, Math.min(22, cam.dist - (d - pinch.dist) * 0.04));
      pinch.dist = d;
      auto = false;
    }, { passive: false });
    canvas.addEventListener('touchend', function () { pinch.active = false; }, { passive: true });

    var confirm = $('btnConfirm');
    var reject = $('btnReject');
    if (confirm) {
      confirm.addEventListener('click', function () {
        if (!selected || !selected.n.pending) return;
        var slug = selected.n.slug;
        confirm.disabled = true;
        pose('punch');
        punchAction('confirm', slug).then(function (res) {
          confirm.disabled = false;
          if (!res || !res.ok) {
            $('slipNote').textContent = (res && res.error) || 'The slip was not punched.';
            return;
          }
          TREE.nodes = (TREE.nodes || []).map(function (n) {
            if (n.slug !== slug) return n;
            n.pending = false;
            n.status = 'ACTIVE';
            n.punch = (res.node && res.node.punch) || (res.punch ? {
              hash: res.punch.hash,
              prev: res.punch.prev,
              body_hash: res.punch.body_hash,
              irreversible: true
            } : n.punch);
            return n;
          });
          layout();
          counts();
          // The slip leaves the hopper: close it, drop the pending hash, and
          // let the card sink into the canon field.
          showSlip(null);
          history.replaceState(null, '', location.pathname + location.search);
          lastLook = '';
          setFormLine('PUNCHED INTO CANON');
          pose('punch');
          // Stay on the navigator: the record has left pending, ready for
          // the next click. (No redirect to the lodge - Toby, 7 Nov 2026.)
        }).catch(function () {
          confirm.disabled = false;
          $('slipNote').textContent = 'The field could not be reached.';
        });
      });
    }
    if (reject) {
      reject.addEventListener('click', function () {
        if (!selected || !selected.n.pending) return;
        var slug = selected.n.slug;
        reject.disabled = true;
        reject.textContent = 'RETURNING…';
        punchAction('reject', slug).then(function (res) {
          reject.disabled = false;
          reject.textContent = 'RETURN SLIP';
          if (!res || !res.ok) {
            $('slipNote').textContent = (res && res.error) || 'The slip was not returned.';
            return;
          }
          TREE.nodes = (TREE.nodes || []).filter(function (n) { return n.slug !== slug; });
          layout();
          counts();
          showSlip(null);
          setFormLine('RETURNED');
        }).catch(function (err) {
          reject.disabled = false;
          reject.textContent = 'RETURN SLIP';
          $('slipNote').textContent = 'The hopper could not be reached.';
          console.error('reject failed:', err);
        });
      });
    }

    var editBtn = $('btnEdit');
    var editForm = $('slipEditForm');
    var saveBtn = $('btnSavePending');
    var cancelBtn = $('btnEditCancel');
    if (editBtn && editForm) {
      editBtn.addEventListener('click', function () {
        if (!selected || !selected.n.pending) return;
        var n = selected.n;
        var et = $('editTitle'); if (et) et.value = n.title || '';
        var eb = $('editBody'); if (eb) eb.value = n.body || '';
        var ety = $('editType'); if (ety) ety.value = n.type || '';
        var ey = $('editYear'); if (ey) ey.value = n.year || '';
        var ez = $('editZone'); if (ez) ez.value = n.zone || 'leaf';
        var ep = $('editPlace'); if (ep) ep.value = n.place || '';
        var en = $('editNote'); if (en) en.textContent = '';
        editForm.hidden = false;
        if (et) et.focus();
      });
    }
    if (cancelBtn && editForm) {
      cancelBtn.addEventListener('click', function () {
        editForm.hidden = true;
      });
    }
    if (saveBtn && editForm) {
      saveBtn.addEventListener('click', function () {
        if (!selected || !selected.n.pending) return;
        var slug = selected.n.slug;
        var data = {
          title: ($('editTitle') || {}).value || '',
          body: ($('editBody') || {}).value || '',
          type: ($('editType') || {}).value || '',
          year: ($('editYear') || {}).value || '',
          zone: ($('editZone') || {}).value || '',
          place: ($('editPlace') || {}).value || ''
        };
        saveBtn.disabled = true;
        var en = $('editNote'); if (en) en.textContent = '';
        post('save_pending', slug, '', data).then(function (res) {
          saveBtn.disabled = false;
          if (!res || !res.ok) {
            if (en) en.textContent = (res && res.error) || 'The slip could not be saved.';
            return;
          }
          if (res.punch) addTapeCard(res.punch, true);
          if (res.node) {
            TREE.nodes = (TREE.nodes || []).map(function (n) {
              if (n.slug !== slug) return n;
              return Object.assign({}, n, res.node, { pending: true });
            });
            layout();
            counts();
            var updated = laid.filter(function (r) { return r.n.slug === slug; })[0];
            editForm.hidden = true;
            showSlip(updated || null);
          }
        }).catch(function () {
          saveBtn.disabled = false;
          if (en) en.textContent = 'The field could not be reached.';
        });
      });
    }

    var slipClose = $('slipClose');
    if (slipClose) slipClose.addEventListener('click', function (e) { e.stopPropagation(); showSlip(null); });

    var slipEl = $('slip');
    if (slipEl) {
      var sw = null;
      slipEl.addEventListener('touchstart', function (e) {
        var tg = e.target && e.target.tagName;
        if (e.touches.length !== 1 || /^(INPUT|TEXTAREA|SELECT)$/.test(tg || '')) { sw = null; return; }
        sw = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }, { passive: true });
      slipEl.addEventListener('touchend', function (e) {
        if (!sw || !e.changedTouches.length) return;
        var dx = e.changedTouches[0].clientX - sw.x;
        var dy = e.changedTouches[0].clientY - sw.y;
        sw = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) stepSlip(dx < 0 ? 1 : -1);
      }, { passive: true });
    }

    var btnFs = $('btnFullscreen');
    if (btnFs) {
      btnFs.addEventListener('click', function () {
        document.body.classList.toggle('fullscreen');
        btnFs.setAttribute('aria-pressed', String(document.body.classList.contains('fullscreen')));
      });
    }

    var delBtn = $('btnDelete');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        if (!selected || selected.n.pending) return;
        if (!delConfirming) {
          delConfirming = true;
          delBtn.textContent = 'CONFIRM DELETE?';
          delBtn.setAttribute('data-confirming', '1');
          return;
        }
        delConfirming = false;
        delBtn.textContent = 'DELETE RECORD';
        delBtn.removeAttribute('data-confirming');
        var slug = selected.n.slug;
        delBtn.disabled = true;
        punchAction('delete', slug).then(function (res) {
          delBtn.disabled = false;
          if (!res || !res.ok) {
            $('slipNote').textContent = (res && res.error) || 'The record could not be deleted.';
            return;
          }
          TREE.nodes = (TREE.nodes || []).filter(function (n) { return n.slug !== slug; });
          layout();
          counts();
          showSlip(null);
          setFormLine('DELETED');
        }).catch(function () {
          delBtn.disabled = false;
          $('slipNote').textContent = 'The field could not be reached.';
        });
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') showSlip(null);
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selected && !typing) {
        stepSlip(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (e.key === 'ArrowLeft') { cam.yaw -= 0.08; auto = false; }
      if (e.key === 'ArrowRight') { cam.yaw += 0.08; auto = false; }
      if (e.key === 'ArrowUp') cam.dist = Math.max(6.5, cam.dist - 0.4);
      if (e.key === 'ArrowDown') cam.dist = Math.min(22, cam.dist + 0.4);
    });

    function openHash() {
      var hashSlug = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
      if (!hashSlug) return;
      var start = laid.filter(function (r) { return r.n.slug === hashSlug; })[0];
      if (start) showSlip(start);
    }
    window.addEventListener('hashchange', openHash);
    openHash();
    requestAnimationFrame(paint);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
