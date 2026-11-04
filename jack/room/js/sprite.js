/* Jack as an 8-bit shapeshifting desk-dog. Nearest-neighbour, no assets. */
(function (J) {
  'use strict';

  var W = 16;
  var H = 16;
  var PAL = {
    '.': null,
    k: '#1a2438',
    t: '#d2a86a',
    d: '#8a6234',
    p: '#f1e4c4',
    s: '#c41e3a',
    n: '#1e3a5f',
    w: '#fff6e4',
    e: '#1a2438',
    g: '#c9a227',
    c: '#efe0b4',
    m: '#6a4a28'
  };

  /* Each key is a form. Values are one or more 16-line frames. */
  var FORMS = {
    sit: [
      [
        '....k....k....',
        '...kdk..kdk...',
        '....kttttk....',
        '...ktwttwtk...',
        '...ktekktek...',
        '...kttttttk...',
        '....kddddk....',
        '....kssssk....',
        '...ktttgttk...',
        '...kttttttk...',
        '...kttttttk...',
        '....kttttk....',
        '....kk..kk....',
        '...ktk..ktk...',
        '...kk....kk...',
        '..............'
      ],
      [
        '....k....k....',
        '...kdk..kdk...',
        '....kttttk....',
        '...ktwttwtk...',
        '...ktkkkktk...',
        '...kttttttk...',
        '....kddddk....',
        '....kssssk....',
        '...ktttgttk...',
        '...kttttttk...',
        '...kttttttk...',
        '....kttttk....',
        '....kk..kk....',
        '...ktk..ktk...',
        '...kk....kk...',
        '..............'
      ]
    ],
    punch: [
      [
        '....k....k....',
        '...kdk..kdk...',
        '....kttttk....',
        '...ktwttwtk...',
        '...ktekktek...',
        '...kttttttk...',
        '....kddddk....',
        '....kssssk....',
        '...ktttgttk...',
        '...kttttkckc..',
        '...ktttkcccc..',
        '....kttkckck..',
        '....kk.kk.....',
        '...ktk........',
        '...kk.........',
        '..............'
      ]
    ],
    sniff: [
      [
        '..k....k......',
        '.kdk..kdk.....',
        '..kttttk......',
        '.ktwttwtk.....',
        '.ktekktek.....',
        '.kttttttkk....',
        '..kddddk.k....',
        '..kssssk......',
        '.ktttgttk.....',
        '.kttttttk.....',
        '.kttttk.......',
        '..kttk.kk.....',
        '..kk..ktk.....',
        '.ktk...kk.....',
        '.kk...........',
        '..............'
      ]
    ],
    trot: [
      [
        '..k....k......',
        '.kdk..kdk.....',
        '..kttttk......',
        '.ktwttwtk.....',
        '.ktekktek.....',
        '.kttttttk.....',
        '..kssssk......',
        '.ktttgttk.....',
        '.kttttttk.....',
        '..kttttk......',
        '..kk.kk.......',
        '.ktk.ktk......',
        '.kk...kk......',
        '..............',
        '..............',
        '..............'
      ],
      [
        '..k....k......',
        '.kdk..kdk.....',
        '..kttttk......',
        '.ktwttwtk.....',
        '.ktekktek.....',
        '.kttttttk.....',
        '..kssssk......',
        '.ktttgttk.....',
        '.kttttttk.....',
        '..kttttk......',
        '.kk...kk......',
        'ktk...ktk.....',
        'kk.....kk.....',
        '..............',
        '..............',
        '..............'
      ]
    ],
    speak: [
      [
        '....k....k....',
        '...kdk..kdk...',
        '....kttttk....',
        '...ktwttwtk...',
        '...ktekktek...',
        '...ktttwwtk...',
        '....kddkdk....',
        '....kssssk....',
        '...ktttgttk...',
        '...kttttttk...',
        '...kttttttk...',
        '....kttttk....',
        '....kk..kk....',
        '...ktk..ktk...',
        '...kk....kk...',
        '..............'
      ]
    ],
    card: [
      [
        '....k....k....',
        '...kdk..kdk...',
        '....kttttk....',
        '...ktwttwtk...',
        '...ktekktek...',
        '...kttccccc...',
        '....kdcccck...',
        '....kssssk....',
        '...ktttgttk...',
        '...kttttttk...',
        '...kttttttk...',
        '....kttttk....',
        '....kk..kk....',
        '...ktk..ktk...',
        '...kk....kk...',
        '..............'
      ]
    ],
    deal: [
      [
        '....k....k....',
        '...kdk..kdk...',
        '....kttttk....',
        '...ktwttwtk...',
        '...ktekktek...',
        '...ktttccccc..',
        '....kdcccck...',
        '....kssssk....',
        '...ktttgttk...',
        '...kttttttk...',
        '...kttttttk...',
        '....kttttk....',
        '....kk..kk....',
        '...ktk..ktk...',
        '...kk....kk...',
        '..............'
      ],
      [
        '.....k....k...',
        '....kdk..kdk..',
        '.....kttttk...',
        '....ktwttwtk..',
        '....ktekktek..',
        '....ktttcccccc',
        '.....kdcccck..',
        '.....kssssk...',
        '....ktttgttk..',
        '....kttkccccc.',
        '....kttk......',
        '.....ktk.kk...',
        '.....kk.ktk...',
        '....ktk..kk...',
        '....kk........',
        '..............'
      ],
      [
        '....k....k....',
        '...kdk..kdk...',
        '....kttttk....',
        '...ktwttwtk...',
        '...ktekktek...',
        '...kttttttk...',
        '....kddddk....',
        '....kssssk....',
        '...ktttgttk...',
        '...kttttkckc..',
        '...ktttkc.....',
        '....kttk......',
        '....kk.kk.....',
        '...ktk........',
        '...kk.........',
        '..............'
      ]
    ],
    fox: [
      [
        '..k......k....',
        '.kdk....kdk...',
        '..kdkkkkdk....',
        '...ktwtwtk....',
        '...kteetek....',
        '...ktttttk....',
        '....kdddk.....',
        '....knnnk.....',
        '...ktttgtk....',
        '...ktttttk....',
        '....ktttk.....',
        '....kk.kk.....',
        '...ktk.ktk....',
        '...kk...kk....',
        '..............',
        '..............'
      ]
    ],
    paper: [
      [
        '....k....k....',
        '...kpk..kpk...',
        '....kppppk....',
        '...kpwppwpk...',
        '...kpekkepek..',
        '...kppppppk...',
        '....kppppk....',
        '....kssssk....',
        '...kpppgnnk...',
        '...kppppppk...',
        '...kppppppk...',
        '....kppppk....',
        '....kk..kk....',
        '...kpk..kpk...',
        '...kk....kk...',
        '..............'
      ]
    ],
    curl: [
      [
        '..............',
        '..............',
        '....k....k....',
        '...kdk..kdk...',
        '....kttttk....',
        '...ktwttwtk...',
        '...ktekktek...',
        '..kkttttttk...',
        '.kttkddddk....',
        '.kttkssssk....',
        '..kttttgtk....',
        '...kttttk.....',
        '....kkkk......',
        '..............',
        '..............',
        '..............'
      ]
    ],
    bristle: [
      [
        '..k.k..k.k....',
        '.kmdk..kdmk...',
        '..kmmmmmk.....',
        '...kmwmwmk....',
        '...kmekemk....',
        '...kmmmmmk....',
        '....kdddk.....',
        '....ksssk.....',
        '...kmmmgnk....',
        '...kmmmmmk....',
        '...kmmmmk.....',
        '....kk.kk.....',
        '...kmk.kmk....',
        '...kk...kk....',
        '..............',
        '..............'
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
  var morph = 1;
  var frame = 0;
  var blinkAt = 0;
  var punchUntil = 0;
  var dealUntil = 0;
  var dealPhase = 0;
  var lastFormAt = 0;

  function padRow(row) {
    var s = String(row || '');
    if (s.length > W) return s.slice(0, W);
    var pad = W - s.length;
    var left = Math.floor(pad / 2);
    var i;
    var out = '';
    for (i = 0; i < left; i++) out += '.';
    out += s;
    while (out.length < W) out += '.';
    return out;
  }

  function framesFor(name) {
    return FORMS[name] || FORMS.sit;
  }

  function pixel(form, fi, x, y) {
    var frames = framesFor(form);
    var map = frames[fi % frames.length];
    var row = padRow(map[y] || '');
    return row.charAt(x) || '.';
  }

  function paint(form, fi, blendFrom, blendT) {
    sctx.clearRect(0, 0, W, H);
    var x, y, ch, col;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        ch = pixel(form, fi, x, y);
        if (blendFrom && blendT < 1) {
          var useOld = ((x * 7 + y * 13) % 10) / 10 > blendT;
          if (useOld) ch = pixel(blendFrom, 0, x, y);
        }
        col = PAL[ch];
        if (!col) continue;
        sctx.fillStyle = col;
        sctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function liveState(st) {
    if (st) return st;
    if (J.State && typeof J.State.get === 'function') return J.State.get();
    return { context: { phase: 'SENSE' }, body: { pressure: 0 } };
  }

  function poseFromState(st, t) {
    st = liveState(st);
    var phase = (st.context && st.context.phase) || 'SENSE';
    var mode = st.context && st.context.mode;
    var pressure = st.body ? st.body.pressure : 0;
    if (mode === 'BENCH') return 'curl';
    if (t < dealUntil) return 'deal';
    if (t < punchUntil) return 'punch';
    if (phase === 'VOICE') return 'speak';
    if (phase === 'CARD' || (st.context && st.context.activeCard && phase === 'WRITE')) return 'card';
    if (phase === 'OPERATE') return 'fox';
    if (phase === 'INSPECT' || phase === 'REACH') return 'sniff';
    if (phase === 'MOVE') return 'trot';
    if (st.context && st.context.history) {
      var last = st.context.history[st.context.history.length - 1];
      if (last && last.operation === 'anamnesia' && last.createdAt) {
        var age = (Date.now() - Date.parse(last.createdAt)) / 1000;
        if (age >= 0 && age < 3) return 'paper';
      }
    }
    if (pressure > 0.62) return 'bristle';
    return 'sit';
  }

  function setForm(name) {
    if (!FORMS[name]) name = 'sit';
    if (name === current) return;
    previous = current;
    current = name;
    morph = 0;
    lastFormAt = performance.now() / 1000;
  }

  function tick(t, st) {
    st = liveState(st);
    var want = poseFromState(st, t);
    if (want === 'sit' && Math.floor(t * 2) % 17 === 0) {
      /* idle punch every so often */
      if (t - lastFormAt > 4.5) punchUntil = t + 0.55;
    }
    setForm(want);
    morph = Math.min(1, morph + 0.08);
    var frames = framesFor(current);
    if (current === 'sit') {
      frame = (t - blinkAt < 0.16) ? 1 : 0;
      if (t > blinkAt + 2.8 + (t % 3)) blinkAt = t;
    } else if (current === 'trot') {
      frame = Math.floor(t * 8) % frames.length;
    } else if (current === 'deal') {
      frame = Math.floor(t * 8 + dealPhase) % frames.length;
    } else {
      frame = Math.min(frame, frames.length - 1);
    }
    paint(current, frame, morph < 1 ? previous : null, morph);
    if (portrait) {
      var pctx = portrait.getContext('2d');
      pctx.imageSmoothingEnabled = false;
      pctx.clearRect(0, 0, portrait.width, portrait.height);
      pctx.drawImage(sheet, 0, 0, W, H, 0, 0, portrait.width, portrait.height);
    }
  }

  function draw(ctx, x, y, scale, flip, selected) {
    if (!ctx || scale <= 0) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }
    var dw = W * scale;
    var dh = H * scale;
    ctx.drawImage(sheet, 0, 0, W, H, x - dw / 2, y - dh, dw, dh);
    if (selected) {
      ctx.strokeStyle = '#c41e3a';
      ctx.lineWidth = Math.max(1, scale * 0.35);
      ctx.strokeRect(x - dw / 2 - 2, y - dh - 2, dw + 4, dh + 4);
    }
    ctx.restore();
  }

  function drawInWorld(ctx, project, o, selected, t) {
    if (!o) return;
    var bob = Math.sin((t || 0) * 3.1) * 0.015;
    var feet = project(o.x, (o.y || 0) + bob, o.z);
    var crown = project(o.x, (o.y || 0) + (o.h || 0.7) + bob, o.z);
    if (!feet || !crown) return;
    var pxH = Math.abs(feet.y - crown.y);
    var scale = Math.max(1.2, pxH / H);
    var st = J.State.get();
    var dx = st.body.position.x - o.x;
    var dz = st.body.position.z - o.z;
    var toCam = Math.atan2(dx, dz);
    var flip = Math.sin(toCam - st.body.yaw) > 0.15;
    draw(ctx, feet.x, feet.y, scale, flip, selected);
    if (crown.z < 12) {
      ctx.save();
      ctx.font = '600 ' + Math.max(9, Math.min(15, 220 / crown.z)) + 'px "Courier New", monospace';
      ctx.fillStyle = selected ? '#c41e3a' : '#1e3a5f';
      ctx.textAlign = 'center';
      ctx.fillText('JACK', feet.x, crown.y - 6);
      ctx.restore();
    }
  }

  function attachPortrait(el) {
    portrait = el;
    if (portrait) {
      portrait.width = 96;
      portrait.height = 96;
      portrait.setAttribute('aria-label', 'Jack, a small shapeshifting desk-dog');
    }
  }

  J.Sprite = {
    tick: tick,
    draw: draw,
    drawInWorld: drawInWorld,
    attachPortrait: attachPortrait,
    setForm: setForm,
    form: function () { return current; },
    sheet: function () { return sheet; },
    punch: function (t) { punchUntil = (t || performance.now() / 1000) + 0.6; setForm('punch'); },
    deal: function (n, t) {
      t = t || performance.now() / 1000;
      n = Math.max(1, n || 1);
      dealPhase = 0;
      dealUntil = t + n * 0.42 + 0.45;
      setForm('deal');
    },
    dealBeat: function (t) {
      t = t || performance.now() / 1000;
      dealPhase += 1;
      dealUntil = Math.max(dealUntil, t + 0.48);
      previous = current === 'deal' ? 'punch' : current;
      current = 'deal';
      morph = 0.2;
    }
  };
})(window.Jack = window.Jack || {});
