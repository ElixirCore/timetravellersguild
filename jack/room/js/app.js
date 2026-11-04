/* Core loop: SENSE → ORIENT → MOVE → FOCUS → REACH → INSPECT → CARD → OPERATE → VOICE → WRITE */
(function (J) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var last = 0;
  var persistAt = 0;

  function paintHud() {
    var proprio = J.Body.proprio();
    var map = {
      limbHead: proprio.head,
      limbHeart: proprio.heart,
      limbLeftArm: proprio.leftArm,
      limbRightArm: proprio.rightArm,
      limbLeftLeg: proprio.leftLeg,
      limbRightLeg: proprio.rightLeg
    };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = map[id];
    });
    var active = proprio.active;
    document.querySelectorAll('#proprio p').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-limb') === active);
    });
    var phase = J.State.get().context.phase;
    document.querySelectorAll('#loop span').forEach(function (s) {
      s.classList.toggle('on', s.getAttribute('data-phase') === phase);
    });
    var word = $('modeWord');
    if (word) word.textContent = J.State.get().context.mode;
    var form = $('jackForm');
    if (form && J.Sprite) {
      var pose = String(J.Sprite.form() || 'sit');
      if (pose === 'deal' || (J.Hopper && J.Hopper.playing && J.Hopper.playing())) form.textContent = 'DEALING';
      else form.textContent = document.body.classList.contains('machine')
        ? ('FORM ' + pose.toUpperCase())
        : 'AT HIS DESK';
    }
    var fill = $('pressureFill');
    if (fill) fill.style.width = Math.round(J.State.get().body.pressure * 100) + '%';
  }

  function nearTherapy() {
    var st = J.State.get();
    var door = J.State.byId('obj-therapy');
    if (!door) return false;
    var dx = st.body.position.x - door.x;
    var dz = st.body.position.z - door.z;
    return (dx * dx + dz * dz) < 2.4;
  }

  function sense() {
    J.State.setPhase(J.State.get().context.phase || 'SENSE');
    if (J.State.get().context.mode === 'ROOM' && nearTherapy() && J.State.get().room.selectedObject === 'obj-therapy') {
      /* standing at the door with it selected is enough to keep pressure up */
    }
  }

  function tick(now) {
    var t = now / 1000;
    var dt = last ? Math.min(0.05, t - last) : 0.016;
    last = t;
    sense();
    J.Body.senseHeart(dt);
    J.Body.move(dt);
    if (J.Sprite) J.Sprite.tick(t, J.State.get());
    if (J.Aperture && J.Aperture.tick) J.Aperture.tick(t, dt);
    if (J.Doors && J.Doors.tick) {
      var st = J.State.get();
      J.Doors.tick(dt, st.room.objects, st.body.position, st.room.selectedObject);
    }
    J.World.render(t);
    J.Tape.pump(dt);
    if (J.Brain) J.Brain.paint(dt);
    paintHud();
    persistAt += dt;
    if (persistAt > 1.6) {
      persistAt = 0;
      J.State.persist();
    }
    requestAnimationFrame(tick);
  }

  function boot() {
    document.body.classList.add('js', 'meet');
    J.World.attach($('stage'));
    if (J.Sprite && $('jackPet')) J.Sprite.attachPortrait($('jackPet'));
    J.Tape.attach($('tapeTrack'));
    if (J.Brain && $('brainGrid')) J.Brain.attach($('brainGrid'));
    J.Cards.bind();
    J.World.load().then(function () {
      var ta = $('consoleIn');
      if (ta) ta.value = J.State.get().context.consoleText || '';
      if (J.State.get().context.mode === 'BENCH') J.Cards.enterBench();
      J.Input.bind();
      $('btnWrite') && $('btnWrite').addEventListener('click', J.Input.writeBack);
      J.Cards.refresh();
      J.State.setPhase('SENSE');
      J.State.nerve('heart', 'sense', 'body', 'awake');
      if (J.API && J.API.connect) {
        J.API.connect().then(function () {
          J.Cards.refresh();
        });
      }
      var mapId = new URLSearchParams(location.search).get('map');
      if (mapId) {
        fetch('/api/map/nodes?id=' + encodeURIComponent(mapId), { cache: 'no-store' }).then(function (res) {
          return res.ok ? res.json() : null;
        }).then(function (data) {
          var n = data && data.nodes && data.nodes[0];
          if (!n) return;
          try {
            sessionStorage.setItem('ttg.jack.map.focus', JSON.stringify({
              id: n.id, name: n.name, anatomy: n.anatomy,
              place: n.geography && n.geography.place, flavour: n.flavour
            }));
          } catch (e) {}
          var ta = $('consoleIn');
          if (ta && !ta.value) {
            ta.placeholder = 'ASK ABOUT ' + String(n.anatomy || '') + ' / ' + String(n.name || mapId);
          }
        }).catch(function () {});
      }
      requestAnimationFrame(tick);
    }).catch(function (err) {
      var line = $('focusLine');
      if (line) line.textContent = 'ROOM FILE MISSING';
      console.error(err);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.Jack = window.Jack || {});
