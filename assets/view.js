/* VIEW — deterministic search / orbit / pattern screensaver over the NOW tree */
(function () {
  var G = window.TTG_GRAPH || { field: [], edges: [] };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var PROJS = ['TEMPORAL', 'SOCIAL', 'SPATIAL', 'INSTITUTIONAL', 'SYMBOLIC'];
  var DWELL = reduce ? 9000 : 7200;
  var PAUSE_RESUME = 22000;
  var COLS = 40;
  var ROWS = 8;

  var STANCE = {
    TEMPORAL: {
      epithet: 'Elevation · time upright',
      body: 'Time stands in the wood. Roots keep what has already been observed; the crown leans toward network present 17.04.2033. The orbit climbs the years the way a hand would climb the bark.',
      punch: 'Y12 · ELEVATION · LOCAL↔NETWORK'
    },
    SOCIAL: {
      epithet: 'Along the bore · neighbourhoods',
      body: 'Turn the tube on its side and company becomes the measure. Neighbourhoods gather around the present ring. Linked limbs brighten as who sits near whom, not when the stamp was struck.',
      punch: 'X · BORE · NEAR-YOU · RING'
    },
    SPATIAL: {
      epithet: 'Plan · places as meridians',
      body: 'Look down the plan. Places become meridians—Cardiff, Abercrave, the valley, the unplaced. Belonging is longitude; time remains the climb. Where a record last stood is the cut that holds it.',
      punch: '0–9 · PLAN · PLACE-KEY'
    },
    INSTITUTIONAL: {
      epithet: 'Section · houses along the cut',
      body: 'A section through custody. Department, Guild, Paper, Place, Field, Pending—houses along the cut. Authority is strata; the clerk does not invent the house, only reads which shelf holds the slip.',
      punch: 'COL 12 · HOUSE · CUSTODY'
    },
    SYMBOLIC: {
      epithet: 'Oblique · types as meridians',
      body: 'An oblique grammar. Person, object, signal, tin, moment—types as meridians. Pattern does not invent meaning: it only lights relationship types that already recur (≥2). Scarlet is recurrence; dim navy is the rest of the field still present.',
      punch: 'PATTERN · TYPE · RECURRENCE≥2'
    }
  };

  var order = [];
  var idx = 0;
  var projIdx = 0;
  var paused = false;
  var timer = null;
  var resumeTimer = null;
  var step = 0;
  var lastProj = '';
  var rulerReady = false;
  var snap = {
    projection: 'TEMPORAL',
    pattern: false,
    slug: '',
    title: '',
    type: '',
    when: '',
    place: '',
    beat: ''
  };
  var seenObs = {};
  var jackBusy = false;
  var jackTimer = null;
  var JACK_EVERY = 60000;

  function typeLabel(t) {
    if (String(t || '').toUpperCase() === 'PLAY') return 'WORKING SLIP';
    return String(t || 'UNKNOWN').replace(/_/g, ' ');
  }
  function whenOf(n) {
    if (!n) return 'undated';
    if (n.observed_at) {
      var d = new Date(Date.parse(n.observed_at));
      if (!isNaN(d.getTime())) {
        var p = function (x) { return (x < 10 ? '0' : '') + x; };
        return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
      }
    }
    return n.year ? String(n.year) : 'undated';
  }
  function nodeOf(slug) {
    if (window.TTG_FIELD && TTG_FIELD.nodeBySlug) {
      var n = TTG_FIELD.nodeBySlug(slug);
      if (n) return n;
    }
    var list = Array.isArray(G.field) ? G.field : [];
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
    return null;
  }
  function pad3(n) {
    n = Math.abs(n | 0) % 1000;
    return (n < 10 ? '00' : (n < 100 ? '0' : '')) + n;
  }
  function hashStr(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function ensureRuler() {
    var ruler = $('viewRuler');
    if (!ruler || rulerReady) return;
    ruler.innerHTML = '';
    for (var c = 1; c <= COLS; c++) {
      var sp = document.createElement('span');
      sp.textContent = String(c % 10);
      sp.setAttribute('data-col', String(c));
      ruler.appendChild(sp);
    }
    rulerReady = true;
  }
  function paintBelt(proj, pattern, beatIdx) {
    var belt = $('viewBelt');
    if (!belt) return;
    var seed = hashStr(proj + ':' + (pattern ? 'P' : 'N') + ':' + Math.floor(beatIdx / 4));
    var marks = {};
    var i, col, row;
    for (i = 0; i < proj.length; i++) {
      col = (proj.charCodeAt(i) * 7 + i * 3) % COLS;
      row = (proj.charCodeAt(i) + i) % ROWS;
      marks[row + ':' + col] = true;
    }
    for (i = 0; i < 18; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      col = seed % COLS;
      row = (seed >>> 8) % ROWS;
      if ((seed >>> 16) % 3 === 0) marks[row + ':' + col] = true;
    }
    if (pattern) {
      for (col = 0; col < COLS; col += 5) marks[(beatIdx % ROWS) + ':' + col] = true;
    }
    belt.innerHTML = '';
    for (row = 0; row < ROWS; row++) {
      for (col = 0; col < COLS; col++) {
        var hole = document.createElement('i');
        if (marks[row + ':' + col]) hole.className = 'in';
        belt.appendChild(hole);
      }
    }
    var ruler = $('viewRuler');
    if (ruler) {
      Array.prototype.forEach.call(ruler.children, function (sp, ci) {
        var on = false;
        for (row = 0; row < ROWS; row++) if (marks[row + ':' + ci]) on = true;
        if (on) sp.classList.add('on');
        else sp.classList.remove('on');
      });
    }
  }
  function paintContext(proj, pattern, beatIdx) {
    ensureRuler();
    var ctx = $('viewContext');
    var stance = STANCE[proj] || STANCE.TEMPORAL;
    var batch = $('viewBatch');
    var stanceEl = $('viewStance');
    var epithetEl = $('viewEpithet');
    var bodyEl = $('viewBody');
    var subEl = $('viewSub');
    if (ctx) {
      ctx.classList.remove('is-card');
      if (pattern) ctx.classList.add('is-pattern');
      else ctx.classList.remove('is-pattern');
    }
    if (batch) {
      batch.textContent = 'IBM 5081 · VIEW · BATCH ' + pad3(beatIdx + 1)
        + ' · ' + proj.slice(0, 3)
        + (pattern ? ' · PATTERN' : '');
    }
    if (stanceEl) stanceEl.textContent = proj;
    if (epithetEl) epithetEl.textContent = stance.epithet;
    if (bodyEl) {
      bodyEl.textContent = pattern
        ? stance.body + ' Scarlet = recurring edge types and the selected bead’s real links. Nothing here is a grand conclusion.'
        : stance.body;
    }
    if (subEl) {
      subEl.textContent = stance.punch + ' · NOT CANON · 80 COL';
    }
    if (proj !== lastProj || pattern) paintBelt(proj, pattern, beatIdx);
    lastProj = proj;
  }
  function cardBody(node) {
    if (!node) return 'No card on this bead.';
    var parts = [];
    var title = node.title || node.slug || 'Untitled';
    parts.push(title + '.');
    var body = String(node.body || '').replace(/\s+/g, ' ').trim();
    if (body) parts.push(body);
    if (node.opening) parts.push('Opening: ' + node.opening);
    if (node.pending) parts.push('Pending — not yet canon.');
    if (node.play) parts.push('Working slip — earned on this sitting. Not canon.');
    if (node.lens) parts.push('Relevant — graduated by Jack. Seen through the lens. Not canon.');
    var why = node.why || {};
    if (why.interpretation) parts.push(String(why.interpretation).replace(/\s+/g, ' ').trim());
    else if (Array.isArray(why.reasons) && why.reasons.length) {
      parts.push(why.reasons.join(' '));
    }
    var m = node.moments || 0;
    var u = node.unresolved || 0;
    if (m || u) {
      parts.push(
        (m ? (m + ' associated moment' + (m === 1 ? '' : 's')) : '')
        + (m && u ? '; ' : '')
        + (u ? (u + ' unresolved relationship' + (u === 1 ? '' : 's')) : '')
        + '.'
      );
    }
    return parts.filter(Boolean).join(' ');
  }
  function paintCard(node) {
    ensureRuler();
    var ctx = $('viewContext');
    var batch = $('viewBatch');
    var stanceEl = $('viewStance');
    var epithetEl = $('viewEpithet');
    var bodyEl = $('viewBody');
    var subEl = $('viewSub');
    if (ctx) {
      ctx.classList.add('is-card');
      ctx.classList.remove('is-pattern');
    }
    if (batch) {
      batch.textContent = 'IBM 5081 · CARD · '
        + pad3(hashStr((node && node.slug) || 'card') % 1000)
        + (node && node.slug ? ' · ' + String(node.slug).slice(0, 18).toUpperCase() : '');
    }
    if (stanceEl) stanceEl.textContent = typeLabel(node && node.type);
    if (epithetEl) {
      epithetEl.textContent = [
        (node && node.status) || '',
        whenOf(node),
        (node && node.place) || 'unplaced'
      ].filter(Boolean).join(' · ');
    }
    if (bodyEl) bodyEl.textContent = cardBody(node);
    if (subEl) {
      var bits = ['FEED HUD', 'BEAD'];
      if (node && node.pending) bits.push('PENDING');
      if (node && node.play) bits.push('WORKING SLIP');
      if (node && node.lens) bits.push('LENS');
      bits.push('NOT CANON');
      subEl.textContent = bits.join(' · ');
    }
    paintBelt((node && node.slug) || 'CARD', !!(node && (node.lens || node.pattern)), hashStr((node && node.slug) || '0') % 97);
  }
  function linkLine(node) {
    if (!node) return '';
    var links = Array.isArray(node.links) ? node.links : [];
    if (!links.length && Array.isArray(G.edges)) {
      G.edges.forEach(function (e) {
        if (!e) return;
        if (e.source === node.slug) links.push({ slug: e.target, via: e.relationship });
        if (e.target === node.slug) links.push({ slug: e.source, via: e.relationship });
      });
    }
    if (!links.length) return 'No filed links from this bead.';
    return links.slice(0, 5).map(function (l) {
      var other = nodeOf(l.slug);
      var title = (other && other.title) || l.title || l.slug;
      return String(l.via || 'related').replace(/_/g, ' ').toLowerCase() + ' → ' + title;
    }).join(' · ');
  }
  function paint(node, mode, beat) {
    var modeEl = $('viewMode');
    var titleEl = $('viewTitle');
    var metaEl = $('viewMeta');
    var beatEl = $('viewBeat');
    if (modeEl) modeEl.textContent = mode || 'SEARCHING';
    if (titleEl) titleEl.textContent = (node && (node.title || node.slug)) || 'The field is empty.';
    if (metaEl) {
      metaEl.textContent = node
        ? [typeLabel(node.type), whenOf(node), node.place || 'unplaced'].filter(Boolean).join(' · ')
        : '';
    }
    if (beatEl) {
      var links = node ? linkLine(node) : '';
      beatEl.textContent = [beat || '', links].filter(Boolean).join(' · ');
    }
  }
  function patternFor(i, proj) {
    if (proj === 'SYMBOLIC') return true;
    if ((i % 7) === 3) return true;
    if ((i % 11) === 0) return true;
    return false;
  }
  function beatLabel(i, total, proj, pattern) {
    var bits = [
      'BEAT ' + (i + 1) + '/' + total,
      proj
    ];
    if (pattern) bits.push('PATTERN');
    return bits.join(' · ');
  }
  function ensureOrder() {
    if (order.length) return order;
    if (window.TTG_FIELD && typeof TTG_FIELD.tourOrder === 'function') {
      order = TTG_FIELD.tourOrder() || [];
    }
    if (!order.length) {
      order = (Array.isArray(G.field) ? G.field.slice() : []).sort(function (a, b) {
        var ta = a.observed_at ? Date.parse(a.observed_at) : (Number(a.year) || 0) * 1e10;
        var tb = b.observed_at ? Date.parse(b.observed_at) : (Number(b.year) || 0) * 1e10;
        if (ta !== tb) return ta - tb;
        return String(a.slug || '').localeCompare(String(b.slug || ''));
      }).map(function (n) { return n.slug; });
    }
    return order;
  }
  function advanceProjection(i) {
    if (i > 0 && (i % 4) === 0) {
      projIdx = (projIdx + 1) % PROJS.length;
    }
    return PROJS[projIdx];
  }
  function applyFocus(slug, proj, pattern, beat) {
    var node = nodeOf(slug);
    paint(node, pattern ? 'PATTERN' : 'SEARCHING', beat);
    paintContext(proj, pattern, idx);
    snap = {
      projection: proj,
      pattern: !!pattern,
      slug: slug || '',
      title: (node && (node.title || node.slug)) || '',
      type: (node && node.type) || '',
      when: whenOf(node),
      place: (node && node.place) || '',
      beat: beat || ''
    };
    if (!window.TTG_FIELD) return;
    if (typeof TTG_FIELD.setProjection === 'function') {
      TTG_FIELD.setProjection(proj, pattern);
    } else if (typeof TTG_FIELD.setPattern === 'function') {
      TTG_FIELD.setPattern(pattern);
    }
    if (slug && typeof TTG_FIELD.focusSlug === 'function') {
      TTG_FIELD.focusSlug(slug);
    }
  }
  function tick() {
    if (paused) return;
    var list = ensureOrder();
    if (!list.length) {
      paint(null, 'EMPTY', 'No public field to orbit.');
      return;
    }
    if (idx >= list.length) {
      idx = 0;
      projIdx = 0;
      step += 1;
    }
    var slug = list[idx];
    var proj = advanceProjection(idx);
    var pattern = patternFor(idx, proj);
    var beat = beatLabel(idx, list.length, proj, pattern);
    if (step > 0) beat += ' · PASS ' + (step + 1);
    applyFocus(slug, proj, pattern, beat);
    idx += 1;
    timer = setTimeout(tick, DWELL);
  }
  function clearTimers() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
  }
  function showWake(on) {
    var wake = $('viewWake');
    if (!wake) return;
    wake.hidden = !on;
  }
  function pause() {
    if (paused) return;
    paused = true;
    clearTimers();
    var modeEl = $('viewMode');
    var ctx = $('viewContext');
    if (modeEl) {
      modeEl.textContent = (ctx && ctx.classList.contains('is-card')) ? 'CARD' : 'PAUSED';
    }
    showWake(true);
    resumeTimer = setTimeout(resume, PAUSE_RESUME);
  }
  function resume() {
    paused = false;
    showWake(false);
    clearTimers();
    tick();
  }

  function clockStamp(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  var tapeDrift = null;
  function scrollTape(force) {
    var tape = $('viewTape');
    var list = $('viewLogList');
    if (!tape || !list) return;
    var top = Math.max(0, list.scrollHeight - tape.clientHeight);
    if (force || reduce) {
      tape.scrollTop = top;
      return;
    }
    var from = tape.scrollTop;
    var t0 = performance.now();
    function step(now) {
      var u = Math.min(1, (now - t0) / 900);
      var e = 1 - Math.pow(1 - u, 3);
      tape.scrollTop = from + (top - from) * e;
      if (u < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function startTapeDrift() {
    var tape = $('viewTape');
    if (!tape || reduce || tapeDrift) return;
    tapeDrift = setInterval(function () {
      if (!tabWatched()) return;
      var max = Math.max(0, tape.scrollHeight - tape.clientHeight);
      if (max <= 0) return;
      if (tape.scrollTop >= max - 2) tape.scrollTop = Math.max(0, max * 0.15);
      else tape.scrollTop += 0.35;
    }, 80);
  }
  function typeSaid(el, text, done) {
    text = String(text || '');
    if (reduce || !text) {
      el.textContent = text;
      if (done) done();
      return;
    }
    el.textContent = '';
    var cursor = document.createElement('span');
    cursor.className = 'cursor';
    el.appendChild(cursor);
    var i = 0;
    function tickType() {
      if (i >= text.length) {
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        if (done) done();
        return;
      }
      el.insertBefore(document.createTextNode(text.charAt(i)), cursor);
      i += 1;
      setTimeout(tickType, i < 24 ? 18 : 11);
    }
    tickType();
  }
  function appendObservation(obs, fresh) {
    if (!obs || !obs.id || seenObs[obs.id]) return;
    seenObs[obs.id] = true;
    var list = $('viewLogList');
    var tape = $('viewTape');
    if (!list) return;
    var li = document.createElement('li');
    if (obs.ok === false) li.classList.add('is-away');
    if (fresh) li.classList.add('is-fresh');
    var when = document.createElement('span');
    when.className = 'when';
    when.textContent = '◆ '
      + clockStamp(obs.at)
      + (obs.projection ? ' · ' + obs.projection : '')
      + (obs.pattern ? ' · PATTERN' : '');
    var focus = document.createElement('span');
    focus.className = 'focus';
    var f = obs.focus || {};
    focus.textContent = (f.title || f.slug || 'the wood') + ' —';
    var said = document.createElement('span');
    said.className = 'said';
    li.appendChild(when);
    li.appendChild(focus);
    li.appendChild(said);
    list.appendChild(li);
    while (list.children.length > 24) {
      var drop = list.firstChild;
      if (drop && drop.id && seenObs[drop.getAttribute('data-id')]) {
        delete seenObs[drop.getAttribute('data-id')];
      }
      list.removeChild(drop);
    }
    li.setAttribute('data-id', obs.id);
    requestAnimationFrame(function () {
      li.classList.add('is-in');
      scrollTape(false);
    });
    if (fresh) {
      typeSaid(said, obs.text || '', function () {
        setTimeout(function () { li.classList.remove('is-fresh'); }, 2400);
        startTapeDrift();
      });
    } else {
      said.textContent = obs.text || '';
    }
  }
  function paintObservations(rows, freshId) {
    if (!Array.isArray(rows)) return;
    rows.forEach(function (obs) {
      appendObservation(obs, !!(freshId && obs.id === freshId));
    });
    scrollTape(true);
    if (rows.length) startTapeDrift();
  }
  function loadLog() {
    fetch('/view/observe', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) { return res.json(); })
      .then(function (j) {
        if (!j || !j.ok) return;
        paintObservations(j.observations || []);
      })
      .catch(function () {});
  }
  function tabWatched() {
    if (typeof document.visibilityState === 'string' && document.visibilityState !== 'visible') {
      return false;
    }
    return true;
  }
  function askJack() {
    if (jackBusy) return;
    if (!tabWatched()) return;
    jackBusy = true;
    var data = new FormData();
    data.set('csrf', G.csrf || '');
    data.set('watching', '1');
    data.set('projection', snap.projection || 'TEMPORAL');
    data.set('pattern', snap.pattern ? '1' : '0');
    data.set('slug', snap.slug || '');
    data.set('title', snap.title || '');
    data.set('type', snap.type || '');
    data.set('when', snap.when || '');
    data.set('place', snap.place || '');
    data.set('beat', snap.beat || '');
    fetch('/view/observe', {
      method: 'POST',
      body: data,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) { return res.json(); })
      .then(function (j) {
        jackBusy = false;
        if (!j || !j.ok) return;
        if (j.observation) appendObservation(j.observation, !j.cached);
        else if (j.observations) paintObservations(j.observations);
      })
      .catch(function () { jackBusy = false; });
  }
  function armJack() {
    loadLog();
    var first = null;
    function scheduleFirst() {
      if (first) clearTimeout(first);
      first = setTimeout(function () {
        first = null;
        askJack();
      }, reduce ? 2500 : 9000);
    }
    if (tabWatched()) scheduleFirst();
    jackTimer = setInterval(askJack, JACK_EVERY);
    document.addEventListener('visibilitychange', function () {
      if (!tabWatched()) return;
      /* Tab opened again: ask once if the minute tick may have been skipped. */
      setTimeout(askJack, reduce ? 600 : 1800);
    });
  }

  window.TTG_VIEW_ON_FOCUS = function (node) {
    if (!node) return;
    if (node.slug) {
      snap.slug = node.slug;
      snap.title = node.title || node.slug;
      snap.type = node.type || '';
      snap.when = whenOf(node);
      snap.place = node.place || '';
    }
    if (paused) return;
    var modeEl = $('viewMode');
    var patternOn = modeEl && modeEl.textContent === 'PATTERN';
    paint(node, patternOn ? 'PATTERN' : 'SEARCHING', $('viewBeat') && $('viewBeat').textContent);
  };

  window.TTG_VIEW_ON_PICK = function (node) {
    if (!node) return;
    snap.slug = node.slug || '';
    snap.title = node.title || node.slug || '';
    snap.type = node.type || '';
    snap.when = whenOf(node);
    snap.place = node.place || '';
    paintCard(node);
    pause();
    paint(node, 'CARD', 'BEAD · ' + (node.slug || 'record'));
  };

  window.TTG_VIEW_ON_MISS = function () {
    pause();
  };

  function armWake() {
    var arm = function (e) {
      if (e && e.target) {
        if (e.target.closest && e.target.closest('#viewWake, #dock, #mast .site')) return;
        if (e.target.tagName === 'CANVAS' || (e.target.closest && e.target.closest('canvas'))) return;
      }
      pause();
    };
    addEventListener('pointerdown', arm, { passive: true });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (paused) resume();
        else pause();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (paused) resume();
        else pause();
        return;
      }
      arm(e);
    });
    var btn = $('viewResume');
    if (btn) btn.addEventListener('click', function () { resume(); });
  }

  function boot() {
    ensureOrder();
    ensureRuler();
    armWake();
    armJack();
    paintContext('TEMPORAL', false, 0);
    if (!order.length) {
      paint(null, 'EMPTY', 'No public field to orbit.');
      return;
    }
    paint(nodeOf(order[0]), 'SEARCHING', 'ORBIT ARMED · ' + order.length + ' STATIONS');
    timer = setTimeout(tick, reduce ? 400 : 1200);
  }

  if (document.readyState === 'complete') boot();
  else addEventListener('load', boot);
})();
