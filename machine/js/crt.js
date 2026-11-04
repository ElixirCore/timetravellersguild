/* CRT CanvasTexture — phosphor instrumentation + Feed∞ slips. */
(function (global) {
  'use strict';

  var PHOS = '#d8ffe8';
  var PHOS_DIM = '#7eb892';
  var AMBER = '#ffd978';
  var BG = '#020a06';

  function CRTDisplay() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 960;
    this.ctx = this.canvas.getContext('2d');
    this.texture = null;
    this.bootPhase = 0;
    this.bootLines = [
      'TIME TRAVELLERS GUILD',
      'INSTRUMENT №13',
      'LOCAL PRESENT ACQUIRED',
      'ARCHIVE AVAILABLE',
      'JACK AVAILABLE',
      'E = M / R^(κ·ΔC)',
      'TIME MACHINE READY',
    ];
    this.bootIndex = 0;
    this.bootAt = 0;
    this.ready = false;
    this.feedMode = false;
    this.feedUntil = 0;
    this.feedFrame = null;
    this.glitch = 0;
    this.state = null;
    this.clock = 0;
    this.page = 'STATE';
    this.ledger = [];
    this.transit = null;
    this.fault = '';
  }

  CRTDisplay.prototype.attach = function (THREE) {
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    return this.texture;
  };

  CRTDisplay.prototype.setState = function (state) {
    this.state = state;
  };

  CRTDisplay.prototype.showFeed = function (frame, ms) {
    this.feedMode = true;
    this.feedFrame = frame;
    this.feedUntil = performance.now() + (ms || 2200);
  };

  CRTDisplay.prototype.tick = function (now) {
    this.clock = now;
    if (!this.ready) {
      if (!this.bootAt) this.bootAt = now;
      var elapsed = now - this.bootAt;
      this.bootIndex = Math.min(this.bootLines.length - 1, Math.floor(elapsed / 700));
      if (elapsed > this.bootLines.length * 700 + 400) this.ready = true;
    }
    if (this.feedMode && now > this.feedUntil) {
      this.feedMode = false;
      this.feedFrame = null;
    }
    if (Math.random() < 0.015) this.glitch = 3 + Math.floor(Math.random() * 6);
    if (this.glitch > 0) this.glitch--;
    this.draw();
    if (this.texture) this.texture.needsUpdate = true;
  };

  CRTDisplay.prototype.draw = function () {
    var c = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;

    c.fillStyle = BG;
    c.fillRect(0, 0, w, h);

    // Soft centre glow — keep text contrast high
    var g = c.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.5, w * 0.65);
    g.addColorStop(0, 'rgba(30, 90, 50, 0.35)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    c.textBaseline = 'top';
    c.fillStyle = PHOS;

    if (!this.ready) {
      c.font = 'bold 44px "Courier New", monospace';
      c.fillText('TIME MACHINE №13', 56, 56);
      c.font = 'bold 34px "Courier New", monospace';
      for (var i = 0; i <= this.bootIndex; i++) {
        c.fillText('> ' + this.bootLines[i], 56, 140 + i * 52);
      }
      this.drawScan(c, w, h);
      return;
    }

    if (this.transit) {
      this.drawTransit(c, w, h, this.transit);
      this.drawScan(c, w, h);
      return;
    }

    if (this.feedMode && this.feedFrame && (this.page === 'STATE' || this.page === 'FEED')) {
      this.drawFeed(c, w, h, this.feedFrame);
      this.drawFault(c, w, h);
      this.drawScan(c, w, h);
      return;
    }

    if (this.page === 'FIELD' || this.page === 'LEDGER' || this.page === 'FEED') {
      this.drawPageHeader(c, w, this.page);
      if (this.page === 'FIELD') this.drawField(c, w, h);
      else if (this.page === 'LEDGER') this.drawLedger(c, w, h);
      else {
        c.fillStyle = PHOS_DIM;
        c.font = 'bold 32px "Courier New", monospace';
        c.fillText('FEED∞ — AWAITING NEXT SLIP' + (Math.floor(this.clock / 500) % 2 ? ' _' : ''), 48, 150);
      }
      this.drawFault(c, w, h);
      this.drawScan(c, w, h);
      return;
    }

    var s = this.state || {};
    var syn = (typeof TTGMachineReadout !== 'undefined')
      ? TTGMachineReadout.synthesize(s)
      : null;

    var y = 48;
    c.font = 'bold 42px "Courier New", monospace';
    c.fillStyle = PHOS;
    c.fillText('TIME MACHINE №13', 48, y);
    y += 64;

    if (syn) {
      c.font = 'bold 36px "Courier New", monospace';
      c.fillText(syn.headline, 48, y);
      y += 56;

      c.font = 'bold 26px "Courier New", monospace';
      c.fillStyle = PHOS_DIM;
      c.fillText('MACHINE  ' + syn.time.machine, 48, y);
      y += 40;
      c.fillText('LOCAL    ' + syn.time.local, 48, y);
      y += 48;

      c.fillStyle = PHOS;
      c.font = 'bold 28px "Courier New", monospace';
      wrap(c, syn.time.line, 48, y, w - 96, 36);
      y += 100;

      wrap(c, syn.field.line, 48, y, w - 96, 36);
      y += 80;

      wrap(c, syn.emergy.line, 48, y, w - 96, 36);
      y += 110;

      if (syn.jack) {
        c.fillStyle = AMBER;
        c.font = 'bold 28px "Courier New", monospace';
        wrap(c, 'JACK — ' + syn.jack, 48, y, w - 96, 36);
        y += 80;
      }

      var mm = s._machine;
      if (mm && mm.destination) {
        c.fillStyle = mm.cost > mm.capacity ? '#ff8a6a' : PHOS;
        c.font = 'bold 26px "Courier New", monospace';
        wrap(c, 'DEST ' + mm.destination.when + ' · ' + mm.destination.label + ' · COST ' + num(mm.cost) + ' / CHARGE ' + num(mm.capacity), 48, Math.min(y, h - 150), w - 96, 34);
      }

      c.fillStyle = PHOS_DIM;
      c.font = 'bold 24px "Courier New", monospace';
      c.fillText('CLICK SCREEN · FULL READOUT', 48, h - 72);
    } else {
      c.font = 'bold 28px "Courier New", monospace';
      c.fillText('AWAITING STATE', 48, y);
    }

    if (this.glitch) {
      c.fillStyle = 'rgba(216,255,232,0.12)';
      c.fillRect(0, 80 + Math.random() * 600, w, 2 + Math.random() * 10);
    }

    this.drawFault(c, w, h);
    this.drawScan(c, w, h);
  };

  CRTDisplay.prototype.drawPageHeader = function (c, w, page) {
    c.fillStyle = PHOS;
    c.font = 'bold 40px "Courier New", monospace';
    c.fillText('№13 · ' + page, 48, 44);
    c.fillStyle = PHOS_DIM;
    c.fillRect(48, 100, w - 96, 3);
  };

  CRTDisplay.prototype.drawField = function (c, w, h) {
    var s = this.state || {};
    var tl = s.timeline || {};
    var years = Object.keys(tl).map(Number).sort(function (a, b) { return a - b; });
    var present = new Date(s.machine_present || Date.now());
    var py = present.getUTCFullYear();
    if (!years.length) { c.fillStyle = PHOS_DIM; c.font = 'bold 30px "Courier New", monospace'; c.fillText('NO DATED RECORDS IN THIS CUT', 48, 160); return; }
    var lo = Math.min(years[0], py) - 2, hi = Math.max(years[years.length - 1], py) + 2;
    var maxC = 1; years.forEach(function (y) { maxC = Math.max(maxC, tl[y]); });
    var x0 = 70, x1 = w - 50, base = 540, top = 150;
    function X(y) { return x0 + (y - lo) / Math.max(1, hi - lo) * (x1 - x0); }
    c.strokeStyle = 'rgba(143,217,168,0.25)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0, base); c.lineTo(x1, base); c.stroke();
    c.font = 'bold 22px "Courier New", monospace';
    years.forEach(function (y) {
      var bh = (tl[y] / maxC) * (base - top);
      var past = y <= py;
      c.fillStyle = past ? PHOS : 'rgba(126,184,146,0.35)';
      c.fillRect(X(y) - 9, base - bh, 18, bh);
      c.fillStyle = past ? PHOS : PHOS_DIM;
      c.save(); c.translate(X(y) + 7, base + 14); c.rotate(Math.PI / 2.6); c.fillText(String(y), 0, 0); c.restore();
      c.fillText(String(tl[y]), X(y) - 10, base - bh - 28);
    });
    c.strokeStyle = AMBER; c.lineWidth = 3; c.setLineDash([10, 8]);
    c.beginPath(); c.moveTo(X(py), top - 20); c.lineTo(X(py), base); c.stroke(); c.setLineDash([]);
    c.fillStyle = AMBER; c.font = 'bold 26px "Courier New", monospace';
    c.fillText('PRESENT ' + py, Math.min(X(py) + 10, w - 240), top - 24);
    var tc = s.type_counts || {};
    var ex = s.excluded || [];
    var keys = Object.keys(tc);
    c.font = 'bold 24px "Courier New", monospace';
    var y0 = 680;
    keys.slice(0, 12).forEach(function (k, i) {
      var col = i % 3, row = Math.floor(i / 3);
      var off = ex.indexOf(k) >= 0;
      c.fillStyle = off ? '#7a4a40' : PHOS;
      c.fillText((off ? '○ ' : '● ') + k.slice(0, 13) + ' ' + tc[k], 48 + col * 400, y0 + row * 40);
    });
    var f = s.field || {};
    c.fillStyle = PHOS_DIM;
    c.fillText((f.node_count || 0) + ' IN FIELD · ' + (f.active_cards || 0) + ' ACTIVE · ' + (f.edge_count || 0) + ' EDGES', 48, h - 64);
  };

  CRTDisplay.prototype.drawLedger = function (c, w, h) {
    var L = this.ledger || [];
    c.font = 'bold 26px "Courier New", monospace';
    if (!L.length) {
      c.fillStyle = PHOS_DIM;
      wrap(c, 'NO JOURNEYS LOGGED. SET THE DESTINATION DRUM, THEN PULL THE ENGAGE LEVER (OR PRESS T).', 48, 150, w - 96, 38);
      return;
    }
    c.fillStyle = PHOS_DIM;
    c.fillText(pad('NO', 6) + pad('FROM', 12) + pad('TO', 12) + pad('Δ Y', 9) + 'DESTINATION', 48, 130);
    L.slice(0, 16).forEach(function (e, i) {
      c.fillStyle = i === 0 ? AMBER : PHOS;
      var label = String(e.label || '');
      if (label.length > 26) label = label.slice(0, 25) + '…';
      c.fillText(pad(String(e.n), 6) + pad(String(e.from).slice(0, 10), 12) + pad(String(e.to).slice(0, 10), 12) + pad(String(e.years), 9) + label, 48, 180 + i * 44);
    });
  };

  CRTDisplay.prototype.drawTransit = function (c, w, h, tr) {
    var cx = w / 2, cy = h / 2 + 40;
    var t = this.clock / 1000;
    var p = tr.progress || 0;
    // tunnel rings
    for (var i = 0; i < 18; i++) {
      var z = ((i / 18) + t * (0.4 + p * 2.2)) % 1;
      var r = 20 + z * z * w * 0.7;
      c.strokeStyle = 'rgba(216,255,232,' + (0.05 + z * 0.35) + ')';
      c.lineWidth = 1 + z * 4;
      c.beginPath();
      c.ellipse(cx + Math.sin(t * 3 + i) * 12 * p, cy, r, r * 0.7, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = PHOS;
    c.font = 'bold 44px "Courier New", monospace';
    c.textAlign = 'center';
    var title = tr.phase === 'charge' ? 'CHARGING' : tr.phase === 'arrive' ? 'ARRIVED' : 'IN TRANSIT';
    c.fillText(title, cx, 60);
    c.font = 'bold 72px "Courier New", monospace';
    c.fillStyle = AMBER;
    var d = tr.now instanceof Date ? tr.now : new Date(tr.now);
    c.fillText(isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10), cx, cy - 40);
    c.font = 'bold 30px "Courier New", monospace';
    c.fillStyle = PHOS;
    c.fillText(String(tr.label || '').toUpperCase().slice(0, 40), cx, cy + 50);
    // progress / charge bar
    var bw = w - 200, bx = 100, by = h - 120;
    c.strokeStyle = PHOS; c.lineWidth = 3; c.strokeRect(bx, by, bw, 34);
    c.fillStyle = tr.phase === 'charge' ? '#66ff88' : AMBER;
    var frac = tr.phase === 'charge' ? Math.min(1, (tr.charge || 0) / Math.max(0.01, tr.cost || 1)) : p;
    c.fillRect(bx + 4, by + 4, (bw - 8) * frac, 26);
    c.textAlign = 'left';
  };

  CRTDisplay.prototype.drawFault = function (c, w, h) {
    if (!this.fault) return;
    var on = Math.floor(this.clock / 300) % 2 === 0;
    c.fillStyle = on ? 'rgba(180,30,20,0.85)' : 'rgba(120,20,10,0.85)';
    c.fillRect(0, h - 170, w, 96);
    c.fillStyle = '#ffe0d0';
    c.font = 'bold 28px "Courier New", monospace';
    wrap(c, 'FAULT — ' + this.fault, 40, h - 156, w - 80, 34);
  };

  CRTDisplay.prototype.drawFeed = function (c, w, h, frame) {
    c.fillStyle = PHOS_DIM;
    c.font = 'bold 28px "Courier New", monospace';
    c.fillText('FEED∞', 48, 48);
    c.fillStyle = PHOS;
    c.font = 'bold 40px "Courier New", monospace';
    c.fillText('[' + (frame.kind || 'DATA') + ']', 48, 110);
    c.font = 'bold 36px "Courier New", monospace';
    wrap(c, frame.title || frame.caption || 'MISSING CONTEXT', 48, 180, w - 96, 44);
    if (frame.sub) {
      c.fillStyle = PHOS_DIM;
      c.font = 'bold 28px "Courier New", monospace';
      wrap(c, frame.sub, 48, 320, w - 96, 36);
    }
    if (frame.bits) {
      c.fillStyle = PHOS;
      c.font = 'bold 26px "Courier New", monospace';
      c.fillText(frame.bits, 48, 460);
    }
    if (frame.jack) {
      c.fillStyle = AMBER;
      c.font = 'bold 28px "Courier New", monospace';
      c.fillText('JACK', 48, 540);
      wrap(c, frame.jack, 48, 584, w - 96, 36);
    }
  };

  CRTDisplay.prototype.drawScan = function (c, w, h) {
    // Light scan — readability first
    c.fillStyle = 'rgba(0,0,0,0.07)';
    for (var i = 0; i < h; i += 4) {
      c.fillRect(0, i, w, 1);
    }
    var wobble = Math.sin(this.clock / 400) * 2;
    c.fillStyle = 'rgba(216,255,232,0.035)';
    c.fillRect(0, (this.clock / 8 + wobble) % h, w, 48);

    // Bezel vignette
    var v = c.createRadialGradient(w * 0.5, h * 0.5, h * 0.35, w * 0.5, h * 0.5, h * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  };

  function formatStamp(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso.slice(0, 19);
      var p = function (n) { return String(n).padStart(2, '0'); };
      return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear()
        + '  ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    } catch (e) {
      return String(iso).slice(0, 19);
    }
  }

  function num(v) {
    if (typeof v !== 'number') return '—';
    return v.toFixed(3);
  }

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += ' ';
    return s;
  }

  function wrap(c, text, x, y, maxW, lh) {
    var words = String(text).split(/\s+/);
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, y);
        y += lh;
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) c.fillText(line, x, y);
  }

  global.TTGMachineCRT = CRTDisplay;
})(window);
