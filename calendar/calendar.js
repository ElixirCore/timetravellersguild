/* CALENDAR — the diary beside the tree.
   now.js runs in view mode underneath; this file answers its pick/focus hooks
   with context in the right panel, and lets diary rows fly the tree to their leaf. */
(function () {
  'use strict';
  var C = window.TTG_CAL || { events: {}, titles: {}, focus: '' };
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('cal');
  var ctx = $('calContext');

  // now.js claims every wheel turn for the wood; let the panels scroll.
  [panel, ctx].forEach(function (el) {
    if (el) el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
  });

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function field(slug) {
    return window.TTG_FIELD && TTG_FIELD.nodeBySlug ? TTG_FIELD.nodeBySlug(slug) : null;
  }
  function typeLabel(t) {
    return String(t || 'UNKNOWN').replace(/_/g, ' ');
  }
  function when(n) {
    if (n && n.observed_at) {
      var d = new Date(Date.parse(n.observed_at));
      if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return n && n.year ? String(n.year) : 'undated';
  }
  function linksOf(slug) {
    var G = window.TTG_GRAPH || {};
    var out = [];
    (G.edges || []).forEach(function (e) {
      if (!e) return;
      if (e.source === slug) out.push({ slug: e.target, via: e.relationship });
      else if (e.target === slug) out.push({ slug: e.source, via: e.relationship });
    });
    return out;
  }
  function diaryFor(slug) {
    var out = [];
    Object.keys(C.events).forEach(function (k) {
      if ((C.events[k].links || []).indexOf(slug) >= 0) out.push(C.events[k]);
    });
    return out;
  }
  function mark(slug) {
    document.querySelectorAll('[data-slug].is-on').forEach(function (x) { x.classList.remove('is-on'); });
    if (slug) document.querySelectorAll('[data-slug="' + slug + '"]').forEach(function (x) { x.classList.add('is-on'); });
  }

  function paint(node) {
    if (!node || !ctx) return;
    var ev = C.events[node.slug];
    var body = $('cxBody');
    $('cxKicker').textContent = ev ? 'CONTEXT · YOUR DIARY' : 'CONTEXT · ' + typeLabel(node.type) + (node.pending ? ' · PENDING' : '');
    $('cxTitle').textContent = node.title || node.slug;
    $('cxMeta').textContent = ev
      ? ev.when + (ev.place ? ' · ' + ev.place : '')
      : [node.status || '', when(node), node.place || 'unplaced'].filter(Boolean).join(' · ');
    body.replaceChildren();
    var text = ev ? (ev.note || '') : String(node.body || '').replace(/\s+/g, ' ').trim();
    if (text) body.appendChild(el('p', 'cx-body', text));

    var links = linksOf(node.slug).filter(function (l) { return l.via !== 'FOLLOWED_BY'; }).slice(0, 6);
    if (links.length) {
      body.appendChild(el('p', 'cx-sub', ev ? 'CONCERNS' : 'IN THE TREE'));
      var ul = el('ul', 'cx-links');
      links.forEach(function (l) {
        var other = field(l.slug);
        var li = el('li');
        var b = el('button', 'cx-hop', (other && other.title) || C.titles[l.slug] || l.slug);
        b.type = 'button';
        b.addEventListener('click', function () { focus(l.slug); });
        if (!ev) li.appendChild(el('span', 'via', String(l.via || 'related').replace(/_/g, ' ').toLowerCase()));
        li.appendChild(b);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }
    if (!ev) {
      var mine = diaryFor(node.slug);
      if (mine.length) {
        body.appendChild(el('p', 'cx-sub', 'IN YOUR DIARY THIS MONTH'));
        var ol = el('ul', 'cx-links');
        mine.forEach(function (m) {
          var li = el('li');
          var a = el('a', null, m.title);
          a.href = m.href;
          li.appendChild(el('span', 'via', m.when));
          li.appendChild(a);
          ol.appendChild(li);
        });
        body.appendChild(ol);
      }
      if (node.href && !/^#/.test(node.href)) {
        var open = el('a', 'cal-btn small', 'OPEN THE NODE');
        open.href = node.href;
        body.appendChild(open);
      }
    } else {
      var amend = el('a', 'cal-btn small', 'AMEND');
      amend.href = ev.href.replace('#', '&e=' + ev.id + '#').replace(/#e\d+$/, '#slip');
      body.appendChild(amend);
    }
    mark(node.slug);
  }

  function focus(slug) {
    var n = field(slug);
    if (!n) return;
    if (window.TTG_FIELD && TTG_FIELD.focusSlug) TTG_FIELD.focusSlug(slug);
    paint(n);
  }

  window.TTG_VIEW_ON_PICK = function (node) { paint(node); };
  window.TTG_VIEW_ON_FOCUS = function () {};
  window.TTG_VIEW_ON_MISS = function () {};

  document.querySelectorAll('.cal-focus').forEach(function (b) {
    b.addEventListener('click', function () { focus(b.getAttribute('data-slug')); });
  });

  // All-day swaps the time fields for a date.
  var allDay = $('allDay');
  function syncAllDay() {
    if (!allDay) return;
    document.querySelectorAll('.when-time').forEach(function (x) { x.hidden = allDay.checked; });
    document.querySelectorAll('.when-date').forEach(function (x) { x.hidden = !allDay.checked; });
  }
  if (allDay) { allDay.addEventListener('change', syncAllDay); syncAllDay(); }

  // Land on the entry named in the address, else the first entry of the chosen day.
  function boot() {
    var m = /^#e(\d+)$/.exec(location.hash);
    var slug = m ? 'cal-' + m[1] : (C.focus || '');
    if (!slug) {
      var first = document.querySelector('.cal-list [data-slug]');
      if (first) slug = first.getAttribute('data-slug');
    }
    if (slug) setTimeout(function () { focus(slug); }, 900);
  }
  if (document.readyState === 'complete') boot();
  else addEventListener('load', boot);
})();
