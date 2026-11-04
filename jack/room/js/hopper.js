/* Jack deals the hole deck in the cube. Working slip. Not canon. */
(function (J) {
  'use strict';

  var playing = false;

  function $(id) { return document.getElementById(id); }

  function ensureSprite(done) {
    if (document.getElementById('card-chassis')) {
      if (done) done();
      return;
    }
    fetch('/jack/tarot/svg/deck.svg', { cache: 'no-store' }).then(function (res) {
      return res.text();
    }).then(function (svg) {
      var box = document.createElement('div');
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = svg;
      document.body.insertBefore(box, document.body.firstChild);
      if (done) done();
    }).catch(function () {
      if (done) done();
    });
  }

  function showTray() {
    var tray = $('hopperTray');
    if (tray) tray.hidden = false;
  }

  function hideTray() {
    var tray = $('hopperTray');
    if (tray) tray.hidden = true;
    var grid = $('hopperGrid');
    if (grid) grid.innerHTML = '';
    var load = $('hopperLoad');
    if (load) load.hidden = true;
  }

  function play(opts) {
    opts = opts || {};
    if (playing) return;
    if (!window.JACK_TAROT || !window.JACK_TAROT.punch) return;
    playing = true;
    J.State.selectObject('obj-hopper');
    J.State.setPhase('CARD');
    J.State.nerve('heart', 'hopper', 'tarot', 'punch');
    showTray();
    var load = $('hopperLoad');
    if (load) load.hidden = false;
    var q = opts.question;
    if (q == null) {
      var ta = $('consoleIn');
      q = ta ? ta.value : (J.State.get().context.consoleText || '');
    }
    q = String(q || '').trim();
    if (q && J.API && J.API.appendTalk) J.API.appendTalk('visitor', q);
    if (J.API && J.API.appendTalk) {
      J.API.appendTalk('clerk', q
        ? 'The hopper has your question. I will punch three stations.'
        : 'Open hopper. Three stations. Working slip. Not canon.');
    }
    if (J.Sprite && J.Sprite.deal) J.Sprite.deal(3);
    var csrf = (J.API && J.API.session && J.API.session.csrf) || window.TTG_TAROT_CSRF || '';
    window.JACK_TAROT.punch({
      spread: opts.spread || 'three-stations',
      question: q,
      mount: $('hopperGrid'),
      csrf: csrf,
      endpoint: '/jack/tarot/read.php',
      onReading: function (reading) {
        playing = false;
        if (load) load.hidden = true;
        if (J.API && J.API.appendTalk) J.API.appendTalk('clerk', reading);
        J.State.get().context.voiceText = reading;
        if (window.JackVoice && JackVoice.say) JackVoice.say(reading);
        J.State.nerve('heart', 'hopper', 'tarot', 'read');
        if (J.Cards && J.Cards.refresh) J.Cards.refresh();
      }
    }).then(function () {
      playing = false;
    }).catch(function () {
      playing = false;
    });
  }

  function bind() {
    ensureSprite();
    var btn = $('btnHopper');
    if (btn) btn.addEventListener('click', function () { play(); });
    var close = $('btnHopperClose');
    if (close) close.addEventListener('click', hideTray);
    if (location.hash === '#hopper') {
      setTimeout(function () { play(); }, 400);
    }
  }

  J.Hopper = {
    play: play,
    show: showTray,
    hide: hideTray,
    bind: bind,
    playing: function () { return playing; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})(window.Jack = window.Jack || {});
