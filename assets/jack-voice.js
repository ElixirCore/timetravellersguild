/* Jack’s voice is the browser reader. Same clerk, wherever he stands. */
(function (global) {
  'use strict';

  var unlocked = false;
  var chosen = null;
  var voicesReady = false;
  var activeUtterance = null;
  var serverUrl = '';
  var audio = null;

  function pose(form) {
    var Spr = global.Jack && global.Jack.Sprite;
    if (Spr && Spr.setForm) Spr.setForm(form);
  }

  function pickVoice() {
    var voices = [];
    try { voices = global.speechSynthesis.getVoices() || []; } catch (e) { return null; }
    var i, v, gb = null, english = null;
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      var lang = String(v.lang || '').toLowerCase();
      var name = String(v.name || '').toLowerCase();
      if (!english && lang.indexOf('en') === 0) english = v;
      if (lang.indexOf('en-gb') === 0 || lang.indexOf('en_gb') === 0) {
        if (/male|daniel|george|arthur|rishi|thomas|oliver/.test(name)) return v;
        if (!gb) gb = v;
      }
    }
    return gb || english || voices[0] || null;
  }

  function loadVoices() {
    if (!global.speechSynthesis) return;
    chosen = pickVoice();
    voicesReady = true;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    loadVoices();
  }

  function say(text) {
    var line = String(text || '').replace(/\s+/g, ' ').trim();
    if (!line) return false;
    if (!global.speechSynthesis || !global.SpeechSynthesisUtterance || !global.speechSynthesis.getVoices().length) {
      return sayServer(line);
    }
    unlock();
    if (!voicesReady) loadVoices();
    try {
      var u = new global.SpeechSynthesisUtterance(line);
      u.rate = 0.92;
      u.pitch = 0.72;
      if (chosen) u.voice = chosen;
      u.lang = (chosen && chosen.lang) || 'en-US';
      activeUtterance = u;
      u.onstart = function () { pose('speak'); };
      u.onend = function () {
        pose('sit');
        if (typeof global.JackVoice.onend === 'function') global.JackVoice.onend();
      };
      u.onerror = function () {
        pose('sit');
        if (typeof global.JackVoice.onend === 'function') global.JackVoice.onend();
      };
      try { global.speechSynthesis.cancel(); } catch (e) {}
      pose('speak');
      global.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  function sayServer(text) {
    if (!serverUrl || !global.fetch || !global.Audio) return false;
    var body = new FormData();
    body.set('csrf', (global.TTG_INTRO && global.TTG_INTRO.csrf) || '');
    body.set('text', text);
    fetch(serverUrl, { method: 'POST', body: body, credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('voice unavailable');
        return res.blob();
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        if (audio) {
          audio.pause();
          if (audio.src) URL.revokeObjectURL(audio.src);
        }
        audio = new Audio(url);
        audio.onplay = function () { pose('speak'); };
        audio.onended = function () { pose('sit'); URL.revokeObjectURL(url); };
        audio.onerror = function () { pose('sit'); URL.revokeObjectURL(url); };
        return audio.play();
      })
      .catch(function () {});
    pose('speak');
    return true;
  }

  if (global.speechSynthesis) {
    loadVoices();
    if (typeof speechSynthesis.addEventListener === 'function') {
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } else {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  global.JackVoice = {
    say: say,
    speakQueued: say,
    fallback: say,
    unlock: unlock,
    setServer: function (url) { serverUrl = String(url || ''); },
    available: function () {
      return !!(global.speechSynthesis && global.SpeechSynthesisUtterance);
    }
  };
})(window);
