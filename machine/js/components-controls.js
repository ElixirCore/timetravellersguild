/* TIME MACHINE №13 — operator components: things you turn, press and pull. */
(function (TTGM) {
  'use strict';

  var U = TTGM.util;

  function knobBody(THREE, opts) {
    var g = new THREE.Group();
    var r = opts.r || 0.058;
    var body = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.94, r * 1.06, 0.055, 32),
      new THREE.MeshStandardMaterial({ color: opts.brass ? 0x1a1814 : 0x121212, roughness: 0.5, metalness: opts.brass ? 0.4 : 0.18 })
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    // knurled grip — ring of ribs
    var ribGeo = new THREE.BoxGeometry(0.006, 0.006, 0.05);
    var ribMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.3 });
    for (var i = 0; i < 24; i++) {
      var a = (i / 24) * Math.PI * 2;
      var rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(Math.cos(a) * r * 1.0, Math.sin(a) * r * 1.0, 0);
      rib.rotation.z = a;
      g.add(rib);
    }
    if (opts.brass) {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(r + 0.004, 0.008, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0xb08d3a, roughness: 0.35, metalness: 0.85 })
      );
      ring.position.z = 0.012;
      g.add(ring);
    }
    var cap = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.55, r * 0.6, 0.01, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a7a50, roughness: 0.3, metalness: 0.9 })
    );
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.03;
    g.add(cap);
    var mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, r * 0.75, 0.012),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, emissive: 0x664400, emissiveIntensity: 0.6 })
    );
    mark.position.set(0, r * 0.55, 0.032);
    g.add(mark);
    return g;
  }

  /** Engraved scale around a knob: ticks + optional text labels. */
  function dialScale(THREE, r, sweep, ticks, labels) {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: 0xc9b070 });
    for (var i = 0; i <= ticks; i++) {
      var t = i / ticks;
      var a = Math.PI / 2 + sweep / 2 - t * sweep; // left→right over top
      var major = labels ? true : i % 5 === 0;
      var tick = new THREE.Mesh(new THREE.PlaneGeometry(major ? 0.004 : 0.0025, major ? 0.018 : 0.01), mat);
      var rr = r + (major ? 0.012 : 0.008);
      tick.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      tick.rotation.z = a - Math.PI / 2;
      g.add(tick);
      if (labels && labels[i]) {
        var lm = U.labelMesh(THREE, labels[i], 0.05, 0.018, { bg: '#1a2a40', fg: '#e6d39a', size: 40, h: 48 });
        var lr = r + 0.042;
        lm.position.set(Math.cos(a) * lr, Math.sin(a) * lr, 0.001);
        g.add(lm);
      }
    }
    return g;
  }

  function labelPlate(THREE, text) {
    var g = new THREE.Group();
    var plate = U.labelMesh(THREE, text, 0.18, 0.045, { bg: '#1a1408', fg: '#d4b45a', border: '#6a5828', size: 30 });
    g.add(plate);
    return g;
  }

  /* ───────────── KNOB — continuous value ───────────── */
  TTGM.define('knob', {
    build: function () {
      var T = this.THREE, s = this.spec;
      this.min = s.min != null ? s.min : 0;
      this.max = s.max != null ? s.max : 1;
      this.sweep = (s.sweep || 1.6) * Math.PI;
      this.knob = knobBody(T, { brass: s.brass });
      this.group.add(this.knob);
      this.group.add(dialScale(T, 0.066, this.sweep, 20));
      var lp = labelPlate(T, s.label || this.id);
      lp.position.set(0, -0.112, 0.01);
      this.group.add(lp);
      var hit = U.hitBox(T, 0.16, 0.16, 0.08);
      hit.position.z = 0.02;
      this.group.add(this.pickable(hit));
      this.shown = this._norm(this.val());
    },
    _norm: function (v) { return (U.clamp(v == null ? this.min : v, this.min, this.max) - this.min) / (this.max - this.min); },
    tick: function (dt) {
      var target = this._norm(this.val());
      this.shown += (target - this.shown) * Math.min(1, dt * 18);
      this.knob.rotation.z = this.sweep / 2 - this.shown * this.sweep;
    },
    _nudge: function (amt, commit) {
      var v = U.clamp((this.val() || 0) + amt * (this.max - this.min), this.min, this.max);
      var p = {}; p[this.spec.bind] = v;
      this.set(p, { commit: !!commit, source: this.id });
      var step = Math.floor(v * 40);
      if (step !== this._lastStep) { this._lastStep = step; if (this.machine.sound) this.machine.sound.tick(); }
    },
    press: function () { return true; },
    drag: function (pt, d) { this._nudge((d.dx - d.dy) * 0.0035, false); },
    release: function (pt, moved) { if (moved) this.set({}, { commit: true, force: true, source: this.id }); },
    wheel: function (dir) { this._nudge(-dir * 0.025, true); },
    tip: function () {
      var v = this.val();
      return { label: (this.spec.label || this.id) + '  ' + (typeof v === 'number' ? v.toFixed(3) : '—'), text: this.spec.tip || '' };
    },
  });

  /* ───────────── SELECTOR — detented rotary switch ───────────── */
  TTGM.define('selector', {
    build: function () {
      var T = this.THREE, s = this.spec;
      this.options = s.options || [];
      this.sweep = Math.PI * 1.1;
      this.knob = new T.Group();
      var body = new T.Mesh(
        new T.CylinderGeometry(0.05, 0.056, 0.05, 6),
        new T.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.45, metalness: 0.25 })
      );
      body.rotation.x = Math.PI / 2;
      this.knob.add(body);
      var pointer = new T.Mesh(
        new T.BoxGeometry(0.014, 0.07, 0.014),
        new T.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.4, emissive: 0x332a10, emissiveIntensity: 0.4 })
      );
      pointer.position.set(0, 0.03, 0.03);
      this.knob.add(pointer);
      this.group.add(this.knob);
      var n = this.options.length;
      this.group.add(dialScale(T, 0.066, this.sweep, Math.max(1, n - 1), s.short || this.options));
      // position lamps
      this.lamps = [];
      for (var i = 0; i < n; i++) {
        var a = this._angle(i);
        var lamp = new T.Mesh(new T.SphereGeometry(0.006, 8, 8), U.lampMat(T, 0xffaa33));
        lamp.position.set(Math.cos(a) * 0.072, Math.sin(a) * 0.072, 0.01);
        this.group.add(lamp);
        this.lamps.push(lamp);
      }
      var lp = labelPlate(T, s.label || this.id);
      lp.position.set(0, -0.112, 0.01);
      this.group.add(lp);
      var hit = U.hitBox(T, 0.2, 0.2, 0.08);
      hit.position.z = 0.02;
      this.group.add(this.pickable(hit));
      this.shownAngle = this._angle(this._index());
    },
    _angle: function (i) {
      var n = Math.max(1, this.options.length - 1);
      return Math.PI / 2 + this.sweep / 2 - (i / n) * this.sweep;
    },
    _index: function () { return Math.max(0, this.options.indexOf(this.val())); },
    _step: function (n) {
      var i = U.clamp(this._index() + n, 0, this.options.length - 1);
      if (i === this._index()) return;
      var p = {}; p[this.spec.bind] = this.options[i];
      this.set(p, { commit: !!this.spec.commit, source: this.id });
      if (this.machine.sound) this.machine.sound.detent();
    },
    tick: function (dt, t) {
      var target = this._angle(this._index()) - Math.PI / 2;
      this.shownAngle += (target - this.shownAngle) * Math.min(1, dt * 22);
      this.knob.rotation.z = this.shownAngle;
      var idx = this._index();
      for (var i = 0; i < this.lamps.length; i++) {
        this.lamps[i].material.emissiveIntensity = i === idx ? 1.1 : 0.05;
      }
    },
    press: function () { this._acc = 0; return true; },
    drag: function (pt, d) {
      this._acc += d.dx - d.dy;
      if (Math.abs(this._acc) > 28) { this._step(this._acc > 0 ? 1 : -1); this._acc = 0; }
    },
    release: function (pt, moved) {
      if (!moved) {
        var i = (this._index() + 1) % this.options.length;
        var p = {}; p[this.spec.bind] = this.options[i];
        this.set(p, { commit: !!this.spec.commit, source: this.id });
        if (this.machine.sound) this.machine.sound.detent();
      }
    },
    wheel: function (dir) { this._step(dir > 0 ? -1 : 1); },
    tip: function () {
      return { label: (this.spec.label || this.id) + ' · ' + this.val(), text: this.spec.tip || '' };
    },
  });

  /* ───────────── CLOCK — wind the machine present ───────────── */
  TTGM.define('clock', {
    build: function () {
      var T = this.THREE, s = this.spec;
      this.units = s.units || ['YEAR', 'MONTH', 'DAY', 'HOUR'];
      this.knob = knobBody(T, { brass: true, r: 0.06 });
      this.group.add(this.knob);
      this.group.add(dialScale(T, 0.068, Math.PI * 2 - 0.01, 60));
      var lp = labelPlate(T, s.label || 'PRESENT');
      lp.position.set(0, -0.112, 0.01);
      this.group.add(lp);
      this.lamps = [];
      for (var i = 0; i < this.units.length; i++) {
        var lamp = new T.Mesh(new T.BoxGeometry(0.034, 0.011, 0.012), U.lampMat(T, 0x66cc55));
        lamp.position.set((i - (this.units.length - 1) / 2) * 0.042, -0.148, 0.015);
        this.group.add(lamp);
        this.lamps.push(lamp);
      }
      var hit = U.hitBox(T, 0.17, 0.17, 0.08);
      hit.position.z = 0.02;
      this.group.add(this.pickable(hit));
      this.spin = 0;
    },
    _unit: function () { return this.machine.store.get('wind') || this.units[0]; },
    tick: function (dt) {
      this.knob.rotation.z += (this.spin - this.knob.rotation.z) * Math.min(1, dt * 16);
      var u = this._unit();
      for (var i = 0; i < this.lamps.length; i++) this.lamps[i].material.emissiveIntensity = this.units[i] === u ? 1.0 : 0.05;
    },
    _wind: function (n, commit) {
      var d = this.machine.store.get('present');
      this.set({ present: U.step(d, this._unit(), n) }, { commit: !!commit, source: this.id });
      this.spin -= n * 0.18;
      if (this.machine.sound) this.machine.sound.tick();
    },
    press: function () { this._acc = 0; return true; },
    drag: function (pt, d) {
      this._acc += d.dx - d.dy;
      while (Math.abs(this._acc) > 12) {
        var n = this._acc > 0 ? 1 : -1;
        this._wind(n, false);
        this._acc -= n * 12;
      }
    },
    release: function (pt, moved) {
      if (moved) { this.set({}, { commit: true, force: true, source: this.id }); return; }
      var i = this.units.indexOf(this._unit());
      this.set({ wind: this.units[(i + 1) % this.units.length] });
      if (this.machine.sound) this.machine.sound.detent();
    },
    wheel: function (dir) { this._wind(dir > 0 ? -1 : 1, true); },
    tip: function () {
      return { label: 'PRESENT · ' + U.stamp(this.machine.store.get('present')) + ' · wind ' + this._unit(), text: this.spec.tip || '' };
    },
  });

  /* ───────────── KEY — momentary or latching push key ───────────── */
  TTGM.define('key', {
    build: function () {
      var T = this.THREE, s = this.spec;
      var bezel = new T.Mesh(
        new T.BoxGeometry(0.3, 0.08, 0.04),
        new T.MeshStandardMaterial({ color: 0x3a4555, metalness: 0.55, roughness: 0.5 })
      );
      this.group.add(bezel);
      this.cap = new T.Group();
      this.backer = new T.Mesh(
        new T.BoxGeometry(0.26, 0.055, 0.016),
        new T.MeshStandardMaterial({ color: 0x1a2218, emissive: 0x335533, emissiveIntensity: 0.15, roughness: 0.6, metalness: 0.2 })
      );
      this.backer.position.z = 0.014;
      this.cap.add(this.backer);
      var face = U.labelMesh(T, s.label || this.id, 0.24, 0.05, { bg: '#142018', fg: '#a8d8a8', border: '#6a9a6a', size: 34 });
      face.position.z = 0.023;
      this.cap.add(face);
      this.group.add(this.cap);
      this.group.add(this.pickable(U.hitBox(T, 0.32, 0.1, 0.08)));
      this.depress = 0;
    },
    tick: function (dt) {
      this.depress = Math.max(0, this.depress - dt * 5);
      var lit = this.spec.latch && this.val(this.spec.latch);
      this.cap.position.z = -0.012 * Math.min(1, this.depress * 3) - (lit ? 0.006 : 0);
      this.backer.material.emissive.setHex(lit ? 0xcc7722 : 0x335533);
      this.backer.material.emissiveIntensity = lit ? 0.9 : 0.15 + this.depress * 0.6;
    },
    press: function () {
      this.depress = 1;
      if (this.machine.sound) this.machine.sound.click();
      this.act();
      return true;
    },
  });

  /* ───────────── PLAQUE — brass nameplate that does one thing ───────────── */
  TTGM.define('plaque', {
    build: function () {
      var T = this.THREE, s = this.spec;
      var plate = new T.Mesh(new T.BoxGeometry(0.46, 0.13, 0.025), this.machine.mats.brass);
      this.group.add(plate);
      var face = U.labelMesh(T, s.text || s.label || this.id, 0.42, 0.1, { bg: '#3a2a10', fg: '#f0d080', size: 40 });
      face.position.z = 0.014;
      this.group.add(face);
      [-0.2, 0.2].forEach(function (x) {
        var screw = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.01, 10), new T.MeshStandardMaterial({ color: 0x6a5a30, metalness: 0.9, roughness: 0.3 }));
        screw.rotation.x = Math.PI / 2;
        screw.position.set(x, 0, 0.016);
        this.group.add(screw);
      }, this);
      this.group.add(this.pickable(U.hitBox(T, 0.48, 0.15, 0.06)));
    },
    press: function () { this.act(); return true; },
  });

  /* ───────────── LEVER — the big one ───────────── */
  TTGM.define('lever', {
    build: function () {
      var T = this.THREE, s = this.spec, m = this.machine.mats;
      var len = s.length || 0.5;
      // side mounting plate + quadrant
      var mount = new T.Mesh(new T.BoxGeometry(0.05, 0.62, 0.42), m.steel);
      mount.position.set(-0.05, 0, 0.05);
      this.group.add(mount);
      var quad = new T.Mesh(
        new T.RingGeometry(len * 0.62, len * 0.72, 32, 1, -Math.PI * 0.62, Math.PI * 0.68),
        new T.MeshStandardMaterial({ color: 0x8a7030, metalness: 0.85, roughness: 0.35, side: T.DoubleSide })
      );
      quad.rotation.y = Math.PI / 2;
      quad.position.x = 0.03;
      this.group.add(quad);
      // notch lamps along the quadrant: SAFE → ENGAGE
      this.notches = [];
      for (var i = 0; i < 6; i++) {
        var a = (i / 5) * 1.9;
        var lamp = new T.Mesh(new T.SphereGeometry(0.01, 8, 8), U.lampMat(T, i === 5 ? 0xff4422 : 0x66ff88));
        lamp.position.set(0.035, Math.cos(a) * len * 0.78, Math.sin(a) * len * 0.78);
        this.group.add(lamp);
        this.notches.push(lamp);
      }
      this.pivot = new T.Group();
      this.pivot.position.x = 0.06;
      this.group.add(this.pivot);
      var hub = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.06, 20), m.brass);
      hub.rotation.z = Math.PI / 2;
      this.pivot.add(hub);
      var arm = new T.Mesh(new T.CylinderGeometry(0.014, 0.018, len, 12), m.steel);
      arm.position.y = len / 2;
      this.pivot.add(arm);
      var ball = new T.Mesh(
        new T.SphereGeometry(0.055, 24, 16),
        new T.MeshStandardMaterial({ color: 0xaa1a14, roughness: 0.25, metalness: 0.1, emissive: 0x330000, emissiveIntensity: 0.3 })
      );
      ball.position.y = len + 0.03;
      this.ball = ball;
      this.pivot.add(ball);
      var hit = U.hitBox(T, 0.16, len + 0.2, 0.16);
      hit.position.y = len / 2 + 0.05;
      this.pivot.add(this.pickable(hit));
      var lab = U.labelMesh(T, s.label || 'ENGAGE', 0.2, 0.045, { bg: '#2a0a08', fg: '#ff9a7a', border: '#7a2a20', size: 30 });
      lab.position.set(0.035, -0.26, 0.18);
      lab.rotation.y = 0.25;
      this.group.add(lab);
      this.angle = 0;
      this.vel = 0;
      this.MAX = 1.9;
      this.held = false;
    },
    tick: function (dt) {
      var locked = this.val('travelling');
      if (!this.held) {
        var target = locked ? this.MAX : 0;
        // damped spring back with a little bounce
        var k = 60, c = 9;
        this.vel += ((target - this.angle) * k - this.vel * c) * dt;
        this.angle += this.vel * dt;
      }
      this.angle = U.clamp(this.angle, -0.05, this.MAX + 0.05);
      this.pivot.rotation.x = this.angle;
      var frac = this.angle / this.MAX;
      for (var i = 0; i < this.notches.length; i++) {
        this.notches[i].material.emissiveIntensity = frac >= i / 5 - 0.02 ? 1 : 0.06;
      }
      this.ball.material.emissiveIntensity = 0.3 + (locked ? 0.6 + Math.sin(performance.now() / 90) * 0.3 : frac * 0.5);
    },
    press: function () {
      if (this.val('travelling')) return true;
      this.held = true;
      this.vel = 0;
      return true;
    },
    drag: function (pt, d) {
      if (!this.held) return;
      var before = this.angle;
      this.angle = U.clamp(this.angle + (d.dy - d.dx * 0.3) * 0.009, 0, this.MAX);
      if (Math.floor(before * 3) !== Math.floor(this.angle * 3) && this.machine.sound) this.machine.sound.ratchet();
    },
    release: function (pt, moved) {
      if (!this.held) return;
      this.held = false;
      if (!moved || this.angle > this.MAX * 0.82) {
        this.angle = this.MAX;
        if (this.machine.sound) this.machine.sound.clunk();
        this.act();
      }
    },
    tip: function () {
      var j = this.machine.journeyPreview();
      var text = this.spec.tip || '';
      if (j) {
        text += ' → ' + j.label + ' (' + j.when + '). Δ ' + j.years + ' y. Cost ' + j.cost.toFixed(2) + ' / charge ' + j.capacity.toFixed(2)
          + (j.cost > j.capacity ? ' — INSUFFICIENT.' : ' — OK.');
      }
      return { label: 'TRAVEL', text: text };
    },
  });

  /* ───────────── BANK — one toggle per record kind ───────────── */
  TTGM.define('bank', {
    build: function () {
      var T = this.THREE, m = this.machine.mats;
      this.max = this.spec.max || 9;
      this.pitch = 0.105;
      var h = this.max * this.pitch + 0.16;
      var plate = new T.Mesh(new T.BoxGeometry(0.36, h, 0.05), m.steel);
      plate.position.set(0, 0, -0.02);
      this.group.add(plate);
      var arm = new T.Mesh(new T.BoxGeometry(0.16, 0.08, 0.3), m.steel);
      arm.position.set(0.16, 0.3, -0.18);
      this.group.add(arm);
      var arm2 = arm.clone();
      arm2.position.y = -0.3;
      this.group.add(arm2);
      var title = U.labelMesh(T, this.spec.label || 'SELECTOR', 0.3, 0.05, { bg: '#1a1408', fg: '#d4b45a', border: '#6a5828', size: 30 });
      title.position.set(0, h / 2 - 0.05, 0.01);
      this.group.add(title);
      this.rows = [];
      this.top = h / 2 - 0.13;
      this.sig = '';
    },
    _types: function () {
      var srv = this.val('server') || {};
      var tc = srv.type_counts || {};
      return Object.keys(tc).slice(0, this.max).map(function (k) { return { type: k, count: tc[k] }; });
    },
    _rebuild: function (types) {
      var T = this.THREE, self = this;
      this.rows.forEach(function (r) { self.group.remove(r.g); });
      this._pickables = [];
      this.rows = [];
      types.forEach(function (t, i) {
        var g = new T.Group();
        g.position.set(0, self.top - i * self.pitch, 0.01);
        var name = t.type.replace(/_/g, ' ');
        if (name.length > 11) name = name.slice(0, 10) + '.';
        var lab = U.labelMesh(T, name, 0.19, 0.036, { bg: '#121820', fg: '#c8d8c8', size: 26, h: 48 });
        lab.position.set(-0.06, 0, 0.004);
        g.add(lab);
        var boss = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.012, 12), self.machine.mats.brass);
        boss.rotation.x = Math.PI / 2;
        boss.position.set(0.085, 0, 0.006);
        g.add(boss);
        var bat = new T.Group();
        bat.position.set(0.085, 0, 0.012);
        var stick = new T.Mesh(new T.CylinderGeometry(0.006, 0.008, 0.05, 8), new T.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9, roughness: 0.25 }));
        stick.position.y = 0.025;
        bat.add(stick);
        g.add(bat);
        var lamp = new T.Mesh(new T.SphereGeometry(0.009, 10, 8), U.lampMat(T, 0x66ff88));
        lamp.position.set(0.14, 0, 0.008);
        g.add(lamp);
        var hit = U.hitBox(T, 0.34, self.pitch * 0.92, 0.06);
        hit.userData.kind = t.type;
        g.add(self.pickable(hit, t.type));
        self.group.add(g);
        self.rows.push({ g: g, bat: bat, lamp: lamp, type: t.type, count: t.count, tilt: 0 });
      });
    },
    update: function (state, changed) {
      if (!changed.server && this.rows.length) return;
      var types = this._types();
      var sig = types.map(function (t) { return t.type; }).join('|');
      if (sig !== this.sig) { this.sig = sig; this._rebuild(types); }
      types.forEach(function (t, i) { if (this.rows[i]) this.rows[i].count = t.count; }, this);
    },
    tick: function (dt, t) {
      var ex = this.val('excluded') || [];
      var maxC = 1;
      this.rows.forEach(function (r) { maxC = Math.max(maxC, r.count); });
      this.rows.forEach(function (r) {
        var on = ex.indexOf(r.type) < 0;
        var target = on ? -0.6 : 0.6;
        r.tilt += (target - r.tilt) * Math.min(1, dt * 20);
        r.bat.rotation.x = r.tilt;
        var lvl = 0.25 + 0.75 * Math.sqrt(r.count / maxC);
        r.lamp.material.emissive.setHex(on ? 0x66ff88 : 0xff4422);
        r.lamp.material.emissiveIntensity = on ? lvl * (0.85 + Math.sin(t * 3 + r.count) * 0.15) : 0.25;
      });
    },
    press: function (hit) {
      var type = hit && hit.object.userData.part;
      if (!type) return false;
      var ex = (this.val('excluded') || []).slice();
      var i = ex.indexOf(type);
      if (i >= 0) ex.splice(i, 1); else ex.push(type);
      this.set({ excluded: ex }, { commit: true, source: this.id });
      if (this.machine.sound) this.machine.sound.toggle();
      return true;
    },
    tip: function (hit) {
      var type = hit && hit.object.userData.part;
      if (!type) return TTGM.Component.prototype.tip.call(this);
      var row = this.rows.filter(function (r) { return r.type === type; })[0];
      var on = (this.val('excluded') || []).indexOf(type) < 0;
      return {
        label: type + ' · ' + (row ? row.count : 0) + ' on file',
        text: (on ? 'IN the field. Click to exclude ' : 'EXCLUDED. Click to readmit ') + type + ' records. Matter and the punchcards follow.',
      };
    },
  });

  /* ───────────── DRUM — destination selector ───────────── */
  TTGM.define('drum', {
    build: function () {
      var T = this.THREE, m = this.machine.mats;
      var housing = new T.Mesh(new T.BoxGeometry(0.5, 0.26, 0.1), m.steel);
      housing.position.z = -0.03;
      this.group.add(housing);
      this.cyl = new T.Group();
      var cyl = new T.Mesh(
        new T.CylinderGeometry(0.1, 0.1, 0.46, 24, 1, true),
        new T.MeshStandardMaterial({ color: 0xd8ccaa, roughness: 0.8, side: T.DoubleSide })
      );
      cyl.rotation.z = Math.PI / 2;
      this.cyl.add(cyl);
      for (var i = 0; i < 12; i++) {
        var rib = new T.Mesh(new T.BoxGeometry(0.46, 0.003, 0.004), new T.MeshBasicMaterial({ color: 0x5a5040 }));
        var a = (i / 12) * Math.PI * 2;
        rib.position.set(0, Math.cos(a) * 0.101, Math.sin(a) * 0.101);
        rib.rotation.x = -a;
        this.cyl.add(rib);
      }
      this.cyl.position.z = -0.095;
      this.group.add(this.cyl);
      this.tex = U.canvasTex(T, 512, 256, function () {});
      var win = new T.Mesh(new T.PlaneGeometry(0.44, 0.22), new T.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
      win.position.z = 0.032;
      this.group.add(win);
      var top = U.hitBox(T, 0.5, 0.13, 0.08); top.position.set(0, 0.065, 0.03);
      var bot = U.hitBox(T, 0.5, 0.13, 0.08); bot.position.set(0, -0.065, 0.03);
      this.group.add(this.pickable(top, -1));
      this.group.add(this.pickable(bot, 1));
      var lab = U.labelMesh(T, this.spec.label || 'DESTINATION', 0.3, 0.04, { bg: '#1a1408', fg: '#d4b45a', size: 28 });
      lab.position.set(0, -0.16, 0.02);
      this.group.add(lab);
      this.roll = 0;
      this._sig = '';
    },
    _draw: function () {
      var list = this.machine.destinations();
      var idx = U.clamp(this.val() || 0, 0, Math.max(0, list.length - 1));
      var c = this.tex.userData.canvas, ctx = c.getContext('2d');
      var w = c.width, h = c.height;
      ctx.fillStyle = '#e4d8b8'; ctx.fillRect(0, 0, w, h);
      var grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.3, 'rgba(0,0,0,0)');
      grd.addColorStop(0.7, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      function row(d, y, big) {
        if (!d) return;
        ctx.fillStyle = big ? '#1a1206' : '#5a4a30';
        ctx.font = 'bold ' + (big ? 34 : 24) + 'px "Courier New", monospace';
        var t = d.label; if (t.length > (big ? 22 : 30)) t = t.slice(0, big ? 21 : 29) + '…';
        ctx.fillText(t, 20, y - (big ? 14 : 0));
        if (big) {
          ctx.font = 'bold 26px "Courier New", monospace';
          ctx.fillStyle = '#7a2a10';
          ctx.fillText(d.when + '  ' + d.kind, 20, y + 22);
        }
      }
      row(list[idx - 1], 30, false);
      ctx.fillStyle = 'rgba(200,60,30,0.12)'; ctx.fillRect(0, 74, w, 108);
      ctx.strokeStyle = '#7a2a10'; ctx.lineWidth = 3; ctx.strokeRect(6, 74, w - 12, 108);
      row(list[idx], 128, true);
      row(list[idx + 1], 226, false);
      ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1206'; ctx.font = 'bold 22px "Courier New", monospace'; ctx.textAlign = 'right';
      ctx.fillText((idx + 1) + '/' + list.length, w - 16, 196);
      ctx.fillText('▲', w - 16, 26); ctx.fillText('▼', w - 16, 234);
      this.tex.needsUpdate = true;
    },
    update: function (state, changed) {
      if (changed.destIndex || changed.server || changed.present || !this._drawn) { this._draw(); this._drawn = true; }
    },
    tick: function (dt) {
      this.roll *= Math.max(0, 1 - dt * 8);
      this.cyl.rotation.x = this.roll;
    },
    _step: function (n) {
      var list = this.machine.destinations();
      var i = U.clamp((this.val() || 0) + n, 0, list.length - 1);
      if (i === this.val()) return;
      this.set({ destIndex: i });
      this.roll += n * 0.5;
      if (this.machine.sound) this.machine.sound.detent();
    },
    press: function (hit) { this._acc = 0; this._dir = hit.object.userData.part; return true; },
    drag: function (pt, d) {
      this._acc += d.dy;
      while (Math.abs(this._acc) > 18) { var n = this._acc > 0 ? 1 : -1; this._step(n); this._acc -= n * 18; }
    },
    release: function (pt, moved) { if (!moved) this._step(this._dir || 1); },
    wheel: function (dir) { this._step(dir > 0 ? 1 : -1); },
    tip: function () {
      var d = this.machine.destination();
      return { label: 'DESTINATION · ' + (d ? d.label : '—'), text: (d ? d.when + ' · ' + d.kind + '. ' : '') + (this.spec.tip || '') };
    },
  });

  /* ───────────── NIXIE REGISTER — machine present, settable digit groups ───────────── */
  TTGM.define('nixie', {
    build: function () {
      var T = this.THREE, m = this.machine.mats;
      this.groups = this.spec.groups || ['YEAR', 'MONTH', 'DAY', 'HOUR'];
      // tube layout: YYYY MM DD HH → 10 tubes with gaps
      this.layout = [];
      var widths = { YEAR: 4, MONTH: 2, DAY: 2, HOUR: 2 };
      var x = 0, pitch = 0.062, gap = 0.04;
      this.groups.forEach(function (g) {
        var n = widths[g] || 2;
        this.layout.push({ unit: g, x0: x, n: n });
        x += n * pitch + gap;
      }, this);
      this.width = x - gap;
      this.pitch = pitch;
      var box = new T.Mesh(new T.BoxGeometry(this.width + 0.08, 0.2, 0.12), new T.MeshStandardMaterial({ color: 0x15100a, roughness: 0.7, metalness: 0.2 }));
      box.position.z = -0.05;
      this.group.add(box);
      this.tex = U.canvasTex(T, 1024, 192, function () {});
      var face = new T.Mesh(new T.PlaneGeometry(this.width + 0.04, 0.16), new T.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
      face.position.z = 0.012;
      this.group.add(face);
      var glass = new T.MeshPhysicalMaterial
        ? new T.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, clearcoat: 1 })
        : new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 });
      var self = this;
      this.layout.forEach(function (L) {
        for (var i = 0; i < L.n; i++) {
          var tube = new T.Mesh(new T.CylinderGeometry(0.027, 0.027, 0.15, 16, 1, true), glass);
          tube.position.set(-self.width / 2 + L.x0 + (i + 0.5) * pitch, 0, 0.03);
          self.group.add(tube);
        }
        var w = L.n * pitch;
        var cx = -self.width / 2 + L.x0 + w / 2;
        var up = U.hitBox(T, w, 0.09, 0.08); up.position.set(cx, 0.045, 0.04);
        var dn = U.hitBox(T, w, 0.09, 0.08); dn.position.set(cx, -0.045, 0.04);
        self.group.add(self.pickable(up, L.unit + ':1'));
        self.group.add(self.pickable(dn, L.unit + ':-1'));
      });
      var lab = U.labelMesh(T, this.spec.label || 'MACHINE PRESENT', 0.4, 0.04, { bg: '#1a1408', fg: '#d4b45a', size: 28 });
      lab.position.set(0, 0.13, 0.02);
      this.group.add(lab);
      this.light = new T.PointLight(0xff8a30, 0.5, 1.2);
      this.light.position.set(0, 0, 0.25);
      this.group.add(this.light);
      this._last = '';
    },
    _digits: function (d) {
      var out = {};
      out.YEAR = U.pad(d.getUTCFullYear(), 4).slice(-4);
      out.MONTH = U.pad(d.getUTCMonth() + 1);
      out.DAY = U.pad(d.getUTCDate());
      out.HOUR = U.pad(d.getUTCHours());
      return out;
    },
    tick: function (dt, t) {
      var d = this.val('transitPresent') || this.val('present');
      if (!(d instanceof Date)) return;
      var dig = this._digits(d);
      var travelling = !!this.val('transitPresent');
      var key = JSON.stringify(dig) + (travelling ? Math.floor(t * 20) : '');
      this.light.intensity = 0.4 + (travelling ? 0.4 + Math.random() * 0.4 : 0);
      if (key === this._last) return;
      this._last = key;
      var c = this.tex.userData.canvas, ctx = c.getContext('2d');
      var W = c.width, H = c.height;
      ctx.fillStyle = '#0a0604'; ctx.fillRect(0, 0, W, H);
      var sx = W / (this.width + 0.04);
      var self = this;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      this.layout.forEach(function (L) {
        var s = dig[L.unit] || '';
        for (var i = 0; i < L.n; i++) {
          var cx = (0.02 + L.x0 + (i + 0.5) * self.pitch) * sx;
          // ghost cathodes
          ctx.font = 'bold 120px "Courier New", monospace';
          ctx.fillStyle = 'rgba(80,40,20,0.35)';
          ctx.fillText('8', cx, H / 2 + 6);
          var ch = s.charAt(i);
          if (travelling && Math.random() < 0.15) ch = String(Math.floor(Math.random() * 10));
          ctx.shadowColor = '#ff7a20'; ctx.shadowBlur = 26;
          ctx.fillStyle = '#ffb060';
          ctx.fillText(ch, cx, H / 2 + 6);
          ctx.shadowBlur = 0;
        }
        // group separators
      });
      this.tex.needsUpdate = true;
    },
    press: function (hit) {
      if (this.val('travelling')) return true;
      var p = String(hit.object.userData.part || '').split(':');
      var unit = p[0], n = parseInt(p[1], 10) || 1;
      this.set({ present: U.step(this.val('present'), unit, n), wind: unit }, { commit: true, source: this.id });
      if (this.machine.sound) this.machine.sound.tick();
      return true;
    },
    tip: function (hit) {
      var p = String((hit && hit.object.userData.part) || '').split(':');
      return {
        label: 'REGISTER · ' + U.stamp(this.val('present')) + ' UTC',
        text: p[0] ? ((p[1] === '1' ? 'Advance ' : 'Retard ') + p[0] + ' by one. ' + this.spec.tip) : this.spec.tip,
      };
    },
  });
})(window.TTGM);
