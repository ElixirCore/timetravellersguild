/* THE COMPOSER — cobble a page: layered screenshots, arranged, overlaid,
   blended (real composite modes) and masked (painted alpha), then saved as
   a private slip or punched into the ledger. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const BOOT = window.TTG_COMPOSE || {};
  const PAGE_W = 1000, PAGE_H = 1400;
  const BLENDS = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion', 'hard-light', 'soft-light', 'color-dodge', 'color-burn', 'hue', 'saturation', 'color', 'luminosity'];
  const BLEND_LABELS = { 'source-over': 'Normal' };
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const cv = $('cv'), overlay = $('overlay'), stage = $('stage');
  const g = cv.getContext('2d'), og = overlay.getContext('2d');
  const tmp = document.createElement('canvas');

  let layers = [];
  let sel = -1;
  let mode = 'arrange'; // 'arrange' | 'mask'
  let maskErase = true;
  let brush = 64;
  let dirty = false;
  let keySeq = 0;

  const selLayer = () => (sel >= 0 && sel < layers.length) ? layers[sel] : null;

  /* ---------- canvas fitting ---------- */
  function fitCanvas() {
    const pad = 28;
    const s = Math.min((stage.clientWidth - pad) / PAGE_W, (stage.clientHeight - pad) / PAGE_H);
    const w = Math.max(120, Math.floor(PAGE_W * s)), h = Math.max(168, Math.floor(PAGE_H * s));
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    overlay.style.width = w + 'px'; overlay.style.height = h + 'px';
  }
  window.addEventListener('resize', fitCanvas);

  function toPage(e) {
    const r = overlay.getBoundingClientRect();
    return [(e.clientX - r.left) * PAGE_W / r.width, (e.clientY - r.top) * PAGE_H / r.height];
  }
  function local(L, px, py) {
    const a = -L.rot * Math.PI / 180, dx = px - L.x, dy = py - L.y;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  }

  /* ---------- rendering ---------- */
  function drawLayer(ctx, L) {
    let src = L.img;
    if (L.mask) {
      tmp.width = L.img.width; tmp.height = L.img.height;
      const tg = tmp.getContext('2d');
      tg.globalCompositeOperation = 'source-over';
      tg.clearRect(0, 0, tmp.width, tmp.height);
      tg.drawImage(L.img, 0, 0);
      tg.globalCompositeOperation = 'destination-in';
      tg.drawImage(L.mask, 0, 0);
      src = tmp;
    }
    ctx.save();
    ctx.globalAlpha = L.opacity;
    ctx.globalCompositeOperation = L.blend;
    ctx.translate(L.x, L.y); ctx.rotate(L.rot * Math.PI / 180);
    ctx.drawImage(src, -L.w / 2, -L.h / 2, L.w, L.h);
    ctx.restore();
  }
  function render() {
    g.clearRect(0, 0, PAGE_W, PAGE_H);
    g.fillStyle = '#e8eeea'; g.fillRect(0, 0, PAGE_W, PAGE_H);
    for (const L of layers) if (!L.hidden) drawLayer(g, L);
  }
  function renderOverlay(cursor) {
    og.clearRect(0, 0, PAGE_W, PAGE_H);
    const L = selLayer();
    if (L) {
      og.save();
      og.translate(L.x, L.y); og.rotate(L.rot * Math.PI / 180);
      og.strokeStyle = '#5cc8d6'; og.lineWidth = 3; og.setLineDash([11, 8]);
      og.strokeRect(-L.w / 2, -L.h / 2, L.w, L.h);
      og.setLineDash([]);
      if (mode === 'arrange') {
        og.fillStyle = '#0e1418'; og.strokeStyle = '#5cc8d6'; og.lineWidth = 3;
        og.beginPath(); og.rect(L.w / 2 - 16, L.h / 2 - 16, 32, 32); og.fill(); og.stroke();
        og.beginPath(); og.moveTo(0, -L.h / 2); og.lineTo(0, -L.h / 2 - 64); og.stroke();
        og.beginPath(); og.arc(0, -L.h / 2 - 64, 17, 0, TAU); og.fill(); og.stroke();
        og.beginPath(); og.arc(0, -L.h / 2 - 64, 6, 0, TAU); og.fillStyle = '#5cc8d6'; og.fill();
      }
      og.restore();
    }
    if (mode === 'mask' && cursor && L) {
      og.strokeStyle = 'rgba(92,200,214,.85)'; og.lineWidth = 2;
      og.beginPath(); og.arc(cursor[0], cursor[1], brush / 2, 0, TAU); og.stroke();
    }
  }

  /* ---------- mask painting ---------- */
  let lastPaint = null;
  function ensureMask(L) {
    if (L.mask) return;
    L.mask = document.createElement('canvas');
    L.mask.width = L.img.width; L.mask.height = L.img.height;
    const mg = L.mask.getContext('2d');
    mg.fillStyle = '#fff'; mg.fillRect(0, 0, L.mask.width, L.mask.height);
  }
  function paintAt(px, py) {
    const L = selLayer(); if (!L || !L.mask) return;
    const [lx, ly] = local(L, px, py);
    const mx = (lx + L.w / 2) / L.w * L.img.width, my = (ly + L.h / 2) / L.h * L.img.height;
    const mg = L.mask.getContext('2d');
    const r = Math.max(2, brush / 2 * (L.img.width / L.w));
    mg.lineWidth = r * 2; mg.lineCap = 'round'; mg.lineJoin = 'round';
    mg.strokeStyle = '#fff'; mg.fillStyle = '#fff';
    mg.globalCompositeOperation = maskErase ? 'destination-out' : 'source-over';
    if (lastPaint) {
      mg.beginPath(); mg.moveTo(lastPaint[0], lastPaint[1]); mg.lineTo(mx, my); mg.stroke();
    } else {
      mg.beginPath(); mg.arc(mx, my, r, 0, TAU); mg.fill();
    }
    lastPaint = [mx, my];
    render();
  }

  /* ---------- pointer interaction ---------- */
  const ptrs = new Map();
  let dragMode = null, dragStart = null, gesture = null;

  function hitTest(px, py) {
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].hidden) continue;
      const [lx, ly] = local(layers[i], px, py);
      if (Math.abs(lx) <= layers[i].w / 2 && Math.abs(ly) <= layers[i].h / 2) return i;
    }
    return -1;
  }

  overlay.addEventListener('pointerdown', (e) => {
    try { overlay.setPointerCapture(e.pointerId); } catch (x) {}
    const [px, py] = toPage(e);
    ptrs.set(e.pointerId, [px, py]);
    const L = selLayer();
    if (ptrs.size === 2 && L && mode === 'arrange') {
      const pts = [...ptrs.values()];
      gesture = { d0: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1, a0: Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]), w: L.w, h: L.h, rot: L.rot };
      dragMode = 'gesture'; dragStart = null;
      return;
    }
    if (mode === 'mask') {
      if (L && L.mask) { dragMode = 'paint'; lastPaint = null; paintAt(px, py); }
      return;
    }
    if (L) {
      const [lx, ly] = local(L, px, py);
      if (Math.abs(lx - L.w / 2) <= 34 && Math.abs(ly - L.h / 2) <= 34) {
        dragMode = 'scale';
        dragStart = { x: L.x, y: L.y, w: L.w, h: L.h, d0: Math.hypot(px - L.x, py - L.y) || 1 };
        return;
      }
      if (Math.abs(lx) <= 34 && Math.abs(ly - (-L.h / 2 - 64)) <= 34) {
        dragMode = 'rotate';
        dragStart = { rot: L.rot, a0: Math.atan2(py - L.y, px - L.x) };
        return;
      }
    }
    const idx = hitTest(px, py);
    if (idx >= 0) {
      select(idx);
      dragMode = 'move';
      dragStart = { px, py, x: layers[idx].x, y: layers[idx].y };
    } else {
      select(-1);
      dragMode = null;
    }
    renderOverlay();
  });

  overlay.addEventListener('pointermove', (e) => {
    const [px, py] = toPage(e);
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [px, py]);
    const L = selLayer();
    if (dragMode === 'gesture' && gesture && L && ptrs.size >= 2) {
      const pts = [...ptrs.values()];
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1;
      const a = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
      const s = clamp(d / gesture.d0, 0.02, 30);
      L.w = gesture.w * s; L.h = gesture.h * s;
      L.rot = gesture.rot + (a - gesture.a0) * 180 / Math.PI;
      dirty = true; render(); renderOverlay([px, py]);
      return;
    }
    if (!L || !dragStart) { if (mode === 'mask') renderOverlay([px, py]); return; }
    if (dragMode === 'move') {
      L.x = dragStart.x + (px - dragStart.px);
      L.y = dragStart.y + (py - dragStart.py);
      dirty = true; render(); renderOverlay();
    } else if (dragMode === 'scale') {
      const d = Math.hypot(px - dragStart.x, py - dragStart.y) || 1;
      const s = clamp(d / dragStart.d0, 0.02, 30);
      L.w = dragStart.w * s; L.h = dragStart.h * s;
      dirty = true; render(); renderOverlay();
    } else if (dragMode === 'rotate') {
      const a = Math.atan2(py - L.y, px - L.x);
      let deg = dragStart.rot + (a - dragStart.a0) * 180 / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      L.rot = Math.round(deg * 10) / 10;
      dirty = true; render(); renderOverlay();
    } else if (dragMode === 'paint') {
      paintAt(px, py); dirty = true; renderOverlay([px, py]);
    }
  });

  function endPtr(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) gesture = null;
    if (dragMode === 'paint') { const L = selLayer(); if (L) L.maskDirty = true; }
    if (ptrs.size === 0) { dragMode = null; dragStart = null; lastPaint = null; }
  }
  overlay.addEventListener('pointerup', endPtr);
  overlay.addEventListener('pointercancel', endPtr);

  document.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const L = selLayer(); if (!L) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLayer(sel); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); L.x -= step; dirty = true; render(); renderOverlay(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); L.x += step; dirty = true; render(); renderOverlay(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); L.y -= step; dirty = true; render(); renderOverlay(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); L.y += step; dirty = true; render(); renderOverlay(); }
  });

  /* ---------- layers ---------- */
  function select(i) {
    sel = (i >= 0 && i < layers.length) ? i : -1;
    if (sel < 0 && mode === 'mask') setMode('arrange');
    renderLayerList();
    renderOverlay();
  }
  function removeLayer(i) {
    if (i < 0 || i >= layers.length) return;
    layers.splice(i, 1);
    dirty = true;
    select(Math.min(i, layers.length - 1));
    render();
    syncPublish();
  }

  function renderLayerList() {
    const ol = $('layers'); ol.innerHTML = '';
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      const li = document.createElement('li');
      li.className = 'layer' + (i === sel ? ' sel' : '');
      const r1 = document.createElement('div'); r1.className = 'row1';
      const eye = document.createElement('button'); eye.type = 'button'; eye.className = 'mini' + (L.hidden ? '' : ' on'); eye.textContent = L.hidden ? 'Hid' : 'See';
      eye.title = 'Show or hide the layer';
      eye.addEventListener('click', () => { L.hidden = !L.hidden; dirty = true; render(); renderLayerList(); });
      const name = document.createElement('input'); name.className = 'lname'; name.value = L.name; name.maxLength = 60;
      name.setAttribute('aria-label', 'Layer name');
      name.addEventListener('input', () => { L.name = name.value; dirty = true; });
      name.addEventListener('pointerdown', (e) => e.stopPropagation());
      const up = document.createElement('button'); up.type = 'button'; up.className = 'mini'; up.textContent = '▲'; up.title = 'Bring nearer the top';
      up.addEventListener('click', () => { if (i < layers.length - 1) { layers.splice(i, 1); layers.splice(i + 1, 0, L); sel = i + 1; dirty = true; render(); renderLayerList(); renderOverlay(); } });
      const dn = document.createElement('button'); dn.type = 'button'; dn.className = 'mini'; dn.textContent = '▼'; dn.title = 'Send nearer the page';
      dn.addEventListener('click', () => { if (i > 0) { layers.splice(i, 1); layers.splice(i - 1, 0, L); sel = i - 1; dirty = true; render(); renderLayerList(); renderOverlay(); } });
      const del = document.createElement('button'); del.type = 'button'; del.className = 'mini'; del.textContent = '✕'; del.title = 'Remove the layer';
      del.addEventListener('click', () => removeLayer(i));
      r1.append(eye, name, up, dn, del);
      const r2 = document.createElement('div'); r2.className = 'row2';
      const blend = document.createElement('select'); blend.setAttribute('aria-label', 'Blend mode');
      for (const b of BLENDS) {
        const o = document.createElement('option'); o.value = b; o.textContent = BLEND_LABELS[b] || b.replace(/-/g, ' ');
        blend.appendChild(o);
      }
      blend.value = L.blend;
      blend.addEventListener('change', () => { L.blend = blend.value; dirty = true; render(); });
      const op = document.createElement('input'); op.type = 'range'; op.min = '0'; op.max = '100'; op.value = String(Math.round(L.opacity * 100));
      op.setAttribute('aria-label', 'Opacity');
      op.addEventListener('input', () => { L.opacity = clamp(+op.value / 100, 0, 1); dirty = true; render(); });
      const mk = document.createElement('button'); mk.type = 'button'; mk.className = 'mini' + (L.mask ? ' on' : ''); mk.textContent = 'Mask';
      mk.title = 'Paint a mask on this layer';
      mk.addEventListener('click', () => { select(i); ensureMask(L); setMode('mask'); });
      r2.append(blend, op, mk);
      li.append(r1, r2);
      li.addEventListener('pointerdown', () => { if (sel !== i) select(i); });
      ol.appendChild(li);
    }
  }

  function setMode(m) {
    mode = m;
    stage.classList.toggle('masking', m === 'mask');
    $('maskbar').hidden = m !== 'mask';
    if (m === 'mask') { const L = selLayer(); if (L) ensureMask(L); }
    renderOverlay();
  }
  $('maskDone').addEventListener('click', () => setMode('arrange'));
  $('maskErase').addEventListener('click', () => { maskErase = true; $('maskErase').classList.add('on'); $('maskRestore').classList.remove('on'); });
  $('maskRestore').addEventListener('click', () => { maskErase = false; $('maskRestore').classList.add('on'); $('maskErase').classList.remove('on'); });
  $('brush').addEventListener('input', () => { brush = +$('brush').value; });
  $('maskInvert').addEventListener('click', () => {
    const L = selLayer(); if (!L || !L.mask) return;
    const mg = L.mask.getContext('2d');
    mg.globalCompositeOperation = 'difference';
    mg.fillStyle = '#fff'; mg.fillRect(0, 0, L.mask.width, L.mask.height);
    mg.globalCompositeOperation = 'source-over';
    L.maskDirty = true; dirty = true; render();
  });
  $('maskClear').addEventListener('click', () => {
    const L = selLayer(); if (!L || !L.mask) return;
    const mg = L.mask.getContext('2d');
    mg.globalCompositeOperation = 'source-over';
    mg.fillStyle = '#fff'; mg.fillRect(0, 0, L.mask.width, L.mask.height);
    L.maskDirty = true; dirty = true; render();
  });

  /* ---------- adding images ---------- */
  async function addFiles(files) {
    let added = 0;
    for (const f of files) {
      if (!f || !String(f.type || '').startsWith('image/')) continue;
      let bmp = null;
      try { bmp = await createImageBitmap(f); } catch (x) { continue; }
      const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
      const cnv = document.createElement('canvas');
      cnv.width = Math.max(1, Math.round(bmp.width * scale));
      cnv.height = Math.max(1, Math.round(bmp.height * scale));
      cnv.getContext('2d').drawImage(bmp, 0, 0, cnv.width, cnv.height);
      if (bmp.close) bmp.close();
      const fit = Math.min(PAGE_W * 0.8 / cnv.width, PAGE_H * 0.8 / cnv.height, 1);
      layers.push({
        key: 'k' + (++keySeq) + Date.now().toString(36),
        name: (String(f.name || 'screenshot').replace(/\.[a-z0-9]+$/i, '') || 'screenshot').slice(0, 60),
        img: cnv,
        x: PAGE_W / 2 + (added % 5) * 24, y: PAGE_H / 2 + (added % 5) * 24,
        w: Math.round(cnv.width * fit), h: Math.round(cnv.height * fit),
        rot: 0, blend: 'source-over', opacity: 1,
        mask: null, maskDirty: false, hidden: false, isNew: true,
      });
      added++;
    }
    if (added) {
      select(layers.length - 1);
      dirty = true; render(); syncPublish();
      setStatus(added === 1 ? 'One image on the page.' : added + ' images on the page.');
    }
  }
  $('file').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
  document.addEventListener('paste', (e) => {
    const items = [...((e.clipboardData && e.clipboardData.items) || [])].filter((i) => i.type && i.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    addFiles(items.map((i) => i.getAsFile()).filter(Boolean));
  });

  /* ---------- persistence ---------- */
  function setStatus(t) { $('saveStatus').textContent = t; }
  function syncPublish() { $('btnPublish').disabled = layers.length === 0; }
  function updateEntryState() {
    const el = $('entryState');
    const st = BOOT.status;
    el.textContent = st === 'ledger' ? 'This page is in the ledger. The book shows it.'
      : st === 'withdrawn' ? 'Lifted out of the ledger. Punch it back in when it is ready.'
      : BOOT.id ? 'A private slip. Only you' + (BOOT.keeper ? ' and keepers' : '') + ' can see it until it is punched in.'
      : 'A new page. Save it as a private slip, or punch it straight into the ledger.';
    $('btnWithdraw').hidden = !(BOOT.id && st === 'ledger');
    $('btnDelete').hidden = !BOOT.id;
    $('btnPublish').textContent = st === 'ledger' ? 'Save changes in the ledger' : 'Punch into the ledger';
  }

  async function api(body) {
    const res = await fetch('/ledger/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': BOOT.csrf },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({ ok: false, error: 'Bad server response.' }));
    if (!j.ok) throw new Error(j.error || 'Save failed.');
    return j;
  }

  let saving = false;
  async function save(publish) {
    if (saving) return;
    if (publish && layers.length === 0) { setStatus('Nothing on the page yet.'); return; }
    saving = true; $('btnSave').disabled = true; $('btnPublish').disabled = true;
    setStatus(publish ? 'Punching…' : 'Saving…');
    try {
      render();
      const doc = {
        v: 1, page: { w: PAGE_W, h: PAGE_H },
        layers: layers.map((L) => ({
          img: L.key, name: L.name,
          x: Math.round(L.x * 10) / 10, y: Math.round(L.y * 10) / 10,
          w: Math.round(L.w * 10) / 10, h: Math.round(L.h * 10) / 10,
          rot: Math.round(L.rot * 10) / 10,
          blend: L.blend, opacity: Math.round(L.opacity * 100) / 100,
          masked: !!L.mask, hidden: !!L.hidden,
        })),
      };
      const images = {}, masks = {};
      for (const L of layers) {
        if (L.isNew) images[L.key] = L.img.toDataURL('image/png');
        if (L.mask && L.maskDirty) masks[L.key] = L.mask.toDataURL('image/png');
      }
      if ($('keeperNote') && BOOT.id) {
        // keeper note rides along for keepers; the server only honours it from one
        try { await api({ op: 'keeper', id: BOOT.id, keeper_note: $('keeperNote').value }); } catch (x) { /* not a keeper or unsavable yet */ }
      }
      const j = await api({
        op: 'save', id: BOOT.id || 0,
        title: $('title').value, note: $('note').value, publish: !!publish,
        doc: JSON.stringify(doc),
        composite: cv.toDataURL('image/png'),
        images, masks,
      });
      BOOT.id = j.id; BOOT.status = j.status;
      history.replaceState(null, '', '/ledger/compose/?id=' + j.id);
      layers.forEach((L) => { L.isNew = false; L.maskDirty = false; });
      dirty = false;
      updateEntryState();
      setStatus(publish || j.status === 'ledger' ? 'In the ledger. The book shows it.' : 'Slip saved. Private for now.');
    } catch (err) {
      setStatus(err && err.message ? err.message : 'Save failed.');
    } finally {
      saving = false; $('btnSave').disabled = false; syncPublish();
    }
  }
  $('btnSave').addEventListener('click', () => save(false));
  $('btnPublish').addEventListener('click', () => save(true));

  $('btnWithdraw').addEventListener('click', async () => {
    if (!BOOT.id || !confirm('Lift this page out of the ledger? It becomes a private slip again.')) return;
    try {
      await api({ op: 'withdraw', id: BOOT.id });
      BOOT.status = 'withdrawn'; dirty = false; updateEntryState();
      setStatus('Lifted out of the ledger.');
    } catch (err) { setStatus(err.message || 'Could not lift the page.'); }
  });
  $('btnDelete').addEventListener('click', async () => {
    if (!BOOT.id || !confirm('Burn this page and all its layers? This cannot be undone.')) return;
    try {
      await api({ op: 'delete', id: BOOT.id });
      dirty = false;
      location.href = '/ledger/';
    } catch (err) { setStatus(err.message || 'Could not burn the page.'); }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- loading an existing page ---------- */
  function loadCanvas(url, optional) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const cnv = document.createElement('canvas');
        cnv.width = im.naturalWidth; cnv.height = im.naturalHeight;
        cnv.getContext('2d').drawImage(im, 0, 0);
        resolve(cnv);
      };
      im.onerror = () => resolve(optional ? null : null);
      im.src = url;
    });
  }
  async function boot() {
    fitCanvas();
    if (BOOT.id && BOOT.doc && Array.isArray(BOOT.doc.layers)) {
      for (const dl of BOOT.doc.layers) {
        const imgC = await loadCanvas(BOOT.img_base + '&k=img&f=' + encodeURIComponent(dl.img));
        if (!imgC) continue;
        let maskC = null;
        if (dl.masked) {
          maskC = await loadCanvas(BOOT.img_base + '&k=mask&f=' + encodeURIComponent(dl.img), true);
        }
        layers.push({
          key: dl.img, name: dl.name || 'layer', img: imgC,
          x: +dl.x || PAGE_W / 2, y: +dl.y || PAGE_H / 2,
          w: +dl.w || imgC.width, h: +dl.h || imgC.height,
          rot: +dl.rot || 0, blend: BLENDS.includes(dl.blend) ? dl.blend : 'source-over',
          opacity: dl.opacity == null ? 1 : clamp(+dl.opacity, 0, 1),
          mask: maskC, maskDirty: false, hidden: !!dl.hidden, isNew: false,
        });
      }
      if (layers.length) sel = layers.length - 1;
    }
    render(); renderOverlay(); renderLayerList(); updateEntryState(); syncPublish();
  }
  boot();
})();
