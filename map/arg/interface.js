/* GUILD://INTERFACE: the cyberpunk skin and the shared case net (the ARG) over the Passport Map.
   Loaded only on /map/interface/. Talks to /map/arg/api.php; Jack (the model) is the games master there. */
(function () {
  'use strict';
  const C = window.TTG_MAP || {};
  const map = window.ttgMap;
  if (!C.interface || !map) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yearLabel = (y) => (y == null ? '' : y < 0 ? Math.abs(y) + ' BC' : String(y));
  document.body.classList.add('cyber');

  /* ---------- skin: scanlines and the timeline flash ---------- */
  const scan = document.createElement('div'); scan.className = 'cy-scan'; document.body.appendChild(scan);
  const flash = document.createElement('div'); flash.className = 'cy-flash'; document.body.appendChild(flash);

  /* ---------- the case net panel, docked at the top of the right-hand column ---------- */
  const side = $('side');
  const net = document.createElement('section');
  net.id = 'arg'; net.setAttribute('aria-label', 'Guild case net');
  net.innerHTML = '<header><b>GUILD://CASE NET</b><span class="stab" title="Average timeline stability across open cases">STABILITY <i><span id="arg-stab"></span></i></span></header>'
    + '<nav><button type="button" data-tab="cases" aria-pressed="true">CASES</button><button type="button" data-tab="dossier" aria-pressed="false">DOSSIER</button><button type="button" data-tab="log" aria-pressed="false">LOG</button></nav>'
    + '<div class="body" id="arg-body"></div>';
  side.insertBefore(net, side.firstChild);
  const body = $('arg-body');

  const S = { tab: 'cases', open: [], closed: [], log: [], since: 0, active: null, dossier: null, me: null, stability: 100, msg: '' };

  async function api(op, data) {
    const r = await fetch(C.arg, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': C.csrf || '' }, body: JSON.stringify(Object.assign({ op }, data || {})) });
    const j = await r.json().catch(() => ({ ok: false, error: 'The registry jammed.' }));
    if (j.signin) location.href = '/people/auth/?next=' + encodeURIComponent('/map/interface/');
    if (j.reload) location.reload();
    return j;
  }

  /* ---------- map layers: cases glow magenta, clues cyan ---------- */
  function initLayers() {
    if (map.getSource('arg-cases')) return;
    map.addSource('arg-cases', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('arg-clues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'arg-case-halo', type: 'circle', source: 'arg-cases', paint: { 'circle-radius': 22, 'circle-color': '#ff2bd6', 'circle-opacity': 0.18, 'circle-blur': 0.8 } });
    map.addLayer({ id: 'arg-cases', type: 'circle', source: 'arg-cases', paint: { 'circle-radius': 7, 'circle-color': '#ff2bd6', 'circle-stroke-color': '#19e3ff', 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'arg-case-label', type: 'symbol', source: 'arg-cases',
      layout: { 'text-field': ['get', 'title'], 'text-font': ['Open Sans Semibold'], 'text-size': 11, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true },
      paint: { 'text-color': '#ff9cf0', 'text-halo-color': '#070a10', 'text-halo-width': 1.6 } });
    map.addLayer({ id: 'arg-clues', type: 'circle', source: 'arg-clues', paint: { 'circle-radius': 5, 'circle-color': '#19e3ff', 'circle-stroke-color': '#070a10', 'circle-stroke-width': 1.5 } });
    map.on('click', 'arg-cases', (e) => { const f = e.features && e.features[0]; if (f) openDossier(f.properties.id); });
    map.on('click', 'arg-clues', (e) => { const f = e.features && e.features[0]; if (f) note('CLUE · ' + f.properties.text); });
    ['arg-cases', 'arg-clues'].forEach((l) => { map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; }); map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; }); });
    // pulse the halos
    let t = 0; setInterval(() => { t += 0.25; if (map.getLayer('arg-case-halo')) map.setPaintProperty('arg-case-halo', 'circle-radius', 18 + Math.sin(t) * 6); }, 120);
  }
  function drawCases() {
    if (!map.getSource('arg-cases')) return;
    map.getSource('arg-cases').setData({ type: 'FeatureCollection', features: S.open.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { id: c.id, title: c.title } })) });
  }
  function drawClues(clues) {
    if (!map.getSource('arg-clues')) return;
    map.getSource('arg-clues').setData({ type: 'FeatureCollection', features: (clues || []).filter((k) => k.lng != null && k.lat != null).map((k) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [k.lng, k.lat] }, properties: { text: k.text } })) });
  }

  /* ---------- rendering ---------- */
  function note(t, err) { S.msg = (err ? '! ' : '') + t; render(); }
  function render() {
    $('arg-stab').style.width = Math.max(2, Math.min(100, S.stability)) + '%';
    [...net.querySelectorAll('nav button')].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === S.tab)));
    const msg = S.msg ? '<p class="' + (S.msg.startsWith('! ') ? 'err' : 'meta') + '">' + esc(S.msg.replace(/^! /, '')) + '</p>' : '';
    if (S.tab === 'cases') {
      const c = map.getCenter();
      const dist = (x) => Math.round(Math.hypot((x.lng - c.lng) * 111 * Math.cos(c.lat * Math.PI / 180), (x.lat - c.lat) * 111));
      body.innerHTML = msg + '<button type="button" class="wake" id="arg-wake">WAKE A CASE WHERE I STAND</button>'
        + (S.open.length ? S.open.map((x) => '<button type="button" class="case" data-case="' + x.id + '"><b>' + esc(x.title) + '</b><small>' + esc(x.place) + (x.year != null ? ' · ' + esc(yearLabel(x.year)) : '') + ' · ' + dist(x).toLocaleString() + ' km away</small><div class="bar"><span style="width:' + x.stability + '%"></span></div></button>').join('')
          : '<p class="meta">No open cases. The registry is quiet; wake one.</p>')
        + (S.closed.length ? '<p class="meta" style="margin-top:8px">RECENTLY CLOSED</p>' + S.closed.map((x) => '<button type="button" class="case" data-case="' + x.id + '"><b>' + esc(x.title) + '</b><small>closed · ' + esc(x.place) + '</small></button>').join('') : '');
    } else if (S.tab === 'log') {
      body.innerHTML = msg + '<div class="log">' + (S.log.length ? S.log.slice().reverse().map((l) => '<p><b>' + esc(new Date(l.at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + '</b> ' + esc(l.text) + '</p>').join('') : '<p class="meta">Nothing yet.</p>') + '</div>';
    } else {
      const d = S.dossier;
      if (!d) { body.innerHTML = msg + '<p class="meta">Pick a case from CASES, or click a magenta marker on the map.</p>'; return; }
      const c = d.case;
      body.innerHTML = msg + '<h4>' + esc(c.title) + '</h4><p class="meta">' + esc(c.place) + (c.year != null ? ' · ' + esc(yearLabel(c.year)) : '') + ' · ' + esc(c.status.toUpperCase()) + ' · stability ' + c.stability + '%</p>'
        + '<p class="brief">' + esc(c.brief) + '</p>' + (c.report ? '<p class="ruling">' + esc(c.report) + '</p>' : '')
        + (d.clues.length ? '<p class="meta">LEADS</p>' + d.clues.map((k, i) => '<div class="clue" data-clue="' + i + '">' + esc(k.text) + (k.year != null ? ' <span class="meta">(' + esc(yearLabel(k.year)) + ')</span>' : '') + '</div>').join('') : '')
        + (c.status === 'open' ? '<form id="arg-file"><div class="row2"><select id="arg-step" aria-label="Protocol step"><option>NOTICE</option><option>RECORD</option><option>COMPARE</option><option>TEST</option><option>RETURN</option></select>'
          + '<button type="submit" id="arg-send">FILE</button></div><textarea id="arg-text" maxlength="1200" placeholder="What did you find? Use the map: events, places, old maps, photos."></textarea>'
          + '<span class="attach" id="arg-attach"></span></form>' : '')
        + '<p class="meta" style="margin-top:8px">FILINGS</p>' + (d.filings.length ? d.filings.map((f) => '<div class="filing' + (f.canon ? ' canon' : '') + '"><span class="tag">' + esc(f.step) + '</span><span class="tag' + (f.canon ? ' canon' : '') + '">' + (f.canon ? 'CANON' : esc(f.classification)) + '</span><b>' + esc(f.who) + '</b>'
          + '<div>' + esc(f.body) + '</div>' + (f.evidence && f.evidence.title ? '<div class="meta">evidence: ' + esc(f.evidence.kind || '') + ' · ' + esc(f.evidence.title) + '</div>' : '')
          + (f.ruling ? '<p class="ruling">JACK: ' + esc(f.ruling) + '</p>' : '')
          + '<div class="meta">' + f.backers + ' corroborating' + (!f.mine && !f.backed && !f.canon && c.status === 'open' ? ' · <button type="button" data-back="' + f.id + '">CORROBORATE</button>' : f.backed ? ' · you backed this' : '') + '</div></div>').join('') : '<p class="meta">No filings yet. Be the first.</p>');
      const at = evidence();
      if ($('arg-attach')) $('arg-attach').textContent = at ? 'attached: ' + at.kind + ' · ' + at.title : 'tip: open something on the map first and it is attached as evidence';
    }
  }

  /* ---------- evidence: whatever the traveller last opened in the info card ---------- */
  function evidence() {
    const card = $('card'), b = $('card-b');
    if (!card || card.style.display === 'none' || !b) return null;
    const title = (b.querySelector('h3') || {}).textContent || '', kind = (b.querySelector('.lbx-kind') || {}).textContent || '';
    if (!title) return null;
    const c = map.getCenter();
    return { kind: kind.slice(0, 80), title: title.slice(0, 200), year: currentYear(), lng: +c.lng.toFixed(5), lat: +c.lat.toFixed(5) };
  }
  function currentYear() {
    const t = ($('yr-v') || {}).textContent || 'Now';
    if (/now/i.test(t)) return null;
    const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
    return /BC/.test(t) ? -n : n;
  }

  /* ---------- actions ---------- */
  async function openDossier(id) {
    S.active = id; S.tab = 'dossier'; S.msg = '';
    const j = await api('case', { id });
    if (!j.ok) return note(j.error || 'Could not open the dossier.', true);
    S.dossier = j; drawClues(j.clues); render();
    map.flyTo({ center: [j.case.lng, j.case.lat], zoom: Math.max(map.getZoom(), 13), duration: 1400 });
  }
  async function wake() {
    const c = map.getCenter(), lat = c.lat.toFixed(2), lng = c.lng.toFixed(2), year = currentYear();
    note('Listening to the registry here… (this can take a minute)');
    glitch(2);
    const P = (q) => (C.proxy || '/map/proxy.php') + '?' + new URLSearchParams(q);
    const get = (u, ms) => Promise.race([fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
    const [ev, ppl, wiki, place] = await Promise.all([
      get(P({ src: 'wdevents', lat, lng }), 25000), get(P({ src: 'wdpeople', lat, lng, to: year != null ? year : 2100 }), 25000), get(P({ src: 'wiki', lang: 'en', lat, lng }), 15000),
      get('https://nominatim.openstreetmap.org/reverse?' + new URLSearchParams({ format: 'jsonv2', lat: c.lat, lon: c.lng, zoom: 12, 'accept-language': 'en' }), 8000)]);
    const context = {
      events: ((ev && ev.features) || []).slice(0, 15).map((f) => ({ what: f.properties.label, when: f.properties.date, kind: f.properties.kind, about: f.properties.desc })),
      people_born_here: ((ppl && ppl.people) || []).slice(0, 15).map((x) => ({ name: x.name, born: x.born, about: x.desc })),
      wikipedia_nearby: ((wiki && wiki.features) || []).slice(0, 12).map((f) => ({ title: f.properties.title, about: f.properties.description })),
      evidence_open_on_screen: evidence(),
    };
    const j = await api('open', { lng: +c.lng.toFixed(5), lat: +c.lat.toFixed(5), year, place: (place && place.display_name) || '', context });
    if (!j.ok) { if (j.case_id) { openDossier(j.case_id); } return note(j.error || 'Jack could not open a case.', true); }
    await poll(true); glitch(3); openDossier(j.case_id);
  }
  async function file(e) {
    e.preventDefault();
    const text = $('arg-text').value.trim(); if (text.length < 8) return note('File something Jack can read.', true);
    const c = map.getCenter();
    $('arg-send').disabled = true; $('arg-send').textContent = 'FILING…';
    const j = await api('file', { case_id: S.active, step: $('arg-step').value, body: text, evidence: evidence(), lng: +c.lng.toFixed(5), lat: +c.lat.toFixed(5), year: currentYear() });
    if (!j.ok) { note(j.error || 'Not filed.', true); return; }
    glitch(j.glitch || 1);
    S.msg = j.classification + ' · stability ' + (j.stability_delta >= 0 ? '+' : '') + j.stability_delta + (j.clue ? ' · new lead: ' + j.clue : '');
    await openDossier(S.active); poll(true);
  }
  async function back(id) {
    const j = await api('corroborate', { filing_id: id });
    if (!j.ok) return note(j.error || 'Could not corroborate.', true);
    if (j.closed) { glitch(3); S.msg = 'CASE CLOSED. ' + j.closed.report + (j.closed.next ? ' A thread leads on: ' + j.closed.next.title : ''); }
    else if (j.canon) { glitch(2); S.msg = 'It is CANON now.'; }
    await openDossier(S.active); poll(true);
  }

  net.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-clue]'); if (!t) return;
    if (t.dataset.tab) { S.tab = t.dataset.tab; S.msg = ''; render(); }
    else if (t.dataset.case) openDossier(+t.dataset.case);
    else if (t.id === 'arg-wake') wake();
    else if (t.dataset.back) back(+t.dataset.back);
    else if (t.dataset.clue != null && S.dossier) { const k = S.dossier.clues[+t.dataset.clue]; if (k && k.lng != null) map.flyTo({ center: [k.lng, k.lat], zoom: Math.max(map.getZoom(), 15), duration: 1200 }); }
  });
  net.addEventListener('submit', (e) => { if (e.target.id === 'arg-file') file(e); });

  /* ---------- the shared world: poll the registry ---------- */
  let pollT = 0;
  async function poll(once) {
    clearTimeout(pollT);
    try {
      const j = await api('state', { since: S.since });
      if (j.ok) {
        S.open = j.open; S.closed = j.closed; S.me = j.me; S.stability = j.stability;
        if (j.log && j.log.length) {
          const fresh = S.since > 0 ? j.log : [];
          S.log = S.log.concat(j.log).slice(-200); S.since = j.log[j.log.length - 1].id;
          if (fresh.some((l) => l.kind === 'close' || l.kind === 'open')) glitch(2);
        }
        drawCases();
        if (S.tab !== 'dossier') render(); else $('arg-stab').style.width = Math.max(2, S.stability) + '%';
      }
    } catch (e) { /* the next poll will try again */ }
    if (!once) pollT = setTimeout(poll, document.hidden ? 45000 : 12000);
  }

  /* ---------- glitching between timelines ---------- */
  // A ghost of another year flickers through: OpenHistoricalMap's streets and buildings from a random past, in neon, for a moment.
  const GHOST = ['ghost-roads', 'ghost-buildings'];
  function ghostYear(y) {
    const f = ['all', ['<=', ['coalesce', ['get', 'start_decdate'], -100000], y], ['>', ['coalesce', ['get', 'end_decdate'], 100000], y]];
    if (!map.getSource('ghost')) {
      map.addSource('ghost', { type: 'vector', tiles: ['https://vtiles.openhistoricalmap.org/maps/ohm/{z}/{x}/{y}.pbf'], maxzoom: 14 });
      map.addLayer({ id: 'ghost-buildings', type: 'fill', source: 'ghost', 'source-layer': 'buildings', minzoom: 12, paint: { 'fill-color': '#ff2bd6', 'fill-opacity': 0 } });
      map.addLayer({ id: 'ghost-roads', type: 'line', source: 'ghost', 'source-layer': 'transport_lines', paint: { 'line-color': '#19e3ff', 'line-width': 1.6, 'line-opacity': 0 } });
    }
    GHOST.forEach((l) => map.setFilter(l, f));
  }
  let glitchT = 0;
  function glitch(level) {
    level = Math.max(1, Math.min(3, level | 0));
    const y = Math.round(1600 + Math.random() * 380);
    try { ghostYear(y); map.setPaintProperty('ghost-roads', 'line-opacity', 0.8); map.setPaintProperty('ghost-buildings', 'fill-opacity', 0.35); } catch (e) { /* style not ready */ }
    flash.textContent = 'TIMELINE ⟂ ' + y + ' · DRIFT ' + (level * 13 + Math.round(Math.random() * 9)) + '%';
    document.body.classList.remove('cy-g1', 'cy-g2', 'cy-g3'); void document.body.offsetWidth;
    document.body.classList.add('cy-g' + level);
    clearTimeout(glitchT);
    glitchT = setTimeout(() => {
      document.body.classList.remove('cy-g1', 'cy-g2', 'cy-g3');
      try { map.setPaintProperty('ghost-roads', 'line-opacity', 0); map.setPaintProperty('ghost-buildings', 'fill-opacity', 0); } catch (e) { /* gone */ }
    }, 260 + level * 260);
  }
  // Going deeper glitches more: zoom, and how fractured the nearest open case's timeline is.
  setInterval(() => {
    if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = map.getCenter(), z = map.getZoom();
    let instability = 0;
    for (const x of S.open) { const km = Math.hypot((x.lng - c.lng) * 111 * Math.cos(c.lat * Math.PI / 180), (x.lat - c.lat) * 111); if (km < 25) instability = Math.max(instability, (100 - x.stability) / 100); }
    const p = 0.04 + Math.max(0, z - 9) * 0.012 + instability * 0.25;
    if (Math.random() < p) glitch(instability > 0.6 ? 2 : 1);
  }, 4000);

  const start = () => { initLayers(); poll(); render(); setTimeout(() => glitch(2), 900); };
  if (map.loaded()) start(); else map.once('load', start);
})();
