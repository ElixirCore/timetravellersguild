/* TIME MACHINE №13 — instrument components: things that show the computation. */
(function (TTGM) {
  'use strict';

  var U = TTGM.util;
  var PHOS = '#d8ffe8', PHOS_DIM = '#6fae86', AMBER = '#ffd978', GRID = 'rgba(120,220,160,0.14)';

  function bezel(T, mats, w, h) {
    var g = new T.Group();
    var frame = new T.Mesh(new T.BoxGeometry(w + 0.06, h + 0.06, 0.05), mats.steel);
    frame.position.z = -0.01;
    g.add(frame);
    return g;
  }

  function screenComponent(proto) {
    // Shared: a canvas screen redrawn at a capped rate.
    proto.buildScreen = function (w, h, px, py) {
      var T = this.THREE;
      this.group.add(bezel(T, this.machine.mats, w, h));
      this.tex = U.canvasTex(T, px, py, function () {});
      this.ctx = this.tex.userData.canvas.getContext('2d');
      var scr = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
      scr.position.z = 0.017;
      this.group.add(scr);
      var hit = U.hitBox(T, w + 0.06, h + 0.06, 0.06);
      hit.position.z = 0.02;
      this.group.add(this.pickable(hit));
      if (this.spec.label) {
        var lab = U.labelMesh(T, this.spec.label, Math.min(w, 0.3), 0.036, { bg: '#1a1408', fg: '#d4b45a', size: 28 });
        lab.position.set(0, -h / 2 - 0.05, 0.005);
        this.group.add(lab);
      }
      this._next = 0;
    };
    proto.tick = function (dt, t) {
      if (t < this._next) return;
      this._next = t + (this.fps ? 1 / this.fps : 1 / 15);
      this.draw(this.ctx, this.tex.userData.canvas.width, this.tex.userData.canvas.height, t);
      this.tex.needsUpdate = true;
    };
    proto.press = function () { if (this.spec.action) this.act(); return true; };
    return proto;
  }

  function scanlines(ctx, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (var y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    var v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }

  /* ───────────── CRT — wraps the phosphor display ───────────── */
  TTGM.define('crt', {
    build: function () {
      var T = this.THREE, s = this.spec;
      var size = s.size || [1.0, 0.64];
      var bz = new T.Mesh(new T.BoxGeometry(size[0] + 0.12, size[1] + 0.12, 0.08), this.machine.mats.steel);
      bz.position.z = -0.02;
      this.group.add(bz);
      this.crt = new TTGMachineCRT();
      var tex = this.crt.attach(T);
      var screen = new T.Mesh(new T.PlaneGeometry(size[0], size[1]), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
      screen.position.z = 0.025;
      this.group.add(screen);
      var glass = new T.Mesh(
        new T.SphereGeometry(1.6, 24, 16, Math.PI / 2 - 0.33, 0.66, Math.PI / 2 - 0.21, 0.42),
        new T.MeshStandardMaterial({ color: 0x88aa99, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.6 })
      );
      glass.position.z = -1.55;
      this.group.add(glass);
      var hit = U.hitBox(T, size[0] + 0.12, size[1] + 0.12, 0.08);
      hit.position.z = 0.06;
      this.group.add(this.pickable(hit));
      this.light = new T.PointLight(0xa8ffc0, 1.0, 4.0);
      this.light.position.set(0, 0, 0.4);
      this.group.add(this.light);
      this.machine.crt = this.crt;
    },
    update: function (state) {
      this.crt.setState(this.machine.viewState());
      this.crt.page = state.page || 'STATE';
      this.crt.ledger = this.machine.ledger.list();
      this.crt.fault = state.fault || '';
    },
    tick: function (dt, t) {
      this.crt.transit = this.machine.journey ? this.machine.journey.view() : null;
      this.crt.tick(t * 1000);
      var e = this.val('emergy_display') || 0;
      this.light.intensity = 0.5 + e * 1.1 + (this.crt.transit ? Math.random() * 0.8 : 0);
    },
    press: function () { this.act(); return true; },
    tip: function () {
      return { label: 'CRT · ' + (this.val('page') || 'STATE'), text: this.spec.tip || '' };
    },
  });

  /* ───────────── GAUGE — needle meter with damped overshoot ───────────── */
  TTGM.define('gauge', {
    build: function () {
      var T = this.THREE, s = this.spec, m = this.machine.mats;
      var r = s.radius || 0.22;
      var face = new T.Mesh(new T.CylinderGeometry(r + 0.04, r + 0.04, 0.04, 40), m.steel);
      face.rotation.x = Math.PI / 2;
      this.group.add(face);
      var self = this;
      this.tex = U.canvasTex(T, 512, 512, function (ctx, w, h) {
        ctx.fillStyle = '#0b120e'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2, R = w * 0.44;
        ctx.lineWidth = 3; ctx.strokeStyle = '#8fd9a8';
        ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.stroke();
        if (s.redline != null) {
          ctx.strokeStyle = '#d03020'; ctx.lineWidth = 14;
          ctx.beginPath(); ctx.arc(cx, cy, R - 10, Math.PI + s.redline * Math.PI, 0); ctx.stroke();
        }
        ctx.fillStyle = '#d8ffe8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 30px "Courier New", monospace';
        for (var i = 0; i <= 20; i++) {
          var a = Math.PI + (i / 20) * Math.PI;
          var major = i % 5 === 0;
          ctx.strokeStyle = '#8fd9a8'; ctx.lineWidth = major ? 5 : 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (R - (major ? 34 : 20)), cy + Math.sin(a) * (R - (major ? 34 : 20)));
          ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          ctx.stroke();
          if (major) ctx.fillText((i / 20).toFixed(2).replace(/^0/, ''), cx + Math.cos(a) * (R - 64), cy + Math.sin(a) * (R - 64));
        }
        ctx.font = 'bold 40px "Courier New", monospace';
        ctx.fillText(s.label || 'E', cx, cy + 90);
        ctx.font = 'bold 22px "Courier New", monospace'; ctx.fillStyle = '#6fae86';
        ctx.fillText('M / R^(κ·ΔC)', cx, cy + 140);
      });
      var dial = new T.Mesh(new T.CircleGeometry(r, 48), new T.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
      dial.position.z = 0.022;
      this.group.add(dial);
      this.pivot = new T.Group();
      this.pivot.position.z = 0.03;
      var arm = new T.Mesh(
        new T.BoxGeometry(r * 0.88, 0.008, 0.004),
        new T.MeshStandardMaterial({ color: 0xffb030, emissive: 0xaa5500, emissiveIntensity: 0.9 })
      );
      arm.position.x = r * 0.44;
      this.pivot.add(arm);
      var hub = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.02, 12), m.brass);
      hub.rotation.x = Math.PI / 2;
      this.pivot.add(hub);
      this.group.add(this.pivot);
      var glass = new T.Mesh(new T.CircleGeometry(r + 0.01, 40), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.05 }));
      glass.position.z = 0.045;
      this.group.add(glass);
      var hit = U.hitBox(T, r * 2 + 0.08, r * 2 + 0.08, 0.06);
      this.group.add(this.pickable(hit));
      this.pos = 0.4; this.vel = 0;
    },
    tick: function (dt, t) {
      var target = U.clamp(this.val() || 0, 0, 1);
      if (this.val('travelling')) target = U.clamp(target + Math.sin(t * 31) * 0.04 + 0.08, 0, 1.02);
      var k = 70, c = 7;
      this.vel += ((target - this.pos) * k - this.vel * c) * dt;
      this.pos += this.vel * dt;
      this.pivot.rotation.z = Math.PI - U.clamp(this.pos, -0.02, 1.03) * Math.PI;
    },
    tip: function () {
      var v = this.val();
      var raw = this.val('emergy_raw');
      return { label: (this.spec.label || 'GAUGE') + ' · ' + (typeof v === 'number' ? v.toFixed(3) : '—') + (raw ? '  raw ' + raw.toFixed(4) : ''), text: this.spec.tip || '' };
    },
  });

  /* ───────────── SCOPE — records per year with present cursor ───────────── */
  TTGM.define('scope', screenComponent({
    build: function () {
      var sz = this.spec.size || [0.46, 0.36];
      this.fps = 20;
      this.buildScreen(sz[0], sz[1], 512, 400);
    },
    draw: function (ctx, w, h, t) {
      var srv = this.val('server') || {};
      var tl = srv.timeline || {};
      var present = this.val('transitPresent') || this.val('present') || new Date();
      var py = present.getUTCFullYear() + present.getUTCMonth() / 12;
      var years = Object.keys(tl).map(Number);
      var lo = Math.min.apply(null, years.concat([py])) - 4;
      var hi = Math.max.apply(null, years.concat([py])) + 4;
      if (!isFinite(lo)) { lo = py - 10; hi = py + 10; }
      var maxC = 1; years.forEach(function (y) { maxC = Math.max(maxC, tl[y]); });
      ctx.fillStyle = '#020a06'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      for (var gx = 0; gx <= 10; gx++) { ctx.beginPath(); ctx.moveTo(gx * w / 10, 0); ctx.lineTo(gx * w / 10, h); ctx.stroke(); }
      for (var gy = 0; gy <= 8; gy++) { ctx.beginPath(); ctx.moveTo(0, gy * h / 8); ctx.lineTo(w, gy * h / 8); ctx.stroke(); }
      var base = h - 46, top = 40;
      function X(y) { return 16 + (y - lo) / (hi - lo) * (w - 32); }
      var e = this.val('emergy_display') || 0.3;
      var travelling = !!this.val('transitPresent');
      // trace: a smoothed density curve with an emergy ripple
      ctx.strokeStyle = PHOS; ctx.lineWidth = 2.5; ctx.shadowColor = PHOS; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (var px = 0; px <= w; px += 3) {
        var yr = lo + (px - 16) / (w - 32) * (hi - lo);
        var dens = 0;
        years.forEach(function (y) { var d = (yr - y) / 1.4; dens += tl[y] * Math.exp(-d * d); });
        var amp = (dens / maxC) * (base - top);
        var ripple = Math.sin(px * 0.09 + t * (4 + e * 10)) * (2 + e * 6) * (travelling ? 3 : 1);
        var yy = base - amp + ripple * (0.3 + dens / maxC);
        if (px === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      // bars for exact counts
      ctx.fillStyle = 'rgba(143,217,168,0.35)';
      years.forEach(function (y) {
        var bh = (tl[y] / maxC) * (base - top);
        ctx.fillRect(X(y) - 2, base - bh, 4, bh);
      });
      // cursor
      var cx = X(py);
      ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(cx, top - 16); ctx.lineTo(cx, base + 6); ctx.stroke(); ctx.setLineDash([]);
      // destination ghost cursor
      var dest = this.machine.destination();
      if (dest && dest.date) {
        var dy = dest.date.getUTCFullYear() + dest.date.getUTCMonth() / 12;
        if (dy >= lo && dy <= hi) {
          ctx.strokeStyle = 'rgba(255,90,60,0.8)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(X(dy), top); ctx.lineTo(X(dy), base); ctx.stroke();
        }
      }
      ctx.fillStyle = AMBER; ctx.font = 'bold 26px "Courier New", monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(present.getUTCFullYear()), U.clamp(cx, 50, w - 50), 22);
      ctx.fillStyle = PHOS_DIM; ctx.font = 'bold 20px "Courier New", monospace';
      ctx.textAlign = 'left'; ctx.fillText(String(Math.round(lo)), 8, h - 16);
      ctx.textAlign = 'right'; ctx.fillText(String(Math.round(hi)), w - 8, h - 16);
      ctx.textAlign = 'center'; ctx.fillText((srv.field ? srv.field.node_count : 0) + ' REC', w / 2, h - 16);
      scanlines(ctx, w, h);
    },
  }));

  /* ───────────── RADAR — ΔC on five axes ───────────── */
  TTGM.define('radar', screenComponent({
    build: function () {
      var sz = this.spec.size || [0.4, 0.34];
      this.fps = 15;
      this.buildScreen(sz[0], sz[1], 480, 400);
    },
    draw: function (ctx, w, h, t) {
      var srv = this.val('server') || {};
      var axesV = srv.dc_axes || {};
      var weights = srv.dc_weights || {};
      var names = ['TIME', 'PLACE', 'PEOPLE', 'INSTITUTIONS', 'SYMBOLS'];
      var sel = this.val('dcAxis') || 'TIME';
      ctx.fillStyle = '#020a06'; ctx.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2 + 8, R = h * 0.36;
      function P(i, r) { var a = -Math.PI / 2 + i * Math.PI * 2 / 5; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      for (var ring = 1; ring <= 4; ring++) {
        ctx.beginPath();
        for (var i = 0; i <= 5; i++) { var p = P(i % 5, R * ring / 4); if (!i) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
        ctx.stroke();
      }
      ctx.font = 'bold 22px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      names.forEach(function (n, i) {
        var p = P(i, R); var on = n === sel;
        ctx.strokeStyle = on ? AMBER : GRID; ctx.lineWidth = on ? 3 : 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]); ctx.stroke();
        var lp = P(i, R + 30);
        ctx.fillStyle = on ? AMBER : PHOS_DIM;
        ctx.fillText(n.slice(0, 5), lp[0], lp[1]);
      });
      ctx.fillStyle = 'rgba(143,217,168,0.25)'; ctx.strokeStyle = PHOS; ctx.lineWidth = 2.5;
      ctx.beginPath();
      names.forEach(function (n, i) {
        var v = U.clamp(axesV[n] || 0, 0, 1) * (1 + Math.sin(t * 3 + i) * 0.03);
        var p = P(i, Math.max(0.04, v) * R);
        if (!i) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // weights as dots
      names.forEach(function (n, i) {
        var p = P(i, U.clamp(weights[n] || 0, 0, 1) * R);
        ctx.fillStyle = n === sel ? AMBER : PHOS;
        ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill();
      });
      // sweep
      var a = (t * 1.4) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(216,255,232,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      ctx.fillStyle = PHOS; ctx.font = 'bold 24px "Courier New", monospace'; ctx.textAlign = 'left';
      ctx.fillText('ΔC ' + (typeof srv.delta_context === 'number' ? srv.delta_context.toFixed(3) : '—'), 12, 22);
      scanlines(ctx, w, h);
    },
    tip: function () {
      var a = (this.val('server') || {}).dc_axes || {};
      return {
        label: 'ΔC RADAR · axis ' + this.val('dcAxis'),
        text: Object.keys(a).map(function (k) { return k + ' ' + Number(a[k]).toFixed(2); }).join(' · ') + '. ' + (this.spec.tip || ''),
      };
    },
  }));

  /* ───────────── ANNUNCIATOR — labelled status lamps ───────────── */
  TTGM.define('annunciator', {
    build: function () {
      var T = this.THREE, m = this.machine.mats;
      this.lamps = [];
      var defs = this.spec.lamps || [];
      var cols = 2, cw = 0.22, ch = 0.075;
      var plate = new T.Mesh(new T.BoxGeometry(cols * cw + 0.04, Math.ceil(defs.length / cols) * ch + 0.04, 0.03), m.steel);
      this.group.add(plate);
      defs.forEach(function (d, i) {
        var col = i % cols, row = Math.floor(i / cols);
        var x = (col - (cols - 1) / 2) * cw;
        var y = ((Math.ceil(defs.length / cols) - 1) / 2 - row) * ch;
        var hex = '#' + ('000000' + (d.color || 0x66ff88).toString(16)).slice(-6);
        var tex = U.labelTex(T, d.label, { w: 256, h: 80, bg: '#0a0a0a', fg: hex, size: 34, border: '#333' });
        var mat = new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05, color: 0x333333 });
        var win = new T.Mesh(new T.BoxGeometry(cw - 0.02, ch - 0.015, 0.012), mat);
        win.position.set(x, y, 0.018);
        this.group.add(win);
        this.lamps.push({ def: d, mat: mat });
      }, this);
      this.group.add(this.pickable(U.hitBox(T, cols * cw + 0.04, Math.ceil(defs.length / cols) * ch + 0.04, 0.06)));
    },
    tick: function (dt, t) {
      var s = this.machine.store.state;
      this.lamps.forEach(function (L) {
        var b = L.def.bind;
        var on = b === 'ready' ? (!s.travelling && !s.fault && !s.fetching) : !!s[b];
        var blink = b === 'fault' || b === 'travelling' ? (Math.sin(t * 12) > 0 ? 1 : 0.4) : 1;
        L.mat.emissiveIntensity = on ? 0.95 * blink : 0.04;
      });
    },
    tip: function () {
      var f = this.val('fault');
      return { label: 'ANNUNCIATOR', text: f ? 'FAULT: ' + f : this.spec.tip };
    },
  });

  /* ───────────── LAMPBAR — charge vs capacity vs cost ───────────── */
  TTGM.define('lampbar', {
    build: function () {
      var T = this.THREE, m = this.machine.mats;
      this.n = this.spec.count || 16;
      var pitch = 0.034;
      var rail = new T.Mesh(new T.BoxGeometry(this.n * pitch + 0.04, 0.05, 0.03), m.steel);
      rail.position.z = -0.01;
      this.group.add(rail);
      this.lamps = [];
      for (var i = 0; i < this.n; i++) {
        var lamp = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.02, 12), U.lampMat(T, 0x66ff88));
        lamp.rotation.x = Math.PI / 2;
        lamp.position.set((i - (this.n - 1) / 2) * pitch, 0, 0.012);
        this.group.add(lamp);
        this.lamps.push(lamp);
      }
      this.group.add(this.pickable(U.hitBox(T, this.n * pitch + 0.04, 0.06, 0.05)));
    },
    tick: function (dt, t) {
      var s = this.machine.store.state;
      var charge = s.charge || 0, cap = s.capacity || 0, cost = s.cost || 0;
      var n = this.n;
      for (var i = 0; i < n; i++) {
        var f = (i + 0.5) / n;
        var L = this.lamps[i].material;
        var isCost = Math.abs(f - Math.min(cost, 1)) < 0.5 / n;
        if (f <= charge) {
          L.emissive.setHex(f > cost ? 0xffcc44 : 0x66ff88);
          L.emissiveIntensity = 1.1;
        } else if (isCost) {
          L.emissive.setHex(0xff3322);
          L.emissiveIntensity = 0.6 + Math.sin(t * 6) * 0.3;
        } else if (f <= cap) {
          L.emissive.setHex(0x66ff88);
          L.emissiveIntensity = 0.18;
        } else {
          L.emissive.setHex(0x334433);
          L.emissiveIntensity = 0.04;
        }
      }
    },
    tip: function () {
      var s = this.machine.store.state;
      return {
        label: 'CHARGE · cost ' + (s.cost || 0).toFixed(2) + ' / capacity ' + (s.capacity || 0).toFixed(2),
        text: this.spec.tip + (s.cost > s.capacity ? ' Insufficient: raise MIND, lower κ or MATTER, or choose a nearer destination.' : ''),
      };
    },
  });

  /* ───────────── PRINTER — journey stubs ───────────── */
  TTGM.define('printer', {
    build: function () {
      var T = this.THREE, m = this.machine.mats;
      var body = new T.Mesh(new T.BoxGeometry(0.38, 0.08, 0.06), m.steel);
      this.group.add(body);
      var slot = new T.Mesh(new T.BoxGeometry(0.28, 0.012, 0.02), new T.MeshBasicMaterial({ color: 0x050505 }));
      slot.position.set(0, -0.025, 0.026);
      this.group.add(slot);
      var lab = U.labelMesh(T, 'TICKETS', 0.16, 0.03, { bg: '#1a1408', fg: '#d4b45a', size: 30 });
      lab.position.set(0, 0.015, 0.031);
      this.group.add(lab);
      this.group.add(this.pickable(U.hitBox(T, 0.38, 0.08, 0.06)));
      this.tickets = [];
      var self = this;
      this.machine.bus.on('ticket', function (entry) { self.print(entry); });
    },
    print: function (e) {
      var T = this.THREE;
      this.tickets.forEach(function (tk) { tk.dropping = true; });
      var tex = U.canvasTex(T, 256, 384, function (ctx, w, h) {
        ctx.fillStyle = '#efe6cc'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2a1a0a'; ctx.textAlign = 'center';
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.fillText('TTG · №13 · JOURNEY', w / 2, 30);
        ctx.fillRect(16, 42, w - 32, 2);
        ctx.font = 'bold 18px "Courier New", monospace'; ctx.textAlign = 'left';
        var lines = [
          'FROM ' + String(e.from).slice(0, 10),
          'TO   ' + String(e.to).slice(0, 10),
          'Δ    ' + e.years + ' y',
          'E    ' + Number(e.e).toFixed(3),
          'COST ' + Number(e.cost).toFixed(2),
        ];
        lines.forEach(function (l, i) { ctx.fillText(l, 20, 76 + i * 28); });
        ctx.font = 'bold 20px "Courier New", monospace';
        var t = String(e.label || '').toUpperCase();
        ctx.fillText(t.slice(0, 18), 20, 240);
        if (t.length > 18) ctx.fillText(t.slice(18, 36), 20, 264);
        for (var i = 0; i < 24; i++) if ((e.n * 7 + i * 13) % 3) ctx.fillRect(20 + i * 9, 300, 5, 40);
        ctx.font = '14px "Courier New", monospace';
        ctx.fillText('No ' + String(e.n).padStart(5, '0'), 20, 364);
      });
      var mesh = new T.Mesh(new T.PlaneGeometry(0.16, 0.24), new T.MeshStandardMaterial({ map: tex, roughness: 0.9, side: T.DoubleSide, transparent: true }));
      var holder = new T.Group();
      holder.position.set(0, -0.03, 0.032);
      mesh.position.y = 0.12;
      holder.add(mesh);
      holder.scale.y = 0.001;
      this.group.add(holder);
      this.pickable(mesh, 'ticket');
      this.tickets.push({ g: holder, mesh: mesh, age: 0, dropping: false, vy: 0 });
      if (this.machine.sound) this.machine.sound.print();
    },
    tick: function (dt) {
      var self = this;
      this.tickets = this.tickets.filter(function (tk) {
        tk.age += dt;
        if (!tk.dropping) {
          var p = U.clamp(tk.age / 1.4, 0, 1);
          tk.g.scale.y = Math.max(0.001, p);
          tk.g.rotation.z = Math.sin(tk.age * 2) * 0.03 * p;
          tk.g.rotation.x = -0.12 * p; // stub curls toward the operator
          tk.mesh.position.y = -0.12;
          return true;
        }
        tk.vy -= dt * 3;
        tk.g.position.y += tk.vy * dt;
        tk.g.rotation.z += dt * 2;
        tk.mesh.material.opacity = Math.max(0, tk.mesh.material.opacity - dt * 0.8);
        if (tk.mesh.material.opacity <= 0) {
          self.group.remove(tk.g);
          var i = self._pickables.indexOf(tk.mesh); if (i >= 0) self._pickables.splice(i, 1);
          return false;
        }
        return true;
      });
    },
    press: function () { this.set({ page: 'LEDGER' }); if (this.machine.sound) this.machine.sound.detent(); return true; },
    tip: function (hit) {
      var n = this.machine.ledger.list().length;
      return { label: 'TICKETS · ' + n + ' journeys logged', text: this.spec.tip };
    },
  });

  /* ───────────── GEARS — visible drive train ───────────── */
  function gearShape(T, r, teeth, depth) {
    var s = new T.Shape();
    var n = teeth * 4;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var phase = i % 4;
      var rr = phase === 1 || phase === 2 ? r : r - depth;
      var x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (!i) s.moveTo(x, y); else s.lineTo(x, y);
    }
    var hole = new T.Path();
    hole.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true);
    s.holes.push(hole);
    // lightening holes
    for (var k = 0; k < 5; k++) {
      var a2 = (k / 5) * Math.PI * 2;
      var h = new T.Path();
      h.absarc(Math.cos(a2) * r * 0.55, Math.sin(a2) * r * 0.55, r * 0.15, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    return s;
  }

  TTGM.define('gears', {
    build: function () {
      var T = this.THREE, m = this.machine.mats;
      var mir = this.spec.mirror ? -1 : 1;
      var defs = [
        { r: 0.12, teeth: 18, x: 0, y: 0 },
        { r: 0.075, teeth: 11, x: mir * 0.18, y: -0.07 },
        { r: 0.05, teeth: 8, x: mir * 0.07, y: 0.14 },
      ];
      this.gears = [];
      var brass = m.brass;
      var steel = new T.MeshStandardMaterial({ color: 0x9aa4b0, metalness: 0.85, roughness: 0.3 });
      defs.forEach(function (d, i) {
        var geo = new T.ExtrudeGeometry(gearShape(T, d.r, d.teeth, d.r * 0.14), { depth: 0.018, bevelEnabled: false, curveSegments: 6 });
        var g = new T.Mesh(geo, i === 1 ? steel : brass);
        g.castShadow = true;
        g.position.set(d.x, d.y, i * 0.02);
        this.group.add(g);
        var axle = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.08, 10), steel);
        axle.rotation.x = Math.PI / 2;
        axle.position.set(d.x, d.y, i * 0.02);
        this.group.add(axle);
        this.gears.push({ mesh: g, ratio: i === 0 ? 1 : -defs[0].teeth / d.teeth });
      }, this);
      var hit = U.hitBox(T, 0.36, 0.36, 0.1);
      hit.position.x = mir * 0.06;
      this.group.add(this.pickable(hit));
      this.angle = 0;
    },
    tick: function (dt) {
      var drive = this.machine.drive || 0;
      this.angle += dt * drive * (this.spec.mirror ? -1 : 1);
      for (var i = 0; i < this.gears.length; i++) this.gears[i].mesh.rotation.z = this.angle * this.gears[i].ratio + i * 0.2;
    },
    tip: function () {
      return { label: 'DRIVE · ' + (this.machine.drive || 0).toFixed(2) + ' rad/s', text: this.spec.tip };
    },
  });
})(window.TTGM);
