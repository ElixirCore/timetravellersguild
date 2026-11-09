/* HUB · Modes face — Jack runs the console.
   Reads /hub/api/modes.php (canon only), walks the five slots in turn, types a
   ticker of what he finds. Any touch pauses him; he resumes after a while.
   Only runs while the Modes face is showing and the tab is visible. */
(function () {
  'use strict';
  var root = document.getElementById('modesLive');
  var panel = document.getElementById('panel-modes');
  if (!root || !panel || !window.fetch) return;

  var stage = document.getElementById('mlStage');
  var tape = document.getElementById('mlTape');
  var postureEl = document.getElementById('mlPosture');
  var toggle = document.getElementById('mlToggle');
  var slots = Array.prototype.slice.call(panel.querySelectorAll('.slot'));
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP = reduce ? 12000 : 7000;
  var REST = 20000;

  var data = null, steps = [], at = 0, timer = 0, typing = 0;
  var stopped = false, restUntil = 0;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(card) {
    var a = el('a', 'ml-node');
    a.href = card.href;
    a.appendChild(el('span', 'n', card.title));
    a.appendChild(el('span', 'p', card.type + (card.year ? ' · ' + card.year : '') + ' · ' + card.layer.toUpperCase()));
    return a;
  }
  function filingLine(card) {
    var f = card && card.filing;
    return f ? f.voice + ': ' + f.text : '';
  }

  function build(d) {
    var s = [];
    var nw = d.now;
    s.push({ slot: 0, label: 'NOW', render: function () {
      var g = el('p', 'ml-counts');
      [['canon', nw.canon], ['edges', nw.edges], ['pending', nw.pending]].forEach(function (c) {
        var b = el('span', 'ml-count');
        b.appendChild(el('b', null, String(c[1])));
        b.appendChild(document.createTextNode(' ' + c[0]));
        g.appendChild(b);
      });
      var frag = [g];
      if (nw.newest) { frag.push(el('p', 'ml-cap', 'Newest canon')); frag.push(link(nw.newest)); }
      return frag;
    }, tape: 'NOW · ' + nw.canon + ' canon · ' + nw.edges + ' edges · ' + nw.pending + ' pending' + (nw.newest ? ' · newest: ' + nw.newest.title : '') + '. The wood is settled.' });

    d.projections.forEach(function (p) {
      if (!p.node) return;
      s.push({ slot: 1, label: p.name, render: function () {
        return [el('p', 'ml-cap', p.name + ' · ' + p.line), link(p.node)];
      }, tape: p.name + ' · ' + p.node.title + (filingLine(p.node) ? ' — ' + filingLine(p.node) : '') });
    });
    if (d.pattern.length) {
      s.push({ slot: 1, label: 'PATTERN', scarlet: true, render: function () {
        var ul = el('ul', 'ml-pattern');
        var max = d.pattern[0].count;
        d.pattern.forEach(function (r) {
          var li = el('li');
          li.appendChild(el('span', 'r', r.rel));
          var bar = el('i');
          bar.style.width = Math.max(6, Math.round(r.count / max * 100)) + '%';
          li.appendChild(bar);
          li.appendChild(el('b', null, String(r.count)));
          ul.appendChild(li);
        });
        return [el('p', 'ml-cap', 'PATTERN · relationship types that recur'), ul];
      }, tape: 'PATTERN · ' + d.pattern.map(function (r) { return r.rel + ' ×' + r.count; }).join(' · ') + '. Recurrence lit; the rest stays dim.' });
    }
    d.tour.slice(0, 3).forEach(function (c, i) {
      s.push({ slot: 2, label: 'VIEW', render: function () {
        var out = [el('p', 'ml-cap', 'VIEW · orbit stop ' + (i + 1) + ' of 3'), link(c)];
        if (c.filing) {
          var q = el('blockquote', 'ml-filing ' + c.filing.class.replace(/[^A-Z_]/g, ''));
          q.appendChild(el('p', null, c.filing.text));
          q.appendChild(el('footer', null, c.filing.voice + ' · ' + c.filing.class.replace(/_/g, ' ')));
          out.push(q);
        }
        return out;
      }, tape: 'VIEW · ' + c.title + (filingLine(c) ? ' — ' + filingLine(c) : '') });
    });
    s.push({ slot: 3, label: 'POSTURE', render: function () {
      var ul = el('ul', 'ml-postures');
      d.jack.postures.forEach(function (p) {
        var li = el('li', p === d.jack.posture ? 'on' : '', p.replace(/_/g, ' '));
        ul.appendChild(li);
      });
      return [el('p', 'ml-cap', 'Jack’s posture toward you, at ' + d.local), ul];
    }, tape: 'JACK · ' + d.jack.line + (d.jack.known ? '' : ' Sign in and he turns clerk.') });
    s.push({ slot: 4, label: 'BOOT', render: function () {
      var ul = el('ul', 'ml-layers');
      var L = d.boot.layers, max = 1;
      Object.keys(L).forEach(function (k) { max = Math.max(max, L[k]); });
      Object.keys(L).forEach(function (k) {
        var li = el('li');
        li.appendChild(el('span', 'r', k));
        var bar = el('i');
        bar.style.width = Math.max(4, Math.round(L[k] / max * 100)) + '%';
        li.appendChild(bar);
        li.appendChild(el('b', null, String(L[k])));
        ul.appendChild(li);
      });
      return [el('p', 'ml-cap', 'BOOT · the wood loading its own geometry'), ul];
    }, tape: 'BOOT · ' + Object.keys(d.boot.layers).map(function (k) { return k + ' ' + d.boot.layers[k]; }).join(' · ') + '. Mode changed. Scene did not.' });
    return s;
  }

  function type(text) {
    clearInterval(typing);
    if (reduce) { tape.textContent = text; return; }
    var i = 0;
    tape.textContent = '';
    typing = setInterval(function () {
      i += 2;
      tape.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(typing);
    }, 28);
  }

  function show(i) {
    var st = steps[i];
    if (!st) return;
    slots.forEach(function (sl, si) { sl.classList.toggle('is-running', si === st.slot); });
    root.classList.toggle('scarlet', !!st.scarlet);
    stage.replaceChildren.apply(stage, st.render());
    stage.setAttribute('data-label', st.label);
    type(st.tape);
  }

  function visible() {
    return !panel.hidden && document.visibilityState !== 'hidden';
  }

  function setState(label) {
    root.setAttribute('data-state', label);
    toggle.textContent = stopped ? 'RUN' : 'PAUSE';
    toggle.setAttribute('aria-pressed', stopped ? 'true' : 'false');
  }

  function tick() {
    clearTimeout(timer);
    timer = setTimeout(tick, STEP);
    if (stopped || !steps.length || !visible()) return;
    if (Date.now() < restUntil) { setState('resting'); return; }
    setState('running');
    at = (at + 1) % steps.length;
    if (at === 0) load();
    show(at);
  }

  function load() {
    fetch('/hub/api/modes.php', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok) return;
        var first = !data;
        data = d;
        steps = build(d);
        postureEl.textContent = d.jack.posture.replace(/_/g, ' ').toUpperCase();
        if (first) {
          root.hidden = false;
          at = 0;
          show(0);
          setState('running');
          timer = setTimeout(tick, STEP);
        }
      })
      .catch(function () {});
  }

  // A visitor's hand on the console: Jack steps back for a while.
  ['pointerdown', 'focusin', 'keydown', 'wheel'].forEach(function (ev) {
    panel.addEventListener(ev, function (e) {
      if (e.target === toggle) return;
      restUntil = Date.now() + REST;
      setState('resting');
    }, { passive: true });
  });
  toggle.addEventListener('click', function () {
    stopped = !stopped;
    restUntil = 0;
    setState(stopped ? 'stopped' : 'running');
    if (!stopped) tick();
  });

  load();
})();
