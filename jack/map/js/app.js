/* Map enquiry. Search excites tissue. Trace follows a filed bag. No live pulse. */
(function (M) {
  'use strict';

  var topo = null;
  var byId = {};
  var selected = null;

  function $(id) { return document.getElementById(id); }

  function api(op, q) {
    var url = '/api/map/' + op;
    if (q) url += (url.indexOf('?') >= 0 ? '&' : '?') + q;
    return fetch(url, { cache: 'no-store', credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('map_' + op);
      return res.json();
    });
  }

  function index(data) {
    byId = {};
    (data.nodes || []).forEach(function (n) { byId[n.id] = n; });
  }

  function keepFocus(node) {
    if (!node) return;
    try {
      sessionStorage.setItem('ttg.jack.map.focus', JSON.stringify({
        id: node.id,
        name: node.name,
        anatomy: node.anatomy,
        place: node.geography && node.geography.place,
        flavour: node.flavour
      }));
    } catch (e) {}
  }

  function askHref(id) {
    return '/jack/room/?map=' + encodeURIComponent(id);
  }

  function fillInspect(node) {
    selected = node;
    var pane = $('inspect');
    if (!pane || !node) return;
    pane.hidden = false;
    document.body.classList.add('inspect-open');
    M.Globe.select(node.id);
    keepFocus(node);
    var geo = node.geography;
    var addr = node.earth_address;
    var where = node.kind === 'robot'
      ? 'No street. Process only. Off the Earth so it is not taken for a city.'
      : ((geo && geo.place) || '—') + ' · city mark · approximate';
    if (addr) where += ' · cell ' + addr.tetra_face + '/' + (addr.path || []).join('');
    var kids = (node.children || []).map(function (id) { return byId[id]; }).filter(Boolean);
    var childHtml = kids.map(function (c) {
      return '<button type="button" class="child" data-id="' + c.id + '">' + c.name + '</button>';
    }).join('');
    $('insName').textContent = node.name;
    $('insAnatomy').textContent = (node.anatomy || '') + ' · ' + (node.kind || '').toUpperCase();
    $('insWhere').textContent = where;
    $('insWhat').textContent = (node.technical_type || '') + (node.href ? ' · ' + node.href : '');
    $('insWhy').textContent = node.provenance || '—';
    $('insWhen').textContent = node.created || '—';
    $('insFlavour').textContent = node.flavour || '';
    $('insKids').innerHTML = childHtml;
    var ask = $('insAsk');
    if (ask) ask.href = askHref(node.id);
    var open = $('insOpen');
    if (open) {
      if (node.href) {
        open.hidden = false;
        open.href = node.href;
      } else open.hidden = true;
    }
    var status = $('insStatus');
    if (status) status.textContent = (node.status || 'archive').toUpperCase() + ' · NO LIVE TELEMETRY';
  }

  function inspect(id) {
    var node = byId[id];
    if (!node) {
      api('nodes', 'id=' + encodeURIComponent(id)).then(function (res) {
        if (res.nodes && res.nodes[0]) {
          byId[res.nodes[0].id] = res.nodes[0];
          inspect(res.nodes[0].id);
        }
      });
      return;
    }
    fillInspect(node);
    if (node.kind === 'robot') M.Globe.lookRobot();
    else if (node.geography) M.Globe.lookAt(node.geography.lat, node.geography.lon);
    var nerves = (topo.nerves || []).filter(function (e) { return e.from === id || e.to === id; }).map(function (e) { return e.id; });
    M.Globe.light([id].concat(node.children || []).concat(nerves));
  }

  function search() {
    var q = ($('q') && $('q').value || '').trim();
    if (!q) {
      M.Globe.light([]);
      $('hits').textContent = '';
      return;
    }
    api('search', 'q=' + encodeURIComponent(q)).then(function (res) {
      var nodes = res.nodes || [];
      var holds = res.holdings || [];
      var ids = nodes.map(function (n) { return n.id; });
      holds.forEach(function (h) {
        if (h.node) ids.push(h.node);
        (h.path || []).forEach(function (id) { ids.push(id); });
      });
      M.Globe.light(ids);
      $('hits').textContent = nodes.length + ' stations · ' + holds.length + ' holdings';
      if (nodes[0] && nodes[0].geography) M.Globe.lookAt(nodes[0].geography.lat, nodes[0].geography.lon);
      else if (nodes[0] && nodes[0].kind === 'robot') M.Globe.lookRobot();
      if (nodes.length === 1) inspect(nodes[0].id);
    }).catch(function () {
      $('hits').textContent = 'The index did not answer.';
    });
  }

  function trace(id) {
    var key = id || (selected && (selected.id === 'holding-punch-deck' || selected.id === 'node-hopper' || selected.id === 'station-abercrave') ? 'holding-punch-deck' : (selected && selected.id));
    if (!key) key = 'holding-punch-deck';
    api('trace', 'id=' + encodeURIComponent(key)).then(function (res) {
      var t = res.trace;
      if (!t) return;
      M.Globe.light(t.path || []);
      $('hits').textContent = (t.label || 'TRACE') + ' · ' + (t.note || '');
      var first = (t.path || []).map(function (id) { return byId[id]; }).filter(Boolean)[0];
      if (first && first.geography) M.Globe.lookAt(first.geography.lat, first.geography.lon);
    }).catch(function () {
      $('hits').textContent = 'No filed path.';
    });
  }

  function setTime() {
    var el = $('when');
    var v = el ? el.value : '';
    M.Globe.setTime(v || '9999-12-31');
    $('whenOut').textContent = v ? ('FILED TO ' + v) : 'ALL FILED STATIONS';
  }

  function listFallback(data) {
    var box = $('fallback');
    if (!box) return;
    box.innerHTML = (data.nodes || []).filter(function (n) {
      return String(n.id).indexOf('station-') === 0 || n.kind === 'robot';
    }).map(function (n) {
      return '<button type="button" data-id="' + n.id + '">' + n.name + '</button>';
    }).join('');
  }

  function boot() {
    var canvas = $('stage');
    var ok = M.Globe.attach(canvas, $('labels'));
    document.body.classList.toggle('no-gl', !ok);
    M.Globe.onPick(inspect);
    api('topology').then(function (data) {
      topo = data;
      index(data);
      M.Globe.load(data);
      listFallback(data);
      $('modeLine').textContent = 'STATIC · HUMAN POST · ROBOT SHUFFLE ONLY';
      var want = new URLSearchParams(location.search).get('node');
      if (want) inspect(want);
    }).catch(function () {
      $('modeLine').textContent = 'TOPOLOGY MISSING';
    });
    $('q') && $('q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); search(); }
    });
    $('btnSearch') && $('btnSearch').addEventListener('click', search);
    $('btnTrace') && $('btnTrace').addEventListener('click', function () { trace(); });
    $('btnClose') && $('btnClose').addEventListener('click', function () {
      $('inspect').hidden = true;
      document.body.classList.remove('inspect-open');
      M.Globe.select(null);
      M.Globe.light([]);
    });
    $('when') && $('when').addEventListener('input', setTime);
    $('insKids') && $('insKids').addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (b) inspect(b.getAttribute('data-id'));
    });
    $('fallback') && $('fallback').addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]');
      if (b) inspect(b.getAttribute('data-id'));
    });
    $('btnDeck') && $('btnDeck').addEventListener('click', function () { trace('holding-punch-deck'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.JackMap = window.JackMap || {});
