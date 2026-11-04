/* Punchcard brain. GCSE machine, justified by the desk that actually runs. */
(function (J) {
  'use strict';

  var grid;
  var built = false;
  var acc = 0;
  var cycle = 0;
  var bus = 0;

  function $(id) { return document.getElementById(id); }

  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function holes(el, n, seed) {
    if (!el) return;
    var src = String(seed || 'JACK');
    el.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var b = document.createElement('i');
      var c = src.charCodeAt(i % src.length) || 11;
      if (((c * (i + 3) + cycle) % 7) === 0) b.className = 'on';
      el.appendChild(b);
    }
  }

  function set(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function on(id, yes) {
    var el = $(id);
    if (el) el.classList.toggle('on', !!yes);
  }

  function snapshot() {
    var st = J.State.get();
    var talk = st.context.talk || [];
    var last = talk.length ? talk[talk.length - 1] : null;
    var card = st.context.activeCard;
    var focus = st.room.selectedObject ? J.State.byId(st.room.selectedObject) : null;
    var sess = (J.API && J.API.session) || {};
    var meet = sess.meeting || {};
    var clerk = sess.clerk || {};
    var busy = J.Tape && J.Tape.busy && J.Tape.busy();
    var live = J.API && J.API.live && J.API.live();
    return {
      st: st,
      talk: talk,
      last: last,
      card: card,
      focus: focus,
      sess: sess,
      meet: meet,
      clerk: clerk,
      busy: busy,
      live: live,
      phase: st.context.phase || 'SENSE',
      pressure: st.body.pressure,
      hist: (st.context.history || []).length,
      events: (st.nervousSystem.events || []).length
    };
  }

  function build() {
    if (!grid || built) return;
    built = true;
    var spec = [
      { id: 'in', title: 'INPUT', gcse: 'Input → Process → Output', why: 'A computer needs data in before it can work. Here: the typed slip, the pointer, the limbs.' },
      { id: 'fde', title: 'FETCH · DECODE · EXECUTE', gcse: 'The instruction cycle', why: 'One ASK is one cycle. Fetch the signed slip. Decode intent. Execute the clerk. Then write back.' },
      { id: 'cu', title: 'CONTROL UNIT', gcse: 'CU / session', why: 'The CU decides what is allowed. CSRF is a one-session token. An unsigned slip is refused.' },
      { id: 'alu', title: 'ALU / CLERK', gcse: 'Process, not invent', why: 'The ALU compares. Jack compares testimony to records. Inference is not observation. He does not become the field.' },
      { id: 'reg', title: 'REGISTERS', gcse: 'Working set', why: 'Tiny, fast memory for the current instruction: phase, focus, working card, pressure.' },
      { id: 'ram', title: 'RAM · VOLATILE', gcse: 'Primary memory', why: 'This sitting’s conversation lives in page memory and localStorage. Reset Body wipes it. The server does not hold the chat log.' },
      { id: 'store', title: 'SECONDARY STORAGE', gcse: 'Non-volatile store', why: 'WRITE BACK lodges a pending leaf and may punch one habitat card. Pending is not canon. A keeper writes canon.' },
      { id: 'bus', title: 'DATA BUS', gcse: 'Client–server', why: 'The browser is the client. GET boot.php starts the session. POST /now/jack is the ask. Same origin. No keys in the browser.' },
      { id: 'bin', title: 'PUNCH = BINARY', gcse: '1 and 0', why: 'A hole is presence. A blank is absence. Eighty columns is a fixed-width record, like a byte with more bits.' },
      { id: 'out', title: 'OUTPUT', gcse: 'Output devices', why: 'Process must be shown. Talk is the display. The ribbon is a trace. Voice is queued server-side, never chosen by the page.' },
      { id: 'sense', title: 'EMBEDDED SENSORS', gcse: 'Embedded system', why: 'The body is a sensor platform: yaw, reach, pressure. The loop SENSE→WRITE is the control program.' },
      { id: 'ethics', title: 'CONSENT · IMPACT', gcse: 'Impacts of digital tech', why: 'Memory is the territory. He may lodge testimony. He may not write canon. Revoked material must not influence a later reply.' }
    ];
    spec.forEach(function (m) {
      var art = document.createElement('article');
      art.className = 'brain-mod';
      art.id = 'mod-' + m.id;
      art.innerHTML =
        '<header><h3>' + m.title + '</h3><p class="gcse">' + m.gcse + '</p></header>' +
        '<div class="holes" id="holes-' + m.id + '"></div>' +
        '<p class="why">' + m.why + '</p>' +
        '<p class="read" id="read-' + m.id + '">—</p>' +
        (m.id === 'fde' ? '<div class="fde" id="fdeLamps"><b data-s="F">FETCH</b><b data-s="D">DECODE</b><b data-s="E">EXECUTE</b></div>' : '') +
        (m.id === 'bus' ? '<div class="bus" id="busTrack"><i id="busBit"></i></div>' : '');
      grid.appendChild(art);
    });
  }

  function paint(dt) {
    if (!grid || !document.body.classList.contains('machine')) return;
    if (!built) build();
    acc += dt || 0.016;
    cycle = (cycle + 1) % 240;
    var s = snapshot();
    var step = s.busy ? Math.floor((acc * 6) % 3) : Math.floor((acc * 1.4) % 3);
    var lamps = grid.querySelectorAll('#fdeLamps b');
    for (var i = 0; i < lamps.length; i++) lamps[i].classList.toggle('on', i === step);

    bus = (bus + (s.busy ? 4 : 1.2)) % 100;
    var bit = $('busBit');
    if (bit) bit.style.left = bus + '%';

    ['in', 'fde', 'cu', 'alu', 'reg', 'ram', 'store', 'bus', 'bin', 'out', 'sense', 'ethics'].forEach(function (id) {
      holes($('holes-' + id), 16, id + cycle + (s.last && s.last.text ? s.last.text : ''));
    });
    on('mod-fde', s.busy);
    on('mod-bus', s.busy);
    on('mod-alu', s.busy);
    on('mod-cu', s.live);

    var focus = s.focus ? (s.focus.label || s.focus.id) : 'none';
    var card = s.card ? (s.card.id || 'card') : 'empty';
    set('read-in', 'Last slip: ' + (s.last && s.last.who === 'visitor' ? clip(s.last.text, 64) : 'none in flight') + ' · focus ' + clip(focus, 24));
    set('read-fde', s.busy ? 'Cycle in flight. The clerk has the slip.' : ('Idle after ' + s.phase + '. Waiting for input.'));
    set('read-cu', (s.live ? 'Session signed. CSRF held.' : 'No session. Desk is a local mock.') + ' Intent allowed: ask · lodge.');
    set('read-alu', s.last && s.last.who === 'clerk' ? clip(s.last.text, 90) : 'No clerk result in the working set.');
    set('read-reg', 'PHASE ' + s.phase + ' · CARD ' + clip(card, 18) + ' · P ' + s.pressure.toFixed(2) + ' · HIST ' + s.hist);
    var leaves = (s.meet.leaves || []).length;
    var cards = (s.meet.cards || []).length;
    set('read-store', 'Pending leaves ' + leaves + ' · habitat cards ' + cards + ' · write-ready ' + (s.meet.write_ready ? 'YES' : 'NO') + ' · not canon.');
    set('read-bus', s.busy ? 'Packet on the bus → /now/jack' : (s.live ? 'Bus idle. Link to desk is up.' : 'Bus down. Local only.'));
    set('read-bin', '80-col record. Holes are 1. Blanks are 0. The ribbon is the trace.');
    set('read-out', clip(s.st.context.voiceText || '—', 80));
    var yaw = Math.round(((s.st.body.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 180 / Math.PI);
    set('read-sense', 'YAW ' + yaw + ' · ENERGY ' + s.st.body.energy.toFixed(2) + ' · OBJECTS ' + s.st.room.objects.length);
    set('read-ethics', 'Canon: no. Lodge: testimony. Consent: session. Keys: never in the browser.');
    set('read-ram', s.talk.length + ' turns this sitting · ' + s.events + ' nerve events. Volatile if you reset.');
  }

  function attach(el) {
    grid = el;
    built = false;
    if (el) el.innerHTML = '';
  }

  function open() {
    document.body.classList.add('machine');
    if ($('brain')) $('brain').hidden = false;
    if ($('btnMachine')) $('btnMachine').setAttribute('aria-pressed', 'true');
    build();
    paint(0);
  }

  function close() {
    document.body.classList.remove('machine');
    if ($('brain')) $('brain').hidden = true;
    if ($('btnMachine')) $('btnMachine').setAttribute('aria-pressed', 'false');
  }

  function toggle() {
    if (document.body.classList.contains('machine')) close();
    else open();
  }

  J.Brain = {
    attach: attach,
    paint: paint,
    open: open,
    close: close,
    toggle: toggle
  };
})(window.Jack = window.Jack || {});
