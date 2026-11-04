/* Jack desk — punch-card process, Enter=Ask, optional clerk voice. */
(function (global) {
  var G = function () { return global.TTG_GRAPH || {}; };
  var $ = function (id) { return document.getElementById(id); };
  var reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var batch = 1;
  var timers = [];
  var punchTimer = 0;
  var listening = false;
  var rec = null;
  var audioUrl = '';

  function graph() { return G(); }

  function padBatch(n) {
    var s = String(n);
    while (s.length < 4) s = '0' + s;
    return s;
  }

  function bumpBatch() {
    var b = $('jackBatch');
    if (!b) return;
    var cur = (b.textContent || '').trim();
    if (/^\d*$/.test(cur)) {
      b.textContent = padBatch(batch);
      return;
    }
    b.textContent = cur.replace(/\s*·\s*\d+$/, '') + ' · ' + padBatch(batch);
  }

  function buildFace() {
    var ruler = $('jackRuler');
    var belt = $('jackBelt');
    var i;
    if (ruler && !ruler.childElementCount) {
      for (i = 1; i <= 80; i++) {
        var col = document.createElement('span');
        col.textContent = (i === 1 || i % 10 === 0) ? String(i) : '';
        ruler.appendChild(col);
      }
    }
    if (belt && !belt.childElementCount) {
      for (i = 0; i < 80 * 12; i++) {
        belt.appendChild(document.createElement('i'));
      }
    }
    var b = $('jackBatch');
    if (b && /^\d*$/.test((b.textContent || '').trim())) b.textContent = padBatch(batch);
  }

  function clearTimers() {
    timers.forEach(function (id) { clearTimeout(id); });
    timers = [];
    if (punchTimer) { clearInterval(punchTimer); punchTimer = 0; }
  }

  function punchSome(n) {
    var belt = $('jackBelt');
    if (!belt || !belt.childElementCount) return;
    var holes = belt.children;
    var i, idx;
    for (i = 0; i < n; i++) {
      idx = Math.floor(Math.random() * holes.length);
      holes[idx].classList.add('in');
    }
  }

  function resetPunches() {
    var belt = $('jackBelt');
    if (!belt) return;
    Array.prototype.forEach.call(belt.children, function (el) {
      el.classList.remove('in');
    });
  }

  function setStage(text) {
    var stage = $('jackStage');
    if (stage) stage.textContent = text;
  }

  function startProcess(intent) {
    var sheet = $('jack');
    var proc = $('jackProcess');
    if (sheet) sheet.classList.add('working');
    document.body.classList.add('jack-busy');
    if (proc) proc.hidden = false;
    resetPunches();
    punchSome(18);
    clearTimers();
    var stages = intent === 'lodge'
      ? [
          { at: 0, text: 'Slip received. Card punched.' },
          { at: 360, text: 'Checking the unsigned slip.' },
          { at: 880, text: 'Holding the dossier.' },
          { at: 1600, text: 'Extracting leaves.' }
        ]
      : [
          { at: 0, text: 'Slip received. Card punched.' },
          { at: 360, text: 'Checking the unsigned slip.' },
          { at: 880, text: 'Consulting the field index.' },
          { at: 1680, text: 'Addressing the clerk.' }
        ];
    stages.forEach(function (s) {
      timers.push(setTimeout(function () { setStage(s.text); punchSome(10); }, s.at));
    });
    if (!reduce) {
      punchTimer = setInterval(function () { punchSome(6); }, 420);
    }
  }

  function stopProcess() {
    clearTimers();
    var sheet = $('jack');
    var proc = $('jackProcess');
    if (sheet) sheet.classList.remove('working');
    document.body.classList.remove('jack-busy');
    if (proc) proc.hidden = true;
    setStage('');
  }

  function revokeAudio() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = '';
    }
  }

  function startReading() {
    var sheet = $('jack');
    var proc = $('jackProcess');
    var hear = $('jackHear');
    if (sheet) sheet.classList.add('reading');
    if (proc) proc.hidden = false;
    setStage('Reading the last slip aloud.');
    if (hear) hear.setAttribute('aria-pressed', 'true');
  }

  function stopReading() {
    var sheet = $('jack');
    var proc = $('jackProcess');
    var hear = $('jackHear');
    if (sheet) sheet.classList.remove('reading');
    if (proc && sheet && !sheet.classList.contains('working')) proc.hidden = true;
    if (!sheet || !sheet.classList.contains('working')) setStage('');
    if (hear) hear.setAttribute('aria-pressed', 'false');
  }

  function speakText(text, opts) {
    opts = opts || {};
    var g = graph();
    var voiceOn = !!(g.jack && g.jack.voice) || opts.force;
    if (!voiceOn) return;
    if (!text && !opts.queued) return;
    var endpoint = g.jack_speak || '/jack/speak';
    var data = new FormData();
    data.set('csrf', g.csrf || '');
    if (text) data.set('text', text);
    startReading();
    fetch(endpoint, {
      method: 'POST',
      body: data,
      credentials: 'same-origin'
    }).then(function (res) {
      if (!res.ok) return null;
      var ct = res.headers.get('Content-Type') || '';
      if (ct.indexOf('audio/') !== 0) return null;
      return res.blob();
    }).then(function (blob) {
      if (!blob || !blob.size) {
        stopReading();
        return;
      }
      var audio = $('jackAudio');
      if (!audio) {
        stopReading();
        return;
      }
      revokeAudio();
      audioUrl = URL.createObjectURL(blob);
      audio.src = audioUrl;
      audio.onended = function () {
        stopReading();
        if (listening && rec) {
          try { rec.start(); } catch (e) {}
        }
      };
      audio.onerror = function () { stopReading(); };
      var play = audio.play();
      if (play && play.catch) play.catch(function () { stopReading(); });
    }).catch(function () { stopReading(); });
  }

  function setupHear() {
    var hear = $('jackHear');
    var g = graph();
    if (!hear) return;
    if (!(g.jack && g.jack.voice)) return;
    hear.hidden = false;
    if (hear.getAttribute('data-jack-hear-bound')) return;
    hear.setAttribute('data-jack-hear-bound', '1');
    hear.addEventListener('click', function () {
      speakText('', { force: true, queued: true });
    });
  }

  function defaultOps(ops, hooks) {
    var box = $('jackOps');
    if (!box) return;
    box.innerHTML = '';
    (ops || []).forEach(function (op) {
      var d = document.createElement('div');
      d.className = 'proposal';
      var p = document.createElement('p');
      p.textContent = op.label || '';
      d.appendChild(p);
      if (op.context) {
        var ctx = document.createElement('p');
        ctx.className = 'ctx';
        ctx.textContent = op.context;
        d.appendChild(ctx);
      }
      var row = document.createElement('div');
      row.className = 'row';
      d.appendChild(row);
      var acc = document.createElement('button');
      acc.type = 'button'; acc.textContent = 'Accept';
      var dis = document.createElement('button');
      dis.type = 'button'; dis.textContent = 'Dismiss';
      acc.addEventListener('click', function () {
        if (hooks && hooks.onOp) {
          hooks.onOp(op);
          d.remove();
          return;
        }
        if (hooks && hooks.room) {
          if (op.kind === 'FOCUS' && op.slug) {
            var note = document.createElement('p');
            note.className = 'op';
            var a = document.createElement('a');
            a.href = '/n/' + encodeURIComponent(op.slug) + '/';
            a.textContent = op.label || ('Record ' + op.slug);
            note.appendChild(a);
            var log = $('jackLog');
            if (log) log.appendChild(note);
          }
          d.remove();
          return;
        }
        if (op.kind === 'OPEN' && op.href) location.href = op.href;
        else if (op.kind === 'FOCUS' && op.slug) location.href = '/n/' + encodeURIComponent(op.slug) + '/';
        else if (op.kind === 'CAPTURE') location.href = '/now#capture';
        else if (op.kind === 'PEEL') location.href = '/now';
        d.remove();
      });
      dis.addEventListener('click', function () { d.remove(); });
      row.appendChild(acc); row.appendChild(dis);
      box.appendChild(d);
    });
  }

  function appendLog(text, cls) {
    var log = $('jackLog');
    if (!log || !text) return null;
    var p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    log.appendChild(p);
    return p;
  }

  function setTalkLabel() {
    var btn = $('jackTalk');
    if (!btn) return;
    var idle = btn.getAttribute('data-idle') || btn.getAttribute('data-label') || 'Talk';
    btn.textContent = listening ? 'Listening' : idle;
    btn.setAttribute('aria-pressed', listening ? 'true' : 'false');
    btn.classList.toggle('listening', listening);
  }

  function setupTalk() {
    var btn = $('jackTalk');
    if (!btn) return;
    var Rec = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!Rec) {
      btn.hidden = true;
      return;
    }
    rec = new Rec();
    rec.lang = 'en-GB';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = function (ev) {
      var t = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : '';
      var q = $('jackQ');
      if (q && t) q.value = t;
      var form = $('jackForm');
      var ask = form && form.querySelector('button[value="ask"]');
      if (form && ask && form.requestSubmit) form.requestSubmit(ask);
      else if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };
    rec.onerror = function () {
      listening = false;
      setTalkLabel();
    };
    rec.onend = function () {
      if (!listening) setTalkLabel();
    };
    btn.addEventListener('click', function () {
      listening = !listening;
      setTalkLabel();
      if (listening) {
        try { rec.start(); } catch (e) { listening = false; setTalkLabel(); }
      } else {
        try { rec.stop(); } catch (e) {}
      }
    });
  }

  function mount(opts) {
    opts = opts || {};
    var form = $('jackForm');
    if (!form || form.getAttribute('data-jack-bound')) return;
    form.setAttribute('data-jack-bound', '1');
    if (opts.room) form.setAttribute('action', '/jack');

    var ask = form.querySelector('button[value="ask"]');
    var qEl = $('jackQ');
    if (qEl) {
      qEl.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        e.preventDefault();
        if (ask && form.requestSubmit) form.requestSubmit(ask);
        else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      var qBox = $('jackQ');
      var q = (qBox && qBox.value ? qBox.value : '').trim();
      var fileEl = $('jackFile');
      var hasFile = fileEl && fileEl.files && fileEl.files.length;
      var intent = (e.submitter && e.submitter.value) || 'ask';
      if (hasFile) intent = 'lodge';
      if (!q && !hasFile) return;

      batch += 1;
      bumpBatch();

      if (q) appendLog(q.length > 280 ? q.slice(0, 277) + '…' : q, 'asked');
      else if (hasFile) appendLog('Dossier: ' + fileEl.files[0].name, 'asked');

      startProcess(intent);
      var g = graph();
      var endpoint = g.jack_endpoint || '/now/jack';
      var data = new FormData();
      data.set('csrf', g.csrf || '');
      data.set('q', q);
      data.set('intent', intent);
      if (hasFile) data.set('dossier', fileEl.files[0]);

      fetch(endpoint, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
        credentials: 'same-origin'
      }).then(function (res) { return res.json(); })
        .then(function (j) {
          stopProcess();
          var text = (j && j.text) ? j.text : 'The clerk is away from the desk. The field remains.';
          if (j && j.ingested) appendLog('Held as pending.', 'op');
          else if (j && j.unavailable) appendLog('The clerk is away from the desk.', 'op');
          else appendLog('Reply stamped.', 'op');
          var ans = appendLog(text, (j && j.unavailable) ? '' : 'stamped');
          if (ans && j && j.ingested) ans.classList.add('stamped', 'pending');
          if (opts.renderOps) opts.renderOps((j && j.ops) || []);
          else defaultOps((j && j.ops) || [], opts);
          if (opts.onNodes) opts.onNodes((j && j.nodes) || []);
          if (opts.onEdges) opts.onEdges((j && j.edges) || []);
          if (j && j.voice !== false) speakText('', { queued: true });
        })
        .catch(function () {
          stopProcess();
          var away = 'The clerk is away from the desk. The field remains.';
          appendLog(away);
        });

      if (qBox) qBox.value = '';
      if (fileEl) fileEl.value = '';
    });

    buildFace();
    setupTalk();
    setupHear();
  }

  global.TTG_JACK_DESK = { mount: mount, speak: speakText };
})(window);
