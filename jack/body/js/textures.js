/* IBM 5081 card stock and desk-photograph textures. Drawn locally; no keys. */
(function (J) {
  'use strict';

  var PAPER = '#f1e4c4';
  var PAPER2 = '#e6d3a8';
  var NAVY = '#1e3a5f';
  var SCARLET = '#c41e3a';
  var INK = '#1a2438';
  var GOLD = '#c9a227';

  var photos = {};
  var cards = {};

  var HOLLERITH = {
    A: [12, 1], B: [12, 2], C: [12, 3], D: [12, 4], E: [12, 5], F: [12, 6], G: [12, 7], H: [12, 8], I: [12, 9],
    J: [11, 1], K: [11, 2], L: [11, 3], M: [11, 4], N: [11, 5], O: [11, 6], P: [11, 7], Q: [11, 8], R: [11, 9],
    S: [0, 2], T: [0, 3], U: [0, 4], V: [0, 5], W: [0, 6], X: [0, 7], Y: [0, 8], Z: [0, 9],
    '0': [0], '1': [1], '2': [2], '3': [3], '4': [4], '5': [5], '6': [6], '7': [7], '8': [8], '9': [9],
    ' ': []
  };
  var ROWS = [12, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function grain(ctx, w, h) {
    var n = Math.floor(w * h / 28);
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30,58,95,0.045)' : 'rgba(196,30,58,0.03)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
    }
  }

  function punchText(text) {
    return String(text || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').slice(0, 40);
  }

  function drawStock(ctx, w, h) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(201,162,39,0.12)';
    ctx.fillRect(0, 0, w, 8);
    var x;
    for (x = 0; x < w; x += 18) {
      ctx.fillStyle = 'rgba(30,58,95,0.06)';
      ctx.fillRect(x, 0, 1, h);
    }
    for (x = 0; x < w; x += 72) {
      ctx.fillStyle = 'rgba(30,58,95,0.14)';
      ctx.fillRect(x, 0, 1, h);
    }
    grain(ctx, w, h);
  }

  function drawHollerith(ctx, w, h, text, opts) {
    opts = opts || {};
    drawStock(ctx, w, h);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(28, 0);
    ctx.lineTo(0, 28);
    ctx.closePath();
    ctx.fillStyle = NAVY;
    ctx.fill();

    ctx.fillStyle = SCARLET;
    ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = PAPER;
    ctx.font = '600 13px "Courier New", monospace';
    ctx.fillText(opts.band || 'IBM 5081 · 80 COL', 36, 22);

    var body = punchText(text);
    var cols = Math.min(40, Math.max(12, body.length + 2));
    var left = 36;
    var top = 52;
    var cw = (w - left - 12) / cols;
    var rh = (h - top - 28) / ROWS.length;
    var i, r, ch, holes, ri;

    ctx.fillStyle = NAVY;
    ctx.font = '9px "Courier New", monospace';
    for (i = 0; i < cols; i++) {
      if ((i + 1) % 10 === 0) ctx.fillText(String(i + 1), left + i * cw, 46);
    }
    for (r = 0; r < ROWS.length; r++) {
      ctx.strokeStyle = 'rgba(30,58,95,0.18)';
      ctx.beginPath();
      ctx.moveTo(left, top + r * rh + rh / 2);
      ctx.lineTo(w - 10, top + r * rh + rh / 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,58,95,0.55)';
      ctx.fillText(String(ROWS[r]), 8, top + r * rh + rh * 0.7);
    }
    for (i = 0; i < cols; i++) {
      ch = body.charAt(i) || ' ';
      holes = HOLLERITH[ch] || [];
      for (ri = 0; ri < holes.length; ri++) {
        r = ROWS.indexOf(holes[ri]);
        if (r < 0) continue;
        ctx.beginPath();
        ctx.ellipse(left + i * cw + cw / 2, top + r * rh + rh / 2, Math.max(2.2, cw * 0.28), Math.max(2.4, rh * 0.28), 0, 0, Math.PI * 2);
        ctx.fillStyle = NAVY;
        ctx.fill();
      }
    }
    ctx.fillStyle = SCARLET;
    ctx.font = '600 16px "Courier New", monospace';
    ctx.fillText((opts.label || text || '').slice(0, 28), 36, h - 10);
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  function makeCard(label, text, band) {
    var c = canvas(640, 400);
    drawHollerith(c.getContext('2d'), 640, 400, text || label, { label: label, band: band });
    return c;
  }

  function makeJackCard() {
    var c = canvas(420, 560);
    var ctx = c.getContext('2d');
    drawStock(ctx, 420, 560);
    ctx.fillStyle = SCARLET;
    ctx.fillRect(0, 0, 420, 48);
    ctx.fillStyle = PAPER;
    ctx.font = '600 16px "Courier New", monospace';
    ctx.fillText('IBM 5081 · CLERK', 36, 30);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(26, 0); ctx.lineTo(0, 26); ctx.closePath();
    ctx.fillStyle = NAVY;
    ctx.fill();
    /* paper spirit: a small punched figure */
    ctx.fillStyle = PAPER2;
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(168, 86, 84, 70);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('JACK', 186, 126);
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = NAVY;
    ctx.beginPath();
    ctx.rect(150, 164, 120, 210);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = SCARLET;
    ctx.fillRect(150, 164, 120, 22);
    ctx.fillStyle = PAPER;
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('DUTY', 188, 179);
    var holes = [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];
    for (var i = 0; i < holes.length; i++) {
      if (!holes[i]) continue;
      ctx.fillStyle = NAVY;
      ctx.fillRect(168 + (i % 4) * 22, 202 + Math.floor(i / 4) * 28, 12, 8);
    }
    ctx.fillStyle = INK;
    ctx.font = '600 18px "Courier New", monospace';
    ctx.fillText('JACK / CLERK', 118, 420);
    ctx.fillStyle = NAVY;
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('SMALL PAPER SPIRIT', 112, 444);
    ctx.fillText('HE DOES NOT WRITE CANON', 96, 468);
    ctx.strokeStyle = GOLD;
    ctx.strokeRect(78, 490, 264, 36);
    ctx.fillStyle = GOLD;
    ctx.font = '600 12px "Courier New", monospace';
    ctx.fillText('AT THE DESK · SOURCE UNTOUCHED', 86, 512);
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 417, 557);
    return c;
  }

  function makeScreen(deskImg) {
    var c = canvas(720, 420);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#1a2438';
    ctx.fillRect(0, 0, 720, 420);
    if (deskImg) {
      ctx.drawImage(deskImg, 18, 18, 684, 384);
      ctx.fillStyle = 'rgba(30,90,40,0.18)';
      ctx.fillRect(18, 18, 684, 384);
    } else {
      drawHollerith(ctx, 720, 420, 'JACK CLERK HOLLERITH DESK 1951', { label: 'SCREEN', band: 'CRT · DESK FEED' });
    }
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 710, 410);
    ctx.fillStyle = SCARLET;
    ctx.fillRect(18, 18, 684, 22);
    ctx.fillStyle = PAPER;
    ctx.font = '600 12px "Courier New", monospace';
    ctx.fillText('SCREEN · LIVE DESK PHOTOGRAPH · NOT THE FIELD', 28, 34);
    return c;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function boot() {
    return loadImage('img/desk.jpg').then(function (desk) {
      if (desk) photos.desk = desk;
      cards.stock = canvas(256, 256);
      drawStock(cards.stock.getContext('2d'), 256, 256);
      cards.jack = makeJackCard();
      cards.screen = makeScreen(desk);
      cards.desk = canvas(640, 400);
      if (desk) {
        var dctx = cards.desk.getContext('2d');
        drawStock(dctx, 640, 400);
        dctx.drawImage(desk, 24, 48, 592, 320);
        dctx.fillStyle = SCARLET;
        dctx.fillRect(0, 0, 640, 36);
        dctx.fillStyle = PAPER;
        dctx.font = '600 14px "Courier New", monospace';
        dctx.fillText('HOLLERITH DESK · PHOTOGRAPH', 36, 24);
        dctx.strokeStyle = NAVY;
        dctx.lineWidth = 3;
        dctx.strokeRect(1.5, 1.5, 637, 397);
      } else {
        drawHollerith(cards.desk.getContext('2d'), 640, 400, 'HOLLERITH DESK 1951', { label: 'DESK', band: 'IBM 5081' });
      }
      var faces = {
        'obj-jack-clerk': cards.jack,
        'obj-screen': cards.screen,
        'obj-desk': makeCard('HOLLERITH DESK', 'HOLLERITH DESK IBM 5081 ONE CARD AT A TIME', 'STATION'),
        'obj-keypunch': makeCard('KEYPUNCH', 'KEYPUNCH EIGHTY COLUMNS SOURCE UNTOUCHED', 'INSTRUMENT'),
        'obj-boxes': makeCard('BOXES 0001 1000', 'A THOUSAND BOXES HE WRITES ONE CARD SLOWLY', 'STORE'),
        'obj-bench': makeCard('WORKING BENCH', 'WORKING BENCH CASE TABLE SOURCE UNTOUCHED', 'BENCH')
      };
      Object.keys(faces).forEach(function (id) { cards[id] = faces[id]; });
      cards.default = makeCard('UNCLASSIFIED', 'UNCLASSIFIED SLIP', 'IBM 5081');
      return cards;
    });
  }

  function faceFor(obj) {
    if (!obj) return cards.default;
    if (cards[obj.id]) return cards[obj.id];
    if (!cards[obj.id]) {
      cards[obj.id] = makeCard(obj.label, obj.label + ' ' + ((obj.metadata && obj.metadata.note) || ''), (obj.type || 'SLIP').toUpperCase());
    }
    return cards[obj.id];
  }

  J.Textures = {
    boot: boot,
    faceFor: faceFor,
    card: function (name) { return cards[name]; },
    photo: function (name) { return photos[name]; }
  };
})(window.Jack = window.Jack || {});
