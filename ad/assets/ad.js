'use strict';
/* ═══════════════════════════════════════════════════════════════════
   /ad — five orthogonal dimensions
   ZERO → 1D x → 2D y → 3D z → 4D t → 5D YOU → /now/tree
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  var G = window.TTG_GRAPH || { field: [], edges: [], you: {} };
  var field = Array.isArray(G.field) ? G.field : [];
  var edges = Array.isArray(G.edges) ? G.edges : [];
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DONE = '/now/tree';
  var finished = false;

  function $(id) { return document.getElementById(id); }
  function finish() {
    if (finished) return;
    finished = true;
    location.replace(DONE);
  }

  $('skip').addEventListener('click', finish);
  $('enter').addEventListener('click', function (e) {
    e.preventDefault();
    finish();
  });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      finish();
    }
  });

  /* ── Reduced motion: caption slideshow only ─────────────────── */
  if (reduce || typeof THREE === 'undefined') {
    var beats = [
      ['ZERO — THE POINT', '0', null],
      ['1D — THE LINE', 'x', 'x'],
      ['2D — THE SQUARE', 'y', 'y'],
      ['3D — THE SPACE', 'z', 'z'],
      ['4D — THE TIME', 't', 't'],
      ['5D — THE YOU', 'you', 'you']
    ];
    var i = 0;
    function showBeat() {
      if (i >= beats.length) {
        $('finale').hidden = false;
        $('finale').classList.add('show');
        setTimeout(finish, 2200);
        return;
      }
      var b = beats[i++];
      setCaption(b[0], b[1], false);
      if (b[2]) lightAxis(b[2]);
      setTimeout(showBeat, 700);
    }
    showBeat();
    return;
  }

  /* ── Caption / legend ───────────────────────────────────────── */
  function setCaption(title, axis, ortho) {
    $('cap-title').textContent = title;
    $('cap-axis').textContent = axis;
    var o = $('cap-ortho');
    if (ortho) {
      o.hidden = false;
      $('caption').classList.add('flash');
    } else {
      o.hidden = true;
      $('caption').classList.remove('flash');
    }
  }
  function lightAxis(key) {
    var li = document.querySelector('#legend-list li[data-axis="' + key + '"]');
    if (!li) return;
    li.hidden = false;
    requestAnimationFrame(function () { li.classList.add('on'); });
  }

  /* ── Scene ──────────────────────────────────────────────────── */
  var stage = $('stage');
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 200);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);

  var root = new THREE.Group();
  scene.add(root);

  var ink = 0x1a2438;
  var scarlet = 0xc41e3a;
  var gold = 0xc9a227;
  var navy = 0x1e3a5f;

  function lineMat(color, opacity) {
    return new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity == null ? 1 : opacity
    });
  }
  function segs(points, color, opacity) {
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      lineMat(color, opacity)
    );
  }

  /* origin point */
  var pointGeo = new THREE.SphereGeometry(0.045, 16, 12);
  var origin = new THREE.Mesh(pointGeo, new THREE.MeshBasicMaterial({ color: scarlet }));
  root.add(origin);

  /* axes grow as vectors */
  var axisX = segs([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.001, 0, 0)], ink, 0);
  var axisY = segs([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.001, 0)], ink, 0);
  var axisZ = segs([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.001)], ink, 0);
  root.add(axisX, axisY, axisZ);

  var hairTree = segs([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.001, 0, 0)], gold, 0);
  root.add(hairTree);

  /* square / cube wireframes — rebuilt as lengths grow */
  var squareGroup = new THREE.Group();
  squareGroup.visible = false;
  root.add(squareGroup);
  var cubeGroup = new THREE.Group();
  cubeGroup.visible = false;
  root.add(cubeGroup);

  function setAxisLine(line, to, opacity) {
    var pos = line.geometry.attributes.position;
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    line.material.opacity = opacity;
  }

  function buildSquare(s) {
    while (squareGroup.children.length) {
      var c = squareGroup.children[0];
      squareGroup.remove(c);
      c.geometry.dispose();
    }
    var pts = [
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(s, 0, 0),
      new THREE.Vector3(s, 0, 0), new THREE.Vector3(s, s, 0),
      new THREE.Vector3(s, s, 0), new THREE.Vector3(0, s, 0),
      new THREE.Vector3(0, s, 0), new THREE.Vector3(0, 0, 0)
    ];
    squareGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMat(ink, 0.85)
    ));
  }

  function buildCube(s) {
    while (cubeGroup.children.length) {
      var c = cubeGroup.children[0];
      cubeGroup.remove(c);
      c.geometry.dispose();
    }
    var a = 0, b = s;
    var corners = [
      [a, a, a], [b, a, a], [b, b, a], [a, b, a],
      [a, a, b], [b, a, b], [b, b, b], [a, b, b]
    ];
    var edgesIdx = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    var pts = [];
    edgesIdx.forEach(function (e) {
      var p = corners[e[0]], q = corners[e[1]];
      pts.push(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(q[0], q[1], q[2]));
    });
    cubeGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMat(navy, 0.7)
    ));
  }

  /* flashcards at square corners */
  var cardGroup = new THREE.Group();
  root.add(cardGroup);
  function makeCard(title) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    var x = c.getContext('2d');
    x.fillStyle = 'rgba(241,228,196,0.92)';
    x.fillRect(0, 0, 256, 96);
    x.strokeStyle = 'rgba(196,30,58,0.7)';
    x.lineWidth = 3;
    x.strokeRect(4, 4, 248, 88);
    x.fillStyle = '#1a2438';
    x.font = '600 22px "Barlow Condensed",sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    var t = String(title || '').slice(0, 28);
    x.fillText(t.toUpperCase(), 128, 48);
    var spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthWrite: false
    }));
    spr.scale.set(1.1, 0.42, 1);
    return spr;
  }

  var sampleTitles = field
    .map(function (n) { return n.title || n.name || ''; })
    .filter(Boolean)
    .slice(0, 12);
  if (!sampleTitles.length) {
    sampleTitles = ['1951', 'STATION XIII', 'FIELD', 'NOW'];
  }
  var cornerCards = [];
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(function (xy, i) {
    var spr = makeCard(sampleTitles[i % sampleTitles.length]);
    spr.position.set(xy[0] * 2.2, xy[1] * 2.2, 0.05);
    cardGroup.add(spr);
    cornerCards.push(spr);
  });

  /* branch stubs for 3D */
  var stubGroup = new THREE.Group();
  stubGroup.visible = false;
  root.add(stubGroup);
  for (var si = 0; si < 8; si++) {
    var ang = (si / 8) * Math.PI * 2;
    var stub = segs([
      new THREE.Vector3(1.1, 1.1, 1.1),
      new THREE.Vector3(1.1 + Math.cos(ang) * 0.9, 1.1 + 0.4, 1.1 + Math.sin(ang) * 0.9)
    ], gold, 0.55);
    stubGroup.add(stub);
  }

  /* time ghosts + graph leak */
  var ghostGroup = new THREE.Group();
  ghostGroup.visible = false;
  root.add(ghostGroup);
  var graphGroup = new THREE.Group();
  graphGroup.visible = false;
  root.add(graphGroup);

  var YEARS = [1951, 2008, 2014, 2026, 2029, 2033];
  var yearEl = $('year');
  var tapeEl = $('tape');

  function yearOf(n) {
    var y = n.year != null ? Number(n.year) : 0;
    if (!y && n.tree && n.tree.year) y = Number(n.tree.year);
    if (!y && n.observed_at) {
      var d = Date.parse(n.observed_at);
      if (!isNaN(d)) y = new Date(d).getFullYear();
    }
    return y || 0;
  }

  function buildGraphLeak() {
    var nodes = field.filter(function (n) { return yearOf(n) > 0; }).slice(0, 80);
    if (!nodes.length) nodes = field.slice(0, 40);
    var minY = 1951, maxY = 2033;
    var idPos = {};
    nodes.forEach(function (n, i) {
      var y = yearOf(n) || (minY + (i % 10) * 8);
      var t = (y - minY) / (maxY - minY);
      var a = (i * 2.399) % (Math.PI * 2);
      var r = 0.6 + (i % 7) * 0.22;
      var p = new THREE.Vector3(
        (t - 0.5) * 6.5,
        Math.sin(a) * r + 0.8,
        Math.cos(a) * r
      );
      idPos[n.id || n.slug || i] = p;
      var bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 + (n.type === 'MOMENT' ? 0.02 : 0), 10, 8),
        new THREE.MeshBasicMaterial({
          color: (n.status === 'INTENDS' ? gold : scarlet),
          transparent: true,
          opacity: 0
        })
      );
      bead.position.copy(p);
      bead.userData.bead = true;
      graphGroup.add(bead);
    });
    edges.slice(0, 60).forEach(function (e) {
      var a = idPos[e.source || e.from];
      var b = idPos[e.target || e.to];
      if (!a || !b) return;
      var L = segs([a, b], navy, 0);
      L.userData.edge = true;
      graphGroup.add(L);
    });
  }
  buildGraphLeak();

  /* you-point (fifth axis) */
  var youPoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    new THREE.MeshBasicMaterial({ color: scarlet, transparent: true, opacity: 0 })
  );
  youPoint.position.set(0, 0, 0);
  scene.add(youPoint);

  /* ── Timeline (seconds) ─────────────────────────────────────── */
  /*
    0–2   ZERO
    2–5   1D x
    5–10  2D y
    10–16 3D z
    16–25 4D t
    25–30 5D YOU → handoff
  */
  var T0 = performance.now();
  var phase = -1;
  var camTheta = 0.15;
  var camPhi = 0.12;
  var camDist = 8;
  var camTarget = new THREE.Vector3(1.1, 1.0, 0.6);

  function ease(u) {
    u = Math.max(0, Math.min(1, u));
    return u * u * (3 - 2 * u);
  }
  function span(t, a, b) {
    if (t <= a) return 0;
    if (t >= b) return 1;
    return ease((t - a) / (b - a));
  }

  function setPhase(p) {
    if (p === phase) return;
    phase = p;
    if (p === 0) setCaption('ZERO — THE POINT', '0', false);
    if (p === 1) {
      setCaption('1D — THE LINE', 'x', true);
      lightAxis('x');
      setTimeout(function () { if (phase === 1) setCaption('1D — THE LINE', 'x', false); }, 900);
    }
    if (p === 2) {
      setCaption('2D — THE SQUARE', 'y', true);
      lightAxis('y');
      setTimeout(function () { if (phase === 2) setCaption('2D — THE SQUARE', 'y', false); }, 900);
    }
    if (p === 3) {
      setCaption('3D — THE SPACE', 'z', true);
      lightAxis('z');
      setTimeout(function () { if (phase === 3) setCaption('3D — THE SPACE', 'z', false); }, 900);
    }
    if (p === 4) {
      setCaption('4D — THE TIME', 't', true);
      lightAxis('t');
      yearEl.hidden = false;
      tapeEl.hidden = false;
      setTimeout(function () { if (phase === 4) setCaption('4D — THE TIME', 't', false); }, 900);
    }
    if (p === 5) {
      setCaption('5D — THE YOU', 'you', true);
      lightAxis('you');
      setTimeout(function () { if (phase === 5) setCaption('5D — THE YOU', 'you', false); }, 1000);
    }
  }

  function frame(now) {
    if (finished) return;
    requestAnimationFrame(frame);
    var t = (now - T0) / 1000;

    var p;
    if (t < 2) p = 0;
    else if (t < 5) p = 1;
    else if (t < 10) p = 2;
    else if (t < 16) p = 3;
    else if (t < 25) p = 4;
    else p = 5;
    setPhase(p);

    /* geometry growth */
    var lenX = 2.2 * span(t, 2.0, 4.2);
    var lenY = 2.2 * span(t, 5.0, 7.5);
    var lenZ = 2.2 * span(t, 10.0, 13.0);

    setAxisLine(axisX, new THREE.Vector3(Math.max(lenX, 0.001), 0, 0), span(t, 2.0, 2.6));
    setAxisLine(hairTree, new THREE.Vector3(Math.max(lenX * 0.92, 0.001), 0.02, 0), span(t, 2.4, 3.5) * 0.7);
    setAxisLine(axisY, new THREE.Vector3(0, Math.max(lenY, 0.001), 0), span(t, 5.0, 5.8));
    setAxisLine(axisZ, new THREE.Vector3(0, 0, Math.max(lenZ, 0.001)), span(t, 10.0, 11.0));

    if (lenY > 0.05) {
      squareGroup.visible = true;
      buildSquare(Math.min(lenX, lenY) || 0.05);
    }
    if (lenZ > 0.05) {
      cubeGroup.visible = true;
      buildCube(Math.min(lenX, lenY, lenZ) || 0.05);
      stubGroup.visible = true;
    }

    /* cards click on in 2D */
    var cardU = span(t, 6.5, 9.5);
    cornerCards.forEach(function (spr, i) {
      var local = Math.max(0, Math.min(1, (cardU - i * 0.12) / 0.4));
      spr.material.opacity = local;
      var s = Math.min(lenX, lenY) || 2.2;
      spr.position.set(
        (i === 1 || i === 2 ? s : 0),
        (i >= 2 ? s : 0),
        0.08
      );
    });

    /* camera: still until 3D, then orbit */
    if (t >= 10) {
      var u3 = span(t, 10, 16);
      camTheta = 0.15 + u3 * 1.15;
      camPhi = 0.12 + u3 * 0.35;
      camDist = 8 - u3 * 2.2;
      camTarget.set(1.0, 1.0, 0.9);
    }
    if (t >= 16 && t < 25) {
      var u4 = span(t, 16, 25);
      camTheta = 1.3 + u4 * 0.55;
      camPhi = 0.47 + Math.sin(u4 * Math.PI) * 0.08;
      camDist = 5.8 + u4 * 1.4;
    }
    if (t >= 25) {
      var u5 = span(t, 25, 29);
      /* reproject around the eye — fifth axis toward viewer */
      camDist = 7.2 - u5 * 2.8;
      camPhi = 0.55 - u5 * 0.35;
      camTheta = 1.85 + u5 * 0.4;
      camTarget.lerp(new THREE.Vector3(0, 0.2, 0), u5 * 0.08);
    }

    camera.position.set(
      camTarget.x + camDist * Math.cos(camPhi) * Math.cos(camTheta),
      camTarget.y + camDist * Math.sin(camPhi),
      camTarget.z + camDist * Math.cos(camPhi) * Math.sin(camTheta)
    );
    camera.lookAt(camTarget);

    /* 4D — ghosts + graph */
    if (t >= 16) {
      ghostGroup.visible = true;
      graphGroup.visible = true;
      var gU = span(t, 16, 22);
      /* ghost trail of the cube along -x (past) */
      if (ghostGroup.children.length < 5) {
        for (var g = 0; g < 5; g++) {
          var ghost = cubeGroup.children[0]
            ? cubeGroup.children[0].clone()
            : segs([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)], navy, 0.2);
          if (ghost.material) {
            ghost.material = ghost.material.clone();
            ghost.material.opacity = 0.15;
          }
          ghost.position.x = -(g + 1) * 1.35;
          ghostGroup.add(ghost);
        }
      }
      ghostGroup.children.forEach(function (ch, gi) {
        if (ch.material) ch.material.opacity = gU * (0.28 - gi * 0.04);
      });

      var yi = Math.min(YEARS.length - 1, Math.floor(span(t, 16.2, 24.2) * YEARS.length));
      yearEl.textContent = String(YEARS[yi]);
      var tapeIdx = Math.floor((t * 2.2) % sampleTitles.length);
      tapeEl.textContent = sampleTitles[tapeIdx] || '';

      graphGroup.children.forEach(function (ch) {
        if (ch.userData.bead && ch.material) {
          ch.material.opacity = gU * 0.9;
        }
        if (ch.userData.edge && ch.material) {
          ch.material.opacity = Math.max(0, (gU - 0.35) * 0.55);
        }
      });

      /* soften the schoolroom construction as the field takes over */
      var fadeGeo = 1 - span(t, 18, 24) * 0.55;
      [axisX, axisY, axisZ, hairTree].forEach(function (L) {
        if (L.material) L.material.opacity = Math.min(L.material.opacity, fadeGeo);
      });
      if (squareGroup.children[0] && squareGroup.children[0].material) {
        squareGroup.children[0].material.opacity = 0.85 * fadeGeo;
      }
      if (cubeGroup.children[0] && cubeGroup.children[0].material) {
        cubeGroup.children[0].material.opacity = 0.7 * fadeGeo;
      }
    }

    /* 5D — YOU */
    if (t >= 25) {
      var yu = span(t, 25, 27.5);
      /* dead-centre over everything, toward the camera */
      var forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      youPoint.position.copy(camera.position).add(forward.multiplyScalar(1.35));
      youPoint.material.opacity = yu;
      youPoint.scale.setScalar(0.7 + yu * 1.4);

      /* brighten nearest beads to camera */
      var camPos = camera.position;
      graphGroup.children.forEach(function (ch) {
        if (!ch.userData.bead || !ch.material) return;
        var d = ch.position.distanceTo(camPos);
        var near = Math.max(0, 1 - (d - 3) / 6);
        ch.material.opacity = Math.min(1, 0.45 + near * yu);
        ch.scale.setScalar(1 + near * yu * 0.8);
      });

      if (t >= 27.2) {
        var fin = $('finale');
        fin.hidden = false;
        fin.classList.add('show');
      }
      if (t >= 30.5) finish();
    }

    origin.material.opacity = t < 25 ? 1 : Math.max(0.2, 1 - span(t, 25, 27));
    renderer.render(scene, camera);
  }

  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  setPhase(0);
  requestAnimationFrame(frame);
})();
