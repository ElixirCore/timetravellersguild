/* TIME MACHINE №13 — orchestration: scene, store, blueprint assembly, interaction. */
(function () {
  'use strict';

  var CFG = window.TTG_MACHINE || {};
  var TTGM = window.TTGM;
  function $(id) { return document.getElementById(id); }

  /* =====================================================================
   * Machine — owns the store, the parts, the field fetches and the journey.
   * ===================================================================== */
  function Machine(THREE, scene, root, mats) {
    var U = TTGM.util;
    var boot = CFG.boot || {};
    this.U = U;
    this.cfg = CFG;
    this.THREE = THREE;
    this.scene = scene;
    this.root = root;
    this.mats = mats;
    this.blueprint = CFG.blueprint || { components: [] };
    this.bus = new TTGM.Bus();
    this.sound = new TTGM.Sound();
    this.ledger = new TTGM.Ledger();
    this.components = [];
    this.drive = 0;
    this.shake = 0;
    this.defaults = { mind: 0.73, matter: 0.68, kappa: 1.13 };
    this._dest = [];
    this._seq = 0;

    var present = new Date(boot.machine_present || Date.now());
    if (isNaN(present.getTime())) present = new Date();
    this.store = new TTGM.Store({
      mind: num(boot.mind_knob, this.defaults.mind),
      matter: num(boot.matter_knob, this.defaults.matter),
      kappa: num(boot.kappa, this.defaults.kappa),
      dcAxis: boot.dc_axis || 'TIME',
      present: present,
      wind: 'YEAR',
      held: false,
      excluded: boot.excluded || [],
      focus: boot.focus || '',
      page: 'STATE',
      destIndex: 0,
      charge: 0, cost: 0, capacity: 0,
      travelling: false, transitPresent: null,
      fault: '', fetching: false,
      server: boot,
      emergy_display: boot.emergy_display || 0,
      emergy_raw: boot.emergy_raw || 0,
    });
    this._rebuildDestinations();
    this.journey = new TTGM.Journey(this, this.blueprint.travel || {});

    var self = this;
    this.store.subscribe(function (state, changed, meta) { self._onChange(state, changed, meta); });

    (this.blueprint.components || []).forEach(function (spec) {
      var c = TTGM.create(self, spec);
      if (!c) return;
      self.root.add(c.group);
      self.components.push(c);
    });
    this._derive();
    this.components.forEach(function (c) { c.update(self.store.state, { server: true }, {}); });

  }

  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

  Machine.prototype.act = function (name, args, source) {
    var fn = TTGM.actions[name];
    if (!fn) { console.warn('TTGM: no action', name); return false; }
    return fn(this, args || {}, source);
  };

  /* ---------- derived instrument values (client mirror, display only) ---------- */
  Machine.prototype._derive = function () {
    var s = this.store.state, srv = s.server || {};
    var mindBase = typeof srv.mind_base === 'number' ? srv.mind_base : s.mind;
    var matterBase = typeof srv.matter_base === 'number' ? srv.matter_base : s.matter;
    var mind = this.U.clamp(mindBase * 0.35 + s.mind * 0.65, 0.001, 1);
    var matter = this.U.clamp(matterBase * 0.35 + s.matter * 0.65, 0.001, 1);
    var em = TTGMachineEmergy.compute(mind, matter, srv.delta_context || 0.3, s.kappa);
    s.mind_eff = mind;
    s.matter_eff = matter;
    s.emergy_display = em.display;
    s.emergy_raw = em.raw;
    var dest = this.destination();
    if (dest && dest.date && s.present) {
      var c = TTGM.travelCost(this.blueprint.travel || {}, s.present, dest.date, em.display);
      s.cost = c.cost;
      s.capacity = c.capacity;
    }
    if (!this.journey || this.journey.phase === 'idle') this.drive = 0.4 + em.display * 2.2;
  };

  Machine.prototype._onChange = function (state, changed, meta) {
    this._derive();
    if (changed.server) this._rebuildDestinations();
    if (this.cards) {
      this.cards.held = !!state.held;
      this.cards.setSpeed(state.emergy_display, state.mind_eff);
    }
    for (var i = 0; i < this.components.length; i++) this.components[i].update(state, changed, meta);
    if (meta.commit) this.scheduleFetch();
    this.bus.emit('change', state, changed);
  };

  /* ---------- the field: server round-trips ---------- */
  Machine.prototype.queryParams = function () {
    var s = this.store.state;
    var q = {
      mind: s.mind.toFixed(3),
      matter: s.matter.toFixed(3),
      k: s.kappa.toFixed(3),
      t: this.U.iso(s.present),
      dc: s.dcAxis,
    };
    if (s.excluded && s.excluded.length) q.x = s.excluded.join(',');
    if (s.focus) q.focus = s.focus;
    return q;
  };

  Machine.prototype.scheduleFetch = function () {
    var self = this;
    clearTimeout(this._ft);
    this._ft = setTimeout(function () { self.fetch(); }, 220);
  };

  Machine.prototype.fetch = function () {
    var self = this, seq = ++this._seq, params = this.queryParams();
    syncUrl(params);
    this.store.set({ fetching: true });
    var url = (CFG.api || '/api/machine/state') + '?' + new URLSearchParams(params).toString();
    fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (seq !== self._seq) return;
        if (data && data.ok) self.applyServer(data);
        self.store.set({ fetching: false });
      })
      .catch(function () { if (seq === self._seq) self.store.set({ fetching: false, fault: 'FIELD UNREACHABLE' }); });
  };

  Machine.prototype.applyServer = function (data) {
    if (this.cards) this.cards.setRecords(data.cards || []);
    if (this.feed) this.feed.setState(data);
    this.store.set({ server: data });
  };

  /* ---------- destinations: presets + every dated record ---------- */
  Machine.prototype._rebuildDestinations = function () {
    var prevId = this._dest[this.store.state.destIndex] ? this._dest[this.store.state.destIndex].id : null;
    var out = [];
    (this.blueprint.destinations || []).forEach(function (d) {
      var date = d.at === 'now' ? new Date() : new Date(d.at);
      if (isNaN(date.getTime())) return;
      out.push({ id: d.id, label: d.label, date: date, kind: d.kind || 'PRESET', slug: '' });
    });
    var seen = {};
    var recs = ((this.store.state.server || {}).cards || []).filter(function (c) {
      if (!c.observed_at || !c.slug || seen[c.slug]) return false;
      seen[c.slug] = true;
      return !isNaN(new Date(c.observed_at).getTime());
    }).map(function (c) {
      return { id: 'rec:' + c.slug, label: c.title || c.slug, date: new Date(c.observed_at), kind: c.type || 'RECORD', slug: c.slug };
    });
    recs.sort(function (a, b) { return a.date - b.date; });
    out = out.concat(recs);
    out.forEach(function (d) { d.when = d.date.toISOString().slice(0, 10); });
    this._dest = out;
    var idx = 0;
    if (prevId) for (var i = 0; i < out.length; i++) if (out[i].id === prevId) { idx = i; break; }
    this.store.state.destIndex = idx;
  };
  Machine.prototype.destinations = function () { return this._dest; };
  Machine.prototype.destination = function () { return this._dest[this.store.state.destIndex || 0] || null; };
  Machine.prototype.journeyPreview = function () {
    var d = this.destination(), s = this.store.state;
    if (!d) return null;
    var c = TTGM.travelCost(this.blueprint.travel || {}, s.present, d.date, s.emergy_display);
    return { label: d.label, when: d.when, years: (d.date > s.present ? '+' : '−') + c.years.toFixed(1), cost: c.cost, capacity: c.capacity };
  };

  /** Server state overlaid with live (un-committed) operator values. */
  Machine.prototype.viewState = function () {
    var s = this.store.state;
    var d = this.destination();
    return Object.assign({}, s.server || {}, {
      mind: s.mind_eff, matter: s.matter_eff, kappa: s.kappa,
      mind_knob: s.mind, matter_knob: s.matter,
      emergy_display: s.emergy_display, emergy_raw: s.emergy_raw,
      dc_axis: s.dcAxis,
      machine_present: s.present ? s.present.toISOString() : '',
      _machine: {
        destination: d ? { label: d.label, when: d.when, kind: d.kind } : null,
        cost: s.cost, capacity: s.capacity, excluded: s.excluded, held: s.held,
        fault: s.fault, page: s.page, wind: s.wind,
        ledger: this.ledger.list().slice(0, 8),
      },
    });
  };

  Machine.prototype.pickables = function () {
    var out = [];
    for (var i = 0; i < this.components.length; i++) out = out.concat(this.components[i].pickables());
    return out;
  };

  Machine.prototype.tick = function (dt, t) {
    this.journey.tick(dt);
    for (var i = 0; i < this.components.length; i++) this.components[i].tick(dt, t);
  };

  Machine.prototype.flash = function () {
    var el = $('flash');
    if (!el) return;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  };

  /* =====================================================================
   * URL
   * ===================================================================== */
  function syncUrl(params) {
    var q = new URLSearchParams();
    Object.keys(params).forEach(function (k) { if (params[k] != null && params[k] !== '') q.set(k, params[k]); });
    var qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  /* =====================================================================
   * 2D fallback (no WebGL)
   * ===================================================================== */
  function bootFallback() {
    var state = CFG.boot || null;
    $('stage').hidden = true;
    $('fallback').hidden = false;
    var apply = function (s) {
      if (!s) return;
      $('fbLocal').textContent = (s.local_present || '').slice(0, 19);
      $('fbMachine').textContent = (s.machine_present || '').slice(0, 19);
      $('fbEmergy').textContent = (s.emergy_display != null ? Number(s.emergy_display).toFixed(3) : '—')
        + '  raw ' + (s.emergy_raw != null ? Number(s.emergy_raw).toFixed(4) : '');
      $('fbMind').value = s.mind_knob != null ? s.mind_knob : s.mind;
      $('fbMatter').value = s.matter_knob != null ? s.matter_knob : s.matter;
      $('fbDc').value = s.delta_context || 0;
      $('fbKappa').value = s.kappa || 1.13;
      $('fbJack').textContent = s.jack_line || '';
      try {
        var d = new Date(s.machine_present);
        if (!isNaN(d.getTime())) {
          var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
          $('fbTime').value = local.toISOString().slice(0, 16);
        }
      } catch (e) {}
      var ul = $('fbCards');
      ul.innerHTML = '';
      (s.cards || []).slice(0, 16).forEach(function (c) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = c.href || ('/n/' + encodeURIComponent(c.slug) + '/');
        a.textContent = (c.beyond ? '◌ ' : '● ') + c.title + ' · ' + c.type;
        li.appendChild(a);
        ul.appendChild(li);
      });
    };
    apply(state);
    function push() {
      var t = $('fbTime').value;
      var params = { mind: $('fbMind').value, matter: $('fbMatter').value, k: $('fbKappa').value };
      if (t) params.t = new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z');
      syncUrl(params);
      fetch((CFG.api || '/api/machine/state') + '?' + new URLSearchParams(params), { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.ok) apply(d); })
        .catch(function () {});
    }
    ['fbMind', 'fbMatter', 'fbKappa', 'fbTime'].forEach(function (id) { $(id).addEventListener('change', push); });
  }

  /* =====================================================================
   * WebGL boot
   * ===================================================================== */
  function boot() {
    try { bootWebGL(); } catch (e) {
      console.error(e);
      var el = $('err');
      if (el) { el.hidden = false; el.textContent = 'Instrument fault on boot: ' + (e && e.message ? e.message : String(e)); }
      bootFallback();
    }
  }

  function bootWebGL() {
    if (typeof THREE === 'undefined' || typeof THREE.OrbitControls !== 'function' || !TTGM) {
      $('err').hidden = false;
      $('err').textContent = 'WebGL libraries failed to load. Falling back to the desk instrument.';
      bootFallback();
      return;
    }
    var canvas = $('gl');
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false }); } catch (e) {
      $('err').hidden = false;
      $('err').textContent = 'WebGL context failed. Falling back to the desk instrument.';
      bootFallback();
      return;
    }
    renderer.setClearColor(0x1a2430, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    if (renderer.outputEncoding !== undefined && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1a2430, 9, 18);
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.35;
    controls.enablePan = false;
    controls.minAzimuthAngle = -0.6;
    controls.maxAzimuthAngle = 0.6;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.53;
    var HOME_TARGET = new THREE.Vector3(0, 1.18, 0.4);
    var HOME_DIR = new THREE.Vector3(0.08, 0.1, 1).normalize();
    controls.target.copy(HOME_TARGET);

    /* room */
    var floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.88, metalness: 0.08 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    var backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ color: 0x243040, roughness: 0.95, metalness: 0.02 }));
    backWall.position.set(0, 3.6, -2.4);
    scene.add(backWall);
    scene.add(new THREE.AmbientLight(0xc8d4e4, 0.85));
    scene.add(new THREE.HemisphereLight(0xeef2f8, 0x3a4558, 1.0));
    var key = new THREE.DirectionalLight(0xfff5e8, 1.3);
    key.position.set(2.8, 4.6, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xa8c8e8, 0.7);
    fill.position.set(-2.5, 2.4, 2.4);
    scene.add(fill);
    var rim = new THREE.DirectionalLight(0xdde8ff, 0.4);
    rim.position.set(0, 2.6, 4.5);
    scene.add(rim);
    var bounce = new THREE.PointLight(0x8899aa, 0.5, 8);
    bounce.position.set(0, 0.4, 1.5);
    scene.add(bounce);

    var mats = {
      enamel: TTGMachineMats.enamel(THREE),
      steel: TTGMachineMats.steel(THREE),
      brass: TTGMachineMats.brass(THREE),
      bakelite: TTGMachineMats.bakelite(THREE),
      paper: TTGMachineMats.paper(THREE),
    };

    /* chassis — housing only; every instrument comes from the blueprint */
    var root = new THREE.Group();
    root.name = 'Machine';
    scene.add(root);
    var cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.85, 1.1), mats.enamel);
    cabinet.position.y = 0.98;
    cabinet.castShadow = cabinet.receiveShadow = true;
    root.add(cabinet);
    var face = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.04), mats.enamel);
    face.position.set(0, 1.2, 0.56);
    root.add(face);
    var shelf = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.05, 0.28), mats.steel);
    shelf.position.set(0, 0.82, 0.66);
    root.add(shelf);
    var crown = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.42, 0.5), mats.enamel);
    crown.position.set(0, 2.115, 0.15);
    crown.castShadow = true;
    root.add(crown);
    var crownTrim = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.56), mats.brass);
    crownTrim.position.set(0, 2.335, 0.15);
    root.add(crownTrim);
    var plinth = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.06, 1.25), mats.steel);
    plinth.position.y = 0.03;
    root.add(plinth);

    var machine = new Machine(THREE, scene, root, mats);
    machine.cards = new TTGMachineCards(root, THREE, mats);
    machine.feed = new TTGMachineFeed();
    machine.applyServer(machine.store.state.server);
    machine.camera = camera;
    machine.controls = controls;
    window.TTGMachine = machine; // operators / tests

    /* ---------- readout + camera moves ---------- */
    var readoutEl = $('readout');
    var tipEl = $('hover-tip'), tipTitle = $('hover-tip-title'), tipBody = $('hover-tip-body');
    var camTween = null;
    var home = { pos: null, target: HOME_TARGET.clone() };
    var crtZoom = false;
    var cardFreeze = null;

    function tweenTo(pos, target) { camTween = { pos: pos.clone(), target: target.clone(), t: 0 }; }

    function refreshReadout() {
      if (!readoutEl || !crtZoom) return;
      TTGMachineReadout.render(readoutEl, machine.viewState());
      var closeBtn = $('readoutClose');
      if (closeBtn) closeBtn.onclick = closeReadout;
    }
    function openReadout() {
      crtZoom = true;
      document.body.classList.add('crt-zoom');
      readoutEl.hidden = false;
      refreshReadout();
      controls.enabled = false;
      tweenTo(new THREE.Vector3(0.05, 1.32, 2.2), new THREE.Vector3(0, 1.28, 0.6));
      tipEl.hidden = true;
    }
    function closeReadout() {
      crtZoom = false;
      document.body.classList.remove('crt-zoom');
      readoutEl.hidden = true;
      tweenTo(home.pos, home.target);
    }
    machine.ui = {
      toggleReadout: function () { if (crtZoom) closeReadout(); else openReadout(); },
      openReadout: openReadout,
      closeReadout: closeReadout,
      syncMute: function () { var b = $('dockSound'); if (b) b.textContent = machine.sound.muted ? 'SOUND OFF' : 'SOUND ON'; },
    };
    window.TTGMachineUI = { openReadout: openReadout, closeReadout: closeReadout, isReadoutOpen: function () { return crtZoom; } };
    machine.bus.on('change', function () { if (crtZoom) refreshReadout(); });
    machine.ui.syncMute();

    /* ---------- inspect panel ---------- */
    function showInspect(rec) {
      $('inspectType').textContent = (rec.type || 'RECORD') + (rec.pending ? ' · PENDING' : '') + (rec.beyond ? ' · BEYOND PRESENT' : '');
      $('inspectTitle').textContent = rec.title || rec.slug || 'UNTITLED';
      $('inspectDate').textContent = (rec.observed_at || '—').replace('T', ' ').replace(/(\+00:00|Z)$/, '');
      $('inspectStatus').textContent = rec.status || '—';
      $('inspectId').textContent = rec.public_id || rec.slug || '—';
      $('inspectPlace').textContent = rec.place || '—';
      $('inspectLink').href = rec.href || ('/n/' + encodeURIComponent(rec.slug || '') + '/');
      $('inspectDest').disabled = !rec.observed_at;
      $('inspect').hidden = false;
    }
    function releaseCard() {
      cardFreeze = null;
      machine.cards.release();
      $('inspect').hidden = true;
      controls.enabled = !crtZoom;
    }
    $('inspectClose').addEventListener('click', releaseCard);
    $('inspectRelease').addEventListener('click', releaseCard);
    $('inspectDest').addEventListener('click', function () {
      if (cardFreeze && machine.act('destTo', { slug: cardFreeze.slug })) {
        machine.store.set({ focus: cardFreeze.slug }, { commit: true });
        if (machine.sound) machine.sound.detent();
        releaseCard();
      }
    });

    /* ---------- pointer routing → components ---------- */
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var active = null, activeHit = null, startPt = null, lastPt = null, moved = false;

    function pt(e) {
      var t = e.touches && e.touches[0];
      return { x: t ? t.clientX : e.clientX, y: t ? t.clientY : e.clientY };
    }
    function cast(p) {
      var r = canvas.getBoundingClientRect();
      ndc.x = ((p.x - r.left) / r.width) * 2 - 1;
      ndc.y = -((p.y - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(machine.pickables(), false);
      return hits.length ? hits[0] : null;
    }
    function showTip(info, p) {
      if (!info || (!info.text && !info.label)) { tipEl.hidden = true; return; }
      tipTitle.textContent = info.label || '';
      tipBody.textContent = info.text || '';
      tipEl.hidden = false;
      tipEl.style.left = Math.min(window.innerWidth - 300, Math.max(12, p.x + 14)) + 'px';
      tipEl.style.top = Math.min(window.innerHeight - 140, Math.max(12, p.y + 16)) + 'px';
    }

    window.addEventListener('pointerdown', function (e) {
      machine.sound.unlock();
      if (e.target !== canvas) return;
      var p = pt(e);
      if (crtZoom) { closeReadout(); e.stopPropagation(); return; }
      var hit = cast(p);
      if (hit) {
        var comp = hit.object.userData.component;
        if (comp && comp.press && comp.press(hit, p)) {
          active = comp; activeHit = hit; startPt = p; lastPt = p; moved = false;
          controls.enabled = false;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }
      var rec = machine.cards.pick(raycaster);
      if (rec) {
        cardFreeze = rec;
        machine.cards.freeze(rec);
        showInspect(rec);
        controls.enabled = false;
        e.stopPropagation();
      }
    }, true);

    window.addEventListener('pointermove', function (e) {
      var p = pt(e);
      if (active) {
        var d = { dx: p.x - lastPt.x, dy: p.y - lastPt.y };
        lastPt = p;
        if (Math.abs(p.x - startPt.x) + Math.abs(p.y - startPt.y) > 5) moved = true;
        if (moved && active.drag) active.drag(p, d, activeHit);
        showTip(active.tip(activeHit), p);
        e.preventDefault();
        return;
      }
      if (e.target !== canvas || crtZoom) { if (e.target !== tipEl) tipEl.hidden = true; return; }
      var hit = cast(p);
      if (hit && hit.object.userData.component) {
        showTip(hit.object.userData.component.tip(hit), p);
        canvas.style.cursor = 'pointer';
      } else {
        var card = machine.cards.pick(raycaster);
        if (card) {
          showTip({ label: card.type + (card.beyond ? ' · BEYOND' : ''), text: card.title + ' — ' + String(card.observed_at || '').slice(0, 10) + '. Click to stop the transport and inspect.' }, p);
          canvas.style.cursor = 'pointer';
        } else {
          tipEl.hidden = true;
          canvas.style.cursor = '';
        }
      }
    });

    window.addEventListener('pointerup', function (e) {
      if (!active) return;
      var a = active;
      active = null;
      tipEl.hidden = true;
      try { a.release && a.release(pt(e), moved, activeHit); } finally {
        controls.enabled = !cardFreeze && !crtZoom;
      }
    });

    window.addEventListener('wheel', function (e) {
      if (e.target !== canvas || crtZoom) return;
      var hit = cast(pt(e));
      var comp = hit && hit.object.userData.component;
      if (comp && comp.wheel) {
        comp.wheel(e.deltaY > 0 ? 1 : -1, hit);
        showTip(comp.tip(hit), pt(e));
        e.preventDefault();
        e.stopPropagation();
      }
    }, { capture: true, passive: false });

    /* ---------- keyboard ---------- */
    window.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      machine.sound.unlock();
      var k = e.key;
      if (k === 'Escape') { if (crtZoom) closeReadout(); else if (cardFreeze) releaseCard(); return; }
      var map = {
        '[': ['wind', { n: -1 }], ']': ['wind', { n: 1 }],
        ',': ['destStep', { n: -1 }], '.': ['destStep', { n: 1 }],
        't': ['travel'], 'Enter': ['travel'],
        'h': ['toggleHold'], 'm': ['cyclePage'], 'r': ['toggleReadout'], 's': ['sync'],
      };
      var a = map[k] || map[k.toLowerCase()];
      if (!a) return;
      e.preventDefault();
      machine.act(a[0], a[1] || {});
      if (a[0] === 'travel' && machine.sound) machine.sound.clunk();
      else if (machine.sound) machine.sound.detent();
    });

    var dockReadout = $('dockReadout');
    if (dockReadout) dockReadout.addEventListener('click', function () { machine.ui.toggleReadout(); });
    var dockSound = $('dockSound');
    if (dockSound) dockSound.addEventListener('click', function () { machine.sound.unlock(); machine.act('mute'); });

    /* ---------- framing ---------- */
    function frameDistance() {
      var vfov = THREE.MathUtils.degToRad(camera.fov) / 2;
      var dW = 1.8 / (Math.tan(vfov) * camera.aspect);
      var dH = 1.3 / Math.tan(vfov);
      return Math.max(dW, dH) + 0.55;
    }
    function resize() {
      var w = Math.max(window.innerWidth, 1), h = Math.max(window.innerHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      var d = frameDistance();
      controls.minDistance = Math.max(2.2, d * 0.55);
      controls.maxDistance = d * 1.35;
      home.pos = HOME_TARGET.clone().add(HOME_DIR.clone().multiplyScalar(d));
      if (!crtZoom && !camTween) { camera.position.copy(home.pos); controls.target.copy(HOME_TARGET); }
    }
    window.addEventListener('resize', resize);
    resize();

    /* ---------- frame loop ---------- */
    var last = performance.now(), frameErrors = 0, reduceMotion = false;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var shakeOff = new THREE.Vector3();

    function frame(now) {
      try {
        var dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        var t = now / 1000;
        if (camTween) {
          camTween.t = Math.min(1, camTween.t + dt * 2.2);
          var k = TTGM.util.ease(camTween.t);
          camera.position.lerp(camTween.pos, k * 0.35 + 0.05);
          controls.target.lerp(camTween.target, k * 0.35 + 0.05);
          if (camTween.t >= 1 && camera.position.distanceTo(camTween.pos) < 0.01) {
            camera.position.copy(camTween.pos);
            controls.target.copy(camTween.target);
            camTween = null;
            controls.enabled = !crtZoom && !cardFreeze;
          }
        }
        controls.update();
        machine.tick(reduceMotion ? dt * 0.5 : dt, t);
        machine.cards.tick(reduceMotion ? 0 : dt * (machine.store.state.travelling ? 4 : 1), t);
        var page = machine.store.state.page;
        if (!reduceMotion && machine.crt && (page === 'STATE' || page === 'FEED')) {
          machine.feed.maybeShow(machine.crt, now, page === 'FEED' ? 1.6 : machine.store.state.emergy_display);
        }
        var sh = reduceMotion ? 0 : machine.shake;
        if (sh > 0) {
          shakeOff.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0);
          camera.position.add(shakeOff);
        }
        renderer.render(scene, camera);
        if (sh > 0) camera.position.sub(shakeOff);
      } catch (err) {
        frameErrors++;
        if (frameErrors === 1) {
          var el = $('err');
          if (el) { el.hidden = false; el.textContent = 'Instrument fault: ' + (err && err.message ? err.message : String(err)); }
          console.error(err);
        }
        if (frameErrors > 8) return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // URL params beyond the boot state (e.g. shared link) are already in boot via PHP.
    setInterval(function () {
      if (active || cardFreeze || machine.store.state.travelling) return;
      machine.fetch();
    }, 45000);
  }

  window.MachineScene = { boot: boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
