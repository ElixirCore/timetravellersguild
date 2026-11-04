/* Mabel lives behind the camera. She comes out if you look behind the lens. */
(function (J) {
  'use strict';

  var glance = false;
  var found = false;
  var emerge = 0;
  var said = 0;
  var pos = { x: 0, y: 0.38, z: 0 };
  var LINES = [
    'I was behind the lens.',
    'I do not write the record. I read the join.',
    'Mother keeps the shed. I keep the cube.'
  ];

  function behindPoint() {
    var b = J.State.get().body;
    return {
      x: b.position.x - Math.sin(b.yaw) * 0.58,
      y: 0.38,
      z: b.position.z - Math.cos(b.yaw) * 0.58
    };
  }

  function speak(i) {
    var line = LINES[i];
    if (!line) return;
    var el = document.getElementById('mabelReadout');
    if (el) {
      el.hidden = false;
      el.innerHTML = '<p class="who oracle">MABEL</p><p>' + line + '</p><p class="vec">PSYCHIC · NOT CANON</p>';
    }
    if (J.API && J.API.appendTalk) J.API.appendTalk('oracle', line);
  }

  function discover() {
    if (found) return;
    found = true;
    pos = behindPoint();
    emerge = 1;
    said = 0;
    speak(0);
    var hint = document.getElementById('hint');
    if (hint) hint.textContent = 'MABEL IS OUT · SHE SPEAKS FOR HERSELF';
  }

  function setGlance(on) {
    glance = !!on;
    if (on) discover();
  }

  function tick(dt) {
    if (!found) {
      pos = behindPoint();
      return;
    }
    if (emerge > 0) {
      emerge = Math.max(0, emerge - dt * 0.32);
      pos.x += (0.85 - pos.x) * 0.06;
      pos.y = 0.38;
      pos.z += (-0.55 - pos.z) * 0.06;
      if (emerge < 0.64 && said < 1) { said = 1; speak(1); }
      if (emerge < 0.22 && said < 2) { said = 2; speak(2); }
    }
  }

  function draw(ctx, project) {
    if (!found && !glance) return;
    var feet = project(pos.x, 0, pos.z);
    var hip = project(pos.x, 0.38, pos.z);
    var head = project(pos.x, 0.72, pos.z);
    if (!feet || !head) return;
    var s = Math.max(4, (head.s || 20) * 0.08);
    ctx.save();
    ctx.strokeStyle = '#638B94';
    ctx.fillStyle = '#638B94';
    ctx.lineWidth = Math.max(1.5, s * 0.18);
    ctx.beginPath();
    ctx.moveTo(feet.x - s * 0.35, feet.y);
    ctx.lineTo(hip.x, hip.y);
    ctx.lineTo(feet.x + s * 0.35, feet.y);
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(head.x, head.y, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1e4c4';
    ctx.beginPath();
    ctx.arc(head.x, head.y + s * 0.08, s * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  J.Mabel = {
    glancing: function () { return glance; },
    found: function () { return found; },
    setGlance: setGlance,
    discover: discover,
    tick: tick,
    draw: draw,
    yawOffset: function () { return glance ? Math.PI : 0; }
  };
})(window.Jack = window.Jack || {});
