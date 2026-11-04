/* Punchcards, bench, inspect sheet, provenance. Source memory stays put. */
(function (J) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s);
  }

  function renderPunch(card) {
    var host = $('punchCard');
    if (!host) return;
    host.innerHTML = '';
    if (!card) {
      host.textContent = 'NO WORKING CARD. INSPECT, THEN CARD.';
      return;
    }
    var p = card.payload || {};
    var ruler = document.createElement('div');
    ruler.className = 'punch-ruler';
    ruler.textContent = 'IBM 5081 · 80 COL · ' + card.id;
    var text = document.createElement('div');
    text.className = 'punch-text';
    text.textContent = p.text || p.speech || card.id;
    var holes = document.createElement('div');
    holes.className = 'punch-holes';
    var bits = p.holes || [];
    for (var i = 0; i < 40; i++) {
      var b = document.createElement('b');
      if (bits[i]) b.className = 'on';
      holes.appendChild(b);
    }
    host.appendChild(ruler);
    host.appendChild(text);
    host.appendChild(holes);
  }

  function renderReel() {
    var track = $('reelTrack');
    if (!track) return;
    var hist = J.State.get().context.history;
    var active = J.State.get().context.activeCard;
    track.innerHTML = '';
    var start = Math.max(0, hist.length - 16);
    for (var i = start; i < hist.length; i++) {
      var n = hist[i];
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'reel-node' + (active && active.id === n.id ? ' on' : '');
      el.textContent = n.type;
      var meta = document.createElement('i');
      meta.textContent = (n.operation || '') + ' · ' + n.id.slice(-8);
      el.appendChild(meta);
      el.addEventListener('click', function (node) {
        return function () {
          J.State.get().context.activeCard = node.type.indexOf('card') !== -1 || node.type === 'voice' ? node : J.State.get().context.activeCard;
          if (node.type === 'working_card' || node.type === 'derived_card') {
            J.State.get().context.activeCard = node;
          }
          refresh();
        };
      }(n));
      track.appendChild(el);
    }
  }

  function renderProv(node) {
    var list = $('provList');
    if (!list) return;
    list.innerHTML = '';
    if (!node) return;
    var chain = J.State.provenanceChain(node);
    for (var i = 0; i < chain.length; i++) {
      var n = chain[i];
      var li = document.createElement('li');
      li.textContent = String(n.type || n.label || 'OBJECT').toUpperCase() + (n.operation ? ' · ' + n.operation : ' · SOURCE');
      var sp = document.createElement('span');
      sp.textContent = n.id + (n.createdAt ? ' · ' + n.createdAt : '') + ' · author ' + (n.author || 'world');
      li.appendChild(sp);
      list.appendChild(li);
    }
  }

  function renderPressure() {
    var fill = $('pressureFill');
    var bar = $('pressureBar');
    var note = $('pressureNote');
    var p = J.State.get().body.pressure;
    var pct = Math.round(p * 100);
    if (fill) fill.style.width = pct + '%';
    if (bar) bar.setAttribute('aria-valuenow', String(pct));
    if (note) {
      note.textContent = p > 0.7
        ? 'Pressure high. Unresolved cards are still on the bench.'
        : (p > 0.35 ? 'Context is loaded. Source memory remains untouched.' : 'The heart is quiet.');
    }
  }

  function showInspect(node) {
    var sheet = $('inspectSheet');
    if (!sheet || !node) return;
    $('inspectKind').textContent = (node.type || 'INSPECTION').toUpperCase();
    $('inspectTitle').textContent = (node.payload && node.payload.label) || node.id;
    var p = node.payload || {};
    var lines = [];
    lines.push('ID        ' + node.id);
    lines.push('TYPE      ' + node.type);
    lines.push('OPERATION ' + node.operation);
    lines.push('AUTHOR    ' + node.author);
    lines.push('CREATED   ' + node.createdAt);
    lines.push('SOURCES   ' + (node.sourceIds || []).join(', '));
    if (p.objectType) lines.push('OBJECT    ' + p.objectType);
    if (p.observed) lines.push(p.observed);
    if (p.notes) lines.push(p.notes);
    if (p.note) lines.push(p.note);
    if (p.relations && p.relations.length) {
      lines.push('RELATIONS');
      for (var i = 0; i < p.relations.length; i++) lines.push('  ' + p.relations[i]);
    }
    if (p.question) lines.push('ASKED     ' + p.question);
    if (p.speech) lines.push(p.speech);
    if (p.clerk) lines.push(p.clerk);
    if (p.instruction) lines.push('INSTR     ' + p.instruction);
    if (p.leaves && p.leaves.length) {
      lines.push('LEAVES    PENDING · NOT CANON');
      for (var li = 0; li < p.leaves.length && li < 8; li++) {
        var leaf = p.leaves[li];
        lines.push('  ' + (leaf.title || leaf.slug || 'leaf') + (leaf.status ? ' · ' + leaf.status : ''));
      }
    }
    if (p.habitatCard && p.habitatCard.card) {
      lines.push('HABITAT   BOX ' + (p.habitatCard.box != null ? p.habitatCard.box : '—') + ' · ' + p.habitatCard.card);
    }
    if (p.recalledMeeting && p.recalledMeeting.summary) {
      lines.push('RECALL    ' + p.recalledMeeting.summary);
    }
    $('inspectBody').textContent = lines.join('\n');
    $('inspectProv').textContent = 'PROVENANCE VISIBLE · SOURCE NOT OVERWRITTEN';
    sheet.hidden = false;
  }

  function hideInspect() {
    var sheet = $('inspectSheet');
    if (sheet) sheet.hidden = true;
  }

  function setMode(mode) {
    J.State.setMode(mode);
    document.body.classList.toggle('mode-bench', mode === 'BENCH');
    var bench = $('bench');
    if (bench) bench.hidden = mode !== 'BENCH';
    var word = $('modeWord');
    if (word) word.textContent = mode;
    J.State.nerve('heart', mode === 'BENCH' ? 'enterBench' : 'leaveBench', 'obj-therapy', mode);
    refresh();
  }

  function enterBench() {
    hideInspect();
    setMode('BENCH');
  }

  function leaveBench() {
    setMode('ROOM');
    hideInspect();
  }

  function renderTalk() {
    var log = $('talkLog');
    if (!log) return;
    var talk = J.State.get().context.talk || [];
    var wait = $('talkWait');
    if (wait) wait.hidden = talk.length > 0;
    log.hidden = false;
    var turns = log.querySelectorAll('.talk-turn');
    for (var r = 0; r < turns.length; r++) turns[r].remove();
    for (var i = 0; i < talk.length; i++) {
      var t = talk[i];
      var el = document.createElement('div');
      el.className = 'talk-turn ' + (t.who === 'visitor' ? 'visitor' : t.who === 'oracle' ? 'oracle' : 'clerk');
      var who = document.createElement('span');
      who.className = 'who';
      who.textContent = t.who === 'visitor' ? 'VISITOR' : t.who === 'oracle' ? 'MABEL' : 'JACK';
      var p = document.createElement('p');
      p.textContent = t.text || '';
      el.appendChild(who);
      el.appendChild(p);
      log.appendChild(el);
    }
    log.scrollTop = log.scrollHeight;
  }

  function refresh() {
    var st = J.State.get();
    renderTalk();
    renderPunch(st.context.activeCard);
    renderReel();
    renderProv(st.context.activeCard || (st.context.history.length ? st.context.history[st.context.history.length - 1] : null));
    renderPressure();
    var voice = $('voiceOut');
    if (voice) voice.textContent = st.context.voiceText || '—';
    var dump = $('debugDump');
    if (dump && !$('debug').hidden) {
      var snap = {
        mode: st.context.mode,
        focus: st.room.selectedObject,
        card: st.context.activeCard && st.context.activeCard.id,
        desk: J.API && J.API.live ? J.API.live() : false,
        history: st.context.history.length,
        objects: st.room.objects.length,
        events: st.nervousSystem.events.length,
        yaw: st.body.yaw,
        position: st.body.position
      };
      dump.textContent = JSON.stringify(snap, null, 2);
    }
  }

  function exportFile() {
    var blob = new Blob([JSON.stringify(J.State.exportState(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jack-body-state.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    J.State.nerve('head', 'export', 'state', 'ok');
  }

  function resetBody() {
    J.State.resetBody();
    location.reload();
  }

  function bind() {
    $('btnCloseInspect') && $('btnCloseInspect').addEventListener('click', hideInspect);
    $('btnLeaveBench') && $('btnLeaveBench').addEventListener('click', leaveBench);
    $('btnExport') && $('btnExport').addEventListener('click', exportFile);
    $('btnReset') && $('btnReset').addEventListener('click', resetBody);
    J.State.on(function (type) {
      if (type === 'nerve' || type === 'history' || type === 'select' || type === 'mode' || type === 'world') refresh();
    });
  }

  J.Cards = {
    bind: bind,
    refresh: refresh,
    renderTalk: renderTalk,
    showInspect: showInspect,
    hideInspect: hideInspect,
    enterBench: enterBench,
    leaveBench: leaveBench,
    exportFile: exportFile,
    resetBody: resetBody
  };
})(window.Jack = window.Jack || {});
