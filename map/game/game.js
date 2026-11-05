/* The Desk on /map/play/: travellers lodge real things at places; other travellers witness, differ, correct or carry them.
   Jack only files: classes come from how the traveller knows, standing comes from the hands. */
(() => {
  'use strict';
  const C = window.TTG_MAP || {};
  const map = window.ttgMap;
  if (!map || !C.game) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let S = null, view = { name: 'home' }, busy = false;

  const api = async (op, body) => {
    const r = await fetch(C.game, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': C.csrf || '' },
      body: JSON.stringify(Object.assign({ op }, body || {})) });
    const j = await r.json().catch(() => ({ ok: false, error: 'The desk did not answer.' }));
    if (!j.ok) throw new Error(j.error || 'The desk jammed.');
    return j;
  };

  /* ---------- panel and the cross that marks "here" ---------- */
  const desk = document.createElement('section');
  desk.id = 'desk'; desk.setAttribute('aria-label', 'The Desk');
  desk.innerHTML = '<header><b>THE DESK</b><span id="desk-sub">Department of Excess Time</span><button type="button" id="desk-fold" aria-expanded="true" aria-controls="desk-b">Fold</button></header><div id="desk-b" aria-live="polite"></div>';
  $('side').insertBefore(desk, $('side').firstChild);
  const cross = document.createElement('div'); cross.id = 'desk-cross'; cross.setAttribute('aria-hidden', 'true'); document.body.appendChild(cross);
  $('desk-fold').onclick = () => { const f = desk.classList.toggle('folded'); $('desk-fold').setAttribute('aria-expanded', String(!f)); $('desk-fold').textContent = f ? 'Open' : 'Fold'; };

  const STAND = { LODGED: 'Lodged', WITNESSED: 'Witnessed', DISPUTED: 'Disputed', ACCEPTED: 'Accepted to the record' };
  const when = (t) => new Date(t * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const first = (t, n) => { const s = String(t).split('\n')[0]; return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const btn = (act, label, cls) => '<button type="button" data-act="' + act + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(label) + '</button>';
  const link = (u, label) => u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener nofollow">' + esc(label || u) + ' ↗</a>' : '';

  // The map's own year control: a number only when the traveller has travelled.
  const mapYear = () => { const t = ($('yr-v') && $('yr-v').textContent) || ''; return /^\d{3,4}$/.test(t) ? +t : null; };
  // Whatever real record the traveller has open in the map's info card.
  function openRecord() {
    const c = $('card'), b = $('card-b');
    if (!c || c.style.display === 'none' || !b) return null;
    const h = b.querySelector('h3'); if (!h) return null;
    const a = [...b.querySelectorAll('a[href^="http"]')][0];
    return { title: h.textContent.trim().slice(0, 160), url: a ? a.href : '' };
  }
  // The place under the cross (on a phone the cross sits low, in the map left below the Desk).
  const centre = () => {
    const r = cross.getBoundingClientRect(), m = map.getContainer().getBoundingClientRect();
    const c = r.width ? map.unproject([r.left + r.width / 2 - m.left, r.top + r.height / 2 - m.top]) : map.getCenter();
    return { lng: +c.lng.toFixed(5), lat: +c.lat.toFixed(5) };
  };

  /* ---------- views ---------- */
  function itemRow(it) {
    return '<li><button type="button" data-act="open:' + it.id + '" class="row-b"><b>' + esc(it.kind_label) + '</b> <span class="st st-' + it.standing.toLowerCase() + '">' + esc(STAND[it.standing]) + '</span>'
      + '<span class="ln">' + esc(first(it.body, 90)) + '</span><small>' + esc(it.mine ? 'You' : it.who) + (it.audience === 'me' ? ' · only you' : '') + ' · ' + (it.hands ? it.hands + ' added' : 'nobody has added to it yet') + (it.route.length ? ' · carried' : '') + '</small></button></li>';
  }
  function home() {
    const c = map.getCenter();
    const here = S.here.slice().sort((a, b) => Math.hypot(a.lng - c.lng, a.lat - c.lat) - Math.hypot(b.lng - c.lng, b.lat - c.lat));
    const others = here.filter((x) => !x.mine);
    let h = '<p class="jk">What has entered the field?</p>'
      + '<p class="small">Lodge something real you carry about a place: a recollection, an object, a photograph, a name, a question. Other travellers can witness it, remember it differently, correct it with a source, or carry it to another place where it connects. Every hand is kept.</p>'
      + '<div class="acts">' + btn('lodge', 'Lodge something here', 'go') + '</div>';
    h += '<p class="k">IN THIS VIEW</p>' + (others.length ? '<ul class="items">' + others.slice(0, 12).map(itemRow).join('') + '</ul>'
      : '<p class="small">Nothing from other travellers in this view.' + (S.shared_total ? ' Other travellers have shared ' + S.shared_total + ' item' + (S.shared_total === 1 ? '' : 's') + ' elsewhere on the map.' : ' No other traveller has shared anything yet.') + '</p>');
    if (S.mine.length) h += '<p class="k">YOURS</p><ul class="items">' + S.mine.slice(0, 12).map(itemRow).join('') + '</ul>';
    return h;
  }
  function lodgeForm() {
    const rec = openRecord(), y = mapYear();
    return '<p class="k">LODGE · AT THE CROSS ON THE MAP</p><p class="small">Move the map until the cross sits on the place.</p>'
      + '<form id="desk-f">'
      + '<label>What is it<select name="kind">' + Object.entries(S.kinds).map(([k, l]) => '<option value="' + k + '">' + esc(l) + '</option>').join('') + '</select></label>'
      + '<label>How do you know<select name="how">' + Object.entries(S.how).map(([k, l]) => '<option value="' + k + '">' + esc(l) + '</option>').join('') + '</select></label>'
      + '<label>Tell it<textarea name="body" rows="4" maxlength="2000" required placeholder="What it is, and what happened here. Don\'t name living people without their permission."></textarea></label>'
      + '<label>Source or photo link <small>(needed if documented)</small><input name="source_url" type="url" placeholder="https://"></label>'
      + (rec ? '<label class="chk"><input type="checkbox" name="near" checked> Attach the record you have open: ' + esc(rec.title) + '</label>' : '<p class="small">Tip: open a record on the map first and it can be attached.</p>')
      + (y ? '<label class="chk"><input type="checkbox" name="year" value="' + y + '" checked> It belongs to ' + y + ' (the map\'s year)</label>' : '')
      + '<fieldset><legend>Who can see it</legend><label class="chk"><input type="radio" name="aud" value="me" checked> Only me</label>'
      + '<label class="chk"><input type="radio" name="aud" value="travellers"> Travellers signed in to the Guild, with my name</label></fieldset>'
      + '<div class="acts"><button type="submit" class="go">Lodge it</button>' + btn('home', 'Cancel') + '</div></form>';
  }
  function itemView(it) {
    let h = '<p class="k">' + esc(it.kind_label.toUpperCase()) + (it.class !== it.kind_label.toUpperCase() ? ' · ' + esc(it.class) : '') + ' · ' + esc((STAND[it.standing] || '').toUpperCase()) + '</p>'
      + '<p class="body">' + esc(it.body) + '</p>'
      + '<dl><dt>Lodged by</dt><dd>' + esc(it.mine ? 'You' : it.who) + ', ' + when(it.at) + (it.audience === 'me' ? ' · only you can see it' : '') + '</dd>'
      + '<dt>How</dt><dd>' + esc(it.how_label) + '</dd>'
      + (it.year ? '<dt>Year</dt><dd>' + it.year + '</dd>' : '')
      + (it.source_url ? '<dt>Source</dt><dd>' + link(it.source_url, 'link') + '</dd>' : '')
      + (it.near_title ? '<dt>Near</dt><dd>' + (it.near_url ? link(it.near_url, it.near_title) : esc(it.near_title)) + '</dd>' : '')
      + (it.accepted_by ? '<dt>Accepted</dt><dd>by ' + esc(it.accepted_by) + '</dd>' : '') + '</dl>'
      + '<p class="jk">' + esc(it.slip) + '</p>';
    if (it.hand_list.length) h += '<p class="k">HANDS</p><ol class="hands">' + it.hand_list.map((x) => '<li><b>' + esc(x.mine ? 'You' : x.who) + '</b> ' + esc(x.mine ? x.did.replace(/^remembers/, 'remember') : x.did)
      + (x.place ? ' to ' + esc(x.place) : '') + ' <small>' + when(x.at) + '</small>' + (x.body ? '<br>' + esc(x.body) : '') + (x.source_url ? '<br>' + link(x.source_url, 'source') : '')
      + (x.lng !== null ? ' ' + btn('fly:' + x.lng + ',' + x.lat, 'Show', 'link') : '') + (x.mine ? ' ' + btn('unhand:' + x.id, 'Remove my hand', 'link') : '') + '</li>').join('') + '</ol>';
    const acts = [];
    if (!it.mine) acts.push(btn('witness', 'Witness it'), btn('form:differ', 'I remember it differently'));
    acts.push(btn('form:correct', 'Correct it with a source'), btn('form:carry', 'Carry it to another place'));
    if (it.mine) acts.push(btn('withdraw', 'Withdraw it'));
    if (S.me.keeper && it.audience === 'travellers' && !it.accepted_by) acts.push(btn('accept', 'Accept to the record'));
    h += '<div class="acts small-acts">' + acts.join('') + '</div>';
    if (view.form) {
      const f = view.form;
      h += '<form id="hand-f" class="hand-f"><p class="k">' + ({ differ: 'HOW YOU REMEMBER IT', correct: 'WHAT IS WRONG, AND THE SOURCE', carry: 'CARRY IT TO THE CROSS' }[f]) + '</p>'
        + (f === 'carry' ? '<p class="small">Move the map until the cross sits where it also belongs.</p><label>Place name<input name="place" maxlength="120"></label>' : '')
        + '<label>' + (f === 'carry' ? 'Why it belongs there too' : f === 'correct' ? 'The correction' : 'Your account') + '<textarea name="body" rows="3" maxlength="1200" required></textarea></label>'
        + (f !== 'differ' ? '<label>Link' + (f === 'correct' ? ' (required)' : '') + '<input name="source_url" type="url" placeholder="https://"></label>' : '')
        + '<div class="acts"><button type="submit" class="go">' + ({ differ: 'Add my account', correct: 'Add the correction', carry: 'Carry it here' }[f]) + '</button>' + btn('form:', 'Cancel') + '</div></form>';
    }
    h += '<p class="small">' + (it.audience === 'travellers' ? 'Anything you add here is shown with your name to every traveller who can see this item.' : 'Only you can see this item and anything added to it.') + '</p>'
      + '<div class="acts">' + btn('home', '← Back to the desk') + btn('fly:' + it.lng + ',' + it.lat, 'Show on the map') + '</div>';
    return h;
  }

  function render() {
    const b = $('desk-b'), err = view.err ? '<p class="err">' + esc(view.err) + '</p>' : '';
    if (!S) return;
    b.innerHTML = err + (view.name === 'lodge' ? lodgeForm() : view.name === 'item' && view.item ? itemView(view.item) : home());
    document.body.classList.toggle('desk-placing', view.name === 'lodge' || view.form === 'carry');
    // On a phone, placing or reading needs the map: fold the Layers sheet if it is open.
    if (view.name !== 'home' && innerWidth <= 640 && $('panel') && !$('panel').classList.contains('closed') && $('toggle')) $('toggle').click();
    drawMarks();
  }

  /* ---------- map: items, and where they have been carried ---------- */
  function drawMarks() {
    if (!S) return;
    if (!map.isStyleLoaded()) { map.once('idle', drawMarks); return; }
    const all = new Map(); S.here.concat(S.mine).forEach((x) => all.set(x.id, x));
    const pts = [], lines = [];
    all.forEach((x) => {
      pts.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lng, x.lat] }, properties: { id: x.id, st: x.standing, mine: x.mine ? 1 : 0, sel: view.item && view.item.id === x.id ? 1 : 0 } });
      x.route.forEach((p) => {
        lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[x.lng, x.lat], p] }, properties: { id: x.id } });
        pts.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { id: x.id, st: 'CARRIED', mine: 0, sel: 0 } });
      });
    });
    const P = { type: 'FeatureCollection', features: pts }, L = { type: 'FeatureCollection', features: lines };
    if (map.getSource('desk-pts')) { map.getSource('desk-pts').setData(P); map.getSource('desk-lines').setData(L); return; }
    map.addSource('desk-lines', { type: 'geojson', data: L });
    map.addSource('desk-pts', { type: 'geojson', data: P });
    // Desk items are ringed targets (ink ring, coloured core) so they read apart from the map's own record dots.
    map.addLayer({ id: 'desk-line', type: 'line', source: 'desk-lines', paint: { 'line-color': '#1b1a17', 'line-width': 3, 'line-dasharray': [1.5, 1.5] } });
    map.addLayer({ id: 'desk-pt', type: 'circle', source: 'desk-pts', paint: {
      'circle-radius': ['case', ['==', ['get', 'sel'], 1], 13, 10], 'circle-stroke-width': 3, 'circle-stroke-color': '#1b1a17', 'circle-color': '#f6efd8' } });
    map.addLayer({ id: 'desk-core', type: 'circle', source: 'desk-pts', paint: { 'circle-radius': 4,
      'circle-color': ['match', ['get', 'st'], 'ACCEPTED', '#1b1a17', 'DISPUTED', '#e0a03e', 'WITNESSED', '#b3261e', 'CARRIED', '#7b7468', '#b3261e'] } });
    map.on('click', 'desk-pt', (e) => { const f = e.features && e.features[0]; if (f) openItem(f.properties.id); });
    map.on('mouseenter', 'desk-pt', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'desk-pt', () => { map.getCanvas().style.cursor = ''; });
  }

  const fly = (lng, lat) => map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), duration: calm.matches ? 0 : 1400, essential: false });

  async function load() {
    const b = map.getBounds();
    S = await api('state', { bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
    if (view.name !== 'lodge' && !view.form) render(); else drawMarks();
  }
  async function openItem(id) {
    try { view = { name: 'item', item: (await api('item', { id })).item }; } catch (e) { view = { name: 'home', err: e.message }; }
    render();
    if (desk.classList.contains('folded')) $('desk-fold').click();
  }
  let moveT = 0;
  map.on('moveend', () => { clearTimeout(moveT); moveT = setTimeout(() => load().catch(() => {}), 500); });

  /* ---------- actions ---------- */
  $('desk-b').addEventListener('click', async (e) => {
    const el = e.target.closest('button[data-act]'); if (!el || busy) return;
    const [act, arg] = el.dataset.act.split(/:(.*)/s);
    const it = view.item;
    const run = async (fn) => { busy = true; el.disabled = true; try { await fn(); } catch (err) { view.err = err.message; render(); } finally { busy = false; } };
    view.err = null;
    if (act === 'home') { view = { name: 'home' }; return render(); }
    if (act === 'lodge') { view = { name: 'lodge' }; return render(); }
    if (act === 'open') return openItem(+arg);
    if (act === 'fly') { const [x, y] = arg.split(',').map(Number); return fly(x, y); }
    if (act === 'form') { view.form = arg || null; return render(); }
    if (act === 'witness') return run(async () => { await api('hand', { item_id: it.id, act: 'witness' }); await openItem(it.id); load(); });
    if (act === 'unhand') return run(async () => { await api('unhand', { id: +arg }); await openItem(it.id); load(); });
    if (act === 'withdraw') {
      if (!confirm('Withdraw this item? It and every hand on it leave the map for everyone.')) return;
      return run(async () => { await api('withdraw', { id: it.id }); view = { name: 'home' }; await load(); });
    }
    if (act === 'accept') return run(async () => { await api('accept', { id: it.id }); await openItem(it.id); load(); });
  });
  $('desk-b').addEventListener('submit', async (e) => {
    e.preventDefault(); if (busy) return;
    const f = e.target, d = Object.fromEntries(new FormData(f).entries()), sub = f.querySelector('button[type=submit]');
    busy = true; sub.disabled = true; view.err = null;
    try {
      if (f.id === 'desk-f') {
        const rec = d.near ? openRecord() : null, c = centre();
        const r = await api('lodge', { kind: d.kind, how: d.how, body: d.body, source_url: d.source_url, near_title: rec ? rec.title : '', near_url: rec ? rec.url : '',
          lng: c.lng, lat: c.lat, year: d.year ? +d.year : null, audience: d.aud });
        await load(); await openItem(r.id);
      } else if (f.id === 'hand-f') {
        const c = centre(), it = view.item;
        await api('hand', { item_id: it.id, act: view.form, body: d.body, source_url: d.source_url || '', place: d.place || '', lng: c.lng, lat: c.lat });
        view.form = null; await openItem(it.id); load();
      }
    } catch (err) { view.err = err.message; render(); } finally { busy = false; sub.disabled = false; }
  });

  $('desk-b').innerHTML = '<p class="small">Opening the desk…</p>';
  const start = () => load().catch((e) => { $('desk-b').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
  if (map.loaded()) start(); else map.once('load', start);
  setTimeout(() => { if (!S) start(); }, 2500);
})();
