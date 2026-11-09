// Face tracking as a mix controller: head pose and expression, measured relative to the
// player's own resting pose, with dead zones so ordinary movement leaves the mix alone.
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// One MediaPipe runtime for hands and face: two separate runtimes clash over the same globals.
let vision = null;
const loadVision = () => (vision = vision || (async () => {
  const mod = await import(`${VISION}/vision_bundle.mjs`);
  return { ...mod, files: await mod.FilesetResolver.forVisionTasks(`${VISION}/wasm`) };
})());
async function create(Task, baseOptions, options, delegate = 'GPU') {
  const { files } = await loadVision();
  try { return await Task.createFromOptions(files, { baseOptions: { ...baseOptions, delegate }, ...options }); } catch (_) {
    return Task.createFromOptions(files, { baseOptions: { ...baseOptions, delegate: 'CPU' }, ...options });
  }
}

export async function loadHands() {
  const { HandLandmarker } = await loadVision();
  return create(HandLandmarker, { modelAssetPath: HAND_MODEL }, {
    runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const zone = (v, dead, full) => Math.sign(v) * clamp((Math.abs(v) - dead) / (full - dead), 0, 1);
const follow = (v, t, dt, rate) => v + (t - v) * (1 - Math.exp(-dt * rate));

export class FaceControl {
  constructor() {
    this.lm = null;
    this.on = true;
    this.found = false;
    this.points = null;
    this.raw = null;
    this.neutral = null;
    this.calib = [];
    this.out = { filter: 0, xfade: 0, space: 0, echo: 0, dirt: 0 };
    this.lastSeen = 0;
  }

  async load() {
    const { FaceLandmarker } = await loadVision();
    this.lm = await create(FaceLandmarker, { modelAssetPath: MODEL }, {
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, minFaceDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
    }, 'CPU'); // In testing the GPU path missed upright faces and was no faster.
  }

  recentre() { this.neutral = null; this.calib = []; }

  close() { try { if (this.lm) this.lm.close(); } catch (_) { /* closed */ } this.lm = null; }

  // toScreen maps video-normalised points to mirrored screen space; aspect is screen width / height.
  detect(video, now, toScreen, aspect) {
    if (!this.lm) return;
    // MediaPipe rejects any frame not stamped later than the last one it saw.
    this.lastT = Math.max(now, (this.lastT || 0) + 1);
    const res = this.lm.detectForVideo(video, this.lastT);
    const lm = res.faceLandmarks && res.faceLandmarks[0];
    if (!lm) { this.found = now - this.lastSeen < 400 && this.found; if (!this.found) this.points = null; return; }
    this.found = true;
    this.lastSeen = now;
    const P = lm.map(p => toScreen(p.x, p.y));
    this.points = P;
    const X = i => P[i].x * aspect, Y = i => P[i].y;
    // Eye outer corners, cheeks, nose tip, chin. Screen space, so left and right match the mirror.
    const [ea, eb] = X(33) < X(263) ? [33, 263] : [263, 33];
    const roll = Math.atan2(Y(eb) - Y(ea), X(eb) - X(ea)) * 180 / Math.PI;
    const [ca, cb] = X(234) < X(454) ? [234, 454] : [454, 234];
    const width = Math.max(1e-3, X(cb) - X(ca));
    const yaw = (X(1) - (X(ca) + X(cb)) / 2) / (width / 2);
    const eyeY = (Y(33) + Y(263)) / 2;
    const pitch = (Y(1) - eyeY) / Math.max(1e-3, Y(152) - eyeY);
    const bs = {};
    ((res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories) || []).forEach(c => { bs[c.categoryName] = c.score; });
    const brow = Math.max(bs.browInnerUp || 0, ((bs.browOuterUpLeft || 0) + (bs.browOuterUpRight || 0)) / 2);
    this.raw = { roll, yaw, pitch, jaw: bs.jawOpen || 0, brow };
    if (!this.neutral) {
      this.calib.push(this.raw);
      if (this.calib.length >= 15) {
        const avg = k => this.calib.reduce((s, r) => s + r[k], 0) / this.calib.length;
        this.neutral = { roll: avg('roll'), yaw: avg('yaw'), pitch: avg('pitch'), jaw: avg('jaw'), brow: avg('brow') };
      }
    }
  }

  // Smoothed mix offsets; all zero while off, calibrating, or when the face is lost.
  update(dt) {
    const r = this.raw, n = this.neutral, live = this.on && this.found && r && n;
    const target = live ? {
      filter: zone(r.roll - n.roll, 6, 26),
      xfade: zone(r.yaw - n.yaw, 0.1, 0.5),
      space: clamp(zone(n.pitch - r.pitch, 0.04, 0.16), 0, 1),
      echo: clamp(zone(r.jaw - n.jaw, 0.1, 0.55), 0, 1),
      dirt: clamp(zone(r.brow - n.brow, 0.12, 0.5), 0, 1),
    } : { filter: 0, xfade: 0, space: 0, echo: 0, dirt: 0 };
    for (const k in this.out) this.out[k] = follow(this.out[k], target[k], dt, live ? 9 : 3);
    return this.out;
  }

  get calibrating() { return this.on && this.found && !this.neutral; }
}
