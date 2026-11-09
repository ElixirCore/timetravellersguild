/* Knobs + instrument keys — labelled, tippable, consequential. */
(function (global) {
  'use strict';

  var KNOB_META = [
    {
      key: 'mind',
      label: 'MIND',
      tip: 'MIND — attention aperture. Raise it to widen graph association; lower it for literal, selected records only.',
    },
    {
      key: 'matter',
      label: 'MATTER',
      tip: 'MATTER — evidential weight. Raise it to privilege dated places, documents and canon; lower it admits hypothesis and pending slips.',
    },
    {
      key: 'dc',
      label: 'ΔC',
      tip: 'Δ CONTEXT — contextual distance trim. Click to choose which axis the gauge reads: TIME, PLACE, PEOPLE, INSTITUTIONS, SYMBOLS.',
    },
    {
      key: 'kappa',
      label: 'κ',
      tip: 'κ — context constant (0–3.33). High κ penalises loose association; only tightly evidenced routes survive.',
      brass: true,
    },
    {
      key: 'time',
      label: 'PRESENT',
      tip: 'MACHINE PRESENT — wind the instrument clock. Click to set wind unit (year / month / day / hour), then drag to turn.',
    },
  ];

  var KEY_META = [
    {
      id: 'sync',
      label: 'SYNC',
      tip: 'SYNC — set machine present to local present. Cards beyond now become unavailable.',
    },
    {
      id: 'network',
      label: '2033',
      tip: 'NETWORK — jump machine present to 17 April 2033 (network present). The field opens to its later ledger.',
    },
    {
      id: 'hold',
      label: 'HOLD',
      tip: 'HOLD — freeze the punchcard transport. Release by pressing again. Useful while inspecting a card.',
    },
    {
      id: 'reset',
      label: 'RESET',
      tip: 'RESET — restore default mind, matter, κ; clear focus; return clock to local present.',
    },
  ];

  var DC_AXES = ['TIME', 'PLACE', 'PEOPLE', 'INSTITUTIONS', 'SYMBOLS'];
  var WIND = ['YEAR', 'MONTH', 'DAY', 'HOUR'];

  function ControlPanel(machineRoot, THREE) {
    this.THREE = THREE;
    this.group = new THREE.Group();
    this.group.name = 'ControlPanel';
    machineRoot.add(this.group);
    this.knobs = [];
    this.keys = [];
    this.timeMode = 'YEAR';
    this.dcAxis = 'TIME';
    this.held = false;
    this.active = null;
    this.lastAngle = 0;
    this.onChange = null;
    this.onHold = null;
    this.onHover = null;
    this.onFlash = null;
    this.values = {
      mind: 0.73,
      matter: 0.68,
      dc: 0.4,
      kappa: 1.13,
      machinePresent: new Date(),
    };
    this._build(THREE);
  }

  ControlPanel.prototype._build = function (THREE) {
    var panelY = 0.78;
    var z = 0.74;
    var xs = [-0.78, -0.39, 0, 0.39, 0.78];
    var i;
    for (i = 0; i < KNOB_META.length; i++) {
      var meta = KNOB_META[i];
      var knob = this._makeKnob(THREE, meta);
      knob.position.set(xs[i], panelY, z);
      knob.userData.kind = 'knob';
      knob.userData.key = meta.key;
      knob.userData.tip = meta.tip;
      knob.userData.index = i;
      this.group.add(knob);
      this.knobs.push(knob);

      var plate = this._labelPlate(THREE, meta.label);
      plate.position.set(xs[i], panelY - 0.1, z + 0.01);
      this.group.add(plate);

      var hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.userData.kind = 'knob';
      hit.userData.key = meta.key;
      hit.userData.tip = meta.tip;
      hit.userData.proxy = knob;
      knob.add(hit);
    }

    // Wind-unit lamps under PRESENT
    this.windLamps = [];
    for (i = 0; i < WIND.length; i++) {
      var lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.012, 0.02),
        new THREE.MeshStandardMaterial({
          color: 0x1a2018,
          emissive: 0x66aa55,
          emissiveIntensity: 0.05,
        })
      );
      lamp.position.set(0.78 + (i - 1.5) * 0.045, panelY - 0.145, z + 0.03);
      lamp.userData.kind = 'windLamp';
      lamp.userData.mode = WIND[i];
      lamp.userData.tip = 'Wind unit: ' + WIND[i] + '. Click PRESENT knob to cycle.';
      this.group.add(lamp);
      this.windLamps.push(lamp);
    }

    // Instrument keys
    var keyY = panelY - 0.22;
    for (i = 0; i < KEY_META.length; i++) {
      var km = KEY_META[i];
      var key = this._makeKey(THREE, km);
      key.position.set(-0.55 + i * 0.36, keyY, z + 0.02);
      this.group.add(key);
      this.keys.push(key);
    }

    this._applyRotations();
  };

  ControlPanel.prototype._labelPlate = function (THREE, text) {
    var g = new THREE.Group();
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6a5828';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#1a1408';
    ctx.fillRect(4, 4, 248, 56);
    ctx.fillStyle = '#d4b45a';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 34);
    var tex = new THREE.CanvasTexture(canvas);
    var plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.045),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    g.add(plate);
    g.userData.label = text;
    return g;
  };

  ControlPanel.prototype._makeKnob = function (THREE, meta) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.062, 0.055, 28),
      new THREE.MeshStandardMaterial({
        color: meta.brass ? 0x1a1814 : 0x121212,
        roughness: 0.5,
        metalness: meta.brass ? 0.4 : 0.18,
      })
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    if (meta.brass) {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.008, 8, 28),
        new THREE.MeshStandardMaterial({ color: 0xb08d3a, roughness: 0.35, metalness: 0.85 })
      );
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }
    var collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.012, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a3340, metalness: 0.6, roughness: 0.5 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.z = -0.02;
    g.add(collar);
    var mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.012, 0.045),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, emissive: 0x443300, emissiveIntensity: 0.5 })
    );
    mark.position.set(0, 0.035, 0.02);
    g.add(mark);
    g.userData.label = meta.label;
    return g;
  };

  ControlPanel.prototype._makeKey = function (THREE, meta) {
    var g = new THREE.Group();
    var bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.08, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x3a4555, metalness: 0.55, roughness: 0.5 })
    );
    g.add(bezel);
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#142018';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#6a9a6a';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 244, 52);
    ctx.fillStyle = '#a8d8a8';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.label, 128, 34);
    var tex = new THREE.CanvasTexture(canvas);
    var face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.055),
      new THREE.MeshBasicMaterial({
        map: tex,
        toneMapped: false,
        color: 0xffffff,
      })
    );
    face.position.z = 0.022;
    g.add(face);
    // emissive backer for HOLD glow
    var backer = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.055, 0.012),
      new THREE.MeshStandardMaterial({
        color: 0x1a2218,
        emissive: 0x335533,
        emissiveIntensity: 0.15,
        roughness: 0.6,
        metalness: 0.2,
      })
    );
    backer.position.z = 0.012;
    g.add(backer);
    g.userData.kind = 'key';
    g.userData.keyId = meta.id;
    g.userData.tip = meta.tip;
    g.userData.label = meta.label;
    g.userData.face = backer;
    g.userData.labelMesh = face;
    // Invisible hit pad
    var hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.1, 0.08),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.userData.kind = 'key';
    hit.userData.keyId = meta.id;
    hit.userData.tip = meta.tip;
    hit.userData.proxy = g;
    g.add(hit);
    return g;
  };

  ControlPanel.prototype.setFromState = function (state) {
    if (!state) return;
    if (typeof state.mind_knob === 'number') this.values.mind = state.mind_knob;
    else if (typeof state.mind === 'number') this.values.mind = state.mind;
    if (typeof state.matter_knob === 'number') this.values.matter = state.matter_knob;
    else if (typeof state.matter === 'number') this.values.matter = state.matter;
    if (typeof state.delta_context === 'number') this.values.dc = state.delta_context;
    if (typeof state.kappa === 'number') this.values.kappa = state.kappa;
    if (state.dc_axis) this.dcAxis = String(state.dc_axis).toUpperCase();
    if (state.machine_present) {
      var d = new Date(state.machine_present);
      if (!isNaN(d.getTime())) this.values.machinePresent = d;
    }
    this._applyRotations();
  };

  ControlPanel.prototype._applyRotations = function () {
    var map = {
      mind: this.values.mind * Math.PI * 1.6,
      matter: this.values.matter * Math.PI * 1.6,
      dc: this.values.dc * Math.PI * 1.6,
      kappa: (this.values.kappa / 3.33) * Math.PI * 1.8,
      time: (this.values.machinePresent.getFullYear() % 100) / 100 * Math.PI * 2,
    };
    var i;
    for (i = 0; i < this.knobs.length; i++) {
      this.knobs[i].rotation.z = map[this.knobs[i].userData.key] || 0;
    }
    for (i = 0; i < this.windLamps.length; i++) {
      var on = this.windLamps[i].userData.mode === this.timeMode;
      this.windLamps[i].material.emissiveIntensity = on ? 0.85 : 0.05;
    }
    for (i = 0; i < this.keys.length; i++) {
      var key = this.keys[i];
      var lit = key.userData.keyId === 'hold' && this.held;
      var faceMat = key.userData.face && key.userData.face.material;
      if (faceMat && faceMat.emissive) {
        faceMat.emissiveIntensity = lit ? 0.7 : 0.15;
        faceMat.emissive.setHex(lit ? 0xaa6622 : 0x335533);
      }
    }
  };

  ControlPanel.prototype.pickables = function () {
    var list = this.knobs.slice();
    var i;
    for (i = 0; i < this.knobs.length; i++) list = list.concat(this.knobs[i].children);
    for (i = 0; i < this.keys.length; i++) {
      list.push(this.keys[i]);
      list = list.concat(this.keys[i].children);
    }
    return list;
  };

  ControlPanel.prototype.hover = function (obj) {
    while (obj && !obj.userData.tip) obj = obj.parent;
    if (typeof this.onHover === 'function') {
      this.onHover(obj ? obj.userData.tip : '', obj ? (obj.userData.label || obj.userData.keyId || '') : '');
    }
  };

  ControlPanel.prototype.begin = function (obj, clientX, clientY) {
    while (obj && !obj.userData.kind) obj = obj.parent;
    if (!obj) return false;

    if (obj.userData.kind === 'key') {
      this._fireKey(obj.userData.keyId || (obj.userData.proxy && obj.userData.proxy.userData.keyId));
      this._haptic();
      return true;
    }

    if (obj.userData.kind === 'knob') {
      var key = obj.userData.key;
      // Click PRESENT to cycle wind unit; click ΔC to cycle axis
      if (key === 'time' && !this.active) {
        this._clickStamp = { key: key, x: clientX, y: clientY, t: Date.now() };
      } else if (key === 'dc') {
        this._clickStamp = { key: key, x: clientX, y: clientY, t: Date.now() };
      } else {
        this._clickStamp = null;
      }
      this.active = obj.userData.proxy || obj;
      this.lastAngle = Math.atan2(clientY - window.innerHeight / 2, clientX - window.innerWidth / 2);
      this._dragged = false;
      return true;
    }
    return false;
  };

  ControlPanel.prototype.drag = function (clientX, clientY) {
    if (!this.active) return;
    var angle = Math.atan2(clientY - window.innerHeight / 2, clientX - window.innerWidth / 2);
    var delta = angle - this.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    this.lastAngle = angle;
    if (Math.abs(delta) > 0.02) this._dragged = true;
    var key = this.active.userData.key;
    if (key === 'mind' || key === 'matter' || key === 'dc') {
      this.values[key] = clamp(this.values[key] + delta * 0.25, 0.001, 1);
    } else if (key === 'kappa') {
      this.values.kappa = clamp(this.values.kappa + delta * 0.5, 0, 3.33);
    } else if (key === 'time') {
      this._nudgeTime(delta);
    }
    this._applyRotations();
    if (Math.abs(delta) > 0.05) this._haptic();
  };

  ControlPanel.prototype._nudgeTime = function (delta) {
    var d = new Date(this.values.machinePresent.getTime());
    var step = delta > 0 ? 1 : -1;
    if (Math.abs(delta) < 0.02) return;
    if (this.timeMode === 'YEAR') d.setFullYear(d.getFullYear() + step);
    else if (this.timeMode === 'MONTH') d.setMonth(d.getMonth() + step);
    else if (this.timeMode === 'DAY') d.setDate(d.getDate() + step);
    else d.setHours(d.getHours() + step);
    this.values.machinePresent = d;
  };

  ControlPanel.prototype._flash = function (title, sub) {
    if (typeof this.onFlash === 'function') this.onFlash(title, sub);
  };

  ControlPanel.prototype._fireKey = function (id) {
    if (!id) return;
    if (id === 'sync') {
      this.values.machinePresent = new Date();
      this._flash('CLOCK SET TO LOCAL PRESENT', 'cards dated after now fall to OUTPUT as ghosts');
      this._commit();
    } else if (id === 'network') {
      this.values.machinePresent = new Date('2033-04-17T00:00:00Z');
      this._flash('CLOCK WOUND TO NETWORK PRESENT \u00b7 2033', 'the field opens to its later ledger');
      this._commit();
    } else if (id === 'hold') {
      this.held = !this.held;
      this._applyRotations();
      if (typeof this.onHold === 'function') this.onHold(this.held);
    } else if (id === 'reset') {
      this.values.mind = 0.73;
      this.values.matter = 0.68;
      this.values.dc = 0.4;
      this.values.kappa = 1.13;
      this.values.machinePresent = new Date();
      this.dcAxis = 'TIME';
      this.timeMode = 'YEAR';
      this.held = false;
      this._flash('INSTRUMENT RESTORED \u00b7 DEFAULT TRIM', 'mind, matter, \u03ba and clock returned to standard');
      if (typeof this.onHold === 'function') this.onHold(false);
      if (typeof this.onReset === 'function') this.onReset();
      this._applyRotations();
      this._commit({ clearFocus: true });
    }
  };

  ControlPanel.prototype.end = function () {
    if (!this.active) return false;
    var key = this.active.userData.key;
    // Click without drag → cycle modes
    if (!this._dragged && this._clickStamp && this._clickStamp.key === key) {
      if (key === 'time') {
        var wi = WIND.indexOf(this.timeMode);
        this.timeMode = WIND[(wi + 1) % WIND.length];
        this._applyRotations();
        this._flash('WIND UNIT \u00b7 ' + this.timeMode, 'drag PRESENT to turn the clock one ' + this.timeMode.toLowerCase() + ' at a time');
      } else if (key === 'dc') {
        var di = DC_AXES.indexOf(this.dcAxis);
        this.dcAxis = DC_AXES[(di + 1) % DC_AXES.length];
        this._flash('\u0394C AXIS \u00b7 ' + this.dcAxis, 'the gauge now reads contextual distance on ' + this.dcAxis.toLowerCase());
        this._commit();
      }
    }
    this.active = null;
    this._clickStamp = null;
    if (this._dragged) this._commit();
    this._dragged = false;
    return true;
  };

  ControlPanel.prototype._commit = function (extra) {
    if (typeof this.onChange === 'function') {
      var params = this.queryParams();
      if (extra && extra.clearFocus) params.focus = '';
      this.onChange(params);
    }
  };

  ControlPanel.prototype.queryParams = function () {
    var d = this.values.machinePresent;
    var iso = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return {
      mind: this.values.mind.toFixed(3),
      matter: this.values.matter.toFixed(3),
      k: this.values.kappa.toFixed(3),
      t: iso,
      dc: this.dcAxis,
    };
  };

  ControlPanel.prototype._haptic = function () {
    try {
      if (navigator.vibrate) navigator.vibrate(8);
    } catch (e) {}
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  global.TTGMachineControls = ControlPanel;
})(window);
