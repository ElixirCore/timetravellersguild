/* HUB console — cog faces, disc teeth, hash routes */
(function () {
  'use strict';
  var disc = document.getElementById('disc');
  var teeth = document.getElementById('teeth');
  var nav = document.getElementById('faceNav');
  if (!nav) return;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tabs = Array.prototype.slice.call(nav.querySelectorAll('[data-face]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.face[data-face]'));
  var n = Math.max(tabs.length, 1);
  var index = 0;

  if (teeth) {
    var count = 24;
    for (var i = 0; i < count; i++) {
      var t = document.createElement('i');
      var ang = (i / count) * 360;
      t.style.transform = 'rotate(' + ang + 'deg) translateY(-48%)';
      teeth.appendChild(t);
    }
  }

  function findIndex(id) {
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].getAttribute('data-face') === id) return i;
    }
    return 0;
  }

  function select(i, pushHash) {
    index = ((i % n) + n) % n;
    var face = tabs[index].getAttribute('data-face');
    tabs.forEach(function (btn, bi) {
      btn.setAttribute('aria-selected', bi === index ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      var on = panel.getAttribute('data-face') === face;
      panel.classList.toggle('is-active', on);
      if (on) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
    if (disc) {
      disc.classList.add('is-held');
      var turn = (index / n) * -72;
      disc.style.transform = 'rotate(' + turn + 'deg)';
      if (!reduce) {
        clearTimeout(select._hold);
        select._hold = setTimeout(function () {
          disc.classList.remove('is-held');
          disc.style.transform = '';
        }, 1400);
      }
    }
    if (pushHash !== false) {
      try {
        history.replaceState(null, '', '#' + face);
      } catch (e) {}
    }
  }

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      select(Number(btn.getAttribute('data-index') || 0));
      var panel = document.getElementById('panel-' + btn.getAttribute('data-face'));
      if (panel && window.matchMedia('(max-width:899px)').matches) {
        panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });

  addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      select(index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(index - 1);
    }
  });

  var hash = (location.hash || '').replace(/^#/, '');
  if (hash) select(findIndex(hash), false);
  else select(0, false);

  addEventListener('hashchange', function () {
    var h = (location.hash || '').replace(/^#/, '');
    if (h) select(findIndex(h), false);
  });
})();
