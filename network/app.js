(() => {
  'use strict';
  const root = document.getElementById('net');
  if (!root) return;
  const CSRF = root.dataset.csrf;
  const HEX = /^#[0-9a-f]{6}$/;
  const PALETTE = ['#1e3a5f', '#9b2d20', '#2d6a3e', '#c9a227', '#6b3fa0', '#d9cb9e', '#241d12', '#4a90a4', '#c4622d', '#8a8a8a', '#e8dfc0', '#ffffff'];
  const S = { me: 0, members: new Map(), threads: [], blocked: new Set(), view: { kind: 'room', id: 'commons' }, last: 0, maxBody: 1000, msgs: [], q: '', paint: PALETTE[0], draft: null, viewTok: 0 };
  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

  const bar = document.querySelector('.ttg-net');
  if (bar && getComputedStyle(bar).position !== 'fixed') root.style.setProperty('--bar', bar.offsetHeight + 'px');

  async function api(a, { method = 'GET', params = {}, body } = {}) {
    const opt = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (method === 'POST') { opt.headers['Content-Type'] = 'application/json'; opt.headers['X-CSRF-Token'] = CSRF; opt.body = JSON.stringify(body || {}); }
    const r = await fetch('/network/api.php?' + new URLSearchParams({ a, ...params }), opt);
    let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
    if (r.status === 401) { location.reload(); throw new Error('Signed out.'); }
    if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || 'Request failed (' + r.status + ').');
    return j;
  }
  const hasInk = (c) => Array.isArray(c) && c.some((x) => HEX.test(x));
  function face(cells, cls) {
    const f = el('span', 'face' + (cls ? ' ' + cls : ''));
    f.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 81; i++) { const p = document.createElement('i'); const c = cells && cells[i]; if (HEX.test(c || '')) p.style.background = c; f.appendChild(p); }
    return f;
  }
  const who = (id) => S.members.get(id);
  const when = (t) => { const d = new Date(t * 1000), n = new Date(); const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return d.toDateString() === n.toDateString() ? hm : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + hm; };

  /* ---------- side lists ---------- */
  function renderMe() {
    const m = who(S.me); if (!m) return;
    const f = $('#meFace'); f.replaceWith(Object.assign(face(m.avatar, 'sm'), { id: 'meFace' }));
    $('#meName').textContent = m.name;
  }
  function rowFor(m, sub, unread) {
    const b = el('button', 'row-item'); b.type = 'button';
    b.setAttribute('aria-current', String(S.view.kind === 'dm' && S.view.id === m.id));
    const dot = el('span', 'dot' + (m.online ? ' on' : '')); dot.title = m.online ? 'online' : 'away';
    const meta = el('span', 'meta'); meta.append(el('b', '', m.name), el('i', '', sub));
    b.append(face(m.avatar), meta);
    if (unread) b.append(el('span', 'badge', String(unread)));
    b.append(dot);
    b.onclick = () => openDm(m.id);
    return b;
  }
  function renderSide() {
    const tbox = $('#threads'); tbox.textContent = '';
    S.threads.forEach((t) => {
      const m = who(t.peer); if (!m) return;
      tbox.append(rowFor(m, (t.mine ? 'You: ' : '') + (t.preview || '…'), t.unread));
    });
    if (!S.threads.length) tbox.append(Object.assign(el('p', 'fine', 'No private messages yet. Pick someone from the register.'), { style: 'padding:0 .9rem' }));
    const box = $('#members'); box.textContent = '';
    const q = S.q.trim().toLowerCase();
    const list = [...S.members.values()].filter((m) => !m.you && (!q || (m.name + ' ' + m.role + ' ' + m.location).toLowerCase().includes(q)));
    list.sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
    list.forEach((m) => box.append(rowFor(m, [m.role, m.location].filter(Boolean).join(' · ') || 'traveller', 0)));
    $('#count').textContent = '(' + (S.members.size) + ')';
    if (!list.length) box.append(Object.assign(el('p', 'fine', q ? 'No one matches.' : 'You are the first one here.'), { style: 'padding:0 .9rem' }));
    $('#roomBtn').setAttribute('aria-current', String(S.view.kind === 'room'));
  }

  /* ---------- conversation pane ---------- */
  function showMain() { root.dataset.pane = 'main'; }
  function showList() { root.dataset.pane = 'list'; }
  function head(title, sub, faceEl) {
    const h = el('header', 'panehead');
    const back = el('button', 'ghost small back', '‹ Back'); back.type = 'button'; back.onclick = showList;
    h.append(back); if (faceEl) h.append(faceEl);
    const t = el('div', 't'); t.append(el('b', '', title), el('span', '', sub)); h.append(t);
    return h;
  }
  function composer(send) {
    const c = el('form', 'composer');
    const line = el('div', 'line'), ta = el('textarea'); ta.rows = 1; ta.maxLength = S.maxBody; ta.placeholder = 'Write a message. Enter sends, Shift+Enter for a new line.'; ta.setAttribute('aria-label', 'Message');
    const btn = el('button', 'primary', 'Send'); btn.type = 'submit';
    line.append(ta, btn);
    const meta = el('div', 'meta'), err = el('span', 'err'), cnt = el('span', '', '0/' + S.maxBody);
    meta.append(err, cnt); c.append(line, meta);
    ta.addEventListener('input', () => { cnt.textContent = ta.value.length + '/' + S.maxBody; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); c.requestSubmit(); } });
    c.addEventListener('submit', async (e) => {
      e.preventDefault(); const text = ta.value.trim(); if (!text) return;
      btn.disabled = true; err.textContent = '';
      try { await send(text); ta.value = ''; ta.dispatchEvent(new Event('input')); } catch (x) { err.textContent = x.message; }
      btn.disabled = false; ta.focus();
    });
    return c;
  }
  function renderMsgs(box, stick) {
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.textContent = '';
    if (!S.msgs.length) { box.append(el('p', 'empty', S.view.kind === 'room' ? 'The commons is quiet. Say something.' : 'No messages yet. Say hello.')); return; }
    let prev = null;
    S.msgs.forEach((m) => {
      const a = who(m.from) || { name: 'Unknown traveller', avatar: [] };
      const cont = prev && prev.from === m.from && m.at - prev.at < 300;
      const row = el('div', 'msg' + (cont ? ' cont' : ''));
      row.append(face(a.avatar));
      const col = el('div');
      const w = el('div', 'who'); w.append(el('b', '', a.name), document.createTextNode(' · ' + when(m.at)));
      if (m.from === S.me) { const d = el('button', 'del', 'delete'); d.type = 'button'; d.onclick = async () => { if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'sure?'; setTimeout(() => { d.dataset.sure = ''; d.textContent = 'delete'; }, 3000); return; } try { await api('delete', { method: 'POST', body: { id: m.id } }); S.msgs = S.msgs.filter((x) => x.id !== m.id); renderMsgs(box, false); } catch (x) { d.textContent = x.message; } }; w.append(' ', d); }
      col.append(w, el('div', 'body', m.body)); row.append(col); box.append(row); prev = m;
    });
    if (stick || near) box.scrollTop = box.scrollHeight;
  }
  async function openRoom() {
    const tok = ++S.viewTok; S.view = { kind: 'room', id: 'commons' }; S.msgs = []; S.last = 0; showMain(); renderSide();
    const pane = $('#pane'); pane.textContent = '';
    const box = el('div', 'msgs'); box.setAttribute('role', 'log'); box.setAttribute('aria-live', 'polite');
    pane.append(head('The Commons', S.members.size + ' on the register · everyone here can read this'), box,
      composer(async (text) => { const r = await api('send', { method: 'POST', body: { room: 'commons', body: text } }); addMsgs([r.message], box); }));
    try { const r = await api('room', { params: { room: 'commons', since: 0 } }); if (tok !== S.viewTok) return; S.msgs = r.messages; S.last = S.msgs.length ? S.msgs[S.msgs.length - 1].id : 0; ensureAuthors(); renderMsgs(box, true); } catch (e) { box.textContent = ''; box.append(el('p', 'empty err', e.message)); }
  }
  async function openDm(id) {
    const m = who(id); if (!m) return;
    const tok = ++S.viewTok; S.view = { kind: 'dm', id }; S.msgs = []; S.last = 0; showMain(); renderSide();
    const pane = $('#pane'); pane.textContent = '';
    const h = head(m.name, [m.role, m.location].filter(Boolean).join(' · ') || 'traveller', face(m.avatar));
    const blk = el('button', 'ghost small', S.blocked.has(id) ? 'Unblock' : 'Block'); blk.type = 'button';
    blk.onclick = async () => { const on = !S.blocked.has(id); try { await api('block', { method: 'POST', body: { id, on } }); on ? S.blocked.add(id) : S.blocked.delete(id); blk.textContent = on ? 'Unblock' : 'Block'; } catch (e) { blk.textContent = e.message; } };
    h.append(blk); pane.append(h);
    if (m.bio) pane.append(el('div', 'bio-card', m.bio));
    const box = el('div', 'msgs'); box.setAttribute('role', 'log'); box.setAttribute('aria-live', 'polite'); pane.append(box,
      composer(async (text) => { const r = await api('send', { method: 'POST', body: { to: id, body: text } }); addMsgs([r.message], box); refreshThreads(); }));
    try { const r = await api('dm', { params: { peer: id, since: 0 } }); if (tok !== S.viewTok) return; S.msgs = r.messages; S.last = S.msgs.length ? S.msgs[S.msgs.length - 1].id : 0; renderMsgs(box, true); refreshThreads(); } catch (e) { box.textContent = ''; box.append(el('p', 'empty err', e.message)); }
  }
  function addMsgs(list, box) {
    const have = new Set(S.msgs.map((m) => m.id)); let added = false;
    list.forEach((m) => { if (!have.has(m.id)) { S.msgs.push(m); added = true; } });
    if (added) { S.msgs.sort((a, b) => a.id - b.id); S.last = S.msgs[S.msgs.length - 1].id; ensureAuthors(); renderMsgs(box, true); }
  }
  let refetching = false;
  async function ensureAuthors() { if (refetching) return; if (S.msgs.some((m) => !who(m.from))) { refetching = true; try { await refreshMembers(); const box = $('.msgs'); if (box) renderMsgs(box, false); } catch (e) { /* retry next poll */ } refetching = false; } }

  /* ---------- your slip (profile) ---------- */
  function openMe(notice) {
    ++S.viewTok; S.view = { kind: 'me' }; showMain(); renderSide();
    const m = who(S.me); const pane = $('#pane'); pane.textContent = '';
    pane.append(head('Your slip', 'What other members see'));
    const wrap = el('form', 'slip'); wrap.noValidate = true;
    const cells = (m.avatar || []).slice(0, 81); while (cells.length < 81) cells.push('');
    const cols = el('div', 'cols');
    const left = el('div'); left.append(el('label', '', '9×9 signet'));
    const grid = el('div', 'painter'); grid.setAttribute('role', 'grid'); grid.setAttribute('aria-label', 'Nine by nine signet painter');
    const cellEls = cells.map((c, i) => { const b = el('button'); b.type = 'button'; b.setAttribute('aria-label', 'Cell ' + (Math.floor(i / 9) + 1) + ',' + (i % 9 + 1)); b.dataset.i = i; paintCell(b, c); grid.append(b); return b; });
    function paintCell(b, c) { b.style.background = HEX.test(c || '') ? c : 'transparent'; }
    const setCell = (i, c) => { cells[i] = c; paintCell(cellEls[i], c); prev(); };
    let down = false, erase = false;
    grid.addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (!b) return; down = true; erase = e.button === 2 || e.altKey || cells[+b.dataset.i] === S.paint; setCell(+b.dataset.i, erase ? '' : S.paint); e.preventDefault(); });
    grid.addEventListener('pointerover', (e) => { if (!down) return; const b = e.target.closest('button'); if (b) setCell(+b.dataset.i, erase ? '' : S.paint); });
    addEventListener('pointerup', () => { down = false; });
    grid.addEventListener('contextmenu', (e) => e.preventDefault());
    grid.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { const b = e.target.closest('button'); if (b) { e.preventDefault(); setCell(+b.dataset.i, cells[+b.dataset.i] === S.paint ? '' : S.paint); } } });
    const tools = el('div', 'tools'); const col = el('input'); col.type = 'color'; col.value = S.paint; col.setAttribute('aria-label', 'Colour');
    col.oninput = () => { S.paint = col.value.toLowerCase(); sw.forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.c === S.paint))); };
    const fill = el('button', 'ghost small', 'Fill'); fill.type = 'button'; fill.onclick = () => cells.forEach((_, i) => setCell(i, S.paint));
    const clr = el('button', 'ghost small', 'Clear'); clr.type = 'button'; clr.onclick = () => cells.forEach((_, i) => setCell(i, ''));
    tools.append(col, fill, clr);
    const swBox = el('div', 'sw'); const sw = PALETTE.map((p) => { const b = el('button'); b.type = 'button'; b.style.background = p; b.dataset.c = p; b.title = p; b.setAttribute('aria-label', 'Colour ' + p); b.setAttribute('aria-pressed', String(p === S.paint)); b.onclick = () => { S.paint = p; col.value = p; sw.forEach((s) => s.setAttribute('aria-pressed', String(s === b))); }; swBox.append(b); return b; });
    const preview = el('div'); preview.style.marginTop = '.8rem'; let pv = null;
    function prev() { const n = face(cells, 'lg'); pv ? pv.replaceWith(n) : preview.append(n); pv = n; }
    left.append(grid, tools, swBox, el('p', 'fine', 'Click or drag to paint. Click a painted cell with the same colour to clear it. Preview:'), preview);
    const right = el('div');
    const f = (label, name, val, max) => { const l = el('label', '', label); l.htmlFor = 'f_' + name; const i = el('input'); i.type = 'text'; i.id = 'f_' + name; i.value = val; i.maxLength = max; right.append(l, i); return i; };
    const nm = f('Name', 'name', m.name, 80), rl = f('Station / role', 'role', m.role, 80), lc = f('Coordinates (town, valley)', 'loc', m.location, 120);
    const bl = el('label', '', 'Field note'); bl.htmlFor = 'f_bio'; const bio = el('textarea'); bio.id = 'f_bio'; bio.rows = 5; bio.maxLength = 600; bio.value = m.bio; right.append(bl, bio);
    const pubL = el('label'); pubL.style.cssText = 'display:flex;gap:.5rem;align-items:flex-start;margin-top:1rem'; const pub = el('input'); pub.type = 'checkbox'; pub.checked = m.public; pub.style.marginTop = '.3rem';
    pubL.append(pub, el('span', '', 'Show me on the register and let me speak on the network. Switching this off hides you from members and stops you posting.'));
    right.append(pubL);
    cols.append(left, right); wrap.append(cols);
    const note = el('p', 'fine', 'Members see your name, signet, role, coordinates and field note. Your email is never shown. Messages are not end-to-end private: the Guild keepers can technically read the database.');
    const err = el('p', 'err'); if (notice) { err.textContent = notice; }
    const save = el('button', 'primary', 'Save the slip'); save.type = 'submit';
    wrap.append(note, el('p', 'row'), err); wrap.lastChild.previousSibling.append(save);
    wrap.addEventListener('submit', async (e) => {
      e.preventDefault(); err.className = 'err'; err.textContent = ''; save.disabled = true;
      try {
        const r = await api('profile', { method: 'POST', body: { display_name: nm.value, role: rl.value, location: lc.value, bio: bio.value, is_public: pub.checked, avatar_pixels: cells } });
        S.members.set(r.member.id, r.member); renderMe(); renderSide(); err.className = 'err ok'; err.textContent = 'Saved.';
      } catch (x) { err.textContent = x.message; }
      save.disabled = false;
    });
    pane.append(wrap); prev();
  }

  /* ---------- data refresh ---------- */
  async function refreshMembers() { const r = await api('members'); S.members = new Map(r.members.map((m) => [m.id, m])); renderMe(); renderSide(); }
  async function refreshThreads() { const r = await api('threads'); S.threads = r.threads; renderSide(); }
  async function pollView() {
    const box = $('.msgs'); if (!box) return;
    try {
      if (S.view.kind === 'room') { const r = await api('room', { params: { room: 'commons', since: S.last } }); if (r.messages.length) addMsgs(r.messages, box); }
      else if (S.view.kind === 'dm') { const id = S.view.id; const r = await api('dm', { params: { peer: id, since: S.last } }); if (S.view.id === id && r.messages.length) { addMsgs(r.messages, box); refreshThreads(); } }
    } catch (e) { /* transient */ }
  }
  let n = 0;
  function tick() {
    n++; pollView();
    if (n % 2 === 0) refreshThreads().catch(() => {});
    if (n % 10 === 0) refreshMembers().catch(() => {});
  }
  setInterval(() => { if (!document.hidden || n % 6 === 0) tick(); else n++; }, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  /* ---------- boot ---------- */
  $('#roomBtn').onclick = openRoom;
  $('#meBtn').onclick = () => openMe();
  $('#search').addEventListener('input', (e) => { S.q = e.target.value; renderSide(); });
  (async () => {
    try {
      const r = await api('boot');
      S.me = r.me; S.maxBody = r.max_body || 1000; S.members = new Map(r.members.map((m) => [m.id, m])); S.threads = r.threads; S.blocked = new Set(r.blocked);
      renderMe(); renderSide();
      const m = who(S.me);
      if (!hasInk(m.avatar)) openMe('Paint your 9×9 signet and save your slip before you speak.'); else { root.dataset.pane = matchMedia('(max-width:760px)').matches ? 'list' : 'main'; openRoom(); if (matchMedia('(max-width:760px)').matches) showList(); }
    } catch (e) { $('#pane').append(el('p', 'empty err', e.message)); }
  })();
})();
