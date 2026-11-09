/* Punchcard transport = graph data flow: INPUT → READ → OUTPUT. */
(function (global) {
  'use strict';

  function PunchCardSystem(machineRoot, THREE, mats) {
    this.THREE = THREE;
    this.group = new THREE.Group();
    this.group.name = 'PunchCardPath';
    machineRoot.add(this.group);

    var z = 0.92;
    var y = 0.34;
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.15, y + 0.08, z),
      new THREE.Vector3(-0.85, y, z),
      new THREE.Vector3(-0.45, y, z),
      new THREE.Vector3(-0.05, y, z),
      new THREE.Vector3(0.4, y, z),
      new THREE.Vector3(0.85, y, z),
      new THREE.Vector3(1.15, y - 0.02, z),
    ]);

    this.pool = [];
    this.records = [];
    this.activeCount = 0;
    this.beyondCount = 0;
    this.speed = 0.7;
    this.frozen = null;
    this.held = false;
    this.highlight = new Set();
    this.kinLines = null;
    this.rollers = [];
    this.hopperCards = [];
    this.stackerCards = [];
    this._tmp = new THREE.Vector3();

    this.matLive = (mats && mats.paper) ? mats.paper.clone() : new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
    this.matBeyond = this.matLive.clone();
    this.matBeyond.transparent = true;
    this.matBeyond.opacity = 0.38;
    this.matHot = this.matLive.clone();
    this.matHot.emissive = new THREE.Color(0x443300);
    this.matHot.emissiveIntensity = 0.35;
    this.matKin = this.matLive.clone();
    this.matKin.emissive = new THREE.Color(0x2f6b3a);
    this.matKin.emissiveIntensity = 0.85;

    this.geom = new THREE.BoxGeometry(0.26, 0.11, 0.008);

    this._buildDeck(THREE, mats);
    for (var i = 0; i < 12; i++) this.spawnSlot(i);
  }

  PunchCardSystem.prototype._label = function (THREE, text, color) {
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#121820';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = color || '#d8ffe8';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 34);
    var tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  };

  PunchCardSystem.prototype._buildDeck = function (THREE, mats) {
    var steel = mats.steel || new THREE.MeshStandardMaterial({ color: 0x2c3544, metalness: 0.6, roughness: 0.5 });
    var brass = mats.brass || new THREE.MeshStandardMaterial({ color: 0xa8883a, metalness: 0.8, roughness: 0.4 });
    var paper = mats.paper || this.matLive;
    var self = this;

    var shelf = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.06, 0.55), steel);
    shelf.position.set(0, 0.22, 0.85);
    shelf.receiveShadow = true;
    this.group.add(shelf);

    [-0.07, 0.07].forEach(function (dy) {
      var rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 0.04), brass);
      rail.position.set(0, 0.34 + dy, 0.92);
      self.group.add(rail);
    });

    // INPUT — active field records waiting to enter the reader
    var hopper = new THREE.Group();
    hopper.position.set(-1.2, 0.42, 0.88);
    hopper.userData.kind = 'station';
    hopper.userData.tip = 'INPUT — active field records in the machine present. Stack height = count of non-beyond cards.';
    this.group.add(hopper);
    hopper.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.28), steel));
    var hopperMouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.14, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.9 })
    );
    hopperMouth.position.set(0.16, -0.04, 0.02);
    hopper.add(hopperMouth);
    this.hopperCards = [];
    for (var s = 0; s < 10; s++) {
      var stack = new THREE.Mesh(this.geom, paper);
      stack.position.set(0, -0.08 + s * 0.014, 0.02);
      stack.visible = false;
      hopper.add(stack);
      this.hopperCards.push(stack);
    }
    var inLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.07), this._label(THREE, 'INPUT', '#8fd9a8'));
    inLabel.position.set(-1.2, 0.62, 1.0);
    this.group.add(inLabel);

    // Rollers = transport drive (speed from emergy × mind)
    this.rollers = [];
    [[-0.5, 0.34], [0.55, 0.34]].forEach(function (pos) {
      var pair = new THREE.Group();
      pair.position.set(pos[0], pos[1], 0.92);
      self.group.add(pair);
      for (var r = 0; r < 2; r++) {
        var roller = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.16, 16),
          new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.2 })
        );
        roller.rotation.z = Math.PI / 2;
        roller.position.y = r === 0 ? 0.04 : -0.05;
        pair.add(roller);
        self.rollers.push(roller);
      }
    });

    // READ — sense station; lamps encode hole pattern / emergy bits of card in throat
    var reader = new THREE.Group();
    reader.position.set(-0.05, 0.42, 0.92);
    reader.userData.kind = 'station';
    reader.userData.tip = 'READ — punch sense head. Lamps light from the card in the throat (hole bits). Speed follows emergy.';
    this.group.add(reader);
    reader.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.22), steel));
    this.readerLamps = [];
    for (var L = 0; L < 8; L++) {
      var lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x221100,
          emissive: 0xaa6600,
          emissiveIntensity: 0.08,
        })
      );
      lamp.position.set(-0.1 + L * 0.028, -0.02, 0.12);
      reader.add(lamp);
      this.readerLamps.push(lamp);
    }
    var throat = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.12, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.95 })
    );
    throat.position.set(0, -0.08, 0.08);
    reader.add(throat);
    var readLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), this._label(THREE, 'READ', '#c9a227'));
    readLabel.position.set(-0.05, 0.62, 1.0);
    this.group.add(readLabel);

    // OUTPUT — beyond-present / filtered stack
    var stacker = new THREE.Group();
    stacker.position.set(1.2, 0.36, 0.88);
    stacker.userData.kind = 'station';
    stacker.userData.tip = 'OUTPUT — cards beyond machine present (ghosted) and records that have passed the reader. Stack height = beyond count.';
    this.group.add(stacker);
    stacker.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.3), steel));
    this.stackerCards = [];
    for (var o = 0; o < 10; o++) {
      var done = new THREE.Mesh(this.geom, this.matBeyond);
      done.position.set(0, -0.08 + o * 0.014, 0.04);
      done.visible = false;
      stacker.add(done);
      this.stackerCards.push(done);
    }
    var outLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.07), this._label(THREE, 'OUTPUT', '#8899aa'));
    outLabel.position.set(1.2, 0.58, 1.0);
    this.group.add(outLabel);
  };

  PunchCardSystem.prototype._cardFace = function (THREE) {
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 112;
    var tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    var mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(0.245, 0.104), mat);
    plane.position.z = 0.0052;
    return { canvas: canvas, tex: tex, mat: mat, plane: plane };
  };

  PunchCardSystem.prototype._printCard = function (slot) {
    var face = slot.face;
    if (!face) return;
    var rec = slot.record;
    var ctx = face.canvas.getContext('2d');
    var w = face.canvas.width;
    var h = face.canvas.height;
    // punched card stock
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d9caa8';
    ctx.fillRect(0, h - 26, w, 26);
    if (!rec) { face.tex.needsUpdate = true; return; }
    // punch strip
    ctx.fillStyle = '#2a2318';
    var holes = String(rec.holes || '');
    for (var i = 0; i < 24; i++) {
      var ch = holes.charCodeAt(i % Math.max(holes.length, 1)) || 0;
      if ((ch >> (i % 4)) & 1) ctx.fillRect(10 + i * 10, h - 20, 5, 12);
    }
    // printed record
    ctx.fillStyle = '#1c1710';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 17px "Courier New", monospace';
    var title = String(rec.title || rec.slug || 'UNTITLED').toUpperCase();
    if (title.length > 22) title = title.slice(0, 21) + '\u2026';
    ctx.fillText(title, 10, 8);
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#4a3f2a';
    var yr = String(rec.observed_at || '').slice(0, 4);
    var meta = String(rec.type || 'RECORD') + (yr ? ' \u00b7 ' + yr : '') + (rec.pending ? ' \u00b7 PENDING' : '');
    ctx.fillText(meta, 10, 34);
    ctx.fillStyle = '#8a2f22';
    ctx.fillRect(10, 56, 34, 4);
    face.tex.needsUpdate = true;
  };

  PunchCardSystem.prototype.spawnSlot = function (i) {
    var mesh = new this.THREE.Mesh(this.geom, this.matLive);
    mesh.castShadow = true;
    mesh.userData.card = true;
    mesh.userData.slot = i;
    mesh.visible = false;
    var face = this._cardFace(this.THREE);
    mesh.add(face.plane);
    this.group.add(mesh);
    this.pool.push({
      mesh: mesh,
      face: face,
      progress: (i / 12) % 1,
      speed: 0.9 + Math.random() * 0.35,
      seed: Math.random() * 100,
      record: null,
    });
  };

  PunchCardSystem.prototype.setRecords = function (cards) {
    this.records = Array.isArray(cards) ? cards.slice() : [];
    this.activeCount = 0;
    this.beyondCount = 0;
    var i;
    for (i = 0; i < this.records.length; i++) {
      if (this.records[i] && this.records[i].beyond) this.beyondCount++;
      else this.activeCount++;
    }
    this._syncStacks();
    for (i = 0; i < this.pool.length; i++) {
      var rec = this.records[i % Math.max(this.records.length, 1)] || null;
      this.pool[i].record = rec;
      this.assignMesh(this.pool[i]);
    }
  };

  PunchCardSystem.prototype._syncStacks = function () {
    var a = Math.min(this.hopperCards.length, Math.max(0, Math.ceil(this.activeCount / 2)));
    var b = Math.min(this.stackerCards.length, Math.max(0, Math.ceil(this.beyondCount / 2)));
    var i;
    for (i = 0; i < this.hopperCards.length; i++) this.hopperCards[i].visible = i < a;
    for (i = 0; i < this.stackerCards.length; i++) this.stackerCards[i].visible = i < b;
  };

  PunchCardSystem.prototype.assignMesh = function (slot) {
    var rec = slot.record;
    if (!rec) {
      slot.mesh.visible = false;
      return;
    }
    slot.mesh.visible = true;
    slot.mesh.material = rec.beyond ? this.matBeyond : this.matLive;
    slot.mesh.userData.record = rec;
    if (slot.face) {
      this._printCard(slot);
      slot.face.mat.opacity = rec.beyond ? 0.38 : 1;
    }
  };

  PunchCardSystem.prototype.setSpeed = function (emergyDisplay, mind) {
    this.speed = 0.55 + (emergyDisplay || 0.4) * 0.7 + (mind || 0.5) * 0.25;
  };

  PunchCardSystem.prototype.freeze = function (record) {
    this.frozen = record;
    if (!record) return;
    for (var i = 0; i < this.pool.length; i++) {
      var s = this.pool[i];
      if (s.record && s.record.slug === record.slug) {
        s.progress = 0.47;
        var u = Math.max(0, Math.min(0.9999, s.progress));
        this.path.getPointAt(u, this._tmp);
        s.mesh.position.copy(this._tmp);
        s.mesh.rotation.set(0, 0, 0);
        s.mesh.material = this.matHot;
        break;
      }
    }
  };

  PunchCardSystem.prototype.release = function () {
    this.frozen = null;
  };

  PunchCardSystem.prototype.setHighlight = function (slugs) {
    this.highlight = new Set(slugs || []);
  };

  PunchCardSystem.prototype._plainMaterials = function () {
    for (var i = 0; i < this.pool.length; i++) {
      var s = this.pool[i];
      if (s.record && s.mesh.visible) {
        s.mesh.material = s.record.beyond ? this.matBeyond : this.matLive;
      }
    }
  };

  PunchCardSystem.prototype.setKinLines = function (heldSlug, slugs, extraRecs) {
    if (this.kinLines) {
      this.group.remove(this.kinLines);
      if (this.kinLines.geometry) this.kinLines.geometry.dispose();
      if (this.kinLines.material) this.kinLines.material.dispose();
      this.kinLines = null;
    }
    this._plainMaterials();
    if (!heldSlug || !slugs || !slugs.length) return;
    var i, s;
    var wanted = {};
    slugs.forEach(function (sl) { wanted[sl] = true; });
    var recBySlug = {};
    for (i = 0; i < this.records.length; i++) {
      if (this.records[i] && !recBySlug[this.records[i].slug]) recBySlug[this.records[i].slug] = this.records[i];
    }
    (extraRecs || []).forEach(function (r) {
      if (r && r.slug && !recBySlug[r.slug]) recBySlug[r.slug] = r;
    });
    var present = {};
    for (i = 0; i < this.pool.length; i++) {
      s = this.pool[i];
      if (s.record && (s.record.slug === heldSlug || wanted[s.record.slug])) present[s.record.slug] = true;
    }
    var need = slugs.filter(function (sl) { return !present[sl] && recBySlug[sl]; });
    if (!present[heldSlug] && recBySlug[heldSlug]) need.unshift(heldSlug);
    for (i = 0; i < this.pool.length && need.length; i++) {
      s = this.pool[i];
      if (!s.record) continue;
      if (s.record.slug === heldSlug || wanted[s.record.slug]) continue;
      s.record = recBySlug[need.shift()];
      this.assignMesh(s);
    }
    var bySlug = {};
    for (i = 0; i < this.pool.length; i++) {
      s = this.pool[i];
      if (s.record && s.mesh.visible && !bySlug[s.record.slug]) bySlug[s.record.slug] = s.mesh;
    }
    var origin = bySlug[heldSlug];
    if (!origin) return;
    for (i = 0; i < this.pool.length; i++) {
      s = this.pool[i];
      if (!s.record || !s.mesh.visible) continue;
      if (wanted[s.record.slug]) s.mesh.material = this.matKin;
      if (s.record.slug === heldSlug) s.mesh.material = this.matHot;
    }
    var pts = [];
    for (var j = 0; j < slugs.length; j++) {
      var m = bySlug[slugs[j]];
      if (!m || m === origin) continue;
      pts.push(origin.position.x, origin.position.y + 0.085, origin.position.z);
      pts.push(m.position.x, m.position.y + 0.085, m.position.z);
    }
    if (!pts.length) return;
    var geo = new this.THREE.BufferGeometry();
    geo.setAttribute('position', new this.THREE.Float32BufferAttribute(pts, 3));
    var mat = new this.THREE.LineBasicMaterial({ color: 0x86e6ab, transparent: true, opacity: 0.95 });
    this.kinLines = new this.THREE.LineSegments(geo, mat);
    this.kinLines.name = 'KinLines';
    this.group.add(this.kinLines);
  };

  PunchCardSystem.prototype._cardInThroat = function () {
    for (var i = 0; i < this.pool.length; i++) {
      var s = this.pool[i];
      if (s.record && s.progress > 0.42 && s.progress < 0.52) return s.record;
    }
    return this.frozen || null;
  };

  PunchCardSystem.prototype.tick = function (dt, time) {
    var halted = !!(this.frozen || this.held);
    var spin = this.speed * 6 * (halted ? 0.08 : 1);
    for (var r = 0; r < this.rollers.length; r++) {
      this.rollers[r].rotation.x += dt * spin * (r % 2 === 0 ? 1 : -1);
    }

    // Reader lamps = hole bits of the card under the head (hex → bits)
    var inThroat = this._cardInThroat();
    var bitStr = '';
    if (inThroat && inThroat.holes) {
      var hex = String(inThroat.holes);
      for (var h = 0; h < hex.length; h++) {
        var n = parseInt(hex.charAt(h), 16);
        if (isNaN(n)) continue;
        bitStr += ((n >> 3) & 1) + '' + ((n >> 2) & 1) + '' + ((n >> 1) & 1) + '' + (n & 1);
      }
    }
    for (var L = 0; L < this.readerLamps.length; L++) {
      var on = false;
      if (bitStr) on = bitStr.charAt(L % bitStr.length) === '1';
      else if (!halted) on = Math.sin(time * 14 + L) > 0.85;
      this.readerLamps[L].material.emissiveIntensity = on ? 0.95 : 0.06;
      this.readerLamps[L].material.emissive.setHex(
        on ? (inThroat && inThroat.beyond ? 0x446688 : 0xcc8800) : 0x331100
      );
    }

    if (halted) return;
    for (var i = 0; i < this.pool.length; i++) {
      var s = this.pool[i];
      if (!s.record) continue;
      var v = this.speed * s.speed * (s.record.beyond ? 0.5 : 1);
      if (s.progress > 0.42 && s.progress < 0.5) v *= 0.35;
      s.progress += dt * v;
      if (s.progress >= 1) {
        s.progress -= 1;
        if (this.records.length) {
          s.record = this.records[Math.floor(Math.random() * this.records.length)];
          this.assignMesh(s);
        }
      }
      var u = Math.max(0, Math.min(0.9999, s.progress));
      this.path.getPointAt(u, this._tmp);
      s.mesh.position.copy(this._tmp);
      s.mesh.rotation.set(0, 0, 0);

      var desired = s.record.beyond ? this.matBeyond : this.matLive;
      if (this.highlight.has(s.record.slug)) desired = this.matKin;
      if (u > 0.42 && u < 0.52 && !s.record.beyond) desired = this.matHot;
      if (s.mesh.material !== desired) s.mesh.material = desired;
    }
  };

  PunchCardSystem.prototype.pickables = function () {
    return this.group.children.filter(function (c) {
      return c.userData && c.userData.kind === 'station';
    });
  };

  PunchCardSystem.prototype.pick = function (raycaster) {
    var meshes = this.pool.map(function (s) { return s.mesh; }).filter(function (m) { return m.visible; });
    var hits = raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    return hits[0].object.userData.record || null;
  };

  global.TTGMachineCards = PunchCardSystem;
})(window);
