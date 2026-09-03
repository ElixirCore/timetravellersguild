/* NOW — the field. Graph is the database; WebGL is optional. */
(function () {
  var G = window.TTG_GRAPH || { field: [], edges: [], projections: [], you: {}, jack: {} };
  var field = Array.isArray(G.field) ? G.field.slice() : [];
  var edges = Array.isArray(G.edges) ? G.edges.slice() : [];
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  body.classList.add('js');

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

  var homePath = (location.pathname === '/now' || location.pathname === '/now/') ? '/now' : '/';
  var state = {
    projection: 'TEMPORAL',
    selected: null,
    pattern: false
  };

  function bySlug(slug) {
    for (var i = 0; i < field.length; i++) if (field[i].slug === slug) return field[i];
    return null;
  }

  function typeLabel(t) {
    return String(t || 'UNKNOWN').replace(/_/g, ' ');
  }

  /* ---------- sheets ---------- */
  function closeSheets() {
    ['life', 'jack', 'capture'].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.classList.remove('open');
      if (id === 'life') el.hidden = true;
    });
    if (location.hash === '#jack' || location.hash === '#capture') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  function openSheet(id) {
    closeSheets();
    var el = $(id); if (!el) return;
    el.hidden = false;
    el.classList.add('open');
  }
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', closeSheets);
  });
  $('jackMark') && $('jackMark').addEventListener('click', function (e) { e.preventDefault(); openSheet('jack'); });
  $('navPlus') && $('navPlus').addEventListener('click', function (e) {
    e.preventDefault(); openSheet('capture');
  });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSheets(); hideLife(); }
  });
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
    state.selected = node.slug;
    $('lifeType').textContent = typeLabel(node.type);
    $('lifeTitle').textContent = node.title || '';
    $('lifeStatus').textContent = node.status || '';
    var facts = $('lifeFacts');
    facts.innerHTML = '';
    facts.appendChild(fact('Last observed:', node.place || 'unplaced'));
    facts.appendChild(fact('Custodian:', node.custodian || 'undisclosed'));
    var m = node.moments || 0;
    facts.appendChild(fact('', m + ' associated moment' + (m === 1 ? '' : 's')));
    var u = node.unresolved || 0;
    facts.appendChild(fact('', u + ' unresolved relationship' + (u === 1 ? '' : 's')));
    if (node.opening) facts.appendChild(fact('', node.opening));
    if (node.pending) facts.appendChild(fact('', 'PENDING — not yet canon.'));
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
    openSheet('life');
    if (window.TTG_FIELD && TTG_FIELD.focusSlug) TTG_FIELD.focusSlug(node.slug);
    if (fromPop !== true && node.slug) {
      var path = '/n/' + encodeURIComponent(node.slug) + '/';
      if (location.pathname !== path) history.pushState({ now: 1, slug: node.slug }, '', path);
    }
  }
  function hideLife(fromPop) {
    state.selected = null;
    var life = $('life');
    if (life) { life.classList.remove('open'); life.hidden = true; }
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
          var n = bySlug(e.slug);
          if (n) showLife(n);
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
    if (name === 'SPATIAL') items.sort(function (a, b) { return String(a.place).localeCompare(String(b.place)); });
    else if (name === 'SOCIAL') items.sort(function (a, b) { return (b.remembered_by + (b.near_you ? 5 : 0) + (a.type === 'PERSON' ? 2 : 0)) - (a.remembered_by + (a.near_you ? 5 : 0) + (b.type === 'PERSON' ? 2 : 0)); });
    else if (name === 'INSTITUTIONAL') items.sort(function (a, b) {
      function w(n) { return /INSTITUTION|DOCUMENT|MISSION/.test(n.type) || /det|department|guild/.test(n.slug) ? 0 : 1; }
      return w(a) - w(b);
    });
    else if (name === 'SYMBOLIC') items.sort(function (a, b) { return String(a.type).localeCompare(String(b.type)); });
    else items.sort(function (a, b) {
      var z = { root: 0, trunk: 1, leaf: 2, branch: 3, fruit: 4 };
      return (z[a.zone] || 1) - (z[b.zone] || 1);
    });
    /* keep SSR grouping for TEMPORAL; only restack for other projections */
    if (name === 'TEMPORAL') return;
    ul.innerHTML = '';
    var last = '';
    items.forEach(function (n) {
      var head = name === 'SPATIAL' ? (n.place || 'unplaced') : (name === 'SYMBOLIC' ? typeLabel(n.type) : '');
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
    if (/why|seeing this|mabel|pattern|oracle/.test(ql)) {
      text = 'That question belongs to Mabel. I can only point at evidence. Accept the peel, or dismiss it.';
      ops.push({ kind: 'PEEL', label: 'Peel the selected life to evidence, then ask Mabel for pattern.' });
    } else if (/department|det-?01|excess/.test(ql)) {
      var det = bySlug('det-01') || bySlug('department') || bySlug('det-response');
      text = 'The Department is a node in the field, not a menu. I can take you to the notice, or across the door.';
      if (det) ops.push({ kind: 'FOCUS', slug: det.slug, label: 'Show ' + det.title });
      ops.push({ kind: 'OPEN', href: '/department/', label: 'Cross into the Department' });
    } else if (/tin|sealed|quantum/.test(ql)) {
      var tin = bySlug('quantum-tin-013');
      text = 'Quantum Tin №013 is sealed. Contents are not claimed. Opening condition is not satisfied.';
      if (tin) ops.push({ kind: 'FOCUS', slug: tin.slug, label: 'Show Quantum Tin №013' });
    } else if (/entered|new|pending|unclassified/.test(ql)) {
      var rec = hits(function (n) { return n.pending || /PENDING|UNKNOWN/.test(n.status || n.type || ''); });
      text = rec.length ? (rec.length + ' still sit as unclassified or pending.') : 'Nothing pending in this window.';
      rec.slice(0, 3).forEach(function (n) {
        ops.push({ kind: 'FOCUS', slug: n.slug, label: 'Show ' + n.title });
      });
    } else if (/link|connect|edge|relate/.test(ql)) {
      text = 'I can propose a relation. A keeper must accept it before it is canon.';
      ops.push({ kind: 'PROPOSE_EDGE', label: 'Propose POSSIBLY_RELATED_TO between the selected node and DET-01' });
    } else if (/abercrave|valley|cribarth|swansea/.test(ql)) {
      var places = hits(function (n) { return /abercrave|swansea|cribarth/i.test(n.slug + n.title + (n.place || '')); });
      text = 'The valley is a neighbourhood, not a folder.';
      places.slice(0, 4).forEach(function (n) {
        ops.push({ kind: 'FOCUS', slug: n.slug, label: 'Show ' + n.title });
      });
    } else {
      var found = hits(function (n) {
        return (n.title + ' ' + n.type + ' ' + (n.body || '') + ' ' + (n.place || '')).toLowerCase().indexOf(ql) >= 0;
      }).slice(0, 4);
      if (found.length) {
        text = found.length === 1 ? 'One record answers.' : found.length + ' records answer. None of this is canon because I said so — it already was.';
        found.forEach(function (n) {
          ops.push({ kind: 'FOCUS', slug: n.slug, label: 'Show ' + n.title });
        });
      } else {
        text = 'I do not have that as a record. You may enter it with +, as a proposal. I will not invent it.';
        ops.push({ kind: 'CAPTURE', title: q, label: 'Propose this as UNKNOWN' });
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
      var row = document.createElement('div');
      row.className = 'row';
      d.appendChild(p);
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
    window.TTG_FIELD = { focusSlug: function () {}, setProjection: function () {}, addNode: function () {}, addEdge: function () {} };
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
    MOONLY: 0x1e3a5f
  };
  var ZONE_Y = { root: -1, trunk: 0, branch: 1, leaf: 0.55, fruit: 1.15 };

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

  /* diagrammatic tree — faceted, toon, black outline */
  var UP = new THREE.Vector3(0, 1, 0), chunks = [], joints = [];
  function segment(a, b, r0, r1) {
    var g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), 5, 1, true);
    var q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3().subVectors(b, a).normalize());
    var mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    chunks.push(g.toNonIndexed());
  }
  function grow(origin, dir, len, rad, depth, maxDepth, sign, rand, parent) {
    if (depth <= 0 || len < 0.4) return;
    var end = origin.clone().add(dir.clone().multiplyScalar(len));
    segment(origin, end, rad, rad * 0.7);
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
  (function merge() {
    var count = 0, i;
    for (i = 0; i < chunks.length; i++) count += chunks[i].attributes.position.count;
    var pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), off = 0;
    for (i = 0; i < chunks.length; i++) {
      pos.set(chunks[i].attributes.position.array, off * 3);
      nrm.set(chunks[i].attributes.normal.array, off * 3);
      off += chunks[i].attributes.position.count; chunks[i].dispose();
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.computeVertexNormals();
    var treeOut = new THREE.Mesh(geo, outlineMat);
    treeOut.scale.setScalar(1.045);
    world.add(treeOut);
    world.add(new THREE.Mesh(geo, new THREE.MeshToonMaterial({
      color: 0xd4c6a0,
      gradientMap: treeRamp
    })));
    chunks.length = 0;
  })();

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

  function hashStr(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }

  function layoutsFor(node, i, n) {
    var zone = node.zone || 'trunk';
    var sign = (zone === 'root') ? -1 : 1;
    var pool = leaves[sign];
    var leaf = pool[Math.floor(hashStr(node.slug) * pool.length) % pool.length];
    var c = chain(leaf);
    var u = 0.18 + hashStr(node.slug + 'u') * 0.7;
    if (zone === 'trunk') u = 0.08 + hashStr(node.slug) * 0.18;
    if (zone === 'leaf') u = 0.55 + hashStr(node.slug) * 0.35;
    if (zone === 'fruit') u = 0.82 + hashStr(node.slug) * 0.14;
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

    var socialAng = (i / Math.max(1, n)) * Math.PI * 2 + hashStr(node.slug) * 0.4;
    var socialR = 2.2 + (node.type === 'PERSON' ? 0.6 : 3.2 * (1 - (node.importance || 0.4)));
    var social = new THREE.Vector3(Math.cos(socialAng) * socialR, ZONE_Y[zone] * 4.2, Math.sin(socialAng) * socialR);

    var placeKey = (node.place || 'unplaced').toLowerCase();
    var placeH = hashStr(placeKey);
    var spatialAng = placeH * Math.PI * 2;
    var spatialR = 1.6 + hashStr(placeKey + node.slug) * 4.5;
    var spatial = new THREE.Vector3(Math.cos(spatialAng) * spatialR, ZONE_Y[zone] * 4.5, Math.sin(spatialAng) * spatialR);

    var inst = /DEPARTMENT|DET|INSTITUTION|DOCUMENT/.test(node.type + node.slug + (node.title || '')) ? 0
      : /GUILD|MISSION|STATION/.test(node.type + node.slug) ? 1 : 2;
    var instAng = inst * 2.1 + hashStr(node.slug) * 0.8;
    var institutional = new THREE.Vector3(Math.cos(instAng) * (2.4 + inst), ZONE_Y[zone] * 4, Math.sin(instAng) * (2.4 + inst));

    var types = {};
    field.forEach(function (nd) { types[nd.type] = (types[nd.type] || 0) + 1; });
    var tKeys = Object.keys(types);
    var ti = Math.max(0, tKeys.indexOf(node.type));
    var symAng = (ti / Math.max(1, tKeys.length)) * Math.PI * 2 + hashStr(node.slug) * 0.5;
    var symbolic = new THREE.Vector3(Math.cos(symAng) * 4.2, ZONE_Y[zone] * 3.6, Math.sin(symAng) * 4.2);

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

  var CAP = 48;
  var nodePts = new THREE.Group();
  world.add(nodePts);

  var nodes = field.map(function (n, i) {
    var lays = layoutsFor(n, i, field.length);
    var col = new THREE.Color(TYPE_COL[n.type] || 0xc9a227);
    var mesh = new THREE.Mesh(nodeGeo, matFor(col));
    var out = new THREE.Mesh(nodeOutGeo, outlineMat);
    out.scale.setScalar(1.16);
    mesh.add(out);
    nodePts.add(mesh);
    return {
      def: n,
      lays: lays,
      pos: lays.TEMPORAL.clone(),
      target: lays.TEMPORAL.clone(),
      col: col,
      mesh: mesh
    };
  });

  var edgeMax = 80;
  var edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeMax * 2 * 3), 3));
  var edgeLine = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
    color: 0x1e3a5f, transparent: false
  }));
  world.add(edgeLine);

  function writeNodes() {
    var i, n;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (!n || !n.mesh) continue;
      n.mesh.position.copy(n.pos);
      var hot = state.selected && state.selected === n.def.slug;
      var dim = state.selected && !hot;
      n.mesh.scale.setScalar(hot ? 1.35 : (dim ? 0.72 : 1));
      n.mesh.visible = true;
    }
  }

  function recurrenceRels() {
    var c = {};
    edges.forEach(function (e) { c[e.relationship] = (c[e.relationship] || 0) + 1; });
    var keep = {};
    Object.keys(c).forEach(function (k) { if (c[k] >= 2) keep[k] = true; });
    return keep;
  }

  function writeEdges(pattern) {
    var pa = edgeGeo.attributes.position.array;
    pa.fill(0);
    var idx = 0;
    var rec = pattern ? recurrenceRels() : null;
    var selected = state.selected;
    edges.forEach(function (e) {
      if (idx >= edgeMax) return;
      var a, b, i;
      for (i = 0; i < nodes.length; i++) {
        if (nodes[i].def.slug === e.source) a = nodes[i];
        if (nodes[i].def.slug === e.target) b = nodes[i];
      }
      if (!a || !b) return;
      var hot = selected && (a.def.slug === selected || b.def.slug === selected);
      if (pattern && rec && !rec[e.relationship] && !hot) return;
      pa[idx * 6] = a.pos.x; pa[idx * 6 + 1] = a.pos.y; pa[idx * 6 + 2] = a.pos.z;
      pa[idx * 6 + 3] = b.pos.x; pa[idx * 6 + 4] = b.pos.y; pa[idx * 6 + 5] = b.pos.z;
      idx++;
    });
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.setDrawRange(0, idx * 2);
    edgeLine.material.color.set(pattern ? 0xc41e3a : 0x1e3a5f);
  }

  writeNodes(); writeEdges(false);

  var yaw = 0.45, pitch = 0.12, dist = 20, targetY = 0.2, yawV = 0;
  var down = false, moved = 0, px = 0, py = 0;
  var el = renderer.domElement;
  function place() {
    var cy = Math.cos(pitch), sy = Math.sin(pitch);
    camera.position.set(Math.sin(yaw) * dist * cy, targetY + sy * dist, Math.cos(yaw) * dist * cy);
    camera.lookAt(0, targetY, 0);
  }
  el.addEventListener('pointerdown', function (e) {
    down = true; moved = 0; px = e.clientX; py = e.clientY; yawV = 0;
    el.setPointerCapture(e.pointerId); el.classList.add('dragging');
  });
  el.addEventListener('pointermove', function (e) {
    if (!down) { hover(e.clientX, e.clientY); return; }
    var dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * 0.005; yawV = -dx * 0.0005;
    targetY = Math.max(-8, Math.min(9, targetY + dy * 0.018));
  });
  el.addEventListener('pointerup', function (e) {
    if (!down) return; down = false; el.classList.remove('dragging');
    if (moved < 7) pick(e.clientX, e.clientY);
  });
  el.addEventListener('pointercancel', function () { down = false; el.classList.remove('dragging'); });
  addEventListener('wheel', function (e) {
    targetY = Math.max(-8, Math.min(9, targetY - e.deltaY * 0.012));
    dist = Math.max(14, Math.min(48, dist + e.deltaY * 0.02));
  }, { passive: true });

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
    if (i >= 0) el.classList.add('overpoint'); else el.classList.remove('overpoint');
  }
  function pick(cx, cy) {
    var i = hitIndex(cx, cy);
    if (i < 0) { hideLife(); writeNodes(); writeEdges(state.pattern); return; }
    showLife(nodes[i].def);
    writeNodes(); writeEdges(state.pattern);
  }

  window.TTG_FIELD = {
    focusSlug: function (slug) {
      state.selected = slug;
      if (slug) {
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].def.slug === slug) {
            var p = nodes[i].pos;
            yaw = Math.atan2(p.x, p.z);
            targetY = p.y * 0.7;
            break;
          }
        }
      }
      writeNodes(); writeEdges(state.pattern);
    },
    setProjection: function (name, pattern) {
      state.projection = name;
      state.pattern = !!pattern;
      nodes.forEach(function (n) {
        var t = n.lays[name] || n.lays.TEMPORAL;
        n.target.copy(t);
      });
      writeEdges(state.pattern);
    },
    addNode: function (node) {
      var lays = layoutsFor(node, nodes.length, nodes.length + 1);
      nodes.unshift({
        def: node, lays: lays, pos: lays[state.projection].clone(),
        target: lays[state.projection].clone(),
        col: new THREE.Color(TYPE_COL[node.type] || 0xc9a227),
        mesh: (function () {
          var col = new THREE.Color(TYPE_COL[node.type] || 0xc9a227);
          var mesh = new THREE.Mesh(nodeGeo, matFor(col));
          var out = new THREE.Mesh(nodeOutGeo, outlineMat);
          out.scale.setScalar(1.16);
          mesh.add(out);
          nodePts.add(mesh);
          return mesh;
        })()
      });
      if (nodes.length > CAP) {
        var drop = nodes.pop();
        if (drop && drop.mesh) nodePts.remove(drop.mesh);
      }
      writeNodes(); writeEdges(state.pattern);
    },
    addEdge: function (edge) {
      if (!edge || !edge.source || !edge.target) return;
      edges.push(edge);
      writeEdges(state.pattern);
    }
  };

  var t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var t = (now - t0) / 1000;
    if (!down && !reduce) { yaw += yawV; yawV *= 0.94; yaw += 0.00022; }
    nodes.forEach(function (n) {
      n.pos.lerp(n.target, reduce ? 1 : 0.06);
    });
    writeNodes();
    writeEdges(state.pattern);
    if (!reduce) {
      ring.rotation.z = t * 0.04;
    }
    place();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();
