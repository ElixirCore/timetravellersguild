/* Jack’s hole-punch deck. Draw is local. Reading is the clerk. Cube wiring later. */
(function (global) {
  'use strict';

  var MAJOR = [
    'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
    'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
    'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
    'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World'
  ];
  var SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'];
  var PIPS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];
  var DEPT = { Wands: 'PROGRAMME', Cups: 'RECOLLECTION', Swords: 'CLASSIFICATION', Pentacles: 'RECORD', 'Major Arcana': 'STANDING' };
  var STANDING = {
    'The Fool': { index: 0, roman: '0', title: 'THE UNCLASSIFIED NODE', short: 'UNCLASSIFIED', glyph: 'glyph-00-unclassified' },
    'The Magician': { index: 1, roman: 'I', title: 'THE OPERATOR', short: 'THE OPERATOR', glyph: 'glyph-01-operator' },
    'The High Priestess': { index: 2, roman: 'II', title: 'MABEL', short: 'MABEL', glyph: 'glyph-02-mabel' },
    'The Empress': { index: 3, roman: 'III', title: 'THE TERRITORY', short: 'THE TERRITORY', glyph: 'glyph-03-territory' },
    'The Emperor': { index: 4, roman: 'IV', title: 'THE CONSTITUTIONAL LEDGER', short: 'CONST. LEDGER', glyph: 'glyph-04-ledger' },
    'The Hierophant': { index: 5, roman: 'V', title: 'THE DEPARTMENT', short: 'THE DEPARTMENT', glyph: 'glyph-05-department' },
    'The Lovers': { index: 6, roman: 'VI', title: 'THE EDGE', short: 'THE EDGE', glyph: 'glyph-06-edge' },
    'The Chariot': { index: 7, roman: 'VII', title: 'MOONLY', short: 'MOONLY', glyph: 'glyph-07-moonly' },
    'Justice': { index: 8, roman: 'VIII', title: 'PROVENANCE', short: 'PROVENANCE', glyph: 'glyph-08-provenance' },
    'The Hermit': { index: 9, roman: 'IX', title: 'JACK AT THE DESK', short: 'JACK AT THE DESK', glyph: 'glyph-09-jack' },
    'Wheel of Fortune': { index: 10, roman: 'X', title: "ARIANRHOD'S REEL", short: 'ARIANRHOD', glyph: 'glyph-10-wheel' },
    'Strength': { index: 11, roman: 'XI', title: 'CONSENT', short: 'CONSENT', glyph: 'glyph-11-consent' },
    'The Hanged Man': { index: 12, roman: 'XII', title: 'THE PRE-TRAVEL INTERVAL', short: 'PRE-TRAVEL', glyph: 'glyph-12-pretravel' },
    'Death': { index: 13, roman: 'XIII', title: 'STATION 13', short: 'STATION 13', glyph: 'glyph-13-station13' },
    'Temperance': { index: 14, roman: 'XIV', title: 'THE CHRONOMETER', short: 'CHRONOMETER', glyph: 'glyph-14-chronometer' },
    'The Devil': { index: 15, roman: 'XV', title: 'ELIXIRCORP', short: 'ELIXIRCORP', glyph: 'glyph-15-elixircorp' },
    'The Tower': { index: 16, roman: 'XVI', title: 'THE HOUSE AT ABERCRAVE', short: 'ABERCRAVE', glyph: 'glyph-16-house' },
    'The Star': { index: 17, roman: 'XVII', title: 'THE SIGNAL', short: 'THE SIGNAL', glyph: 'glyph-17-signal' },
    'The Moon': { index: 18, roman: 'XVIII', title: 'ANAMNESIA', short: 'ANAMNESIA', glyph: 'glyph-18-anamnesia' },
    'The Sun': { index: 19, roman: 'XIX', title: 'SIMULTANEOUS RECOLLECTION', short: 'SIMULT. RECOLL.', glyph: 'glyph-19-recollection' },
    'Judgement': { index: 20, roman: 'XX', title: 'THE AUDIT', short: 'THE AUDIT', glyph: 'glyph-20-audit' },
    'The World': { index: 21, roman: 'XXI', title: 'THE CANONICAL GRAPH', short: 'CANONICAL GRAPH', glyph: 'glyph-21-graph' }
  };
  var SUIT_GLYPH = { Wands: 'glyph-suit-programme', Cups: 'glyph-suit-recollection', Swords: 'glyph-suit-classification', Pentacles: 'glyph-suit-record' };
  var SUIT_MARK = { Wands: 'mark-programme', Cups: 'mark-recollection', Swords: 'mark-classification', Pentacles: 'mark-record' };
  var PIP_N = { Ace: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8, Nine: 9, Ten: 10 };

  var DECK = MAJOR.map(function (name) {
    return { name: name, suit: 'Major Arcana', dept: 'STANDING' };
  }).concat(SUITS.flatMap(function (suit) {
    return PIPS.map(function (pip) {
      return { name: pip + ' of ' + suit, suit: suit, dept: DEPT[suit] };
    });
  }));

  var SPREADS = {
    'one-slip': { label: 'ONE SLIP', count: 1, positions: ['The slip'] },
    'three-stations': { label: 'THREE STATIONS', count: 3, positions: ['Held', 'Present', 'Unfiled'] },
    'cross-file': { label: 'CROSS FILE', count: 5, positions: ['Centre', 'Challenge', 'Foundation', 'Prior', 'Potential'] },
    'full-hopper': {
      label: 'FULL HOPPER',
      count: 10,
      positions: [
        'The situation', 'The challenge', 'The foundation', 'The recent past',
        'The crown', 'The near', 'Your position', 'External',
        'Hopes and fears', 'The outcome'
      ]
    }
  };

  var ALPHA = 1;
  var BETA = 9;
  var currentSpread = 'three-stations';
  var lastCopyText = '';
  var lastDraw = null;
  var copyResetTimer = null;
  var hopperPhase = 'SENSE';
  var dealing = false;

  function $(id) { return document.getElementById(id); }

  function gammaInt(k) {
    var s = 0, i;
    for (i = 0; i < k; i++) s -= Math.log(1 - Math.random());
    return s;
  }

  function drawReversalRate() {
    var a = gammaInt(ALPHA);
    var b = gammaInt(BETA);
    return a / (a + b);
  }

  function weatherBand(rate) {
    if (rate < 0.031) return 'still';
    if (rate < 0.143) return 'settled';
    if (rate < 0.226) return 'unsettled';
    if (rate < 0.400) return 'turbulent';
    return 'storm';
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function pipPoints(n) {
    if (n === 1) return [[180, 295]];
    if (n === 2) return [[180, 230], [180, 360]];
    if (n === 3) return [[180, 220], [180, 295], [180, 370]];
    if (n === 4) return [[140, 230], [220, 230], [140, 360], [220, 360]];
    if (n === 5) return [[140, 230], [220, 230], [180, 295], [140, 360], [220, 360]];
    if (n === 6) return [[140, 220], [220, 220], [140, 295], [220, 295], [140, 370], [220, 370]];
    if (n === 7) return [[140, 220], [220, 220], [180, 255], [140, 295], [220, 295], [140, 370], [220, 370]];
    if (n === 8) return [[140, 215], [220, 215], [140, 268], [220, 268], [140, 322], [220, 322], [140, 375], [220, 375]];
    if (n === 9) return [[140, 220], [180, 220], [220, 220], [140, 295], [180, 295], [220, 295], [140, 370], [180, 370], [220, 370]];
    if (n === 10) return [[140, 210], [220, 210], [140, 255], [220, 255], [180, 295], [140, 335], [220, 335], [140, 380], [220, 380], [180, 348]];
    return [[180, 295]];
  }

  function cardSvg(card) {
    var standing = STANDING[card.name];
    var stamp = card.reversed ? 'FACE-DOWN · COLUMNS UNREAD' : 'OFF THE RECORD';
    var wash = card.reversed ? '<path d="M 24,0 L 360,0 L 360,600 L 0,600 L 0,24 Z" fill="#b2533e" fill-opacity="0.12"/>' : '';
    var field;
    var left;
    var mid;
    var right;
    if (standing) {
      left = standing.roman;
      mid = standing.short;
      right = (standing.index < 10 ? '0' : '') + standing.index;
      field = '<use href="#' + standing.glyph + '"/>';
    } else {
      var pip = card.name.split(' of ')[0];
      var n = PIP_N[pip];
      left = (pip || 'SLIP').toUpperCase();
      mid = card.dept || 'SLIP';
      right = card.dept ? card.dept.slice(0, 3) : '---';
      if (n) {
        var mark = SUIT_MARK[card.suit] || 'mark-record';
        field = pipPoints(n).map(function (pt) {
          return '<use href="#' + mark + '" transform="translate(' + pt[0] + ' ' + pt[1] + ')"/>';
        }).join('');
      } else {
        field = '<use href="#' + (SUIT_GLYPH[card.suit] || 'glyph-suit-record') + '"/>' +
          '<text x="180" y="420" font-family="Courier New, Courier, monospace" font-size="14" text-anchor="middle" fill="#161814">' + esc(left) + '</text>';
      }
    }
    return '<svg viewBox="0 0 360 600" class="ttg-card' + (card.reversed ? ' reversed' : '') + '" role="img" aria-label="' + esc((standing && standing.title) || card.name) + '">' +
      '<use href="#card-chassis"/>' + wash +
      '<text x="32" y="38" font-family="Courier New, Courier, monospace" font-size="13" font-weight="bold" fill="#161814">' + esc(left) + '</text>' +
      '<text x="180" y="38" font-family="Courier New, Courier, monospace" font-size="10" text-anchor="middle" fill="#161814">' + esc(mid) + '</text>' +
      '<text x="328" y="38" font-family="Courier New, Courier, monospace" font-size="11" text-anchor="end" fill="#b2533e">' + esc(right) + '</text>' +
      field +
      '<text x="30" y="565" font-family="Courier New, Courier, monospace" font-size="8" fill="#7b8070">TIMETRAVELLERSGUILD.COM</text>' +
      '<text x="330" y="565" font-family="Courier New, Courier, monospace" font-size="8" text-anchor="end" fill="#b2533e">' + stamp + '</text>' +
      '</svg>';
  }

  function drawCards(count) {
    var deck = DECK.slice();
    var i, j, t;
    for (i = deck.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = deck[i];
      deck[i] = deck[j];
      deck[j] = t;
    }
    var rate = drawReversalRate();
    var cards = deck.slice(0, count).map(function (c) {
      return { name: c.name, suit: c.suit, dept: c.dept, reversed: Math.random() < rate };
    });
    return { cards: cards, rate: rate, band: weatherBand(rate) };
  }

  function renderSpreads() {
    var box = $('spread-buttons');
    if (!box) return;
    box.innerHTML = '';
    Object.keys(SPREADS).forEach(function (id) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'spread-btn' + (id === currentSpread ? ' active' : '');
      btn.textContent = SPREADS[id].label;
      btn.addEventListener('click', function () {
        currentSpread = id;
        box.querySelectorAll('.spread-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
      box.appendChild(btn);
    });
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + String(n);
  }
  function cardId(card) {
    var standing = STANDING[card.name];
    if (standing) return 'major-' + pad2(standing.index);
    var parts = String(card.name || '').split(' of ');
    var rank = { Ace: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8, Nine: 9, Ten: 10, Page: 11, Knight: 12, Queen: 13, King: 14 }[parts[0]];
    var suit = { Wands: 'wands', Cups: 'cups', Swords: 'swords', Pentacles: 'pentacles' }[parts[1] || card.suit];
    if (rank && suit) return suit + '-' + pad2(rank);
    return '';
  }

  function dossierFor(name) {
    var pack = global.TTG_TAROT_DOSSIERS || {};
    return pack[name] || null;
  }

  function stationBlurb(station) {
    var map = {
      'The slip': 'One hole. What the hopper released for the file you held.',
      Held: 'What you walked in carrying — the prior already in the pocket.',
      Present: 'The desk as it stands.',
      Unfiled: 'The hole that has not been punched yet.',
      Centre: 'The matter itself.',
      Challenge: 'What cuts across the matter.',
      Foundation: 'What the pile is sitting on.',
      Prior: 'The last stamp that still marks the page.',
      Potential: 'What could be filed next if they allow it.',
      'The situation': 'The file as it arrived.',
      'The challenge': 'What is cutting across it.',
      'The foundation': 'What it sits on.',
      'The recent past': 'The stamp still wet.',
      'The crown': 'What is hanging over the desk.',
      'The near': 'What is about to come through.',
      'Your position': 'Where you are standing in the room.',
      External: 'What the room is doing without asking you.',
      'Hopes and fears': 'What you are feeding the hopper from inside.',
      'The outcome': 'Where this file is likely to land if nobody interferes.'
    };
    return map[station] || 'A working station in this hopper.';
  }

  function inspectPayload(card, station, question, serverSlip) {
    if (serverSlip && serverSlip.title) return serverSlip;
    var d = dossierFor(card.name) || {};
    var title = d.title || (STANDING[card.name] && STANDING[card.name].title) || card.name;
    var sense = card.reversed ? (d.down || '') : (d.up || '');
    var q = String(question || '').trim();
    var side = card.reversed ? 'It came through face-down. The punch is working on the underside.' : 'It came through face-up. The columns are open.';
    var lean = q
      ? 'You held: ' + q + ' ' + station + ' is where that file is being looked at. ' + title + ' fell here. ' + side + (sense ? ' Against that question: ' + sense : '')
      : station + ' is ' + stationBlurb(station) + ' ' + title + ' is what landed. ' + side + (sense ? ' ' + sense : '');
    return {
      station: station,
      title: title,
      catalog: card.name,
      dept: d.dept || card.dept || '',
      compiled: d.compiled || '',
      reversed: !!card.reversed,
      sense: sense,
      blurb: stationBlurb(station),
      lean: lean,
      id: d.id || cardId(card)
    };
  }

  function closeInspect() {
    var box = $('inspect');
    if (box && box.open) box.close();
  }

  function openInspect(index) {
    if (!lastDraw) return;
    var card = lastDraw.cards[index];
    var station = (lastDraw.positions || [])[index] || ('Station ' + (index + 1));
    var server = lastDraw.slips && lastDraw.slips[index];
    var slip = inspectPayload(card, station, lastDraw.question || '', server);
    var box = $('inspect');
    if (!box) return;
    $('inspect-kicker').textContent = (slip.dept || 'SLIP') + (slip.reversed ? ' · FACE-DOWN' : ' · FACE-UP');
    $('inspect-station').textContent = slip.station;
    $('inspect-title').textContent = slip.title;
    $('inspect-meta').textContent = [slip.compiled, slip.catalog].filter(Boolean).join(' · ');
    $('inspect-blurb').textContent = slip.blurb;
    $('inspect-lean').textContent = slip.lean;
    $('inspect-sense').textContent = slip.sense || '';
    var mount = $('inspect-card');
    mount.innerHTML = cardSvg(card);
    var link = $('inspect-catalog');
    if (link) {
      link.href = slip.id ? '/deck/' + slip.id : '/deck/';
      link.hidden = !slip.id;
    }
    if (typeof box.showModal === 'function') box.showModal();
    else box.setAttribute('open', '');
  }

  function renderCards(cards, positions) {
    var grid = $('cards-grid');
    grid.innerHTML = '';
    grid.setAttribute('data-count', String(cards.length));
    cards.forEach(function (card, i) {
      var wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'card-wrap';
      wrap.setAttribute('data-i', String(i));
      wrap.setAttribute('aria-label', 'Inspect ' + ((STANDING[card.name] && STANDING[card.name].title) || card.name));
      wrap.innerHTML = cardSvg(card);
      var pos = document.createElement('div');
      pos.className = 'card-position';
      pos.textContent = positions[i];
      var nameBelow = document.createElement('div');
      var shown = (STANDING[card.name] && STANDING[card.name].title) || card.name;
      nameBelow.className = 'card-name-below' + (card.reversed ? ' reversed' : '');
      nameBelow.textContent = shown + (card.reversed ? ' ↻' : '');
      wrap.appendChild(pos);
      wrap.appendChild(nameBelow);
      wrap.addEventListener('click', function () { openInspect(i); });
      grid.appendChild(wrap);
    });
    return grid.querySelectorAll('.card-wrap');
  }

  function aimFromJack(wraps) {
    var jack = $('jackPet');
    if (!jack) return;
    var j = jack.getBoundingClientRect();
    var jx = j.left + j.width * 0.72;
    var jy = j.top + j.height * 0.58;
    wraps.forEach(function (wrap) {
      var w = wrap.getBoundingClientRect();
      wrap.style.setProperty('--from-x', (jx - (w.left + w.width / 2)) + 'px');
      wrap.style.setProperty('--from-y', (jy - (w.top + w.height / 2)) + 'px');
    });
  }

  function dealSlips(wraps) {
    var Spr = global.Jack && global.Jack.Sprite;
    dealing = true;
    hopperPhase = 'CARD';
    var dealer = $('dealer');
    if (dealer) dealer.classList.add('dealing');
    if (Spr) Spr.deal(wraps.length);
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    wraps.forEach(function (wrap, i) {
      var delay = reduce ? 0 : 80 + i * 380;
      setTimeout(function () {
        if (Spr) Spr.dealBeat();
        wrap.classList.add('dealt');
        if (i === wraps.length - 1) {
          dealing = false;
          if (dealer) dealer.classList.remove('dealing');
        }
      }, delay);
    });
  }

  function proseToHtml(text) {
    var s = String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return s.split(/\n{2,}/).map(function (p) {
      return '<p>' + p.trim().replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function buildCopyText(cards, positions, spreadName, question, reading) {
    var date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var lines = ['JACK / TAROT — ' + spreadName, date, 'Working slip. Not canon.'];
    if (question.trim()) lines.push('', '"' + question.trim() + '"');
    lines.push('');
    cards.forEach(function (c, i) {
      lines.push(positions[i] + ': ' + c.name + (c.reversed ? ' (face-down)' : ''));
    });
    lines.push('', reading.trim());
    return lines.join('\n');
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyReading() {
    if (!lastCopyText) return;
    var btn = $('copy-btn');
    var ok = false;
    var done = function (pass) {
      btn.textContent = pass ? 'COPIED' : 'COPY FAILED';
      btn.classList.toggle('done', pass);
      clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(function () {
        btn.textContent = 'COPY SLIP';
        btn.classList.remove('done');
      }, 2200);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(lastCopyText).then(function () { done(true); }).catch(function () {
        done(legacyCopy(lastCopyText));
      });
      return;
    }
    done(legacyCopy(lastCopyText));
  }

  function localFallback(cards, positions, question) {
    var lines = [];
    lines.push(question.trim()
      ? 'You held: ' + question.trim() + ' I have the slips. The clerk’s line is quiet, so I will only name what the hopper released.'
      : 'Open draw. The clerk’s line is quiet. I will only name what the hopper released.');
    cards.forEach(function (c, i) {
      var station = positions[i] || ('Station ' + (i + 1));
      var side = c.reversed ? 'Face-down. Columns unread.' : 'Face-up. Columns open.';
      lines.push(station + ': ' + c.name + ' [' + (c.dept || 'UNCLASSIFIED') + ']. ' + side);
    });
    lines.push('I will not invent the weather of a quiet hopper. This is a working slip. Not canon.');
    return lines.join('\n\n');
  }

  function emitDealt(payload) {
    lastDraw = payload;
    if (typeof global.JACK_TAROT.onDealt === 'function') {
      try { global.JACK_TAROT.onDealt(payload); } catch (e) {}
    }
    document.dispatchEvent(new CustomEvent('jack-tarot-dealt', { detail: payload }));
  }

  function punchHopper(opts) {
    opts = opts || {};
    var spreadId = opts.spread || currentSpread;
    var spread = SPREADS[spreadId] || SPREADS['three-stations'];
    if (opts.spread) currentSpread = spreadId;
    var drawn = drawCards(spread.count);
    var qEl = $('question');
    var question = opts.question != null ? String(opts.question) : (qEl ? qEl.value : '');
    var page = !!$('draw-btn');
    lastCopyText = '';

    if (page) {
      if ($('copy-btn')) {
        $('copy-btn').textContent = 'COPY SLIP';
        $('copy-btn').classList.remove('done');
        $('copy-btn').hidden = false;
      }
      if ($('controls')) $('controls').hidden = true;
      if ($('reading-area')) $('reading-area').hidden = false;
      if ($('hopper-loading')) $('hopper-loading').hidden = false;
      if ($('reading-text')) $('reading-text').hidden = true;
      if ($('reading-actions')) $('reading-actions').hidden = true;
      var echo = $('question-echo');
      if (echo) {
        if (question.trim()) {
          echo.textContent = '"' + question.trim() + '"';
          echo.hidden = false;
        } else {
          echo.hidden = true;
        }
      }
    }

    var mount = opts.mount || $('cards-grid');
    var wraps = [];
    if (mount) {
      if (mount.id === 'cards-grid') wraps = renderCards(drawn.cards, spread.positions);
      else {
        mount.innerHTML = '';
        drawn.cards.forEach(function (card, i) {
          var wrap = document.createElement('div');
          wrap.className = 'card-wrap';
          wrap.innerHTML = cardSvg(card);
          var pos = document.createElement('div');
          pos.className = 'card-position';
          pos.textContent = spread.positions[i];
          wrap.appendChild(pos);
          mount.appendChild(wrap);
          wraps.push(wrap);
        });
        wraps = mount.querySelectorAll ? mount.querySelectorAll('.card-wrap') : wraps;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          aimFromJack(wraps);
          dealSlips(wraps);
        });
      });
    } else {
      var Spr = global.Jack && global.Jack.Sprite;
      if (Spr && Spr.deal) Spr.deal(drawn.cards.length);
    }

    var payload = {
      spread: spreadId,
      label: spread.label,
      positions: spread.positions,
      cards: drawn.cards,
      rate: drawn.rate,
      band: drawn.band,
      question: question.trim(),
      canon: false
    };
    emitDealt(payload);
    if (typeof opts.onDealt === 'function') {
      try { opts.onDealt(payload); } catch (e) {}
    }

    var data = new FormData();
    data.set('csrf', opts.csrf || global.TTG_TAROT_CSRF || '');
    data.set('spread', spreadId);
    data.set('question', question);
    data.set('cards', JSON.stringify(drawn.cards.map(function (c) {
      return { name: c.name, reversed: !!c.reversed };
    })));
    data.set('rate', String(drawn.rate));
    data.set('band', drawn.band);

    var endpoint = opts.endpoint || (page ? 'read.php' : '/jack/tarot/read.php');

    function finish(reading, slips) {
      lastCopyText = buildCopyText(drawn.cards, spread.positions, spread.label, question, reading);
      if (lastDraw) {
        lastDraw.reading = reading;
        if (slips && slips.length) lastDraw.slips = slips;
      }
      if (page) {
        if ($('hopper-loading')) $('hopper-loading').hidden = true;
        var el = $('reading-text');
        if (el) {
          el.innerHTML = proseToHtml(reading);
          el.hidden = false;
        }
        if ($('copy-btn')) $('copy-btn').hidden = false;
        if ($('reading-actions')) $('reading-actions').hidden = false;
      }
      if (typeof opts.onReading === 'function') {
        try { opts.onReading(reading, payload); } catch (e) {}
      }
      return reading;
    }

    return fetch(endpoint, {
      method: 'POST',
      body: data,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      return res.text().then(function (raw) {
        var j = null;
        try { j = JSON.parse(raw); } catch (e) { j = null; }
        return { ok: res.ok, j: j };
      });
    }).then(function (pack) {
        return finish((pack.j && pack.j.text) || localFallback(drawn.cards, spread.positions, question), pack.j && pack.j.slips);
      }).catch(function () {
        return finish(localFallback(drawn.cards, spread.positions, question));
      });
  }

  function bindJack() {
    var Spr = global.Jack && global.Jack.Sprite;
    var pet = $('jackPet');
    if (!Spr || !pet) return;
    Spr.attachPortrait(pet);
    (function loop(now) {
      var t = now / 1000;
      Spr.tick(t, {
        context: { phase: hopperPhase },
        body: { pressure: dealing ? 0.3 : 0.08 }
      });
      var form = $('jackForm');
      if (form) form.textContent = dealing ? 'DEALING' : (hopperPhase === 'CARD' ? 'THE SLIPS ARE OUT' : 'AT THE HOPPER');
      requestAnimationFrame(loop);
    }(performance.now()));
  }

  function bind() {
    if ($('spread-buttons')) renderSpreads();
    if (!$('draw-btn')) return;
    if ($('dealer')) bindJack();
    $('draw-btn').addEventListener('click', function () { punchHopper(); });
    if ($('copy-btn')) $('copy-btn').addEventListener('click', copyReading);
    if ($('new-reading-btn')) $('new-reading-btn').addEventListener('click', function () {
      closeInspect();
      if ($('reading-area')) $('reading-area').hidden = true;
      if ($('controls')) $('controls').hidden = false;
      if ($('question')) {
        $('question').value = '';
        $('question').focus();
      }
      lastCopyText = '';
      lastDraw = null;
      hopperPhase = 'SENSE';
      dealing = false;
      var dealer = $('dealer');
      if (dealer) dealer.classList.remove('dealing');
    });
    var inspect = $('inspect');
    if (inspect) {
      inspect.addEventListener('click', function (e) {
        if (e.target === inspect) closeInspect();
      });
    }
  }

  global.JACK_TAROT = {
    deck: DECK,
    spreads: SPREADS,
    standing: STANDING,
    last: function () { return lastDraw; },
    onDealt: null,
    draw: punchHopper,
    punch: punchHopper,
    cardSvg: cardSvg,
    drawCards: drawCards
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})(window);
