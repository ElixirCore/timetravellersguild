/* /jack room — mounts the shared desk. */
(function () {
  document.body.classList.add('js');
  var G = window.TTG_GRAPH || {};
  if (window.TTG_JACK_DESK) TTG_JACK_DESK.mount({ room: true });

  var hear = document.getElementById('jackHear');
  if (hear && G.jack && G.jack.voice) {
    hear.hidden = false;
    hear.addEventListener('click', function () {
      var g = document.getElementById('jackGreeting');
      var last = document.querySelector('#jackLog p.stamped');
      var text = (last && last.textContent) || (g && g.textContent) || '';
      if (window.TTG_JACK_DESK && TTG_JACK_DESK.speak) {
        TTG_JACK_DESK.speak(text, { force: true });
      }
    });
  }
})();
