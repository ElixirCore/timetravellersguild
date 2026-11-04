/* Signals: yellow SIM-stock, tiled by context. Arianrhod is the icon. Not canon. */
(function () {
  'use strict';

  var cfg = window.TTG_SIGNALS || {};
  var nodes = Array.isArray(cfg.nodes) ? cfg.nodes.slice() : [];
  var edges = Array.isArray(cfg.edges) ? cfg.edges.slice() : [];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var HOLLERITH = {
    A: [12, 1], B: [12, 2], C: [12, 3], D: [12, 4], E: [12, 5], F: [12, 6], G: [12, 7], H: [12, 8], I: [12, 9],
    J: [11, 1], K: [11, 2], L: [11, 3], M: [11, 4], N: [11, 5], O: [11, 6], P: [11, 7], Q: [11, 8], R: [11, 9],
    S: [0, 2], T: [0, 3], U: [0, 4], V: [0, 5], W: [0, 6], X: [0, 7], Y: [0, 8], Z: [0, 9],
    '0': [0], '1': [1], '2': [2], '3': [3], '4': [4], '5': [5], '6': [6], '7': [7], '8': [8], '9': [9],
    ' ': []
  };
  var ROWS = [12, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  var TYPE_COL = {
    SIGNAL: 0, MEDIA: 1, DOCUMENT: 1, FILM_FRAGMENT: 1, EVENT: 2, MOMENT: 2,
    PERSON: 3, PLACE: 4, INSTITUTION: 5, MISSION: 6, OBJECT: 7, QUANTUM_TIN: 7,
    UNKNOWN: 8, PLAY: 2
  };
  var CELL_W = 248;
  var CELL_H = 172;

  var plane = document.getElementById('plane');
  var threads = document.getElementById('threads');
  var viewport = document.getElementById('viewport');
  var slip = document.getElementById('slip');
  var cam = { x: 0, y: 0, s: 1 };
  var drag = null;
  var keys = {};
  var bySlug = {};
  var openSlug = '';
  var punchTimer = 0;
  var last = 0;

  function $(id) { return document.getElementById(id); }

  function punchText(text) {
    return String(text || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
  }

  function setForm(text) {
    var el = $('jackForm');
    if (el) el.textContent = text;
  }

  function pose(form) {
    var Spr = window.Arianrhod && window.Arianrhod.Sprite;
    if (!Spr) return;
    if (form === 'reel' && Spr.reel) Spr.reel();
    else if (form === 'listen' && Spr.listen) Spr.listen();
    else if (Spr.sit) Spr.sit();
  }

  function yearRow(y) {
    y = Number(y) || 2026;
    if (y <= 2014) return 0;
    if (y <= 2019) return 1;
    if (y <= 2026) return 2;
    if (y <= 2029) return 3;
    return 4;
  }

  function typeCol(n) {
    var c = TYPE_COL[String((n && n.type) || '').toUpperCase()];
    return c == null ? 4 : c;
  }

  function drawStock(ctx, w, h) {
    var i, x;
    ctx.fillStyle = '#f2d322';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e4c21a';
    ctx.fillRect(0, 0, w, Math.floor(h * 0.12));
    ctx.fillStyle = 'rgba(30,58,95,0.1)';
    for (x = 28; x < w - 8; x += 9) ctx.fillRect(x, Math.floor(h * 0.38), 1, Math.floor(h * 0.52));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.floor(h * 0.09), 0);
    ctx.lineTo(0, Math.floor(h * 0.09));
    ctx.closePath();
    ctx.fillStyle = '#1e3a5f';
    ctx.fill();
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(0, 0, w, Math.floor(h * 0.12));
    ctx.fillStyle = '#f2d322';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.floor(h * 0.09), 0);
    ctx.lineTo(0, Math.floor(h * 0.09));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    for (i = 0; i < 8; i++) {
      ctx.fillRect(18 + (i % 2) * 10, 22 + Math.floor(i / 2) * 8, 8, 6);
    }
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  function drawHollerith(ctx, w, h, text, cols) {
    var body = punchText(text);
    var n = Math.max(8, Math.min(40, body.length + 2));
    var left = 28;
    var top = h * 0.22;
    var cw = (w - left - 12) / n;
    var rh = (h - top - 10) / ROWS.length;
    var punched = cols == null ? n : Math.max(0, Math.min(n, cols));
    var i, r, ch, holes, hi;
    for (r = 0; r < ROWS.length; r++) {
      ctx.strokeStyle = 'rgba(30,58,95,0.2)';
      ctx.beginPath();
      ctx.moveTo(left, top + r * rh + rh / 2);
      ctx.lineTo(w - 8, top + r * rh + rh / 2);
      ctx.stroke();
    }
    for (i = 0; i < punched; i++) {
      ch = body.charAt(i) || ' ';
      holes = HOLLERITH[ch] || [];
      for (hi = 0; hi < holes.length; hi++) {
        r = ROWS.indexOf(holes[hi]);
        if (r < 0) continue;
        ctx.beginPath();
        ctx.ellipse(left + i * cw + cw / 2, top + r * rh + rh / 2, Math.max(1.5, cw * 0.28), Math.max(1.3, rh * 0.28), 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1e3a5f';
        ctx.fill();
      }
    }
  }

  function paintTitle(ctx, w, h, cols) {
    drawStock(ctx, w, h);
    ctx.fillStyle = '#f2d322';
    ctx.font = '600 13px "Courier New", Courier, monospace';
    ctx.fillText('IBM 5081 · 80 COL · SIM', 34, Math.floor(h * 0.082));
    ctx.fillStyle = '#1e3a5f';
    ctx.font = '600 42px "Courier New", Courier, monospace';
    ctx.fillText('SIGNALS', 34, Math.floor(h * 0.34));
    ctx.fillStyle = '#4a4458';
    ctx.font = '12px "Courier New", Courier, monospace';
    ctx.fillText('THE RECORD LAID FLAT · NOT CANON', 34, Math.floor(h * 0.44));
    ctx.save();
    ctx.translate(0, Math.floor(h * 0.5));
    drawHollerith(ctx, w, Math.floor(h * 0.48), 'SIGNALS RECEIVING', cols);
    ctx.restore();
  }

  function startTitleFlash(doneFn) {
    var canvas = $('titleCard');
    var flash = $('titleFlash');
    if (!canvas || !flash) { doneFn(); return; }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 800, h = 352;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var total = 18;
    var t0 = 0;
    var holdAfter = reduce ? 160 : 720;
    var punchMs = reduce ? 0 : 1400;
    var fadeT = 0;
    var armed = false;
    var done = false;
    var raf = 0;
    var watchdog = setTimeout(finish, punchMs + holdAfter + 400);

    function finish() {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      paintTitle(ctx, w, h, total);
      if (raf) cancelAnimationFrame(raf);
      fadeT = performance.now();
      raf = requestAnimationFrame(fade);
    }
    function fade(now) {
      var k = reduce ? 1 : Math.min(1, (now - fadeT) / 320);
      flash.style.opacity = String(1 - k);
      if (k < 1) {
        raf = requestAnimationFrame(fade);
        return;
      }
      document.body.classList.remove('booting');
      doneFn();
    }
    function frame(now) {
      if (done) return;
      if (!t0) t0 = now;
      var cols = punchMs <= 0 ? total : Math.min(total, Math.floor(((now - t0) / punchMs) * total));
      paintTitle(ctx, w, h, cols);
      if (cols >= total && !armed) {
        armed = true;
        setTimeout(finish, holdAfter);
        return;
      }
      if (!armed) raf = requestAnimationFrame(frame);
    }
    flash.addEventListener('click', finish);
    canvas.addEventListener('click', finish);
    raf = requestAnimationFrame(frame);
  }

  function keyOf(gx, gy) { return gx + ',' + gy; }

  function nearestFree(gx, gy, occ) {
    if (!occ[keyOf(gx, gy)]) return [gx, gy];
    var r, dx, dy, k;
    for (r = 1; r < 48; r++) {
      for (dy = -r; dy <= r; dy++) {
        for (dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          k = keyOf(gx + dx, gy + dy);
          if (!occ[k]) return [gx + dx, gy + dy];
        }
      }
    }
    return [gx, gy + 1];
  }

  function around(gx, gy) {
    return [
      [gx + 1, gy], [gx, gy + 1], [gx - 1, gy], [gx, gy - 1],
      [gx + 1, gy + 1], [gx - 1, gy + 1], [gx + 1, gy - 1], [gx - 1, gy - 1]
    ];
  }

  function layout() {
    var i, n, e, a, b, occ = {}, placed = {}, nbrs = {}, q = [], cur, list, nb, tries, ti, wantX, wantY;
    var minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.w = 232;
      n.h = 156;
      if (n.slug) bySlug[n.slug] = n;
    }
    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      if (!nbrs[e.source]) nbrs[e.source] = [];
      if (!nbrs[e.target]) nbrs[e.target] = [];
      nbrs[e.source].push({ slug: e.target, c: e.confidence || 0.5 });
      nbrs[e.target].push({ slug: e.source, c: e.confidence || 0.5 });
    }
    Object.keys(nbrs).forEach(function (s) {
      nbrs[s].sort(function (x, y) { return y.c - x.c; });
    });

    function put(node, gx, gy) {
      var xy = nearestFree(gx, gy, occ);
      gx = xy[0];
      gy = xy[1];
      occ[keyOf(gx, gy)] = node.slug;
      node.gx = gx;
      node.gy = gy;
      placed[node.slug] = true;
    }

    var start = bySlug.signals || nodes.slice().sort(function (x, y) {
      return (y.importance || 0) - (x.importance || 0);
    })[0];
    if (start) {
      put(start, typeCol(start), yearRow(start.year));
      q.push(start);
    }
    while (q.length) {
      cur = q.shift();
      list = nbrs[cur.slug] || [];
      for (i = 0; i < list.length; i++) {
        nb = bySlug[list[i].slug];
        if (!nb || placed[nb.slug]) continue;
        wantX = cur.gx + (typeCol(nb) === typeCol(cur) ? 0 : (typeCol(nb) > typeCol(cur) ? 1 : -1));
        wantY = cur.gy + (yearRow(nb.year) === yearRow(cur.year) ? 0 : (yearRow(nb.year) > yearRow(cur.year) ? 1 : -1));
        if (wantX === cur.gx && wantY === cur.gy) wantX += 1;
        tries = around(cur.gx, cur.gy);
        tries.sort(function (p, q2) {
          var dp = Math.abs(p[0] - wantX) + Math.abs(p[1] - wantY);
          var dq = Math.abs(q2[0] - wantX) + Math.abs(q2[1] - wantY);
          return dp - dq;
        });
        put(nb, tries[0][0], tries[0][1]);
        q.push(nb);
      }
    }
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (placed[n.slug]) continue;
      put(n, typeCol(n), yearRow(n.year));
    }
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.gx < minGx) minGx = n.gx;
      if (n.gy < minGy) minGy = n.gy;
      if (n.gx > maxGx) maxGx = n.gx;
      if (n.gy > maxGy) maxGy = n.gy;
    }
    if (!isFinite(minGx)) { minGx = 0; minGy = 0; maxGx = 1; maxGy = 1; }
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.gx -= minGx;
      n.gy -= minGy;
      n.x = n.gx * CELL_W;
      n.y = n.gy * CELL_H;
    }
    plane.dataset.width = String((maxGx - minGx + 2) * CELL_W);
    plane.dataset.height = String((maxGy - minGy + 2) * CELL_H);
  }

  function applyCam() {
    plane.style.transform = 'translate(' + cam.x + 'px,' + cam.y + 'px) scale(' + cam.s + ')';
    threads.style.transform = plane.style.transform;
    var col = Math.round((-cam.x + innerWidth / 2) / CELL_W);
    var row = Math.round((-cam.y + innerHeight / 2) / CELL_H);
    var read = $('coordRead');
    if (read) {
      read.textContent = (cfg.coord || 'S-88.13') + ' · COL ' + String(Math.abs(col)).padStart(3, '0')
        + ' · ROW ' + String(Math.abs(row)).padStart(3, '0');
    }
  }

  function centerOn(n) {
    if (!n) return;
    cam.x = innerWidth / 2 - (n.x + n.w / 2) * cam.s;
    cam.y = innerHeight / 2 - (n.y + n.h / 2) * cam.s;
    applyCam();
  }

  function renderCards() {
    var frag = document.createDocumentFragment();
    var i, n, el, band, canvas, chip, p;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      el = document.createElement('article');
      el.className = 'card' + (String(n.type || '').toUpperCase() === 'SIGNAL' ? ' signal' : '') + (n.pending ? ' pending' : '');
      el.style.left = n.x + 'px';
      el.style.top = n.y + 'px';
      el.dataset.slug = n.slug;
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      chip = document.createElement('span');
      chip.className = 'chip';
      chip.setAttribute('aria-hidden', 'true');
      for (p = 0; p < 8; p++) chip.appendChild(document.createElement('i'));
      el.appendChild(chip);
      band = document.createElement('p');
      band.className = 'band';
      band.textContent = 'IBM 5081 · ' + String(n.type || 'SLIP');
      el.appendChild(band);
      var h2 = document.createElement('h2');
      h2.textContent = n.title || n.slug;
      el.appendChild(h2);
      var yr = document.createElement('p');
      yr.className = 'year';
      yr.textContent = (n.year || '—') + (n.status ? ' · ' + n.status : '');
      el.appendChild(yr);
      canvas = document.createElement('canvas');
      canvas.width = 220;
      canvas.height = 48;
      canvas.className = 'belt';
      el.appendChild(canvas);
      n.el = el;
      n.belt = canvas;
      n.punched = reduce ? 24 : 0;
      el.addEventListener('click', onCard);
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onCard(ev);
        }
      });
      frag.appendChild(el);
    }
    plane.appendChild(frag);
  }

  function renderThreads() {
    var w = Number(plane.dataset.width || 2000);
    var h = Number(plane.dataset.height || 1400);
    var ns = 'http://www.w3.org/2000/svg';
    var i, e, a, b, path, x1, y1, x2, y2, mid;
    threads.setAttribute('width', String(w));
    threads.setAttribute('height', String(h));
    threads.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    threads.innerHTML = '';
    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      a = bySlug[e.source];
      b = bySlug[e.target];
      if (!a || !b) continue;
      x1 = a.x + a.w / 2;
      y1 = a.y + a.h / 2;
      x2 = b.x + b.w / 2;
      y2 = b.y + b.h / 2;
      mid = (x1 + x2) / 2;
      path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' H' + mid + ' V' + y2 + ' H' + x2);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(30,58,95,0.28)');
      path.setAttribute('stroke-width', e.confidence && e.confidence > 0.75 ? '1.8' : '1.2');
      threads.appendChild(path);
    }
  }

  function paintBelt(n, cols) {
    var ctx = n.belt && n.belt.getContext('2d');
    if (!ctx) return;
    var w = n.belt.width;
    var h = n.belt.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e4c21a';
    ctx.fillRect(0, 0, w, h);
    drawHollerith(ctx, w, h, n.title || n.slug, cols);
  }

  function punchVisible() {
    if (reduce) return;
    punchTimer += 16;
    if (punchTimer < 40) return;
    punchTimer = 0;
    var i, n, box, vis;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (!n.el || n.punched >= 24) continue;
      box = n.el.getBoundingClientRect();
      vis = box.right > 0 && box.left < innerWidth && box.bottom > 0 && box.top < innerHeight;
      if (!vis) continue;
      n.punched += 1;
      paintBelt(n, n.punched);
    }
  }

  function neighbors(slug) {
    var out = [];
    var i, e, other;
    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      other = e.source === slug ? e.target : (e.target === slug ? e.source : '');
      if (other && bySlug[other]) out.push({ slug: other, rel: e.relationship || 'NEAR' });
    }
    return out;
  }

  function fillRuler() {
    var ruler = $('slipRuler');
    if (!ruler || ruler.childNodes.length) return;
    var i, s;
    for (i = 1; i <= 40; i++) {
      s = document.createElement('span');
      s.textContent = i % 10 === 0 ? String(i) : '·';
      ruler.appendChild(s);
    }
  }

  function openSlip(n) {
    if (!n || !slip) return;
    openSlug = n.slug;
    fillRuler();
    $('slipBatch').textContent = 'IBM 5081 · 80 COL · ' + String(n.slug || '').toUpperCase();
    $('slipAxis').textContent = String(n.type || 'SLIP') + (n.zone ? ' · ' + n.zone : '');
    $('slipTitle').textContent = n.title || n.slug;
    $('slipMeta').textContent = [n.year || '', n.status || '', n.place || ''].filter(Boolean).join(' · ');
    $('slipBody').textContent = n.body || 'No body on this slip.';
    var why = (n.why && n.why.reasons && n.why.reasons[0]) || 'A working slip. Not canon.';
    $('slipWhy').textContent = why;
    var near = $('slipNear');
    near.innerHTML = '';
    neighbors(n.slug).slice(0, 8).forEach(function (row) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      var other = bySlug[row.slug];
      a.href = '#' + row.slug;
      a.textContent = (other && other.title ? other.title : row.slug) + ' · ' + String(row.rel).replace(/_/g, ' ');
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var next = bySlug[row.slug];
        if (!next) return;
        centerOn(next);
        openSlip(next);
      });
      li.appendChild(a);
      near.appendChild(li);
    });
    var open = $('slipOpen');
    open.href = n.href || n.open || '/n/' + encodeURIComponent(n.slug) + '/';
    slip.hidden = false;
    var belt = $('slipBelt');
    if (belt) {
      var ctx = belt.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, belt.width, belt.height);
      ctx.fillStyle = '#e4c21a';
      ctx.fillRect(0, 0, belt.width, belt.height);
      drawHollerith(ctx, belt.width, belt.height, n.title || n.slug, 40);
    }
    nodes.forEach(function (card) {
      if (card.el) card.el.classList.toggle('on', card.slug === n.slug);
    });
    if (location.hash !== '#' + n.slug) {
      try { history.replaceState(null, '', '#' + n.slug); } catch (err) {}
    }
    setForm('HOLDING A SLIP');
    pose('reel');
  }

  function closeSlip() {
    openSlug = '';
    if (slip) slip.hidden = true;
    nodes.forEach(function (card) {
      if (card.el) card.el.classList.remove('on');
    });
    setForm('ARIANRHOD IS LISTENING');
    pose('sit');
    if (location.hash) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (err) {}
    }
  }

  function onCard(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    var slug = ev.currentTarget.dataset.slug;
    var n = bySlug[slug];
    if (!n) return;
    openSlip(n);
  }

  function filter(q) {
    q = String(q || '').trim().toLowerCase();
    var first = null;
    nodes.forEach(function (n) {
      var hit = !q || String(n.title || '').toLowerCase().indexOf(q) >= 0
        || String(n.slug || '').toLowerCase().indexOf(q) >= 0
        || String(n.type || '').toLowerCase().indexOf(q) >= 0
        || String(n.body || '').toLowerCase().indexOf(q) >= 0;
      if (n.el) n.el.classList.toggle('dim', !hit);
      if (hit && !first) first = n;
    });
    return first;
  }

  function bindPan() {
    if (!viewport) return;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('.card, #slip, #hud, #dock, #find')) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
      viewport.classList.add('drag');
      try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
    });
    viewport.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      cam.x = drag.cx + (e.clientX - drag.x);
      cam.y = drag.cy + (e.clientY - drag.y);
      applyCam();
    });
    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag = null;
      viewport.classList.remove('drag');
    }
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.x -= e.deltaX || (e.shiftKey ? e.deltaY : 0);
      cam.y -= e.shiftKey ? 0 : e.deltaY;
      applyCam();
    }, { passive: false });
  }

  function bindKeys() {
    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.id === 'find' || e.target.tagName === 'INPUT')) {
        if (e.key === 'Escape') { e.target.blur(); closeSlip(); }
        if (e.key === 'Enter') {
          var hit = filter(e.target.value);
          if (hit) { centerOn(hit); openSlip(hit); }
        }
        return;
      }
      if (e.key === 'Escape') closeSlip();
      if (e.key === 'f' || e.key === 'F' || e.key === '/') {
        if ($('find')) { e.preventDefault(); $('find').focus(); }
      }
      keys[e.key] = true;
    });
    window.addEventListener('keyup', function (e) { keys[e.key] = false; });
    var find = $('find');
    if (find) find.addEventListener('input', function () { filter(find.value); });
    var close = $('slipClose');
    if (close) close.addEventListener('click', closeSlip);
  }

  function tickKeys(dt) {
    var step = 0.46 * dt;
    if (keys.ArrowLeft || keys.a || keys.A) cam.x += step;
    if (keys.ArrowRight || keys.d || keys.D) cam.x -= step;
    if (keys.ArrowUp || keys.w || keys.W) cam.y += step;
    if (keys.ArrowDown || keys.s || keys.S) cam.y -= step;
    if (keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown || keys.a || keys.A || keys.d || keys.D || keys.w || keys.W || keys.s || keys.S) {
      applyCam();
    }
  }

  function bindArianrhod() {
    var Spr = window.Arianrhod && window.Arianrhod.Sprite;
    var pet = $('arianrhod');
    if (!Spr || !pet) return;
    Spr.attachPortrait(pet);
    pose('sit');
    if (reduce) {
      Spr.tick(0);
      return;
    }
    (function loop(now) {
      Spr.tick(now / 1000);
      requestAnimationFrame(loop);
    }(performance.now()));
  }

  function loop(now) {
    var dt = last ? Math.min(48, now - last) : 16;
    last = now;
    tickKeys(dt);
    punchVisible();
    requestAnimationFrame(loop);
  }

  function boot() {
    layout();
    renderCards();
    renderThreads();
    nodes.forEach(function (n) { paintBelt(n, reduce ? 24 : 0); });
    centerOn(bySlug.signals || nodes[0]);
    bindPan();
    bindKeys();
    bindArianrhod();
    var hashSlug = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (hashSlug && bySlug[hashSlug]) {
      centerOn(bySlug[hashSlug]);
      openSlip(bySlug[hashSlug]);
    }
    requestAnimationFrame(loop);
    setForm('THE REEL TURNS');
    pose('listen');
    setTimeout(function () {
      if (!openSlug) {
        setForm('ARIANRHOD IS LISTENING');
        pose('sit');
      }
    }, 900);
  }

  startTitleFlash(boot);
}());
