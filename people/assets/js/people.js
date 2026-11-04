/* Punch your own slip. The 9×9 is the face shared rooms will read. */
(function () {
  'use strict';

  var PAPER = '#d9cb9e';
  /* Full stamp palette — Guild stock, cube faces, field inks, room colours */
  var SWATCHES = [
    '#d9cb9e', '#cfc19a', '#efe6c8', '#f1e4c4', '#c4b58c', '#e8dcc0',
    '#ffffff', '#e8eef0', '#b8c0c8', '#7b8070', '#4a4e45', '#161814', '#000000',
    '#1e3a5f', '#0051ba', '#00e5ff', '#638b94', '#87ceeb', '#2f4f4f',
    '#009e60', '#228b22', '#3a4a1a', '#c9a227', '#ffd500', '#ffa500',
    '#ff5800', '#c46a1e', '#b2533e', '#c41e3a', '#b90000', '#dc143c',
    '#ff2d95', '#ff69b4', '#e8b4a8', '#4a0080', '#8b4513', '#6a5330'
  ];
  var HOLLERITH = {
    A: [12, 1], B: [12, 2], C: [12, 3], D: [12, 4], E: [12, 5], F: [12, 6], G: [12, 7], H: [12, 8], I: [12, 9],
    J: [11, 1], K: [11, 2], L: [11, 3], M: [11, 4], N: [11, 5], O: [11, 6], P: [11, 7], Q: [11, 8], R: [11, 9],
    S: [0, 2], T: [0, 3], U: [0, 4], V: [0, 5], W: [0, 6], X: [0, 7], Y: [0, 8], Z: [0, 9],
    '0': [0], '1': [1], '2': [2], '3': [3], '4': [4], '5': [5], '6': [6], '7': [7], '8': [8], '9': [9],
    ' ': []
  };
  var ROWS = [12, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  function $(id) { return document.getElementById(id); }

  function parsePixels(raw) {
    var cells = [];
    var i;
    for (i = 0; i < 81; i++) cells.push('');
    try {
      var data = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
      if (!Array.isArray(data) || data.length !== 81) return cells;
      for (i = 0; i < 81; i++) {
        var hex = String(data[i] || '').trim().toLowerCase();
        cells[i] = /^#[0-9a-f]{6}$/.test(hex) ? hex : '';
      }
    } catch (e) {}
    return cells;
  }

  function cellColor(hex) {
    return hex || PAPER;
  }

  function paintCanvas(canvas, cells, scale) {
    if (!canvas) return;
    scale = scale || 8;
    canvas.width = 9 * scale;
    canvas.height = 9 * scale;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var i, x, y;
    for (i = 0; i < 81; i++) {
      x = i % 9;
      y = Math.floor(i / 9);
      ctx.fillStyle = cellColor(cells[i]);
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  window.TTG_PIXELS = { parse: parsePixels, paint: paintCanvas };

  function bindFilter() {
    var input = $('filter');
    var grid = $('peopleGrid');
    if (!input || !grid) return;
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      grid.querySelectorAll('.person').forEach(function (card) {
        card.hidden = q !== '' && (card.dataset.search || '').indexOf(q) === -1;
      });
    });
  }

  function punchText(text) {
    return String(text || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').slice(0, 16);
  }

  function drawPunch() {
    var mount = $('punchPreview');
    var name = $('display_name');
    if (!mount || !name) return;
    var body = punchText(name.value);
    var cols = Math.max(8, body.length);
    var html = '<span></span>';
    var c, r, ch, holes;
    for (c = 0; c < cols; c++) html += '<span>' + (c + 1) + '</span>';
    for (r = 0; r < ROWS.length; r++) {
      html += '<span class="row-lab">' + ROWS[r] + '</span>';
      for (c = 0; c < cols; c++) {
        ch = body.charAt(c) || ' ';
        holes = HOLLERITH[ch] || [];
        html += '<i class="' + (holes.indexOf(ROWS[r]) >= 0 ? 'on' : '') + '"></i>';
      }
    }
    mount.style.gridTemplateColumns = 'auto repeat(' + cols + ',minmax(0,1fr))';
    mount.innerHTML = html;
  }

  function bindEditor() {
    var grid = $('pxGrid');
    var hidden = $('avatarPixels');
    var colorEl = $('pxColor');
    var swatchBox = $('pxSwatches');
    if (!grid || !hidden || !colorEl) return;

    var cells = parsePixels(hidden.value);
    var paint = colorEl.value || '#1e3a5f';
    var drawing = false;
    var sampling = false;
    var buttons = [];

    function setCell(i, hex) {
      cells[i] = hex;
      if (buttons[i]) buttons[i].style.background = cellColor(hex);
      hidden.value = JSON.stringify(cells);
    }

    function applyAt(i) {
      if (i < 0 || i > 80) return;
      if (sampling) {
        paint = cells[i] || '';
        colorEl.value = paint || PAPER;
        sampling = false;
        if ($('pxPick')) $('pxPick').classList.remove('on');
        markSwatch(paint);
        return;
      }
      setCell(i, paint);
    }

    var i;
    for (i = 0; i < 81; i++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('aria-label', 'Pixel ' + (i + 1));
      btn.dataset.i = String(i);
      btn.style.background = cellColor(cells[i]);
      grid.appendChild(btn);
      buttons[i] = btn;
    }

    if (swatchBox) {
      SWATCHES.forEach(function (hex) {
        var s = document.createElement('button');
        s.type = 'button';
        s.className = 'swatch';
        s.style.background = hex;
        s.title = hex;
        s.setAttribute('aria-label', 'Colour ' + hex);
        s.addEventListener('click', function () {
          paint = hex;
          colorEl.value = hex;
          markSwatch(hex);
        });
        swatchBox.appendChild(s);
      });
      var erase = document.createElement('button');
      erase.type = 'button';
      erase.className = 'swatch erase';
      erase.title = 'Erase to paper';
      erase.setAttribute('aria-label', 'Erase to paper');
      erase.addEventListener('click', function () {
        paint = '';
        colorEl.value = PAPER;
        markSwatch('');
      });
      swatchBox.appendChild(erase);
    }

    function markSwatch(hex) {
      if (!swatchBox) return;
      Array.prototype.forEach.call(swatchBox.querySelectorAll('button'), function (b) {
        var on = (hex === '' && b.classList.contains('erase')) ||
          (hex !== '' && (b.style.background || '').toLowerCase() === hex.toLowerCase());
        b.classList.toggle('on', on);
      });
    }
    markSwatch(paint);

    colorEl.addEventListener('input', function () {
      paint = colorEl.value;
      markSwatch(paint);
    });

    grid.addEventListener('pointerdown', function (e) {
      var t = e.target.closest('button');
      if (!t || !grid.contains(t)) return;
      e.preventDefault();
      drawing = true;
      try { grid.setPointerCapture(e.pointerId); } catch (err) {}
      applyAt(parseInt(t.dataset.i, 10));
    });
    grid.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var t = document.elementFromPoint(e.clientX, e.clientY);
      t = t && t.closest ? t.closest('#pxGrid button') : null;
      if (t) applyAt(parseInt(t.dataset.i, 10));
    });
    grid.addEventListener('pointerup', function () { drawing = false; });
    grid.addEventListener('pointercancel', function () { drawing = false; });

    if ($('pxPick')) {
      $('pxPick').addEventListener('click', function () {
        sampling = !sampling;
        $('pxPick').classList.toggle('on', sampling);
      });
    }
    if ($('pxFill')) {
      $('pxFill').addEventListener('click', function () {
        var n;
        for (n = 0; n < 81; n++) setCell(n, paint);
      });
    }
    if ($('pxClear')) {
      $('pxClear').addEventListener('click', function () {
        var n;
        for (n = 0; n < 81; n++) setCell(n, '');
      });
    }
    if ($('display_name')) {
      $('display_name').addEventListener('input', drawPunch);
      drawPunch();
    }
  }

  bindFilter();
  bindEditor();
})();
