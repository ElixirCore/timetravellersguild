/*
  screen/scheduler.js  -  the programme behind timetravellersguild.com/screen

  Three windows play at once. What each window shows, and when, is a pure
  function of (manifest, UTC day, time of day): everyone who opens the page
  derives the same schedule, so the "stream" is a shared broadcast and needs
  no server beyond static files.

  Each UTC day is simulated from midnight. Whenever a window's segment ends,
  it picks its next clip by weighted chance:
    - never a clip another window is showing at that moment
    - not one of the last few clips shown anywhere
    - clips that haven't been seen for a while weigh more
    - clips from a different recording day than the other windows weigh more
    - longer recordings weigh a little more (square root of duration)
  Segments are 40-120s. A long recording is walked through in order across
  visits (each visit resumes where the last one stopped); short ones play whole.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScreenScheduler = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WINDOWS = 3, DAY = 86400, MIN_SEG = 40, MAX_SEG = 120;

  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  function rng(seed) {            // mulberry32
    var a = seed | 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function usable(clips) {
    return clips.filter(function (c) { return c && c.enabled !== false && c.duration >= 5; })
      .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
  }

  function buildDay(clips, dayIndex) {
    var pool = usable(clips), segs = [[], [], []];
    if (!pool.length) return { pool: pool, segments: segs };

    var rand = rng(hash('ttg-screen|' + dayIndex + '|' + pool.map(function (c) { return c.id; }).join(',')));
    var cursor = {}, lastEnd = {}, history = [];
    var win = [{ end: 0, clip: null }, { end: 0, clip: null }, { end: 0, clip: null }];
    var keep = Math.max(0, Math.min(6, pool.length - WINDOWS - 1));

    for (var guard = 0; guard < 100000; guard++) {
      var w = 0, i;
      for (i = 1; i < WINDOWS; i++) if (win[i].end < win[w].end) w = i;
      var t = win[w].end;
      if (t >= DAY) break;

      var busy = {}, days = [];
      for (i = 0; i < WINDOWS; i++) {
        if (i !== w && win[i].clip && win[i].end > t) {
          busy[win[i].clip.id] = true;
          days.push(String(win[i].clip.recorded || '').slice(0, 10));
        }
      }
      var recent = history.slice(history.length - keep);
      var cands = pool.filter(function (c) { return !busy[c.id] && recent.indexOf(c.id) < 0; });
      if (!cands.length) cands = pool.filter(function (c) { return !busy[c.id]; });
      if (!cands.length) cands = pool;

      var weights = cands.map(function (c) {
        var since = lastEnd[c.id] === undefined ? 3600 : Math.min(3600, t - lastEnd[c.id]);
        var day = String(c.recorded || '').slice(0, 10);
        return (1 + since / 300) * Math.sqrt(c.duration) * (days.indexOf(day) < 0 ? 1.6 : 1);
      });
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      var r = rand() * total, k = 0;
      while (k < cands.length - 1 && r >= weights[k]) { r -= weights[k]; k++; }
      var clip = cands[k];

      var len = MIN_SEG + rand() * (MAX_SEG - MIN_SEG), start = cursor[clip.id] || 0;
      if (clip.duration <= MAX_SEG + 20) { start = 0; len = clip.duration; }
      else {
        if (clip.duration - start < 20) start = 0;
        len = Math.min(len, clip.duration - start);
      }
      len = Math.max(3, Math.round(len * 1000) / 1000);
      cursor[clip.id] = (start + len >= clip.duration - 5) ? 0 : start + len;

      segs[w].push({ clip: clip.id, start: start, len: len, at: t, end: t + len });
      win[w] = { end: t + len, clip: clip };
      lastEnd[clip.id] = t + len;
      history.push(clip.id);
    }
    return { pool: pool, segments: segs };
  }

  var cache = {};
  function getDay(clips, dayIndex) {
    var sig = dayIndex + '|' + usable(clips).map(function (c) { return c.id; }).join(',');
    if (!cache[sig]) { cache = {}; cache[sig] = buildDay(clips, dayIndex); }
    return cache[sig];
  }

  function find(list, t) {          // last segment with at <= t
    var lo = 0, hi = list.length - 1, ans = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (list[mid].at <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  // nowSec = unix seconds. Returns one entry per window, or [] if nothing is playable.
  function stateAt(clips, nowSec) {
    var dayIndex = Math.floor(nowSec / DAY), t = nowSec - dayIndex * DAY;
    var day = getDay(clips, dayIndex);
    if (!day.pool.length) return [];
    return day.segments.map(function (list, w) {
      var k = find(list, t), seg = list[k], nx = list[k + 1] || null;
      return {
        w: w, key: dayIndex + ':' + w + ':' + seg.at, clip: seg.clip,
        offset: seg.start + (t - seg.at), remaining: seg.end - t, seg: seg,
        next: nx, nextKey: nx ? dayIndex + ':' + w + ':' + nx.at : null
      };
    });
  }

  return { WINDOWS: WINDOWS, DAY: DAY, hash: hash, rng: rng, buildDay: buildDay, stateAt: stateAt };
});
