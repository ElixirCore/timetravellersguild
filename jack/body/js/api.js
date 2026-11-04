/* Jack API. Talks to the live clerk when boot.php answers. No keys in the browser. */
(function (J) {
  'use strict';

  var session = null;
  var ready = null;
  var audioEl = null;

  function $(id) {
    return document.getElementById(id);
  }

  function pad80(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (s.length > 80) s = s.slice(0, 80);
    while (s.length < 80) s += ' ';
    return s;
  }

  function holesFrom(id, text) {
    var src = String(id || '') + String(text || '');
    var holes = [];
    var n = 40;
    for (var i = 0; i < n; i++) {
      var c = src.charCodeAt(i % src.length) || 17;
      holes.push(((c * (i + 3)) + src.length) % 7 === 0);
    }
    return holes;
  }

  function clerkSpeech(card) {
    var p = (card && card.payload) || {};
    var label = p.label || p.title || p.text || 'an unclassified slip';
    var op = card && card.operation ? card.operation : 'observe';
    var lines = {
      inspect: 'Inspection lodged. ' + String(label).replace(/\s+/g, ' ').trim() + ' remains itself. Nothing has been made canon.',
      sniff: 'He has put his nose on the slip. Observation only.',
      makeCard: 'A working card has been punched from the source. The source is still in the room.',
      operate: 'The scalpel produced a derived card. The parent card was not overwritten.',
      speak: 'Spoken from the derived slip only. I will not invent the missing authority.',
      remember: 'Written back as a new object. Source memory was left where it stood.',
      anamnesia: 'Case history recalled. Working surface cleared. Source objects were not touched.'
    };
    var speech = lines[op] || ('The clerk has the slip. ' + String(label).slice(0, 80));
    if (p.instruction) {
      speech += ' Instruction noted: ' + String(p.instruction).slice(0, 80) + '.';
    }
    return speech;
  }

  function live() {
    return !!(session && session.csrf);
  }

  function setClerkLine(text, kind) {
    var el = $('clerkLine');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('live', 'away', 'mock');
    if (kind) el.classList.add(kind);
    document.body.classList.toggle('desk-live', kind === 'live');
  }

  function setMeeting(meeting) {
    if (!meeting) return;
    if (!session) session = {};
    session.meeting = meeting;
    J.API.session = session;
    var summary = meeting.summary || '';
    if (summary) {
      J.State.nerve('heart', 'recall', 'meeting', summary.slice(0, 80));
      if (!J.State.get().context.voiceText) {
        J.State.get().context.voiceText = summary;
      }
    }
  }

  function parseJson(res) {
    return res.text().then(function (raw) {
      var data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
      if (!res.ok) {
        var err = new Error((data && data.error) || ('http_' + res.status));
        err.payload = data;
        throw err;
      }
      return data;
    });
  }

  function shortPath(url) {
    var u = String(url || '');
    if (u.indexOf('/now/jack') !== -1) return '/now/jack';
    if (u.indexOf('boot.php') !== -1) return 'boot.php';
    if (u.indexOf('act.php') !== -1) return 'act.php';
    if (u.indexOf('/jack/speak') !== -1) return '/jack/speak';
    return u.split('/').pop() || 'desk';
  }

  function tapeWait(on) {
    if (J.Tape && J.Tape.wait) J.Tape.wait(on);
  }

  function tapeMark(sub, action, target, result) {
    if (J.Tape && J.Tape.mark) J.Tape.mark(sub, action, target, result);
  }

  function connect() {
    if (ready) return ready;
    setClerkLine('COMING TO THE DESK…', 'away');
    tapeMark('desk', 'boot', 'boot.php', 'calling');
    tapeWait(true);
    ready = fetch('boot.php', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(parseJson).then(function (boot) {
      if (!boot || !boot.csrf) throw new Error('no_csrf');
      session = boot;
      J.API.session = session;
      setMeeting(boot.meeting);
      if (boot.clerk && boot.clerk.available) {
        setClerkLine('AT THE DESK · LIVE', 'live');
      } else {
        setClerkLine('AT THE DESK · QUIET', 'away');
      }
      var opening = boot.opening || (boot.clerk && boot.clerk.greeting) || '';
      if (boot.clerk && boot.clerk.greeting) {
        J.State.nerve('head', 'greet', 'desk', String(boot.clerk.greeting).slice(0, 80));
      }
      if (opening && !talkList().length) {
        appendTalk('clerk', opening);
        J.State.get().context.voiceText = opening;
      }
      tapeMark('desk', 'session', 'csrf', 'signed');
      tapeWait(false);
      return session;
    }).catch(function () {
      session = null;
      J.API.session = null;
      setClerkLine('THE DESK IS A LOCAL MOCK', 'mock');
      tapeMark('desk', 'boot', 'boot.php', 'mock');
      tapeWait(false);
      return null;
    });
    return ready;
  }

  function postForm(url, fields) {
    var data = new FormData();
    Object.keys(fields).forEach(function (k) {
      if (fields[k] == null) return;
      data.set(k, String(fields[k]));
    });
    tapeMark('desk', 'post', shortPath(url), 'in flight');
    tapeWait(true);
    return fetch(url, {
      method: 'POST',
      body: data,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(parseJson).then(function (payload) {
      tapeMark('desk', 'reply', shortPath(url), payload && payload.ok === false ? 'refused' : 'held');
      tapeWait(false);
      return payload;
    }).catch(function (err) {
      tapeMark('desk', 'refuse', shortPath(url), 'dropped');
      tapeWait(false);
      throw err;
    });
  }

  function postAct(doName, fields) {
    fields = fields || {};
    fields.do = doName;
    fields.csrf = session.csrf;
    return postForm('act.php', fields);
  }

  function playBrowserVoice(text) {
    if (window.JackVoice && JackVoice.say) return JackVoice.say(text);
    if (!text || !window.speechSynthesis) return false;
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      u.pitch = 0.72;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  function playDeskVoice(text) {
    playBrowserVoice(text || '');
    return Promise.resolve(true);
  }

  function talkList() {
    var talk = J.State.get().context.talk;
    if (!Array.isArray(talk)) {
      J.State.get().context.talk = talk = [];
    }
    return talk;
  }

  function appendTalk(who, text) {
    var line = String(text || '').trim();
    if (!line) return;
    talkList().push({ who: who, text: line, at: J.State.nowIso() });
    if (talkList().length > 40) talkList().splice(0, talkList().length - 40);
    J.State.persist();
    if (J.Cards && J.Cards.renderTalk) J.Cards.renderTalk();
  }

  function threadForAsk() {
    return talkList().slice(-8).map(function (t) {
      return (t.who === 'visitor' ? 'Visitor: ' : t.who === 'oracle' ? 'Oracle: ' : 'Clerk: ') + String(t.text || '');
    }).join('\n').slice(0, 1500);
  }

  function mapFocus() {
    try {
      var raw = sessionStorage.getItem('ttg.jack.map.focus');
      if (!raw) return '';
      var o = JSON.parse(raw);
      if (!o || !o.id) return '';
      return 'MAP ' + String(o.anatomy || '') + ' / ' + String(o.name || o.id) + (o.place ? ' · ' + o.place : '');
    } catch (e) {
      return '';
    }
  }

  function focusLine() {
    var map = mapFocus();
    var id = J.State.get().room.selectedObject;
    var obj = id ? J.State.byId(id) : null;
    var room = obj ? String(obj.label || obj.id) + (obj.type ? ' [' + obj.type + ']' : '') : '';
    return [map, room].filter(Boolean).join(' · ');
  }

  function askClerk(question) {
    var q = String(question || '').replace(/\s+/g, ' ').trim();
    if (q.length > 2000) q = q.slice(0, 2000);
    return postForm(session.jack_endpoint || '/now/jack', {
      csrf: session.csrf,
      q: q,
      intent: 'ask',
      site: 'body',
      thread: threadForAsk(),
      focus: focusLine()
    });
  }

  function voiceNode(question, speech, liveVoice, sourceIds) {
    var node = J.State.derived({
      type: 'voice',
      sourceIds: sourceIds || [],
      operation: 'ask',
      payload: {
        label: 'ASK',
        question: question,
        speech: speech,
        text: speech,
        live: !!liveVoice
      }
    });
    J.State.get().context.voiceText = speech;
    J.State.rememberNode(node);
    J.State.nerve('head', 'ask', question.slice(0, 40) || '—', node.id);
    return node;
  }

  function ask(question) {
    var q = String(question || '').replace(/\s+/g, ' ').trim();
    if (!q) return Promise.reject(new Error('no_question'));
    if (q.length > 2000) q = q.slice(0, 2000);
    var card = J.State.get().context.activeCard;
    var sourceIds = card ? [card.id] : [];
    var prior = threadForAsk();
    appendTalk('visitor', q);
    tapeMark('head', 'ask', q.slice(0, 24), 'slip in');
    return connect().then(function () {
      if (!live()) {
        var away = 'The clerk is not at this desk. The question was noted and not answered.';
        appendTalk('clerk', away);
        var node = voiceNode(q, away, false, sourceIds);
        playDeskVoice(away);
        return node;
      }
      return postForm(session.jack_endpoint || '/now/jack', {
        csrf: session.csrf,
        q: q,
        intent: 'ask',
        site: 'body',
        thread: prior,
        focus: focusLine()
      }).then(function (res) {
        var speech = (res && res.text) ? String(res.text) : 'The clerk did not answer.';
        appendTalk('clerk', speech);
        var node = voiceNode(q, speech, true, sourceIds);
        playDeskVoice(speech);
        return node;
      });
    });
  }

  function meetingBrief() {
    var m = session && session.meeting;
    if (!m) return '';
    var bits = [];
    if (m.summary) bits.push(m.summary);
    if (m.leaves && m.leaves.length) {
      bits.push('Leaves: ' + m.leaves.slice(0, 4).map(function (n) {
        return n.title || n.slug;
      }).join('; '));
    }
    return bits.join(' ').slice(0, 700);
  }

  function dossierFrom(derived) {
    var st = J.State.get();
    var card = derived || st.context.activeCard;
    var inst = (typeof J.Input !== 'undefined' && J.Input.instruction)
      ? J.Input.instruction()
      : (st.context.consoleText || '');
    var chain = card ? J.State.provenanceChain(card) : st.context.history.slice(-12);
    var lines = [
      'MEETING IN JACK\'S CUBE',
      'Lodge as testimony. Do not write canon. Source memory is untouched.',
      'When: ' + J.State.nowIso(),
      'Instruction: ' + String(inst || 'Remember this meeting.').trim()
    ];
    if (card) {
      var p = card.payload || {};
      lines.push('Working slip: ' + (p.text || p.speech || p.label || card.id));
      lines.push('Operation: ' + (card.operation || '') + ' / ' + (card.type || ''));
      lines.push('Sources: ' + (card.sourceIds || []).join(', '));
    }
    lines.push('Provenance:');
    chain.slice(-16).forEach(function (n) {
      var np = n.payload || {};
      lines.push('- ' + n.id + ' · ' + (n.type || '') + ' · ' + (n.operation || 'source') + ' · ' + (np.label || np.text || n.id));
    });
    var brief = meetingBrief();
    if (brief) lines.push('Already held: ' + brief);
    return lines.join('\n').slice(0, 24000);
  }

  function inspect(object) {
    if (!object) return Promise.reject(new Error('no_object'));
    var rels = (J.State.get().room.relations || []).filter(function (r) {
      return r.from === object.id || r.to === object.id;
    }).map(function (r) {
      return r.from + ' ' + r.kind + ' ' + r.to;
    });
    var node = J.State.derived({
      type: 'inspection',
      sourceIds: [object.id],
      operation: 'inspect',
      payload: {
        label: object.label,
        objectType: object.type,
        notes: (object.metadata && object.metadata.note) || '',
        metadata: object.metadata || {},
        relations: rels,
        observed: 'Direct observation. Nothing inferred.',
        position: { x: object.x, y: object.y, z: object.z }
      }
    });
    J.State.rememberNode(node);
    J.State.nerve('leftArm', 'inspect', object.id, node.id);
    return Promise.resolve(node);
  }

  function makeCard(source) {
    if (!source) return Promise.reject(new Error('no_source'));
    var text = pad80(
      (source.payload && (source.payload.label || source.payload.text)) ||
      source.label ||
      source.id
    );
    var node = J.State.derived({
      type: 'working_card',
      sourceIds: [source.id],
      operation: 'makeCard',
      payload: {
        label: source.label || (source.payload && source.payload.label) || 'CARD',
        cols: 80,
        text: text,
        holes: holesFrom(source.id, text)
      }
    });
    J.State.get().context.activeCard = node;
    J.State.rememberNode(node);
    J.State.nerve('heart', 'makeCard', source.id, node.id);
    return Promise.resolve(node);
  }

  function operate(card, instruction) {
    if (!card) return Promise.reject(new Error('no_card'));
    var inst = String(instruction || '').trim();
    if (!inst) inst = 'MARK';
    var parent = (card.payload && card.payload.text) || '';
    var derivedText = pad80(('DERIVED/' + inst + '/' + parent).slice(0, 80));
    var node = J.State.derived({
      type: 'derived_card',
      sourceIds: [card.id],
      operation: 'operate',
      payload: {
        label: (card.payload && card.payload.label) || 'DERIVED',
        instruction: inst,
        text: derivedText,
        holes: holesFrom(card.id + inst, derivedText),
        mark: 'SCALPEL'
      }
    });
    J.State.get().context.activeCard = node;
    J.State.rememberNode(node);
    J.State.nerve('rightArm', 'operate', card.id, node.id);
    return Promise.resolve(node);
  }

  function mockSpeak(card) {
    var speech = clerkSpeech(card);
    var node = J.State.derived({
      type: 'voice',
      sourceIds: [card.id],
      operation: 'speak',
      payload: {
        label: (card.payload && card.payload.label) || 'VOICE',
        speech: speech,
        text: speech,
        live: false
      }
    });
    J.State.get().context.voiceText = speech;
    J.State.rememberNode(node);
    J.State.nerve('head', 'speak', card.id, node.id);
    appendTalk('clerk', speech);
    playDeskVoice(speech);
    return node;
  }

  function speak(card) {
    if (!card) return Promise.reject(new Error('no_card'));
    return connect().then(function () {
      if (!live()) return mockSpeak(card);
      var inst = (typeof J.Input !== 'undefined' && J.Input.instruction)
        ? J.Input.instruction()
        : (J.State.get().context.consoleText || '');
      var slip = (card.payload && (card.payload.text || card.payload.speech || card.payload.label)) || card.id;
      var q = [
        'You are in your cube, at the Hollerith desk. The visitor is using your body.',
        'Speak from the working slip only. Do not invent authority. Do not write canon.',
        'Working slip: ' + String(slip).slice(0, 400),
        inst ? 'Instruction: ' + String(inst).slice(0, 400) : '',
        meetingBrief() ? 'Meeting already held: ' + meetingBrief() : 'No meeting has been lodged from this cube yet.'
      ].filter(Boolean).join('\n');
      return askClerk(q).then(function (res) {
        var speech = (res && res.text) ? String(res.text) : clerkSpeech(card);
        var node = J.State.derived({
          type: 'voice',
          sourceIds: [card.id],
          operation: 'speak',
          payload: {
            label: (card.payload && card.payload.label) || 'VOICE',
            speech: speech,
            text: speech,
            live: true,
            unavailable: !!(res && res.unavailable)
          }
        });
        J.State.get().context.voiceText = speech;
        J.State.rememberNode(node);
        J.State.nerve('head', 'speak', card.id, node.id);
        appendTalk('clerk', speech);
        playDeskVoice(speech);
        return node;
      }).catch(function () {
        return mockSpeak(card);
      });
    });
  }

  function localRemember(derivedObject) {
    var st = J.State.get();
    var src = J.State.byId((derivedObject.sourceIds || [])[0]);
    var place = src && typeof src.x === 'number'
      ? { x: src.x + 0.9, y: 0, z: src.z + 0.9 }
      : { x: st.body.position.x + Math.sin(st.body.yaw), y: 0, z: st.body.position.z + Math.cos(st.body.yaw) };
    var worldObj = {
      id: J.State.uid('obj-derived'),
      label: ((derivedObject.payload && derivedObject.payload.label) || 'DERIVED') + ' / FILED',
      type: 'derived',
      x: place.x,
      y: place.y,
      z: place.z,
      w: 0.55,
      h: 0.9,
      d: 0.4,
      metadata: {
        note: 'Derived filing. Source memory was not overwritten.',
        from: derivedObject.id
      },
      relations: [],
      author: 'jack',
      sourceIds: [derivedObject.id],
      createdAt: J.State.nowIso(),
      operation: 'remember',
      payload: derivedObject.payload || {}
    };
    var node = J.State.derived({
      type: 'world_object',
      sourceIds: [derivedObject.id],
      operation: 'remember',
      payload: {
        label: worldObj.label,
        worldId: worldObj.id,
        text: (derivedObject.payload && (derivedObject.payload.speech || derivedObject.payload.text)) || worldObj.label,
        canon: false
      }
    });
    J.State.addWorldObject(worldObj);
    J.State.rememberNode(node);
    J.State.nerve('heart', 'remember', derivedObject.id, worldObj.id);
    return node;
  }

  function remember(derivedObject) {
    if (!derivedObject) return Promise.reject(new Error('no_derived'));
    var node = localRemember(derivedObject);
    return connect().then(function () {
      if (!live()) return node;
      var inst = (typeof J.Input !== 'undefined' && J.Input.instruction)
        ? J.Input.instruction()
        : (J.State.get().context.consoleText || '');
      tapeMark('heart', 'lodge', 'testimony', 'pending');
      return postAct('remember', {
        instruction: inst || 'Remember this meeting in the cube.',
        dossier: dossierFrom(derivedObject)
      }).then(function (res) {
        if (!res) return node;
        node.payload.clerk = res.text || '';
        node.payload.leaves = res.nodes || [];
        node.payload.habitatCard = res.card || null;
        node.payload.punchError = res.punch_error || '';
        node.payload.canon = false;
        if (res.text) J.State.get().context.voiceText = res.text;
        setMeeting(res.meeting);
        J.State.persist();
        if (res.text) playDeskVoice(res.text);
        else if (res.voice) playDeskVoice();
        return node;
      }).catch(function () {
        return node;
      });
    });
  }

  function anamnesia() {
    var st = J.State.get();
    var card = st.context.activeCard;
    var chain = card ? J.State.provenanceChain(card) : st.context.history.slice();
    var node = J.State.derived({
      type: 'anamnesia',
      sourceIds: card ? [card.id] : [],
      operation: 'anamnesia',
      payload: {
        label: 'ANAMNESIA',
        recalled: chain.map(function (n) { return n.id; }),
        note: 'Working surface cleared. Source objects remain.'
      }
    });
    st.context.activeCard = null;
    J.State.rememberNode(node);
    J.State.nerve('heart', 'anamnesia', card ? card.id : '—', node.id);
    return connect().then(function () {
      if (!live()) return node;
      return postAct('recall', {}).then(function (res) {
        if (res && res.meeting) {
          node.payload.recalledMeeting = res.meeting;
          node.payload.note = res.meeting.summary || node.payload.note;
          setMeeting(res.meeting);
          J.State.get().context.voiceText = res.meeting.summary || J.State.get().context.voiceText;
        }
        return node;
      }).catch(function () {
        return node;
      });
    });
  }

  J.API = {
    connect: connect,
    inspect: inspect,
    makeCard: makeCard,
    operate: operate,
    ask: ask,
    speak: speak,
    remember: remember,
    anamnesia: anamnesia,
    appendTalk: appendTalk,
    clerkSpeech: clerkSpeech,
    pad80: pad80,
    live: live,
    session: null
  };
})(window.Jack = window.Jack || {});
