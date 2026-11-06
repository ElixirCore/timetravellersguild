/* THE LEDGER — the collective book.
   Book engine in the manner of /passport: CSS-3D leaves, drag-to-turn,
   wheel/pinch zoom, one-page focus on narrow screens, read-as-text. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const DATA = window.TTG_LEDGER || { entries: [], keeper: false, signed_in: false };
  const ENTRIES = Array.isArray(DATA.entries) ? DATA.entries : [];
  const KEEPER = !!DATA.keeper;

  const stage = $('stage'), zoomEl = $('zoom'), book = $('book');
  const h = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* seeded generator, for cover grain only */
  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0; c = (c << 21 | c >>> 11);
      d = d + 1 | 0; t = t + d | 0; c = c + t | 0; return (t >>> 0) / 4294967296;
    };
  }
  const rngFor = (key) => { const s = cyrb128(key); return sfc32(s[0], s[1], s[2], s[3]); };

  let pages = [], leaves = [], t = 0, nLeaves = 0, lastVis = [];
  let focusMode = false, focus = 'L', fitS = 1;

  /* ================= pages ================= */
  function coverPage() {
    const el = h('div', 'page cover'); el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', 'Open the ledger');
    const c = document.createElement('canvas'); el.appendChild(c);
    el.appendChild(h('div', 't1', 'THE LEDGER'));
    el.appendChild(h('div', 't2', 'Time Travellers Guild'));
    el.appendChild(h('div', 't3', 'A collective book of time · each page punched by a traveller'));
    el.addEventListener('click', () => next());
    return { el, draw() {
      c.width = 1000; c.height = 1400; const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 1000, 1400); gr.addColorStop(0, '#133a47'); gr.addColorStop(1, '#0a1d25');
      g.fillStyle = gr; g.fillRect(0, 0, 1000, 1400);
      const r = rngFor('ledger-cover-grain');
      for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.08)'; g.fillRect(r() * 1000, r() * 1400, 1 + r() * 2, 1 + r() * 2); }
      /* ring seal, in the manner of the passport cover */
      g.save(); g.translate(500, 760);
      const ring = (rad, w, alpha) => { g.globalAlpha = alpha; g.lineWidth = w; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.stroke(); };
      const sty = (() => { if (g.createConicGradient) { const cg = g.createConicGradient(-Math.PI / 2, 0, 0); [[0, '#7fe3f0'], [0.2, '#8fb0ff'], [0.42, '#c99bff'], [0.62, '#ff9bd0'], [0.8, '#ffd08a'], [0.92, '#8fe8c2'], [1, '#7fe3f0']].forEach((s) => cg.addColorStop(s[0], s[1])); return cg; } return '#8fd8e6'; })();
      g.strokeStyle = sty;
      ring(430, 6, 1); ring(420, 1.6, .8); ring(390, 1.6, .8); ring(300, 1.8, .9); ring(150, 2.2, 1);
      /* punched holes around the seal, like a card */
      g.globalAlpha = .9; g.fillStyle = sty;
      const rr = rngFor('ledger-holes');
      for (let i = 0; i < 96; i++) {
        const a = i / 96 * TAU, rad = 345 + (rr() - .5) * 10;
        if (rr() < 0.55) { g.beginPath(); g.arc(Math.cos(a) * rad, Math.sin(a) * rad, 5 + rr() * 4, 0, TAU); g.fill(); }
      }
      /* radiating collation lines */
      g.globalAlpha = .55; g.lineWidth = 2;
      for (let i = 0; i < 64; i++) {
        const a = i / 64 * TAU, r0 = 170, r1 = 285 + 12 * Math.sin(i * 2.7);
        g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(143,224,240,.5)'; g.lineWidth = 3; g.strokeRect(36, 36, 928, 1328); g.lineWidth = 1; g.strokeRect(50, 50, 900, 1300);
    } };
  }
  function insidePage() {
    const el = h('div', 'page');
    el.appendChild(h('div', 'eyebrow', 'The ledger of the guild'));
    el.appendChild(h('h2', '', 'This book is made by its readers.'));
    el.appendChild(h('p', '', 'Every page is one traveller\u2019s collage: screenshots and found images composed, overlaid, blended and masked in the composer, then punched into the ledger.'));
    el.appendChild(h('p', '', ENTRIES.length ? 'The book holds ' + ENTRIES.length + (ENTRIES.length === 1 ? ' page' : ' pages') + ' so far.' : 'The book is waiting for its first page.'));
    el.appendChild(h('p', '', 'Every traveller on the register may read. Any signed-in traveller may compose a page and punch it in. A keeper tends the binding: a keeper can tend any page, and what a keeper does is marked.'));
    el.appendChild(h('div', 'grow'));
    el.appendChild(h('p', 'small', 'Pages are their travellers\u2019 own work. The Guild is fiction; the collages are real.'));
    return { el };
  }
  function entryPage(st, i) {
    const el = h('div', 'page'); el.id = 'entry-' + st.id;
    el.appendChild(h('div', 'eyebrow', 'Page ' + (i + 1) + (st.inked ? ' · inked ' + st.inked : '')));
    el.appendChild(h('h2', '', st.title || 'Untitled'));
    if (st.img) {
      const fig = h('figure', 'collage');
      const img = document.createElement('img');
      img.src = st.img; img.alt = (st.title || 'Untitled') + ' — a collage by ' + st.author; img.loading = 'lazy';
      fig.appendChild(img); el.appendChild(fig);
    }
    el.appendChild(h('p', 'byline', 'Punched by ' + st.author + (st.keeper_touched ? ' · tended by a keeper' : '')));
    if (st.note) el.appendChild(h('p', '', st.note));
    if (st.keeper_note) el.appendChild(h('p', 'keepernote', 'The keeper notes: ' + st.keeper_note));
    const MINE = DATA.me_slug && st.author_slug === DATA.me_slug;
    if (MINE || KEEPER) {
      const a = h('a', 'keeper-edit', MINE ? 'Edit your page' : 'Keeper · edit this page');
      a.href = '/ledger/compose/?id=' + st.id;
      el.appendChild(a);
    }
    el.appendChild(h('div', 'grow'));
    return { el };
  }
  function blankPage() { const el = h('div', 'page'); el.appendChild(h('div', 'eyebrow', 'Further pages')); el.appendChild(h('div', 'grow')); return { el }; }
  function backPage() {
    const el = h('div', 'page backcover'); const c = document.createElement('canvas'); el.appendChild(c);
    return { el, draw() {
      c.width = 1000; c.height = 1400; const g = c.getContext('2d');
      const gr = g.createLinearGradient(1000, 0, 0, 1400); gr.addColorStop(0, '#133a47'); gr.addColorStop(1, '#0a1d25');
      g.fillStyle = gr; g.fillRect(0, 0, 1000, 1400);
      const r = rngFor('ledger-back-grain');
      for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.08)'; g.fillRect(r() * 1000, r() * 1400, 1 + r() * 2, 1 + r() * 2); }
      g.strokeStyle = 'rgba(143,224,240,.5)'; g.lineWidth = 3; g.strokeRect(36, 36, 928, 1328); g.lineWidth = 1; g.strokeRect(50, 50, 900, 1300);
    } };
  }

  /* plain-text reading mode: the same content as the booklet, as a flowing document */
  function buildReader() {
    const r = $('reader'); r.innerHTML = '';
    const col = h('div', 'col'); r.appendChild(col);
    col.appendChild(h('p', 'eyebrow', 'The ledger of the guild'));
    col.appendChild(h('h2', '', 'The Ledger'));
    col.appendChild(h('p', '', 'The same pages as the booklet, set as plain text. Signed-in travellers may read and compose; a keeper tends the binding.'));
    if (!ENTRIES.length) col.appendChild(h('p', '', 'The book is waiting for its first page.'));
    ENTRIES.forEach((st, i) => {
      col.appendChild(h('h3', '', 'Page ' + (i + 1) + ': ' + (st.title || 'Untitled')));
      col.appendChild(h('p', 'byline', ['Punched by ' + st.author, st.inked ? 'inked ' + st.inked : '', st.keeper_touched ? 'tended by a keeper' : ''].filter(Boolean).join(' · ')));
      if (st.img) { const img = document.createElement('img'); img.src = st.img; img.alt = (st.title || 'Untitled') + ' — a collage by ' + st.author; img.loading = 'lazy'; col.appendChild(img); }
      if (st.note) col.appendChild(h('p', '', st.note));
      if (st.keeper_note) col.appendChild(h('p', 'small', 'The keeper notes: ' + st.keeper_note));
    });
  }

  function build(keepTurn) {
    const keep = keepTurn ? t : 0;
    book.innerHTML = ''; pages = []; leaves = [];
    const add = (title, p) => { pages.push({ title, el: p.el, draw: p.draw, done: false }); };
    add('Cover', coverPage()); add('Inside cover', insidePage());
    ENTRIES.forEach((st, i) => add('Page ' + (i + 1) + ', ' + (st.title || 'Untitled'), entryPage(st, i)));
    if (pages.length % 2 === 0) add('Further pages', blankPage());
    add('Back cover', backPage());
    nLeaves = pages.length / 2;
    for (let i = 0; i < nLeaves; i++) {
      const lf = h('div', 'leaf'), f = h('div', 'face front'), b = h('div', 'face back');
      pages[2 * i].el.classList.add('right'); pages[2 * i + 1].el.classList.add('left');
      f.appendChild(pages[2 * i].el); f.appendChild(h('div', 'shade')); b.appendChild(pages[2 * i + 1].el); b.appendChild(h('div', 'shade'));
      pages[2 * i].el.appendChild(h('div', 'folio', String(2 * i + 1))); pages[2 * i + 1].el.appendChild(h('div', 'folio', String(2 * i + 2)));
      lf.appendChild(f); lf.appendChild(b); book.appendChild(lf); leaves.push(lf);
    }
    layout(); setTurn(keep, true); buildReader();
  }

  /* ================= turning ================= */
  function ensure(i) { const p = pages[i]; if (p && !p.done && p.draw) { p.done = true; p.draw(); } }
  function setTurn(n, instant) {
    t = clamp(n, 0, nLeaves);
    if (instant) book.classList.add('nodrag');
    leaves.forEach((lf, i) => {
      const turned = i < t; if (instant) lf.classList.add('drag');
      lf.style.setProperty('--a', turned ? '-180deg' : '0deg'); lf.style.setProperty('--z', ((turned ? i : nLeaves - i) * 0.6) + 'px'); lf.style.setProperty('--shade', '0');
    });
    book.dataset.state = t === 0 ? 'front' : (t === nLeaves ? 'back' : 'open'); applyShift();
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => { book.classList.remove('nodrag'); leaves.forEach((lf) => lf.classList.remove('drag')); }));
    const vis = []; if (t > 0) vis.push(2 * t - 1); if (t < nLeaves) vis.push(2 * t);
    pages.forEach((p, i) => { const on = vis.indexOf(i) >= 0; p.el.inert = !on; p.el.setAttribute('aria-hidden', on ? 'false' : 'true'); });
    for (let i = 2 * t - 3; i <= 2 * t + 2; i++) ensure(i);
    $('prev').disabled = t === 0; $('next').disabled = t === nLeaves;
    lastVis = vis; updateStatus();
    const cv0 = pages[0] && pages[0].el; if (cv0) cv0.tabIndex = t === 0 ? 0 : -1;
    fit(!instant);
  }
  function applyShift() { const pw = parseFloat(book.style.getPropertyValue('--pw')) || 300; const s = book.dataset.state; book.style.setProperty('--shift', (s === 'front' ? -pw / 2 : s === 'back' ? pw / 2 : 0) + 'px'); }
  const next = () => {
    if (focusMode && book.dataset.state === 'open' && focus === 'L') { focus = 'R'; fit(true); updateStatus(); return; }
    if (t < nLeaves) { focus = 'L'; setTurn(t + 1); }
  };
  const prev = () => {
    if (focusMode && book.dataset.state === 'open' && focus === 'R') { focus = 'L'; fit(true); updateStatus(); return; }
    if (t > 0) { focus = 'R'; setTurn(t - 1); }
  };
  $('next').addEventListener('click', next); $('prev').addEventListener('click', prev);

  function layout() {
    const w = stage.clientWidth, hh = stage.clientHeight;
    const pw = Math.floor(clamp(Math.min(w * 0.47, hh * 0.93 / 1.4), 120, 560));
    book.style.setProperty('--pw', pw + 'px'); book.style.setProperty('--ph', Math.round(pw * 1.4) + 'px'); applyShift();
    fitS = Math.min(w * 0.96 / pw, hh * 0.98 / (pw * 1.4)); focusMode = pw < 440 && fitS >= 1.3;
    const sv = (function () { let d = ''; for (let j = 0; j < 70; j++) { const y0 = j * 2.02; let p = 'M0 ' + y0.toFixed(2); for (let x = 2; x <= 100; x += 2) p += 'L' + x + ' ' + (y0 + Math.sin(x / 100 * 14 + j * 0.35) * 0.55).toFixed(2); d += p; }
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 141.4" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="rgba(30,92,110,.12)" stroke-width=".18"/></svg>'; })();
    book.style.setProperty('--lines', 'url("data:image/svg+xml,' + encodeURIComponent(sv) + '")');
  }
  window.addEventListener('resize', () => { layout(); if (focusMode) fit(false); else { clampPan(); applyZoom(); } });

  /* ================= zoom, pan, drag-to-turn ================= */
  const Z = { s: 1, x: 0, y: 0 };
  function applyZoom() { zoomEl.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')'; }
  function clampPan() { const w = stage.clientWidth, hh = stage.clientHeight; Z.x = clamp(Z.x, w * (1 - Z.s), 0); Z.y = clamp(Z.y, hh * (1 - Z.s), 0); if (Z.s <= 1.001) { Z.s = 1; Z.x = 0; Z.y = 0; } }
  function zoomAt(cx, cy, f) { const s2 = clamp(Z.s * f, 1, 4); Z.x = cx - (cx - Z.x) * (s2 / Z.s); Z.y = cy - (cy - Z.y) * (s2 / Z.s); Z.s = s2; clampPan(); applyZoom(); }
  const stageXY = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomEl.classList.remove('anim'); const p = stageXY(e); zoomAt(p[0], p[1], Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016))); }, { passive: false });
  $('reset').addEventListener('click', () => resetZoom());

  const ptr = new Map(); let drag = null, pan = null, pinch = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input')) return;
    zoomEl.classList.remove('anim');
    try { stage.setPointerCapture(e.pointerId); } catch (x) {}
    ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 2) { const a = Array.from(ptr.values()); pinch = { d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), s: Z.s }; drag = null; pan = null; return; }
    if (Z.s > 1.02) { pan = { x: e.clientX, y: e.clientY, zx: Z.x, zy: Z.y, moved: false }; return; }
    const r = stage.getBoundingClientRect(), right = e.clientX - r.left > r.width / 2, st = book.dataset.state;
    let dir = 0; if (st === 'front') dir = 1; else if (st === 'back') dir = -1; else dir = right ? 1 : -1;
    if (dir > 0 && t >= nLeaves) dir = 0; if (dir < 0 && t <= 0) dir = 0;
    drag = { dir, x0: e.clientX, leaf: dir > 0 ? leaves[t] : leaves[t - 1], moved: false, target: e.target };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptr.size >= 2) { const a = Array.from(ptr.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), r = stage.getBoundingClientRect(); const cx = (a[0][0] + a[1][0]) / 2 - r.left, cy = (a[0][1] + a[1][1]) / 2 - r.top; zoomAt(cx, cy, (pinch.s * d / pinch.d) / Z.s); return; }
    if (pan) { const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (Math.abs(dx) + Math.abs(dy) > 4) pan.moved = true; Z.x = pan.zx + dx; Z.y = pan.zy + dy; clampPan(); applyZoom(); return; }
    if (!drag || !drag.dir) return;
    const dx = e.clientX - drag.x0; if (Math.abs(dx) > 5) drag.moved = true; if (!drag.moved) return;
    const span = parseFloat(book.style.getPropertyValue('--pw')) * 1.6;
    const ang = drag.dir > 0 ? -clamp(-dx / span * 180, 0, 180) : -180 + clamp(dx / span * 180, 0, 180);
    drag.ang = ang; drag.leaf.classList.add('drag'); drag.leaf.style.setProperty('--a', ang + 'deg'); drag.leaf.style.setProperty('--shade', String(Math.sin(Math.abs(ang) * Math.PI / 180) * 0.6));
    if (book.dataset.state === 'front' || book.dataset.state === 'back') { book.dataset.state = 'open'; applyShift(); }
  });
  function endPtr(e) {
    ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null;
    if (pan) {
      const p0 = pan; pan = null;
      if (!p0.moved && focusMode && Z.s <= fitS * 1.05) { const r = stage.getBoundingClientRect(); if (p0.x - r.left > r.width / 2) next(); else prev(); }
      return;
    }
    if (!drag) return; const d = drag; drag = null; if (!d.dir) return;
    if (d.leaf) d.leaf.classList.remove('drag');
    if (!d.moved) { if (window.getSelection && String(window.getSelection())) { setTurn(t); return; } d.dir > 0 ? next() : prev(); return; }
    const a = d.ang == null ? (d.dir > 0 ? 0 : -180) : d.ang;
    if (d.dir > 0) setTurn(a < -60 ? t + 1 : t); else setTurn(a > -120 ? t - 1 : t);
  }
  stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
  stage.addEventListener('dblclick', () => resetZoom());

  document.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key;
    if ((k === 'Enter' || k === ' ') && t === 0) { e.preventDefault(); next(); }
    else if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Home') { setTurn(0); } else if (k === 'End') { setTurn(nLeaves); }
    else if (k === '+' || k === '=') zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.25);
    else if (k === '-') zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.8);
    else if (k === '0' || k === 'Escape') resetZoom();
  });

  function fit(anim) {
    if (!focusMode) return;
    const w = stage.clientWidth, hh = stage.clientHeight, pw = parseFloat(book.style.getPropertyValue('--pw')) || 300, st = book.dataset.state;
    const side = st === 'front' ? 'R' : st === 'back' ? 'L' : focus, shift = st === 'front' ? -pw / 2 : st === 'back' ? pw / 2 : 0;
    const xc = shift + (side === 'R' ? pw / 2 : -pw / 2), s = clamp(fitS, 1, 4);
    Z.s = s; Z.x = w / 2 - s * (w / 2 + xc); Z.y = hh / 2 * (1 - s);
    zoomEl.classList.toggle('anim', anim !== false); applyZoom();
  }
  function resetZoom() { if (focusMode) fit(true); else { Z.s = 1; Z.x = 0; Z.y = 0; zoomEl.classList.remove('anim'); applyZoom(); } }
  function updateStatus() {
    let v = lastVis; if (focusMode && book.dataset.state === 'open' && v.length === 2) v = [v[focus === 'L' ? 0 : 1]];
    $('status').textContent = v.map((i) => pages[i].title).join(' · ');
  }
  $('readbtn').addEventListener('click', () => {
    const on = document.body.classList.toggle('reading');
    $('readbtn').textContent = on ? 'Show the book' : 'Read as text'; $('readbtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { $('reader').scrollTop = 0; } else { layout(); fit(false); }
  });

  build(false);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { pages.forEach((p) => { p.done = false; }); const keep = t; setTurn(keep); });
  /* deep link: /ledger/#entry-<id> opens the book at that page */
  const m = /^#entry-(\d+)$/.exec(location.hash || '');
  if (m) {
    const idx = ENTRIES.findIndex((st) => String(st.id) === m[1]);
    if (idx >= 0) { const pageIdx = 2 + idx; setTurn(Math.ceil(pageIdx / 2), true); }
  }
})();
