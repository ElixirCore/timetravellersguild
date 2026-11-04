/* Body semantics: head look, heart pressure, arms, legs, proprioception. */
(function (J) {
  'use strict';

  var keys = { w: false, a: false, s: false, d: false, left: false, right: false, up: false, down: false };
  var activeLimb = 'head';

  function clamp(n, a, b) {
    return n < a ? a : n > b ? b : n;
  }

  function setKey(code, down) {
    if (code === 'KeyW' || code === 'KeyS' || code === 'KeyA' || code === 'KeyD' ||
        code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown') {
      /* mapped below */
    }
    if (code === 'KeyW') keys.w = down;
    if (code === 'KeyS') keys.s = down;
    if (code === 'KeyA') keys.a = down;
    if (code === 'KeyD') keys.d = down;
    if (code === 'ArrowLeft') keys.left = down;
    if (code === 'ArrowRight') keys.right = down;
    if (code === 'ArrowUp') keys.up = down;
    if (code === 'ArrowDown') keys.down = down;
  }

  function look(dx, dy) {
    var st = J.State.get();
    st.body.yaw += dx;
    st.body.pitch = clamp(st.body.pitch + dy, -0.7, 0.55);
    st.body.limbs.head.status = 'orient';
    st.body.limbs.head.yaw = st.body.yaw;
    activeLimb = 'head';
    J.State.setPhase('ORIENT');
  }

  function flick(vx) {
    J.State.get().body.yawV = vx;
    activeLimb = 'head';
    J.State.setPhase('ORIENT');
  }

  function move(dt) {
    var st = J.State.get();
    var b = st.body;
    var bounds = st.room.bounds || { minX: -7.2, maxX: 7.2, minZ: -7.2, maxZ: 7.2 };
    var speed = 2.15 * (0.45 + b.energy * 0.55);
    var lat = 0;
    var depth = 0;
    if (st.context.mode === 'ROOM') {
      if (keys.w) depth += 1;
      if (keys.s) depth -= 1;
      if (keys.a) lat -= 1;
      if (keys.d) lat += 1;
      if (keys.left) look(-1.15 * dt, 0);
      if (keys.right) look(1.15 * dt, 0);
      if (keys.up) look(0, 0.8 * dt);
      if (keys.down) look(0, -0.8 * dt);
    }
    if (!b._lat) b._lat = 0;
    if (!b._depth) b._depth = 0;
    lat += b._lat;
    depth += b._depth;
    b._lat *= 0.82;
    b._depth *= 0.82;
    if (Math.abs(b._lat) < 0.01) b._lat = 0;
    if (Math.abs(b._depth) < 0.01) b._depth = 0;

    b.yaw += b.yawV;
    b.yawV *= 0.94;
    if (Math.abs(b.yawV) < 0.0004) b.yawV = 0;

    var moving = lat !== 0 || depth !== 0;
    if (moving && st.context.mode === 'ROOM') {
      var sy = Math.sin(b.yaw);
      var cy = Math.cos(b.yaw);
      var nx = b.position.x + (sy * depth + cy * lat) * speed * dt;
      var nz = b.position.z + (cy * depth - sy * lat) * speed * dt;
      nx = clamp(nx, bounds.minX + 0.9, bounds.maxX - 0.9);
      nz = clamp(nz, bounds.minZ + 0.9, bounds.maxZ - 0.9);
      if (!blocked(nx, nz)) {
        b.position.x = nx;
        b.position.z = nz;
      }
      b.energy = clamp(b.energy - dt * 0.035, 0.18, 1);
      b.limbs.leftLeg.status = lat !== 0 ? 'lateral' : 'idle';
      b.limbs.rightLeg.status = depth !== 0 ? 'depth' : 'idle';
      b.limbs.leftLeg.lateral = lat;
      b.limbs.rightLeg.depth = depth;
      activeLimb = Math.abs(lat) > Math.abs(depth) ? 'leftLeg' : 'rightLeg';
      J.State.setPhase('MOVE');
    } else {
      b.energy = clamp(b.energy + dt * 0.04, 0.18, 1);
      b.limbs.leftLeg.status = 'idle';
      b.limbs.rightLeg.status = 'idle';
      b.limbs.leftLeg.lateral = 0;
      b.limbs.rightLeg.depth = 0;
    }

    if (b.yawV !== 0 || keys.left || keys.right) {
      b.limbs.head.status = 'orient';
      activeLimb = 'head';
    } else if (!moving) {
      b.limbs.head.status = b.focus ? 'focus' : 'idle';
    }
    b.limbs.head.yaw = b.yaw;
    b.limbs.head.focus = b.focus;
  }

  function blocked(x, z) {
    var objs = J.State.get().room.objects || [];
    var i, o, hw, hd;
    for (i = 0; i < objs.length; i++) {
      o = objs[i];
      if (o.type !== 'furniture' && o.type !== 'inhabitant') continue;
      hw = (o.w || 0.4) * 0.5 + 0.38;
      hd = (o.d || 0.4) * 0.5 + 0.38;
      if (Math.abs(x - o.x) < hw && Math.abs(z - o.z) < hd) return true;
    }
    return false;
  }

  function drive(lat, depth) {
    var st = J.State.get();
    st.body._lat = lat;
    st.body._depth = depth;
  }

  function reach(on) {
    var st = J.State.get();
    st.body.limbs.leftArm.status = on ? 'reach' : 'idle';
    st.body.limbs.leftArm.reach = on ? 1 : 0;
    if (on) {
      activeLimb = 'leftArm';
      J.State.setPhase('REACH');
    }
  }

  function scalpelMode(mode) {
    var st = J.State.get();
    st.body.limbs.rightArm.status = mode === 'idle' ? 'idle' : 'scalpel';
    st.body.limbs.rightArm.mode = mode || 'idle';
    activeLimb = 'rightArm';
    if (mode && mode !== 'idle') J.State.setPhase('OPERATE');
  }

  function hold(id) {
    J.State.get().body.limbs.leftArm.holding = id || null;
  }

  function senseHeart(dt) {
    var st = J.State.get();
    var unresolved = 0;
    var hist = st.context.history;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i].type === 'working_card' || hist[i].type === 'derived_card' || hist[i].type === 'inspection') unresolved += 0.06;
    }
    if (st.context.activeCard) unresolved += 0.18;
    if (st.context.mode === 'BENCH') unresolved += 0.12;
    if (st.room.selectedObject === 'obj-unclassified' || st.room.selectedObject === 'obj-bench') unresolved += 0.1;
    var target = clamp(0.06 + unresolved, 0, 1);
    st.body.pressure += (target - st.body.pressure) * Math.min(1, dt * 2.2);
    st.body.limbs.heart.pressure = st.body.pressure;
    st.body.limbs.heart.relevance = target;
    st.body.limbs.heart.status = st.body.pressure > 0.55 ? 'tension' : (st.context.activeCard ? 'load' : 'idle');
  }

  function proprio() {
    var b = J.State.get().body;
    var deg = ((b.yaw * 180 / Math.PI) % 360 + 360) % 360;
    var focus = b.focus || '—';
    return {
      active: activeLimb,
      head: 'YAW ' + ('000' + Math.round(deg)).slice(-3) + ' · FOCUS ' + focus,
      heart: 'P ' + b.pressure.toFixed(2) + ' · E ' + b.energy.toFixed(2),
      leftArm: (b.limbs.leftArm.status === 'reach' ? 'REACHING' : 'REACH · INSPECT') +
        (b.limbs.leftArm.holding ? ' · ' + b.limbs.leftArm.holding : ''),
      rightArm: 'SCALPEL ' + String(b.limbs.rightArm.mode || 'IDLE').toUpperCase(),
      leftLeg: b.limbs.leftLeg.status === 'lateral' ? 'LATERAL ENGAGED' : 'LATERAL',
      rightLeg: b.limbs.rightLeg.status === 'depth' ? 'DEPTH ENGAGED' : 'DEPTH'
    };
  }

  J.Body = {
    keys: keys,
    setKey: setKey,
    look: look,
    flick: flick,
    move: move,
    drive: drive,
    reach: reach,
    scalpelMode: scalpelMode,
    hold: hold,
    senseHeart: senseHeart,
    proprio: proprio,
    activeLimb: function () { return activeLimb; }
  };
})(window.Jack = window.Jack || {});
