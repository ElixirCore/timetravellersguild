/* Toby — the feed as one endless film. The photos are drawn in WebGL, butted
   together three across in a grid that holds still (drag or wheel it; after
   the last photo comes the first again, with no seam). Tap a photo and
   the film opens full screen, one photo across at its own shape, starting
   from that photo and scrolling down forever the same way; × or Esc (or
   back) returns to the grid. Drag, fling or wheel to move either yourself.
   The eight goðen glyphs at the top each lay a filter over the film, and
   they stack:

     ∅ 0 origin     void       a breathing circle of negative, a held absence
     • 1 individual mosaic     the film breaks into single points
     ↔ 2 duality    mirror     left answers right, colours split apart
     △ 3 space      ripple     the surface moves; a tap sends out a ring
     ⧖ 4 time       trails     every frame lingers into the next
     ◇ 5 context    overlay    a duotone wash in the ring's colours
     ⛓ 6 linker     glitch     slices of the film jump out of line
     ✶ 7 emergence  kaleido    a pattern that only appears when folded

   Without WebGL the ordinary grid stays, as before. */
(() => {
  'use strict';

  const posts = JSON.parse(document.getElementById('posts')?.textContent || '[]');
  const grid = document.getElementById('grid');
  const glyphs = [...document.querySelectorAll('.goden [data-fx]')];
  if (!grid || !posts.length) { glyphs.forEach(b => { b.disabled = true; }); return; }

  const canvas = document.createElement('canvas');
  canvas.className = 'film';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${posts.length} photos drifting past in a loop. Arrow keys move it, Enter opens the photo in the middle.`);
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) { glyphs.forEach(b => { b.disabled = true; }); return; }

  grid.before(canvas);
  document.body.classList.add('gl-feed');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED = { grid: 0, col: reduceMotion ? 0 : 42 };   // css px per second: the grid holds still, the feed drifts
  const N = posts.length;
  const ASPECT = 4 / 3;                    // grid cells are 3:4, as in the grid

  /* ------------------------------------------------------------ shaders */

  const VS_QUAD = `
    attribute vec2 a;
    uniform vec4 u_rect;    // x, y, w, h in device px
    uniform vec2 u_res;
    varying vec2 v;
    void main() {
      v = a;
      vec2 p = (u_rect.xy + a * u_rect.zw) / u_res;
      gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
    }`;
  const FS_CELL = `
    precision mediump float;
    varying vec2 v;
    uniform sampler2D u_lq, u_hi;
    uniform vec3 u_col;
    uniform vec4 u_crop;    // the part of the photo showing: scale xy, offset zw
    uniform float u_hasLq, u_hi_in;
    void main() {
      vec2 t = v * u_crop.xy + u_crop.zw;
      vec3 c = u_col;
      if (u_hasLq > 0.5) c = texture2D(u_lq, t).rgb;
      if (u_hi_in > 0.0) c = mix(c, texture2D(u_hi, t).rgb, u_hi_in);
      gl_FragColor = vec4(c, 1.0);
    }`;
  const FS_BADGE = `
    precision mediump float;
    varying vec2 v;
    uniform sampler2D u_hi;
    void main() { gl_FragColor = texture2D(u_hi, v); }`;
  const VS_FULL = `
    attribute vec2 a;
    varying vec2 v;
    void main() { v = a; gl_Position = vec4(a * 2.0 - 1.0, 0.0, 1.0); }`;
  const FS_COPY = `
    precision mediump float;
    varying vec2 v;
    uniform sampler2D u_src;
    void main() { gl_FragColor = texture2D(u_src, v); }`;
  const FS_FX = `
    precision highp float;
    varying vec2 v;
    uniform sampler2D u_src, u_prev;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_fx[8];
    uniform vec4 u_tap;     // x, y (uv), seconds since, on
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 asp = vec2(u_res.x / u_res.y, 1.0);
      vec2 uv = v;

      // ✶ emergence: fold the film into eight
      if (u_fx[7] > 0.001) {
        vec2 p = (uv - 0.5) * asp;
        float r = length(p), seg = 6.2831853 / 8.0;
        float a = mod(atan(p.y, p.x) + u_time * 0.07, seg);
        a = abs(a - seg * 0.5);
        uv = mix(uv, vec2(cos(a), sin(a)) * r / asp + 0.5, u_fx[7]);
      }
      // ↔ duality: the left half answers the right
      if (u_fx[2] > 0.001) uv.x = mix(uv.x, 0.5 - abs(uv.x - 0.5), u_fx[2]);
      // △ space: the surface moves; a tap sends out a ring
      if (u_fx[3] > 0.001) {
        vec2 p = (uv - 0.5) * asp;
        float d = length(p);
        vec2 off = p / (d + 1e-4) * sin(d * 38.0 - u_time * 2.6) * 0.0045
                 + vec2(sin(uv.y * 23.0 + u_time * 1.7), cos(uv.x * 19.0 + u_time * 1.3)) * 0.0025;
        if (u_tap.w > 0.5) {
          vec2 q = (uv - u_tap.xy) * asp;
          float dq = length(q), t = u_tap.z;
          off += q / (dq + 1e-4) * exp(-pow((dq - t * 0.5) * 16.0, 2.0)) * exp(-t * 1.1) * 0.035;
        }
        uv += off * u_fx[3];
      }
      // ⛓ linker: slices jump out of line, in bursts
      float g = u_fx[6];
      float tick = floor(u_time * 11.0);
      float burst = step(0.5, hash(vec2(tick, 3.7)));
      if (g > 0.001) {
        float r = hash(vec2(floor(uv.y * 26.0), tick));
        uv.x += (r - 0.5) * 0.16 * step(0.78, r) * burst * g;
        float r2 = hash(vec2(floor(uv.y * 7.0), tick + 9.0));
        uv.y += (r2 - 0.5) * 0.03 * step(0.9, r2) * burst * g;
      }
      // • individual: single points
      if (u_fx[1] > 0.001) {
        float n = mix(420.0, 38.0, u_fx[1]);
        vec2 cells = vec2(n * asp.x, n);
        uv = (floor(uv * cells) + 0.5) / cells;
      }
      uv = fract(uv);

      float split = 0.0045 * u_fx[2] + 0.014 * g * burst * step(0.6, hash(vec2(tick, 1.3)));
      vec3 col = vec3(texture2D(u_src, uv + vec2(split, 0.0)).r,
                      texture2D(u_src, uv).g,
                      texture2D(u_src, uv - vec2(split, 0.0)).b);
      if (u_fx[1] > 0.001) {   // round points, not squares
        float n = mix(420.0, 38.0, u_fx[1]);
        vec2 f = fract(v * vec2(n * asp.x, n)) - 0.5;
        col *= mix(1.0, smoothstep(0.52, 0.36, length(f)), u_fx[1]);
      }
      if (g > 0.001) col *= 1.0 - 0.14 * g * step(0.5, fract(gl_FragCoord.y * 0.5));

      // ∅ origin: a breathing circle of negative
      if (u_fx[0] > 0.001) {
        float R = 0.28 + 0.1 * sin(u_time * 0.8);
        float m = smoothstep(R + 0.025, R - 0.025, length((v - 0.5) * asp));
        col = mix(col, 1.0 - col, m * u_fx[0]);
      }
      // ◇ context: a duotone wash in the ring's colours, with a passing light
      if (u_fx[5] > 0.001) {
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 duo = mix(vec3(0.357, 0.557, 0.941), vec3(1.0, 0.843, 0.431), smoothstep(0.08, 0.92, l));
        duo = mix(duo, vec3(0.925, 0.373, 0.49), smoothstep(0.3, 0.0, abs(l - 0.45)) * 0.35);
        duo += smoothstep(0.85, 1.0, sin((v.x + v.y) * 2.4 - u_time * 0.5)) * 0.18;
        col = mix(col, duo, u_fx[5] * 0.88);
      }
      // ⧖ time: every frame lingers into the next
      col = mix(col, texture2D(u_prev, v).rgb, 0.88 * u_fx[4]);
      gl_FragColor = vec4(col, 1.0);
    }`;

  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  let P;
  try {
    P = {
      cell: program(VS_QUAD, FS_CELL),
      badge: program(VS_QUAD, FS_BADGE),
      fx: program(VS_FULL, FS_FX),
      copy: program(VS_FULL, FS_COPY),
    };
  } catch (err) {
    canvas.remove();
    document.body.classList.remove('gl-feed');
    glyphs.forEach(b => { b.disabled = true; });
    return;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  /* ----------------------------------------------------------- textures */

  function texture(src) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return t;
  }

  const hexRGB = h => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    const n = m ? parseInt(m[1], 16) : 0xf3ece2;
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };

  const cells = posts.map(p => ({
    col: hexRGB(p.c), lq: null, hi: null, hiAt: 0, big: null, bigAsked: false,
    tall: (p.h && p.w) ? p.h / p.w : ASPECT,   // height over width
    audio: !!p.audio,
  }));
  const load = (url, done) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => done(img);
    img.src = url;
  };
  posts.forEach((p, i) => {
    if (p.lq) load(p.lq, img => { cells[i].lq = texture(img); });
  });
  // the full thumbnails, in feed order so the first screen fills first
  let next = 0;
  const pump = () => {
    if (next >= N) return;
    const i = next++;
    load(posts[i].src.t[0], img => { cells[i].hi = texture(img); cells[i].hiAt = performance.now(); pump(); });
  };
  for (let k = 0; k < 4; k++) pump();
  // one across wants the sharper size; fetched as each photo comes near
  const wantBig = i => {
    const c = cells[i];
    if (c.bigAsked) return;
    c.bigAsked = true;
    load(posts[i].src.m[0], img => { c.big = texture(img); });
  };

  /* the voice-note chip, as on the grid */
  const badge = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,.45)';
    x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
    x.translate(12, 12); x.scale(40 / 24, 40 / 24);
    x.strokeStyle = '#fff'; x.lineWidth = 1.8; x.lineCap = x.lineJoin = 'round';
    x.stroke(new Path2D('M4 9v6h4l5 4V5L8 9H4z'));
    x.stroke(new Path2D('M16.5 8.5c1.8 2 1.8 5 0 7'));
    return texture(c);
  })();

  /* ------------------------------------------------------ render targets */

  let W = 0, H = 0, dpr = 1;
  let filmFbo = null, ping = [];
  function target(w, h) {
    const tex = texture(null);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb };
  }
  function drop(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } }

  let offset = 0;          // device px scrolled through the film
  function resize() {
    const r = canvas.getBoundingClientRect();
    const nd = Math.min(2, devicePixelRatio || 1);
    const nw = Math.max(1, Math.round(r.width * nd));
    const nh = Math.max(1, Math.round(r.height * nd));
    if (nw === W && nh === H) return;
    if (W) { offset *= nw / W; gridOffset *= nw / W; }  // keep the same photo at the top
    W = canvas.width = nw;
    H = canvas.height = nh;
    dpr = nd;
    drop(filmFbo); ping.forEach(drop);
    filmFbo = target(W, H);
    ping = [target(W, H), target(W, H)];
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* --------------------------------------------------------------- input */

  const fx = new Float32Array(8);       // how much of each filter is showing
  const want = new Float32Array(8);     // what the glyphs ask for
  glyphs.forEach(b => {
    b.addEventListener('click', () => {
      const k = +b.dataset.fx;
      want[k] = want[k] ? 0 : 1;
      b.setAttribute('aria-pressed', want[k] ? 'true' : 'false');
      wake();
    });
  });

  let fling = 0;           // device px per second, on top of the drift
  let drag = null;
  let tap = { x: 0.5, y: 0.5, at: -1e9 };
  let mode = 'grid';       // 'grid': three across; 'col': one across, full screen
  let paused = false;
  let gridOffset = 0;
  const cellW = () => W / 3;
  const cellH = () => cellW() * ASPECT;
  const colW = () => Math.min(W, Math.round(640 * dpr));   // one across, at most a phone's width wide
  const colH = i => Math.max(1, Math.round(colW() * cells[i].tall));
  const period = () => {      // the film repeats after every photo has passed once
    if (mode === 'grid') return N * cellH();
    let s = 0;
    for (let i = 0; i < N; i++) s += colH(i);
    return s;
  };
  const colTop = i => { let s = 0; for (let k = 0; k < i; k++) s += colH(k); return s; };

  /* the photos on screen now: index, rectangle (device px) and the crop that fills it */
  function visible() {
    const out = [];
    if (mode === 'grid') {
      const cw = cellW(), ch = cellH();
      const r0 = Math.floor(offset / ch);
      const rows = Math.ceil(H / ch) + 1;
      for (let r = r0; r <= r0 + rows; r++) {
        const y = r * ch - offset;
        for (let c = 0; c < 3; c++) {
          const i = (((r * 3 + c) % N) + N) % N;
          // whole device pixels, so neighbours butt together with no hairline
          const x0 = Math.round(c * cw), x1 = Math.round((c + 1) * cw);
          const y0 = Math.round(y), y1 = Math.round(y + ch);
          // cover: crop the photo to the 3:4 cell, centred
          const t = cells[i].tall;
          const crop = t > ASPECT ? [1, ASPECT / t, 0, (1 - ASPECT / t) / 2] : [t / ASPECT, 1, (1 - t / ASPECT) / 2, 0];
          out.push({ i, x0, y0, x1, y1, crop });
        }
      }
    } else {
      let y = -Math.round(offset);
      const x0 = Math.round((W - colW()) / 2), x1 = x0 + colW();
      for (let k = 0; y < H && k < 4 * N; k++) {
        const i = k % N;
        const h = colH(i);
        if (y + h > 0) out.push({ i, x0, y0: y, x1, y1: y + h, crop: [1, 1, 0, 0] });
        y += h;
      }
    }
    return out;
  }
  let shown = [];

  const local = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    return [(cx - r.left) * dpr, (cy - r.top) * dpr];
  };
  const hitAt = (cx, cy) => {
    const [x, y] = local(cx, cy);
    return shown.find(c => x >= c.x0 && x < c.x1 && y >= c.y0 && y < c.y1) || null;
  };

  /* ---------------------------------------------- one across, full screen */
  const bar = document.createElement('div');
  bar.className = 'film-bar';
  bar.hidden = true;
  bar.innerHTML = '<button type="button" class="film-close" aria-label="Back to the grid (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  document.body.append(bar);
  const godenRow = document.querySelector('.goden');
  const godenHome = godenRow && document.createComment('goden');

  function openColumn(i) {
    if (mode === 'col') return;
    gridOffset = offset;
    mode = 'col';
    paused = false;
    fling = 0;
    canvas.classList.add('solo');
    document.body.classList.add('film-open');
    if (godenRow) { godenRow.replaceWith(godenHome); bar.append(godenRow); }
    bar.hidden = false;
    resize();
    offset = colTop(i);
    for (let k = 0; k < 3; k++) wantBig((i + k) % N);
    history.pushState({ film: 1 }, '', '#feed/' + posts[i].id);
    canvas.focus({ preventScroll: true });
    wake();
  }
  function closeColumn(fromHistory) {
    if (mode !== 'col') return;
    if (!fromHistory && history.state?.film) { history.back(); return; }   // popstate comes back here
    mode = 'grid';
    paused = false;
    fling = 0;
    canvas.classList.remove('solo');
    document.body.classList.remove('film-open');
    if (godenRow) godenHome.replaceWith(godenRow);
    bar.hidden = true;
    resize();
    offset = gridOffset;
    if (location.hash.startsWith('#feed/')) history.replaceState(null, '', location.pathname + location.search);
    wake();
  }
  bar.querySelector('.film-close').addEventListener('click', () => closeColumn(false));
  addEventListener('popstate', () => { if (mode === 'col' && !location.hash.startsWith('#feed/')) closeColumn(true); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && mode === 'col') { e.preventDefault(); closeColumn(false); } });
  // the avatar opens the newest photo the same way
  document.addEventListener('click', e => {
    if (!e.target.closest?.('.avatar[data-open]')) return;
    e.preventDefault();
    e.stopPropagation();
    openColumn(0);
  }, true);
  // a #feed/<id> link opens straight onto that photo
  {
    const m = location.hash.match(/^#feed\/(.+)$/);
    const i = m ? posts.findIndex(p => p.id === m[1]) : -1;
    if (i >= 0) { history.replaceState(null, '', location.pathname + location.search); openColumn(i); }
  }

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), lastT: performance.now(), vy: 0, moved: false };
    fling = 0;
    const r = canvas.getBoundingClientRect();
    tap = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, at: performance.now() };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    wake();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const now = performance.now();
    const dy = e.clientY - drag.y;
    drag.y = e.clientY;
    offset -= dy * dpr;
    const dt = Math.max(1, now - drag.lastT) / 1000;
    drag.vy = drag.vy * 0.6 + (dy / dt) * 0.4;
    drag.lastT = now;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) drag.moved = true;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (e.type === 'pointercancel') return;
    if (!d.moved && performance.now() - d.t0 < 500) {
      const hit = hitAt(e.clientX, e.clientY);
      if (!hit) return;
      if (mode === 'grid') { openColumn(hit.i); return; }
      // one across: the voice chip plays the note; anywhere else holds the film still
      const [x, y] = local(e.clientX, e.clientY);
      if (cells[hit.i].audio && x > hit.x1 - 72 * dpr && y > hit.y1 - 72 * dpr) window.tobyVoice?.(hit.i);
      else { paused = !paused; wake(); }
      return;
    }
    if (performance.now() - d.lastT < 80) fling = -d.vy * dpr;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    offset += (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * dpr;
    wake();
  }, { passive: false });
  canvas.addEventListener('keydown', e => {
    const step = (mode === 'grid' ? cellH() : H) * 0.5;
    if (e.key === 'ArrowDown') { e.preventDefault(); fling = 0; offset += step; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); fling = 0; offset -= step; }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const hit = hitAt(r.left + r.width / 2, r.top + r.height / 2);
      if (mode === 'grid' && hit) openColumn(hit.i);
      else if (mode === 'col') paused = !paused;
    }
    wake();
  });
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    running = false;
    canvas.remove();
    document.body.classList.remove('gl-feed');   // back to the plain grid
    glyphs.forEach(b => { b.disabled = true; });
  });

  /* ---------------------------------------------------------------- draw */

  function drawFilm(now) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, filmFbo.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const { p, u } = P.cell;
    gl.useProgram(p);
    gl.uniform2f(u.u_res, W, H);
    gl.uniform1i(u.u_lq, 0);
    gl.uniform1i(u.u_hi, 1);
    const badges = [];
    shown = visible();
    for (const { i, x0, y0, x1, y1, crop } of shown) {
      const cell = cells[i];
      if (mode === 'col') wantBig(i);
      gl.uniform4f(u.u_rect, x0, y0, x1 - x0, y1 - y0);
      gl.uniform4fv(u.u_crop, crop);
      gl.uniform3fv(u.u_col, cell.col);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cell.lq);
      gl.uniform1f(u.u_hasLq, cell.lq ? 1 : 0);
      gl.activeTexture(gl.TEXTURE1);
      const big = mode === 'col' && cell.big;
      gl.bindTexture(gl.TEXTURE_2D, big ? cell.big : cell.hi);
      gl.uniform1f(u.u_hi_in, big ? 1 : cell.hi ? Math.min(1, (now - cell.hiAt) / 450) : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (cell.audio) badges.push([x1, y1]);
    }
    if (badges.length) {
      const b = P.badge;
      gl.useProgram(b.p);
      gl.uniform2f(b.u.u_res, W, H);
      gl.uniform1i(b.u.u_hi, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, badge);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const s = (mode === 'col' ? 40 : 26) * dpr, m = (mode === 'col' ? 14 : 6) * dpr;
      for (const [x1, y1] of badges) {
        gl.uniform4f(b.u.u_rect, x1 - s - m, y1 - s - m, s, s);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.disable(gl.BLEND);
    }
  }

  let pi = 0;
  function drawFx(now) {
    const out = ping[pi], prev = ping[1 - pi];
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fb);
    gl.viewport(0, 0, W, H);
    const { p, u } = P.fx;
    gl.useProgram(p);
    gl.uniform2f(u.u_res, W, H);
    gl.uniform1f(u.u_time, (now / 1000) % 3600);
    gl.uniform1fv(u.u_fx, fx);
    const since = (now - tap.at) / 1000;
    gl.uniform4f(u.u_tap, tap.x, 1 - tap.y, since, since < 4 ? 1 : 0);
    gl.uniform1i(u.u_src, 0);
    gl.uniform1i(u.u_prev, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, filmFbo.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prev.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(P.copy.p);
    gl.uniform1i(P.copy.u.u_src, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, out.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    pi = 1 - pi;
  }

  /* ----------------------------------------------------------------- run */

  let running = false;
  let last = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    if (!drag) {
      offset += ((paused ? 0 : SPEED[mode]) * dpr + fling) * dt;
      fling *= Math.exp(-dt * 2.4);
      if (Math.abs(fling) < 1) fling = 0;
    }
    const per = period();
    offset = ((offset % per) + per) % per;
    for (let k = 0; k < 8; k++) fx[k] += (want[k] - fx[k]) * Math.min(1, dt * 4);
    drawFilm(now);
    drawFx(now);
    // with nothing moving there is nothing new to draw
    const still = (paused || !SPEED[mode]) && !fling && !drag && fx.every((f, k) => Math.abs(f - want[k]) < 1e-3) && !want.some(Boolean)
      && cells.every(c => !c.hi || now - c.hiAt > 500) && next >= N;
    if (still) { running = false; return; }
    requestAnimationFrame(frame);
  }
  function wake() {
    if (running || document.hidden || document.body.classList.contains('lb-open')) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }
  // rest while the lightbox is open or the tab is hidden
  new MutationObserver(() => {
    if (document.body.classList.contains('lb-open')) running = false;
    else wake();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else wake(); });
  wake();
})();
