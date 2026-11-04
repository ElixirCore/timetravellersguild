/* TIME MACHINE №13 — core: bus, store, component base, registry. */
(function (global) {
  'use strict';

  var TTGM = global.TTGM = global.TTGM || {};

  /* ---------- utilities ---------- */
  var U = TTGM.util = {
    clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    ease: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    pad: function (n, w) { var s = String(Math.abs(n)); while (s.length < (w || 2)) s = '0' + s; return (n < 0 ? '-' : '') + s; },
    iso: function (d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); },
    years: function (a, b) { return (b.getTime() - a.getTime()) / (365.25 * 864e5); },
    stamp: function (d) {
      if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
      return d.getUTCFullYear() + '-' + U.pad(d.getUTCMonth() + 1) + '-' + U.pad(d.getUTCDate())
        + ' ' + U.pad(d.getUTCHours()) + ':' + U.pad(d.getUTCMinutes());
    },
    /** Step a date by one wind unit (UTC, so the register and server agree). */
    step: function (d, unit, n) {
      var x = new Date(d.getTime());
      if (unit === 'YEAR') x.setUTCFullYear(x.getUTCFullYear() + n);
      else if (unit === 'MONTH') x.setUTCMonth(x.getUTCMonth() + n);
      else if (unit === 'DAY') x.setUTCDate(x.getUTCDate() + n);
      else x.setUTCHours(x.getUTCHours() + n);
      var lo = Date.UTC(1, 0, 1), hi = Date.UTC(9999, 11, 31);
      if (x.getTime() < lo) x = new Date(lo);
      if (x.getTime() > hi) x = new Date(hi);
      return x;
    },
    canvasTex: function (THREE, w, h, draw) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      var t = new THREE.CanvasTexture(c);
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
      t.userData = { canvas: c };
      return t;
    },
    labelTex: function (THREE, text, o) {
      o = o || {};
      return U.canvasTex(THREE, o.w || 256, o.h || 64, function (ctx, w, h) {
        ctx.fillStyle = o.bg || '#1a1408';
        ctx.fillRect(0, 0, w, h);
        if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 4; ctx.strokeRect(4, 4, w - 8, h - 8); }
        ctx.fillStyle = o.fg || '#d4b45a';
        ctx.font = 'bold ' + (o.size || 28) + 'px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2 + 2);
      });
    },
    labelMesh: function (THREE, text, wM, hM, o) {
      o = o || {};
      var aspect = wM / hM;
      var ph = o.h || 64;
      var tex = U.labelTex(THREE, text, Object.assign({ w: Math.round(ph * aspect), h: ph }, o));
      return new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    },
    hitBox: function (THREE, w, h, d) {
      return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    },
    lampMat: function (THREE, color) {
      return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 0.06, roughness: 0.4 });
    },
  };

  /* ---------- event bus ---------- */
  function Bus() { this._h = {}; }
  Bus.prototype.on = function (ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; };
  Bus.prototype.off = function (ev, fn) {
    var l = this._h[ev]; if (!l) return;
    var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  };
  Bus.prototype.emit = function (ev, a, b) {
    var l = (this._h[ev] || []).slice();
    for (var i = 0; i < l.length; i++) { try { l[i](a, b); } catch (e) { console.error(e); } }
  };
  TTGM.Bus = Bus;

  /* ---------- store: single source of instrument truth ---------- */
  function Store(initial) {
    this.state = Object.assign({}, initial || {});
    this._subs = [];
  }
  Store.prototype.get = function (k) { return k ? this.state[k] : this.state; };
  /** Patch state; `meta.commit` asks the machine to refetch the field. */
  Store.prototype.set = function (patch, meta) {
    var changed = {};
    var any = false;
    for (var k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      var a = this.state[k], b = patch[k];
      var same = a === b || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime());
      if (Array.isArray(a) && Array.isArray(b)) same = a.join('|') === b.join('|');
      if (!same) { this.state[k] = b; changed[k] = true; any = true; }
    }
    if (any || (meta && meta.force)) {
      for (var i = 0; i < this._subs.length; i++) this._subs[i](this.state, changed, meta || {});
    }
    return any;
  };
  Store.prototype.subscribe = function (fn) { this._subs.push(fn); };
  TTGM.Store = Store;

  /* ---------- component base ---------- */
  /**
   * Every part on the machine. Subclasses build a THREE.Group, mark meshes
   * pickable, and react to store changes. Interaction hooks (all optional):
   *   press(hit, pt) → bool  capture the pointer
   *   drag(pt, d)            d = {dx, dy} pixels since last move
   *   release(pt, moved)
   *   wheel(dir)
   *   tip(hit) → {label, text}
   */
  function Component(machine, spec) {
    this.machine = machine;
    this.spec = spec || {};
    this.id = this.spec.id || this.spec.type;
    this.THREE = machine.THREE;
    this.group = new this.THREE.Group();
    this.group.name = this.spec.type + ':' + this.id;
    var p = this.spec.pos || [0, 0, 0];
    this.group.position.set(p[0], p[1], p[2]);
    if (this.spec.rot) this.group.rotation.set(this.spec.rot[0], this.spec.rot[1], this.spec.rot[2]);
    if (this.spec.scale) this.group.scale.setScalar(this.spec.scale);
    this._pickables = [];
  }
  Component.prototype.build = function () {};
  Component.prototype.update = function () {};
  Component.prototype.tick = function () {};
  Component.prototype.pickable = function (mesh, part) {
    mesh.userData.component = this;
    if (part != null) mesh.userData.part = part;
    this._pickables.push(mesh);
    return mesh;
  };
  Component.prototype.pickables = function () { return this._pickables; };
  Component.prototype.tip = function () {
    return { label: this.spec.label || this.id.toUpperCase(), text: this.spec.tip || '' };
  };
  Component.prototype.store = function () { return this.machine.store; };
  Component.prototype.val = function (k) { return this.machine.store.get(k || this.spec.bind); };
  Component.prototype.set = function (patch, meta) { return this.machine.store.set(patch, meta); };
  Component.prototype.act = function (name, args) {
    return this.machine.act(name || this.spec.action, args || this.spec.args || {}, this);
  };
  Component.prototype.click = function () { if (this.machine.sound) this.machine.sound.click(); };
  TTGM.Component = Component;

  /* ---------- registry ---------- */
  var types = {};
  TTGM.define = function (type, proto, base) {
    var Base = base || Component;
    function Ctor(machine, spec) { Base.call(this, machine, spec); }
    Ctor.prototype = Object.create(Base.prototype);
    Ctor.prototype.constructor = Ctor;
    Object.keys(proto).forEach(function (k) { Ctor.prototype[k] = proto[k]; });
    Ctor.type = type;
    types[type] = Ctor;
    return Ctor;
  };
  TTGM.create = function (machine, spec) {
    var Ctor = types[spec.type];
    if (!Ctor) { console.warn('TTGM: unknown component type', spec.type); return null; }
    var c = new Ctor(machine, spec);
    c.build();
    return c;
  };
  TTGM.types = function () { return Object.keys(types); };

  /* ---------- actions registry ---------- */
  var actions = {};
  TTGM.action = function (name, fn) { actions[name] = fn; };
  TTGM.actions = actions;
})(window);
