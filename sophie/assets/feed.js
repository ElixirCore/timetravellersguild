/* Sophie — the feed. Grid streams in as you scroll; the lightbox flies out of
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
  const prevBtn = lb.querySelector('.lb-prev');
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
    if (lb.hidden || busy) return;
    if (pushed && !fromHistory) { pushed = false; history.back(); return; }   // popstate calls us again
    pushed = false;
    if (location.hash.startsWith('#p/')) history.replaceState(null, '', location.pathname + location.search);

    renderUpTo(idx + 1);
    const cell = grid?.querySelector(`.cell[data-i="${idx}"]`);
    const thumb = cell?.querySelector('img');
    if (cell && !visibleRect(cell)) cell.scrollIntoView({ block: 'center' });
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
    if (busy || e.button !== 0 || e.target.closest('.lb-btn, .lb-cap')) return;
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

  // deep link: /sophie/#p/<id>
  const deep = location.hash.match(/^#p\/(.+)$/);
  if (deep) openById(deep[1], false);
})();
