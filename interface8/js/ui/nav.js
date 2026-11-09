/* Getting around. The whole tree is one view; tap a sephira to travel to it
   (the camera flies down the tree), tap another one, or a marker at the edge
   of the screen, to follow a path onward; the tree glyph at top left, or Esc,
   pulls back to the whole. Controls play only at the station you are at.
   Mouse and touch share one pointer path; several fingers can turn several
   knobs at once. Two fingers off the controls pinch to zoom (and drag the
   view); a trackpad pinch, or the wheel off the controls, zooms with the
   mouse. Travelling anywhere sets the zoom back. */
import { THREE } from './gl.js';
import { treeBounds, neighbours } from './tree.js';
import { glyphURL } from './glyphs.js';

const TAP_PX = 8;

export function createNav({ canvas, camera, stations, onFirstTouch }) {
  const view = { x: 0, y: 0, d: 60 };
  let focus = null;
  let flight = null;
  let tilt = 0;
  let zoomed = false; // the view is the user's own (pinch / wheel), not a station's
  const listeners = new Set();

  function fitDist(halfW, halfH) {
    const t = Math.tan((camera.fov * Math.PI) / 360);
    return Math.max(halfH / t, halfW / (t * camera.aspect));
  }

  function goalFor(key) {
    if (!key) {
      const b = treeBounds();
      return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, d: fitDist(((b.x1 - b.x0) / 2) * 1.05, ((b.y1 - b.y0) / 2) * 1.06) };
    }
    const st = stations[key];
    const hasIcon = !!st.icon;
    const top = st.R + (hasIcon ? 0.95 : 0.25);
    const bottom = st.R + (key === 'tiferet' ? 0.75 : 0.25);
    const halfH = ((top + bottom) / 2) * 1.08 + 0.35; // room for the top glyphs and the status line
    return { x: st.x, y: st.y + (top - bottom) / 2, d: fitDist(st.R * 1.06, halfH) };
  }

  function go(key) {
    focus = key;
    zoomed = false;
    const to = goalFor(key);
    const span = Math.hypot(to.x - view.x, to.y - view.y);
    flight = { from: { ...view }, to, t: 0, dur: Math.min(1.25, 0.55 + span * 0.018), bump: span * 0.35 };
    listeners.forEach((fn) => fn(key));
  }

  function snap() {
    if (flight || zoomed) return;
    Object.assign(view, goalFor(focus));
  }

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (flight) flight.to = goalFor(focus);
    else snap();
  }

  /* ---------- zoom ---------- */
  function ndcOf(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 };
  }

  /* places the camera at distance d so that world point W sits under screen
     point n (the camera looks straight down the z axis) */
  function zoomTo(W, n, d) {
    const b = treeBounds();
    const dMax = goalFor(null).d * 1.3;
    const dMin = fitDist(1.1, 1.1);
    d = Math.min(dMax, Math.max(dMin, d));
    const t = Math.tan((camera.fov * Math.PI) / 360);
    view.d = d;
    view.x = Math.min(b.x1, Math.max(b.x0, W.x - n.x * d * t * camera.aspect));
    view.y = Math.min(b.y1, Math.max(b.y0, W.y - n.y * d * t));
    if (flight) { flight = null; tilt = 0; }
    if (!zoomed) { zoomed = true; listeners.forEach((fn) => fn(focus)); }
  }

  function worldAtNdc(n) {
    ndc.set(n.x, n.y);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hitPt) ? { x: hitPt.x, y: hitPt.y } : null;
  }

  let pinch = null;
  function pinchStart() {
    const free = [...ptrs.values()].filter((r) => !r.control);
    if (free.length !== 2) return;
    update(0); // settle the camera where it is (a flight stops here)
    const [a, b] = free;
    a.moved = b.moved = true; // neither finger is a tap now
    const n = ndcOf((a.x + b.x) / 2, (a.y + b.y) / 2);
    const W = worldAtNdc(n);
    if (!W) return;
    pinch = { a, b, W, d0: view.d, dist0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)) };
  }

  function pinchMove() {
    const { a, b, W, d0, dist0 } = pinch;
    const dist = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
    zoomTo(W, ndcOf((a.x + b.x) / 2, (a.y + b.y) / 2), d0 * (dist0 / dist));
  }

  function update(dt) {
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.dur);
      const u = flight.t;
      const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      view.x = flight.from.x + (flight.to.x - flight.from.x) * e;
      view.y = flight.from.y + (flight.to.y - flight.from.y) * e;
      view.d = flight.from.d + (flight.to.d - flight.from.d) * e + Math.sin(Math.PI * e) * flight.bump;
      tilt = Math.sin(Math.PI * e) * 0.32;
      if (u >= 1) { flight = null; tilt = 0; }
    }
    camera.position.set(view.x, view.y - view.d * Math.sin(tilt), view.d * Math.cos(tilt));
    camera.lookAt(view.x, view.y, 0);
    camera.updateMatrixWorld();
  }

  /* ---------- pointer ---------- */
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc = new THREE.Vector2();
  const hitPt = new THREE.Vector3();

  function worldAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hitPt) ? { x: hitPt.x, y: hitPt.y } : null;
  }

  function stationAt(w) {
    if (!w) return null;
    for (const st of Object.values(stations)) {
      if (Math.hypot(w.x - st.x, w.y - st.y) <= st.R + 0.4) return st;
    }
    return null;
  }

  function point(e, st, rec) {
    const w = worldAt(e) || { x: 0, y: 0 };
    return {
      sx: e.clientX, sy: e.clientY, lx: w.x - (st ? st.x : 0), ly: w.y - (st ? st.y : 0),
      moved: rec ? rec.moved : false,
    };
  }

  const ptrs = new Map();
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onFirstTouch?.();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const w = worldAt(e);
    let control = null;
    let st = null;
    if (focus && !flight) {
      st = stations[focus];
      if (w) control = st.hitControl(w.x - st.x, w.y - st.y);
    }
    const rec = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, control, st, station: control ? null : stationAt(w), moved: false };
    ptrs.set(e.pointerId, rec);
    if (control) control.down(point(e, st, rec));
    else if (!pinch) pinchStart();
  });

  canvas.addEventListener('pointermove', (e) => {
    const rec = ptrs.get(e.pointerId);
    if (!rec) return;
    rec.x = e.clientX;
    rec.y = e.clientY;
    if (pinch && (rec === pinch.a || rec === pinch.b)) { pinchMove(); return; }
    if (!rec.moved && Math.hypot(e.clientX - rec.x0, e.clientY - rec.y0) > TAP_PX) rec.moved = true;
    if (rec.control) rec.control.move(point(e, rec.st, rec));
  });

  function end(e, cancelled) {
    const rec = ptrs.get(e.pointerId);
    if (!rec) return;
    ptrs.delete(e.pointerId);
    if (pinch && (rec === pinch.a || rec === pinch.b)) { pinch = null; return; }
    if (rec.control) {
      rec.control.up(point(e, rec.st, rec), !cancelled && !rec.moved);
      return;
    }
    if (!cancelled && !rec.moved && rec.station && rec.station.key !== focus) go(rec.station.key);
  }
  canvas.addEventListener('pointerup', (e) => end(e, false));
  canvas.addEventListener('pointercancel', (e) => end(e, true));

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const w = worldAt(e);
    if (!e.ctrlKey && focus && !flight) {
      const st = stations[focus];
      const c = w && st.hitControl(w.x - st.x, w.y - st.y);
      if (c?.wheel) { c.wheel(e.deltaY); return; }
    }
    if (!w) return;
    /* a trackpad pinch arrives as ctrl+wheel with small steps */
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomTo(w, ndcOf(e.clientX, e.clientY), view.d * Math.exp(dy * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- edge markers + DOM overlays ---------- */
  const edges = document.getElementById('edges');
  const pool = [];
  function marker(i) {
    if (!pool[i]) {
      const b = document.createElement('button');
      b.type = 'button';
      const img = document.createElement('img');
      img.alt = '';
      b.appendChild(img);
      b.addEventListener('click', () => { if (b.dataset.key) go(b.dataset.key); });
      edges.appendChild(b);
      pool[i] = b;
    }
    return pool[i];
  }

  const v = new THREE.Vector3();
  function toScreen(x, y, w, h) {
    v.set(x, y, 0).project(camera);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  function layoutDom(w, h) {
    let used = 0;
    if (focus && !flight) {
      const cx = w / 2;
      const cy = h / 2;
      const m = 34;
      /* markers never sit on the station: where the edge point would cover it,
         the marker moves into the free band above or below it */
      const fst = stations[focus];
      const c0 = toScreen(fst.x, fst.y, w, h);
      const rpx = toScreen(fst.x + fst.R, fst.y, w, h).x - c0.x;
      const topBand = 38;
      const bottomBand = h - 64;
      const placed = [];
      for (const key of neighbours(focus)) {
        const st = stations[key];
        const p = toScreen(st.x, st.y, w, h);
        if (p.x > m && p.x < w - m && p.y > m && p.y < h - m) continue; // on screen: tap it directly
        const dx = p.x - cx;
        const dy = p.y - cy;
        const k = Math.min(Math.abs((cx - m) / (dx || 1e-6)), Math.abs((cy - m - 30) / (dy || 1e-6)));
        let ex = cx + dx * k;
        let ey = cy + dy * k;
        if (Math.hypot(ex - c0.x, ey - c0.y) < rpx + 30) {
          const band = dy < 0 ? topBand : bottomBand;
          if ((dy < 0 && band > m) || (dy >= 0 && band < h - m)) ey = band;
          if (dy < 0 && ex < 96) ex = 96; // clear of the home glyph
          if (dy < 0 && ex > w - 96) ex = w - 96; // and of the guide glyph
        }
        ex = Math.min(w - m, Math.max(m, ex));
        for (const q of placed) {
          if (Math.hypot(q.x - ex, q.y - ey) < 52) ex += ex < cx ? 52 : -52;
        }
        placed.push({ x: ex, y: ey });
        const b = marker(used++);
        b.dataset.key = key;
        b.title = key;
        b.setAttribute('aria-label', `go to ${key}`);
        const src = glyphURL(st.glyph);
        if (b.firstChild.getAttribute('src') !== src) b.firstChild.src = src;
        b.style.left = `${ex}px`;
        b.style.top = `${ey}px`;
        b.hidden = false;
      }
    }
    for (let i = used; i < pool.length; i++) pool[i].hidden = true;

    for (const st of Object.values(stations)) {
      for (const o of st.overlays) {
        const on = focus === st.key && !flight;
        if (!on) { if (!o.el.hidden) o.el.hidden = true; continue; }
        const [x0, y0, x1, y1] = o.rect;
        const a = toScreen(st.x + x0, st.y + y1, w, h);
        const b = toScreen(st.x + x1, st.y + y0, w, h);
        o.el.hidden = false;
        o.el.style.left = `${a.x}px`;
        o.el.style.top = `${a.y}px`;
        o.el.style.width = `${b.x - a.x}px`;
        o.el.style.height = `${b.y - a.y}px`;
      }
    }
  }

  return {
    go, update, resize, layoutDom, snap,
    get focus() { return focus; },
    get flying() { return !!flight; },
    get zoomed() { return zoomed; },
    onChange: (fn) => listeners.add(fn),
  };
}
