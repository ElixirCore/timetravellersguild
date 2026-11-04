/* Guild chat client. Plain JS, no build. Polls /people/chat/api.php. */
(function () {
  'use strict';
  var root = document.getElementById('chat');
  if (!root) return;

  var API = root.dataset.api;
  var CSRF = root.dataset.csrf;
  var ME = Number(root.dataset.me);
  var JACK = 0;
  var FAST = 2500, SLOW = 15000, MAX_BACKOFF = 60000;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    list: $('convList'), log: $('log'), msgs: $('msgs'), older: $('olderBtn'),
    title: $('threadTitle'), sub: $('threadSub'), status: $('threadStatus'),
    form: $('composer'), body: $('body'), send: $('sendBtn'), back: $('backBtn'),
    people: $('peopleList'), filter: $('peopleFilter'), peopleBox: $('peopleBox'), emailDm: $('emailDm')
  };

  var state = {
    convs: [], active: 0, after: 0, since: 0, oldest: 0, hasMore: false,
    people: {}, online: {}, directory: [], me: null,
    seen: {}, typingAt: 0, timer: 0, backoff: 0, inflight: false, baseTitle: document.title,
    jackThinking: false, statusNote: '', statusErr: false, statusUntil: 0
  };
  var isTouch = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  /* ── network ── */
  function api(op, data) {
    var payload = Object.assign({ op: op }, data || {});
    return fetch(API, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': CSRF },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'The exchange jammed.' }; }).then(function (j) {
        j.status = r.status;
        if (j.signin) location.href = '/people/auth/';
        if (j.reload) location.reload();
        return j;
      });
    });
  }

  function schedule(ms) {
    clearTimeout(state.timer);
    state.timer = setTimeout(sync, ms);
  }

  function sync() {
    if (state.inflight) return;
    state.inflight = true;
    var conv = state.active;
    var typing = Date.now() - state.typingAt < 3000;
    api('sync', { conv: conv, after: state.after, since: state.since, typing: typing, hidden: document.hidden })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || 'sync');
        state.backoff = 0;
        if (conv !== state.active) return; // switched mid-flight
        absorb(j);
      })
      .catch(function () {
        state.backoff = Math.min(MAX_BACKOFF, (state.backoff || 2000) * 2);
        note('Lost the line. Retrying…', true, state.backoff);
      })
      .then(function () {
        state.inflight = false;
        schedule(state.backoff || (document.hidden ? SLOW : FAST));
      });
  }

  function absorb(j) {
    if (j.me) state.me = j.me;
    if (typeof j.email_dm === 'boolean' && el.emailDm) el.emailDm.checked = j.email_dm;
    if (j.directory) { state.directory = j.directory; j.directory.forEach(function (p) { state.people[p.id] = p; }); renderPeople(); }
    if (j.people) Object.keys(j.people).forEach(function (k) { state.people[k] = j.people[k]; });
    state.online = {};
    (j.online || []).forEach(function (id) { state.online[id] = true; });
    state.convs = j.convs || state.convs;
    if (!state.active && state.convs.length) {
      openConv(pickStart(), true);
      return;
    }
    var first = state.after === 0;
    if (j.messages && j.messages.length) {
      appendMessages(j.messages, first);
      state.after = j.messages[j.messages.length - 1].id;
      if (first) { state.oldest = j.messages[0].id; }
    } else if (first) {
      renderEmpty();
    }
    if (first) { state.hasMore = !!j.has_more; el.older.hidden = !state.hasMore; }
    (j.deleted || []).forEach(markDeleted);
    state.since = j.now;
    state.jackThinking = !!j.jack_thinking;
    renderTyping(j.typing || []);
    renderList();
    renderHead();
  }

  /* ── faces ── */
  var faceCache = {};
  function faceSrc(p) {
    var key = p && p.jack ? 'jack' : JSON.stringify((p && p.avatar) || []);
    if (faceCache[key]) return faceCache[key];
    var c = document.createElement('canvas'); c.width = 9; c.height = 9;
    var x = c.getContext('2d');
    x.fillStyle = '#d9cb9e'; x.fillRect(0, 0, 9, 9);
    if (p && p.jack) {
      // Jack's card: navy frame, two punched eyes, a slot mouth.
      x.fillStyle = '#1e3a5f'; x.fillRect(0, 0, 9, 9);
      x.fillStyle = '#d9cb9e'; x.fillRect(1, 1, 7, 7);
      x.fillStyle = '#161814'; x.fillRect(2, 3, 1, 1); x.fillRect(6, 3, 1, 1);
      x.fillStyle = '#c41e3a'; x.fillRect(3, 6, 3, 1);
    } else {
      var cells = (p && p.avatar) || [];
      var any = false;
      for (var i = 0; i < 81; i++) {
        if (cells[i]) { any = true; x.fillStyle = cells[i]; x.fillRect(i % 9, Math.floor(i / 9), 1, 1); }
      }
      if (!any) { // blank stamp: a monogram-ish dot pattern so it is not empty
        x.fillStyle = '#7b8070'; x.fillRect(3, 3, 3, 3);
      }
    }
    return (faceCache[key] = c.toDataURL());
  }
  function face(p, withDot) {
    var w = document.createElement('span'); w.className = 'face-wrap';
    var img = document.createElement('img'); img.className = 'face'; img.alt = ''; img.src = faceSrc(p);
    w.appendChild(img);
    if (withDot && p && state.online[p.id]) { var d = document.createElement('span'); d.className = 'dot'; d.title = 'here now'; w.appendChild(d); }
    return w;
  }

  /* ── sidebar ── */
  function wanted() { return Number(root.dataset.start) || /^#c\d+$/.test(location.hash); }
  function pickStart() {
    var want = Number(root.dataset.start) || Number((location.hash.match(/^#c(\d+)$/) || [])[1]) || 0;
    var found = state.convs.filter(function (c) { return c.id === want; })[0];
    return (found || state.convs[0]).id;
  }

  var listKey = '';
  function renderList() {
    var key = JSON.stringify([state.active, state.convs, Object.keys(state.online)]);
    if (key === listKey) return;
    listKey = key;
    var frag = document.createDocumentFragment();
    var total = 0;
    state.convs.forEach(function (c) {
      total += c.unread;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'conv' + (c.unread ? ' has-unread' : '');
      if (c.id === state.active) b.setAttribute('aria-current', 'true');
      b.dataset.id = c.id;
      b.setAttribute('aria-label', (c.kind === 'room' ? 'Room ' : 'Messages with ') + c.title + (c.unread ? ', ' + c.unread + ' unread' : ''));
      if (c.kind === 'room') {
        var m = document.createElement('span'); m.className = 'room-mark'; m.textContent = '#'; b.appendChild(m);
      } else {
        b.appendChild(face(c.other, true));
      }
      var n = document.createElement('span'); n.className = 'conv-name'; n.textContent = c.title; b.appendChild(n);
      var badge = document.createElement('span');
      if (c.unread) { badge.className = 'badge'; badge.textContent = c.unread > 99 ? '99+' : c.unread; badge.setAttribute('aria-label', c.unread + ' unread'); }
      b.appendChild(badge);
      var pv = document.createElement('span'); pv.className = 'conv-preview';
      pv.textContent = c.preview ? c.preview.who + ': ' + c.preview.text : (c.kind === 'room' ? (c.blurb || '') : 'No slips yet.');
      b.appendChild(pv);
      frag.appendChild(b);
    });
    el.list.replaceChildren(frag);
    document.title = (total ? '(' + total + ') ' : '') + state.baseTitle;
    var nav = document.getElementById('navChat');
    if (nav) {
      var s = nav.querySelector('.nav-unread');
      if (total && !s) { s = document.createElement('span'); s.className = 'nav-unread'; nav.appendChild(document.createTextNode(' ')); nav.appendChild(s); }
      if (s) { if (total) s.textContent = total > 99 ? '99+' : total; else s.remove(); }
    }
  }

  function renderPeople() {
    var q = (el.filter.value || '').toLowerCase().trim();
    var frag = document.createDocumentFragment();
    state.directory.forEach(function (p) {
      if (q && (p.name + ' ' + p.role).toLowerCase().indexOf(q) < 0) return;
      var li = document.createElement('li');
      var b = document.createElement('button'); b.type = 'button'; b.dataset.user = p.id;
      b.appendChild(face(p, true));
      var t = document.createElement('span');
      var nm = document.createElement('span'); nm.textContent = p.name;
      var rl = document.createElement('span'); rl.className = 'role'; rl.textContent = p.role ? ' · ' + p.role : '';
      t.appendChild(nm); t.appendChild(rl); b.appendChild(t);
      li.appendChild(b); frag.appendChild(li);
    });
    el.people.replaceChildren(frag);
  }

  function renderHead() {
    var c = current();
    if (!c) return;
    el.title.textContent = c.title;
    var sub = '';
    if (c.kind === 'room') {
      var here = Object.keys(state.online).length;
      sub = (c.blurb ? c.blurb + ' ' : '') + here + ' here now.';
    } else {
      sub = state.online[c.other.id] ? 'Here now. Private between the two of you.' : 'Private between the two of you.';
    }
    el.sub.textContent = sub;
  }

  function current() {
    return state.convs.filter(function (c) { return c.id === state.active; })[0];
  }

  /* ── thread ── */
  function openConv(id, auto) {
    if (id === state.active && state.after) { root.classList.add('in-thread'); return; }
    state.active = id; state.after = 0; state.since = 0; state.oldest = 0; state.seen = {};
    el.msgs.replaceChildren();
    el.older.hidden = true;
    note('');
    history.replaceState(null, '', location.pathname + '#c' + id);
    if (!auto || wanted()) root.classList.add('in-thread');
    renderList(); renderHead();
    clearTimeout(state.timer);
    if (state.inflight) { schedule(200); } else { sync(); }
  }

  function dayLabel(ts) {
    var d = new Date(ts * 1000), now = new Date();
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }
  function timeLabel(ts) {
    return new Date(ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  var URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
  function richText(node, text) {
    var last = 0, m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(text))) {
      mentions(node, text.slice(last, m.index));
      var a = document.createElement('a');
      a.href = m[0]; a.textContent = m[0]; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow ugc';
      node.appendChild(a);
      last = m.index + m[0].length;
    }
    mentions(node, text.slice(last));
  }
  function mentions(node, text) {
    var parts = text.split(/(@[A-Za-z][\w-]{1,30})/);
    parts.forEach(function (p, i) {
      if (!p) return;
      if (i % 2) { var s = document.createElement('span'); s.className = 'at'; s.textContent = p; node.appendChild(s); }
      else node.appendChild(document.createTextNode(p));
    });
  }

  function buildMsg(m, prev) {
    var p = m.user_id === JACK ? state.people[0] || { id: 0, name: 'JACK', jack: true } : (state.people[m.user_id] || { id: m.user_id, name: '…' });
    var li = document.createElement('li');
    li.className = 'msg' + (m.user_id === ME ? ' mine' : '') + (m.user_id === JACK ? ' jack' : '') + (m.deleted ? ' deleted' : '');
    li.dataset.id = m.id; li.dataset.user = m.user_id; li.dataset.at = m.at;
    if (prev && Number(prev.dataset.user) === m.user_id && m.at - Number(prev.dataset.at) < 300 && dayLabel(m.at) === dayLabel(Number(prev.dataset.at))) {
      li.classList.add('cont');
    }
    li.appendChild(face(p, false));
    var col = document.createElement('div');
    var head = document.createElement('div'); head.className = 'msg-head';
    var who;
    if (p.slug) { who = document.createElement('a'); who.href = '/people/' + encodeURIComponent(p.slug) + '/'; }
    else who = document.createElement('span');
    who.className = 'msg-who'; who.textContent = m.user_id === ME ? 'you' : p.name;
    var at = document.createElement('time'); at.className = 'msg-at'; at.dateTime = new Date(m.at * 1000).toISOString(); at.textContent = timeLabel(m.at);
    head.appendChild(who); head.appendChild(at);
    col.appendChild(head);
    var body = document.createElement('p'); body.className = 'msg-body';
    if (m.deleted) body.textContent = '— withdrawn —'; else richText(body, m.body);
    col.appendChild(body);
    if (m.user_id === ME && !m.deleted && m.id > 0) {
      var tools = document.createElement('div'); tools.className = 'msg-tools';
      var del = document.createElement('button'); del.type = 'button'; del.textContent = 'WITHDRAW'; del.dataset.del = m.id;
      del.setAttribute('aria-label', 'Withdraw this message');
      tools.appendChild(del); head.appendChild(tools);
    }
    li.appendChild(col);
    return li;
  }

  function nearBottom() {
    return el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 80;
  }
  function toBottom() { el.log.scrollTop = el.log.scrollHeight; }

  function lastMsgLi() {
    var items = el.msgs.querySelectorAll('li.msg:not(.pending)');
    return items.length ? items[items.length - 1] : null;
  }

  function appendMessages(list, initial) {
    var stick = initial || nearBottom();
    var empty = el.msgs.querySelector('.empty-thread'); if (empty) empty.remove();
    list.forEach(function (m) {
      if (state.seen[m.id]) return;
      state.seen[m.id] = true;
      var pending = el.msgs.querySelector('li.pending[data-ok="' + m.id + '"]');
      if (pending) pending.remove();
      var prev = lastMsgLi();
      if (!prev || dayLabel(Number(prev.dataset.at)) !== dayLabel(m.at)) {
        var d = document.createElement('li'); d.className = 'day'; d.textContent = dayLabel(m.at); el.msgs.appendChild(d);
        prev = null;
      }
      var li = buildMsg(m, prev);
      var firstPending = el.msgs.querySelector('li.pending');
      el.msgs.insertBefore(li, firstPending);
    });
    if (stick) toBottom();
  }

  function prependMessages(list) {
    var h = el.log.scrollHeight;
    var frag = document.createDocumentFragment();
    var prev = null, prevDay = '';
    list.forEach(function (m) {
      if (state.seen[m.id]) return;
      state.seen[m.id] = true;
      if (dayLabel(m.at) !== prevDay) {
        var d = document.createElement('li'); d.className = 'day'; d.textContent = dayLabel(m.at); frag.appendChild(d);
        prevDay = dayLabel(m.at); prev = null;
      }
      prev = buildMsg(m, prev);
      frag.appendChild(prev);
    });
    // drop a duplicate day header where the old top joins the new bottom
    var firstOld = el.msgs.firstElementChild;
    if (firstOld && firstOld.classList.contains('day') && firstOld.textContent === prevDay) firstOld.remove();
    el.msgs.insertBefore(frag, el.msgs.firstChild);
    el.log.scrollTop += el.log.scrollHeight - h;
  }

  function renderEmpty() {
    if (el.msgs.children.length) return;
    var li = document.createElement('li'); li.className = 'empty-thread';
    var c = current();
    li.textContent = c && c.kind === 'dm' ? 'No slips between you yet. Say hello.' : 'The room is quiet. Write the first slip — or call @jack.';
    el.msgs.appendChild(li);
  }

  function markDeleted(id) {
    var li = el.msgs.querySelector('li.msg[data-id="' + id + '"]');
    if (!li || li.classList.contains('deleted')) return;
    li.classList.add('deleted');
    var b = li.querySelector('.msg-body'); b.textContent = '— withdrawn —';
    var t = li.querySelector('.msg-tools'); if (t) t.remove();
  }

  function renderTyping(ids) {
    var names = ids.map(function (id) { return (state.people[id] || {}).name; }).filter(Boolean);
    var text = '';
    if (state.jackThinking) text = 'Jack is punching a reply…';
    else if (names.length === 1) text = names[0] + ' is writing…';
    else if (names.length > 1) text = names.slice(0, 3).join(', ') + ' are writing…';
    if (state.statusNote && Date.now() < state.statusUntil) return;
    el.status.textContent = text;
    el.status.classList.remove('err');
  }

  function note(text, err, ms) {
    state.statusNote = text; state.statusErr = !!err; state.statusUntil = Date.now() + (ms || 5000);
    el.status.textContent = text;
    el.status.classList.toggle('err', !!err);
  }

  /* ── actions ── */
  var pendingSeq = 0;
  function send() {
    var text = el.body.value.replace(/\s+$/, '');
    if (!text.trim() || !state.active) return;
    var conv = state.active;
    var cid = 'p' + (++pendingSeq);
    var li = buildMsg({ id: -pendingSeq, user_id: ME, body: text, at: Math.floor(Date.now() / 1000), deleted: false }, lastMsgLi());
    li.classList.add('pending'); li.classList.remove('cont'); li.dataset.cid = cid;
    var empty = el.msgs.querySelector('.empty-thread'); if (empty) empty.remove();
    el.msgs.appendChild(li); toBottom();
    el.body.value = ''; grow();
    state.typingAt = 0;
    api('send', { conv: conv, body: text, client_id: cid }).then(function (j) {
      if (!j.ok) {
        li.classList.add('failed'); li.classList.remove('pending');
        li.querySelector('.msg-body').textContent = text + '\n— not sent: ' + (j.error || 'try again') + ' —';
        note(j.error || 'Not sent.', true);
        if (j.status === 429) { el.body.value = text; grow(); li.remove(); }
        return;
      }
      if (conv !== state.active) { li.remove(); return; }
      if (state.seen[j.message.id]) { li.remove(); }
      else { li.dataset.ok = j.message.id; li.remove(); appendMessages([j.message], false); toBottom(); state.after = Math.max(state.after, j.message.id); }
      if (j.jack === 'refused' && j.jack_note) note(j.jack_note, false, 6000);
      if (j.jack === 'called') { state.jackThinking = true; renderTyping([]); }
      schedule(400);
    }).catch(function () {
      li.classList.add('failed'); li.classList.remove('pending');
      note('Not sent — the line dropped. Your text is back in the box.', true);
      el.body.value = text; grow(); li.remove();
    });
  }

  function grow() {
    el.body.style.height = 'auto';
    el.body.style.height = Math.min(el.body.scrollHeight + 2, 144) + 'px';
  }

  el.form.addEventListener('submit', function (e) { e.preventDefault(); send(); el.body.focus(); });
  el.body.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch) { e.preventDefault(); send(); }
  });
  el.body.addEventListener('input', function () { grow(); if (el.body.value.trim()) state.typingAt = Date.now(); });

  el.list.addEventListener('click', function (e) {
    var b = e.target.closest('.conv'); if (b) openConv(Number(b.dataset.id));
  });
  el.back.addEventListener('click', function () { root.classList.remove('in-thread'); });
  el.filter.addEventListener('input', renderPeople);
  el.people.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-user]'); if (!b) return;
    api('dm', { user_id: Number(b.dataset.user) }).then(function (j) {
      if (!j.ok) { note(j.error || 'Could not open that conversation.', true); return; }
      el.peopleBox.open = false;
      if (!state.convs.some(function (c) { return c.id === j.conv; })) {
        var p = state.people[b.dataset.user] || {};
        state.convs.push({ id: j.conv, kind: 'dm', title: p.name || '…', other: p, unread: 0, preview: null });
      }
      openConv(j.conv);
    });
  });
  el.msgs.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-del]'); if (!b) return;
    if (!confirm('Withdraw this message? Everyone will see it was withdrawn.')) return;
    api('delete', { id: Number(b.dataset.del) }).then(function (j) {
      if (j.ok) markDeleted(Number(b.dataset.del)); else note(j.error || 'Could not withdraw.', true);
    });
  });
  el.older.addEventListener('click', function () {
    if (!state.oldest) return;
    el.older.disabled = true;
    var conv = state.active;
    api('history', { conv: conv, before: state.oldest }).then(function (j) {
      el.older.disabled = false;
      if (!j.ok || conv !== state.active) return;
      Object.keys(j.people || {}).forEach(function (k) { state.people[k] = j.people[k]; });
      if (j.messages.length) { state.oldest = j.messages[0].id; prependMessages(j.messages); }
      el.older.hidden = !j.has_more;
    });
  });

  if (el.emailDm) el.emailDm.addEventListener('change', function () {
    var want = el.emailDm.checked;
    api('prefs', { email_dm: want }).then(function (j) {
      if (!j.ok) { el.emailDm.checked = !want; note(j.error || 'Could not save that.', true); return; }
      note(j.email_dm ? 'You will get an email when someone messages you while you are away.' : 'No more message emails.', false, 4000);
    });
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { state.backoff = 0; schedule(50); }
  });
  window.addEventListener('online', function () { state.backoff = 0; schedule(50); });

  // Fit the chat between its top and the fixed dock, so the composer is never covered.
  function fit() {
    var dock = document.getElementById('dock');
    var dockH = dock ? dock.getBoundingClientRect().height : 0;
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    var top = root.getBoundingClientRect().top + window.scrollY;
    root.style.height = Math.max(320, Math.round(vh - top - dockH - 8)) + 'px';
  }
  fit();
  window.addEventListener('resize', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

  sync();
  if (!isTouch && wanted()) el.body.focus();
})();
