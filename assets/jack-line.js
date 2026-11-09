/* JACK LINE — one switch for every talk-to-Jack interface on the site.

   Load it before any ElevenLabs script. When Jack's voice credit is spent:
   - every ElevenLabs call is refused (whichever page or widget starts it),
   - the jack-face badge, the tarot talk button and anything marked
     [data-jack-talk] are hidden, and a #jackDesk card becomes a door to /now.

   The line closes when /jack/line says the quota is spent, or when a call fails
   for want of credit (remembered in this browser for six hours). It opens again
   when /jack/line reports credit. */
(function () {
  'use strict';
  var KEY = 'ttg_jack_line_closed';
  var HOLD = 6 * 3600 * 1000;
  var NO_CREDIT = /quota|credit|insufficient|payment|exceed|subscription|billing|limit reached/i;
  var root = document.documentElement;
  var closed = false;
  var serverClosed = window.TTG_JACK_LINE_OPEN === false;

  var style = document.createElement('style');
  style.textContent = 'html.jack-line-closed #jack-face,html.jack-line-closed .talk-btn,'
    + 'html.jack-line-closed [data-jack-talk]{display:none!important}'
    + 'html.jack-line-closed #blurb a{color:inherit;text-decoration:underline}';
  (document.head || root).appendChild(style);

  function remembered() {
    try {
      var t = Number(localStorage.getItem(KEY) || 0);
      return t > 0 && Date.now() - t < HOLD;
    } catch (e) { return false; }
  }

  function swapDesk() {
    var face0 = document.getElementById('jack');
    var desk = document.getElementById('jackDesk') || (face0 && face0.closest('main'));
    if (!desk || !face0 || desk.classList.contains('closed')) return;
    desk.classList.add('closed');
    var card = face0.closest('.card');
    if (card && card.tagName !== 'A') {
      var link = document.createElement('a');
      link.className = card.className;
      link.href = '/now';
      link.setAttribute('aria-label', 'Enter NOW, the tree');
      while (card.firstChild) link.appendChild(card.firstChild);
      card.parentNode.replaceChild(link, card);
    }
    var face = document.getElementById('jack');
    if (face) {
      face.removeAttribute('role');
      face.removeAttribute('tabindex');
      face.setAttribute('aria-hidden', 'true');
    }
    var h = desk.querySelector('h1');
    if (h) h.textContent = 'NOW';
    var st = document.getElementById('status');
    if (st) st.textContent = 'ENTER THE TREE';
    var blurb = document.getElementById('blurb');
    if (blurb) {
      blurb.innerHTML = 'Jack’s voice line is closed for the present. The tree is public: '
        + '<a href="/now">walk it</a>. Rather leave a statement? <a href="/lodge">The desk takes them in writing</a>.';
    }
  }

  function quietWidgets() {
    var jf = window.__jackFace;
    if (jf && !jf.__lineClosed) {
      jf.start = function () {};
      jf.__lineClosed = true;
    }
    var ts = document.getElementById('talk-status');
    if (ts) ts.textContent = 'JACK’S VOICE LINE IS CLOSED FOR THE PRESENT';
  }

  function close(remember) {
    if (remember) {
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    }
    if (closed) return;
    closed = true;
    root.classList.add('jack-line-closed');
    if (document.body) document.body.classList.add('line-closed');
    var onReady = function () {
      if (document.body) document.body.classList.add('line-closed');
      swapDesk();
      quietWidgets();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
    // jack-face.js may load after this; quiet it when it arrives.
    var tries = 0;
    var t = setInterval(function () {
      quietWidgets();
      if (window.__jackFace || ++tries > 40) clearInterval(t);
    }, 250);
    try { window.dispatchEvent(new CustomEvent('ttg:jack-line-closed')); } catch (e) {}
  }

  function reopen() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (!closed) return;
    // Interfaces were rebuilt as doors; a reload restores them cleanly.
    location.reload();
  }

  /* Wrap the SDK's startSession wherever it is loaded from. */
  function wrap(sdk) {
    var C = sdk && sdk.Conversation;
    if (!C || C.__jackLine) return;
    var start = C.startSession;
    C.startSession = function (opts) {
      if (closed) return Promise.reject(new Error('Jack’s voice line is closed (no credit).'));
      opts = opts || {};
      var spoke = false;
      var mode = opts.onModeChange, disc = opts.onDisconnect, err = opts.onError;
      opts.onModeChange = function (p) {
        if (p && p.mode === 'speaking') spoke = true;
        if (mode) return mode.apply(this, arguments);
      };
      opts.onDisconnect = function (d) {
        var why = String((d && (d.message || (d.context && d.context.reason))) || '');
        if (!spoke && (NO_CREDIT.test(why) || (d && d.reason === 'error' && !/microphone|permission|denied|not allowed/i.test(why)))) {
          setTimeout(function () { close(true); }, 0);
        }
        if (disc) return disc.apply(this, arguments);
      };
      opts.onError = function (msg) {
        if (!spoke && NO_CREDIT.test(String(msg || ''))) setTimeout(function () { close(true); }, 0);
        if (err) return err.apply(this, arguments);
      };
      return start.call(C, opts).catch(function (e) {
        if (NO_CREDIT.test(String((e && e.message) || e || ''))) close(true);
        throw e;
      });
    };
    C.__jackLine = true;
  }
  // jack-face.js loads the SDK only when a call starts: catch it as it lands.
  if (!('ElevenLabsClient' in window)) {
    try {
      var held;
      Object.defineProperty(window, 'ElevenLabsClient', {
        configurable: true,
        get: function () { return held; },
        set: function (v) { held = v; wrap(v); }
      });
    } catch (e) {}
  }
  var looks = 0;
  (function watch() {
    if (window.ElevenLabsClient) wrap(window.ElevenLabsClient);
    if (!(window.ElevenLabsClient && window.ElevenLabsClient.Conversation && window.ElevenLabsClient.Conversation.__jackLine) && ++looks < 600) {
      setTimeout(watch, looks < 40 ? 50 : 250);
    }
  })();

  if (window.TTG_JACK_LINE_OPEN === false || remembered()) close(false);

  if (window.fetch) {
    fetch('/jack/line.php', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        if (j.open === false) close(true);
        else if (j.open === true && !serverClosed && (closed || remembered())) reopen();
      })
      .catch(function () {});
  }

  window.TTG_JACK_LINE = { close: close, closed: function () { return closed; } };
})();
