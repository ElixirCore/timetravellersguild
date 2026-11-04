/* NOW — the field. Graph is the database; WebGL is optional. */
(function () {
  var G = window.TTG_GRAPH || { field: [], edges: [], projections: [], you: {}, jack: {} };
  var field = Array.isArray(G.field) ? G.field.slice() : [];
  var edges = Array.isArray(G.edges) ? G.edges.slice() : [];
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MODE = String(window.TTG_MODE || 'now').toLowerCase();
  var isView = MODE === 'view';
  var isBoot = MODE === 'boot';
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  body.classList.add('js');
  if (isView) body.classList.add('view');
  if (isBoot) body.classList.add('boot');

  var DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  var MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clockText(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
      + ' · ' + DAYS[d.getDay()] + ' ' + pad(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function localPresent(d) {
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  (function tick() {
    var d = new Date();
    var cl = $('clockLine'); if (cl) cl.textContent = clockText(d);
    var lp = $('localPresent'); if (lp) lp.textContent = localPresent(d);
    setTimeout(tick, 1000);
  })();

  var you = G.you || {};
  var navYou = $('navYou');
  if (navYou && you.href) navYou.setAttribute('href', you.href);

  var homePath = (location.pathname === '/now/tree' || location.pathname === '/now/tree/') ? '/now/tree'
    : (location.pathname === '/view' || location.pathname === '/view/') ? '/view'
    : (location.pathname === '/now' || location.pathname === '/now/') ? '/now'
    : '/now/tree';
  var state = {
    projection: 'TEMPORAL',
    selected: null,
    pattern: false
  };

  function bySlug(slug) {
    for (var i = 0; i < field.length; i++) if (field[i].slug === slug) return field[i];
    return null;
  }

  var PRESENT_YEAR = (new Date()).getFullYear() || 2026;
  var componentCache = {};
  function forgetComponents() { componentCache = {}; }
  function componentRoot(slug) {
    slug = String(slug || '');
    if (!slug) return '';
    if (componentCache[slug]) return componentCache[slug];
    var seen = {};
    var q = [slug];
    seen[slug] = true;
    for (var i = 0; i < q.length; i++) {
      var cur = q[i], e, o;
      for (e = 0; e < edges.length; e++) {
        o = edges[e].source === cur ? edges[e].target : (edges[e].target === cur ? edges[e].source : '');
        if (o && !seen[o]) { seen[o] = true; q.push(o); }
      }
    }
    var root = q.slice().sort()[0] || slug;
    q.forEach(function (s) { componentCache[s] = root; });
    return root;
  }
  function whenStamp(n) {
    var d = n && n.def ? n.def : n;
    if (!d) return 0;
    if (d.observed_at) {
      var t = Date.parse(d.observed_at);
      if (!isNaN(t)) return t;
    }
    var y = Number(d.year);
    return y ? Date.UTC(y, 6, 1) : 0;
  }
  function yearOfDef(d) {
    var t = whenStamp(d);
    if (t) return new Date(t).getUTCFullYear();
    d = d && d.def ? d.def : d;
    return Number(d && d.year) || PRESENT_YEAR;
  }
  function whenLabel(d) {
    d = d && d.def ? d.def : d;
    if (d && d.observed_at) {
      var dt = new Date(Date.parse(d.observed_at));
      if (!isNaN(dt.getTime())) {
        return pad(dt.getUTCDate()) + '.' + pad(dt.getUTCMonth() + 1) + '.' + dt.getUTCFullYear();
      }
    }
    var y = Number(d && d.year);
    return y ? String(y) : 'undated';
  }
  function relWord(r) {
    return String(r || 'related').replace(/_/g, ' ').toLowerCase();
  }
  function linksOf(node) {
    if (!node) return [];
    if (Array.isArray(node.links) && node.links.length) return node.links.slice();
    var ev = node.why && node.why.evidence ? node.why.evidence : [];
    return ev.map(function (e) {
      return {
        slug: e.slug,
        title: e.label || e.slug,
        type: e.type || '',
        via: e.via || '',
        direction: e.direction || '',
        year: 0,
        observed_at: ''
      };
    }).filter(function (l) { return l.slug; });
  }
  function fieldSorted() {
    return field.slice().sort(function (a, b) {
      var dw = whenStamp(a) - whenStamp(b);
      if (dw) return dw;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }
  function limbOf(slug) {
    var root = componentRoot(slug);
    return fieldSorted().filter(function (n) { return componentRoot(n.slug) === root; });
  }
  function yearsInField() {
    var ys = {};
    field.forEach(function (n) {
      var y = yearOfDef(n);
      if (y) ys[y] = true;
    });
    ys[PRESENT_YEAR] = true;
    ys[2033] = true;
    return Object.keys(ys).map(Number).sort(function (a, b) { return a - b; });
  }
  function hasEdge(edge) {
    return edges.some(function (e) {
      return e.source === edge.source && e.target === edge.target && e.relationship === edge.relationship;
    });
  }
  function ingestAround(payload) {
    if (!payload) return;
    (payload.edges || []).forEach(function (edge) {
      if (!edge || !edge.source || !edge.target || hasEdge(edge)) return;
      if (window.TTG_FIELD && TTG_FIELD.addEdge) TTG_FIELD.addEdge(edge);
      else edges.push(edge);
    });
    forgetComponents();
    (payload.nodes || []).forEach(function (node) {
      if (!node || !node.slug || bySlug(node.slug)) return;
      field.push(node);
      if (window.TTG_FIELD && TTG_FIELD.addNode) TTG_FIELD.addNode(node);
    });
    if (window.TTG_FIELD && TTG_FIELD.relayout) TTG_FIELD.relayout();
  }
  var aroundBusy = false;
  function followSlug(slug, fromPop) {
    if (!slug) return;
    var n = bySlug(slug);
    if (n) { showLife(n, fromPop); return; }
    if (aroundBusy) return;
    aroundBusy = true;
    var url = (G.around || '/now/around') + '?slug=' + encodeURIComponent(slug);
    fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (r) {
        aroundBusy = false;
        if (!r.j || !r.j.ok) {
          if (/^feed-\d+$/.test(slug)) return;
          location.href = '/n/' + encodeURIComponent(slug) + '/';
          return;
        }
        ingestAround(r.j);
        var got = bySlug(slug) || r.j.node;
        if (got) showLife(got, fromPop);
      })
      .catch(function () {
        aroundBusy = false;
        if (/^feed-\d+$/.test(slug)) return;
        location.href = '/n/' + encodeURIComponent(slug) + '/';
      });
  }
  function walkLimb(dir) {
    var node = bySlug(state.selected);
    if (!node) return;
    var limb = limbOf(node.slug);
    var idx = -1, i;
    for (i = 0; i < limb.length; i++) if (limb[i].slug === node.slug) idx = i;
    var next = limb[idx + dir];
    if (next) followSlug(next.slug);
  }
  function surfToYear(y) {
    var list = fieldSorted();
    var pick = null, i;
    for (i = 0; i < list.length; i++) {
      if (yearOfDef(list[i]) >= y) { pick = list[i]; break; }
    }
    if (!pick) pick = list[list.length - 1];
    if (pick) showLife(pick);
  }
  function paintChrono(y) {
    var ticks = $('chronoTicks');
    if (!ticks) return;
    var years = yearsInField();
    if (ticks.getAttribute('data-years') !== years.join(',')) {
      ticks.setAttribute('data-years', years.join(','));
      ticks.innerHTML = '';
      years.forEach(function (yr) {
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = String(yr);
        b.setAttribute('data-year', String(yr));
        b.addEventListener('click', function () { surfToYear(yr); });
        li.appendChild(b);
        ticks.appendChild(li);
      });
    }
    Array.prototype.forEach.call(ticks.querySelectorAll('button'), function (b) {
      if (Number(b.getAttribute('data-year')) === y) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    var head = $('chronoHead');
    if (head && years.length) {
      var min = years[0], max = years[years.length - 1];
      var t = max === min ? 0.5 : (y - min) / (max - min);
      head.style.bottom = (Math.max(0, Math.min(1, t)) * 100) + '%';
    }
  }
  function paintLimb(node) {
    var whenEl = $('lifeWhen');
    if (whenEl) whenEl.textContent = whenLabel(node);
    var limb = limbOf(node.slug);
    var idx = -1, i;
    for (i = 0; i < limb.length; i++) if (limb[i].slug === node.slug) idx = i;
    var note = $('lifeLimbNote');
    if (note) {
      note.textContent = limb.length > 1
        ? (idx + 1) + ' of ' + limb.length + ' on this limb · ' + whenLabel(node)
        : 'A single station on this limb. Follow a link to grow the wood.';
    }
    var earlier = $('lifeEarlier');
    var later = $('lifeLater');
    if (earlier) earlier.disabled = idx <= 0;
    if (later) later.disabled = idx < 0 || idx >= limb.length - 1;
    var box = $('lifeLinks');
    if (!box) return;
    box.innerHTML = '';
    var links = [];
    var seenLink = {};
    linksOf(node).forEach(function (l) {
      if (!l.slug || seenLink[l.slug]) return;
      seenLink[l.slug] = true;
      links.push(l);
    });
    if (!links.length) {
      var empty = document.createElement('li');
      empty.textContent = 'No linked timeline from here.';
      box.appendChild(empty);
      return;
    }
    links.forEach(function (l) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '/n/' + encodeURIComponent(l.slug) + '/';
      var title = document.createElement('span');
      title.className = 'n';
      title.textContent = l.title || l.slug;
      var meta = document.createElement('span');
      meta.className = 'p';
      var bits = [relWord(l.via)];
      var other = bySlug(l.slug);
      var y = l.year || (other && other.year);
      if (y) bits.push(String(y));
      if (!other) bits.push('off the wood');
      meta.textContent = bits.join(' · ');
      a.appendChild(title);
      a.appendChild(meta);
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        followSlug(l.slug);
      });
      li.appendChild(a);
      box.appendChild(li);
    });
  }

  function typeLabel(t) {
    if (String(t || '').toUpperCase() === 'PLAY') return 'WORKING SLIP';
    return String(t || 'UNKNOWN').replace(/_/g, ' ');
  }
  function placeKey(node) {
    var p = String((node && node.place) || 'unplaced').replace(/^\s+|\s+$/g, '');
    return (p || 'unplaced').toLowerCase();
  }
  function houseOf(node) {
    var t = String((node && node.type) || '').toUpperCase();
    var blob = (((node && node.slug) || '') + ' ' + ((node && node.title) || '')).toLowerCase();
    if ((node && node.pending) || t === 'UNKNOWN') return 'PENDING';
    if (t === 'INSTITUTION' || /det-?\d|department|excess time/.test(blob)) return 'DEPARTMENT';
    if (t === 'MISSION' || /guild|station/.test(blob)) return 'GUILD';
    if (t === 'DOCUMENT' || t === 'SIGNAL') return 'PAPER';
    if (t === 'PLACE') return 'PLACE';
    return 'FIELD';
  }
  function socialHead(node) {
    if (node && node.near_you) return 'NEAR YOU';
    var root = componentRoot(node && node.slug);
    var rn = bySlug(root);
    if (rn && rn.title) return String(rn.title);
    if (node && String(node.type).toUpperCase() === 'PERSON') return 'PEOPLE';
    return 'UNLINKED';
  }
  function rankedKeys(list, keyFn) {
    var seen = {}, keys = [];
    (list || []).forEach(function (n) {
      var k = keyFn(n);
      if (!seen[k]) { seen[k] = true; keys.push(k); }
    });
    keys.sort(function (a, b) {
      var tail = { unplaced: 1, PENDING: 1, UNLINKED: 1, FIELD: 1 };
      if (tail[a] && !tail[b]) return 1;
      if (tail[b] && !tail[a]) return -1;
      return String(a).localeCompare(String(b));
    });
    var rank = {};
    keys.forEach(function (k, i) { rank[k] = i; });
    return { keys: keys, rank: rank, n: keys.length };
  }

  /* ---------- sheets / Jack drawer ---------- */
  var jackDraw = 0; /* 0 closed · 1 open */
  var jackDrag = null;
  var jackTween = null;
  var jackMoved = 0;

  function jackClamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function applyJackDraw(u, mode) {
    var el = $('jack');
    var handle = $('jackMark');
    if (!el) return;
    jackDraw = jackClamp(u);
    var open = jackDraw > 0.92;
    if (mode === 'settle') {
      el.classList.remove('dragging');
      el.style.transform = '';
      el.classList.toggle('open', open);
    } else {
      el.classList.add('dragging');
      el.style.transform = 'translate3d(' + ((1 - jackDraw) * 100) + '%,0,0)';
      el.classList.toggle('open', open);
    }
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (handle) {
      handle.setAttribute('aria-expanded', open ? 'true' : 'false');
      handle.setAttribute('aria-label', open ? 'Close Jack, the clerk' : 'Open Jack, the clerk');
    }
  }

  function tweenJackDraw(to, ms) {
    to = to >= 1 ? 1 : 0;
    if (reduce) {
      applyJackDraw(to, 'settle');
      if (to >= 1) {
        var SprR = window.Jack && window.Jack.Sprite;
        if (SprR && SprR.setForm) SprR.setForm('speak');
      }
      return;
    }
    var from = jackDraw;
    var dur = ms == null ? 480 : ms;
    var t0 = performance.now();
    if (jackTween) cancelAnimationFrame(jackTween);
    function step(now) {
      var k = jackClamp((now - t0) / dur);
      applyJackDraw(from + (to - from) * easeOutCubic(k), 'tween');
      if (k < 1) jackTween = requestAnimationFrame(step);
      else {
        jackTween = null;
        applyJackDraw(to, 'settle');
        if (to >= 1) {
          var Spr = window.Jack && window.Jack.Sprite;
          if (Spr && Spr.setForm) Spr.setForm('speak');
          var q = $('jackQ');
          if (q) setTimeout(function () { q.focus(); }, 40);
        } else {
          var Spr2 = window.Jack && window.Jack.Sprite;
          if (Spr2 && Spr2.setForm) Spr2.setForm('sit');
        }
      }
    }
    jackTween = requestAnimationFrame(step);
  }

  function closeSheets() {
    ['life', 'capture'].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.classList.remove('open');
      if (id === 'life') el.hidden = true;
    });
    if (jackDraw > 0.05) tweenJackDraw(0, 420);
    else applyJackDraw(0, 'settle');
    if (location.hash === '#jack' || location.hash === '#capture') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  function openSheet(id) {
    if (id === 'jack') {
      ['life', 'capture'].forEach(function (oid) {
        var o = $(oid); if (!o) return;
        o.classList.remove('open');
        if (oid === 'life') o.hidden = true;
      });
      closeLens();
      tweenJackDraw(1, 520);
      try { history.replaceState(null, '', location.pathname + location.search + '#jack'); } catch (e) {}
      return;
    }
    if (jackDraw > 0.05) tweenJackDraw(0, 360);
    ['life', 'capture'].forEach(function (oid) {
      var o = $(oid); if (!o) return;
      o.classList.remove('open');
      if (oid === 'life') o.hidden = true;
    });
    if (id !== 'life') closeLens();
    var el = $(id); if (!el) return;
    el.hidden = false;
    el.classList.add('open');
  }
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () {
      var which = b.getAttribute('data-close');
      if (which === 'jack') {
        tweenJackDraw(0, 420);
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      } else {
        closeSheets();
        closeLens();
      }
    });
  });

  function bindJackHandle() {
    var handle = $('jackMark');
    var el = $('jack');
    if (!handle || !el) return;
    function onDown(e) {
      if (e.button != null && e.button !== 0) return;
      if (jackTween) { cancelAnimationFrame(jackTween); jackTween = null; }
      var w = el.getBoundingClientRect().width || 1;
      jackDrag = { x0: e.clientX, u0: jackDraw, w: w };
      jackMoved = 0;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add('dragging');
    }
    function onMove(e) {
      if (!jackDrag) return;
      var dx = jackDrag.x0 - e.clientX;
      jackMoved += Math.abs(e.clientX - jackDrag.x0);
      applyJackDraw(jackDrag.u0 + dx / jackDrag.w, 'drag');
    }
    function onUp() {
      if (!jackDrag) return;
      jackDrag = null;
      el.classList.remove('dragging');
      if (jackMoved < 8) {
        tweenJackDraw(jackDraw > 0.55 ? 0 : 1, 480);
        return;
      }
      tweenJackDraw(jackDraw >= 0.38 ? 1 : 0, 420);
    }
    handle.addEventListener('pointerdown', onDown);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }
  bindJackHandle();

  (function bindJackSprite() {
    var Spr = window.Jack && window.Jack.Sprite;
    var pet = $('jackPet');
    if (!Spr || !pet) return;
    Spr.attachPortrait(pet);
    if (Spr.setForm) Spr.setForm('sit');
  })();
  $('navPlus') && $('navPlus').addEventListener('click', function (e) {
    e.preventDefault(); openSheet('capture');
  });
  $('navJack') && $('navJack').addEventListener('click', function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openSheet('jack');
  });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (jackDraw > 0.05) {
        tweenJackDraw(0, 400);
        try { history.replaceState(null, '', location.pathname + location.search); } catch (err) {}
      } else { closeSheets(); hideLife(); }
    }
  });
  applyJackDraw(0, 'settle');
  if (location.hash === '#jack') openSheet('jack');
  if (location.hash === '#capture') openSheet('capture');

  /* ---------- node life ---------- */
  function fact(label, value) {
    var li = document.createElement('li');
    if (label) {
      var sp = document.createElement('span');
      sp.textContent = label;
      li.appendChild(sp);
      li.appendChild(document.createTextNode(' ' + value));
    } else {
      li.textContent = value;
    }
    return li;
  }
  function showLife(node, fromPop) {
    if (!node) return;
    if (isBoot) return;
    state.selected = node.slug;
    if (isView) {
      if (window.TTG_FIELD && TTG_FIELD.focusSlug) TTG_FIELD.focusSlug(node.slug);
      if (typeof window.TTG_VIEW_ON_FOCUS === 'function') window.TTG_VIEW_ON_FOCUS(node);
      return;
    }
    if (!$('lifeType') || !$('lifeTitle')) {
      if (window.TTG_FIELD && TTG_FIELD.focusSlug) TTG_FIELD.focusSlug(node.slug);
      return;
    }
    $('lifeType').textContent = typeLabel(node.type);
    $('lifeTitle').textContent = node.title || '';
    $('lifeStatus').textContent = node.status || '';
    var facts = $('lifeFacts');
    facts.innerHTML = '';
    facts.appendChild(fact('When:', whenLabel(node)));
    facts.appendChild(fact('Last observed:', node.place || 'unplaced'));
    facts.appendChild(fact('Custodian:', node.custodian || 'undisclosed'));
    var m = node.moments || 0;
    facts.appendChild(fact('', m + ' associated moment' + (m === 1 ? '' : 's')));
    var u = node.unresolved || 0;
    facts.appendChild(fact('', u + ' unresolved relationship' + (u === 1 ? '' : 's')));
    if (node.opening) facts.appendChild(fact('', node.opening));
    if (node.pending) facts.appendChild(fact('', 'PENDING — not yet canon.'));
    if (node.play) facts.appendChild(fact('', 'WORKING SLIP — earned on this sitting. Not canon.'));
    if (node.lens) facts.appendChild(fact('', 'RELEVANT — graduated by Jack. Seen through the lens. Not canon.'));
    var lifeLens = $('lifeLens');
    var lifePlate = $('lifePlate');
    if (lifeLens && lifePlate) {
      if (node.lens && node.src) {
        lifePlate.src = node.src;
        lifePlate.alt = node.title || '';
        lifeLens.hidden = false;
      } else {
        lifePlate.removeAttribute('src');
        lifeLens.hidden = true;
      }
    }
    if (!you.known && node.remembered_by) {
      facts.appendChild(fact('', node.remembered_by + (node.remembered_by === 1 ? ' person remembers this.' : ' people remember this.')));
    }
    if (you.known && node.near_you) facts.appendChild(fact('', 'Near your position.'));
    $('lifeBody').textContent = node.body || '';
    var rec = $('lifeRecord');
    rec.href = node.href || ('/n/' + encodeURIComponent(node.slug) + '/');
    var cross = $('lifeCross');
    if (node.open && node.open !== rec.href && node.open !== '/') {
      cross.hidden = false; cross.href = node.open;
    } else { cross.hidden = true; }
    $('lifeWhyPanel').hidden = true;
    paintLimb(node);
    paintChrono(yearOfDef(node));
    openSheet('life');
    if (node.lens && node.src) revealLens(node);
    else closeLens();
    if (window.TTG_FIELD && TTG_FIELD.focusSlug) TTG_FIELD.focusSlug(node.slug);
    if (fromPop !== true && node.slug && !node.play && !node.lens) {
      var path = '/n/' + encodeURIComponent(node.slug) + '/';
      if (location.pathname !== path) history.pushState({ now: 1, slug: node.slug }, '', path);
    }
  }
  function hideLife(fromPop) {
    state.selected = null;
    var life = $('life');
    if (life) { life.classList.remove('open'); life.hidden = true; }
    var lifeLens = $('lifeLens');
    var lifePlate = $('lifePlate');
    if (lifeLens) lifeLens.hidden = true;
    if (lifePlate) lifePlate.removeAttribute('src');
    closeLens();
    if (window.TTG_FIELD && TTG_FIELD.focusSlug) TTG_FIELD.focusSlug(null);
    if (fromPop !== true && /^\/n\//.test(location.pathname)) {
      history.pushState({ now: 1 }, '', homePath);
    }
  }
  $('lifeWhy') && $('lifeWhy').addEventListener('click', function () {
    var node = bySlug(state.selected);
    if (!node) return;
    var why = node.why || {};
    var ev = why.evidence || [];
    var box = $('lifeEvidence');
    box.textContent = '';
    ev.slice(0, 8).forEach(function (e, i) {
      if (i) box.appendChild(document.createTextNode('; '));
      if (e.slug) {
        var a = document.createElement('a');
        a.href = '/n/' + encodeURIComponent(e.slug) + '/';
        a.textContent = (e.label || e.slug) + ' (' + String(e.via || '').replace(/_/g, ' ').toLowerCase() + ')';
        a.addEventListener('click', function (ev2) {
          ev2.preventDefault();
          followSlug(e.slug);
        });
        box.appendChild(a);
      } else {
        box.appendChild(document.createTextNode(
          (e.label || '') + ' (' + String(e.via || '').replace(/_/g, ' ').toLowerCase() + ')'
        ));
      }
    });
    var reasons = (why.reasons || []).join(' ');
    if (!ev.length) {
      box.textContent = reasons || 'Held in the public field. Absence of further evidence is a valid observation.';
    } else if (reasons) {
      box.appendChild(document.createTextNode(' — ' + reasons));
    }
    $('lifeInterp').textContent = why.interpretation
      || 'No interpretation has been accepted. The evidence stands alone.';
    $('lifeWhyPanel').hidden = false;
  });
  $('lifeRecord') && $('lifeRecord').addEventListener('click', function (e) {
    e.preventDefault();
  });
  addEventListener('popstate', function () {
    var st = history.state;
    if (st && st.slug) {
      var n = bySlug(st.slug);
      if (n) showLife(n, true);
      else hideLife(true);
    } else {
      hideLife(true);
    }
  });
  $('lifePattern') && $('lifePattern').addEventListener('click', function () {
    state.pattern = true;
    setProjection('SYMBOLIC');
  });
  $('lifeEarlier') && $('lifeEarlier').addEventListener('click', function () { walkLimb(-1); });
  $('lifeLater') && $('lifeLater').addEventListener('click', function () { walkLimb(1); });
  paintChrono(PRESENT_YEAR);

  function lensPlates() {
    return field.filter(function (n) { return n && n.lens; });
  }
  function closeLens() {
    body.classList.remove('lens-open');
    var port = $('lensPort');
    if (!port) return;
    port.hidden = true;
    port.classList.remove('has-plate', 'is-in');
  }
  function paintLens(node) {
    var port = $('lensPort');
    var img = $('lensPlate');
    var cap = $('lensCaption');
    var glass = $('lensGlassBtn');
    var plates = lensPlates();
    if (!port) return;
    if (!plates.length) {
      closeLens();
      return;
    }
    var show = node && node.lens ? node : plates[0];
    if (img && show && show.src) {
      img.src = show.src;
      img.alt = show.title || '';
      port.classList.add('has-plate');
    } else {
      port.classList.remove('has-plate');
    }
    if (cap) cap.textContent = show && show.title ? show.title : '';
    if (glass) {
      glass.setAttribute('aria-label', plates.length > 1 ? 'Next plate' : 'Inspect plate');
    }
  }
  function revealLens(node) {
    var plates = lensPlates();
    if (!plates.length) return;
    var show = node && node.lens ? node : plates[0];
    if (!show || !show.src) return;
    var port = $('lensPort');
    var already = body.classList.contains('lens-open') && port && !port.hidden;
    body.classList.add('lens-open');
    paintLens(show);
    if (!port) return;
    port.hidden = false;
    if (already) {
      port.classList.add('is-in');
      return;
    }
    port.classList.remove('is-in');
    void port.offsetWidth;
    port.classList.add('is-in');
  }
  function openLens(slug) {
    var plates = lensPlates();
    if (!plates.length) return;
    var want = slug ? bySlug(slug) : null;
    if (!want || !want.lens) want = plates[0];
    revealLens(want);
    if (want && want.slug !== state.selected) followSlug(want.slug);
  }
  function cycleLens() {
    var plates = lensPlates();
    if (plates.length < 2) return;
    var idx = 0, i;
    for (i = 0; i < plates.length; i++) {
      if (plates[i].slug === state.selected) { idx = i; break; }
    }
    openLens(plates[(idx + 1) % plates.length].slug);
  }
  $('lensClose') && $('lensClose').addEventListener('click', closeLens);
  $('lensBackdrop') && $('lensBackdrop').addEventListener('click', closeLens);
  $('lensGlassBtn') && $('lensGlassBtn').addEventListener('click', function () {
    if (lensPlates().length > 1) cycleLens();
  });
  $('lifeLens') && $('lifeLens').addEventListener('click', function () {
    var node = bySlug(state.selected);
    if (node && node.lens) revealLens(node);
  });
  (function bootLens() {
    var params = new URLSearchParams(location.search);
    var want = params.get('lens') || '';
    if (location.hash === '#lens' && !want) want = 'open';
    if (!want) return;
    if (want === 'open') openLens();
    else openLens(want);
  })();

  /* ---------- projections ---------- */
  function setProjection(name) {
    state.projection = name;
    document.querySelectorAll('#projections [data-proj]').forEach(function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-proj') === name ? 'true' : 'false');
    });
    if (window.TTG_FIELD && TTG_FIELD.setProjection) TTG_FIELD.setProjection(name, state.pattern);
    orderList(name);
  }
  function orderList(name) {
    var ul = $('fallbackList');
    if (!ul) return;
    var items = field.slice();
    if (name === 'SPATIAL') items.sort(function (a, b) {
      var d = placeKey(a).localeCompare(placeKey(b));
      if (d) return d;
      return whenStamp(a) - whenStamp(b);
    });
    else if (name === 'SOCIAL') items.sort(function (a, b) {
      var ha = socialHead(a), hb = socialHead(b);
      if (ha !== hb) {
        if (ha === 'NEAR YOU') return -1;
        if (hb === 'NEAR YOU') return 1;
        return ha.localeCompare(hb);
      }
      var pa = (a.type === 'PERSON' ? 0 : 1) - (b.type === 'PERSON' ? 0 : 1);
      if (pa) return pa;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    else if (name === 'INSTITUTIONAL') items.sort(function (a, b) {
      var d = houseOf(a).localeCompare(houseOf(b));
      if (d) return d;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    else if (name === 'SYMBOLIC') items.sort(function (a, b) {
      var d = String(a.type).localeCompare(String(b.type));
      if (d) return d;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    else items.sort(function (a, b) {
      var dw = whenStamp(a) - whenStamp(b);
      if (dw) return dw;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
    ul.innerHTML = '';
    var last = '';
    items.forEach(function (n) {
      var head = name === 'SPATIAL' ? (n.place || 'unplaced')
        : (name === 'SYMBOLIC' ? typeLabel(n.type)
        : (name === 'SOCIAL' ? socialHead(n)
        : (name === 'INSTITUTIONAL' ? houseOf(n)
        : (name === 'TEMPORAL' ? String(yearOfDef(n) || 'UNDATED') : ''))));
      if (head && head !== last) {
        var g = document.createElement('li'); g.className = 'fb-group'; g.textContent = head;
        ul.appendChild(g); last = head;
      }
      var li = document.createElement('li');
      var a = document.createElement('a'); a.href = n.href; a.textContent = n.title;
      a.addEventListener('click', function (e) { e.preventDefault(); showLife(n); });
      li.appendChild(a);
      li.appendChild(document.createTextNode(' — ' + typeLabel(n.type) + (n.status ? ' · ' + n.status : '')));
      ul.appendChild(li);
    });
  }
  document.querySelectorAll('#projections [data-proj]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.pattern = b.getAttribute('data-proj') === 'SYMBOLIC' && state.pattern;
      setProjection(b.getAttribute('data-proj'));
    });
  });

  /* ---------- Jack (rule-based; never writes canon) ---------- */
  function jackReply(q) {
    q = (q || '').trim();
    var ql = q.toLowerCase();
    var ops = [];
    var text;
    if (!q) {
      text = G.jack && G.jack.greeting ? G.jack.greeting : 'The field is holding.';
      return { text: text, ops: ops };
    }
    function hits(pred) {
      return field.filter(pred);
    }
    function slipCtx(n) {
      if (!n) return '';
      var bits = [];
      if (n.type) bits.push(String(n.type).replace(/_/g, ' '));
      if (n.place && n.place !== 'unplaced') bits.push(n.place);
      if (n.pending) bits.push('pending, not canon');
      return bits.join(' · ');
    }
    if (/why|seeing this|mabel|pattern|oracle/.test(ql)) {
      text = 'That question belongs to Mabel. I can only point at evidence. Accept the peel, or dismiss it.';
      ops.push({ kind: 'PEEL', label: 'Peel the selected life to evidence, then ask Mabel for pattern.', context: 'Evidence on the selected record. Pattern is Mabel’s, not the clerk’s.' });
    } else if (/department|det-?01|excess/.test(ql)) {
      var det = bySlug('det-01') || bySlug('department') || bySlug('det-response');
      text = 'The Department is a node in the field, not a menu. I can take you to the notice, or across the door.';
      if (det) ops.push({ kind: 'FOCUS', slug: det.slug, label: 'Show ' + det.title, context: slipCtx(det) });
      ops.push({ kind: 'OPEN', href: '/department/', label: 'Cross into the Department', context: 'The Department of Excess Time — a node, not the desk.' });
    } else if (/tin|sealed|quantum/.test(ql)) {
      var tin = bySlug('quantum-tin-013');
      text = 'Quantum Tin №013 is sealed. Contents are not claimed. Opening condition is not satisfied.';
      if (tin) ops.push({ kind: 'FOCUS', slug: tin.slug, label: 'Show Quantum Tin №013', context: slipCtx(tin) || 'Sealed. Contents are not claimed.' });
    } else if (/entered|new|pending|unclassified/.test(ql)) {
      var rec = hits(function (n) { return n.pending || /PENDING|UNKNOWN/.test(n.status || n.type || ''); });
      text = rec.length ? (rec.length + ' still sit as unclassified or pending.') : 'Nothing pending in this window.';
      rec.slice(0, 3).forEach(function (n) {
        ops.push({ kind: 'FOCUS', slug: n.slug, label: 'Show ' + n.title, context: slipCtx(n) });
      });
    } else if (/link|connect|edge|relate/.test(ql)) {
      text = 'I can propose a relation. A keeper must accept it before it is canon.';
      ops.push({ kind: 'PROPOSE_EDGE', label: 'Propose POSSIBLY_RELATED_TO between the selected node and DET-01', context: 'Selected record · POSSIBLY_RELATED_TO · DET-01. Not canon.' });
    } else if (/abercrave|valley|cribarth|swansea/.test(ql)) {
      var places = hits(function (n) { return /abercrave|swansea|cribarth/i.test(n.slug + n.title + (n.place || '')); });
      text = 'The valley is a neighbourhood, not a folder.';
      places.slice(0, 4).forEach(function (n) {
        ops.push({ kind: 'FOCUS', slug: n.slug, label: 'Show ' + n.title, context: slipCtx(n) });
      });
    } else {
      var found = hits(function (n) {
        return (n.title + ' ' + n.type + ' ' + (n.body || '') + ' ' + (n.place || '')).toLowerCase().indexOf(ql) >= 0;
      }).slice(0, 4);
      if (found.length) {
        text = found.length === 1 ? 'One record answers.' : found.length + ' records answer. None of this is canon because I said so — it already was.';
        found.forEach(function (n) {
          ops.push({ kind: 'FOCUS', slug: n.slug, label: 'Show ' + n.title, context: slipCtx(n) });
        });
      } else {
        text = 'I do not have that as a record. You may enter it with +, as a proposal. I will not invent it.';
        ops.push({ kind: 'CAPTURE', title: q, label: 'Propose this as UNKNOWN', context: q ? (q.length > 90 ? q.slice(0, 89) + '…' : q) : 'An unclassified entry. Not canon.' });
      }
    }
    return { text: text, ops: ops };
  }

  function renderOps(ops) {
    var box = $('jackOps');
    if (!box) return;
    box.innerHTML = '';
    ops.forEach(function (op) {
      var d = document.createElement('div');
      d.className = 'proposal';
      var p = document.createElement('p');
      p.textContent = op.label;
      d.appendChild(p);
      if (op.context) {
        var ctx = document.createElement('p');
        ctx.className = 'ctx';
        ctx.textContent = op.context;
        d.appendChild(ctx);
      }
      var row = document.createElement('div');
      row.className = 'row';
      d.appendChild(row);
      var acc = document.createElement('button');
      acc.type = 'button'; acc.textContent = 'Accept';
      var dis = document.createElement('button');
      dis.type = 'button'; dis.textContent = 'Dismiss';
      acc.addEventListener('click', function () {
        if (op.kind === 'FOCUS') showLife(bySlug(op.slug));
        else if (op.kind === 'OPEN' && op.href) location.href = op.href;
        else if (op.kind === 'PEEL') {
          if (state.selected) $('lifeWhy') && $('lifeWhy').click();
          else {
            var first = field[0]; if (first) { showLife(first); setTimeout(function () { $('lifeWhy') && $('lifeWhy').click(); }, 40); }
          }
        } else if (op.kind === 'CAPTURE') {
          openSheet('capture');
          var form = $('captureForm');
          var titleIn = form && form.querySelector('[name="title"]');
          if (titleIn && op.title) titleIn.value = op.title;
          var unk = form && form.querySelector('input[value="UNKNOWN"]');
          if (unk) unk.checked = true;
        } else if (op.kind === 'PROPOSE_EDGE') {
          var log = $('jackLog');
          var p = document.createElement('p');
          p.className = 'op';
          p.textContent = 'Noted as a proposal. It remains a proposal until a keeper writes it. I do not write canon.';
          log.appendChild(p);
        }
        d.remove();
      });
      dis.addEventListener('click', function () { d.remove(); });
      row.appendChild(acc); row.appendChild(dis);
      box.appendChild(d);
    });
  }

  if (window.TTG_JACK_DESK) {
    TTG_JACK_DESK.mount({
      renderOps: renderOps,
      onOp: function (op) {
        if (op.kind === 'FOCUS') showLife(bySlug(op.slug));
        else if (op.kind === 'OPEN' && op.href) location.href = op.href;
        else if (op.kind === 'PEEL') {
          if (state.selected) $('lifeWhy') && $('lifeWhy').click();
          else {
            var first = field[0];
            if (first) { showLife(first); setTimeout(function () { $('lifeWhy') && $('lifeWhy').click(); }, 40); }
          }
        } else if (op.kind === 'CAPTURE') {
          openSheet('capture');
          var form = $('captureForm');
          var titleIn = form && form.querySelector('[name="title"]');
          if (titleIn && op.title) titleIn.value = op.title;
          var unk = form && form.querySelector('input[value="UNKNOWN"]');
          if (unk) unk.checked = true;
        } else if (op.kind === 'PROPOSE_EDGE') {
          var note = document.createElement('p');
          note.className = 'op';
          note.textContent = 'Noted as a proposal. It remains a proposal until a keeper writes it. I do not write canon.';
          var log = $('jackLog');
          if (log) log.appendChild(note);
        }
      },
      onNodes: function (added) {
        added.forEach(function (node) {
          if (!node || !node.slug || bySlug(node.slug)) return;
          field.unshift(node);
          if (window.TTG_FIELD && TTG_FIELD.addNode) TTG_FIELD.addNode(node);
        });
      },
      onEdges: function (newEdges) {
        newEdges.forEach(function (edge) {
          if (!edge || !edge.source || !edge.target) return;
          edges.push(edge);
          if (window.TTG_FIELD && TTG_FIELD.addEdge) TTG_FIELD.addEdge(edge);
        });
      }
    });
  }
  renderOps(jackReply('').ops);

  /* ---------- capture ---------- */
  var speakBtn = $('speakBtn');
  if (speakBtn) {
    var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      speakBtn.hidden = true;
    } else {
      speakBtn.addEventListener('click', function () {
        var rec = new Rec();
        rec.lang = 'en-GB';
        rec.onresult = function (ev) {
          var t = ev.results[0][0].transcript;
          var ta = $('captureForm').body;
          ta.value = (ta.value ? ta.value + ' ' : '') + t;
        };
        rec.start();
      });
    }
  }
  var capForm = $('captureForm');
  if (capForm) {
    capForm.addEventListener('submit', function (e) {
      if (!window.fetch) return;
      e.preventDefault();
      var status = $('captureStatus');
      status.hidden = false;
      status.textContent = 'Holding…';
      var data = new FormData(capForm);
      fetch(capForm.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      }).then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          if (!r.j || !r.j.ok) {
            status.textContent = (r.j && r.j.error) || 'The field would not take it.';
            return;
          }
          var node = r.j.node;
          field.unshift(node);
          if (window.TTG_FIELD && TTG_FIELD.addNode) TTG_FIELD.addNode(node);
          capForm.reset();
          var unk = capForm.querySelector('input[value="UNKNOWN"]');
          if (unk) unk.checked = true;
          status.textContent = 'Held as pending. Not canon.';
          showLife(node);
        })
        .catch(function () { status.textContent = 'The field could not be reached.'; });
    });
  }

  /* ---------- WebGL field ---------- */
  function hasGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!window.THREE || !hasGL() || !field.length) {
    body.classList.add('nogl');
    if (MODE === 'boot') {
      try { location.replace('/now/tree'); } catch (e) {}
    }
    window.TTG_FIELD = {
      mode: MODE,
      focusSlug: function () {},
      setProjection: function () {},
      setPattern: function () {},
      tourOrder: function () {
        return field.slice().sort(function (a, b) {
          var dw = whenStamp(a) - whenStamp(b);
          if (dw) return dw;
          return String(a.slug || '').localeCompare(String(b.slug || ''));
        }).map(function (n) { return n.slug; });
      },
      nodeBySlug: bySlug,
      addNode: function () {},
      addEdge: function () {}
    };
    document.querySelectorAll('#fallbackList a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href') || '';
        var m = href.match(/\/n\/([A-Za-z0-9_-]+)/);
        if (m) {
          var n = bySlug(m[1]);
          if (n) { e.preventDefault(); showLife(n); }
        }
      });
    });
    return;
  }
  body.classList.add('hasgl');

  var TYPE_COL = {
    PERSON: 0x1e3a5f, OBJECT: 0xc9a227, PLACE: 0x2f5a3c, EVENT: 0xc41e3a, MOMENT: 0xc41e3a,
    INSTITUTION: 0x1e3a5f, MISSION: 0x2f5a3c, MEDIA: 0x8a7018, SIGNAL: 0xc41e3a,
    DOCUMENT: 0xc9a227, QUANTUM_TIN: 0xc9a227, FILM_FRAGMENT: 0x8a1428, UNKNOWN: 0x4a4458,
    MOONLY: 0x1e3a5f, PLAY: 0xc41e3a
  };
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var PAPER = 0xf1e4c4;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(PAPER, 1);
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  function toonRamp(stops) {
    var data = new Uint8Array(stops.length * 3);
    for (var i = 0; i < stops.length; i++) {
      data[i * 3] = stops[i][0]; data[i * 3 + 1] = stops[i][1]; data[i * 3 + 2] = stops[i][2];
    }
    var t = new THREE.DataTexture(data, stops.length, 1, THREE.RGBFormat);
    t.minFilter = THREE.NearestFilter;
    t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }
  var treeRamp = toonRamp([[92, 78, 52], [168, 148, 108], [216, 200, 164], [236, 224, 196]]);
  var nodeRamp = toonRamp([[40, 28, 28], [120, 50, 48], [200, 90, 70], [236, 210, 160]]);
  var outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a2438, side: THREE.BackSide });

  var world = new THREE.Group();
  scene.add(world);
  scene.add(new THREE.AmbientLight(0xf3ead4, 0.7));
  var key = new THREE.DirectionalLight(0xfff6e0, 0.85); key.position.set(5, 11, 8); scene.add(key);
  var fill = new THREE.DirectionalLight(0x1e3a5f, 0.18); fill.position.set(-7, 2, -6); scene.add(fill);
  var rim = new THREE.DirectionalLight(0xc41e3a, 0.12); rim.position.set(2, -6, 4); scene.add(rim);

  /* diagrammatic tree — faceted, toon, black outline (segment meshes; boot reveals them) */
  var UP = new THREE.Vector3(0, 1, 0), joints = [];
  var woodMat = new THREE.MeshToonMaterial({ color: 0xd4c6a0, gradientMap: treeRamp });
  var woodGroup = new THREE.Group();
  world.add(woodGroup);
  var woodSegs = [];
  function segment(a, b, r0, r1, depth) {
    var len = Math.max(0.01, a.distanceTo(b));
    var g = new THREE.CylinderGeometry(r1, r0, len, 5, 1, true);
    var mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    var q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3().subVectors(b, a).normalize());
    var fill = new THREE.Mesh(g, woodMat);
    fill.position.copy(mid);
    fill.quaternion.copy(q);
    var out = new THREE.Mesh(g, outlineMat);
    out.position.copy(mid);
    out.quaternion.copy(q);
    out.scale.setScalar(1.045);
    if (isBoot) {
      fill.visible = false;
      out.visible = false;
      fill.scale.setScalar(0.001);
      out.scale.set(0.001 * 1.045, 0.001 * 1.045, 0.001 * 1.045);
    }
    woodGroup.add(out);
    woodGroup.add(fill);
    woodSegs.push({
      fill: fill,
      out: out,
      depth: depth,
      mid: mid.clone(),
      i: woodSegs.length
    });
  }
  function grow(origin, dir, len, rad, depth, maxDepth, sign, rand, parent) {
    if (depth <= 0 || len < 0.4) return;
    var end = origin.clone().add(dir.clone().multiplyScalar(len));
    segment(origin, end, rad, rad * 0.7, depth);
    var me = joints.length;
    joints.push({ pos: end.clone(), sign: sign, parent: parent });
    var forks = depth > maxDepth - 2 ? 2 : (rand() < 0.4 ? 3 : 2);
    for (var i = 0; i < forks; i++) {
      var axis = new THREE.Vector3(rand() - 0.5, rand() * 0.12, rand() - 0.5).normalize();
      var spread = (0.32 + rand() * 0.38) * (depth > maxDepth - 2 ? 0.7 : 1);
      var nd = dir.clone().applyAxisAngle(axis, spread);
      nd.y = nd.y * 0.84 + sign * 0.28; nd.normalize();
      grow(end, nd, len * (0.66 + rand() * 0.12), rad * 0.64, depth - 1, maxDepth, sign, rand, me);
    }
  }
  var MAXD = innerWidth < 720 ? 5 : 6;
  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 6.2, 0.55, MAXD, MAXD, 1, rng(20330417), -1);
  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0), 5.0, 0.5, MAXD - 1, MAXD - 1, -1, rng(2008), -1);
  /* tips (low depth) first — disconnected sections — then parents that connect them */
  woodSegs.sort(function (a, b) {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.i - b.i;
  });
  woodSegs.forEach(function (s, i) {
    /* tips early, trunk late — long soft windows */
    s.t0 = 0.04 + (i / Math.max(1, woodSegs.length)) * 0.38;
    s.rise = 0.2;
  });

  var isParent = {};
  joints.forEach(function (n) { if (n.parent >= 0) isParent[n.parent] = 1; });
  var leaves = { 1: [], '-1': [] };
  joints.forEach(function (n, i) { if (!isParent[i]) leaves[n.sign].push(i); });
  var chainCache = {};
  function chain(leafIdx) {
    if (chainCache[leafIdx]) return chainCache[leafIdx];
    var pts = [], i = leafIdx;
    while (i >= 0) { pts.push(joints[i].pos); i = joints[i].parent; }
    pts.push(new THREE.Vector3(0, 0, 0)); pts.reverse();
    var cum = [0], total = 0;
    for (var k = 1; k < pts.length; k++) { total += pts[k].distanceTo(pts[k - 1]); cum.push(total); }
    var c = { pts: pts, cum: cum, total: total }; chainCache[leafIdx] = c; return c;
  }
  function pointAt(c, u) {
    var d = Math.max(0, Math.min(1, u)) * c.total, k = 1;
    while (k < c.cum.length - 1 && c.cum[k] < d) k++;
    var seg = c.cum[k] - c.cum[k - 1] || 1, f = (d - c.cum[k - 1]) / seg;
    return new THREE.Vector3().lerpVectors(c.pts[k - 1], c.pts[k], f);
  }

  var ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.055, 4, 32),
    new THREE.MeshToonMaterial({ color: 0xc41e3a, gradientMap: nodeRamp })
  );
  ring.rotation.x = Math.PI / 2;
  var ringOut = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.055, 4, 32),
    outlineMat
  );
  ringOut.rotation.x = Math.PI / 2;
  ringOut.scale.setScalar(1.08);
  world.add(ringOut);
  world.add(ring);
  if (isBoot) {
    ring.visible = false;
    ringOut.visible = false;
  }

  function hashStr(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }

  function yearToSignU(y) {
    y = Number(y) || PRESENT_YEAR;
    if (y < PRESENT_YEAR) {
      return { sign: -1, u: 0.14 + 0.78 * Math.min(1, (PRESENT_YEAR - y) / 90) };
    }
    if (y === PRESENT_YEAR) {
      return { sign: 1, u: 0.08 + hashStr('present-' + y) * 0.12 };
    }
    return { sign: 1, u: 0.18 + 0.74 * Math.min(1, (y - PRESENT_YEAR) / 16) };
  }
  function yearToY(y) {
    var su = yearToSignU(y);
    var reach = su.sign < 0 ? 6.4 : 8.6;
    return su.sign * su.u * reach;
  }

  var layoutCatalog = null;
  function makeCatalog() {
    return {
      place: rankedKeys(field, placeKey),
      house: rankedKeys(field, houseOf),
      type: rankedKeys(field, function (nd) { return String(nd.type || 'UNKNOWN').toUpperCase(); }),
      social: rankedKeys(field, function (nd) { return componentRoot(nd.slug) || nd.slug; })
    };
  }
  function meridian(rank, count, radius, y, slug) {
    var ang = (rank / Math.max(1, count)) * Math.PI * 2;
    var j = (hashStr(slug) - 0.5) * 0.34;
    return new THREE.Vector3(
      Math.cos(ang) * (radius + j),
      y,
      Math.sin(ang) * (radius + j)
    );
  }
  function layoutsFor(node, i, n) {
    if (!layoutCatalog) layoutCatalog = makeCatalog();
    var cat = layoutCatalog;
    var zone = node.zone || 'trunk';
    var y = yearOfDef(node);
    var su = yearToSignU(y);
    var sign = (y === PRESENT_YEAR && zone === 'root') ? -1 : su.sign;
    var pool = leaves[sign] && leaves[sign].length ? leaves[sign] : leaves[1];
    var leaf = pool[Math.floor(hashStr(componentRoot(node.slug) || node.slug) * pool.length) % pool.length];
    var c = chain(leaf);
    var u = su.u;
    if (zone === 'trunk' && y === PRESENT_YEAR) u = 0.08 + hashStr(node.slug) * 0.16;
    var temporal = pointAt(c, u);
    var radial = new THREE.Vector3(temporal.x, 0, temporal.z);
    var ang = hashStr(node.slug + 'a') * Math.PI * 2;
    if (radial.length() < 1.1) {
      temporal.x += Math.cos(ang) * (1.15 + hashStr(node.slug + 'r') * 0.9);
      temporal.z += Math.sin(ang) * (1.15 + hashStr(node.slug + 'r') * 0.9);
    } else {
      radial.normalize().multiplyScalar(0.45);
      temporal.add(radial);
    }

    var ty = yearToY(y);
    var pk = placeKey(node);
    var spatial = meridian(
      cat.place.rank[pk] || 0,
      cat.place.n,
      pk === 'unplaced' ? 3.55 : 2.15,
      ty,
      node.slug
    );

    var sk = componentRoot(node.slug) || node.slug;
    var remembered = Number(node.remembered_by) || 0;
    var socialR = node.type === 'PERSON' ? 1.5
      : (node.near_you ? 2.05 : 2.55 + Math.max(0, 1.8 - remembered * 0.4));
    var social = meridian(cat.social.rank[sk] || 0, cat.social.n, socialR, ty, node.slug);

    var hk = houseOf(node);
    var houseR = hk === 'DEPARTMENT' ? 1.85 : (hk === 'GUILD' ? 2.35 : (hk === 'PAPER' ? 2.85 : (hk === 'PENDING' ? 3.7 : 3.2)));
    var institutional = meridian(cat.house.rank[hk] || 0, cat.house.n, houseR, ty, node.slug);

    var tk = String(node.type || 'UNKNOWN').toUpperCase();
    var symbolic = meridian(
      cat.type.rank[tk] || 0,
      cat.type.n,
      node.pending ? 3.6 : 2.4,
      ty,
      node.slug
    );

    return { TEMPORAL: temporal, SOCIAL: social, SPATIAL: spatial, INSTITUTIONAL: institutional, SYMBOLIC: symbolic };
  }

  var nodeGeo = new THREE.IcosahedronGeometry(0.32, 0);
  var nodeOutGeo = new THREE.IcosahedronGeometry(0.32, 0);
  var typeMats = {};
  function matFor(hex) {
    var k = hex.getHex ? hex.getHex() : hex;
    if (!typeMats[k]) {
      typeMats[k] = new THREE.MeshToonMaterial({ color: k, gradientMap: nodeRamp });
    }
    return typeMats[k];
  }

  function makeLabel(text) {
    var c = document.createElement('canvas');
    c.width = 384;
    c.height = 64;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 384, 64);
    g.font = '600 22px "Barlow Condensed","Gill Sans",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var label = String(text || '').toUpperCase();
    if (label.length > 28) label = label.slice(0, 27) + '…';
    g.fillStyle = 'rgba(241,228,196,0.86)';
    var tw = Math.min(360, g.measureText(label).width + 22);
    g.fillRect(192 - tw / 2, 16, tw, 32);
    g.strokeStyle = '#1e3a5f';
    g.lineWidth = 2;
    g.strokeRect(192 - tw / 2, 16, tw, 32);
    g.fillStyle = '#1a2438';
    g.fillText(label, 192, 33);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false
    }));
    spr.scale.set(3.2, 0.54, 1);
    spr.position.y = 0.62;
    spr.visible = false;
    return spr;
  }

  function attachNode(node, lays) {
    var col = new THREE.Color(TYPE_COL[node.type] || 0xc9a227);
    var mesh = new THREE.Mesh(nodeGeo, matFor(col));
    var out = new THREE.Mesh(nodeOutGeo, outlineMat);
    out.scale.setScalar(1.16);
    mesh.add(out);
    var label = makeLabel(node.title);
    mesh.add(label);
    nodePts.add(mesh);
    if (node.play) mesh.scale.setScalar(0.62);
    if (isBoot) {
      mesh.visible = false;
      mesh.scale.setScalar(0.001);
    }
    return {
      def: node,
      lays: lays,
      pos: lays.TEMPORAL.clone(),
      target: lays.TEMPORAL.clone(),
      col: col,
      mesh: mesh,
      label: label,
      bootAmt: isBoot ? 0 : 1
    };
  }

  var CAP = 64;
  var nodePts = new THREE.Group();
  world.add(nodePts);

  var nodes = field.map(function (n, i) {
    return attachNode(n, layoutsFor(n, i, field.length));
  });

  var edgeMax = 120;
  var edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeMax * 2 * 3), 3));
  var edgeLine = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
    color: 0x1e3a5f, transparent: true, opacity: isBoot ? 0 : 0.28, depthWrite: false
  }));
  world.add(edgeLine);
  var pathMax = 96;
  var pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pathMax * 2 * 3), 3));
  var pathLine = new THREE.LineSegments(pathGeo, new THREE.LineBasicMaterial({
    color: 0xc41e3a, transparent: true, opacity: 0.92, depthWrite: false
  }));
  world.add(pathLine);
  if (isBoot) pathLine.visible = false;

  function neighborSet(slug) {
    var out = {};
    slug = String(slug || '');
    if (!slug) return out;
    edges.forEach(function (e) {
      if (e.source === slug) out[e.target] = e.relationship || 'related';
      if (e.target === slug) out[e.source] = e.relationship || 'related';
    });
    return out;
  }
  function patternMembers() {
    var rec = recurrenceRels();
    var keep = {};
    edges.forEach(function (e) {
      if (!rec[e.relationship]) return;
      keep[e.source] = true;
      keep[e.target] = true;
    });
    return keep;
  }

  function makeYearMark(text) {
    var c = document.createElement('canvas');
    c.width = 160;
    c.height = 48;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 160, 48);
    g.font = '600 22px "Barlow Condensed","Gill Sans",sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = '#c41e3a';
    g.fillText(String(text || ''), 4, 24);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.88
    }));
    spr.scale.set(1.7, 0.5, 1);
    return spr;
  }
  var yearMarks = new THREE.Group();
  world.add(yearMarks);
  function placeYearMarks() {
    while (yearMarks.children.length) yearMarks.remove(yearMarks.children[0]);
    yearsInField().forEach(function (y) {
      var spr = makeYearMark(String(y));
      spr.position.set(1.65, yearToY(y), 0.15);
      yearMarks.add(spr);
    });
  }
  placeYearMarks();
  if (isBoot) yearMarks.visible = false;

  var bootEdgeAmt = isBoot ? 0 : 1;
  var bootLabelPass = false;

  function recurrenceRels() {
    var c = {};
    edges.forEach(function (e) { c[e.relationship] = (c[e.relationship] || 0) + 1; });
    var keep = {};
    Object.keys(c).forEach(function (k) { if (c[k] >= 2) keep[k] = true; });
    return keep;
  }

  function writeNodes() {
    var i, n;
    var selected = state.selected;
    var nearSel = selected ? neighborSet(selected) : {};
    var inPattern = state.pattern ? patternMembers() : null;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (!n || !n.mesh) continue;
      n.mesh.position.copy(n.pos);
      var hot = selected && selected === n.def.slug;
      var linked = !!(selected && nearSel[n.def.slug]);
      var onLimb = !!(selected && componentRoot(n.def.slug) === componentRoot(selected));
      var patterned = !!(inPattern && inPattern[n.def.slug]);
      var dim = selected && !hot && !linked && !onLimb;
      if (state.pattern && !hot && !linked && !patterned) dim = true;
      var scale = hot ? 1.38 : (linked ? 1.2 : (onLimb || patterned ? 1.08 : (dim ? 0.62 : 1)));
      if (n.def.play && !hot) scale *= 0.72;
      if (isBoot) {
        var br = typeof n.bootAmt === 'number' ? n.bootAmt : 0;
        n.mesh.visible = br > 0.02;
        n.mesh.scale.setScalar(Math.max(0.001, scale * br));
        if (n.label) {
          var labelOn = br > 0.88 && bootLabelPass;
          n.label.visible = !!labelOn;
          n.label.material.opacity = labelOn ? Math.min(1, (br - 0.88) / 0.12) * 0.92 : 0;
        }
        continue;
      }
      n.mesh.scale.setScalar(scale);
      n.mesh.visible = true;
      if (n.label) {
        var camNear = camera && n.mesh.getWorldPosition(lookScene).distanceTo(camera.position) < (isView ? 14 : 11);
        n.label.visible = !!(hot || linked || n.hovered || (camNear && !dim));
        n.label.material.opacity = hot ? 1 : (linked ? 0.92 : (n.hovered ? 0.95 : 0.7));
      }
    }
  }

  function writeEdges(pattern) {
    var pa = edgeGeo.attributes.position.array;
    pa.fill(0);
    var idx = 0;
    var edgeCap = edges.length;
    if (isBoot) edgeCap = Math.floor(edges.length * bootEdgeAmt);
    edges.forEach(function (e, ei) {
      if (ei >= edgeCap) return;
      if (idx >= edgeMax) return;
      var a, b, i;
      for (i = 0; i < nodes.length; i++) {
        if (nodes[i].def.slug === e.source) a = nodes[i];
        if (nodes[i].def.slug === e.target) b = nodes[i];
      }
      if (!a || !b) return;
      if (isBoot && ((a.bootAmt || 0) < 0.35 || (b.bootAmt || 0) < 0.35)) return;
      pa[idx * 6] = a.pos.x; pa[idx * 6 + 1] = a.pos.y; pa[idx * 6 + 2] = a.pos.z;
      pa[idx * 6 + 3] = b.pos.x; pa[idx * 6 + 4] = b.pos.y; pa[idx * 6 + 5] = b.pos.z;
      idx++;
    });
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.setDrawRange(0, idx * 2);
    edgeLine.material.color.set(0x1e3a5f);
    var baseOp = pattern ? 0.14 : (isView ? 0.32 : 0.28);
    edgeLine.material.opacity = isBoot ? baseOp * bootEdgeAmt : baseOp;
  }
  function writePath() {
    if (isBoot) {
      pathGeo.setDrawRange(0, 0);
      pathLine.visible = false;
      return;
    }
    var pa = pathGeo.attributes.position.array;
    pa.fill(0);
    var idx = 0;
    var seen = {};
    function addSeg(a, b, key) {
      if (!a || !b || idx >= pathMax) return;
      key = key || (a.def.slug + '>' + b.def.slug);
      if (seen[key] || seen[b.def.slug + '>' + a.def.slug]) return;
      seen[key] = true;
      pa[idx * 6] = a.pos.x; pa[idx * 6 + 1] = a.pos.y; pa[idx * 6 + 2] = a.pos.z;
      pa[idx * 6 + 3] = b.pos.x; pa[idx * 6 + 4] = b.pos.y; pa[idx * 6 + 5] = b.pos.z;
      idx++;
    }
    function nodeOfSlug(slug) {
      var k;
      for (k = 0; k < nodes.length; k++) if (nodes[k].def.slug === slug) return nodes[k];
      return null;
    }
    var selected = state.selected;
    if (selected) {
      var near = neighborSet(selected);
      Object.keys(near).forEach(function (slug) {
        addSeg(nodeOfSlug(selected), nodeOfSlug(slug));
      });
      var limb = nodes.filter(function (n) {
        return componentRoot(n.def.slug) === componentRoot(selected);
      }).sort(function (a, b) { return whenStamp(a) - whenStamp(b); });
      var i;
      for (i = 1; i < limb.length; i++) addSeg(limb[i - 1], limb[i]);
    }
    if (state.pattern) {
      var rec = recurrenceRels();
      edges.forEach(function (e) {
        if (!rec[e.relationship]) return;
        addSeg(nodeOfSlug(e.source), nodeOfSlug(e.target), e.source + '~' + e.target);
      });
    }
    pathGeo.attributes.position.needsUpdate = true;
    pathGeo.setDrawRange(0, idx * 2);
    pathLine.visible = idx > 0;
    pathLine.material.opacity = state.pattern ? 0.95 : 0.88;
  }

  writeNodes(); writeEdges(false); writePath();

  /* ---------- boot: filmic incomplete → complete, then /now/tree without remount ---------- */
  var bootTape = null;
  var bootDur = reduce ? 0.9 : 12;
  var bootT0 = 0;
  var bootDone = false;
  var bootUi = 0;
  var bootCamReady = false;

  function easeOut(u) {
    u = Math.max(0, Math.min(1, u));
    return 1 - Math.pow(1 - u, 3);
  }
  function easeInOut(u) {
    u = Math.max(0, Math.min(1, u));
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  }
  function clamp01(u) { return Math.max(0, Math.min(1, u)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function revealWoodSeg(s, amt) {
    amt = clamp01(amt);
    var on = amt > 0.01;
    s.fill.visible = on;
    s.out.visible = on;
    var sc = Math.max(0.001, easeOut(amt));
    s.fill.scale.setScalar(sc);
    s.out.scale.set(sc * 1.045, sc * 1.045, sc * 1.045);
  }

  function assignBootSemantics() {
    var rec = recurrenceRels();
    var inPattern = {};
    edges.forEach(function (e) {
      if (!rec[e.relationship]) return;
      inPattern[e.source] = true;
      inPattern[e.target] = true;
    });
    var groups = {};
    nodes.forEach(function (n) {
      var r = componentRoot(n.def.slug) || n.def.slug;
      if (!groups[r]) groups[r] = [];
      groups[r].push(n);
    });
    var list = Object.keys(groups).map(function (r) {
      var members = groups[r];
      var hits = 0;
      var earliest = Infinity;
      members.forEach(function (n) {
        if (inPattern[n.def.slug]) hits++;
        var w = whenStamp(n);
        if (w && w < earliest) earliest = w;
      });
      if (earliest === Infinity) earliest = 0;
      return { root: r, members: members, hits: hits, earliest: earliest, n: members.length };
    });
    /* pattern-heavy limbs first, then larger neighbourhoods, then chronology */
    list.sort(function (a, b) {
      if (b.hits !== a.hits) return b.hits - a.hits;
      if (b.n !== a.n) return b.n - a.n;
      return a.earliest - b.earliest;
    });
    var wave = 0;
    var total = Math.max(1, nodes.length);
    list.forEach(function (g, gi) {
      g.members.sort(function (a, b) {
        var ap = inPattern[a.def.slug] ? 0 : 1;
        var bp = inPattern[b.def.slug] ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return whenStamp(a) - whenStamp(b);
      });
      var limbSpan = 0.055 + Math.min(0.12, g.members.length * 0.012);
      var limbStart = 0.46 + (wave / total) * 0.3;
      g.members.forEach(function (n, i) {
        var local = g.members.length <= 1 ? 0 : i / (g.members.length - 1);
        n.bootT0 = limbStart + local * limbSpan;
        n.bootRise = 0.32;
        n.bootPattern = !!inPattern[n.def.slug];
        n.bootLimb = gi;
      });
      wave += g.members.length;
    });
  }

  function finishBoot() {
    if (bootDone || !isBoot) return;
    bootDone = true;
    isBoot = false;
    MODE = 'now';
    bootEdgeAmt = 1;
    bootLabelPass = false;
    body.classList.remove('boot');
    body.style.removeProperty('--boot-ui');
    woodSegs.forEach(function (s) { revealWoodSeg(s, 1); });
    nodes.forEach(function (n) { n.bootAmt = 1; });
    ring.visible = true;
    ringOut.visible = true;
    yearMarks.visible = true;
    if (bootTape) {
      world.remove(bootTape);
      bootTape = null;
    }
    var skip = document.getElementById('bootSkip');
    if (skip && skip.parentNode) skip.parentNode.removeChild(skip);
    /* settle into the normal TEMPORAL stance */
    yaw = 0.45; pitch = 0.16; dist = 18;
    yawWant = 0.45; pitchWant = 0.16; distWant = 18;
    lookWant.set(0, 0.4, 0);
    viewEuler.set(0, 0, 0, 'XYZ');
    viewQWant.setFromEuler(viewEuler);
    world.quaternion.copy(viewQWant);
    idleYaw = true;
    viewSettle = 0;
    try { history.replaceState({ now: 1 }, '', '/now/tree'); } catch (e) {}
    homePath = '/now/tree';
    if (window.TTG_FIELD) TTG_FIELD.mode = 'now';
    writeNodes();
    writeEdges(state.pattern);
    writePath();
  }

  function bootCamera(u) {
    /* wide high orbit → descending spiral into TEMPORAL rest */
    var camU = easeInOut(clamp01((u - 0.01) / 0.94));
    var spiral = easeInOut(clamp01(u / 0.85));
    yaw = lerp(2.85, 0.45, spiral);
    pitch = lerp(1.28, 0.16, camU);
    dist = lerp(36, 18, easeInOut(clamp01((u + 0.05) / 0.95)));
    distWant = dist;
    yawWant = yaw;
    pitchWant = pitch;
    lookWant.set(
      Math.sin(spiral * Math.PI * 2) * 0.35 * (1 - camU),
      lerp(0.05, 0.4, camU),
      Math.cos(spiral * Math.PI * 2) * 0.25 * (1 - camU)
    );
    look.copy(lookWant);
    var tilt = 1 - easeInOut(clamp01((u - 0.15) / 0.7));
    viewEuler.set(0.22 * tilt, 0.55 * tilt, 0.08 * tilt, 'XYZ');
    viewQWant.setFromEuler(viewEuler);
    world.quaternion.slerp(viewQWant, reduce ? 1 : 0.08);
  }

  function tickBoot(nowMs) {
    if (!isBoot || bootDone) return;
    if (!bootT0) {
      bootT0 = nowMs;
      bootCamera(0);
      bootCamReady = true;
    }
    var u = clamp01((nowMs - bootT0) / (bootDur * 1000));
    bootCamera(u);

    woodSegs.forEach(function (s) {
      revealWoodSeg(s, clamp01((u - s.t0) / (s.rise || 0.2)));
    });

    if (u > 0.22) {
      ring.visible = true;
      ringOut.visible = true;
      var ringAmt = easeOut(clamp01((u - 0.22) / 0.25));
      ring.scale.setScalar(0.55 + 0.45 * ringAmt);
      ringOut.scale.setScalar((0.55 + 0.45 * ringAmt) * 1.08);
    }

    /* soft archive slips — hold, breathe, yield to fruit */
    if (bootTape) {
      bootTape.children.forEach(function (spr) {
        var t0 = spr.userData.t0 || 0.2;
        var hold = spr.userData.hold || 0.55;
        var local = easeOut(clamp01((u - t0) / 0.18));
        var fade = u > t0 + hold ? easeOut(clamp01(1 - (u - t0 - hold) / 0.22)) : 1;
        var show = local > 0.02 && fade > 0.04 && u < 0.72;
        spr.visible = show;
        spr.material.opacity = show ? local * fade * 0.92 : 0;
        var sc = 3.2 + local * 0.55;
        spr.scale.set(sc, sc * 0.17, 1);
      });
    }

    bootEdgeAmt = easeInOut(clamp01((u - 0.4) / 0.28));
    nodes.forEach(function (n) {
      var t0 = typeof n.bootT0 === 'number' ? n.bootT0 : 0.5;
      var rise = n.bootRise || 0.32;
      n.bootAmt = easeOut(clamp01((u - t0) / rise));
    });
    /* labels stay once a bead is mostly formed — no on/off flicker */
    bootLabelPass = u > 0.68;
    if (u > 0.78) yearMarks.visible = true;
    bootUi = easeInOut(clamp01((u - 0.78) / 0.16));
    body.style.setProperty('--boot-ui', String(bootUi));

    if (u >= 1) finishBoot();
  }

  if (isBoot) {
    assignBootSemantics();
    bootTape = new THREE.Group();
    world.add(bootTape);
    nodes.slice().sort(function (a, b) {
      return (a.bootT0 || 0) - (b.bootT0 || 0);
    }).slice(0, 16).forEach(function (n, i) {
      var spr = makeLabel(n.def.title || n.def.slug);
      spr.visible = false;
      spr.material.depthTest = false;
      spr.material.opacity = 0;
      var lay = n.lays.TEMPORAL;
      spr.position.set(lay.x, lay.y + 1.05, lay.z);
      spr.scale.set(3.4, 0.57, 1);
      spr.userData.t0 = 0.14 + i * 0.028;
      spr.userData.hold = n.bootPattern ? 0.62 : 0.48;
      bootTape.add(spr);
    });
    var skip = document.createElement('p');
    skip.id = 'bootSkip';
    skip.innerHTML = '<button type="button">Skip</button>';
    document.body.appendChild(skip);
    function skipBoot(e) {
      if (e) e.preventDefault();
      finishBoot();
    }
    skip.querySelector('button').addEventListener('click', skipBoot);
    addEventListener('keydown', function (e) {
      if (!isBoot) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') skipBoot(e);
    });
  }

  var VIEWS = {
    TEMPORAL: {
      rx: 0, ry: 0, rz: 0,
      yaw: 0.45, pitch: 0.16, dist: 18,
      idle: true,
      hint: 'Elevation · time upright · drag climbs the wood'
    },
    SPATIAL: {
      rx: 0, ry: 0, rz: 0,
      yaw: 0.02, pitch: 1.48, dist: 16,
      idle: false,
      hint: 'Plan · places as meridians · drag climbs time'
    },
    SOCIAL: {
      rx: -Math.PI / 2, ry: 0, rz: 0,
      yaw: 0, pitch: 0.02, dist: 14,
      idle: true,
      hint: 'Along the bore · neighbourhoods around the ring'
    },
    INSTITUTIONAL: {
      rx: 0, ry: 0, rz: -Math.PI / 2,
      yaw: 0.18, pitch: 0.12, dist: 20,
      idle: false,
      hint: 'Section · houses along the cut'
    },
    SYMBOLIC: {
      rx: 0.32, ry: 0.55, rz: 0.08,
      yaw: 0.72, pitch: 0.42, dist: 21,
      idle: true,
      hint: 'Oblique · types as meridians'
    }
  };
  var yaw = 0.45, pitch = 0.16, dist = 18, distWant = 18, yawV = 0, pitchV = 0;
  var yawWant = 0.45, pitchWant = 0.16, viewSettle = 0, idleYaw = true;
  var look = new THREE.Vector3(0, 0.4, 0);
  var lookWant = look.clone();
  var lookScene = new THREE.Vector3();
  var viewEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  var viewQWant = new THREE.Quaternion();
  if (isBoot) {
    yaw = 2.85; pitch = 1.28; dist = 36; distWant = 36;
    yawWant = yaw; pitchWant = pitch;
    look.set(0, 0.05, 0); lookWant.copy(look);
    viewEuler.set(0.22, 0.55, 0.08, 'XYZ');
    viewQWant.setFromEuler(viewEuler);
    world.quaternion.copy(viewQWant);
    idleYaw = false;
  }
  var pointers = {};
  var pinch0 = 0;
  var moved = 0;
  var el = renderer.domElement;
  var keys = {};
  var playheadYear = 2026;

  function applyView(name) {
    var v = VIEWS[name] || VIEWS.TEMPORAL;
    viewEuler.set(v.rx, v.ry, v.rz, 'XYZ');
    viewQWant.setFromEuler(viewEuler);
    yawWant = v.yaw;
    pitchWant = v.pitch;
    distWant = v.dist;
    yawV = 0;
    pitchV = 0;
    idleYaw = isView ? true : !!v.idle;
    viewSettle = reduce ? 0 : (isView ? 2.4 : 1.35);
    lookWant.x = 0;
    lookWant.z = 0;
    if (reduce) {
      yaw = v.yaw;
      pitch = v.pitch;
      world.quaternion.copy(viewQWant);
    }
    var hint = $('navHint');
    if (hint) hint.textContent = v.hint;
  }

  function pointerCount() {
    return Object.keys(pointers).length;
  }
  function pointerPair() {
    var ids = Object.keys(pointers);
    if (ids.length < 2) return null;
    return [pointers[ids[0]], pointers[ids[1]]];
  }
  function place() {
    look.lerp(lookWant, reduce ? 1 : (isView ? 0.055 : 0.1));
    dist += (distWant - dist) * (reduce ? 1 : (isView ? 0.07 : 0.12));
    pitch = Math.max(-1.2, Math.min(1.54, pitch));
    dist = Math.max(5, Math.min(56, dist));
    distWant = Math.max(5, Math.min(56, distWant));
    lookScene.copy(look).applyQuaternion(world.quaternion);
    var cy = Math.cos(pitch), sy = Math.sin(pitch);
    camera.position.set(
      lookScene.x + Math.sin(yaw) * dist * cy,
      lookScene.y + sy * dist,
      lookScene.z + Math.cos(yaw) * dist * cy
    );
    camera.lookAt(lookScene);
  }
  function yearOf(n) {
    return yearOfDef(n && n.def ? n.def : n);
  }
  function limbCaption(node) {
    var limb = limbOf(node.slug);
    var idx = -1, i;
    for (i = 0; i < limb.length; i++) if (limb[i].slug === node.slug) idx = i;
    var note = yearNote(yearOfDef(node));
    if (limb.length > 1 && idx >= 0) return note + ' · ' + (idx + 1) + '/' + limb.length;
    return note;
  }
  function yearNote(y) {
    if (y < 2026) return 'ROOTS';
    if (y === 2026) return 'LOCAL PRESENT';
    if (y >= 2033) return 'NETWORK PRESENT';
    return 'BRANCH';
  }
  function nearestIndex() {
    var best = 0, bd = 1e9, i, d;
    for (i = 0; i < nodes.length; i++) {
      d = nodes[i].pos.distanceToSquared(look);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function paintYear(y, extra) {
    playheadYear = y;
    var num = $('surfYearNum');
    var note = $('surfYearNote');
    if (num) num.textContent = String(y);
    if (note) note.textContent = extra || yearNote(y);
    paintChrono(y);
  }
  function flyTo(n, open) {
    if (!n) return;
    var v = VIEWS[state.projection] || VIEWS.TEMPORAL;
    lookWant.copy(n.pos);
    distWant = Math.max(7, Math.min(v.dist + 2, n.pos.length() * 0.4 + 9));
    if (state.projection === 'TEMPORAL' || state.projection === 'SYMBOLIC' || isView) {
      yawWant = Math.atan2(n.pos.x, n.pos.z);
      if (!isView) yaw += (yawWant - yaw) * 0.55;
      else viewSettle = Math.max(viewSettle, reduce ? 0 : 1.6);
    }
    pitchWant = pitchWant + (v.pitch - pitchWant) * 0.35;
    if (!isView) pitch += (v.pitch - pitch) * 0.4;
    paintYear(yearOf(n), limbCaption(n.def));
    if (isView) {
      state.selected = n.def.slug;
      if (typeof window.TTG_VIEW_ON_FOCUS === 'function') window.TTG_VIEW_ON_FOCUS(n.def);
      return;
    }
    if (open !== false) showLife(n.def);
  }
  function sortedByWhen() {
    return nodes.slice().sort(function (a, b) {
      var dw = whenStamp(a) - whenStamp(b);
      if (dw) return dw;
      return String(a.def.title || '').localeCompare(String(b.def.title || ''));
    });
  }
  function surfYear(dir) {
    var list = sortedByWhen();
    if (!list.length) return;
    var i, idx = -1;
    if (state.selected) {
      for (i = 0; i < list.length; i++) {
        if (list[i].def.slug === state.selected) { idx = i; break; }
      }
    }
    if (idx < 0) {
      for (i = 0; i < list.length; i++) {
        if (yearOf(list[i]) >= playheadYear) { idx = i; break; }
      }
      if (idx < 0) idx = list.length - 1;
    }
    var pick = list[idx + dir];
    if (!pick) pick = dir > 0 ? list[list.length - 1] : list[0];
    flyTo(pick, true);
  }
  function typing() {
    var t = document.activeElement;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }
  function woodBounds() {
    var lo = -6.4, hi = 8.6, i;
    for (i = 0; i < nodes.length; i++) {
      lo = Math.min(lo, nodes[i].pos.y);
      hi = Math.max(hi, nodes[i].pos.y);
    }
    return { lo: lo - 1.4, hi: hi + 1.4 };
  }
  function clampLookY(y) {
    var b = woodBounds();
    return Math.max(b.lo, Math.min(b.hi, y));
  }
  function climbWood(dyAlong) {
    lookWant.y = clampLookY(lookWant.y + dyAlong);
    pitchV = 0;
  }
  function panLook(dx, dy) {
    var right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    var up = new THREE.Vector3(0, 1, 0);
    lookWant.addScaledVector(right, -dx * dist * 0.0024);
    lookWant.addScaledVector(up, dy * dist * 0.0022);
    lookWant.y = clampLookY(lookWant.y);
  }
  function scrubChrono(clientY) {
    var rail = $('chrono');
    if (!rail) return;
    var box = rail.getBoundingClientRect();
    var t = 1 - (clientY - box.top) / Math.max(1, box.height);
    var b = woodBounds();
    lookWant.y = clampLookY(b.lo + t * (b.hi - b.lo));
  }

  el.addEventListener('pointerdown', function (e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    moved = 0;
    yawV = 0;
    pitchV = 0;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    el.classList.add('dragging');
    var pair = pointerPair();
    if (pair) {
      var ax = pair[0].x - pair[1].x, ay = pair[0].y - pair[1].y;
      pinch0 = Math.hypot(ax, ay) || 1;
    }
  });
  el.addEventListener('pointermove', function (e) {
    var prev = pointers[e.pointerId];
    if (!prev) { hover(e.clientX, e.clientY); return; }
    var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var pair = pointerPair();
    if (pair) {
      var ax = pair[0].x - pair[1].x, ay = pair[0].y - pair[1].y;
      var pin = Math.hypot(ax, ay) || 1;
      if (pinch0) distWant = Math.max(5, Math.min(56, distWant * (pinch0 / pin)));
      pinch0 = pin;
      panLook(dx, dy);
      moved += 12;
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    if (e.shiftKey || e.buttons === 4 || e.altKey) {
      panLook(dx, dy);
    } else {
      yaw -= dx * 0.0055;
      yawV = -dx * 0.00055;
      climbWood(-dy * Math.max(0.014, dist * 0.0026));
    }
  });
  function endPointer(e) {
    var was = !!pointers[e.pointerId];
    delete pointers[e.pointerId];
    if (pointerCount() === 0) {
      el.classList.remove('dragging');
      if (was && moved < 7) pick(e.clientX, e.clientY);
    }
    pinch0 = 0;
  }
  el.addEventListener('pointerup', endPointer);
  el.addEventListener('pointercancel', endPointer);
  addEventListener('wheel', function (e) {
    if (!body.classList.contains('hasgl')) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      distWant = Math.max(5, Math.min(56, distWant + e.deltaY * 0.018));
    } else {
      climbWood(-e.deltaY * 0.014);
    }
  }, { passive: false });

  addEventListener('keydown', function (e) {
    if (typing()) return;
    keys[e.key] = true;
    if (e.key === 'ArrowLeft' || e.key === '[') { e.preventDefault(); surfYear(-1); }
    if (e.key === 'ArrowRight' || e.key === ']') { e.preventDefault(); surfYear(1); }
    if (e.key === ',' || e.key === '<') { e.preventDefault(); walkLimb(-1); }
    if (e.key === '.' || e.key === '>') { e.preventDefault(); walkLimb(1); }
    if (e.key === 'Home') {
      e.preventDefault();
      applyView(state.projection);
      lookWant.set(0, 0.4, 0);
      paintYear(2026);
    }
  });
  addEventListener('keyup', function (e) { keys[e.key] = false; });

  $('surfPast') && $('surfPast').addEventListener('click', function () { surfYear(-1); });
  $('surfFuture') && $('surfFuture').addEventListener('click', function () { surfYear(1); });

  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitIndex(cx, cy) {
    ndc.x = (cx / innerWidth) * 2 - 1; ndc.y = -(cy / innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    var h = ray.intersectObjects(nodePts.children, false);
    if (!h.length) return -1;
    var mesh = h[0].object;
    for (var i = 0; i < nodes.length; i++) if (nodes[i].mesh === mesh) return i;
    return -1;
  }
  function hover(cx, cy) {
    var i = hitIndex(cx, cy);
    nodes.forEach(function (n) { n.hovered = false; });
    if (i >= 0) {
      nodes[i].hovered = true;
      el.classList.add('overpoint');
    } else el.classList.remove('overpoint');
  }
  function pick(cx, cy) {
    if (isBoot) { finishBoot(); return; }
    var i = hitIndex(cx, cy);
    if (i < 0) {
      if (isView && typeof window.TTG_VIEW_ON_MISS === 'function') window.TTG_VIEW_ON_MISS();
      hideLife(); writeNodes(); writeEdges(state.pattern); writePath();
      return;
    }
    flyTo(nodes[i], true);
    if (isView && typeof window.TTG_VIEW_ON_PICK === 'function') {
      window.TTG_VIEW_ON_PICK(nodes[i].def);
    }
    writeNodes(); writeEdges(state.pattern); writePath();
  }

  window.TTG_FIELD = {
    mode: MODE,
    focusSlug: function (slug) {
      state.selected = slug;
      if (slug) {
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].def.slug === slug) {
            flyTo(nodes[i], false);
            break;
          }
        }
      }
      writeNodes(); writeEdges(state.pattern); writePath();
    },
    setProjection: function (name, pattern) {
      state.projection = name;
      state.pattern = !!pattern;
      applyView(name);
      if (isView) idleYaw = true;
      nodes.forEach(function (n) {
        var t = n.lays[name] || n.lays.TEMPORAL;
        n.target.copy(t);
      });
      writeEdges(state.pattern);
      writePath();
      document.querySelectorAll('#projections [data-proj]').forEach(function (b) {
        b.setAttribute('aria-selected', b.getAttribute('data-proj') === name ? 'true' : 'false');
      });
    },
    setPattern: function (on) {
      state.pattern = !!on;
      writeEdges(state.pattern);
      writePath();
    },
    tourOrder: function () {
      var roots = {};
      field.forEach(function (n) {
        var r = componentRoot(n.slug);
        if (!roots[r]) roots[r] = [];
        roots[r].push(n);
      });
      var rootKeys = Object.keys(roots).sort();
      var out = [];
      rootKeys.forEach(function (r) {
        roots[r].sort(function (a, b) {
          var dw = whenStamp(a) - whenStamp(b);
          if (dw) return dw;
          return String(a.slug || '').localeCompare(String(b.slug || ''));
        });
        roots[r].forEach(function (n) { out.push(n.slug); });
      });
      return out;
    },
    nodeBySlug: function (slug) {
      return bySlug(slug);
    },
    addNode: function (node) {
      layoutCatalog = null;
      var lays = layoutsFor(node, nodes.length, nodes.length + 1);
      var row = attachNode(node, lays);
      row.pos.copy(lays[state.projection] || lays.TEMPORAL);
      row.target.copy(row.pos);
      nodes.unshift(row);
      if (nodes.length > CAP) {
        var dropAt = nodes.length - 1, d;
        for (d = nodes.length - 1; d >= 0; d--) {
          if (nodes[d].def.slug !== state.selected) { dropAt = d; break; }
        }
        var drop = nodes.splice(dropAt, 1)[0];
        if (drop && drop.mesh) nodePts.remove(drop.mesh);
        if (drop && drop.def && drop.def.slug) {
          field = field.filter(function (n) { return n.slug !== drop.def.slug; });
        }
      }
      writeNodes(); writeEdges(state.pattern); writePath();
    },
    addEdge: function (edge) {
      if (!edge || !edge.source || !edge.target) return;
      if (hasEdge(edge)) return;
      edges.push(edge);
      forgetComponents();
      writeEdges(state.pattern);
      writePath();
    },
    pose: function () {
      return {
        projection: state.projection,
        yaw: yaw,
        pitch: pitch,
        dist: dist,
        qx: world.quaternion.x,
        qy: world.quaternion.y,
        qz: world.quaternion.z,
        qw: world.quaternion.w,
        cam: [camera.position.x, camera.position.y, camera.position.z]
      };
    },
    relayout: function () {
      forgetComponents();
      layoutCatalog = null;
      nodes.forEach(function (n, i) {
        n.lays = layoutsFor(n.def, i, nodes.length);
        var t = n.lays[state.projection] || n.lays.TEMPORAL;
        n.target.copy(t);
      });
      placeYearMarks();
      writeEdges(state.pattern);
      writePath();
    }
  };

  var t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var t = (now - t0) / 1000;
    if (isBoot) {
      tickBoot(now);
    } else if (pointerCount() === 0 && !reduce) {
      if (viewSettle > 0) {
        viewSettle -= isView ? 0.01 : 0.016;
        yaw += (yawWant - yaw) * (isView ? 0.06 : 0.12);
        pitch += (pitchWant - pitch) * (isView ? 0.06 : 0.12);
        yawV = 0;
        pitchV = 0;
      } else {
        yaw += yawV;
        pitch += pitchV;
        yawV *= 0.94;
        pitchV *= 0.9;
        if (idleYaw && !keys.w && !keys.W && !keys.s && !keys.S && !keys.a && !keys.A && !keys.d && !keys.D) {
          yaw += isView ? 0.00072 : 0.00018;
        }
      }
    }
    if (!isBoot) {
      world.quaternion.slerp(viewQWant, reduce ? 1 : (isView ? 0.07 : 0.14));
    }
    if (!typing() && !isBoot) {
      var spd = 0.085 * (dist / 16);
      if (keys.w || keys.W) {
        lookWant.x -= Math.sin(yaw) * spd;
        lookWant.z -= Math.cos(yaw) * spd;
      }
      if (keys.s || keys.S) {
        lookWant.x += Math.sin(yaw) * spd;
        lookWant.z += Math.cos(yaw) * spd;
      }
      if (keys.a || keys.A) {
        lookWant.x -= Math.cos(yaw) * spd;
        lookWant.z += Math.sin(yaw) * spd;
      }
      if (keys.d || keys.D) {
        lookWant.x += Math.cos(yaw) * spd;
        lookWant.z -= Math.sin(yaw) * spd;
      }
      if (keys.ArrowUp) climbWood(spd);
      if (keys.ArrowDown) climbWood(-spd);
    }
    nodes.forEach(function (n) {
      n.pos.lerp(n.target, reduce ? 1 : (isView ? 0.035 : 0.06));
    });
    var selN = null, si, riding = pointerCount() > 0 || keys.ArrowUp || keys.ArrowDown;
    if (state.selected) {
      for (si = 0; si < nodes.length; si++) {
        if (nodes[si].def.slug === state.selected) { selN = nodes[si]; break; }
      }
    }
    if (selN && !riding && look.distanceTo(selN.pos) < 3.2) {
      paintYear(yearOf(selN), limbCaption(selN.def));
    } else {
      var near = nodes[nearestIndex()];
      if (near) paintYear(yearOf(near));
    }
    writeNodes();
    writeEdges(state.pattern);
    writePath();
    if (!reduce) {
      ring.rotation.z = t * (isBoot ? 0.08 : 0.04);
    }
    place();
    var Spr = window.Jack && window.Jack.Sprite;
    if (Spr && Spr.tick) {
      var jackOpen = $('jack') && $('jack').classList.contains('open');
      Spr.tick(t, {
        context: { phase: jackOpen ? 'VOICE' : 'FIELD' },
        body: { pressure: jackOpen ? 0.35 : 0.1 }
      });
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();
