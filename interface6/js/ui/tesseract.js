/* The tesseract at Tiferet. Its eight cubic cells are the eight tracks.
   Choosing a track turns the hypercube through the fourth dimension until
   that track's cell is the inner cube. Edges glow in a track's colour while
   it sounds; the chosen cell is drawn in amber. */
import { THREE, C } from './gl.js';

const AX = { x: 0, y: 1, z: 2, w: 3 };
/* track k -> cell (axis, sign). Track 0 starts as the inner cube (w = -1). */
export const CELLS = [['w', -1], ['x', -1], ['x', 1], ['y', -1], ['y', 1], ['z', -1], ['z', 1], ['w', 1]];
const TURN = (Math.PI / 2) / 0.42; // rad/s, a quarter turn in ~0.4s

function target(k) {
  const [a, s] = CELLS[k];
  if (a === 'w') return s < 0 ? { plane: 0, theta: 0 } : { plane: 0, theta: Math.PI };
  return { plane: AX[a], theta: -s * Math.PI / 2 };
}

export function buildTesseract(parent, scale = 2.9) {
  const verts = [];
  for (let i = 0; i < 16; i++) verts.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  const edges = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      const d = i ^ j;
      if (d && !(d & (d - 1))) edges.push([i, j]);
    }
  }
  /* an edge lies in the three cells that fix the coordinates it does not vary */
  const edgeCells = edges.map(([i, j]) => {
    const out = [];
    CELLS.forEach(([a, s], k) => {
      const ax = AX[a];
      if (verts[i][ax] === s && verts[j][ax] === s) out.push(k);
    });
    return out;
  });

  const pos = new Float32Array(edges.length * 6);
  const col = new Float32Array(edges.length * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 1, depthTest: false, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, material);
  lines.renderOrder = 0;
  lines.frustumCulled = false;
  parent.add(lines);

  const cur = { plane: 0, theta: 0 };
  let goal = { plane: 0, theta: 0 };
  let time = 0;
  const p3 = verts.map(() => new THREE.Vector3());
  const cDim = new THREE.Color(C.dim).multiplyScalar(0.55);
  const cHot = new THREE.Color(C.hot);
  const tmp = new THREE.Color();

  function setFocus(k) { goal = target(k); }

  function stepRotation(dt) {
    const toward = (aim) => {
      const d = aim - cur.theta;
      const s = Math.min(Math.abs(d), TURN * dt);
      cur.theta += Math.sign(d) * s;
      return Math.abs(aim - cur.theta) < 1e-4;
    };
    if (cur.plane !== goal.plane) {
      if (toward(0)) cur.plane = goal.plane;
    } else {
      toward(goal.theta);
    }
  }

  /** cellState(k) -> { color: THREE.Color|null, level 0..1 } ; focus k */
  function update(dt, focus, cellState) {
    time += dt;
    stepRotation(dt);
    const cs = Math.cos(cur.theta);
    const sn = Math.sin(cur.theta);
    const yaw = 0.55 + Math.sin(time * 0.21) * 0.35;
    const pitch = 0.38 + Math.sin(time * 0.13) * 0.08;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    verts.forEach((v, i) => {
      const r = v.slice();
      const a = cur.plane;
      r[a] = v[a] * cs - v[3] * sn;
      r[3] = v[a] * sn + v[3] * cs;
      const f = 2 / (3 - r[3]);
      let x = r[0] * f, y = r[1] * f, z = r[2] * f;
      // gentle 3D turn so the hypercube reads in depth
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const y1 = y * cp - z1 * sp;
      const z2 = y * sp + z1 * cp;
      p3[i].set(x1 * scale, y1 * scale, z2 * scale * 0.4);
    });

    const settled = cur.plane === goal.plane && Math.abs(cur.theta - goal.theta) < 1e-3;
    edges.forEach(([i, j], e) => {
      pos.set([p3[i].x, p3[i].y, p3[i].z, p3[j].x, p3[j].y, p3[j].z], e * 6);
      let c = cDim;
      let best = 0;
      for (const k of edgeCells[e]) {
        if (k === focus && settled) { c = cHot; best = 2; break; }
        const st = cellState(k);
        if (st.color && st.level + 0.3 > best) {
          best = st.level + 0.3;
          tmp.copy(st.color).multiplyScalar(0.35 + st.level * 0.9);
          c = tmp;
        }
      }
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], e * 6);
    });
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { lines, setFocus, update };
}
