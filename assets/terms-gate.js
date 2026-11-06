/* Grand narrative agreement prompt.
   Submission endpoints answer 403 {terms:true, agree} until a traveller has agreed
   (people/inc/terms.php). This notices that answer on any fetch from the page and shows
   one banner with the agreement, opened in a new tab so unsaved work on this page is kept. */
(function () {
  'use strict';
  if (window.__ttgTermsGate || !window.fetch) return;
  window.__ttgTermsGate = true;
  var AGREE = '/people/agree/?next=' + encodeURIComponent('/people/agree/?close=1');
  var shown = null;

  function banner(message) {
    if (shown) { shown.hidden = false; return; }
    var b = document.createElement('div');
    b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;z-index:2147483000;left:12px;right:12px;bottom:12px;max-width:640px;margin:0 auto;'
      + 'background:#1b1a17;color:#f6efd8;border:2px solid #d9cb9e;padding:12px 14px;font:14px/1.45 system-ui,sans-serif;'
      + 'box-shadow:0 8px 30px rgba(0,0,0,.45);display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center';
    var p = document.createElement('span');
    p.style.cssText = 'flex:1 1 260px';
    p.textContent = message + ' Agree once, then press save again: nothing on this page is lost.';
    var a = document.createElement('a');
    a.href = AGREE; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'Read and agree (new tab)';
    a.style.cssText = 'color:#1b1a17;background:#d9cb9e;padding:8px 12px;text-decoration:none;font-weight:700';
    var x = document.createElement('button');
    x.type = 'button'; x.textContent = 'Dismiss';
    x.style.cssText = 'background:none;color:#f6efd8;border:1px solid #6d6655;padding:7px 10px;cursor:pointer';
    x.addEventListener('click', function () { b.hidden = true; });
    b.append(p, a, x);
    document.body.appendChild(b);
    shown = b;
  }

  var real = window.fetch;
  window.fetch = function () {
    return real.apply(this, arguments).then(function (res) {
      if (res.status === 403 && /json/.test(res.headers.get('content-type') || '')) {
        res.clone().json().then(function (j) {
          if (j && j.terms) banner(j.error || 'Before your work joins the Guild, agree to lend it to the grand narrative.');
        }).catch(function () {});
      }
      return res;
    });
  };
})();
