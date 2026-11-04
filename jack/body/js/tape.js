/* Punchcard ticker. Desk workings made visible. Wait punches are live only. */
(function (J) {
  'use strict';

  var track;
  var host;
  var offset = 0;
  var pace = 28;
  var waiting = false;
  var waitAcc = 0;
  var idleAcc = 0;
  var col = 1;
  var lastNerve = 0;

  var WAIT_LINES = [
    'SIGN SLIP',
    'OPEN DRAWER',
    'SEARCH FIELD',
    'READ THREAD',
    'PUNCH COL',
    'HOLD LEAF',
    'ASK CLERK',
    'WAIT REPLY'
  ];
  var IDLE_LINES = [
    'DESK LIVE',
    'CSRF HELD',
    'NO SLIP IN FLIGHT',
    'SESSION OPEN',
    'SOURCE UNTOUCHED',
    '80 COL READY'
  ];

  function holesFrom(text) {
    var src = String(text || 'JACK');
    var bits = [];
    for (var i = 0; i < 12; i++) {
      var c = src.charCodeAt(i % src.length) || 17;
      bits.push(((c * (i + 3)) + src.length) % 5 === 0);
    }
    return bits;
  }

  function cell(ev) {
    var el = document.createElement('div');
    el.className = 'tape-cell' + (ev.live ? ' live' : '');
    var holes = document.createElement('span');
    holes.className = 'tape-holes';
    var bits = holesFrom((ev.action || '') + (ev.target || '') + (ev.result || ''));
    for (var i = 0; i < bits.length; i++) {
      var hole = document.createElement('i');
      if (bits[i]) hole.className = 'on';
      holes.appendChild(hole);
    }
    var line = document.createElement('span');
    line.className = 'tape-line';
    var t = (ev.time || '').slice(11, 19) || '--:--:--';
    var target = String(ev.target || '—').replace(/\s+/g, ' ').slice(0, 22);
    var result = String(ev.result || '').replace(/\s+/g, ' ').slice(0, 18);
    line.textContent = (t + '  ' + String(ev.action || '').toUpperCase() + '  ' + target + (result ? '  → ' + result : '')).slice(0, 80);
    el.appendChild(holes);
    el.appendChild(line);
    return el;
  }

  function trim() {
    if (!track) return;
    while (track.children.length > 48) track.removeChild(track.firstChild);
  }

  function append(ev) {
    if (!track) return;
    track.appendChild(cell(ev));
    trim();
  }

  function feed(action, target, result) {
    append({
      time: new Date().toISOString(),
      action: action,
      target: target,
      result: result,
      live: true
    });
  }

  function mark(subsystem, action, target, result) {
    if (J.State && J.State.nerve) {
      J.State.nerve(subsystem || 'desk', action, target, result);
    } else {
      feed(action, target, result);
    }
  }

  function setHost(on) {
    if (!host) return;
    host.classList.toggle('punching', !!on);
  }

  function wait(on) {
    waiting = !!on;
    pace = waiting ? 110 : 28;
    setHost(waiting);
    if (waiting) {
      waitAcc = 0;
      feed('PUNCH', 'COL ' + (col < 10 ? '0' : '') + col, 'IN FLIGHT');
    } else {
      feed('READER', 'IDLE', 'SLIP CLEARED');
    }
  }

  function punchWait() {
    var line = WAIT_LINES[col % WAIT_LINES.length];
    var n = (col < 10 ? '0' : '') + col;
    col = col >= 80 ? 1 : col + 1;
    feed(line === 'PUNCH COL' ? 'PUNCH' : line, line === 'PUNCH COL' ? ('COL ' + n) : ('COL ' + n), 'WORKING');
  }

  function punchIdle() {
    var live = J.API && J.API.live && J.API.live();
    var line = IDLE_LINES[Math.floor(Date.now() / 2500) % IDLE_LINES.length];
    feed(live ? line : 'DESK MOCK', 'RIBBON', live ? 'HELD' : 'LOCAL');
  }

  function pump(dt) {
    if (!track) return;
    if (waiting) {
      waitAcc += dt;
      if (waitAcc > 0.42) {
        waitAcc = 0;
        punchWait();
      }
    } else {
      idleAcc += dt;
      if (idleAcc > 2.4) {
        idleAcc = 0;
        punchIdle();
      }
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    offset -= dt * pace;
    var width = track.scrollWidth;
    if (width > 8 && -offset > width) offset = 0;
    track.style.transform = 'translateX(' + Math.round(offset) + 'px)';
  }

  function rebuild() {
    if (!track) return;
    track.innerHTML = '';
    var events = (J.State && J.State.get) ? J.State.get().nervousSystem.events : [];
    var start = Math.max(0, events.length - 24);
    for (var i = start; i < events.length; i++) append(events[i]);
    lastNerve = events.length;
  }

  J.Tape = {
    attach: function (el) {
      track = el;
      host = el && el.parentNode;
      rebuild();
      if (J.State && J.State.on) {
        J.State.on(function (type, detail) {
          if (type === 'nerve' && detail) {
            lastNerve += 1;
            append(detail);
          }
        });
      }
      feed('RIBBON', 'IBM 5081', 'THREADED');
    },
    pump: pump,
    rebuild: rebuild,
    feed: feed,
    mark: mark,
    wait: wait,
    busy: function () { return waiting; }
  };
})(window.Jack = window.Jack || {});
