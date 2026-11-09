/* VIEW — Jack tours the NOW tree on his own; any input hands the visitor the reins, idleness hands them back */
(function () {
  var G = window.TTG_GRAPH || { field: [], edges: [] };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var PROJS = ['TEMPORAL', 'SOCIAL', 'SPATIAL', 'INSTITUTIONAL', 'SYMBOLIC'];
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

  var projIdx = 0;
  var timer = null;
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
      ctx.classList.remove('is-card', 'is-focus');
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
  /* The focused bead's own filings and noted edges, from window.TTG_VIEW_CONTEXT. */
  function paintExtras(node, beatIdx) {
    var C = window.TTG_VIEW_CONTEXT || {};
    var c = (node && C[node.slug]) || { voices: [], notes: [] };
    var fil = $('viewFiling');
    var notesEl = $('viewNotes');
    if (fil) {
      var v = c.voices.length ? c.voices[(beatIdx + step) % c.voices.length] : null;
      fil.hidden = !v;
      if (v) {
        fil.className = 'view-filing ' + String(v.class || '').replace(/[^A-Z_]/g, '');
        $('viewFilingText').textContent = v.text;
        $('viewFilingBy').textContent = v.voice + ' · ' + String(v.class || '').replace(/_/g, ' ');
      }
    }
    if (notesEl) {
      notesEl.innerHTML = '';
      c.notes.slice(0, 3).forEach(function (n) {
        var li = document.createElement('li');
        var head = document.createElement('b');
        head.textContent = n.rel + ' → ' + n.title;
        li.appendChild(head);
        li.appendChild(document.createTextNode(' ' + n.note));
        notesEl.appendChild(li);
      });
      notesEl.hidden = !c.notes.length;
    }
  }
  function paintFocus(node, proj, pattern, beatIdx) {
    paintContext(proj, pattern, beatIdx);
    if (!node) return;
    $('viewContext').classList.add('is-focus');
    var stance = STANCE[proj] || STANCE.TEMPORAL;
    $('viewStance').textContent = proj + ' · ' + typeLabel(node.type);
    $('viewEpithet').textContent = [node.status || '', whenOf(node), node.place || 'unplaced'].filter(Boolean).join(' · ');
    $('viewBody').textContent = cardBody(node, true);
    var bits = [stance.punch];
    if (node.pending) bits.push('PENDING');
    bits.push(node.pending || node.play || node.lens ? 'NOT CANON' : 'CANON');
    $('viewSub').textContent = bits.join(' · ');
    paintExtras(node, beatIdx);
  }
  function cardBody(node, untitled) {
    if (!node) return 'No card on this bead.';
    var parts = [];
    var title = node.title || node.slug || 'Untitled';
    if (!untitled) parts.push(title + '.');
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
    paintExtras(node, 0);
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
  function applyFocus(slug, proj, pattern, beat) {
    var node = nodeOf(slug);
    paint(node, pattern ? 'PATTERN' : 'SEARCHING', beat);
    paintFocus(node, proj, pattern, step);
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
  /* ---------- Jack's tour: he chooses, travels, opens, reads, reflects ---------- */
  var reins = 'jack';          // 'jack' | 'you'
  var gen = 0;                 // bumps on every takeover; stale steps check it and stop
  var here = '';               // slug Jack (or the visitor) is standing at
  var visits = {};             // slug -> times visited this sitting
  var trail = [];              // recent slugs, newest last
  var stops = 0;               // stops since the projection last turned
  var lastInput = 0;
  var idleTimer = null;
  var IDLE_RESUME = reduce ? 30000 : 20000;
  var T = reduce
    ? { travel: 900, open: 600, readMin: 9000, readMax: 16000, reflect: 5500, decide: 2600 }
    : { travel: 2600, open: 900, readMin: 6000, readMax: 12000, reflect: 4200, decide: 1800 };

  function later(fn, ms) {
    var my = gen;
    timer = setTimeout(function () { if (my === gen && reins === 'jack') fn(); }, ms);
  }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function relWord(r) { return String(r || 'related').replace(/_/g, ' ').toLowerCase(); }
  function fieldSlugs() {
    return (Array.isArray(G.field) ? G.field : []).map(function (n) { return n.slug; }).filter(Boolean);
  }
  function neighbours(slug) {
    var out = [];
    var C = window.TTG_VIEW_CONTEXT || {};
    var noted = {};
    ((C[slug] && C[slug].notes) || []).forEach(function (n) { noted[n.title] = n; });
    (Array.isArray(G.edges) ? G.edges : []).forEach(function (e) {
      if (!e) return;
      var other = e.source === slug ? e.target : (e.target === slug ? e.source : '');
      if (!other || other === slug || !nodeOf(other)) return;
      var on = nodeOf(other);
      out.push({ slug: other, rel: e.relationship, out: e.source === slug, note: noted[on.title || other] || null });
    });
    return out;
  }
  function choose() {
    var all = fieldSlugs();
    if (!all.length) return null;
    var cur = nodeOf(here);
    var recent = trail.slice(-4);
    while (thoughtQueue.length) {
      var th = thoughtQueue.shift();
      if (th !== here && nodeOf(th) && recent.indexOf(th) < 0) return { slug: th, how: 'thought', edge: null };
    }
    var near = here ? neighbours(here) : [];
    var best = null, bestScore = -1e9;
    near.forEach(function (c) {
      var s = 4 - (visits[c.slug] || 0) * 3 + Math.random() * 2.5;
      if (c.note) s += 2;
      if (recent.indexOf(c.slug) >= 0) s -= 6;
      var n = nodeOf(c.slug);
      if (cur && n && n.place && n.place === cur.place) s += 0.6;
      if (s > bestScore) { bestScore = s; best = c; }
    });
    var wander = !here || !best || bestScore < 0.5 || Math.random() < 0.14;
    if (!wander) return { slug: best.slug, how: 'follow', edge: best };
    var least = Math.min.apply(null, all.map(function (s) { return visits[s] || 0; }));
    var fresh = all.filter(function (s) { return (visits[s] || 0) === least && s !== here && recent.indexOf(s) < 0; });
    if (!fresh.length) fresh = all.filter(function (s) { return s !== here; });
    if (!fresh.length) fresh = all;
    return { slug: pick(fresh), how: here ? 'cross' : 'arrive', edge: null };
  }

  /* Jack's clerk voice: dry, careful, never settling canon. */
  function sayIntent(move, from, to) {
    var t = (to && (to.title || to.slug)) || 'the next bead';
    var f = (from && (from.title || from.slug)) || '';
    if (move.how === 'arrive') return pick([
      'I’ll start where the wood is thickest. ' + t + '.',
      'Begin anywhere honest. ' + t + ' will do.',
      'First card of the sitting: ' + t + '.'
    ]);
    if (move.how === 'resume') return pick([
      'You left off at ' + t + '. I’ll carry on from there.',
      'Back to the desk. We were at ' + t + '.',
      'Reins returned. Picking up at ' + t + '.'
    ]);
    if (move.how === 'thought') return pick([
      'My thought went to ' + t + '. I’ll go and look at it properly.',
      'I named ' + t + ' just now. Better read it than quote it.',
      t + ' came up. Walking over.'
    ]);
    if (move.how === 'cross') return pick([
      'Nothing more on this limb that I haven’t read. Crossing the wood to ' + t + '.',
      'A different shelf. ' + t + ', which I haven’t opened yet.',
      'I’ll leave ' + (f || 'this') + ' be and look at ' + t + ' instead.',
      'No thread worth pulling here. Over to ' + t + '.'
    ]);
    var rel = relWord(move.edge && move.edge.rel);
    var arrow = move.edge && move.edge.out ? (f + ' — ' + rel + ' → ' + t) : (t + ' — ' + rel + ' → ' + f);
    if (move.edge && move.edge.note) return 'There’s a note on this edge. Following ' + arrow + '.';
    return pick([
      'Following the thread: ' + arrow + '.',
      'The record says ' + arrow + '. I’ll go and look.',
      'One edge leads off ' + (f || 'here') + ' — ' + rel + '. Taking it to ' + t + '.'
    ]);
  }
  /* What the card itself records, said plainly while he thinks. Facts from the record, not thoughts. */
  function sayReflect(node) {
    var C = window.TTG_VIEW_CONTEXT || {};
    var c = (node && C[node.slug]) || { voices: [], notes: [] };
    var t = node.title || node.slug;
    var lines = [];
    if (c.voices.length) {
      var v = c.voices[0];
      lines.push('Filed by ' + (v.voice || 'an unsigned hand') + ' as ' + String(v.class || 'a note').replace(/_/g, ' ').toLowerCase() + '.');
    }
    if (c.notes.length) {
      var n = c.notes[0];
      lines.push('A note on the edge between ' + t + ' and ' + n.title + ': “' + String(n.note).slice(0, 140) + (String(n.note).length > 140 ? '…' : '') + '”');
    }
    if (node.unresolved) lines.push(node.unresolved + ' unresolved relationship' + (node.unresolved === 1 ? '' : 's') + ' on this card.');
    if (node.opening) lines.push('Opening condition: ' + String(node.opening).replace(/\.$/, '') + '.');
    if (node.place) lines.push('Stamped at ' + node.place + ', ' + whenOf(node) + '.');
    if (!lines.length) lines.push(t + ': ' + whenOf(node) + ', unplaced.');
    return pick(lines);
  }
  function sayTurn(proj) {
    var s = STANCE[proj] || STANCE.TEMPORAL;
    return 'Turning the wood: ' + proj.toLowerCase() + '. ' + s.epithet + '.';
  }

  var sayGen = 0;
  function say(text, opts) {
    opts = opts || {};
    var el = $('viewSay');
    if (el) {
      var my = ++sayGen;
      if (reduce) el.textContent = text;
      else {
        el.textContent = '';
        var i = 0;
        (function typeOn() {
          if (my !== sayGen) return;
          if (i >= text.length) return;
          el.textContent = text.slice(0, i += 2);
          setTimeout(typeOn, 16);
        })();
      }
    }
    if (opts.log !== false) logLocal(text);
  }
  var localN = 0;
  function logLocal(text) {
    appendObservation({
      id: 'tour-' + (++localN) + '-' + Date.now(),
      at: new Date().toISOString(),
      projection: '',
      focus: { title: reins === 'jack' ? 'ON THE TOUR' : 'AT THE DESK' },
      text: text,
      local: true
    }, true);
  }
  function readCard(node, ms) {
    var bodyEl = $('viewBody');
    if (!bodyEl) return;
    var text = cardBody(node, true);
    if (reduce || !text) { bodyEl.textContent = text; return; }
    var my = gen;
    var per = Math.max(10, Math.min(40, ms * 0.7 / Math.max(1, text.length)));
    var i = 0;
    bodyEl.textContent = '';
    (function more() {
      if (my !== gen) { bodyEl.textContent = text; return; }
      i = Math.min(text.length, i + 3);
      bodyEl.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(more, per * 3);
    })();
  }

  function stepDecide(forced) {
    var list = fieldSlugs();
    if (!list.length) { paint(null, 'EMPTY', 'No public field to tour.'); return; }
    stops += 1;
    if (!forced && stops > 4 && Math.random() < 0.45) {
      stops = 0;
      projIdx = (projIdx + 1) % PROJS.length;
      var proj = PROJS[projIdx];
      setMode('TURNING');
      say(sayTurn(proj));
      if (window.TTG_FIELD && TTG_FIELD.setProjection) TTG_FIELD.setProjection(proj, patternFor(step++, proj));
      paintContext(proj, snap.pattern, step);
      later(function () { stepDecide(true); }, T.decide + 1200);
      return;
    }
    var move = forced && forced.slug ? forced : choose();
    if (!move) return;
    var from = nodeOf(here);
    var to = nodeOf(move.slug);
    setMode(move.how === 'follow' ? 'FOLLOWING' : (move.how === 'resume' ? 'RESUMING' : (move.how === 'thought' ? 'FOLLOWING A THOUGHT' : 'CHOOSING')));
    light([]);
    say(sayIntent(move, from, to));
    later(function () { stepTravel(move); }, T.decide);
  }
  var cameFrom = '';
  var deskTrail = [];          // cards the visitor opened while holding the reins (slugs only)
  var thoughtQueue = [];       // cards Jack's last thought named, to walk to next
  function light(slugs) {
    if (window.TTG_FIELD && typeof TTG_FIELD.light === 'function') TTG_FIELD.light(slugs);
  }
  /* Turn the tree to show the thought: light what it touches, look at each named card, come back. */
  function showThought(obs, done) {
    var look = (obs.look || []).filter(function (s) { return nodeOf(s) && s !== here; });
    light((cameFrom ? [cameFrom] : []).concat(look));
    thoughtQueue = look.filter(function (s) { return trail.slice(-4).indexOf(s) < 0; });
    if (reduce || !look.length || !window.TTG_FIELD || !TTG_FIELD.focusSlug) { done(); return; }
    var at = here, i = 0;
    (function next() {
      if (i >= look.length) { TTG_FIELD.focusSlug(at); later(done, 1800); return; }
      TTG_FIELD.focusSlug(look[i++]);
      later(next, 2600);
    })();
  }
  function stepTravel(move) {
    var proj = PROJS[projIdx];
    cameFrom = move.how === 'resume' || move.how === 'arrive' ? '' : (here || '');
    var pattern = patternFor(step, proj);
    here = move.slug;
    visits[here] = (visits[here] || 0) + 1;
    trail.push(here);
    if (trail.length > 12) trail.shift();
    var beat = move.edge ? (relWord(move.edge.rel) + ' · STOP ' + trail.length) : ('STOP ' + Object.keys(visits).length + '/' + fieldSlugs().length);
    applyFocus(here, proj, pattern, beat);
    setMode('TRAVELLING');
    later(stepOpen, T.travel);
  }
  function stepOpen() {
    var node = nodeOf(here);
    if (!node) { later(stepDecide, T.decide); return; }
    setMode('OPENING THE CARD');
    paintCard(node);
    var ctx = $('viewContext');
    if (ctx) ctx.classList.add('is-reading');
    var text = cardBody(node, true);
    var ms = Math.max(T.readMin, Math.min(T.readMax, text.length * (reduce ? 70 : 45)));
    later(function () {
      setMode('READING');
      readCard(node, ms);
      say('Reading ' + (node.title || node.slug) + '. ' + firstSentence(text), { log: false });
      later(stepReflect, ms);
    }, T.open);
  }
  function stepReflect() {
    var node = nodeOf(here);
    var ctx = $('viewContext');
    if (ctx) ctx.classList.remove('is-reading');
    if (!node) { later(stepDecide, T.decide); return; }
    setMode('NOTING');
    say(sayReflect(node));
    var at = here;
    var t0 = Date.now();
    var my = gen;
    var desk = deskTrail.splice(0);
    var tries = 0;
    later(function () { setMode('THINKING'); }, T.reflect);
    function ask() {
      think(at, cameFrom, 'arrived', function (r) {
        if (my !== gen || reins !== 'jack' || here !== at) { deskTrail = desk.concat(deskTrail); return; }
        clearTimers();
        if (r && r.busy && tries < 1 && r.retry <= 25) {
          // Still on his previous thought; stay at the card a little longer rather than leave it unthought.
          tries += 1;
          setMode('THINKING');
          later(ask, r.retry * 1000 + 400);
          return;
        }
        if (!r || r.busy) {
          deskTrail = desk.concat(deskTrail);
          later(stepDecide, Math.max(0, T.reflect - (Date.now() - t0)));
          return;
        }
        var wait = Math.max(0, T.reflect - (Date.now() - t0));
        later(function () {
          setMode(r.cached ? 'REMEMBERING' : 'REALISING');
          say(r.obs.text, { log: false });
          appendObservation(r.obs, true);
          var dwell = Math.max(reduce ? 12000 : 8000, Math.min(22000, String(r.obs.text).length * (reduce ? 75 : 55)));
          var t1 = Date.now();
          showThought(r.obs, function () {
            later(stepDecide, Math.max(2500, dwell - (Date.now() - t1)));
          });
        }, wait);
      }, desk);
    }
    ask();
  }
  function firstSentence(t) {
    var m = String(t || '').match(/^.{12,200}?[.!?](\s|$)/);
    return m ? m[0].trim() : String(t || '').slice(0, 160);
  }
  function setMode(m) {
    var el = $('viewMode');
    if (el) el.textContent = (reins === 'jack' ? 'JACK · ' : 'YOU · ') + m;
  }

  /* ---------- the reins ---------- */
  function paintReins() {
    var box = $('reins');
    if (!box) return;
    if (box.getAttribute('data-who') !== reins) {
      box.classList.remove('flash');
      void box.offsetWidth;
      box.classList.add('flash');
    }
    box.setAttribute('data-who', reins);
    $('reinsWho').textContent = reins === 'jack' ? 'JACK HAS THE REINS' : 'YOU HAVE THE REINS';
    $('reinsBtn').textContent = reins === 'jack' ? 'TAKE THE REINS' : 'HAND BACK';
    paintIdle();
  }
  function paintIdle() {
    var note = $('reinsNote');
    if (!note) return;
    if (reins === 'jack') { note.textContent = 'Touch anything to take them'; return; }
    var left = Math.ceil((IDLE_RESUME - (Date.now() - lastInput)) / 1000);
    note.textContent = left <= 10 && left > 0 ? 'Jack resumes in ' + left + 's' : 'Drag, scroll, tap a bead · Esc hands back';
  }
  function takeover() {
    lastInput = Date.now();
    if (reins === 'you') { paintIdle(); return; }
    reins = 'you';
    gen += 1;
    sayGen += 1;
    clearTimers();
    if (window.TTG_FIELD && typeof TTG_FIELD.setDrift === 'function') TTG_FIELD.setDrift(false);
    var ctx = $('viewContext');
    if (ctx) ctx.classList.remove('is-reading');
    var node = nodeOf(here);
    if (node) $('viewBody').textContent = cardBody(node, true);
    setMode('LOOKING');
    var s = $('viewSay');
    if (s) s.textContent = 'Reins handed over. Hands off the desk.';
    paintReins();
    if (idleTimer) clearInterval(idleTimer);
    idleTimer = setInterval(function () {
      if (reins !== 'you') return;
      if (!tabWatched()) { lastInput = Date.now(); return; }
      paintIdle();
      if (Date.now() - lastInput >= IDLE_RESUME) handBack();
    }, 500);
  }
  function handBack() {
    if (reins === 'jack') return;
    reins = 'jack';
    gen += 1;
    clearTimers();
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    if (window.TTG_FIELD && typeof TTG_FIELD.setDrift === 'function') TTG_FIELD.setDrift(!reduce);
    paintReins();
    stops = 0;
    if (here) stepDecide({ slug: here, how: 'resume', edge: null });
    else stepDecide();
  }
  function clearTimers() {
    if (timer) { clearTimeout(timer); timer = null; }
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
    if (obs.local) li.classList.add('is-local');
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
  /* Jack's realisation at this card, this moment: the server reads the card and the edge he walked
     from canon and asks him with no visitor attached. Returns null when he is still on another thought. */
  var thinkSeq = 0;
  function think(slug, fromSlug, moment, cb, desk) {
    if (!slug || !tabWatched()) { cb(null); return; }
    var my = ++thinkSeq;
    var done = false;
    var finish = function (r) { if (done) return; done = true; cb(my === thinkSeq ? r : null); };
    setTimeout(function () { finish(null); }, reduce ? 30000 : 25000);
    var data = new FormData();
    data.set('csrf', G.csrf || '');
    data.set('watching', '1');
    data.set('projection', snap.projection || 'TEMPORAL');
    data.set('pattern', snap.pattern ? '1' : '0');
    data.set('slug', slug);
    data.set('from', fromSlug || '');
    data.set('moment', moment || 'arrived');
    data.set('desk', (desk || []).join(','));
    fetch('/view/observe', {
      method: 'POST',
      body: data,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) { return res.json(); })
      .then(function (j) {
        if (j && j.ok && j.busy) { finish({ busy: true, retry: Number(j.retry_in) || 60 }); return; }
        if (!j || !j.ok || !j.observation || j.observation.ok === false) { finish(null); return; }
        if (!j.observation.focus || j.observation.focus.slug !== slug) { finish(null); return; }
        finish({ obs: j.observation, cached: !!j.cached });
      })
      .catch(function () { finish(null); });
  }
  function armJack() {
    loadLog();
  }

  window.TTG_VIEW_ON_FOCUS = function (node) {
    if (!node || reins !== 'you') return;
    here = node.slug || here;
    snap.slug = node.slug || '';
    snap.title = node.title || node.slug || '';
    snap.type = node.type || '';
    snap.when = whenOf(node);
    snap.place = node.place || '';
    paint(node, 'YOU · LOOKING', 'BEAD · ' + (node.slug || 'record'));
  };

  window.TTG_VIEW_ON_PICK = function (node) {
    if (!node) return;
    takeover();
    here = node.slug || here;
    visits[here] = (visits[here] || 0) + 1;
    snap.slug = node.slug || '';
    snap.title = node.title || node.slug || '';
    snap.type = node.type || '';
    snap.when = whenOf(node);
    snap.place = node.place || '';
    paintCard(node);
    paint(node, 'YOU · CARD OPEN', 'BEAD · ' + (node.slug || 'record'));
    var s = $('viewSay');
    if (s) s.textContent = (node.title || node.slug) + ' is open on the desk.';
    if (deskTrail[deskTrail.length - 1] !== here) deskTrail.push(here);
    if (deskTrail.length > 6) deskTrail.shift();
    light([]);
    var at = here;
    think(at, '', 'opened', function (r) {
      if (!r || r.busy || reins !== 'you' || here !== at) return;
      var el = $('viewSay');
      if (el) el.textContent = r.obs.text;
      appendObservation(r.obs, true);
      light(r.obs.look || []);   // show what he sees in it, but leave the camera to the visitor
    }, deskTrail.slice(0, -1));
  };

  window.TTG_VIEW_ON_MISS = function () { takeover(); };

  function armReins() {
    var inReins = function (e) {
      return e && e.target && e.target.closest && e.target.closest('#reins');
    };
    var take = function (e) { if (!inReins(e)) takeover(); };
    addEventListener('pointerdown', take, { capture: true, passive: true });
    addEventListener('touchstart', take, { capture: true, passive: true });
    addEventListener('wheel', take, { capture: true, passive: true });
    var mx = null, my = null;
    addEventListener('pointermove', function (e) {
      if (inReins(e)) return;
      if (reins === 'you') { lastInput = Date.now(); return; }
      if (e.pointerType !== 'mouse') return;
      if (mx === null) { mx = e.clientX; my = e.clientY; return; }
      if (Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) > 40) { mx = my = null; takeover(); }
    }, { capture: true, passive: true });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (reins === 'you') handBack(); else takeover();
        return;
      }
      if (inReins(e)) return;
      if (e.key === 'Tab' || e.key === 'Shift' || e.metaKey || e.ctrlKey || e.altKey) { if (reins === 'you') lastInput = Date.now(); return; }
      takeover();
    }, true);
    var btn = $('reinsBtn');
    if (btn) btn.addEventListener('click', function () {
      if (reins === 'jack') takeover(); else handBack();
    });
  }

  function boot() {
    ensureRuler();
    armReins();
    armJack();
    paintContext('TEMPORAL', false, 0);
    paintReins();
    if (window.TTG_FIELD && typeof TTG_FIELD.setDrift === 'function') TTG_FIELD.setDrift(!reduce);
    if (!fieldSlugs().length) {
      paint(null, 'EMPTY', 'No public field to tour.');
      return;
    }
    paint(null, 'JACK · AT THE DESK', fieldSlugs().length + ' CARDS IN THE PUBLIC FIELD');
    $('viewTitle').textContent = 'The field opens.';
    later(stepDecide, reduce ? 600 : 1600);
  }

  if (document.readyState === 'complete') boot();
  else addEventListener('load', boot);
})();
