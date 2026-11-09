/**
 * tardis.js — K6 red telephone kiosk (CHRONOS relay booth).
 *
 * Accurate K6 proportions: body ≈ 0.92m wide × 0.92m deep.
 * Total scene height to lamp tip ≈ 3.0 units (1 unit ≈ 1m).
 */
import * as THREE from 'three';

const BOX_RED      = 0xcc2020;   // Post Office Red
const BOX_RED_DARK = 0x8c1515;
const TRIM         = 0x1a0808;
const BRASS        = 0xc9a227;
const GLASS        = 0xd4e8ff;
const INTERIOR     = 0x1a120c;

// Core geometry constants
const HW  = 0.46;   // body half-width (body = 0.92 × 0.92)
const WH  = 2.28;   // body wall height
const PW  = 0.10;   // corner pillar width/depth

function makeSignTexture(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0505';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = '#f5e6d3';
  ctx.font = 'bold 48px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 52);
  ctx.fillStyle = '#c9a227';
  ctx.font = '22px Share Tech Mono, monospace';
  ctx.fillText(subtitle, 256, 96);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makePanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 512);
  g.addColorStop(0, '#c42228');
  g.addColorStop(0.45, '#9a171c');
  g.addColorStop(1, '#701014');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 512, 2 + Math.random() * 18, 1 + Math.random() * 3);
  }
  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = 'rgba(255,220,180,0.03)';
    ctx.fillRect(x, 0, 1, 512);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function faceGroup(rotY) {
  const g = new THREE.Group();
  g.rotation.y = rotY;
  return g;
}

/**
 * Build the K6 crown above body top (y = WH/2 = 1.14).
 * The crown has a wide cornice overhang that tapers up in stepped tiers
 * to the lamp globe — the most recognisable feature of the K6.
 */
function buildCrown(booth, bodyMat, trimMat) {
  const bodyTop = WH / 2;             // 1.14
  const CROWN = 0xbb1a1a;

  const mkBox = (w, h, d, y, color, rough = 0.52, metal = 0.2) =>
    Object.assign(
      new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
      ),
      { position: { y } }
    );

  // Helper: add mesh with correct position
  function add(mesh, y) {
    mesh.position.y = y;
    mesh.castShadow = true;
    booth.add(mesh);
    return mesh;
  }

  // 1. Cornice slab — wide overhang, extends past body walls
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 + 0.18, 0.13, HW * 2 + 0.18),
    new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.5, metalness: 0.2 })
  );
  add(cornice, bodyTop + 0.065);

  // 2. Cornice fascia — slight ledge under the overhang lip
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 + 0.10, 0.07, HW * 2 + 0.10),
    new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.54, metalness: 0.18 })
  );
  add(fascia, bodyTop + 0.13 + 0.035);

  // 3. First step in — narrows
  const step1 = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 - 0.02, 0.10, HW * 2 - 0.02),
    new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.52, metalness: 0.2 })
  );
  add(step1, bodyTop + 0.21);

  // 4. Main crown body — narrower vertical block
  const crownMain = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 - 0.14, 0.28, HW * 2 - 0.14),
    new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.5, metalness: 0.22 })
  );
  add(crownMain, bodyTop + 0.41);

  // 5. Upper step — narrows again
  const step2 = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 - 0.26, 0.08, HW * 2 - 0.26),
    new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.52, metalness: 0.2 })
  );
  add(step2, bodyTop + 0.60);

  // 6. Crown cap — small flat cap before lamp pedestal
  const crownCap = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 - 0.38, 0.10, HW * 2 - 0.38),
    new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.48, metalness: 0.25 })
  );
  add(crownCap, bodyTop + 0.69);

  // 7. Lamp pedestal — brass cylinder rising from cap
  const lampPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.065, 0.20, 12),
    new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.35, metalness: 0.85 })
  );
  add(lampPedestal, bodyTop + 0.84);

  // 8. Lamp collar ring
  const lampCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.03, 16),
    new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.35, metalness: 0.85 })
  );
  add(lampCollar, bodyTop + 0.955);

  // 9. Lamp globe — the glowing top light
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfffce0,
      emissive: 0xffdd88,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.92,
      roughness: 0.12,
    })
  );
  lamp.name = 'lamp';
  lamp.position.y = bodyTop + 1.065;
  booth.add(lamp);

  // 10. Lamp cap (small dome over globe)
  const lampCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.08, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.35, metalness: 0.85 })
  );
  add(lampCap, bodyTop + 1.17);

  // Point light at lamp
  const lampLight = new THREE.PointLight(0xffdd88, 2.0, 10, 2);
  lampLight.name = 'lampLight';
  lampLight.position.y = bodyTop + 1.065;
  booth.add(lampLight);
}

/**
 * Add a face to the booth (sign + windows + lower panels).
 * faceG is a rotated Group; elements are placed at z = HW + small offset.
 */
function buildFace(faceG, glassMat, trimMat, bodyMat, darkMat, signTex) {
  const FZ  = HW + 0.025;   // face surface z in local space
  const W   = HW * 2 - PW;  // usable face width between pillars = 0.82

  // Face skin (solid red fill between pillars)
  const skin = new THREE.Mesh(
    new THREE.BoxGeometry(W, WH, 0.06),
    bodyMat
  );
  skin.position.set(0, 0, HW - 0.04);
  faceG.add(skin);

  // Sign frieze at top
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.04, 0.19, 0.05),
    new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x331008,
      emissiveIntensity: 0.25,
    })
  );
  sign.position.set(0, WH / 2 - 0.125, FZ);
  faceG.add(sign);

  // Windows: 2 columns × 2 rows of portrait-format panes
  // Window area spans y = 0.02 to 0.92 (centre at 0.47)
  const colXs = [-0.185, 0.185];
  const rowYs = [0.60, 0.14];     // top row, bottom row

  for (const cx of colXs) {
    for (const cy of rowYs) {
      // Window frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.44, 0.04),
        trimMat
      );
      frame.position.set(cx, cy, FZ);
      faceG.add(frame);

      // Glass pane
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.36, 0.03),
        glassMat
      );
      pane.position.set(cx, cy, FZ + 0.015);
      faceG.add(pane);

      // Horizontal muntin (cross-bar)
      const muntH = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.018, 0.04),
        trimMat
      );
      muntH.position.set(cx, cy, FZ + 0.02);
      faceG.add(muntH);

      // Vertical muntin
      const muntV = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.36, 0.04),
        trimMat
      );
      muntV.position.set(cx, cy, FZ + 0.02);
      faceG.add(muntV);
    }
  }

  // Lower solid panels (2 stacked below window area)
  const lowerPanelYs = [-0.38, -0.84];
  for (const ly of lowerPanelYs) {
    const outer = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.08, 0.40, 0.04),
      darkMat
    );
    outer.position.set(0, ly, FZ);
    faceG.add(outer);

    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.18, 0.28, 0.03),
      bodyMat
    );
    inner.position.set(0, ly, FZ + 0.015);
    faceG.add(inner);
  }
}

/**
 * Create the full K6 red phonebox group.
 */
export function createTardis() {
  const booth = new THREE.Group();
  booth.name = 'tardis';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: BOX_RED,
    map: makePanelTexture(),
    roughness: 0.48,
    metalness: 0.12,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: BOX_RED_DARK,
    roughness: 0.55,
    metalness: 0.15,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: TRIM,
    roughness: 0.7,
    metalness: 0.2,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: GLASS,
    emissive: 0xffdd88,
    emissiveIntensity: 0.12,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  glassMat.name = 'windowMaterial';
  glassMat.userData.keepTransparent = true;
  glassMat.userData.baseOpacity = 0.55;

  const bodyBot = -WH / 2;   // -1.14
  const bodyTop =  WH / 2;   //  1.14

  // ── Plinth (two-step base) ────────────────────────────────────────────
  const plinthA = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 + 0.20, 0.14, HW * 2 + 0.20),
    trimMat
  );
  plinthA.position.y = bodyBot - 0.07;
  plinthA.receiveShadow = true;
  booth.add(plinthA);

  const plinthB = new THREE.Mesh(
    new THREE.BoxGeometry(HW * 2 + 0.08, 0.09, HW * 2 + 0.08),
    darkMat
  );
  plinthB.position.y = bodyBot + 0.045;
  plinthB.receiveShadow = true;
  booth.add(plinthB);

  // ── Corner pillars ────────────────────────────────────────────────────
  const pillarGeo = new THREE.BoxGeometry(PW, WH, PW);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, trimMat);
      pillar.position.set(sx * HW, 0, sz * HW);
      pillar.castShadow = true;
      booth.add(pillar);
    }
  }

  // ── Body walls (back + two sides; front is door opening) ─────────────
  const wallW = HW * 2 - PW;   // 0.82  — clear span between pillar edges
  const wallD = 0.08;

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(wallW, WH, wallD), bodyMat);
  backWall.position.set(0, 0, -HW);
  backWall.castShadow = true;
  backWall.name = 'body';
  booth.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallD, WH, wallW), bodyMat);
  leftWall.position.set(-HW, 0, 0);
  leftWall.castShadow = true;
  booth.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallD, WH, wallW), bodyMat);
  rightWall.position.set(HW, 0, 0);
  rightWall.castShadow = true;
  booth.add(rightWall);

  // Header bar above the door opening (visible on front face)
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(wallW, 0.28, wallD),
    bodyMat
  );
  header.position.set(0, bodyTop - 0.14, HW);
  booth.add(header);

  // ── Interior ──────────────────────────────────────────────────────────
  const interior = new THREE.Group();
  interior.name = 'interior';
  booth.add(interior);

  const intBack = new THREE.Mesh(
    new THREE.BoxGeometry(wallW, WH, 0.06),
    new THREE.MeshStandardMaterial({ color: INTERIOR, roughness: 0.85 })
  );
  intBack.position.set(0, 0, -HW + 0.07);
  interior.add(intBack);

  // Phone unit on back wall
  const phoneMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.3 });
  const brassMat = new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.35, metalness: 0.85 });

  const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.42, 0.12), phoneMat);
  phoneBody.position.set(0, 0.18, -HW + 0.14);
  phoneBody.name = 'phoneBody';
  interior.add(phoneBody);

  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 24), brassMat);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 0.28, -HW + 0.22);
  dial.name = 'dial';
  interior.add(dial);

  const handsetMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const handset = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 8), handsetMat);
  bar.rotation.z = Math.PI / 2;
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), handsetMat);
  e1.position.x = -0.1;
  const e2 = e1.clone(); e2.position.x = 0.1;
  handset.add(bar, e1, e2);
  handset.position.set(0, 0.46, -HW + 0.22);
  handset.name = 'handset';
  interior.add(handset);

  const chrono = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x0a0505,
      emissive: 0xff4a20,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    })
  );
  chrono.position.set(0, -0.22, -HW + 0.18);
  chrono.name = 'chronoPanel';
  interior.add(chrono);

  const interiorLight = new THREE.PointLight(0xffaa66, 0.6, 3, 2);
  interiorLight.name = 'interiorLight';
  interiorLight.position.set(0, 0.5, 0);
  interior.add(interiorLight);

  // ── Ceiling / floor slabs ─────────────────────────────────────────────
  const ceilMesh = new THREE.Mesh(new THREE.BoxGeometry(wallW, 0.06, wallW), darkMat);
  ceilMesh.position.y = bodyTop - 0.03;
  booth.add(ceilMesh);

  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(wallW, 0.06, wallW), trimMat);
  floorMesh.position.y = bodyBot + 0.03;
  floorMesh.receiveShadow = true;
  booth.add(floorMesh);

  // ── Face detail: sides + back (front gets doors) ──────────────────────
  const signTex = makeSignTexture('TELEPHONE', 'CHRONOS RELAY');

  // Front sign & face detail above door opening
  {
    const frontFace = faceGroup(0);
    booth.add(frontFace);
    buildFaceSignOnly(frontFace, glassMat, trimMat, bodyMat, darkMat, signTex);
  }

  for (const rot of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const face = faceGroup(rot);
    booth.add(face);
    buildFace(face, glassMat, trimMat, bodyMat, darkMat, signTex);
  }

  // ── Door handle ───────────────────────────────────────────────────────
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 12, 12),
    brassMat
  );
  handle.position.set(0.10, -0.22, HW + 0.06);
  handle.name = 'handle';
  booth.add(handle);

  const handlePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.12, 0.02),
    brassMat
  );
  handlePlate.position.set(0.10, -0.22, HW + 0.03);
  booth.add(handlePlate);

  // ── Crown ─────────────────────────────────────────────────────────────
  buildCrown(booth, bodyMat, trimMat);

  return booth;
}

/**
 * Front face only adds sign + window framing above the door.
 * The door panels provide the lower windows and panels for the front face.
 */
function buildFaceSignOnly(faceG, glassMat, trimMat, bodyMat, darkMat, signTex) {
  const FZ = HW + 0.025;
  const W  = HW * 2 - PW;

  // Sign frieze above door
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.04, 0.19, 0.05),
    new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x331008,
      emissiveIntensity: 0.25,
    })
  );
  sign.position.set(0, WH / 2 - 0.125, FZ);
  faceG.add(sign);
}

/**
 * Create hinged door panels for open/close animation.
 */
export function createDoors(tardis) {
  const doorMat = new THREE.MeshStandardMaterial({
    color: BOX_RED,
    map: makePanelTexture(),
    roughness: 0.48,
    metalness: 0.12,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: GLASS,
    emissive: 0xff6a3a,
    emissiveIntensity: 0.15,
    transparent: true,
    opacity: 0.50,
    roughness: 0.15,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.65 });
  const brassMat = new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.35, metalness: 0.85 });

  // Each door is HW wide (half the body width)
  const DW = HW;   // 0.46

  function buildDoor(side) {
    const door = new THREE.Group();
    door.name = side === 'left' ? 'leftDoor' : 'rightDoor';

    // Door panel
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(DW, WH, 0.08),
      doorMat
    );
    panel.castShadow = true;
    door.add(panel);

    // Two portrait windows in upper section
    for (let row = 0; row < 2; row++) {
      const py = 0.60 - row * 0.48;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(DW - 0.14, 0.44, 0.04),
        trimMat
      );
      frame.position.set(0, py, 0.04);
      door.add(frame);

      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(DW - 0.20, 0.36, 0.03),
        glassMat
      );
      pane.position.set(0, py, 0.05);
      door.add(pane);

      const muntH = new THREE.Mesh(
        new THREE.BoxGeometry(DW - 0.20, 0.018, 0.04),
        trimMat
      );
      muntH.position.set(0, py, 0.055);
      door.add(muntH);

      const muntV = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.36, 0.04),
        trimMat
      );
      muntV.position.set(0, py, 0.055);
      door.add(muntV);
    }

    // Two lower recessed panels
    for (let i = 0; i < 2; i++) {
      const ly = -0.36 - i * 0.50;
      const outer = new THREE.Mesh(
        new THREE.BoxGeometry(DW - 0.10, 0.38, 0.04),
        new THREE.MeshStandardMaterial({ color: BOX_RED_DARK, roughness: 0.55 })
      );
      outer.position.set(0, ly, 0.03);
      door.add(outer);

      const inner = new THREE.Mesh(
        new THREE.BoxGeometry(DW - 0.18, 0.26, 0.03),
        doorMat
      );
      inner.position.set(0, ly, 0.045);
      door.add(inner);
    }

    // Brass handle
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), brassMat);
    const kx = side === 'left' ? 0.16 : -0.16;
    knob.position.set(kx, -0.22, 0.07);
    door.add(knob);

    // Pivot at outer edge — shift children so hinge is at group origin
    if (side === 'left') {
      door.position.set(-DW, 0, HW + 0.04);
      door.children.forEach((c) => {
        if (c.geometry) c.geometry.translate(DW / 2, 0, 0);
        else c.position.x += DW / 2;
      });
    } else {
      door.position.set(DW, 0, HW + 0.04);
      door.children.forEach((c) => {
        if (c.geometry) c.geometry.translate(-DW / 2, 0, 0);
        else c.position.x -= DW / 2;
      });
    }

    return door;
  }

  const leftDoor  = buildDoor('left');
  const rightDoor = buildDoor('right');
  tardis.add(leftDoor);
  tardis.add(rightDoor);

  return { leftDoor, rightDoor };
}
