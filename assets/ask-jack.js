/* ask jack — one glyph on every page.
 * Bottom-right: a 9x9 pixel Jack (punchcard) that opens a small desk. Jack receives
 * the page and whatever you last clicked or selected.
 * Top-right: if you are signed in, your own 9x9 stamp from /join, linking to your profile.
 * Self-contained. Safe to load twice. Talks to /jack/glyph.php (csrf + who) and /now/jack. */
(function () {
  'use strict';
  if (window.__ttgAskJack) return;
  window.__ttgAskJack = true;

  var path = location.pathname.replace(/\/+$/, '') || '/';
  var onDesk = path === '/jack' || path.indexOf('/now/') === 0;

  /* Jack, 9x9, same cell format as the /join pixelgrid. c card, k ink, r red, . empty */
  var MAP = [
    'ccccccc..',
    'cccccccc.',
    'ckkccckkc',
    'ckkccckkc',
    'ccccccccc',
    'ckckckckc',
    'ccccccccc',
    'ccccccrcc',
    'ccccccccc'
  ];
  var COL = { c: '#d9cb9e', k: '#161814', r: '#c41e3a' };
  var jackCells = [];
  MAP.forEach(function (row) { row.split('').forEach(function (ch) { jackCells.push(COL[ch] || ''); }); });

  var css =
    '.ttgj-face{display:inline-grid;grid-template-columns:repeat(9,1fr);grid-template-rows:repeat(9,1fr);flex:none;image-rendering:pixelated;image-rendering:crisp-edges}' +
    '.ttgj-face i{display:block;min-width:0;min-height:0}' +
    '#ttgj-btn{position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;' +
    'background:#161814;color:#d9cb9e;border:2px solid #d9cb9e;border-radius:0;font:600 12px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:lowercase;cursor:pointer;box-shadow:3px 3px 0 rgba(0,0,0,.45)}' +
    '#ttgj-btn:hover,#ttgj-btn:focus-visible{background:#d9cb9e;color:#161814;outline:2px solid #c41e3a;outline-offset:2px}' +
    '#ttgj-btn .ttgj-face{width:27px;height:27px}' +
    '#ttgj-panel{position:fixed;right:14px;bottom:62px;z-index:2147483000;width:min(340px,calc(100vw - 28px));max-height:min(70vh,520px);display:none;flex-direction:column;' +
    'background:#161814;color:#e9e0c6;border:2px solid #d9cb9e;box-shadow:4px 4px 0 rgba(0,0,0,.5);font:14px/1.45 ui-monospace,Menlo,Consolas,monospace}' +
    '#ttgj-panel.open{display:flex}' +
    '#ttgj-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid #d9cb9e55;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#d9cb9e}' +
    '#ttgj-head button{background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:2px 6px}' +
    '#ttgj-sees{padding:6px 10px;font-size:11px;color:#d9cb9e99;border-bottom:1px dashed #d9cb9e33;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#ttgj-log{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px;min-height:60px}' +
    '#ttgj-log p{margin:0;white-space:pre-wrap;word-wrap:break-word}' +
    '#ttgj-log p.you{color:#d9cb9e99}' +
    '#ttgj-log p.jack{color:#e9e0c6}' +
    '#ttgj-log p.note{color:#c41e3a;font-size:12px}' +
    '#ttgj-form{display:flex;gap:6px;padding:8px;border-top:1px solid #d9cb9e55}' +
    '#ttgj-form input{flex:1;min-width:0;background:#0d0e0c;color:#e9e0c6;border:1px solid #d9cb9e88;padding:7px 8px;font:inherit;font-size:16px}' +
    '#ttgj-form button{background:#d9cb9e;color:#161814;border:0;padding:0 12px;font:600 12px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}' +
    '#ttgj-form button:disabled{opacity:.5;cursor:wait}' +
    '#ttgj-you{position:fixed;top:12px;right:12px;z-index:2147483000;display:block;line-height:0;color:#161814;background:#d9cb9e;border:2px solid #161814;box-shadow:2px 2px 0 rgba(0,0,0,.4)}' +
    '#ttgj-you .ttgj-face{width:44px;height:44px}' +
    '#ttgj-you:focus-visible{outline:2px solid #c41e3a;outline-offset:2px}' +
    'html.ttgj-has-you .you-dock{display:none !important}' +
    '@media (prefers-reduced-motion:no-preference){#ttgj-panel.open{animation:ttgj-in .12s ease-out}@keyframes ttgj-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}';

  var st = document.createElement('style');
  st.setAttribute('data-ttgj', '');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function face(cells) {
    var f = document.createElement('span');
    f.className = 'ttgj-face';
    f.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 81; i++) {
      var c = document.createElement('i');
      var hex = cells[i];
      if (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) c.style.background = hex;
      f.appendChild(c);
    }
    return f;
  }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ---------- context: what did you click on? ---------- */
  var ui = null; // our own nodes, ignored by the click tracker
  var touched = null;
  var lastSelection = '';

  function nearestHeading(node) {
    var n = node;
    while (n && n !== document.body) {
      var p = n.previousElementSibling;
      while (p) {
        if (/^H[1-6]$/.test(p.tagName)) return clip(p.textContent, 120);
        var h = p.querySelector && p.querySelector('h1,h2,h3,h4,h5,h6');
        if (h) return clip(h.textContent, 120);
        p = p.previousElementSibling;
      }
      n = n.parentElement;
      if (n && /^H[1-6]$/.test(n.tagName)) return clip(n.textContent, 120);
    }
    var h1 = document.querySelector('h1');
    return h1 ? clip(h1.textContent, 120) : '';
  }
  function describe(target) {
    var t = target && target.nodeType === 1 ? target : (target && target.parentElement);
    if (!t) return null;
    var hit = t.closest('a,button,[role=button],input,label,li,figure,img,canvas,svg,summary,td,th,p,h1,h2,h3,h4,h5,h6,section,article') || t;
    var d = { tag: hit.tagName.toLowerCase() };
    if (hit.id) d.id = clip(hit.id, 60);
    var aria = hit.getAttribute && (hit.getAttribute('aria-label') || hit.getAttribute('title') || hit.getAttribute('alt'));
    if (aria) d.label = clip(aria, 100);
    if (hit.tagName === 'A' && hit.getAttribute('href')) d.href = clip(hit.getAttribute('href'), 140);
    var isField = hit.tagName === 'INPUT' || hit.tagName === 'TEXTAREA' || hit.tagName === 'SELECT';
    if (!isField) d.text = clip(hit.innerText || hit.textContent, 220);
    d.under = nearestHeading(hit);
    return d;
  }
  document.addEventListener('click', function (e) {
    if (ui && ui.contains(e.target)) return;
    if (e.target.closest && e.target.closest('#ttgj-you,#ttgj-btn,#ttgj-panel')) return;
    touched = describe(e.target);
  }, true);
  document.addEventListener('selectionchange', function () {
    var s = window.getSelection && window.getSelection();
    var t = s ? String(s.toString()).trim() : '';
    if (t) lastSelection = clip(t, 300);
  });

  function contextText() {
    var h1 = document.querySelector('h1');
    var parts = ['page: ' + location.pathname + (location.search ? ' (query present)' : '')];
    if (document.title) parts.push('title: ' + clip(document.title, 100));
    if (h1) parts.push('heading: ' + clip(h1.textContent, 100));
    if (lastSelection) parts.push('selected: "' + lastSelection + '"');
    if (touched) {
      var bits = [touched.tag];
      if (touched.id) bits.push('#' + touched.id);
      if (touched.label) bits.push('label "' + touched.label + '"');
      if (touched.href) bits.push('-> ' + touched.href);
      if (touched.text) bits.push('text "' + touched.text + '"');
      if (touched.under) bits.push('under "' + touched.under + '"');
      parts.push('last clicked: ' + bits.join(' '));
    }
    return parts.join('\n');
  }
  function seesLabel() {
    if (lastSelection) return 'Jack sees: “' + clip(lastSelection, 50) + '”';
    if (touched && (touched.label || touched.text)) return 'Jack sees: ' + clip(touched.label || touched.text, 50);
    return 'Jack sees: ' + clip(document.title || location.pathname, 50);
  }

  /* ---------- bootstrap (csrf + who) ---------- */
  var boot = null;
  function ensureBoot(force) {
    if (boot && !force) return boot;
    boot = fetch('/jack/glyph.php', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('boot ' + r.status); return r.json(); })
      .then(function (j) { if (!j || !j.ok || !j.csrf) throw new Error('boot'); return j; });
    boot.catch(function () { boot = null; });
    return boot;
  }

  /* ---------- top-right: your stamp ---------- */
  function mountYou(you) {
    if (!you || !you.known || !you.avatar || you.avatar.length !== 81) return;
    if (document.getElementById('ttgj-you')) return;
    var a = el('a', { id: 'ttgj-you', href: you.href || '/people/profile/', 'aria-label': 'You' + (you.first ? ' — ' + you.first : '') + ' (profile)', title: you.first || 'You' });
    a.appendChild(face(you.avatar));
    document.body.appendChild(a);
    document.documentElement.classList.add('ttgj-has-you');
  }

  /* ---------- the glyph + desk ---------- */
  var turns = [];
  var busy = false;

  function build() {
    var btn = el('button', { id: 'ttgj-btn', type: 'button', 'aria-label': 'Ask Jack', 'aria-expanded': 'false', 'aria-controls': 'ttgj-panel' });
    btn.appendChild(face(jackCells));
    btn.appendChild(el('span', null, 'ask jack'));

    var panel = el('div', { id: 'ttgj-panel', role: 'dialog', 'aria-label': 'Ask Jack' });
    var head = el('div', { id: 'ttgj-head' });
    head.appendChild(el('span', null, 'Jack · clerk'));
    var x = el('button', { type: 'button', 'aria-label': 'Close' }, '×');
    head.appendChild(x);
    var sees = el('div', { id: 'ttgj-sees' });
    var log = el('div', { id: 'ttgj-log', 'aria-live': 'polite' });
    var form = el('form', { id: 'ttgj-form', autocomplete: 'off' });
    var input = el('input', { type: 'text', name: 'q', maxlength: '500', placeholder: 'Ask about this…', 'aria-label': 'Your question for Jack' });
    var go = el('button', { type: 'submit' }, 'Ask');
    form.appendChild(input); form.appendChild(go);
    panel.appendChild(head); panel.appendChild(sees); panel.appendChild(log); panel.appendChild(form);
    document.body.appendChild(panel);
    document.body.appendChild(btn);
    ui = panel;

    function say(cls, text) {
      log.appendChild(el('p', { 'class': cls }, text));
      log.scrollTop = log.scrollHeight;
    }
    function open() {
      sees.textContent = seesLabel();
      panel.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      ensureBoot();
      setTimeout(function () { input.focus(); }, 0);
    }
    function close() {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
    btn.addEventListener('mousedown', function () {
      // opening the panel must not wipe the selection Jack is meant to see
      var s = window.getSelection && window.getSelection();
      if (s && String(s.toString()).trim()) lastSelection = clip(s.toString(), 300);
    });
    btn.addEventListener('click', function () { panel.classList.contains('open') ? close() : open(); });
    x.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) close();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q || busy) return;
      busy = true; go.disabled = true;
      input.value = '';
      say('you', q);
      var focus = contextText();
      var thread = turns.slice(-6).join('\n');
      if (thread.length > 1400) thread = thread.slice(-1400);

      function send(j) {
        var body = new URLSearchParams();
        body.set('csrf', j.csrf);
        body.set('q', q);
        body.set('intent', 'ask');
        body.set('site', 'page');
        body.set('stance', '');
        body.set('focus', focus);
        body.set('thread', thread);
        return fetch('/now/jack', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString()
        });
      }
      ensureBoot().then(function (j) {
        return send(j).then(function (r) {
          if (r.status === 400 || r.status === 403) { // stale csrf: refresh once
            return ensureBoot(true).then(send);
          }
          return r;
        });
      }).then(function (r) { return r.json(); })
        .then(function (data) {
          var text = data && typeof data.text === 'string' ? data.text.trim() : '';
          if (data && data.ok === false && !text) text = (data.error || 'The desk is closed.');
          if (!text) text = '…';
          say(data && data.ok === false ? 'note' : 'jack', text);
          turns.push('visitor: ' + clip(q, 200), 'jack: ' + clip(text, 300));
        })
        .catch(function () { say('note', 'Jack cannot be reached from here just now.'); })
        .then(function () { busy = false; go.disabled = false; input.focus(); });
    });
  }

  function init() {
    if (!document.body) return;
    if (!onDesk) build();
    ensureBoot().then(function (j) { mountYou(j.you); }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
