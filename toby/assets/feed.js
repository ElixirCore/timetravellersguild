/* Toby — the feed. Same engine; Grid streams in as you scroll; the lightbox flies out of
   the thumbnail you tapped, swipes sideways between photos and down to close. */
(() => {
  'use strict';

  const posts = JSON.parse(document.getElementById('posts').textContent || '[]');
  const grid = document.getElementById('grid');
  const CHUNK = 24;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  /* ------------------------------------------------------------ the grid */

  const reveal = img => {
    const done = () => img.classList.add('in');
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener('load', done, { once: true });
  };

  const cellFor = (p, i) => {
    const a = document.createElement('a');
    a.className = 'cell';
    a.href = '#p/' + p.id;
    a.dataset.i = i;
    a.style.cssText = `--c:${p.c};--lq:url(${p.lq});--n:${i % CHUNK}`;
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'lazy';
    img.sizes = '(min-width: 960px) 309px, 33vw';
    img.srcset = `${p.src.t[0]} ${p.src.t[1]}w, ${p.src.m[0]} ${p.src.m[1]}w`;
    img.src = p.src.t[0];
    img.alt = p.cap ? p.cap.slice(0, 120) : 'Photo';
    a.append(img);
    if (p.cap) {
      const peek = document.createElement('span');
      peek.className = 'peek';
      peek.innerHTML = '<span></span>';
      peek.firstChild.textContent = p.cap.length > 90 ? p.cap.slice(0, 89) + '…' : p.cap;
      a.append(peek);
    }
    if (p.audio) a.append(vchipFor());
    reveal(img);
    return a;
  };

  let rendered = grid ? grid.children.length : 0;
  const renderUpTo = n => {
    if (!grid || rendered >= Math.min(n, posts.length)) return;
    const frag = document.createDocumentFragment();
    while (rendered < Math.min(n, posts.length)) frag.append(cellFor(posts[rendered], rendered++));
    grid.append(frag);
  };

  if (grid) {
    grid.querySelectorAll('img').forEach(reveal);
    grid.querySelectorAll('.cell').forEach(c => {
      const p = posts[+c.dataset.i];
      if (p && p.audio && !c.querySelector('.vchip')) c.append(vchipFor());
    });
    const more = document.getElementById('more');
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      renderUpTo(rendered + CHUNK);
      if (rendered >= posts.length) io.disconnect();
    }, { rootMargin: '1400px 0px' });
    if (rendered < posts.length) io.observe(more);

    grid.addEventListener('click', e => {
      const cell = e.target.closest('.cell');
      if (!cell || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      open(+cell.dataset.i, cell.querySelector('img'));
    });
  }

  document.querySelector('.avatar[data-open]')?.addEventListener('click', () => {
    open(0, grid?.querySelector('.cell img'));
  });

  /* ------------------------------------------------------- the lightbox */

  const lb = document.getElementById('lb');
  const track = lb.querySelector('.lb-track');
  const backdrop = lb.querySelector('.lb-backdrop');
  const countEl = lb.querySelector('.lb-count');
  const capEl = lb.querySelector('.lb-cap');
  const dateEl = lb.querySelector('.lb-date');
  const metaEl = lb.querySelector('.lb-meta');

  /* --------------------------- voice notes + goden comments ---------------- */
  const voiceWrap = document.createElement('div');
  voiceWrap.className = 'lb-voice';
  voiceWrap.hidden = true;
  voiceWrap.innerHTML =
    '<button type="button" class="lb-btn lb-voice-btn" aria-label="Play voice note" aria-pressed="false">' +
    '<svg class="vp-play" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>' +
    '<svg class="vp-stop" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/></svg></button>' +
    '<span class="lb-voice-text"><span class="lb-note"></span><span class="lb-gloss"></span></span>' +
    '<span class="lb-dsp" hidden><span class="lb-knob" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><i></i></span><span class="lb-dsp-name"></span></span>';
  metaEl.prepend(voiceWrap);
  const voiceBtn = voiceWrap.querySelector('.lb-voice-btn');
  const noteEl = voiceWrap.querySelector('.lb-note');
  const glossEl = voiceWrap.querySelector('.lb-gloss');
  const dspWrap = voiceWrap.querySelector('.lb-dsp');
  const knobEl = dspWrap.querySelector('.lb-knob');
  const dspNameEl = dspWrap.querySelector('.lb-dsp-name');
  const voiceAudio = new Audio();   // fallback path when Web Audio is unavailable
  voiceAudio.preload = 'none';

  /* ----- dsp: every photo gets its own knob that bends its voice note ----- */
  const DSP_BY_ID = {
    '20261021-885ad6202204': 'echo',
    '20261021-3b6d1e23394a': 'feedback',
    '20261021-0f7a43ba4459': 'distort',
    '20261021-afd050a8f421': 'lowpass',
    '20261021-a5d3c167e5fa': 'bandpass',
    '20261021-3a809e32fd62': 'pitch',
    '20261021-ece3bc88b35b': 'wobble',
    '20261021-11e1bbd13f00': 'highpass',
    '20261021-d18653f514a9': 'tremolo',
    '20261021-d1ceda538f7b': 'crush'
  };
  const DSP_ORDER = ['echo', 'feedback', 'distort', 'lowpass', 'bandpass', 'pitch', 'wobble', 'highpass', 'tremolo', 'crush'];
  const DSP_DEFAULT = { echo: .45, feedback: .5, distort: .3, lowpass: .45, bandpass: .5, pitch: .5, wobble: .55, highpass: .35, tremolo: .4, crush: .4 };
  const dspFor = p => {
    if (DSP_BY_ID[p.id]) return DSP_BY_ID[p.id];
    let h = 0;
    for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
    return DSP_ORDER[h % DSP_ORDER.length];
  };

  let actx = null, fxIn = null, fxOut = null, fxNodes = [], curSrc = null;
  let dspKind = null, dspSet = null, dspOK = true, pitchRate = 1;
  const logMap = (v, lo, hi) => lo * Math.pow(hi / lo, v);
  const ramp = (param, val) => param.setTargetAtTime(val, actx.currentTime, .03);

  const dspBoot = () => {
    if (actx || !dspOK) return !!actx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      fxIn = actx.createGain();
      fxOut = actx.createGain();
      fxOut.connect(actx.destination);
    } catch (err) { dspOK = false; actx = null; }
    return !!actx;
  };
  const dspTeardown = () => {
    if (!actx) return;
    fxNodes.forEach(n => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    fxNodes = [];
    try { fxIn.disconnect(); } catch (e) {}
  };
  const DSP_BUILD = {
    echo(v0) {
      const dry = actx.createGain(), wet = actx.createGain(), d = actx.createDelay(1), fb = actx.createGain();
      fb.gain.value = .38; wet.gain.value = .8;
      fxIn.connect(dry); dry.connect(fxOut);
      fxIn.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(fxOut);
      const set = v => ramp(d.delayTime, .06 + v * .54);
      set(v0);
      return { nodes: [dry, wet, d, fb], set };
    },
    feedback(v0) {
      const dry = actx.createGain(), wet = actx.createGain(), d = actx.createDelay(1), fb = actx.createGain();
      d.delayTime.value = .21; wet.gain.value = .9;
      fxIn.connect(dry); dry.connect(fxOut);
      fxIn.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(fxOut);
      const set = v => ramp(fb.gain, v * .92);
      set(v0);
      return { nodes: [dry, wet, d, fb], set };
    },
    lowpass(v0) {
      const f = actx.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = .8;
      fxIn.connect(f); f.connect(fxOut);
      const set = v => ramp(f.frequency, logMap(v, 220, 14000));
      set(v0);
      return { nodes: [f], set };
    },
    highpass(v0) {
      const f = actx.createBiquadFilter();
      f.type = 'highpass'; f.Q.value = .8;
      fxIn.connect(f); f.connect(fxOut);
      const set = v => ramp(f.frequency, logMap(v, 60, 3500));
      set(v0);
      return { nodes: [f], set };
    },
    bandpass(v0) {
      const f = actx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 1.4;
      fxIn.connect(f); f.connect(fxOut);
      const set = v => ramp(f.frequency, logMap(v, 180, 5200));
      set(v0);
      return { nodes: [f], set };
    },
    pitch(v0) {
      fxIn.connect(fxOut);
      const set = v => {
        pitchRate = v <= .5 ? .5 + v : 1 + (v - .5) * 1.2;
        if (curSrc) ramp(curSrc.playbackRate, pitchRate);
      };
      set(v0);
      return { nodes: [], set };
    },
    tremolo(v0) {
      const g = actx.createGain(), osc = actx.createOscillator(), depth = actx.createGain();
      g.gain.value = .55; depth.gain.value = .45;
      osc.connect(depth); depth.connect(g.gain);
      fxIn.connect(g); g.connect(fxOut);
      osc.start();
      const set = v => ramp(osc.frequency, .5 + v * 13.5);
      set(v0);
      return { nodes: [g, osc, depth], set };
    },
    distort(v0) {
      const sh = actx.createWaveShaper(), g = actx.createGain();
      g.gain.value = .8; sh.oversample = '2x';
      fxIn.connect(sh); sh.connect(g); g.connect(fxOut);
      const set = v => {
        const k = 1 + v * 59, n = 1024, c = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x); }
        sh.curve = c;
      };
      set(v0);
      return { nodes: [sh, g], set };
    },
    crush(v0) {
      const sh = actx.createWaveShaper(), g = actx.createGain();
      g.gain.value = .9;
      fxIn.connect(sh); sh.connect(g); g.connect(fxOut);
      const set = v => {
        const bits = Math.max(2, 8 - Math.round(v * 6)), steps = 1 << bits, n = 1024, c = new Float32Array(n);
        for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.round(x * steps) / steps; }
        sh.curve = c;
      };
      set(v0);
      return { nodes: [sh, g], set };
    },
    wobble(v0) {
      const d = actx.createDelay(.1), osc = actx.createOscillator(), depth = actx.createGain(), g = actx.createGain();
      d.delayTime.value = .014; osc.frequency.value = 4.5; g.gain.value = .95;
      osc.connect(depth); depth.connect(d.delayTime);
      fxIn.connect(d); d.connect(g); g.connect(fxOut);
      osc.start();
      const set = v => ramp(depth.gain, v * .012);
      set(v0);
      return { nodes: [d, osc, depth, g], set };
    }
  };
  const dspRebuild = () => {
    dspTeardown();
    if (!DSP_BUILD[dspKind]) return;
    const built = DSP_BUILD[dspKind](knobV);
    fxNodes = built.nodes;
    dspSet = built.set;
  };

  /* the knob: drag up/down, arrow keys, or wheel */
  let knobV = .5, kDrag = null;
  const knobDraw = () => {
    knobEl.style.setProperty('--ang', (-135 + knobV * 270) + 'deg');
    knobEl.setAttribute('aria-valuenow', String(Math.round(knobV * 100)));
  };
  const knobSet = (v, apply = true) => {
    knobV = Math.min(1, Math.max(0, v));
    knobDraw();
    if (apply && dspSet) dspSet(knobV);
  };
  knobEl.addEventListener('pointerdown', e => {
    e.stopPropagation();
    e.preventDefault();
    kDrag = { y: e.clientY, v: knobV, id: e.pointerId };
    try { knobEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  knobEl.addEventListener('pointermove', e => {
    if (!kDrag || e.pointerId !== kDrag.id) return;
    knobSet(kDrag.v + (kDrag.y - e.clientY) / 110);
  });
  const kEnd = e => { if (kDrag && e.pointerId === kDrag.id) kDrag = null; };
  knobEl.addEventListener('pointerup', kEnd);
  knobEl.addEventListener('pointercancel', kEnd);
  knobEl.addEventListener('keydown', e => {
    const step = e.shiftKey ? .12 : .04;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); knobSet(knobV + step); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); knobSet(knobV - step); }
  });
  knobEl.addEventListener('wheel', e => { e.preventDefault(); knobSet(knobV - Math.sign(e.deltaY) * .06); }, { passive: false });

  const dspApply = kind => {
    dspKind = kind;
    dspNameEl.textContent = kind;
    knobEl.setAttribute('aria-label', kind + ' knob');
    knobSet(DSP_DEFAULT[kind] ?? .5, false);
    dspSet = null;
    if (actx) dspRebuild();
  };

  /* ----- playback: Web Audio through the knob chain, plain <audio> fallback ----- */
  const buffers = new Map();
  const decode = ab => new Promise((res, rej) => { actx.decodeAudioData(ab, res, rej); });
  const loadBuffer = url => {
    if (!buffers.has(url)) {
      buffers.set(url, fetch(url).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); }).then(decode));
    }
    return buffers.get(url);
  };
  const uiPlaying = () => {
    voiceWrap.classList.add('playing');
    voiceBtn.setAttribute('aria-pressed', 'true');
    voiceBtn.setAttribute('aria-label', 'Stop voice note');
  };
  const voiceStop = () => {
    if (curSrc) { const s = curSrc; curSrc = null; try { s.onended = null; s.stop(); s.disconnect(); } catch (e) {} }
    voiceAudio.pause();
    voiceWrap.classList.remove('playing');
    voiceBtn.setAttribute('aria-pressed', 'false');
    voiceBtn.setAttribute('aria-label', 'Play voice note');
  };
  voiceAudio.addEventListener('ended', voiceStop);
  const startVoice = p => {
    if (dspOK && dspBoot()) {
      (async () => {
        if (actx.state === 'suspended') await actx.resume();
        const buf = await loadBuffer(p.audio);
        if (!dspSet) dspRebuild();
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.connect(fxIn);
        if (dspKind === 'pitch') src.playbackRate.value = pitchRate;
        curSrc = src;
        src.onended = () => { if (curSrc === src) { curSrc = null; voiceStop(); } };
        src.start();
        uiPlaying();
      })().catch(() => {
        dspOK = false;
        dspSet = null;
        dspWrap.hidden = true;
        voiceAudio.play().then(uiPlaying).catch(() => {});
      });
      return;
    }
    voiceAudio.play().then(uiPlaying).catch(() => {});
  };
  voiceBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (curSrc || !voiceAudio.paused) return voiceStop();
    const p = posts[idx];
    if (p && p.audio) startVoice(p);
  });
  /* the one-across film (feed-gl.js) plays a photo's voice note through its own knob; tap again to stop */
  let filmVoice = -1;
  window.tobyVoice = i => {
    const p = posts[i];
    if (!p || !p.audio) return;
    const playing = curSrc || !voiceAudio.paused;
    if (playing) voiceStop();
    if (playing && filmVoice === i) return;
    filmVoice = i;
    if (dspOK) dspApply(dspFor(p));
    voiceAudio.src = p.audio;
    startVoice(p);
  };
  function vchipFor() {
    const vc = document.createElement('span');
    vc.className = 'vchip';
    vc.setAttribute('aria-hidden', 'true');
    vc.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5c1.8 2 1.8 5 0 7"/></svg>';
    return vc;
  }
  const prevBtn = lb.querySelector('.lb-prev');
  const remixBtn = lb.querySelector('.lb-remix');
  const FX = ['', 'fx-prism', 'fx-negative', 'fx-lumen'];
  let fx = 0;
  const remix = () => {
    fx = (fx + 1) % FX.length;
    track.classList.remove(...FX.filter(Boolean));
    if (FX[fx]) track.classList.add(FX[fx]);
    remixBtn.setAttribute('aria-pressed', fx ? 'true' : 'false');
  };
  remixBtn.addEventListener('click', remix);
  track.addEventListener('dblclick', remix);

  const nextBtn = lb.querySelector('.lb-next');
  const GAP = 28;

  let idx = -1;
  let slides = [];          // [prev, current, next] — any may be null at the ends
  let busy = false;
  let pushed = false;
  let returnFocus = null;

  const fitRect = (p, slide) => {
    const cs = getComputedStyle(slide);
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
    const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    const aw = innerWidth - pl - pr, ah = innerHeight - pt - pb;
    const s = Math.min(aw / p.w, ah / p.h, 1);
    const w = Math.round(p.w * s), h = Math.round(p.h * s);
    return { left: pl + (aw - w) / 2, top: pt + (ah - h) / 2, width: w, height: h };
  };

  const makeSlide = i => {
    const p = posts[i];
    if (!p) return null;
    const s = document.createElement('div');
    s.className = 'lb-slide';
    const img = new Image();
    img.decoding = 'async';
    img.draggable = false;
    img.alt = p.cap || 'Photo';
    img.sizes = '100vw';
    img.srcset = `${p.src.m[0]} ${p.src.m[1]}w, ${p.src.l[0]} ${p.src.l[1]}w`;
    img.src = p.src.m[0];
    // the thumbnail is almost always cached, so this paints instantly while the big one loads
    img.style.background = `${p.c} url("${p.src.t[0]}") center / cover no-repeat`;
    s.append(img);
    track.append(s);
    return s;
  };

  const layout = () => {
    slides.forEach((s, k) => {
      if (!s) return;
      const r = fitRect(posts[idx + k - 1], s);
      const img = s.firstChild;
      img.style.width = r.width + 'px';
      img.style.height = r.height + 'px';
      s.style.transform = `translateX(${(k - 1) * (innerWidth + GAP)}px)`;
    });
  };

  const describe = () => {
    const p = posts[idx];
    countEl.textContent = `${idx + 1} / ${posts.length}`;
    capEl.textContent = p.cap || '';
    const d = p.tk ? new Date(p.tk + 'T12:00:00') : new Date(p.at * 1000);
    dateEl.textContent = (p.tk ? 'Taken ' : 'Posted ') + dateFmt.format(d);
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === posts.length - 1;
    voiceStop();
    if (p.note || p.audio) {
      voiceWrap.hidden = false;
      noteEl.textContent = p.note || '';
      glossEl.textContent = p.gloss || '';
      voiceBtn.style.visibility = p.audio ? '' : 'hidden';
      if (p.audio && dspOK) { dspWrap.hidden = false; dspApply(dspFor(p)); } else dspWrap.hidden = true;
      if (p.audio) voiceAudio.src = p.audio; else voiceAudio.removeAttribute('src');
    } else {
      voiceWrap.hidden = true;
      voiceAudio.removeAttribute('src');
    }
    lb.style.setProperty('--meta-h', Math.ceil(metaEl.offsetHeight + 12) + 'px');
  };

  const build = i => {
    track.replaceChildren();
    idx = i;
    slides = [makeSlide(i - 1), makeSlide(i), makeSlide(i + 1)];
    track.style.transition = 'none';
    track.style.transform = 'none';
    describe();
    layout();
  };

  const flyBetween = (src, from, to, ms) => {
    const fly = new Image();
    fly.className = 'lb-fly';
    fly.src = src;
    Object.assign(fly.style, { left: '0px', top: '0px', width: from.width + 'px', height: from.height + 'px' });
    document.body.append(fly);
    const kf = r => ({ transform: `translate(${r.left}px, ${r.top}px)`, width: r.width + 'px', height: r.height + 'px' });
    const anim = fly.animate([kf(from), kf(to)], { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    return anim.finished.then(() => fly);
  };

  const visibleRect = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width ? r : null;
  };

  function open(i, fromImg, { history: push = true } = {}) {
    if (busy || !posts[i]) return;
    returnFocus = document.activeElement;
    lb.hidden = false;
    document.body.classList.add('lb-open');
    build(i);
    const cur = slides[1].firstChild;
    const from = visibleRect(fromImg);
    if (push) { history.pushState({ lb: 1 }, '', '#p/' + posts[i].id); pushed = true; }

    if (from && !reduceMotion) {
      busy = true;
      cur.style.visibility = 'hidden';
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      flyBetween(fromImg.currentSrc || fromImg.src, from, cur.getBoundingClientRect(), 380).then(fly => {
        cur.style.visibility = '';
        fly.remove();
        busy = false;
      });
    } else {
      lb.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    }
    lb.querySelector('.lb-close').focus({ preventScroll: true });
  }

  function close({ fromHistory = false } = {}) {
    voiceStop();
    fx = 0; track.classList.remove(...FX.filter(Boolean)); remixBtn.setAttribute('aria-pressed', 'false');
    if (lb.hidden || busy) return;
    if (pushed && !fromHistory) { pushed = false; history.back(); return; }   // popstate calls us again
    pushed = false;
    if (location.hash.startsWith('#p/')) history.replaceState(null, '', location.pathname + location.search);

    renderUpTo(idx + 1);
    const cell = grid?.querySelector(`.cell[data-i="${idx}"]`);
    const thumb = cell?.querySelector('img');
    if (cell && grid.offsetParent && !visibleRect(cell)) cell.scrollIntoView({ block: 'center' });
    const to = visibleRect(thumb);
    const cur = slides[1]?.firstChild;
    const finish = () => {
      lb.hidden = true;
      lb.classList.remove('dragging');
      lb.style.removeProperty('--fade');
      track.replaceChildren();
      slides = [];
      document.body.classList.remove('lb-open');
      (cell || returnFocus)?.focus?.({ preventScroll: true });
    };
    if (to && cur && !reduceMotion) {
      busy = true;
      const from = cur.getBoundingClientRect();
      cur.style.visibility = 'hidden';
      const chrome = [lb.querySelector('.lb-top'), lb.querySelector('.lb-meta')];
      chrome.forEach(el => { el.style.opacity = '0'; });
      const fade = backdrop.animate([{ opacity: getComputedStyle(backdrop).opacity }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
      flyBetween(cur.currentSrc || cur.src, from, to, 340).then(fly => {
        finish();
        fade.cancel();
        chrome.forEach(el => { el.style.opacity = ''; });
        // a beat of overlap so the grid image is painted underneath before the clone leaves
        requestAnimationFrame(() => fly.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 }).finished.then(() => fly.remove()));
        busy = false;
      });
    } else {
      lb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).finished.then(finish);
    }
  }

  function go(dir) {
    const target = idx + dir;
    if (busy || !posts[target]) { nudge(dir); return; }
    busy = true;
    const dist = -dir * (innerWidth + GAP);
    track.style.transition = reduceMotion ? 'none' : 'transform .34s cubic-bezier(.2,.8,.2,1)';
    track.style.transform = `translateX(${dist}px)`;
    const settle = () => {
      busy = false;
      build(target);
      if (pushed) history.replaceState({ lb: 1 }, '', '#p/' + posts[target].id);
    };
    if (reduceMotion) return settle();
    let done = false;
    const once = () => { if (!done) { done = true; settle(); } };
    track.addEventListener('transitionend', once, { once: true });
    setTimeout(once, 500);
  }

  /* a small rubber-band when there's nowhere left to go */
  const nudge = dir => {
    if (reduceMotion) return;
    track.animate([{ transform: 'none' }, { transform: `translateX(${-dir * 26}px)` }, { transform: 'none' }],
      { duration: 360, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  };

  /* ------------------------------------------------------------ gestures */

  let g = null;
  let lastTap = null;
  let tapTimer = 0;

  lb.addEventListener('pointerdown', e => {
    if (busy || e.button !== 0 || e.target.closest('.lb-btn, .lb-cap, .lb-voice')) return;
    g = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dy: 0, axis: null, id: e.pointerId, onImg: e.target.tagName === 'IMG' };
    lb.setPointerCapture(e.pointerId);
  });

  lb.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    g.dx = e.clientX - g.x;
    g.dy = e.clientY - g.y;
    if (!g.axis && Math.hypot(g.dx, g.dy) > 8) {
      g.axis = Math.abs(g.dx) > Math.abs(g.dy) ? 'x' : 'y';
      lb.classList.add('dragging');
      track.style.transition = 'none';
    }
    if (g.axis === 'x') {
      const edge = (g.dx > 0 && !slides[0]) || (g.dx < 0 && !slides[2]);
      track.style.transform = `translateX(${edge ? g.dx * .3 : g.dx}px)`;
    } else if (g.axis === 'y') {
      const k = Math.min(1, Math.abs(g.dy) / 420);
      slides[1].style.transform = `translate(${g.dx * .4}px, ${g.dy}px) scale(${1 - k * .22})`;
      lb.style.setProperty('--fade', String(1 - k * .9));
    }
  });

  const endGesture = e => {
    if (!g || e.pointerId !== g.id) return;
    const { dx, dy, axis, onImg } = g;
    const dt = Math.max(1, performance.now() - g.t);
    g = null;
    lb.classList.remove('dragging');

    if (axis === 'x') {
      const v = dx / dt;
      if ((dx < -innerWidth * .18 || v < -.45) && slides[2]) return go(1);
      if ((dx > innerWidth * .18 || v > .45) && slides[0]) return go(-1);
      track.style.transition = 'transform .4s cubic-bezier(.3,1.4,.5,1)';
      track.style.transform = 'none';
      return;
    }
    if (axis === 'y') {
      if (Math.abs(dy) > 110 || Math.abs(dy / dt) > .6) return close();
      const s = slides[1];
      s.style.transition = 'transform .38s cubic-bezier(.3,1.4,.5,1)';
      s.style.transform = `translateX(0)`;
      s.addEventListener('transitionend', () => { s.style.transition = ''; }, { once: true });
      lb.style.removeProperty('--fade');
      return;
    }
    if (e.type === 'pointercancel') return;

    // a tap: double-tap the photo for a heart, tap outside to close
    const now = performance.now();
    if (lastTap && now - lastTap.t < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      clearTimeout(tapTimer);
      lastTap = null;
      if (onImg) heart(e.clientX, e.clientY);
      return;
    }
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { lastTap = null; if (!onImg) close(); }, 300);
  };
  lb.addEventListener('pointerup', endGesture);
  lb.addEventListener('pointercancel', endGesture);

  const heart = (x, y) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'burst');
    svg.innerHTML = '<path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 3.1 4 7 4c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.9 0 6.1 4 4.6 7.6C19.5 16.4 12 21 12 21z"/>';
    svg.style.left = x + 'px';
    svg.style.top = y + 'px';
    lb.append(svg);
    svg.addEventListener('animationend', () => svg.remove());
    navigator.vibrate?.(8);
  };

  /* ----------------------------------------------------------- controls */

  lb.querySelector('.lb-close').addEventListener('click', () => close());
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));

  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') {
      const f = [...lb.querySelectorAll('.lb-btn:not([disabled])')].filter(b => b.offsetParent);
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
    }
  });

  addEventListener('resize', () => { if (!lb.hidden) { describe(); layout(); } });

  addEventListener('popstate', () => {
    const m = location.hash.match(/^#p\/(.+)$/);
    if (!m && !lb.hidden) close({ fromHistory: true });
    else if (m && lb.hidden) openById(m[1], false);
  });

  const openById = (id, push) => {
    const i = posts.findIndex(p => p.id === id);
    if (i < 0) return;
    renderUpTo(i + 1);
    open(i, null, { history: push });
  };

  // deep link: /toby/#p/<id>
  const deep = location.hash.match(/^#p\/(.+)$/);
  if (deep) openById(deep[1], false);
})();

