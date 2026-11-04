(function(){
  var KEY_COOKIE = 'det_cookies';
  var KEY_SEEN = 'det_seen';
  var UNLOCK = 8;

  function seen(){
    try { return JSON.parse(localStorage.getItem(KEY_SEEN) || '[]'); }
    catch (e) { return []; }
  }
  function mark(path){
    var list = seen();
    if (list.indexOf(path) === -1) {
      list.push(path);
      try { localStorage.setItem(KEY_SEEN, JSON.stringify(list)); } catch (e) {}
    }
    return list.length;
  }
  function unlocked(){ return seen().length >= UNLOCK; }

  var path = document.body.getAttribute('data-det-path') || location.pathname;
  mark(path);

  var cookieEl = document.getElementById('cookie');
  if (cookieEl && !localStorage.getItem(KEY_COOKIE)) {
    cookieEl.hidden = false;
    cookieEl.classList.add('show');
  }
  function setCookie(v){
    localStorage.setItem(KEY_COOKIE, v);
    if (cookieEl) { cookieEl.hidden = true; cookieEl.classList.remove('show'); }
  }
  ['cookie-ok','cookie-accept'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function(){ setCookie('accept'); });
  });
  ['cookie-no','cookie-reject'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function(){ setCookie('reject'); });
  });

    var station = document.body.getAttribute('data-station') || '/station13/';
    function armTtg(el){
    if (!el) return;
    if (unlocked()) {
      el.classList.add('is-live');
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.setAttribute('href', station);
      var go = function(e){ e.preventDefault(); location.href = station; };
      el.addEventListener('click', go);
    } else {
      el.addEventListener('click', function(e){ e.preventDefault(); });
    }
  }
  armTtg(document.getElementById('ttg13'));
  document.querySelectorAll('[data-ttg13]').forEach(armTtg);

  document.querySelectorAll('.acc').forEach(function(panel){
    var btn = panel.querySelector('button');
    if (!btn) return;
    btn.addEventListener('click', function(){
      var open = panel.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  document.querySelectorAll('[data-form]').forEach(function(root){
    var steps = [].slice.call(root.querySelectorAll('.step'));
    var i = 0;
    var data = {};
    var sending = false;
    function show(n){
      steps.forEach(function(s, idx){ s.classList.toggle('is-on', idx === n); });
      i = n;
    }
    function val(id){
      var el = root.querySelector('[name="'+id+'"]');
      return el ? el.value.trim() : '';
    }
    function esc(s){
      return String(s).replace(/[&<>"']/g, function(c){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
      });
    }
    function errBox(){ return root.querySelector('[data-form-error]'); }
    function showErr(){
      var box = errBox();
      if (!box) return;
      box.hidden = false;
      if (!box.textContent.trim()) box.textContent = root.getAttribute('data-err') || 'The form could not be sent. Try again later.';
    }
    function fillCheck(){
      ['name','email','details'].forEach(function(k){ var v = val(k); if (v) data[k] = v; });
      var box = root.querySelector('[data-check]');
      if (box) {
        var ln = root.getAttribute('data-lbl-name') || 'Name';
        var le = root.getAttribute('data-lbl-email') || 'Email';
        var ld = root.getAttribute('data-lbl-details') || 'Details';
        box.innerHTML =
          '<div class="row"><dt>'+esc(ln)+'</dt><dd>'+esc(data.name||'')+'</dd></div>'+
          '<div class="row"><dt>'+esc(le)+'</dt><dd>'+esc(data.email||'')+'</dd></div>'+
          '<div class="row"><dt>'+esc(ld)+'</dt><dd>'+esc(data.details||'')+'</dd></div>';
      }
    }
    function goNext(){
      var req = steps[i] && steps[i].querySelector('[required]');
      if (req && !req.value.trim()) { req.focus(); return; }
      fillCheck();
      show(Math.min(i+1, steps.length-1));
    }
    function postForm(){
      if (sending) return;
      var form = root.tagName === 'FORM' ? root : root.querySelector('form');
      if (!form) return;
      sending = true;
      var btn = form.querySelector('[data-submit]');
      if (btn) btn.disabled = true;
      var fd = new FormData(form);
      fetch(form.action || location.href, {
        method: 'POST',
        body: fd,
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin'
      }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
        .then(function(res){
          if (res.j && res.j.ok && res.j.ref) {
            var conf = root.querySelector('[data-ref]');
            if (conf) conf.textContent = res.j.ref;
            var box = errBox();
            if (box) box.hidden = true;
            show(steps.length-1);
            return;
          }
          sending = false;
          if (btn) btn.disabled = false;
          showErr();
        })
        .catch(function(){
          sending = false;
          if (btn) btn.disabled = false;
          showErr();
        });
    }
    root.addEventListener('submit', function(e){
      e.preventDefault();
      if (steps[i] && steps[i].querySelector('[data-submit]')) postForm();
      else goNext();
    });
    root.addEventListener('click', function(e){
      var t = e.target;
      if (!t || typeof t.matches !== 'function') return;
      if (t.matches('[data-next]')) {
        e.preventDefault();
        goNext();
      }
      if (t.matches('[data-back]')) { e.preventDefault(); show(Math.max(i-1, 0)); }
      if (t.matches('[data-submit]')) {
        e.preventDefault();
        postForm();
      }
    });
    show(0);
  });

  var map = document.getElementById('ukmap');
  var panel = document.getElementById('office-panel');
  if (map && panel) {
    map.querySelectorAll('.office').forEach(function(g){
      g.addEventListener('click', function(){
        panel.innerHTML = '<h3>'+(g.getAttribute('data-name')||'')+'</h3>'+
          '<p>'+(g.getAttribute('data-role')||'')+'</p>'+
          '<p>'+(g.getAttribute('data-note')||'')+'</p>';
      });
    });
  }

  var grade = document.getElementById('job-grade');
  if (grade) {
    grade.addEventListener('change', function(){
      var v = grade.value;
      document.querySelectorAll('[data-job]').forEach(function(row){
        row.style.display = (!v || row.getAttribute('data-job') === v) ? '' : 'none';
      });
    });
  }
})();
