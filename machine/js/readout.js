/* CRT synthesis — plain-language instrument briefing from machine state. */
(function (global) {
  'use strict';

  function stamp(iso) {
    if (!iso) return 'unknown';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 19);
      var p = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
        + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) {
      return String(iso).slice(0, 19);
    }
  }

  function yearsBetween(aIso, bIso) {
    var a = new Date(aIso).getTime();
    var b = new Date(bIso).getTime();
    if (isNaN(a) || isNaN(b)) return null;
    return (b - a) / (365.25 * 24 * 3600 * 1000);
  }

  function levelWord(disp) {
    if (disp < 0.25) return 'quiet';
    if (disp < 0.45) return 'warming';
    if (disp < 0.7) return 'working';
    if (disp < 0.88) return 'hot';
    return 'saturated';
  }

  function synthesize(state) {
    state = state || {};
    var field = state.field || {};
    var cards = state.cards || [];
    var active = cards.filter(function (c) { return c && !c.beyond; });
    var beyond = cards.filter(function (c) { return c && c.beyond; });
    var emDisp = typeof state.emergy_display === 'number' ? state.emergy_display : 0;
    var emRaw = typeof state.emergy_raw === 'number' ? state.emergy_raw : 0;
    var dy = yearsBetween(state.local_present, state.machine_present);
    var timeLine;
    if (dy == null) timeLine = 'Machine present is not comparable to local present.';
    else if (Math.abs(dy) < 0.02) timeLine = 'Machine present matches local present — you are reading the field as it stands now.';
    else if (dy > 0) timeLine = 'Machine present is ' + dy.toFixed(1) + ' years ahead of local present. Cards dated after your now appear at OUTPUT as ghosts.';
    else timeLine = 'Machine present is ' + Math.abs(dy).toFixed(1) + ' years behind local present. You are reading an earlier cut of the ledger.';

    var top = active.slice(0, 5).map(function (c) {
      return {
        title: c.title || c.slug || 'UNTITLED',
        type: c.type || 'RECORD',
        when: (c.observed_at || '').slice(0, 10),
        pending: !!c.pending,
        href: c.href || '',
        slug: c.slug || '',
      };
    });

    var next = [];
    if (state.jack_line) next.push(state.jack_line);
    if (active.length < 5) next.push('Wind PRESENT forward, or press 2033, to open more of the field.');
    if ((state.mind || 0) > 0.85) next.push('Mind aperture is wide — lower MIND if association feels noisy.');
    if ((state.matter || 0) < 0.4) next.push('Matter is thin — raise MATTER to privilege dated canon over pending slips.');
    if ((state.kappa || 0) > 2.2) next.push('κ is high — only tightly evidenced routes survive. Ease κ to admit looser context.');
    var mm = state._machine || {};
    if (mm.fault) next.unshift('FAULT — ' + mm.fault);
    if (mm.destination && mm.cost > mm.capacity) next.push('The drum destination costs more charge than the field supplies — raise MIND or ease κ.');
    if (!next.length) next.push('Click a punchcard in the READ path to inspect a record. Set the drum and pull ENGAGE to travel.');

    return {
      title: state.instrument || 'TIME MACHINE №13',
      headline: levelWord(emDisp).toUpperCase() + ' · E ' + emDisp.toFixed(3),
      time: {
        local: stamp(state.local_present),
        machine: stamp(state.machine_present),
        network: stamp(state.network_present),
        line: timeLine,
      },
      field: {
        active: field.active_cards != null ? field.active_cards : active.length,
        total: field.node_count != null ? field.node_count : cards.length,
        beyond: beyond.length,
        edges: field.edge_count != null ? field.edge_count : null,
        line: (field.active_cards != null ? field.active_cards : active.length)
          + ' active records in the machine present; '
          + beyond.length
          + ' beyond it (OUTPUT).',
      },
      emergy: {
        display: emDisp,
        raw: emRaw,
        word: levelWord(emDisp),
        mind: state.mind,
        matter: state.matter,
        kappa: state.kappa,
        delta: state.delta_context,
        dcAxis: state.dc_axis || 'TIME',
        line: 'Emergy is '
          + levelWord(emDisp)
          + ' (level '
          + emDisp.toFixed(3)
          + ', raw '
          + emRaw.toFixed(4)
          + '). Built from mind '
          + num(state.mind)
          + ', matter '
          + num(state.matter)
          + ', κ '
          + num(state.kappa)
          + ', ΔC '
          + num(state.delta_context)
          + ' on axis '
          + (state.dc_axis || 'TIME')
          + '.',
      },
      jack: state.jack_line || '',
      focus: state.focus || '',
      top: top,
      next: next,
    };
  }

  function num(v) {
    return typeof v === 'number' ? v.toFixed(3) : '—';
  }

  function renderReadout(el, state) {
    if (!el) return;
    var s = synthesize(state);
    var topHtml = s.top.map(function (c) {
      var tag = c.pending ? ' · pending' : '';
      var href = c.href || (c.slug ? '/n/' + encodeURIComponent(c.slug) + '/' : '');
      var title = escapeHtml(c.title);
      if (href) {
        return '<li><a href="' + escapeHtml(href) + '">' + title + '</a>'
          + '<span>' + escapeHtml(c.type) + (c.when ? ' · ' + escapeHtml(c.when) : '') + tag + '</span></li>';
      }
      return '<li><strong>' + title + '</strong>'
        + '<span>' + escapeHtml(c.type) + tag + '</span></li>';
    }).join('');
    if (!topHtml) topHtml = '<li><span>No active cards in this cut.</span></li>';

    el.innerHTML =
      '<button type="button" class="readout-close" id="readoutClose" aria-label="Close readout">×</button>'
      + '<p class="readout-kicker">' + escapeHtml(s.title) + '</p>'
      + '<h2>' + escapeHtml(s.headline) + '</h2>'
      + '<section><h3>TIME</h3><p>' + escapeHtml(s.time.line) + '</p>'
      + '<dl><div><dt>LOCAL</dt><dd>' + escapeHtml(s.time.local) + '</dd></div>'
      + '<div><dt>MACHINE</dt><dd>' + escapeHtml(s.time.machine) + '</dd></div>'
      + '<div><dt>NETWORK</dt><dd>' + escapeHtml(s.time.network) + '</dd></div></dl></section>'
      + '<section><h3>FIELD</h3><p>' + escapeHtml(s.field.line) + '</p></section>'
      + '<section><h3>EMERGY</h3><p>' + escapeHtml(s.emergy.line) + '</p></section>'
      + (s.jack
        ? '<section class="jack"><h3>JACK</h3><p>' + escapeHtml(s.jack) + '</p></section>'
        : '')
      + '<section><h3>IN THE HOPPER</h3><ul class="readout-cards">' + topHtml + '</ul></section>'
      + '<section><h3>NEXT</h3><ul class="readout-next">'
      + s.next.map(function (n) { return '<li>' + escapeHtml(n) + '</li>'; }).join('')
      + '</ul></section>'
      + travelHtml(state && state._machine)
      + '<section><h3>KEYS</h3><p class="readout-keys">'
      + '<kbd>[</kbd> <kbd>]</kbd> wind present · <kbd>,</kbd> <kbd>.</kbd> turn destination drum · '
      + '<kbd>T</kbd> engage · <kbd>H</kbd> hold · <kbd>M</kbd> CRT mode · <kbd>S</kbd> sync · <kbd>R</kbd> readout · '
      + 'scroll over any knob, switch or drum to turn it.</p></section>';
  }

  function travelHtml(mm) {
    if (!mm) return '';
    var out = '';
    if (mm.destination) {
      var ok = !(mm.cost > mm.capacity);
      out += '<section><h3>DESTINATION</h3><p>'
        + escapeHtml(mm.destination.label) + ' · ' + escapeHtml(mm.destination.when) + ' · ' + escapeHtml(mm.destination.kind)
        + '</p><p>Cost ' + num(mm.cost) + ' against charge ' + num(mm.capacity) + ' — '
        + (ok ? 'the jump will hold. Pull ENGAGE.' : 'insufficient. Raise MIND, ease κ or MATTER, or choose a nearer date.')
        + '</p></section>';
    }
    if (mm.excluded && mm.excluded.length) {
      out += '<section><h3>SELECTOR</h3><p>Excluded from the field: ' + escapeHtml(mm.excluded.join(', ')) + '.</p></section>';
    }
    var L = mm.ledger || [];
    if (L.length) {
      out += '<section><h3>LEDGER</h3><ul class="readout-cards">' + L.map(function (e) {
        return '<li><strong>№' + escapeHtml(e.n) + ' ' + escapeHtml(e.label) + '</strong><span>'
          + escapeHtml(String(e.from).slice(0, 10)) + ' → ' + escapeHtml(String(e.to).slice(0, 10)) + ' · Δ ' + escapeHtml(e.years) + ' y</span></li>';
      }).join('') + '</ul></section>';
    }
    return out;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.TTGMachineReadout = {
    synthesize: synthesize,
    render: renderReadout,
  };
})(window);
