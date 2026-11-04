/* /jack room — mounts the shared desk. */
(function () {
  document.body.classList.add('js');
  if (window.TTG_JACK_DESK) TTG_JACK_DESK.mount({ room: true });
})();
