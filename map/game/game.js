/* The Desk: Episode 1, "Unsigned For", on the Passport Map. Loaded only on /map/play/.
   One move per stub: Go -> read -> give it back or keep it. Jack's lines and the plot come from the server (episode.php). */
(() => {
  'use strict';
  const C = window.TTG_MAP || {};
  const map = window.ttgMap;
  if (!map || !C.game) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  let S = null, busy = false, justDecided = null, collapsed = false;

  const api = async (op, body) => {
    const r = await fetch(C.game, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': C.csrf || '' },
      body: JSON.stringify(Object.assign({ op }, body || {})) });
    const j = await r.json().catch(() => ({ ok: false, error: 'The desk did not answer.' }));
    if (!j.ok) throw new Error(j.error || 'The desk jammed.');
    return j;
  };

  /* ---------- panel ---------- */
  const desk = document.createElement('section');
  desk.id = 'desk'; desk.setAttribute('aria-label', 'The Desk: Guild game');
  desk.innerHTML = '<header><b>THE DESK</b><span id="desk-sub"></span><button type="button" id="desk-fold" aria-expanded="true" aria-controls="desk-b">Fold</button></header>'
    + '<div id="desk-b" aria-live="polite"></div>';
  const side = $('side');
  side.insertBefore(desk, side.firstChild);
  $('desk-fold').onclick = () => { collapsed = !collapsed; desk.classList.toggle('folded', collapsed); $('desk-fold').setAttribute('aria-expanded', String(!collapsed)); $('desk-fold').textContent = collapsed ? 'Open' : 'Fold'; };

  const tag = (t) => '<span class="tg tg-' + t.toLowerCase() + '">' + t + '</span>';
  const jack = (lines) => (Array.isArray(lines) ? lines : [lines]).filter(Boolean).map((l) => '<p class="jk">' + esc(l) + '</p>').join('');
  const btn = (act, label, cls) => '<button type="button" data-act="' + act + '" class="' + (cls || '') + '">' + esc(label) + '</button>';

  // A fraying memory loses every third word: the player can see how much is left.
  const fray = (t) => t.split(' ').map((w, i) => (i % 3 === 1 ? '▒'.repeat(Math.min(6, w.length)) : w)).join(' ');
  function memoryHtml() {
    const m = S.memory, rows = ['A', 'B', 'C', 'D'].map((k) => {
      const x = m[k]; if (!x) return '';
      const st = { held: 'HELD', fraying: 'FRAYING', gone: 'RETURNED', open: 'UNSIGNED' }[x.state] || x.state;
      const count = k === 'D' ? (x.head ? '' : '') : (x.returned || x.kept ? ' · given back ' + x.returned + ' · kept ' + x.kept : '');
      const text = x.state === 'gone' ? '<i>Jack no longer holds this.</i>' : esc(x.state === 'fraying' ? fray(x.memory) : x.memory);
      const rc = (x.receipts || []).map((r) => '<li>“' + esc(r.text) + '” <small>— ' + esc(r.who) + (r.mine ? ' (you)' : '') + '</small></li>').join('');
      return '<li class="mem mem-' + x.state + '"><b>' + esc(x.no + ' · ' + x.name) + '</b> <small>' + st + count + '</small><p>' + text + '</p>'
        + (rc ? '<p class="mem-left">What travellers left of it:</p><ul class="rc">' + rc + '</ul>' : '') + '</li>';
    }).join('');
    const n = S.travellers;
    return '<details class="file"' + (S.finished ? ' open' : '') + '><summary>What Jack remembers <small>(shared by all ' + n + ' traveller' + (n === 1 ? '' : 's') + ' who took the book)</small></summary><ul>' + rows + '</ul></details>';
  }

  function stubCard(s) {
    const mem = S.memory[s.stub];
    const memLine = mem && mem.state === 'gone'
      ? '<p class="mem-gone">Jack no longer remembers this hour. Other travellers gave it back.</p>'
        + (mem.receipts.length ? '<p class="k">ALL THAT IS LEFT OF IT</p><ul class="rc">' + mem.receipts.map((r) => '<li>“' + esc(r.text) + '” <small>— ' + esc(r.who) + '</small></li>').join('') + '</ul>' : '')
      : '<p class="mem-now">' + esc(mem && mem.state === 'fraying' ? fray(s.memory) : s.memory) + '</p>';
    return '<article class="stub">'
      + '<p class="k">' + tag('Fiction') + ' RECEIPT ' + esc(s.no) + ' · ' + esc(s.place) + ' · ' + esc(s.year) + '</p>'
      + '<p class="front">' + esc(s.front) + '</p><p class="back"><span>On the back:</span> ' + esc(s.back) + '</p>'
      + '<div class="real">' + tag('Real') + ' <b>' + esc(s.real.title) + '</b><p>' + esc(s.real.text) + '</p>'
      + '<a href="' + esc(s.real.url) + '" target="_blank" rel="noopener">Coflein record ' + esc(s.real.nprn) + ' ↗</a></div>'
      + (s.canon ? '<div class="real">' + tag('Canon') + '<p>' + esc(s.canon) + '</p></div>' : '')
      + '<p class="k">WHAT JACK REMEMBERS OF IT</p>' + memLine
      + '</article>';
  }

  function chainHtml() {
    if (!S.chain.length) return '<p class="k">Nobody has decided this receipt before you.</p>';
    return '<p class="k">THIS RECEIPT HAS BEEN DECIDED BEFORE</p><ol class="chain">' + S.chain.map((c) =>
      '<li><b>' + esc(c.who) + (c.mine ? ' (you)' : '') + '</b> ' + (c.action === 'signed' ? 'signed it over to Jack' : 'returned it to 1951')
      + (c.note ? '<br>“' + esc(c.note) + '”' : c.private && !c.mine ? ' <small>(name and note private)</small>' : '') + '</li>').join('') + '</ol>';
  }

  const noteForm = (label) => '<label class="nt">' + esc(label) + '<textarea id="desk-note" maxlength="600" rows="2" placeholder="Optional"></textarea></label>'
    + '<label class="aud"><input type="checkbox" id="desk-aud"> Show my name and this line to other travellers</label>';

  function render() {
    if (!S) return;
    $('desk-sub').textContent = S.episode.title + ' · ' + S.episode.place;
    const b = $('desk-b'); let h = '';
    const stubs = Object.fromEntries(S.stubs.map((s) => [s.stub, s]));
    if (!S.started) {
      h += '<p class="k">' + esc(S.episode.opening.kicker) + ' ' + tag('Fiction') + '</p>' + jack(S.episode.opening.jack)
        + '<p class="small">' + tag('Canon') + ' ' + esc(S.episode.opening.canon_note) + '</p>'
        + '<div class="acts">' + btn('start', 'Take the receipt book', 'go') + '</div>';
    } else {
      // The stub in hand (found, not yet decided)
      const open = ['A', 'B', 'C'].map((k) => stubs[k]).find((s) => s.state === 'found');
      const d = stubs.D;
      if (justDecided) {
        const s = stubs[justDecided];
        h += '<p class="k">RECEIPT ' + esc(s.no) + ' · ' + (s.state === 'returned' ? 'GIVEN BACK' : 'KEPT') + '</p>' + jack(s.said);
        if (S.decided === 2 && S.reversal && !sessionStorageGet('rev')) { h += '<div class="rev">' + jack(S.reversal.lines) + jack(S.reversal.coda) + '</div>'; sessionStorageSet('rev'); }
        h += '<div class="acts">' + btn('continue', 'Continue', 'go') + '</div>';
      } else if (open) {
        h += stubCard(open) + jack(S.memory[open.stub].state === 'gone' && open.lost ? open.lost : open.ask) + noteForm(open.state === 'found' ? 'A line for whoever finds this receipt next' : '')
          + '<div class="acts">' + btn('return:' + open.stub, 'Give it back', 'go') + btn('keep:' + open.stub, 'Keep it') + '</div>'
          + '<p class="small">Giving it back is final for your copy. Keeping it can be undone later.</p>';
      } else if (S.next) {
        const s = stubs[S.next];
        h += (S.decided === 2 && S.reversal ? '<details class="rev"><summary>What Jack found in the ledger</summary>' + jack(S.reversal.lines) + '</details>' : '')
          + '<p class="k">NEXT · RECEIPT ' + esc(s.no) + ' · ' + esc(s.place) + '</p>'
          + jack(S.next === 'A' ? 'The first was handed in by a passenger, at the railway station at Penwyllt.' : S.next === 'B' ? 'The second is a stone\'s throw away, at the lime kilns beside the line.' : S.next === 'C' ? 'The third went up the ridge, to Cribarth.' : 'The fourth was handed in at Abercrave. The handwriting is mine.')
          + '<div class="acts">' + btn('go:' + S.next, 'Go to ' + s.place + ', ' + s.year, 'go') + '</div>';
      } else if (d.state === 'found') {
        h += stubCard(d) + chainHtml() + jack(d.ask) + noteForm('A line for Jack, and for whoever reaches this next')
          + '<div class="acts">' + Object.entries(d.choices).map(([k, c]) => btn('custody:' + k, c.label, k === 'returned' ? 'go' : '')).join('') + '</div>'
          + '<ul class="says">' + Object.values(d.choices).map((c) => '<li><b>' + esc(c.label) + ':</b> ' + esc(c.says) + '</li>').join('') + '</ul>';
      } else if (S.finished) {
        h += '<p class="k">REGISTER · VALLEY STUBS · CLOSED BY ' + esc(S.me.name.toUpperCase()) + '</p><ul class="reg">'
          + S.stubs.map((s) => '<li><b>' + esc(s.no) + ' ' + esc(s.name) + '</b>: ' + ({ returned: 'given back', kept: 'kept', signed: 'signed over to Jack' }[s.state] || s.state) + '</li>').join('') + '</ul>'
          + jack(d.said) + (S.ending ? jack(S.ending.forward) : '')
          + '<p class="small">Anyone who takes the book after you meets the Jack you left. They can decide receipt 0001 differently.</p>';
      }
      // Kept stubs can still go back
      const kept = ['A', 'B', 'C'].map((k) => stubs[k]).filter((s) => s.state === 'kept');
      if (kept.length && !open && !justDecided) h += '<p class="small">Kept: ' + kept.map((s) => btn('reopen:' + s.stub, s.no + ' ' + s.name, 'link')).join(' ') + '</p>';
    }
    h += memoryHtml();
    b.innerHTML = h;
    drawMarks();
  }
  // Session-only memory of whether the ledger reversal was shown in full; storage may be unavailable.
  function sessionStorageGet(k) { try { return sessionStorage.getItem('desk-' + k); } catch (e) { return null; } }
  function sessionStorageSet(k) { try { sessionStorage.setItem('desk-' + k, '1'); } catch (e) { /* fine */ } }
  let reopened = null;

  /* ---------- map marks: the four places, coloured by what you did ---------- */
  function drawMarks() {
    if (!map.isStyleLoaded()) { map.once('idle', drawMarks); return; }
    const feats = S.stubs.filter((s) => s.at).map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.at.lng, s.at.lat] },
      properties: { label: s.no + (s.state === 'returned' ? ' · given back' : s.state === 'kept' ? ' · kept' : s.state === 'signed' ? ' · signed' : ''), st: s.state } }));
    const data = { type: 'FeatureCollection', features: feats };
    if (map.getSource('desk')) return map.getSource('desk').setData(data);
    map.addSource('desk', { type: 'geojson', data });
    map.addLayer({ id: 'desk-dot', type: 'circle', source: 'desk', paint: {
      'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#1b1a17',
      'circle-color': ['match', ['get', 'st'], 'returned', '#1b1a17', 'kept', '#b3261e', 'signed', '#b3261e', '#e8dcb6'] } });
    map.addLayer({ id: 'desk-label', type: 'symbol', source: 'desk', layout: { 'text-field': ['get', 'label'], 'text-font': ['Open Sans Semibold'], 'text-size': 11,
      'text-offset': [0, 1.3], 'text-anchor': 'top' }, paint: { 'text-color': '#1b1a17', 'text-halo-color': '#e8dcb6', 'text-halo-width': 1.6 } });
  }
  map.on('styledata', () => { if (S && !map.getSource('desk')) drawMarks(); });

  function goTo(s) {
    if (window.ttgSetYear) window.ttgSetYear(s.year);
    // Keep the place clear of the Layers panel (left) and the Desk (right), or of the Desk on top on a phone.
    const narrow = innerWidth <= 640;
    // On a phone the Layers sheet and the Desk would share the screen with no map left: fold the sheet.
    if (narrow && $('panel') && !$('panel').classList.contains('closed') && $('toggle')) $('toggle').click();
    const padding = narrow ? { top: Math.round(innerHeight * 0.5), bottom: 60, left: 20, right: 20 }
      : { top: 60, bottom: 40, left: Math.min(340, innerWidth * 0.3), right: Math.min(410, innerWidth * 0.35) };
    const c = [s.at.lng, s.at.lat];
    map.flyTo({ center: c, zoom: 15.2, pitch: 45, padding, duration: calm.matches ? 0 : 2200, essential: false });
    // With 3D terrain the hill lifts the place above the aimed point; once the terrain is in, settle it back into view.
    map.once('moveend', () => setTimeout(() => {
      const p = map.project(c), r = map.getContainer().getBoundingClientRect();
      const want = [padding.left + (r.width - padding.left - padding.right) / 2, padding.top + (r.height - padding.top - padding.bottom) / 2];
      if (Math.hypot(p.x - want[0], p.y - want[1]) > 40) map.panBy([p.x - want[0], p.y - want[1]], { duration: calm.matches ? 0 : 600 });
    }, 400));
  }

  /* ---------- actions ---------- */
  let first = true;
  async function load() {
    S = await api('state'); render();
    // Coming back to the page with a stub in hand: put the map back where (and when) it was handed in.
    if (first) { first = false; const s = S.stubs.find((x) => x.state === 'found'); if (s && s.at) goTo(s); }
  }
  $('desk-b').addEventListener('click', async (e) => {
    const el = e.target.closest('button[data-act]'); if (!el || busy) return;
    const [act, k] = el.dataset.act.split(':');
    const note = $('desk-note') ? $('desk-note').value : '', aud = $('desk-aud') && $('desk-aud').checked ? 'guild' : 'me';
    busy = true; el.disabled = true;
    try {
      if (act === 'start') { await api('start'); await load(); const s = S.stubs.find((x) => x.stub === S.next); if (s) goTo(s); return; }
      if (act === 'continue') { justDecided = null; render(); return; }
      if (act === 'go') { const s = S.stubs.find((x) => x.stub === k); goTo(s); await api('find', { stub: k }); await load(); return; }
      if (act === 'return' || act === 'keep') { await api('decide', { stub: k, action: act, receipt: note, audience: aud }); justDecided = k; reopened = null; await load(); return; }
      if (act === 'reopen') { // a kept stub, back in hand to reconsider
        const s = S.stubs.find((x) => x.stub === k); s.state = 'found'; goTo(s); render(); return; }
      if (act === 'custody') { await api('custody', { action: k, note, audience: aud }); await load(); return; }
    } catch (err) {
      const p = document.createElement('p'); p.className = 'err'; p.textContent = err.message; $('desk-b').prepend(p);
    } finally { busy = false; el.disabled = false; }
  });

  $('desk-b').innerHTML = '<p class="small">Opening the desk…</p>';
  load().catch((e) => { $('desk-b').innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
})();
