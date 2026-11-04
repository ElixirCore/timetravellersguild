/* 7-orthoplex projection. Not storage. Jack terracotta / Mabel cyan. */
(function (J) {
  'use strict';

  var D = 7;
  var radius = 0.95;
  var angles = [0, 0, 0];
  var verts = [];
  var edges = [];
  var vector = [0, 0, 0, 0, 0.5, 0.5, 0];
  var halted = false;
  var lastTurn = null;
  var origin = { x: 0, y: 1.22, z: -1.85 };
  var open = false;

  function generate() {
    verts = [];
    var i, s;
    for (i = 0; i < D; i++) {
      for (s = 0; s < 2; s++) {
        var v = [0, 0, 0, 0, 0, 0, 0];
        v[i] = (s === 0 ? -1 : 1) * radius;
        verts.push(v);
      }
    }
    edges = [];
    var n = verts.length;
    var a, b;
    for (a = 0; a < n; a++) {
      for (b = a + 1; b < n; b++) {
        if (Math.floor(a / 2) === Math.floor(b / 2)) continue;
        edges.push([a, b]);
      }
    }
  }

  function rotate(dt) {
    var p = vector[4] != null ? vector[4] : 0.5;
    var c = vector[5] != null ? vector[5] : 0.5;
    var r = vector[6] != null ? vector[6] : 0;
    angles[0] += dt * (0.35 + p * 0.45);
    angles[1] += dt * (0.26 + c * 0.35);
    angles[2] += dt * (0.42 + r * 0.7);
  }

  function projected() {
    var a1 = angles[0], a2 = angles[1], a3 = angles[2];
    var c1 = Math.cos(a1), s1 = Math.sin(a1);
    var c2 = Math.cos(a2), s2 = Math.sin(a2);
    var c3 = Math.cos(a3), s3 = Math.sin(a3);
    var out = [];
    for (var i = 0; i < verts.length; i++) {
      var v = verts[i].slice();
      var x0 = v[0] * c1 - v[1] * s1;
      var x1 = v[0] * s1 + v[1] * c1;
      v[0] = x0; v[1] = x1;
      var x2 = v[2] * c2 - v[3] * s2;
      var x3 = v[2] * s2 + v[3] * c2;
      v[2] = x2; v[3] = x3;
      var x4 = v[4] * c3 - v[5] * s3;
      var x5 = v[4] * s3 + v[5] * c3;
      v[4] = x4; v[5] = x5;
      var d4 = 3.6 - v[3] * 0.22;
      var d5 = 3.6 - v[4] * 0.22;
      var d6 = 3.6 - v[5] * 0.22;
      var d7 = 3.6 - v[6] * 0.22;
      var scale = (1 / d4) * (1 / d5) * (1 / d6) * (1 / d7) * 220;
      out.push({
        x: origin.x + v[0] * scale,
        y: origin.y + v[1] * scale,
        z: origin.z + v[2] * scale
      });
    }
    return out;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function colour(t) {
    if (halted) return 'rgba(178,83,62,0.92)';
    var r = Math.round(lerp(178, 99, t));
    var g = Math.round(lerp(83, 139, t));
    var b = Math.round(lerp(62, 148, t));
    return 'rgba(' + r + ',' + g + ',' + b + ',0.88)';
  }

  function draw(ctx, project) {
    if (!ctx || !project || !edges.length) return;
    var pts = projected();
    var world = [];
    var i;
    for (i = 0; i < pts.length; i++) world.push(project(pts[i].x, pts[i].y, pts[i].z));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < edges.length; i++) {
      var a = world[edges[i][0]];
      var b = world[edges[i][1]];
      if (!a || !b) continue;
      var t = (pts[edges[i][0]].x + 1.2) / 2.4;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = colour(t);
      ctx.lineWidth = halted ? 1.6 : 1.15;
      ctx.stroke();
    }
    ctx.restore();
  }

  function look() {
    var st = J.State.get();
    var dx = origin.x - st.body.position.x;
    var dz = origin.z - st.body.position.z;
    st.body.yaw = Math.atan2(dx, dz);
    var dy = origin.y - st.body.position.y;
    var dist = Math.hypot(dx, dz) || 1;
    st.body.pitch = Math.atan2(dy, dist) * 0.35;
    J.State.selectObject('obj-aperture');
    J.State.setPhase('FOCUS');
    open = true;
    document.body.classList.add('aperture');
    setReadout();
  }

  function setReadout() {
    var el = document.getElementById('mabelReadout');
    if (!el) return;
    el.hidden = !open;
    if (!lastTurn) {
      el.innerHTML = '<p class="who">MABEL</p><p>The aperture is a projection. I have not proposed a molecule.</p>';
      return;
    }
    var m = lastTurn.mabel || {};
    var j = lastTurn.jack || {};
    var mol = (m.detected_molecules || []).map(function (row) {
      return (row.kind || '') + ' · ' + (row.members || []).slice(0, 3).join(', ');
    }).join(' · ');
    el.innerHTML =
      '<p class="who">JACK</p><p>' + escape(j.note || '') + '</p>' +
      '<p class="who oracle">MABEL</p><p>' + escape(m.note || 'Withheld.') + '</p>' +
      (mol ? '<p class="mol">' + escape(mol) + '</p>' : '') +
      '<p class="vec">7D ' + (lastTurn.vector_7d || []).map(function (n) { return Number(n).toFixed(2); }).join(' · ') + '</p>' +
      '<p class="vec">' + escape(lastTurn.turn_status || '') + ' · NOT CANON</p>';
  }

  function escape(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  function turn(message) {
    look();
    if (J.Tape && J.Tape.mark) J.Tape.mark('head', 'aperture', '7D', 'open');
    if (!J.API || !J.API.session || !J.API.session.csrf) {
      return Promise.resolve(null);
    }
    var st = J.State.get();
    var data = new FormData();
    data.set('csrf', J.API.session.csrf);
    data.set('q', String(message || '').slice(0, 2000));
    data.set('yaw', String(st.body.yaw));
    data.set('z', String(st.body.position.z));
    data.set('focus', st.room.selectedObject || '');
    if (J.Tape && J.Tape.wait) J.Tape.wait(true);
    return fetch('aperture.php', {
      method: 'POST',
      body: data,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) { return res.json(); }).then(function (payload) {
      if (J.Tape && J.Tape.wait) J.Tape.wait(false);
      if (!payload || !payload.ok) return payload;
      lastTurn = payload;
      if (payload.vector_7d) vector = payload.vector_7d;
      halted = !!(payload.jack && payload.jack.rejected_unverified);
      if (J.API.appendTalk) {
        if (payload.jack && payload.jack.note) J.API.appendTalk('clerk', payload.jack.note);
        if (payload.mabel && payload.mabel.note && payload.mabel.status !== 'CONSENT_WITHHELD') {
          J.API.appendTalk('oracle', payload.mabel.note);
        }
      }
      setReadout();
      if (J.Cards && J.Cards.refresh) J.Cards.refresh();
      return payload;
    }).catch(function () {
      if (J.Tape && J.Tape.wait) J.Tape.wait(false);
      return null;
    });
  }

  generate();

  J.Aperture = {
    tick: function (t, dt) { rotate(dt || 0.016); },
    draw: draw,
    look: look,
    turn: turn,
    counts: function () { return { vertices: verts.length, edges: edges.length }; },
    last: function () { return lastTurn; },
    applyVector: function (v, halt) {
      if (v && v.length === 7) vector = v;
      halted = !!halt;
    }
  };
})(window.Jack = window.Jack || {});
