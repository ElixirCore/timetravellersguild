/* Full hopper catalogue. Faces are compiled. The dossier is a working slip. */
(function () {
  'use strict';

  var CARDS = window.TTG_DECK || [];
  var index = {};
  var order = [];
  var current = '';
  var dept = 'ALL';
  var query = '';

  CARDS.forEach(function (c, i) {
    index[c.id] = c;
    order[i] = c.id;
  });

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function visibleIds() {
    return order.filter(function (id) {
      var el = $('thumb-' + id);
      return el && !el.hidden;
    });
  }

  function applyFilter() {
    var n = 0;
    CARDS.forEach(function (c) {
      var el = $('thumb-' + c.id);
      if (!el) return;
      var okDept = dept === 'ALL' || c.dept === dept;
      var hay = el.getAttribute('data-q') || '';
      var okQ = !query || hay.indexOf(query) !== -1;
      el.hidden = !(okDept && okQ);
      if (!el.hidden) n += 1;
    });
    var count = $('count');
    if (count) count.textContent = n + ' SLIPS';
  }

  function render(card) {
    var box = $('dossierInner');
    if (!box || !card) return;
    var num = card.numerology || {};
    var corr = card.correspondence || {};
    var corrHtml = Object.keys(corr).map(function (k) {
      return '<div><dt>' + esc(k) + '</dt><dd>' + esc(corr[k]) + '</dd></div>';
    }).join('');
    var sym = (card.symbols || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    box.innerHTML =
      '<p class="dossier-kicker">' + esc(card.code) + '</p>' +
      '<div class="dossier-grid">' +
        '<figure>' + faceHtml(card) + '</figure>' +
        '<div class="dossier-copy">' +
          '<p class="inherited">' + esc(card.catalog) + ' · ' + esc(card.class) + '</p>' +
          '<h2>' + esc(card.compiled) + '</h2>' +
          '<section><h3>NUMEROLOGY</h3>' +
            '<p>' + esc(num.number) + ' · ' + esc(num.name) + ' · reduces to ' + esc(num.reduction) + ' · ' + esc(num.path) + '</p>' +
            '<p>' + esc(num.note) + '</p></section>' +
          '<section><h3>SYMBOLS</h3><ul>' + sym + '</ul></section>' +
          '<section><h3>CORRESPONDENCE</h3><dl>' + corrHtml + '</dl></section>' +
          '<section><h3>PSYCHOLOGICAL MESSAGE</h3><p>' + esc(card.psychology) + '</p></section>' +
          '<section><h3>FACE-DOWN</h3><p>' + esc(card.inverted) + '</p></section>' +
        '</div></div>';
  }

  function faceHtml(card) {
    if (card.has_face && card.face) {
      return '<img src="' + esc(card.face) + '" alt="' + esc(card.compiled) + '">';
    }
    return '<svg viewBox="0 0 360 600" class="ttg-card slip-face" role="img" aria-label="' + esc(card.compiled) + '">' +
      '<use href="#card-chassis"></use>' +
      '<text x="32" y="38" font-family="Courier New, Courier, monospace" font-size="13" font-weight="bold" fill="#161814">' + esc(card.roman) + '</text>' +
      '<text x="180" y="38" font-family="Courier New, Courier, monospace" font-size="10" text-anchor="middle" fill="#161814">' + esc(card.dept) + '</text>' +
      '<text x="328" y="38" font-family="Courier New, Courier, monospace" font-size="10" text-anchor="end" fill="#c41e3a">G0</text>' +
      '<use href="#' + esc(card.glyph || 'glyph-suit-record') + '"></use>' +
      '<text x="180" y="508" font-family="Courier New, Courier, monospace" font-size="13" text-anchor="middle" fill="#c41e3a">' + esc(card.compiled) + '</text>' +
      '<text x="180" y="530" font-family="Courier New, Courier, monospace" font-size="10" text-anchor="middle" fill="#7b8070">' + esc(card.catalog) + '</text>' +
      '</svg>';
  }

  function openCard(id, push) {
    var card = index[id];
    if (!card) return;
    current = id;
    render(card);
    var dlg = $('dossier');
    if (dlg && !dlg.open) dlg.showModal();
    document.title = 'JACK / TAROT · ' + card.compiled + ' — timetravellersguild.com';
    if (push !== false) {
      history.replaceState(null, '', card.href || ('/deck/' + id));
    }
  }

  function closeCard() {
    var dlg = $('dossier');
    if (dlg && dlg.open) dlg.close();
    current = '';
    document.title = 'JACK / TAROT · FULL HOPPER — timetravellersguild.com';
    history.replaceState(null, '', '/deck/');
  }

  function step(dir) {
    var ids = visibleIds();
    if (!ids.length) ids = order;
    var i = ids.indexOf(current);
    if (i < 0) i = 0;
    else i = (i + dir + ids.length) % ids.length;
    openCard(ids[i]);
  }

  function bind() {
    var grid = $('grid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var a = e.target.closest('a.thumb');
        if (!a) return;
        e.preventDefault();
        openCard(a.getAttribute('data-id'));
      });
    }
    document.querySelectorAll('#filters button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        dept = btn.getAttribute('data-dept') || 'ALL';
        document.querySelectorAll('#filters button').forEach(function (b) { b.classList.toggle('on', b === btn); });
        applyFilter();
      });
    });
    var find = $('find');
    if (find) {
      find.addEventListener('input', function () {
        query = String(find.value || '').trim().toLowerCase();
        applyFilter();
      });
    }
    if ($('closeDossier')) $('closeDossier').addEventListener('click', closeCard);
    if ($('prev')) $('prev').addEventListener('click', function () { step(-1); });
    if ($('next')) $('next').addEventListener('click', function () { step(1); });
    var dlg = $('dossier');
    if (dlg) {
      dlg.addEventListener('close', function () {
        if (current) {
          current = '';
          document.title = 'JACK / TAROT · FULL HOPPER — timetravellersguild.com';
          history.replaceState(null, '', '/deck/');
        }
      });
    }
    document.addEventListener('keydown', function (e) {
      if (!dlg || !dlg.open) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === 'Escape') closeCard();
    });
    var hash = (location.hash || '').replace(/^#/, '');
    var q = new URLSearchParams(location.search).get('card');
    var path = (location.pathname.match(/\/deck\/([a-z0-9]+-[a-z0-9]+)\/?$/) || [])[1] || '';
    var start = hash || q || path || '';
    if (start && index[start]) openCard(start, false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
