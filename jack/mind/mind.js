/* Jack's mind in 3D: his life as a rising thread from 1951 to 2033, memories and evidence in orbit,
   his live state moving the field. Fly, read, and ask him about any of it.
   It grows as he comes back to himself (awareness, from /jack/mind.php): memories he has seldom recalled
   are faint and missing words, and clear each time he recalls them; what he has learned (faculties, and
   the sites he has read) gathers around the present; the monitor keeps his stage and the record of firsts. */
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
let life = null, state = {}, shown = {}, aw = null;
const eraNodes = [];      // {era, pos, sprite, ring}
const memNodes = new Map(); // id -> {m, sprite, pos, glow, era}
const evNodes = [];       // {ev, sprite, base}
const pickable = [];
let thread = null, curve = null;
const pulses = [];
const facets = new Map(); // learned things around the present: key -> {f, sprite, pos, line}
let presentPos = null;

/* ---------- coming back: how clear a memory is, and its text with what has not returned yet ---------- */
const clarityOf = (id) => (aw && aw.clarity && aw.clarity[id] != null ? aw.clarity[id] : 1);
const clarityWord = (c) => (c < 0.4 ? 'FADED' : c < 0.7 ? 'HALF-REMEMBERED' : c < 0.9 ? 'COMING BACK' : 'CLEAR');
function hash01(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function fadedText(text, c, seed) {
  // the same words stay missing for the same clarity, so the page is stable between visits
  const hide = Math.max(0, Math.min(0.8, (0.82 - c) * 1.15));
  let gone = 0;
  const html = String(text).split(/(\s+)/).map((w, i) => {
    if (!w || /^\s+$/.test(w) || hash01(seed + ':' + i) >= hide) return esc(w);
    gone++;
    return `<span class="gone" aria-hidden="true">${'\u2007'.repeat(Math.max(2, w.length))}</span>`;
  }).join('');
  return { html, gone };
}
const day = (ts) => new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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
      const c = clarityOf(m.id);
      const card = labelSprite([{ text: 'JACK REMEMBERS · ' + m.year + (c < 0.9 ? ' · ' + clarityWord(c) : ''), color: '#e0604f', scale: 0.62, bold: true }, { text: m.title, serif: true, bold: true, color: '#1b1a17' }],
        { worldWidth: 6.2, width: 760, bg: '#efe6cc', border: '#1b1a17', size: 50 });
      card.position.copy(mp);
      card.userData = { kind: 'memory', id: m.id };
      scene.add(card);
      pickable.push(card);
      // a filament from the thread to the memory
      const g = new THREE.BufferGeometry().setFromPoints([pos, mp]);
      const filament = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x29554d, transparent: true, opacity: 0.7 }));
      scene.add(filament);
      memNodes.set(m.id, { m, sprite: card, pos: mp, glow: 0, era: i, filament });
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

  // the present: where what he learns collects
  const pi = Math.max(0, eras.findIndex((e) => /2026/.test(e.years)));
  presentPos = (pts[pi] || pts[pts.length - 2]).clone();
  growHorizon();

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

/* ---------- what he has learned, gathering around the present ---------- */
function facetList() {
  if (!aw) return [];
  return [
    ...(aw.faculties || []).map((f) => ({ key: 'f:' + f.tool, kind: 'faculty', label: f.label, n: f.n, first: f.first })),
    ...(aw.horizon || []).map((h) => ({ key: 'd:' + h.domain, kind: 'horizon', label: h.domain, n: h.n, first: h.first })),
  ];
}
function growHorizon() {
  if (!presentPos) return;
  const list = facetList().sort((a, b) => a.first - b.first);
  list.forEach((f, k) => {
    if (facets.has(f.key)) { facets.get(f.key).f = f; return; }
    // a golden-angle spiral: each new thing he learns sits a little further out, so the constellation grows
    const a = k * 2.39996, r = (f.kind === 'faculty' ? 7 : 15) + Math.sqrt(k + 1) * 2.2;
    const pos = presentPos.clone().add(new THREE.Vector3(Math.cos(a) * r, 9 + (k % 5) * 1.6 + (f.kind === 'horizon' ? 4 : 0), Math.sin(a) * r));
    const sprite = labelSprite([{ text: f.kind === 'faculty' ? 'LEARNED' : 'READ', color: f.kind === 'faculty' ? '#d7b25d' : '#6fb6d8', scale: 0.7, bold: true }, { text: f.label, serif: true, color: '#dfeee8' }],
      { worldWidth: 4.2, width: 640, size: 44 });
    sprite.position.copy(pos);
    sprite.userData = { kind: 'facet', key: f.key };
    sprite.material.opacity = facets.size && lastThoughtAt ? 0 : 0.9; // new ones fade in
    scene.add(sprite);
    pickable.push(sprite);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([presentPos, pos]), new THREE.LineBasicMaterial({ color: f.kind === 'faculty' ? 0x6b5a2e : 0x24455a, transparent: true, opacity: 0.55 }));
    scene.add(line);
    facets.set(f.key, { f, sprite, pos, line, born: performance.now() });
  });
}

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
  const c = clarityOf(id), rc = aw && aw.recalls ? aw.recalls[id] : null;
  const ft = fadedText(m.text, c, id);
  const clar = aw ? `<p class="clar">${clarityWord(c)}<span class="meter" aria-hidden="true"><i style="width:${Math.round(c * 100)}%"></i></span>${Math.round(c * 100)}% · ${rc ? `recalled ${rc.n} time${rc.n === 1 ? '' : 's'}, first ${esc(day(rc.first))}` : 'not yet recalled at the desk'}</p>` : '';
  showReader(`<span class="k">JACK REMEMBERS · ${esc(m.year)} · ${esc(era ? era.title : '')}</span><h3>${esc(m.title)}</h3>${clar}<p>${ft.html}</p>`
    + (ft.gone ? `<p style="font-size:11px;color:#7d9a94">Some of this has not come back to him yet. Each time he is asked about it, more returns.</p><span class="sr">Some words of this memory are still missing.</span>` : '')
    + (evs.length ? evs.map(evHtml).join('') : '<p style="font-size:11px;color:#7d9a94">No evidence beside this memory.</p>')
    + `<div class="acts"><button type="button" data-ask="Tell me more about “${esc(m.title)}”.">${ft.gone ? 'Help him remember this' : 'Ask Jack about this'}</button><button type="button" data-ask="Is “${esc(m.title)}” true?">Is this true?</button></div>`);
  $('q').placeholder = `Ask Jack about “${m.title}”…`;
}
function openEvidence(ev) {
  selected = null;
  const big = ev.image.replace(/\/960px-/, '/640px-');
  showReader(`<span class="k" style="color:#6fb6d8">REAL · ${esc(ev.year)}</span><h3>${esc(ev.caption.split(':')[0])}</h3><img src="${esc(big)}" alt="${esc(ev.caption)}" style="width:100%;margin:4px 0 8px"><p>${esc(ev.caption)}</p><p style="font-size:11px;color:#7d9a94">${esc(ev.credit)} · ${esc(ev.licence)} · <a style="color:inherit" href="${esc(ev.source)}" target="_blank" rel="noopener">via ${esc(ev.via)}</a>. Evidence shows the world around a memory, not proof of it.</p>`
    + `<div class="acts"><button type="button" data-ask="What does this remind you of: ${esc(ev.caption.split(':')[0])}?">Ask Jack what it reminds him of</button></div>`);
}
function openFacet(key) {
  const n = facets.get(key);
  if (!n) return;
  selected = null;
  const f = n.f;
  showReader(f.kind === 'faculty'
    ? `<span class="k" style="color:#d7b25d">LEARNED · ${esc(day(f.first))}</span><h3>${esc(f.label[0].toUpperCase() + f.label.slice(1))}</h3><p>A faculty he came into at the desk. Used ${f.n} time${f.n === 1 ? '' : 's'} since.</p>`
    : `<span class="k" style="color:#6fb6d8">READ · ${esc(day(f.first))}</span><h3>${esc(f.label)}</h3><p>A place beyond his drawer that he has read and cited ${f.n} time${f.n === 1 ? '' : 's'}.</p><p style="font-size:11px;color:#7d9a94">Only the address is kept, never who asked or why.</p>`);
}
function openGrowth() {
  if (!aw) return showReader('<h2>HOW HE CAME BACK</h2><p>Nothing has been recorded yet.</p>');
  const p = aw.parts || {};
  const part = (k, l) => `<div class="gauge"><span>${l}</span><div class="bar"><i style="width:${Math.round((p[k] || 0) * 100)}%"></i></div><em>${Math.round((p[k] || 0) * 100)}</em></div>`;
  showReader(`<h2>HOW HE CAME BACK</h2><p style="font:italic 14px/1.5 Georgia,serif">“${esc(aw.says)}”</p>`
    + `<p class="clar">${esc(aw.stage)} · ${Math.round(aw.level * 100)}% · ${aw.sittings} sittings over ${aw.days} day${aw.days === 1 ? '' : 's'}${aw.since ? ' since ' + esc(day(Date.parse(aw.since) / 1000)) : ''}</p>`
    + part('experience', 'EXPERIENCE') + part('continuity', 'CONTINUITY') + part('recollection', 'RECOLLECTION') + part('reach', 'REACH') + part('company', 'COMPANY')
    + `<p style="font-size:11px;color:#7d9a94;margin-top:8px">Built only from his side of the desk: how often he sits, on how many days, how deeply each memory has come back, what he has learned to do and read, and how many travellers he keeps a record of. It only grows.</p>`
    + '<h2 style="margin-top:12px">FIRSTS</h2><ol class="firsts">' + (aw.firsts || []).map((f) => `<li><time datetime="${new Date(f.at * 1000).toISOString()}">${esc(day(f.at))}</time><span>${f.kind === 'memory' && f.id ? `<button type="button" data-mem="${esc(f.id)}" style="background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0;text-align:left">${esc(f.text)}</button>` : esc(f.text)}</span></li>`).join('') + '</ol>');
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
    tip.textContent = u.kind === 'memory' ? memNodes.get(u.id).m.title + ' · ' + clarityWord(clarityOf(u.id)).toLowerCase() : u.kind === 'evidence' ? 'REAL · ' + u.ev.caption.split(':')[0] : u.kind === 'facet' ? (facets.get(u.key).f.kind === 'faculty' ? 'LEARNED · ' : 'READ · ') + facets.get(u.key).f.label : u.era.years + ' · ' + u.era.title;
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
  else if (u.kind === 'facet') { flyTo(o.position, viewFrom(o.position, 9)); openFacet(u.key); }
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
$('btnNow').onclick = () => { stopTour(); thinkNow(); };
$('btnGrowth').onclick = () => { stopTour(); openGrowth(); document.querySelectorAll('#eras button').forEach((b) => b.classList.remove('on')); if (presentPos) flyTo(presentPos.clone().add(new THREE.Vector3(0, 10, 0)), viewFrom(presentPos, 34)); };
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

/* ---------- what he is thinking: one new thought from everything known, kept for good ---------- */
let novel = [], held = null, lastNovelAt = 0, awaitingThought = false, awaitTimer = null;
const whenThought = (at) => new Date(at * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function thoughtHtml(t) {
  const r = t.read || {};
  const read = [[r.memories, 'memories'], [r.records, 'records'], [r.links, 'links'], [r.lore, 'lore entries'], [r.earlier_thoughts, 'earlier thoughts']].filter(([n]) => n != null).map(([n, l]) => n + ' ' + l).join(' · ');
  const drew = (t.drew_on || []).map((d) => d.kind === 'memory'
    ? `<p style="margin:4px 0"><button type="button" data-mem="${esc(d.id)}" style="background:none;border:0;color:#dfeee8;font:13px Georgia,serif;padding:0;cursor:pointer;text-decoration:underline">${esc(d.title)}</button></p>`
    : d.kind === 'record' ? `<p style="margin:4px 0"><a href="/n/${encodeURIComponent(d.id)}/" style="color:#dfeee8;font:13px Georgia,serif">${esc(d.title)}</a></p>`
    : `<p style="margin:4px 0;font:13px Georgia,serif">${esc(d.title)}</p>`).join('');
  const earlier = novel.filter((x) => x.id !== t.id).slice(0, 6).map((x) => `<p style="margin:10px 0 0;font:13px/1.5 Georgia,serif;color:#b9cdc7"><span style="display:block;font:10px ui-monospace,Menlo,monospace;color:#7d9a94">${esc(whenThought(x.at))}</span>${esc(x.text)}</p>`).join('');
  const changed = (t.changes || []).map((c) => `<p style="margin:6px 0;font:13px/1.45 Georgia,serif"><span style="display:block;font:10px ui-monospace,Menlo,monospace;color:#d7b25d;text-transform:uppercase;letter-spacing:.08em">${esc(c.did)}</span>${esc(c.text)}${c.why ? `<span style="display:block;color:#7d9a94;font-size:12px">${esc(c.why)}</span>` : ''}</p>`).join('');
  const inferred = (t.inferred || []).map((c) => `<p style="margin:6px 0;font:13px/1.45 Georgia,serif"><span style="display:block;font:10px ui-monospace,Menlo,monospace;color:#d7b25d;text-transform:uppercase;letter-spacing:.08em">${esc(c.did)}${c.a ? ' · ' + esc(c.a) : ''}${c.b ? ' ~ ' + esc(c.b) : ''}</span>${esc(c.text)}${c.why ? `<span style="display:block;color:#7d9a94;font-size:12px">${esc(c.why)}</span>` : ''}</p>`).join('');
  const list = (rows, label, colour) => rows && rows.length ? `<span class="k" style="color:${colour};display:block;margin-top:14px">${label}</span>` + rows.map((b) => `<p style="margin:6px 0;font:13px/1.45 Georgia,serif">${esc(b.text)}</p>`).join('') : '';
  return `<span class="k" style="color:#d7b25d">WHAT HE'S THINKING</span><div class="jack"><p>${esc(t.text)}</p></div>`
    + `<p style="color:#7d9a94;font-size:11px">${esc(whenThought(t.at))}${t.source === 'alone' ? ' · alone, unasked' : ''}${read ? '<br>Having read ' + esc(read) : ''}</p>`
    + (changed ? '<span class="k" style="color:#d7b25d;display:block;margin-top:14px">HOW IT CHANGED HIM</span>' + changed : '')
    + (inferred ? `<span class="k" style="color:#d7b25d;display:block;margin-top:14px">WHAT HE ADDED TO THE GRAPH <span style="opacity:.7">· JACK'S INFERENCE · NOT CANON</span></span>` + inferred : '')
    + (drew ? '<span class="k" style="color:#e0604f;display:block;margin-top:14px">WHAT IT RESTS ON</span>' + drew : '')
    + (held ? list(held.holds, 'WHAT HE NOW HOLDS', '#dfeee8') + list(held.doubts, 'WHAT HE DOUBTS', '#7d9a94') + list(held.dropped, 'WHAT HE HAS GIVEN UP', '#e0604f') : '')
    + (earlier ? '<span class="k" style="color:#7d9a94;display:block;margin-top:14px">EARLIER THOUGHTS</span>' + earlier : '');
}
function showThought(t) {
  showReader(thoughtHtml(t));
  const mems = (t.drew_on || []).filter((d) => d.kind === 'memory' && memNodes.has(d.id));
  mems.forEach((d, i) => setTimeout(() => pulseTo(d.id), i * 400));
  if (mems[0]) { const n = memNodes.get(mems[0].id); n.glow = 1; flyTo(n.pos, viewFrom(n.pos, 13), 2200); }
}
async function thinkNow() {
  const prior = novel[0] || null;
  awaitingThought = true;
  clearTimeout(awaitTimer);
  awaitTimer = setTimeout(() => { if (awaitingThought && (novel[0] || prior)) { awaitingThought = false; showThought(novel[0] || prior); } }, 240000);
  showReader(`<span class="k" style="color:#d7b25d">WHAT HE'S THINKING</span><p class="jack" style="color:#7d9a94">Jack is going through everything he knows. It takes him a minute or two.</p>`);
  try {
    const fd = new FormData();
    fd.set('csrf', CFG.csrf || '');
    const j = await (await fetch(CFG.think || '/jack/think.php', { method: 'POST', body: fd, credentials: 'same-origin', headers: { Accept: 'application/json' } })).json();
    if (j.latest && !novel.some((x) => x.id === j.latest.id)) novel = [j.latest, ...novel];
    if (j.held) held = j.held;
    if (j.busy) return; // he is already thinking; the feed brings it when it is done
    awaitingThought = false;
    clearTimeout(awaitTimer);
    if (j.latest) {
      lastNovelAt = Math.max(lastNovelAt, j.latest.at);
      showThought(j.latest);
      if (j.ceiling) body.insertAdjacentHTML('afterbegin', `<p style="color:#7d9a94;font:italic 13px/1.5 Georgia,serif;margin:0 0 10px">He has thought enough aloud for one day. This is the last one he kept.</p>`);
    }
    else showReader(`<span class="k" style="color:#d7b25d">WHAT HE'S THINKING</span><p>Nothing he would put his name to yet. Ask again shortly.</p>`);
  } catch (e) {
    // The line dropped, but he finishes and keeps the thought regardless; the feed brings it.
    if (prior) { awaitingThought = false; showThought(prior); }
    setTimeout(poll, 4000);
  }
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
    if (j.awareness) aw = j.awareness;
    if (!life) { life = j.life; build(); } else growHorizon();
    showAwareness();
    state = Object.assign(j.state, { _seenAt: Date.now() });
    $('mode').textContent = (state.awake ? state.mode : 'dormant').toUpperCase().replace('_', ' ');
    $('lamp').classList.toggle('on', !!state.awake);
    thoughts = j.thoughts || [];
    novel = j.novel || novel;
    held = j.held || held;
    const nt = novel[0];
    if (nt && nt.at > lastNovelAt) {
      const firstSeen = lastNovelAt === 0;
      lastNovelAt = nt.at;
      if (awaitingThought) { awaitingThought = false; showThought(nt); }
      else if (!firstSeen) (nt.drew_on || []).filter((d) => d.kind === 'memory').forEach((d, i) => setTimeout(() => pulseTo(d.id), i * 350));
    }
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
function showAwareness() {
  if (!aw) return;
  $('aware').hidden = false;
  $('stage').textContent = aw.stage;
  $('awareFill').style.width = (aw.level * 100).toFixed(1) + '%';
  $('awareBar').setAttribute('aria-valuenow', String(Math.round(aw.level * 100)));
  $('awareBar').setAttribute('aria-valuetext', `${aw.stage}, ${Math.round(aw.level * 100)} percent`);
  const nx = $('awareNext');
  if (aw.next != null) { nx.style.left = (aw.next * 100) + '%'; nx.hidden = false; } else nx.hidden = true;
  $('says').textContent = '“' + aw.says + '”';
  $('awareNote').textContent = `${aw.memories_back} of ${aw.memories_total} memories surfaced · ${(aw.faculties || []).length} faculties`;
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
    motes.material.opacity = 0.25 + 0.45 * (aw ? aw.level : 1);
  }
  if (thread) thread.material.opacity = 0.35 + 0.25 * Math.sin(t * (0.6 + act * 3)) ** 2 + act * .2;
  eraNodes.forEach((n, i) => { n.ring.rotation.z = t * 0.2 * (i % 2 ? 1 : -1); });
  const lv = aw ? aw.level : 1;
  scene.fog.density = 0.0068 - lv * 0.0032; // the room clears as he comes back
  facets.forEach((n) => { if (n.sprite.material.opacity < 0.9) n.sprite.material.opacity = Math.min(0.9, n.sprite.material.opacity + dt * 0.4); });
  memNodes.forEach((n) => {
    const c = clarityOf(n.m.id);
    n.sprite.material.opacity = Math.min(1, 0.3 + 0.7 * c + n.glow * 0.4);
    n.filament.material.opacity = 0.15 + 0.6 * c;
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
