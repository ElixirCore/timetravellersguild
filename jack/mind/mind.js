/* Jack's mind in 3D: his life as a rising thread from 1951 to 2033, memories and evidence in orbit,
   his live state moving the field. Fly, read, and ask him about any of it. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CFG = window.TTG_MIND || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GAUGES = [['activity', 'ACTIVITY'], ['curiosity', 'CURIOSITY'], ['reminiscence', 'REMINISCENCE'], ['strain', 'STRAIN'], ['company', 'COMPANY']];

/* ---------- renderer, scene, camera ---------- */
const canvas = $('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch (e) {
  $('fallback').style.display = 'grid';
  throw e;
}
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.setClearColor(0x030207, 1);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030207, 0.0052);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 4;
controls.maxDistance = 260;
controls.screenSpacePanning = true;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/* ---------- text and image sprites ---------- */
function labelSprite(lines, o = {}) {
  const pad = 26, fs = o.size || 46, w = o.width || 900;
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const font = (l) => `${l.bold ? '700 ' : ''}${Math.round(fs * (l.scale || 1))}px ${l.serif ? 'Georgia, serif' : 'ui-monospace, Menlo, monospace'}`;
  // wrap
  const rows = [];
  x.font = font({});
  for (const l of lines) {
    x.font = font(l);
    const words = String(l.text).split(' ');
    let cur = '';
    for (const wd of words) {
      const t = cur ? cur + ' ' + wd : wd;
      if (x.measureText(t).width > w - pad * 2 && cur) { rows.push({ ...l, text: cur }); cur = wd; } else cur = t;
    }
    rows.push({ ...l, text: cur });
  }
  const lh = (r) => fs * (r.scale || 1) * 1.28;
  c.width = w;
  c.height = Math.ceil(pad * 2 + rows.reduce((a, r) => a + lh(r), 0));
  if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, c.width, c.height); }
  if (o.border) { x.strokeStyle = o.border; x.lineWidth = 4; x.strokeRect(2, 2, c.width - 4, c.height - 4); }
  let y = pad;
  for (const r of rows) {
    x.font = font(r);
    x.fillStyle = r.color || '#dfeee8';
    x.textBaseline = 'top';
    x.fillText(r.text, pad, y);
    y += lh(r);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  const k = (o.worldWidth || 8) / c.width;
  s.scale.set(c.width * k, c.height * k, 1);
  return s;
}
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');
function photoSprite(ev) {
  const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(5.2, 3.9, 1);
  loader.load(ev.image.replace(/\/960px-/, '/500px-'), (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex; mat.needsUpdate = true;
    const a = tex.image.width / tex.image.height || 1.33;
    s.scale.set(4.4 * Math.min(a, 1.8), 4.4 * Math.min(a, 1.8) / a, 1);
  }, undefined, () => { mat.color.set(0x334044); });
  return s;
}

/* ---------- the world ---------- */
let life = null, state = {}, shown = {};
const eraNodes = [];      // {era, pos, sprite, ring}
const memNodes = new Map(); // id -> {m, sprite, pos, glow, era}
const evNodes = [];       // {ev, sprite, base}
const pickable = [];
let thread = null, curve = null;
const pulses = [];

function eraPosition(i) {
  const a = i * 0.95, r = 24 + i * 2.4;
  return new THREE.Vector3(Math.cos(a) * r, i * 15 - 54, Math.sin(a) * r);
}

function build() {
  const eras = life.eras;
  const pts = eras.map((e, i) => eraPosition(i));
  curve = new THREE.CatmullRomCurve3([pts[0].clone().add(new THREE.Vector3(0, -14, 0)), ...pts, pts[pts.length - 1].clone().add(new THREE.Vector3(0, 18, 0))]);
  thread = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.16, 8, false),
    new THREE.MeshBasicMaterial({ color: 0xd7b25d, transparent: true, opacity: 0.55 }));
  scene.add(thread);
  // the punched holes along the thread
  const holes = new THREE.BufferGeometry();
  const hp = [];
  for (let i = 0; i < 900; i++) {
    const p = curve.getPoint(i / 900);
    hp.push(p.x + (Math.random() - .5) * 1.6, p.y + (Math.random() - .5) * 1.6, p.z + (Math.random() - .5) * 1.6);
  }
  holes.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  scene.add(new THREE.Points(holes, new THREE.PointsMaterial({ color: 0xa8e1cb, size: 0.12, transparent: true, opacity: 0.6, depthWrite: false })));

  eras.forEach((era, i) => {
    const pos = pts[i];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.06, 8, 64), new THREE.MeshBasicMaterial({ color: 0xa8e1cb, transparent: true, opacity: 0.5 }));
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
    const label = labelSprite([{ text: era.years, color: '#d7b25d', bold: true }, { text: era.title.toUpperCase(), bold: true, scale: 1.15 }, { text: era.line, serif: true, scale: 0.8, color: '#b9cfc8' }],
      { worldWidth: 11, width: 980 });
    label.position.copy(pos).add(new THREE.Vector3(0, 5.6, 0));
    label.userData = { kind: 'era', era, index: i };
    scene.add(label);
    pickable.push(label);
    eraNodes.push({ era, pos, sprite: label, ring });

    const mems = life.memories.filter((m) => m.era === era.id);
    mems.forEach((m, j) => {
      const a = (j / Math.max(1, mems.length)) * Math.PI * 2 + i;
      const mp = pos.clone().add(new THREE.Vector3(Math.cos(a) * 9.5, -1.5 + (j % 2) * 3.4, Math.sin(a) * 9.5));
      const card = labelSprite([{ text: 'JACK REMEMBERS · ' + m.year, color: '#e0604f', scale: 0.62, bold: true }, { text: m.title, serif: true, bold: true, color: '#1b1a17' }],
        { worldWidth: 6.2, width: 760, bg: '#efe6cc', border: '#1b1a17', size: 50 });
      card.position.copy(mp);
      card.userData = { kind: 'memory', id: m.id };
      scene.add(card);
      pickable.push(card);
      // a filament from the thread to the memory
      const g = new THREE.BufferGeometry().setFromPoints([pos, mp]);
      scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x29554d, transparent: true, opacity: 0.7 })));
      memNodes.set(m.id, { m, sprite: card, pos: mp, glow: 0, era: i });
    });

    era.evidence.forEach((id, k) => {
      const ev = life.evidence.find((e) => e.id === id);
      if (!ev) return;
      const a = (k / era.evidence.length) * Math.PI * 2 + i * 1.7 + 0.6;
      const base = pos.clone().add(new THREE.Vector3(Math.cos(a) * 17, 2 + Math.sin(k * 2.1) * 4, Math.sin(a) * 17));
      const s = photoSprite(ev);
      s.position.copy(base);
      s.userData = { kind: 'evidence', ev };
      scene.add(s);
      pickable.push(s);
      evNodes.push({ ev, sprite: s, base, phase: Math.random() * 6 });
    });
  });

  // 2033: the stacks Mabel speaks from, a dim region above the end of the thread
  const top = pts[pts.length - 1].clone().add(new THREE.Vector3(0, 12, 0));
  const veil = labelSprite([{ text: 'EVIDENCE WITHHELD', bold: true, color: '#7d9a94' }, { text: 'It has not happened in your present.', serif: true, color: '#7d9a94', scale: .85 }], { worldWidth: 9, width: 900 });
  veil.position.copy(top);
  scene.add(veil);

  // the field of motes: the holes of his cards, everywhere he has been
  const mg = new THREE.BufferGeometry(), mp = [], seeds = [];
  for (let i = 0; i < 3200; i++) {
    const t = Math.random(), p = curve.getPoint(t), r = 6 + Math.random() * 46, a = Math.random() * Math.PI * 2;
    mp.push(p.x + Math.cos(a) * r, p.y + (Math.random() - .5) * 26, p.z + Math.sin(a) * r);
    seeds.push(a, r, t);
  }
  mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xa8e1cb, size: 0.18, transparent: true, opacity: 0.55, depthWrite: false }));
  motes.userData.seeds = seeds;
  scene.add(motes);

  $('eras').innerHTML = eras.map((e, i) => `<button type="button" data-era="${i}" title="${esc(e.title)}">${i + 1} · ${esc(e.years.replace('17.04.', ''))}</button>`).join('');
  home(true);
}
let motes = null;

/* ---------- flight ---------- */
let flight = null;
function flyTo(target, from, ms = 1500) {
  const endTarget = target.clone();
  const endPos = from ? from.clone() : target.clone().add(new THREE.Vector3(12, 5, 14));
  if (calm) { controls.target.copy(endTarget); camera.position.copy(endPos); return; }
  flight = { t0: performance.now(), ms, a: camera.position.clone(), b: endPos, ta: controls.target.clone(), tb: endTarget };
}
function viewFrom(pos, dist = 16) {
  // stand outside the spiral, looking in at the point
  const out = new THREE.Vector3(pos.x, 0, pos.z).normalize();
  if (!isFinite(out.x)) out.set(1, 0, 0);
  return pos.clone().add(out.multiplyScalar(dist)).add(new THREE.Vector3(0, dist * 0.28, 0));
}
function flyToEra(i) {
  const n = eraNodes[i];
  if (!n) return;
  flyTo(n.pos.clone().add(new THREE.Vector3(0, 1, 0)), viewFrom(n.pos, 30));
  document.querySelectorAll('#eras button').forEach((b) => b.classList.toggle('on', +b.dataset.era === i));
}
function flyToMemory(id, open = true) {
  const n = memNodes.get(id);
  if (!n) return;
  n.glow = 1;
  flyTo(n.pos, viewFrom(n.pos, 11));
  document.querySelectorAll('#eras button').forEach((b) => b.classList.toggle('on', +b.dataset.era === n.era));
  if (open) openMemory(id);
}
function home(instant) {
  const narrow = innerWidth < 760;
  const p = narrow ? new THREE.Vector3(70, 26, 96) : new THREE.Vector3(78, 22, 92), t = new THREE.Vector3(0, 4, 0);
  if (instant) { camera.position.copy(p); controls.target.copy(t); } else flyTo(t, p, 2000);
  document.querySelectorAll('#eras button').forEach((b) => b.classList.remove('on'));
}

/* ---------- the reader ---------- */
let selected = null;
const reader = $('reader'), body = $('readerBody');
function showReader(html) { body.innerHTML = html; reader.hidden = false; reader.scrollTop = 0; }
function evHtml(e) {
  return `<div class="ev"><img src="${esc(e.image.replace(/\/960px-/, '/330px-'))}" alt="" loading="lazy"><div><b style="color:#6fb6d8">REAL · ${esc(e.year)}</b> ${esc(e.caption)}<br>${esc(e.credit)} · ${esc(e.licence)} · <a href="${esc(e.source)}" target="_blank" rel="noopener">source</a></div></div>`;
}
function openMemory(id) {
  const n = memNodes.get(id);
  if (!n) return;
  selected = id;
  const m = n.m, era = life.eras.find((e) => e.id === m.era);
  const evs = m.evidence.map((x) => life.evidence.find((e) => e.id === x)).filter(Boolean);
  showReader(`<span class="k">JACK REMEMBERS · ${esc(m.year)} · ${esc(era ? era.title : '')}</span><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p>`
    + (evs.length ? evs.map(evHtml).join('') : '<p style="font-size:11px;color:#7d9a94">No evidence beside this memory.</p>')
    + `<div class="acts"><button type="button" data-ask="Tell me more about “${esc(m.title)}”.">Ask Jack about this</button><button type="button" data-ask="Is “${esc(m.title)}” true?">Is this true?</button></div>`);
  $('q').placeholder = `Ask Jack about “${m.title}”…`;
}
function openEvidence(ev) {
  selected = null;
  const big = ev.image.replace(/\/960px-/, '/640px-');
  showReader(`<span class="k" style="color:#6fb6d8">REAL · ${esc(ev.year)}</span><h3>${esc(ev.caption.split(':')[0])}</h3><img src="${esc(big)}" alt="${esc(ev.caption)}" style="width:100%;margin:4px 0 8px"><p>${esc(ev.caption)}</p><p style="font-size:11px;color:#7d9a94">${esc(ev.credit)} · ${esc(ev.licence)} · <a style="color:inherit" href="${esc(ev.source)}" target="_blank" rel="noopener">via ${esc(ev.via)}</a>. Evidence shows the world around a memory, not proof of it.</p>`
    + `<div class="acts"><button type="button" data-ask="What does this remind you of: ${esc(ev.caption.split(':')[0])}?">Ask Jack what it reminds him of</button></div>`);
}
function openList() {
  showReader('<h2>EVERY MEMORY</h2>' + life.eras.map((e, i) => `<p style="margin:10px 0 4px"><button type="button" data-era="${i}" style="background:none;border:0;color:#d7b25d;font:700 11px ui-monospace,Menlo,monospace;cursor:pointer;padding:0">${esc(e.years)} · ${esc(e.title)}</button></p>`
    + life.memories.filter((m) => m.era === e.id).map((m) => `<button type="button" data-mem="${esc(m.id)}" style="display:block;background:none;border:0;color:#dfeee8;font:13px Georgia,serif;cursor:pointer;padding:3px 0;text-align:left">· ${esc(m.title)}</button>`).join('')).join(''));
}
reader.addEventListener('click', (e) => {
  const a = e.target.closest('[data-ask]');
  if (a) { $('q').value = a.dataset.ask; ask(); return; }
  const m = e.target.closest('[data-mem]');
  if (m) { flyToMemory(m.dataset.mem); return; }
  const r = e.target.closest('[data-era]');
  if (r) flyToEra(+r.dataset.era);
});
$('readerClose').onclick = () => { reader.hidden = true; selected = null; $('q').placeholder = 'Ask Jack about anything you see…'; $('btnList').setAttribute('aria-expanded', 'false'); };

/* ---------- picking ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null, downAt = null;
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickable, false)[0];
  return hit ? hit.object : null;
}
canvas.addEventListener('pointermove', (ev) => {
  const o = pick(ev);
  hovered = o;
  const tip = $('tip');
  if (o) {
    const u = o.userData;
    tip.textContent = u.kind === 'memory' ? memNodes.get(u.id).m.title : u.kind === 'evidence' ? 'REAL · ' + u.ev.caption.split(':')[0] : u.era.years + ' · ' + u.era.title;
    tip.style.left = ev.clientX + 'px'; tip.style.top = ev.clientY + 'px'; tip.style.display = 'block';
    canvas.style.cursor = 'pointer';
  } else { tip.style.display = 'none'; canvas.style.cursor = ''; }
});
canvas.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY]; stopTour(); });
canvas.addEventListener('pointerup', (ev) => {
  if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 6) return;
  const o = pick(ev);
  if (!o) return;
  const u = o.userData;
  if (u.kind === 'memory') flyToMemory(u.id);
  else if (u.kind === 'evidence') { flyTo(o.position, viewFrom(o.position, 9)); openEvidence(u.ev); }
  else if (u.kind === 'era') flyToEra(u.index);
});

/* ---------- keyboard flight ---------- */
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (e.key === 'Escape') { $('readerClose').click(); return; }
  if (/^[1-9]$/.test(e.key) && life) { flyToEra(+e.key - 1); return; }
  keys.add(e.key.toLowerCase());
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function keyFlight(dt) {
  if (!keys.size) return;
  const f = new THREE.Vector3(); camera.getWorldDirection(f);
  const r = new THREE.Vector3().crossVectors(f, camera.up).normalize();
  const v = new THREE.Vector3(), sp = 26 * dt * (keys.has('shift') ? 2.5 : 1);
  if (keys.has('w') || keys.has('arrowup')) v.add(f);
  if (keys.has('s') || keys.has('arrowdown')) v.sub(f);
  if (keys.has('d') || keys.has('arrowright')) v.add(r);
  if (keys.has('a') || keys.has('arrowleft')) v.sub(r);
  if (keys.has('e')) v.y += 1;
  if (keys.has('q')) v.y -= 1;
  if (!v.lengthSq()) return;
  v.normalize().multiplyScalar(sp);
  camera.position.add(v); controls.target.add(v);
  flight = null; stopTour();
}

/* ---------- tour ---------- */
let tour = null;
function stopTour() { if (tour) { clearInterval(tour); tour = null; $('btnTour').setAttribute('aria-pressed', 'false'); $('btnTour').textContent = '▶ Tour his life'; } }
$('btnTour').onclick = () => {
  if (tour) return stopTour();
  let i = 0;
  const step = () => {
    if (!life) return;
    if (i >= life.eras.length) return stopTour();
    flyToEra(i);
    const first = life.memories.find((m) => m.era === life.eras[i].id);
    if (first) setTimeout(() => tour && flyToMemory(first.id), 2600);
    i++;
  };
  step();
  tour = setInterval(step, 7500);
  $('btnTour').setAttribute('aria-pressed', 'true'); $('btnTour').textContent = '■ Stop tour';
};
$('btnHome').onclick = () => { stopTour(); home(false); };
$('btnNow').onclick = () => {
  stopTour();
  const t = thoughts[0];
  if (t && t.recalled.length) flyToMemory(t.recalled[0].id);
  else showReader('<h2>WHAT HE\'S THINKING</h2><p>He has not recalled anything recently. Ask him something below.</p>');
};
$('btnList').onclick = () => { if (!life) return; const open = reader.hidden || !body.querySelector('[data-mem]'); if (open) openList(); else reader.hidden = true; $('btnList').setAttribute('aria-expanded', String(open)); };
$('eras').addEventListener('click', (e) => { const b = e.target.closest('[data-era]'); if (b) { stopTour(); flyToEra(+b.dataset.era); } });

/* ---------- pulses: a new thought travels the thread to what it recalled ---------- */
function pulseTo(memId) {
  const n = memNodes.get(memId);
  if (!n || !curve) return;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
  scene.add(mesh);
  pulses.push({ mesh, t: 1, to: (n.era + 1) / (life.eras.length + 1), mem: n, born: performance.now() });
}

/* ---------- asking ---------- */
let askThread = [];
async function ask() {
  const q = $('q').value.trim();
  if (!q) return;
  stopTour();
  const btn = $('askBtn');
  btn.disabled = true; btn.textContent = '…';
  showReader(`<span class="k" style="color:#7d9a94">YOU ASKED</span><p>${esc(q)}</p><p class="jack" style="color:#7d9a94">Jack is going through his cards…</p>`);
  const fd = new FormData();
  fd.set('csrf', CFG.csrf || ''); fd.set('q', q); fd.set('intent', 'ask'); fd.set('site', 'mind');
  fd.set('focus', selected || ''); fd.set('thread', askThread.join('\n').slice(-1500));
  try {
    const r = await fetch(CFG.desk || '/now/jack', { method: 'POST', body: fd, credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const j = await r.json();
    const text = (j && j.text) || 'The clerk is away from the desk.';
    askThread.push('Visitor: ' + q, 'Clerk: ' + text);
    const rec = (j.recalled || []).filter((id) => memNodes.has(id));
    showReader(`<span class="k" style="color:#7d9a94">YOU ASKED</span><p>${esc(q)}</p><span class="k" style="color:#d7b25d">JACK</span><div class="jack">${text.split(/\n{2,}/).map((p) => '<p>' + esc(p) + '</p>').join('')}</div>`
      + (rec.length ? '<span class="k" style="color:#e0604f">MEMORIES HE DREW ON</span>' + rec.map((id) => `<p style="margin:4px 0"><button type="button" data-mem="${esc(id)}" style="background:none;border:0;color:#dfeee8;font:13px Georgia,serif;cursor:pointer;padding:0;text-align:left">→ ${esc(memNodes.get(id).m.title)}</button></p>`).join('') : ''));
    rec.forEach((id, i) => setTimeout(() => pulseTo(id), i * 400));
    if (rec[0]) { const n = memNodes.get(rec[0]); n.glow = 1; flyTo(n.pos, viewFrom(n.pos, 13), 2200); }
    $('q').value = '';
    setTimeout(poll, 1200);
  } catch (e) {
    showReader('<p>The line to the desk failed. Try again.</p>');
  } finally {
    btn.disabled = false; btn.textContent = 'ASK';
  }
}
$('ask').addEventListener('submit', (e) => { e.preventDefault(); ask(); });

/* ---------- the feed ---------- */
let thoughts = [], lastThoughtAt = 0;
$('gauges').innerHTML = GAUGES.map(([k, l]) => `<div class="gauge"><span>${l}</span><div class="bar"><i id="g-${k}"></i></div><em id="v-${k}">0</em></div>`).join('');
async function poll() {
  try {
    const j = await (await fetch(CFG.feed || '/jack/mind.php', { cache: 'no-store' })).json();
    if (!life) { life = j.life; build(); }
    state = Object.assign(j.state, { _seenAt: Date.now() });
    $('mode').textContent = (state.awake ? state.mode : 'dormant').toUpperCase().replace('_', ' ');
    $('lamp').classList.toggle('on', !!state.awake);
    thoughts = j.thoughts || [];
    const t = thoughts[0];
    if (t && t.at > lastThoughtAt) {
      const first = lastThoughtAt === 0;
      lastThoughtAt = t.at;
      if (!first) t.recalled.forEach((m, i) => setTimeout(() => pulseTo(m.id), i * 350));
    }
  } catch (e) { /* quiet feed: the space still stands */ }
  clearTimeout(poll.timer);
  poll.timer = setTimeout(poll, 5000);
}
poll();
function drift() {
  const now = performance.now() / 1000;
  GAUGES.forEach(([k], i) => {
    const v = Math.max(0, Math.min(1, (state[k] || 0) + (Math.sin(now * (.31 + i * .17)) + Math.sin(now * (.83 + i * .07))) * .035));
    shown[k] = v;
    $('g-' + k).style.width = (v * 100).toFixed(1) + '%';
    $('v-' + k).textContent = Math.round(v * 100);
  });
  const idle = state.idle_seconds == null ? null : state.idle_seconds + Math.round((Date.now() - (state._seenAt || Date.now())) / 1000);
  $('idle').textContent = idle == null ? '–' : idle < 60 ? 'thinking now' : idle < 3600 ? `last thought ${Math.round(idle / 60)} min ago` : idle < 86400 ? `last thought ${Math.round(idle / 3600)} h ago` : 'resting';
  setTimeout(drift, 400);
}
drift();

/* ---------- the loop ---------- */
const clock = new THREE.Clock();
const gold = new THREE.Color(0xd7b25d), mint = new THREE.Color(0xa8e1cb);
function frame() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  keyFlight(dt);
  if (flight) {
    const k = Math.min(1, (performance.now() - flight.t0) / flight.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(flight.a, flight.b, e);
    controls.target.lerpVectors(flight.ta, flight.tb, e);
    if (k >= 1) flight = null;
  }
  const act = shown.activity || 0, rem = shown.reminiscence || 0, strain = shown.strain || 0;
  if (motes && !calm) {
    const p = motes.geometry.attributes.position, s = motes.userData.seeds;
    for (let i = 0; i < p.count; i++) {
      const a = s[i * 3] + t * (0.02 + act * 0.12) * (i % 2 ? 1 : -1);
      const c = curve.getPoint(s[i * 3 + 2]);
      p.setX(i, c.x + Math.cos(a) * s[i * 3 + 1] + (strain > .25 ? Math.sin(t * 9 + i) * strain * .4 : 0));
      p.setZ(i, c.z + Math.sin(a) * s[i * 3 + 1]);
    }
    p.needsUpdate = true;
    motes.material.color.copy(mint).lerp(gold, Math.min(1, rem * 1.6));
  }
  if (thread) thread.material.opacity = 0.35 + 0.25 * Math.sin(t * (0.6 + act * 3)) ** 2 + act * .2;
  eraNodes.forEach((n, i) => { n.ring.rotation.z = t * 0.2 * (i % 2 ? 1 : -1); });
  memNodes.forEach((n) => {
    n.glow *= 0.992;
    const s = 1 + n.glow * 0.25 + (hovered === n.sprite ? 0.08 : 0) + (selected && n.m.id === selected ? 0.12 : 0);
    if (!n.base) n.base = n.sprite.scale.clone();
    n.sprite.scale.set(n.base.x * s, n.base.y * s, 1);
    n.sprite.material.color.setRGB(1, 1 - n.glow * 0.15, 1 - n.glow * 0.4);
  });
  evNodes.forEach((n) => { n.sprite.position.y = n.base.y + Math.sin(t * 0.4 + n.phase) * 0.6; });
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i], age = (performance.now() - p.born) / 1000;
    p.t += (p.to - p.t) * Math.min(1, dt * 1.6);
    if (age < 1.6) p.mesh.position.copy(curve.getPoint(Math.max(0, Math.min(1, p.t))));
    else p.mesh.position.lerp(p.mem.pos, Math.min(1, dt * 3));
    if (age > 2.4) { p.mem.glow = 1; scene.remove(p.mesh); p.mesh.geometry.dispose(); pulses.splice(i, 1); }
  }
  if (!calm && !flight && !keys.size && !tour && !downAt) controls.autoRotate = false;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
addEventListener('pointerup', () => { downAt = null; });
frame();
