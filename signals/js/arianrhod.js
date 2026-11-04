/* Arianrhod. 9×9 spider icon for SIGNALS. Nearest-neighbour, no assets. */
(function (A) {
  'use strict';

  var W = 9;
  var H = 9;
  var PAL = {
    '.': null,
    k: '#1e3a5f',
    y: '#f2d322',
    g: '#c9a227',
    s: '#c41e3a',
    w: '#fff6e4'
  };

  var FORMS = {
    sit: [
      [
        'k...k...k',
        '.k.k.k.k.',
        '..kyyyk..',
        '.kyyyyyk.',
        'kyywywyyk',
        '.kyyyyyk.',
        'k.kyyyk.k',
        '.k.k.k.k.',
        'k...k...k'
      ],
      [
        'k...k...k',
        '.k.k.k.k.',
        '..kyyyk..',
        '.kyyyyyk.',
        'kyykykyyk',
        '.kyyyyyk.',
        'k.kyyyk.k',
        '.k.k.k.k.',
        'k...k...k'
      ]
    ],
    listen: [
      [
        'k.k...k.k',
        '.k.k.k.k.',
        'k.kyyyk.k',
        '.kyyyyyk.',
        'kyywywyyk',
        '.kyyyyyk.',
        'k.kyyyk.k',
        '.k.k.k.k.',
        'k.k...k.k'
      ],
      [
        '.k.k.k.k.',
        'k.k...k.k',
        '..kyyyk..',
        '.kyyyyyk.',
        'kyywywyyk',
        '.kyyyyyk.',
        '..kyyyk..',
        'k.k...k.k',
        '.k.k.k.k.'
      ]
    ],
    reel: [
      [
        '..k.k.k..',
        'k.kyyyk.k',
        '.kygggyk.',
        'kygwywgyk',
        '.kygggyk.',
        'k.kyyyk.k',
        '..k.k.k..',
        '.k.....k.',
        'k.......k'
      ],
      [
        'k.......k',
        '.k.k.k.k.',
        '..kyyyk..',
        '.kygggyk.',
        'kygwywgyk',
        '.kygggyk.',
        '..kyyyk..',
        '.k.k.k.k.',
        'k.......k'
      ]
    ]
  };

  var sheet = document.createElement('canvas');
  sheet.width = W;
  sheet.height = H;
  var sctx = sheet.getContext('2d');
  var portrait = null;
  var current = 'sit';
  var previous = 'sit';
  var frame = 0;
  var morph = 1;
  var blinkAt = 0;
  var listenUntil = 0;
  var reelUntil = 0;

  function paintForm(name, fi, alpha) {
    var rows = (FORMS[name] || FORMS.sit)[fi] || FORMS.sit[0];
    var x, y, ch, col;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        ch = (rows[y] || '').charAt(x) || '.';
        col = PAL[ch];
        if (!col) continue;
        sctx.globalAlpha = alpha;
        sctx.fillStyle = col;
        sctx.fillRect(x, y, 1, 1);
      }
    }
    sctx.globalAlpha = 1;
  }

  function paint(name, fi, from, k) {
    sctx.clearRect(0, 0, W, H);
    if (from && k < 1) paintForm(from, 0, 1 - k);
    paintForm(name, fi, from && k < 1 ? k : 1);
  }

  function setForm(name) {
    if (!FORMS[name]) name = 'sit';
    if (name === current) return;
    previous = current;
    current = name;
    morph = 0;
  }

  function tick(t) {
    var now = t || performance.now() / 1000;
    var want = 'sit';
    if (now < reelUntil) want = 'reel';
    else if (now < listenUntil) want = 'listen';
    setForm(want);
    morph = Math.min(1, morph + 0.1);
    var frames = FORMS[current];
    if (current === 'sit') {
      frame = (now - blinkAt < 0.14) ? 1 : 0;
      if (now > blinkAt + 2.6) blinkAt = now;
    } else {
      frame = Math.floor(now * 6) % frames.length;
    }
    paint(current, frame, morph < 1 ? previous : null, morph);
    if (portrait) {
      var pctx = portrait.getContext('2d');
      var pw = portrait.width;
      var ph = portrait.height;
      pctx.imageSmoothingEnabled = false;
      pctx.clearRect(0, 0, pw, ph);
      pctx.fillStyle = '#f2d322';
      pctx.fillRect(0, 0, pw, ph);
      pctx.drawImage(sheet, 0, 0, W, H, 0, 0, pw, ph);
    }
  }

  function attachPortrait(el) {
    portrait = el;
    if (portrait) {
      portrait.width = 96;
      portrait.height = 96;
      portrait.setAttribute('aria-label', 'Arianrhod, the spider of the signals plane');
    }
  }

  A.Sprite = {
    tick: tick,
    attachPortrait: attachPortrait,
    setForm: setForm,
    form: function () { return current; },
    sit: function () { listenUntil = 0; reelUntil = 0; setForm('sit'); },
    listen: function (t) {
      t = t || performance.now() / 1000;
      listenUntil = t + 1.4;
      setForm('listen');
    },
    reel: function (t) {
      t = t || performance.now() / 1000;
      reelUntil = t + 0.9;
      setForm('reel');
    }
  };
})(window.Arianrhod = window.Arianrhod || {});
