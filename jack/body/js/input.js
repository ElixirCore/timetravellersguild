/* Mobile-first body input. Keyboard must not destroy camera or console text. */
(function (J) {
  'use strict';

  var pointers = {};
  var pinch = null;
  var lastTap = 0;
  var lastTapId = null;
  var dragging = false;
  var moved = 0;
  var lastX = 0;
  var lastY = 0;
  var lastT = 0;
  var vx = 0;
  var focusedConsole = false;
  var asking = false;

  function $(id) { return document.getElementById(id); }

  function onField(el) {
    return !!(el && el.closest && (el.closest('#console') || el.closest('#bench') || el.closest('#inspectSheet') || el.closest('#hopperTray') || el.closest('#debug') || el.closest('#mabelReadout') || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.tagName === 'INPUT'));
  }

  function syncConsoleFromState() {
    var ta = $('consoleIn');
    var st = J.State.get();
    if (!ta || focusedConsole) return;
    if (ta.value !== st.context.consoleText) ta.value = st.context.consoleText || '';
  }

  function saveConsole() {
    var ta = $('consoleIn');
    if (!ta) return;
    J.State.get().context.consoleText = ta.value;
    J.State.persist();
  }

  function instruction() {
    var ta = $('consoleIn');
    return ta ? ta.value : (J.State.get().context.consoleText || '');
  }

  function selected() {
    var id = J.State.get().room.selectedObject || J.World.hoverId();
    return id ? J.State.byId(id) : null;
  }

  function workingSource() {
    var st = J.State.get();
    if (st.context.activeCard) return st.context.activeCard;
    if (st.context.sourceObject) return J.State.byId(st.context.sourceObject);
    return selected();
  }

  function selectAt(x, y) {
    var id = J.World.objectAt(x, y) || J.World.hoverId();
    if (!id) return null;
    J.State.selectObject(id);
    J.State.setPhase('FOCUS');
    J.State.nerve('head', 'select', id, 'focus');
    if (id === 'obj-aperture' && J.Aperture && J.Aperture.look) J.Aperture.look();
    var obj = J.State.byId(id);
    if (obj && J.Doors && J.Doors.isDoor(obj) && J.Doors.hrefOf(obj)) {
      J.Doors.enter(obj);
      return obj;
    }
    if (obj && obj.enter === 'bench') {
      /* proximity enter handled in app; selection is enough here */
    }
    return obj;
  }

  function inspectTarget(obj) {
    var target = obj || selected();
    if (!target) return;
    if (J.Doors && J.Doors.isDoor(target) && J.Doors.enter(target)) return;
    J.Body.reach(true);
    J.State.setPhase('INSPECT');
    J.API.inspect(target).then(function (node) {
      J.State.get().context.sourceObject = target.id;
      J.Body.hold(target.id);
      J.Cards.showInspect(node);
      J.Cards.refresh();
      if (target.enter === 'bench') J.Cards.enterBench();
      setTimeout(function () { J.Body.reach(false); }, 280);
    });
  }

  function openAperture(fallback) {
    var q = String(instruction() || '').trim();
    if (!q) q = fallback || 'Open the aperture. Do not invent a record.';
    var ready = J.API && J.API.connect ? J.API.connect() : Promise.resolve();
    return ready.then(function () {
      if (J.Aperture && J.Aperture.turn) return J.Aperture.turn(q);
      return null;
    }).then(function (payload) {
      J.Cards.refresh();
      return payload;
    });
  }

  function makeCard() {
    var src = J.State.get().context.history.filter(function (n) { return n.type === 'inspection'; }).pop() || workingSource();
    if (src && src.id === 'obj-hopper' && J.Hopper && J.Hopper.play) {
      J.Hopper.play();
      return;
    }
    if (!src) {
      if (J.Hopper && J.Hopper.play) {
        J.Hopper.play();
        return;
      }
      openAperture('No card is on the desk. Hold what is witnessed.');
      return;
    }
    J.State.setPhase('CARD');
    J.API.makeCard(src).then(function () {
      J.Cards.refresh();
      if (J.State.get().context.mode !== 'BENCH') J.Cards.showInspect(J.State.get().context.activeCard);
    });
  }

  function scalpel() {
    var card = J.State.get().context.activeCard;
    if (!card) {
      makeCard();
      return;
    }
    J.Body.scalpelMode('punch');
    J.State.setPhase('OPERATE');
    J.API.operate(card, instruction() || 'MARK').then(function () {
      J.Cards.refresh();
      J.Body.scalpelMode('idle');
    });
  }

  function setAsking(on) {
    asking = !!on;
    var btn = $('btnAsk');
    if (btn) {
      btn.disabled = asking;
      btn.textContent = asking ? 'ASKING…' : 'ASK';
    }
  }

  function ask() {
    var q = String(instruction() || '').trim();
    if (!q) {
      if (J.API.appendTalk) J.API.appendTalk('clerk', 'Type a question, then ASK. I am at the desk.');
      J.Cards.refresh();
      return;
    }
    if (asking) return;
    setAsking(true);
    J.State.setPhase('VOICE');
    var ta = $('consoleIn');
    if (ta) ta.value = '';
    J.State.get().context.consoleText = '';
    J.API.ask(q).then(function () {
      J.Cards.refresh();
    }).catch(function () {
      if (J.API.appendTalk) J.API.appendTalk('clerk', 'The clerk did not take the slip.');
      J.Cards.refresh();
    }).then(function () {
      setAsking(false);
    });
  }

  function voice() {
    var card = J.State.get().context.activeCard || J.State.get().context.history.filter(function (n) {
      return n.type === 'derived_card' || n.type === 'working_card' || n.type === 'inspection';
    }).pop();
    if (!card) return;
    J.State.setPhase('VOICE');
    J.API.speak(card).then(function () {
      J.Cards.refresh();
    });
  }

  function anamnesia() {
    openAperture('Recall what is held in this cube. Do not invent a record.').then(function (payload) {
      return J.API.anamnesia().then(function (node) {
        if (!payload) J.Cards.showInspect(node);
        J.Cards.refresh();
        return node;
      });
    });
  }

  function writeBack() {
    var card = J.State.get().context.activeCard;
    if (!card) return;
    J.State.setPhase('WRITE');
    J.API.remember(card).then(function () {
      J.Cards.refresh();
    });
  }

  function down(e) {
    if (onField(e.target)) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      var a = pointers[ids[0]];
      var b = pointers[ids[1]];
      pinch = {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        z: J.State.get().body.position.z
      };
      dragging = false;
      return;
    }
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = performance.now();
    vx = 0;
    var hint = $('hint');
    if (hint) hint.classList.add('hide');
  }

  function move(e) {
    if (J.World.pointer) J.World.pointer(e.clientX, e.clientY, true);
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2 && pinch) {
      var a = pointers[ids[0]];
      var b = pointers[ids[1]];
      var dist = Math.hypot(b.x - a.x, b.y - a.y);
      var delta = (dist - pinch.dist) / 90;
      J.Body.drive(0, delta);
      J.State.setPhase('MOVE');
      return;
    }
    if (J.World.pointer) J.World.pointer(e.clientX, e.clientY, true);
    if (!dragging) return;
    var now = performance.now();
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    J.Body.look(-dx * 0.0055, dy * 0.0035);
    vx = -dx / Math.max(8, now - lastT) * 0.08;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = now;
  }

  function up(e) {
    var start = pointers[e.pointerId];
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    if (!dragging) return;
    dragging = false;
    if (moved < 12 && start) {
      var obj = selectAt(e.clientX, e.clientY);
      if (obj) inspectTarget(obj);
      return;
    }
    if (Math.abs(vx) > 0.012) J.Body.flick(vx);
    vx = 0;
  }

  function keydown(e) {
    if (focusedConsole) {
      if (e.key === 'Escape') $('consoleIn').blur();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ask();
      }
      return;
    }
    J.Body.setKey(e.code, true);
    if (e.code === 'KeyE') {
      e.preventDefault();
      var door = selected();
      if (door && J.Doors && J.Doors.enter(door)) return;
    }
    if (e.code === 'KeyQ') { e.preventDefault(); if (J.Mabel && J.Mabel.setGlance) J.Mabel.setGlance(true); }
    if (e.code === 'KeyI') { e.preventDefault(); inspectTarget(); }
    if (e.code === 'KeyC') { e.preventDefault(); makeCard(); }
    if (e.code === 'KeyV') { e.preventDefault(); voice(); }
    if (e.code === 'KeyX') { e.preventDefault(); scalpel(); }
    if (e.code === 'KeyD') {
      e.preventDefault();
      var box = $('debug');
      if (box) {
        box.hidden = !box.hidden;
        J.Cards.refresh();
      }
    }
    if (e.code === 'KeyR' && e.shiftKey) { e.preventDefault(); writeBack(); }
  }

  function keyup(e) {
    J.Body.setKey(e.code, false);
    if (e.code === 'KeyQ' && J.Mabel && J.Mabel.setGlance) J.Mabel.setGlance(false);
  }

  function viewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    var kb = (window.innerHeight - vv.height) > 90;
    document.body.classList.toggle('kb-open', kb);
    document.documentElement.style.setProperty('--vv-top', vv.offsetTop + 'px');
    document.documentElement.style.setProperty('--vv-height', vv.height + 'px');
    if (J.World && J.World.resize) J.World.resize();
  }

  function bind() {
    var stage = $('stage');
    var app = document.body;
    var greeted = false;
    function greetOnce() {
      if (window.JackVoice && JackVoice.unlock) JackVoice.unlock();
      if (greeted) return;
      greeted = true;
      var talk = (J.State.get().context.talk || []).filter(function (row) { return row.who === 'clerk'; });
      var line = talk.length ? talk[talk.length - 1].text : '';
      if (!line && J.API && J.API.session) {
        line = J.API.session.opening || ((J.API.session.clerk && J.API.session.clerk.greeting) || '');
      }
      if (line && window.JackVoice && JackVoice.say) JackVoice.say(line);
    }
    stage.addEventListener('pointerdown', function () { greetOnce(); });
    stage.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('resize', function () {
      J.World.resize();
      viewport();
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', viewport);
      window.visualViewport.addEventListener('scroll', viewport);
    }
    var ta = $('consoleIn');
    if (ta) {
      ta.value = J.State.get().context.consoleText || '';
      ta.addEventListener('focus', function () { focusedConsole = true; });
      ta.addEventListener('blur', function () { focusedConsole = false; saveConsole(); });
      ta.addEventListener('input', saveConsole);
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          saveConsole();
          ask();
        }
      });
    }
    var machine = $('btnMachine');
    if (machine) {
      machine.addEventListener('click', function () {
        if (J.Brain) J.Brain.toggle();
        else {
          var on = document.body.classList.toggle('machine');
          machine.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
      });
    }
    $('btnAsk') && $('btnAsk').addEventListener('click', ask);
    $('btnInspect') && $('btnInspect').addEventListener('click', function () { inspectTarget(); });
    $('btnCard') && $('btnCard').addEventListener('click', makeCard);
    $('btnScalpel') && $('btnScalpel').addEventListener('click', scalpel);
    $('btnVoice') && $('btnVoice').addEventListener('click', voice);
    $('btnAnamnesia') && $('btnAnamnesia').addEventListener('click', anamnesia);
    $('btnPunch') && $('btnPunch').addEventListener('click', scalpel);
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    stage.addEventListener('touchmove', function (e) {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); });
    viewport();
  }

  J.Input = {
    bind: bind,
    ask: ask,
    inspectTarget: inspectTarget,
    makeCard: makeCard,
    scalpel: scalpel,
    voice: voice,
    anamnesia: anamnesia,
    writeBack: writeBack,
    instruction: instruction,
    syncConsoleFromState: syncConsoleFromState
  };
})(window.Jack = window.Jack || {});
