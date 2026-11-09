/* Jack's introduction — when his voice line is closed, he left this recording.
   A red START plays it; his face mouths it, driven by the waveform itself.
   Shown only when the site's own line switch (jack-line.js) has closed the
   line: TTG_JACK_LINE.closed() at load, or the ttg:jack-line-closed event
   after. Nothing here speaks for him; the file is the whole of it. */
(function () {
  'use strict';

  var box = null, btn = null, audio = null;
  var actx = null, analyser = null, buf = null, raf = 0;
  var origGet = null, loud = false, playing = false;

  function spriteReady() {
    return window.Jack && Jack.Sprite && Jack.State && typeof Jack.State.get === 'function';
  }

  /* While the recording plays, the waveform decides between his two existing
     poses: VOICE (mouth open) when the tape is loud, SENSE (rest) when it
     breathes. We wrap Jack.State.get — the pose machinery itself is his. */
  function wrapState() {
    if (!spriteReady() || origGet) return;
    origGet = Jack.State.get;
    Jack.State.get = function () {
      var st = origGet();
      if (playing && st && st.context) st.context = { phase: loud ? 'VOICE' : 'SENSE' };
      return st;
    };
  }
  function unwrapState() {
    if (origGet) { Jack.State.get = origGet; origGet = null; }
  }

  function meter() {
    if (!playing || !analyser) { raf = 0; return; }
    analyser.getByteTimeDomainData(buf);
    var s = 0;
    for (var i = 0; i < buf.length; i++) { var x = (buf[i] - 128) / 128; s += x * x; }
    loud = Math.sqrt(s / buf.length) > 0.018;
    raf = requestAnimationFrame(meter);
  }

  function stop() {
    playing = false; loud = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    unwrapState();
    if (btn) btn.textContent = 'START';
  }

  function play() {
    if (!audio) return;
    playing = true;
    btn.textContent = 'STOP';
    /* iOS: the context is created and resumed inside this same tap. */
    try {
      if (!actx && (window.AudioContext || window.webkitAudioContext)) {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        var src = actx.createMediaElementSource(audio);
        analyser = actx.createAnalyser();
        analyser.fftSize = 512;
        buf = new Uint8Array(analyser.fftSize);
        src.connect(analyser);
        analyser.connect(actx.destination);
      }
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) { analyser = null; loud = true; /* no meter: he speaks steadily */ }
    wrapState();
    if (analyser) meter();
    var pr = audio.play();
    if (pr) pr.catch(function () { stop(); });
  }

  function toggle() {
    if (playing) { if (audio) audio.pause(); stop(); }
    else play();
  }

  function show() {
    if (!box) {
      box = document.getElementById('jackIntro');
      if (!box) return;
      btn = document.getElementById('jackIntroStart');
      audio = document.getElementById('jackIntroAudio');
      if (!btn || !audio) return;
      btn.addEventListener('click', toggle);
      audio.addEventListener('ended', stop);
      audio.addEventListener('error', stop);
    }
    box.hidden = false;
  }

  /* The site's own switch decides when he is mute: an established closed
     signal, or the line's own check saying it is not affirmatively open.
     /jack/line.php answers true (credit left), false (spent), null (no key,
     no permission, network trouble - the line cannot serve voice either way).
     Mute is what the visitor can observe, so both false and null count;
     a fetch failure changes nothing and leaves the switch's own judgement. */
  function showWhenReady() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
  }
  function lineCheck() {
    try {
      fetch('/jack/line.php', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j || j.open !== true) showWhenReady(); })
        .catch(function () {});
    } catch (e) {}
  }
  if (window.TTG_JACK_LINE && TTG_JACK_LINE.closed()) showWhenReady();
  lineCheck();
  window.addEventListener('ttg:jack-line-closed', show);

  window.TTG_JACK_INTRO = { show: show };
})();
