/**
 * tardis.js — Hyper-detailed red K6-style telephone booth (CHRONOS).
 */
import * as THREE from 'three';

const BOX_RED = 0xb01a1f;
const BOX_RED_DARK = 0x6e1014;
const TRIM = 0x2a0c0c;
const BRASS = 0xc9a227;
const GLASS = 0xd8ecff;
const CROWN = 0x8a1218;
const INTERIOR = 0x1a120c;

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

  // Subtle panel wear
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 512, 2 + Math.random() * 18, 1 + Math.random() * 3);
  }

  // Vertical grain
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
 * Create the full red phonebox group (~4 units tall).
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
  const brassMat = new THREE.MeshStandardMaterial({
    color: BRASS,
    roughness: 0.35,
    metalness: 0.85,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: GLASS,
    emissive: 0xff6a3a,
    emissiveIntensity: 0.18,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  glassMat.name = 'windowMaterial';
  glassMat.userData.keepTransparent = true;
  glassMat.userData.baseOpacity = 0.55;

  // Plinth / base steps
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.18, 2.35),
    trimMat
  );
  plinth.position.y = -1.96;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  booth.add(plinth);

  const step = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.1, 2.15),
    darkMat
  );
  step.position.y = -1.82;
  step.receiveShadow = true;
  booth.add(step);

  // Shell walls — open front so hinged doors reveal the interior
  const wallH = 3.55;
  const wallY = -0.05;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, wallH, 0.1), bodyMat);
  back.position.set(0, wallY, -0.95);
  back.castShadow = true;
  back.receiveShadow = true;
  back.name = 'body';
  booth.add(back);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH, 1.9), bodyMat);
  leftWall.position.set(-0.95, wallY, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  booth.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH, 1.9), bodyMat);
  rightWall.position.set(0.95, wallY, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  booth.add(rightWall);

  // Ceiling / floor slabs inside the shell
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.9), darkMat);
  ceiling.position.set(0, 1.68, 0);
  booth.add(ceiling);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.9), trimMat);
  floor.position.set(0, -1.78, 0);
  floor.receiveShadow = true;
  booth.add(floor);

  // Corner pillars
  const pillarGeo = new THREE.BoxGeometry(0.14, 3.55, 0.14);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, darkMat);
      pillar.position.set(x * 0.99, -0.05, z * 0.99);
      pillar.castShadow = true;
      booth.add(pillar);
    }
  }

  // Face detailing on sides + back (front is the hinged doors)
  const faces = [
    { rot: Math.PI / 2, skipLower: false },
    { rot: Math.PI, skipLower: false },
    { rot: -Math.PI / 2, skipLower: false },
  ];
  const signTex = makeSignTexture('TELEPHONE', 'CHRONOS RELAY');

  // Front sign (above doors)
  const frontSignFace = faceGroup(0);
  booth.add(frontSignFace);
  const frontSign = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.28, 0.05),
    new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x331008,
      emissiveIntensity: 0.25,
    })
  );
  frontSign.position.set(0, 1.52, 1.02);
  frontSignFace.add(frontSign);

  // Front header bar above door opening
  const headerBar = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.35, 0.1), bodyMat);
  headerBar.position.set(0, 1.2, 1.0);
  booth.add(headerBar);

  for (const { rot } of faces) {
    const face = faceGroup(rot);
    booth.add(face);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.28, 0.05),
      new THREE.MeshStandardMaterial({
        map: signTex,
        roughness: 0.4,
        metalness: 0.2,
        emissive: 0x331008,
        emissiveIntensity: 0.25,
      })
    );
    sign.position.set(0, 1.52, 1.02);
    face.add(sign);

    // Solid face panel behind windows (closes the open wall gap on sides/back)
    const faceSkin = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 3.2, 0.08),
      bodyMat
    );
    faceSkin.position.set(0, -0.1, 0.96);
    face.add(faceSkin);

    for (let col = 0; col < 2; col++) {
      for (let row = 0; row < 2; row++) {
        const px = (col - 0.5) * 0.72;
        const py = 0.55 + row * 0.55;

        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.48, 0.04),
          trimMat
        );
        frame.position.set(px, py, 1.005);
        face.add(frame);

        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.38, 0.03),
          glassMat
        );
        pane.position.set(px, py, 1.03);
        face.add(pane);

        const muntH = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.025, 0.04),
          trimMat
        );
        muntH.position.set(px, py, 1.04);
        face.add(muntH);

        const muntV = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.38, 0.04),
          trimMat
        );
        muntV.position.set(px, py, 1.04);
        face.add(muntV);
      }
    }

    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.42, 0.05),
        darkMat
      );
      panel.position.set(0, -0.55 - i * 0.48, 1.01);
      face.add(panel);

      const inset = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.28, 0.03),
        bodyMat
      );
      inset.position.set(0, -0.55 - i * 0.48, 1.035);
      face.add(inset);
    }
  }

  // Crown / roof assembly
  const roofBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.18, 0.16, 2.18),
    new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.5, metalness: 0.25 })
  );
  roofBase.position.y = 1.78;
  roofBase.castShadow = true;
  booth.add(roofBase);

  const roofMid = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.14, 1.55),
    darkMat
  );
  roofMid.position.y = 1.92;
  booth.add(roofMid);

  const roofDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: CROWN, roughness: 0.4, metalness: 0.3 })
  );
  roofDome.position.y = 1.98;
  booth.add(roofDome);

  // Brass finial ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.025, 10, 32),
    brassMat
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2.12;
  booth.add(ring);

  // Lamp housing
  const lampCage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.22, 8, 1, true),
    brassMat
  );
  lampCage.position.y = 2.28;
  booth.add(lampCage);

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfff2d0,
      emissive: 0xff6a30,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.92,
      roughness: 0.15,
    })
  );
  lamp.name = 'lamp';
  lamp.position.y = 2.28;
  booth.add(lamp);

  const lampCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.1, 8),
    brassMat
  );
  lampCap.position.y = 2.42;
  booth.add(lampCap);

  const lampLight = new THREE.PointLight(0xff7a3a, 2.2, 10, 2);
  lampLight.name = 'lampLight';
  lampLight.position.y = 2.28;
  booth.add(lampLight);

  // Interior volume (visible when doors open)
  const interior = new THREE.Group();
  interior.name = 'interior';
  booth.add(interior);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 3.0, 0.08),
    new THREE.MeshStandardMaterial({ color: INTERIOR, roughness: 0.85 })
  );
  backWall.position.set(0, -0.1, -0.85);
  interior.add(backWall);

  // Phone unit
  const phoneBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.3 })
  );
  phoneBody.position.set(0, 0.15, -0.72);
  interior.add(phoneBody);

  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24),
    brassMat
  );
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 0.25, -0.6);
  dial.name = 'dial';
  interior.add(dial);

  const handsetMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const handset = new THREE.Group();
  const handsetBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 10), handsetMat);
  handsetBar.rotation.z = Math.PI / 2;
  const ear1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), handsetMat);
  ear1.position.x = -0.16;
  const ear2 = ear1.clone();
  ear2.position.x = 0.16;
  handset.add(handsetBar, ear1, ear2);
  handset.position.set(0, 0.48, -0.58);
  interior.add(handset);

  // Chronometer panel
  const chrono = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.35, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0x0a0505,
      emissive: 0xff4a20,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    })
  );
  chrono.position.set(0, -0.35, -0.7);
  chrono.name = 'chronoPanel';
  interior.add(chrono);

  const interiorLight = new THREE.PointLight(0xffaa66, 0.6, 4, 2);
  interiorLight.name = 'interiorLight';
  interiorLight.position.set(0, 0.8, 0);
  interior.add(interiorLight);

  // Door seam / brass handle (static cue; animated doors overlay)
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 12),
    brassMat
  );
  handle.position.set(0.18, -0.35, 1.08);
  handle.name = 'handle';
  booth.add(handle);

  const handlePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.2, 0.03),
    brassMat
  );
  handlePlate.position.set(0.18, -0.35, 1.04);
  booth.add(handlePlate);

  return booth;
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
    opacity: 0.5,
    roughness: 0.15,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.65 });

  function buildDoor(side) {
    const door = new THREE.Group();
    door.name = side === 'left' ? 'leftDoor' : 'rightDoor';

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 3.2, 0.08),
      doorMat
    );
    panel.castShadow = true;
    door.add(panel);

    // Door windows
    for (let row = 0; row < 2; row++) {
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.42, 0.04),
        glassMat
      );
      pane.position.set(0, 0.85 + row * 0.5, 0.04);
      door.add(pane);

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.5, 0.03),
        trimMat
      );
      frame.position.set(0, 0.85 + row * 0.5, 0.02);
      door.add(frame);
    }

    // Lower panels
    for (let i = 0; i < 2; i++) {
      const lower = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.5, 0.04),
        new THREE.MeshStandardMaterial({ color: BOX_RED_DARK, roughness: 0.55 })
      );
      lower.position.set(0, -0.35 - i * 0.6, 0.03);
      door.add(lower);
    }

    // Pivot at outer edge: shift child geometry/positions so hinge is at door.position
    if (side === 'left') {
      door.position.set(-0.92, -0.15, 1.05);
      door.children.forEach((c) => {
        if (c.geometry) c.geometry.translate(0.46, 0, 0);
        else c.position.x += 0.46;
      });
    } else {
      door.position.set(0.92, -0.15, 1.05);
      door.children.forEach((c) => {
        if (c.geometry) c.geometry.translate(-0.46, 0, 0);
        else c.position.x -= 0.46;
      });
    }

    return door;
  }

  const leftDoor = buildDoor('left');
  const rightDoor = buildDoor('right');
  tardis.add(leftDoor);
  tardis.add(rightDoor);

  // Hide front-face body strip under doors by covering with doors
  return { leftDoor, rightDoor };
}
