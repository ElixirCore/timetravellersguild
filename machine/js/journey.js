/* TIME MACHINE №13 — travel: costing, the jump sequence, and the ledger. */
(function (TTGM) {
  'use strict';

  var U = TTGM.util;

  /* ---------- ledger: journeys kept in this browser ---------- */
  function Ledger(key) {
    this.key = key || 'ttg.machine.ledger';
    this.items = [];
    try { this.items = JSON.parse(localStorage.getItem(this.key) || '[]') || []; } catch (e) { this.items = []; }
    if (!Array.isArray(this.items)) this.items = [];
  }
  Ledger.prototype.list = function () { return this.items; };
  Ledger.prototype.add = function (entry) {
    entry.n = (this.items.length ? (this.items[0].n || 0) : 0) + 1;
    this.items.unshift(entry);
    this.items = this.items.slice(0, 40);
    try { localStorage.setItem(this.key, JSON.stringify(this.items)); } catch (e) {}
    return entry;
  };
  TTGM.Ledger = Ledger;

  /* ---------- costing ---------- */
  TTGM.travelCost = function (cfg, from, to, emergyDisplay) {
    var yrs = Math.abs(U.years(from, to));
    var cost = (cfg.cost_base || 0.18) + (cfg.cost_per_decade || 0.24) * Math.log10(1 + yrs);
    var capacity = (cfg.capacity_base || 0.38) + (cfg.capacity_gain || 1) * (emergyDisplay || 0);
    return { years: yrs, cost: U.clamp(cost, 0, 1.5), capacity: U.clamp(capacity, 0, 1.5) };
  };

  /* ---------- journey: CHARGE → TRANSIT → ARRIVE (or FAULT) ---------- */
  function Journey(machine, cfg) {
    this.m = machine;
    this.cfg = cfg || {};
    this.phase = 'idle';
    this.t = 0;
  }

  Journey.prototype.start = function () {
    var m = this.m, s = m.store.state;
    if (this.phase !== 'idle') return false;
    var dest = m.destination();
    if (!dest || !dest.date) return this.fault('NO DESTINATION ON THE DRUM');
    var from = s.present, to = dest.date;
    if (Math.abs(to.getTime() - from.getTime()) < 3600e3) return this.fault('ALREADY AT ' + dest.label);
    var c = TTGM.travelCost(this.cfg, from, to, s.emergy_display);
    this.plan = { dest: dest, from: from, to: to, cost: c.cost, capacity: c.capacity, years: c.years, e: s.emergy_display };
    this.phase = 'charge';
    this.t = 0;
    m.store.set({ fault: '', charge: 0 });
    if (m.sound) m.sound.humStart();
    return true;
  };

  Journey.prototype.fault = function (msg) {
    var m = this.m;
    m.store.set({ fault: msg, travelling: false, transitPresent: null });
    if (m.sound) { m.sound.humStop(); m.sound.fault(); }
    clearTimeout(this._ft);
    this._ft = setTimeout(function () { m.store.set({ fault: '' }); }, 5200);
    this.phase = 'idle';
    return false;
  };

  Journey.prototype.tick = function (dt) {
    var m = this.m, p = this.plan, cfg = this.cfg;
    if (this.phase === 'idle') {
      // charge bleeds away when idle
      var ch = m.store.state.charge || 0;
      if (ch > 0) m.store.state.charge = Math.max(0, ch - dt * 0.6);
      return;
    }
    this.t += dt * 1000;
    if (this.phase === 'charge') {
      var dur = cfg.charge_ms || 1300;
      var k = U.clamp(this.t / dur, 0, 1);
      var level = Math.min(p.capacity, p.cost * 1.04) * U.ease(k);
      m.store.state.charge = level;
      if (m.sound) m.sound.humLevel(level * 0.4);
      m.drive = 1 + level * 6;
      if (k >= 1) {
        if (p.capacity < p.cost) {
          return this.fault('INSUFFICIENT CHARGE ' + p.capacity.toFixed(2) + ' < ' + p.cost.toFixed(2) + ' — RAISE MIND OR LOWER κ');
        }
        this.phase = 'transit';
        this.t = 0;
        m.store.set({ travelling: true });
      }
      return;
    }
    if (this.phase === 'transit') {
      var tdur = cfg.transit_ms || 2100;
      var q = U.clamp(this.t / tdur, 0, 1);
      var e = U.ease(q);
      var tp = new Date(U.lerp(p.from.getTime(), p.to.getTime(), e));
      m.store.state.transitPresent = tp;
      m.store.state.charge = p.cost * (1 - q * 0.9);
      m.shake = 0.012 * Math.sin(q * Math.PI) + 0.002;
      m.drive = 6 + Math.sin(q * Math.PI) * 40;
      if (m.sound) m.sound.humLevel(0.4 + Math.sin(q * Math.PI) * 0.6);
      if (q >= 1) { this.phase = 'arrive'; this.t = 0; this.arrive(); }
      return;
    }
    if (this.phase === 'arrive') {
      var adur = cfg.arrive_ms || 700;
      m.shake = 0.006 * (1 - this.t / adur);
      if (this.t >= adur) {
        this.phase = 'idle';
        m.shake = 0;
        m.store.set({ travelling: false });
      }
    }
  };

  Journey.prototype.arrive = function () {
    var m = this.m, p = this.plan;
    if (m.sound) { m.sound.humStop(); m.sound.arrive(); }
    m.flash();
    var patch = { present: p.to, transitPresent: null, charge: 0 };
    if (p.dest.slug) patch.focus = p.dest.slug;
    m.store.set(patch, { commit: true, source: 'journey' });
    var entry = m.ledger.add({
      at: new Date().toISOString(),
      from: p.from.toISOString(),
      to: p.to.toISOString(),
      label: p.dest.label,
      kind: p.dest.kind,
      slug: p.dest.slug || '',
      years: (p.to > p.from ? '+' : '−') + p.years.toFixed(p.years < 10 ? 2 : 1),
      e: p.e,
      cost: p.cost,
    });
    m.bus.emit('ticket', entry);
    m.bus.emit('arrived', entry);
  };

  /** What the CRT should draw while a journey is live. */
  Journey.prototype.view = function () {
    if (this.phase === 'idle' || !this.plan) return null;
    var p = this.plan;
    return {
      phase: this.phase,
      label: p.dest.label,
      from: p.from,
      to: p.to,
      now: this.m.store.state.transitPresent || p.from,
      progress: this.phase === 'charge' ? 0 : this.phase === 'arrive' ? 1 : U.clamp(this.t / (this.cfg.transit_ms || 2100), 0, 1),
      charge: this.m.store.state.charge || 0,
      cost: p.cost,
    };
  };

  TTGM.Journey = Journey;
})(window.TTGM);
