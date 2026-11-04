/**
 * JackLive — GPT-Live WebRTC voice session.
 *
 * Usage:
 *   JackLive.start(csrf, container)   // container: DOM element for transcript
 *   JackLive.stop()
 *   JackLive.on('state', fn)          // 'idle'|'connecting'|'live'|'closing'|'closed'|'error'
 *
 * Server endpoint: /jack/live-session.php
 * Data channel:    oai-events (OpenAI Live spec)
 * Transcript:      delta events grouped by start_ms/end_ms
 */

(function (global) {
  'use strict';

  /* ── state ── */
  var pc          = null;   // RTCPeerConnection
  var audioEl     = null;   // <audio> for remote stream
  var dc          = null;   // RTCDataChannel 'oai-events'
  var sessionId   = null;
  var handlers    = { state: [] };

  /* transcript segments: { id, role, text, startMs, endMs } */
  var segments    = {};
  var container   = null;

  /* ── public API ── */
  var JackLive = {
    start: start,
    stop:  stop,
    on: function (evt, fn) {
      if (!handlers[evt]) handlers[evt] = [];
      handlers[evt].push(fn);
      return JackLive;
    }
  };

  /* ── state machine ── */
  function emit(evt) {
    var fns = handlers[evt] || [];
    for (var i = 0; i < fns.length; i++) fns[i](evt);
  }

  /* ── start ── */
  function start(csrf, el) {
    if (pc) return;
    container = el || null;
    clearTranscript();

    emit('connecting');

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(function (stream) { return negotiate(csrf, stream); })
      .catch(function (err) {
        console.error('[jack-live] mic denied', err);
        emit('error');
      });
  }

  function negotiate(csrf, micStream) {
    pc = new RTCPeerConnection();

    /* remote audio → <audio autoplay> */
    audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    document.body.appendChild(audioEl);

    pc.ontrack = function (evt) {
      if (evt.streams && evt.streams[0]) {
        audioEl.srcObject = evt.streams[0];
      }
    };

    /* add mic tracks */
    micStream.getTracks().forEach(function (t) { pc.addTrack(t, micStream); });

    /* data channel (must exist before offer) */
    dc = pc.createDataChannel('oai-events');
    dc.onopen    = function () { /* session.started event will confirm live */ };
    dc.onmessage = function (e) { handleEvent(e.data); };
    dc.onerror   = function (e) { console.error('[jack-live] dc error', e); };

    return pc.createOffer()
      .then(function (offer) {
        return pc.setLocalDescription(offer);
      })
      .then(function () {
        /* wait for ICE gathering to settle for a clean SDP */
        return waitIce(pc);
      })
      .then(function () {
        var sdp = pc.localDescription.sdp;
        return fetchSession(csrf, sdp);
      })
      .then(function (data) {
        sessionId = data.session_id;
        return pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
      })
      .catch(function (err) {
        console.error('[jack-live] negotiate failed', err);
        cleanup();
        emit('error');
      });
  }

  /* ICE gathering: resolve when complete or after 4 s */
  function waitIce(conn) {
    return new Promise(function (resolve) {
      if (conn.iceGatheringState === 'complete') { resolve(); return; }
      var done = false;
      function finish() {
        if (done) return; done = true;
        conn.removeEventListener('icegatheringstatechange', onstate);
        resolve();
      }
      function onstate() { if (conn.iceGatheringState === 'complete') finish(); }
      conn.addEventListener('icegatheringstatechange', onstate);
      setTimeout(finish, 4000);
    });
  }

  /* POST offer SDP to our PHP endpoint */
  function fetchSession(csrf, sdp) {
    var body = new FormData();
    body.set('csrf', csrf);
    body.set('sdp', sdp);
    return fetch('/jack/live-session.php', {
      method: 'POST',
      body: body,
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json();
    }).then(function (data) {
      if (!data.ok) throw new Error(data.error || 'live-session failed');
      return data;
    });
  }

  /* ── oai-events handler ── */
  function handleEvent(raw) {
    var ev;
    try { ev = JSON.parse(raw); } catch (e) { return; }
    var type = ev.type || '';

    if (type === 'session.started') {
      /* spec: do not send startup configuration again */
      emit('live');
      return;
    }

    if (type === 'session.input_transcript.delta') {
      applyDelta('input', ev);
      return;
    }

    if (type === 'session.output_transcript.delta') {
      applyDelta('output', ev);
      return;
    }

    if (type === 'session.close') {
      /* retain audio + transport until session.closed */
      emit('closing');
      return;
    }

    if (type === 'session.closed') {
      /* now safe to tear down */
      cleanup();
      emit('closed');
      return;
    }

    /* timeout or disconnect before session.closed → incomplete finalization */
    if (type === 'session.error' || type === 'transport.disconnected' || type === 'transport.timeout') {
      var msg = (ev.error && ev.error.message) || type;
      console.warn('[jack-live] incomplete finalization:', msg);
      cleanup();
      emit('error');
    }
  }

  /* ── transcript: group by start_ms/end_ms, not turns ── */
  function segKey(role, startMs) {
    return role + ':' + startMs;
  }

  function applyDelta(role, ev) {
    var text    = (ev.delta && typeof ev.delta === 'string') ? ev.delta : '';
    var startMs = typeof ev.start_ms === 'number' ? ev.start_ms : null;
    var endMs   = typeof ev.end_ms   === 'number' ? ev.end_ms   : null;

    if (startMs === null) return; /* no grouping key — skip */

    var key = segKey(role, startMs);
    if (!segments[key]) {
      segments[key] = { key: key, role: role, text: '', startMs: startMs, endMs: endMs };
      renderSegment(segments[key]);
    }
    segments[key].text += text;
    if (endMs !== null) segments[key].endMs = endMs;
    updateSegment(segments[key]);
  }

  /* ── DOM transcript ── */
  function clearTranscript() {
    segments = {};
    if (container) container.innerHTML = '';
  }

  function renderSegment(seg) {
    if (!container) return;
    var p = document.createElement('p');
    p.dataset.liveKey = seg.key;
    p.className = 'jack-live-line jack-live-' + seg.role;
    container.appendChild(p);
  }

  function updateSegment(seg) {
    if (!container) return;
    var p = container.querySelector('[data-live-key="' + seg.key + '"]');
    if (p) p.textContent = seg.text;
  }

  /* ── stop ── */
  function stop() {
    cleanup();
    emit('closed');
  }

  function cleanup() {
    if (dc) { try { dc.close(); } catch (e) {} dc = null; }
    if (pc) { try { pc.close(); } catch (e) {} pc = null; }
    if (audioEl) {
      audioEl.srcObject = null;
      if (audioEl.parentNode) audioEl.parentNode.removeChild(audioEl);
      audioEl = null;
    }
    sessionId = null;
  }

  global.JackLive = JackLive;
})(window);
