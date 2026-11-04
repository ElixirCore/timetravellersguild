/* Check slips against SHA-256 on the server. Answers never travel as a key. */
(function () {
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function check(n, q, out) {
    if (!out) return;
    out.textContent = '…';
    out.className = 'verdict';
    var data = new FormData();
    data.set('n', n);
    data.set('q', q);
    fetch('/jack/puzzle/check.php', { method: 'POST', body: data, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          out.textContent = 'Stamped.';
          out.className = 'verdict yes';
          try { localStorage.setItem('ttg-j1951-' + n, q); } catch (e) {}
          if (n === 'card' && j.stamp) {
            var st = $('#cardStamp');
            if (st) st.textContent = j.stamp;
          }
        } else {
          out.textContent = 'The machinery does not recognise that reading.';
          out.className = 'verdict no';
        }
      })
      .catch(function () {
        out.textContent = 'The checker is away from the desk.';
        out.className = 'verdict no';
      });
  }

  $$('form[data-check]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = form.getAttribute('data-check');
      var field = $('input[name=q], textarea[name=q]', form);
      check(n, field ? field.value : '', $('.verdict', form));
    });
  });

  var decodeOut = $('#colRead');
  $$('.punch-svg .col-hit').forEach(function (hit) {
    hit.addEventListener('click', function () {
      var svg = hit.closest('svg');
      $$('.col-hit', svg).forEach(function (x) { x.classList.remove('is-on'); });
      $$('.hole', svg).forEach(function (x) { x.classList.remove('is-on'); });
      hit.classList.add('is-on');
      $$('.hole[data-col="' + hit.getAttribute('data-col') + '"]', svg).forEach(function (x) {
        x.classList.add('is-on');
      });
      if (decodeOut && svg && svg.closest('#p01')) {
        var rows = hit.getAttribute('data-rows');
        decodeOut.textContent = rows === 'blank'
          ? 'Column ' + hit.getAttribute('data-col') + ' is blank. A blank column is a space.'
          : 'Column ' + hit.getAttribute('data-col') + ' is punched ' + rows + '. Apply the issued key.';
      }
    });
  });

  var indexOut = $('#indexLetters');
  var extract = $('[data-ans="02"]');
  function refreshIndex() {
    var letters = $$('.across').map(function (el) {
      var v = (el.value || '').replace(/[^A-Za-z]/g, '');
      return v.charAt(0).toUpperCase() || '·';
    }).join('');
    if (indexOut) indexOut.textContent = 'First letters, downward: ' + letters;
    if (extract && letters.indexOf('·') === -1 && letters.length === 7) extract.value = letters;
  }
  $$('.across').forEach(function (el) {
    el.addEventListener('input', refreshIndex);
  });

  var assemble = $('#assemble');
  if (assemble) {
    assemble.addEventListener('click', function () {
      var g = function (n) {
        var el = $('[data-ans="' + n + '"]');
        if (el && el.value) return el.value.trim();
        try { return localStorage.getItem('ttg-j1951-' + n) || ''; } catch (e) { return ''; }
      };
      var a1 = g('01'), a2 = g('02'), a3 = g('03'), a4 = g('04'), a5 = g('05'), a6 = g('06'), a7 = g('07');
      var card = a1 + '. I enter as a ' + a2 + '. I offer ' + a3 + ', retain ' + a4 + ', and proceed with ' + a7 + '. REFERENCE: FILE ' + a5 + ' / WAREHOUSE ' + a6 + '.';
      var box = $('#cardOut');
      if (box) box.value = card;
    });
  }
})();
