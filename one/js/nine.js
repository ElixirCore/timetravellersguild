/* 9-bit clerk modules. One bit up from Jack’s 8-bit desk-dog. Nearest-neighbour, no assets. */
(function (global) {
  'use strict';

  var W = 18;
  var H = 18;
  var PAL = {
    '.': null,
    k: '#1a2438',
    t: '#d2a86a',
    d: '#8a6234',
    p: '#f1e4c4',
    s: '#c41e3a',
    n: '#1e3a5f',
    w: '#fff6e4',
    e: '#111214',
    g: '#c9a227',
    c: '#efe0b4',
    y: '#FFD500',
    o: '#FF6A00',
    b: '#0051BA',
    v: '#009E60'
  };

  var FORMS = {
    'SIGN SLIP': [
      [
        'eeeeeeeeeeeeeeeeee',
        'e................e',
        'e..pppppppppppp..e',
        'e..pkkkkkkkkkkp..e',
        'e..pk........kp..e',
        'e..pk.ssss...kp..e',
        'e..pk.s..s...kp..e',
        'e..pk.ssss...kp..e',
        'e..pk........kp..e',
        'e..pppppppppppp..e',
        'e......gg........e',
        'e.....gggg.......e',
        'e....ggssgg......e',
        'e.....gggg.......e',
        'e......gg........e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ],
      [
        'eeeeeeeeeeeeeeeeee',
        'e................e',
        'e..pppppppppppp..e',
        'e..pkkkkkkkkkkp..e',
        'e..pk........kp..e',
        'e..pk.ssss...kp..e',
        'e..pk.ssss...kp..e',
        'e..pk.ssss...kp..e',
        'e..pk........kp..e',
        'e..pppppppppppp..e',
        'e................e',
        'e......gg........e',
        'e.....gggg.......e',
        'e....ggssgg......e',
        'e................e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ]
    ],
    'OPEN DRAWER': [
      [
        'eeeeeeeeeeeeeeeeee',
        'e.dddddddddddddd.e',
        'e.d............d.e',
        'e.d.nnnnnnnnnn.d.e',
        'e.d.n........n.d.e',
        'e.d.nnnnnnnnnn.d.e',
        'e.d.gg.........d.e',
        'e.d.nnnnnnnnnn.d.e',
        'e.d.n........n.d.e',
        'e.d.nnnnnnnnnn.d.e',
        'e.d............d.e',
        'e.dddddddddddddd.e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ],
      [
        'eeeeeeeeeeeeeeeeee',
        'e.dddddddddddddd.e',
        'e.d............d.e',
        'e.d.nnnnnnnnnn.d.e',
        'e.d.n........n.d.e',
        'e.d.nnnnnnnnnn.d.e',
        'e.d............d.e',
        'e.d.ppppppppppppp.',
        'e.d.pkkkkkkkkkkkp.',
        'e.d.p..........kp.',
        'e.d.ppppppppppppp.',
        'e.dddddddddddddd.e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ]
    ],
    'SEARCH FIELD': [
      [
        'eeeeeeeeeeeeeeeeee',
        'eyyyyy.oooo.bbbb.e',
        'ey.y.y.o.o.b.b.b.e',
        'eyyyyy.oooo.bbbb.e',
        'e................e',
        'eyyyyy.oooo.bbbb.e',
        'ey.y.y.o.o.b.b.b.e',
        'eyyyyy.oooo.bbbb.e',
        'e................e',
        'eyyyyy.oooo.bbbb.e',
        'ey.y.y.o.o.b.b.b.e',
        'eyyyyy.oooo.bbbb.e',
        'e................e',
        'e......wwww......e',
        'e......wssw......e',
        'e......wwww......e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ],
      [
        'eeeeeeeeeeeeeeeeee',
        'eyyyyy.oooo.bbbb.e',
        'ey.y.y.o.o.b.b.b.e',
        'eyyyyy.oooo.bbbb.e',
        'e................e',
        'eyyyyy.oooo.bbbb.e',
        'ey.ysy.oso.bsb.b.e',
        'eyyyyy.oooo.bbbb.e',
        'e................e',
        'eyyyyy.oooo.bbbb.e',
        'ey.y.y.o.o.b.b.b.e',
        'eyyyyy.oooo.bbbb.e',
        'e................e',
        'e......ssss......e',
        'e......ssss......e',
        'e......ssss......e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ]
    ],
    'READ THREAD': [
      [
        'eeeeeeeeeeeeeeeeee',
        'e..cccccccccccc..e',
        'e..ckkkkkkkkkkc..e',
        'e..ck.nn.nn.nkc..e',
        'e..ck........kc..e',
        'e..ck.nnnnnn.kc..e',
        'e..ck........kc..e',
        'e..ck.nn.nn..kc..e',
        'e..ck........kc..e',
        'e..cccccccccccc..e',
        'e......tt........e',
        'e.....tttt.......e',
        'e....tttttt......e',
        'e.....t..t.......e',
        'e.....t..t.......e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ],
      [
        'eeeeeeeeeeeeeeeeee',
        'e..cccccccccccc..e',
        'e..ckkkkkkkkkkc..e',
        'e..ck........kc..e',
        'e..ck.nn.nn.nkc..e',
        'e..ck........kc..e',
        'e..ck.nnnnnn.kc..e',
        'e..ck........kc..e',
        'e..ck.nn.nn..kc..e',
        'e..cccccccccccc..e',
        'e......tt........e',
        'e.....tttt.......e',
        'e....ttwwtt......e',
        'e.....t..t.......e',
        'e.....t..t.......e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ]
    ],
    'PUNCH COL': [
      [
        'eeeeeeeeeeeeeeeeee',
        'e......kkkk......e',
        'e......kssk......e',
        'e......kkkk......e',
        'e.......nn.......e',
        'e..pppppppppppp..e',
        'e..p..........p..e',
        'e..p.k.k.k.k..p..e',
        'e..p..........p..e',
        'e..p.k.k......p..e',
        'e..p..........p..e',
        'e..pppppppppppp..e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ],
      [
        'eeeeeeeeeeeeeeeeee',
        'e................e',
        'e......kkkk......e',
        'e......kssk......e',
        'e......kkkk......e',
        'e..ppppnnpppppp..e',
        'e..p..........p..e',
        'e..p.k.k.k.k..p..e',
        'e..p.k........p..e',
        'e..p.k.k.k....p..e',
        'e..p..........p..e',
        'e..pppppppppppp..e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ]
    ],
    'HOLD LEAF': [
      [
        'eeeeeeeeeeeeeeeeee',
        'e................e',
        'e....ppppppp.....e',
        'e....psssssp.....e',
        'e....ps...sp.....e',
        'e....psnnnsp.....e',
        'e....ps...sp.....e',
        'e....psgggsp.....e',
        'e....ppppppp.....e',
        'e......tttt......e',
        'e.....tttttt.....e',
        'e....tt....tt....e',
        'e....t......t....e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ],
      [
        'eeeeeeeeeeeeeeeeee',
        'e................e',
        'e.....ppppppp....e',
        'e.....psssssp....e',
        'e.....ps...sp....e',
        'e.....psnnnsp....e',
        'e.....ps...sp....e',
        'e.....psgggsp....e',
        'e.....ppppppp....e',
        'e......tttt......e',
        'e.....tttttt.....e',
        'e....tt....tt....e',
        'e....t......t....e',
        'e................e',
        'e................e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ]
    ],
    'ASK CLERK': [
      [
        'eeeeeeeeeeeeeeeeee',
        'e....k....k......e',
        'e...kdk..kdk.....e',
        'e....kttttk......e',
        'e...ktwttwtk.....e',
        'e...ktekktek.....e',
        'e...ktttwwtk.....e',
        'e....kddkdk......e',
        'e....kssssk......e',
        'e...ktttgttk.....e',
        'e...kttttttk.....e',
        'e....kttttk......e',
        'e....kk..kk......e',
        'e...ktk..ktk.....e',
        'e...kk....kk.....e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ],
      [
        'eeeeeeeeeeeeeeeeee',
        'e....k....k......e',
        'e...kdk..kdk.....e',
        'e....kttttk......e',
        'e...ktwttwtk.....e',
        'e...ktekktek.....e',
        'e...kttttttk.....e',
        'e....kddddk......e',
        'e....kssssk......e',
        'e...ktttgttk.....e',
        'e...kttttttk.....e',
        'e....kttttk......e',
        'e....kk..kk......e',
        'e...ktk..ktk.....e',
        'e...kk....kk.....e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ]
    ],
    'WAIT REPLY': [
      [
        'eeeeeeeeeeeeeeeeee',
        'e................e',
        'e..cccccccccccc..e',
        'e..c..........c..e',
        'e..c.yyyyyyyy.c..e',
        'e..c.y......y.c..e',
        'e..c.y.oooo.y.c..e',
        'e..c.y.o..o.y.c..e',
        'e..c.y.oooo.y.c..e',
        'e..c.y......y.c..e',
        'e..c.yyyyyyyy.c..e',
        'e..c..........c..e',
        'e..cccccccccccc..e',
        'e......ss........e',
        'e......ss........e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ],
      [
        'eeeeeeeeeeeeeeeeee',
        'e................e',
        'e..cccccccccccc..e',
        'e..c..........c..e',
        'e..c.yyyyyyyy.c..e',
        'e..c.y......y.c..e',
        'e..c.y.bbbb.y.c..e',
        'e..c.y.bwwb.y.c..e',
        'e..c.y.bbbb.y.c..e',
        'e..c.y......y.c..e',
        'e..c.yyyyyyyy.c..e',
        'e..c..........c..e',
        'e..cccccccccccc..e',
        'e........ss......e',
        'e........ss......e',
        'e................e',
        'e................e',
        'eeeeeeeeeeeeeeeeee'
      ]
    ]
  };

  var sheet = document.createElement('canvas');
  sheet.width = W;
  sheet.height = H;
  var sctx = sheet.getContext('2d');
  var current = 'PUNCH COL';

  function framesFor(name) {
    return FORMS[name] || FORMS['PUNCH COL'];
  }

  function paint(name, frame) {
    var map = framesFor(name);
    var rows = map[frame % map.length];
    var x, y, ch, col;
    sctx.clearRect(0, 0, W, H);
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        ch = (rows[y] || '').charAt(x) || '.';
        col = PAL[ch];
        if (!col) continue;
        sctx.fillStyle = col;
        sctx.fillRect(x, y, 1, 1);
      }
    }
    current = name;
  }

  function blit(dest, t, name) {
    if (!dest) return;
    name = name || current;
    paint(name, Math.floor((t || 0) * 4));
    var d = dest.getContext('2d');
    d.imageSmoothingEnabled = false;
    d.clearRect(0, 0, dest.width, dest.height);
    d.drawImage(sheet, 0, 0, W, H, 0, 0, dest.width, dest.height);
  }

  global.NineBit = {
    W: W,
    H: H,
    names: Object.keys(FORMS),
    paint: paint,
    blit: blit,
    sheet: function () { return sheet; },
    form: function () { return current; }
  };
})(window);
