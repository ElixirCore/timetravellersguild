/* The join hopper. Jack holds the slip. He does not write canon. */
(function () {
  'use strict';

  var SWATCHES = [
    '#d9cb9e', '#cfc19a', '#efe6c8', '#f1e4c4', '#c4b58c', '#e8dcc0',
    '#ffffff', '#e8eef0', '#b8c0c8', '#7b8070', '#4a4e45', '#161814', '#000000',
    '#1e3a5f', '#0051ba', '#00e5ff', '#638b94', '#87ceeb', '#2f4f4f',
    '#009e60', '#228b22', '#3a4a1a', '#c9a227', '#ffd500', '#ffa500',
    '#ff5800', '#c46a1e', '#b2533e', '#c41e3a', '#b90000', '#dc143c',
    '#ff2d95', '#ff69b4', '#e8b4a8', '#4a0080', '#8b4513', '#6a5330'
  ];

  function $(id) { return document.getElementById(id); }

  function setFormLine(text) {
    var el = $('jackForm');
    if (el) el.textContent = text;
  }

  function pose(form) {
    var Spr = window.Jack && window.Jack.Sprite;
    if (!Spr) return;
    if (form === 'punch' && Spr.punch) Spr.punch();
    else if (form === 'deal' && Spr.deal) Spr.deal(2);
    else if (Spr.setForm) Spr.setForm(form);
  }

  function buildStampEditor() {
    var grid = $('stampGrid');
    var colorEl = $('stampColor');
    var hidden = $('avatarPixels');
    var swatches = $('stampSwatches');
    if (!grid || !hidden || !colorEl) return;

    var cells = [];
    try {
      var parsed = JSON.parse(hidden.value || '[]');
      if (Array.isArray(parsed) && parsed.length === 81) cells = parsed;
    } catch (err) {}
    while (cells.length < 81) cells.push('');
    cells = cells.slice(0, 81);

    var paint = colorEl.value || '#1e3a5f';
    var drawing = false;
    var sampling = false;
    var buttons = [];

    function syncHidden() {
      hidden.value = JSON.stringify(cells);
    }

    function cellColor(hex) {
      return hex || '#d9cb9e';
    }

    function applyAt(index) {
      if (index < 0 || index >= 81) return;
      if (sampling) {
        paint = cells[index] || '#1e3a5f';
        colorEl.value = paint || '#d9cb9e';
        sampling = false;
        if ($('stampPick')) $('stampPick').classList.remove('on');
        markSwatch(paint);
        return;
      }
      cells[index] = paint;
      if (buttons[index]) buttons[index].style.background = cellColor(cells[index]);
      syncHidden();
    }

    function markSwatch(hex) {
      if (!swatches) return;
      Array.prototype.forEach.call(swatches.querySelectorAll('button'), function (button) {
        var active = (hex && button.style.background && button.style.background.toLowerCase() === hex.toLowerCase()) || (!hex && button.classList.contains('erase'));
        button.classList.toggle('on', active);
      });
    }

    var i;
    for (i = 0; i < 81; i++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', 'Stamp cell ' + (i + 1));
      button.dataset.index = String(i);
      button.style.background = cellColor(cells[i]);
      button.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        drawing = true;
        var index = Number(this.dataset.index);
        applyAt(index);
      });
      button.addEventListener('pointerenter', function () {
        if (!drawing) return;
        var index = Number(this.dataset.index);
        applyAt(index);
      });
      buttons.push(button);
      grid.appendChild(button);
    }

    if (swatches) {
      SWATCHES.forEach(function (hex) {
        var swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'swatch';
        swatch.style.background = hex;
        swatch.title = hex;
        swatch.addEventListener('click', function () {
          paint = hex;
          colorEl.value = hex;
          markSwatch(hex);
        });
        swatches.appendChild(swatch);
      });

      var erase = document.createElement('button');
      erase.type = 'button';
      erase.className = 'swatch erase';
      erase.title = 'Erase to paper';
      erase.addEventListener('click', function () {
        paint = '#d9cb9e';
        colorEl.value = '#d9cb9e';
        markSwatch('');
      });
      swatches.appendChild(erase);
    }

    colorEl.addEventListener('input', function () {
      paint = colorEl.value;
      markSwatch(paint);
    });

    if ($('stampPick')) {
      $('stampPick').addEventListener('click', function () {
        sampling = !sampling;
        this.classList.toggle('on', sampling);
      });
    }
    if ($('stampFill')) {
      $('stampFill').addEventListener('click', function () {
        for (var i = 0; i < 81; i++) {
          cells[i] = paint;
          if (buttons[i]) buttons[i].style.background = cellColor(cells[i]);
        }
        syncHidden();
      });
    }
    if ($('stampClear')) {
      $('stampClear').addEventListener('click', function () {
        for (var i = 0; i < 81; i++) {
          cells[i] = '';
          if (buttons[i]) buttons[i].style.background = '#d9cb9e';
        }
        syncHidden();
      });
    }

    grid.addEventListener('pointerup', function () {
      drawing = false;
    });
    grid.addEventListener('pointerleave', function () {
      drawing = false;
    });
    markSwatch(paint);
    syncHidden();
  }

  function bindJack() {
    var Spr = window.Jack && window.Jack.Sprite;
    var pet = $('jackPet');
    if (!Spr || !pet) return;
    Spr.attachPortrait(pet);
    pose('sit');
    (function loop(now) {
      var t = now / 1000;
      Spr.tick(t, {
        context: { phase: 'HOPPER' },
        body: { pressure: 0.1 }
      });
      requestAnimationFrame(loop);
    }(performance.now()));
  }

  function bindForm() {
    var form = $('joinForm');
    var status = $('status');
    var submit = $('joinSubmit');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submit) submit.disabled = true;
      pose('punch');
      setFormLine('PUNCHING THE SLIP');
      if (status) status.textContent = 'The clerk is punching the coordinates.';
      var body = {
        csrf: (form.csrf && form.csrf.value) || '',
        name: (form.name && form.name.value) || '',
        email: (form.email && form.email.value) || '',
        location: (form.location && form.location.value) || '',
        mode: (form.mode && form.mode.value) || 'arrival',
        avatar_pixels: (form.avatarPixels && form.avatarPixels.value) || '[]'
      };
      fetch('/join/act.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok && data && data.ok, data: data || {} };
        });
      }).then(function (out) {
        if (!out.ok) {
          pose('sit');
          setFormLine('THE HOPPER HELD THE SLIP BACK');
          if (status) status.textContent = out.data.error || 'The slip was not accepted.';
          if (submit) submit.disabled = false;
          return;
        }
        pose('deal');
        setFormLine('COORDINATES HELD · NOT CANON');
        if (status) {
          var first = out.data.first ? String(out.data.first) : 'Arrival';
          status.textContent = first + ' is on the hopper. The clerk will hold the coordinates. This is not canon.';
        }
        form.reset();
        if (form.avatarPixels) form.avatarPixels.value = '[]';
        if (submit) submit.disabled = false;
      }).catch(function () {
        pose('sit');
        setFormLine('THE HOPPER IS JAMMED');
        if (status) status.textContent = 'The hopper could not be reached. Try the register.';
        if (submit) submit.disabled = false;
      });
    });
  }

  function bind() {
    buildStampEditor();
    bindJack();
    bindForm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
