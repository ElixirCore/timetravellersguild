/* narrative.js — the traveller's story so far.
   Include on a page for signed-in travellers:
     <script src="/assets/narrative.js?v=1" data-csrf="<people csrf token>" defer></script>
   Optional data-mount="#someElement" renders inline; otherwise a "Story so far" tab sits bottom-left.
   Reads and writes through /narrative/api.php. Beats are joined by THEREFORE or BUT, never "and then". */
(function () {
  'use strict';
  var me = document.currentScript;
  if (!me || window.__ttgNarrative) return;
  window.__ttgNarrative = true;
  var CSRF = me.getAttribute('data-csrf') || '';
  var MOUNT = me.getAttribute('data-mount') || '';
  var ACTS = { 1: 'Act I · the call', 2: 'Act II · the crossing', 3: 'Act III · the return' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var css = document.createElement('style');
  css.textContent = [
    '.ttg-story-tab{position:fixed;left:12px;bottom:12px;z-index:2147482000;background:#1b1a17;color:#f6efd8;border:2px solid #d9cb9e;font:700 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;padding:10px 12px;cursor:pointer}',
    '.ttg-story{background:#f6efd8;color:#1b1a17;border:2px solid #1b1a17;font:14px/1.5 Georgia,serif;padding:14px 16px;max-width:30rem}',
    '.ttg-story.floating{position:fixed;left:12px;bottom:56px;z-index:2147482000;max-height:70vh;overflow:auto;width:min(30rem,calc(100vw - 24px));box-shadow:0 10px 30px rgba(0,0,0,.35)}',
    '.ttg-story h2{font:700 12px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;margin:0 0 6px}',
    '.ttg-story .act{font:12px ui-monospace,Menlo,monospace;color:#6d6655;margin:0 0 10px}',
    '.ttg-story .premise{font-style:italic;margin:0 0 10px}',
    '.ttg-story ol{list-style:none;margin:0;padding:0}',
    '.ttg-story li{margin:0 0 10px;padding-left:0}',
    '.ttg-story .joint{display:block;font:700 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.18em;color:#b3261e;margin-bottom:3px}',
    '.ttg-story .joint.but{color:#1b5e8a}',
    '.ttg-story .meta{font:11px ui-monospace,Menlo,monospace;color:#6d6655}',
    '.ttg-story button.x{background:none;border:0;color:#6d6655;cursor:pointer;font:11px ui-monospace,Menlo,monospace;text-decoration:underline;padding:0;margin-left:6px}',
    '.ttg-story .threads{border-top:1px dashed #6d6655;margin-top:10px;padding-top:8px}',
    '.ttg-story form{display:flex;gap:6px;margin:0 0 10px}',
    '.ttg-story input{flex:1;font:13px Georgia,serif;padding:6px;border:1px solid #6d6655;background:#fffaf0}',
    '.ttg-story .kept{font:700 11px ui-monospace,Menlo,monospace;color:#2f7a4f;margin:0 0 10px}',
    '.ttg-story form button:disabled{opacity:.6}',
    '.ttg-story form button{font:700 11px ui-monospace,Menlo,monospace;background:#1b1a17;color:#f6efd8;border:0;padding:6px 10px;cursor:pointer}'
  ].join('');
  document.head.appendChild(css);

  function api(body) {
    return fetch('/narrative/api.php', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  var box = document.createElement('section');
  box.className = 'ttg-story';
  box.setAttribute('aria-label', 'Your story so far');
  var mountEl = MOUNT ? document.querySelector(MOUNT) : null;
  if (mountEl) {
    mountEl.appendChild(box);
  } else {
    box.classList.add('floating'); box.hidden = true;
    var tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'ttg-story-tab'; tab.textContent = 'Story so far';
    tab.setAttribute('aria-expanded', 'false');
    tab.addEventListener('click', function () {
      box.hidden = !box.hidden; tab.setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden) load();
    });
    document.body.append(tab, box);
  }

  var editing = false, flash = '';
  function render(s) {
    if (!s || !s.ok) {
      box.innerHTML = '<h2>Your story so far</h2><p>' + esc((s && s.error) || 'The story drawer did not answer.') + '</p>';
      return;
    }
    var h = '<h2>Your story so far</h2><p class="act">' + esc(ACTS[s.act] || ('Act ' + s.act)) + '</p>';
    if (s.premise && !editing) {
      h += '<p class="premise">Your story: ' + esc(s.premise) + ' <button type="button" class="x" data-edit="1">change</button>'
        + (flash ? ' <span class="kept" role="status">' + esc(flash) + '</span>' : '') + '</p>';
    } else {
      h += '<form data-f="premise"><input name="premise" maxlength="240" placeholder="What is your story about? (in your words)" value="' + esc(s.premise) + '" aria-label="What your story is about"><button type="submit">Keep</button></form>';
    }
    if (flash && (!s.premise || editing)) h += '<p class="kept" role="status">' + esc(flash) + '</p>';
    flash = '';
    if (!s.beats.length) {
      h += '<p>Nothing yet. Your story begins with the first thing you bring the Guild: a page in the ledger, something lodged on the map, a word with Jack.</p>';
    } else {
      h += '<ol>' + s.beats.map(function (b) {
        var j = b.joint === 'first' ? 'IT BEGINS' : b.joint.toUpperCase();
        return '<li><span class="joint ' + esc(b.joint) + '">' + esc(j) + '</span>' + esc(b.text)
          + (b.url ? ' <a href="' + esc(b.url) + '">see it</a>' : '')
          + '<br><span class="meta">' + esc(b.kind) + ' · ' + esc(b.source) + ' · ' + new Date(b.at * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span>'
          + '<button type="button" class="x" data-w="' + b.id + '" title="Take this beat out of your story">take out</button></li>';
      }).join('') + '</ol>';
    }
    if (s.threads.length) {
      h += '<div class="threads"><h2>Still open</h2><ol>' + s.threads.map(function (t) { return '<li>' + esc(t.text) + '</li>'; }).join('') + '</ol></div>';
    }
    box.innerHTML = h;
  }

  function load() { api({ op: 'story' }).then(render).catch(function () { render(null); }); }

  box.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, v = f.querySelector('input').value.trim(), b = f.querySelector('button');
    b.disabled = true; b.textContent = 'Keeping…';
    api({ op: 'premise', premise: v }).then(function (s) {
      editing = false;
      flash = s && s.ok ? (v ? 'Kept.' : 'Cleared.') : '';
      render(s);
    }).catch(function () {
      b.disabled = false; b.textContent = 'Keep';
      flash = 'Could not keep it: the story drawer did not answer. Try again.';
      var p = box.querySelector('.kept') || box.appendChild(document.createElement('p'));
      p.className = 'kept'; p.textContent = flash; flash = '';
    });
  });
  box.addEventListener('click', function (e) {
    if (e.target.closest('[data-edit]')) {
      editing = true; load();
      setTimeout(function () { var i = box.querySelector('input'); if (i) { i.focus(); i.select(); } }, 250);
      return;
    }
    var b = e.target.closest('[data-w]'); if (!b) return;
    if (!confirm('Take this beat out of your story? The story keeps going from the beat before it.')) return;
    api({ op: 'withdraw', id: +b.getAttribute('data-w') }).then(render);
  });

  if (mountEl) load();
  window.ttgStoryRefresh = load;
})();
