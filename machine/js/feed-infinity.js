/* Feed∞ sampler — machine nervous system slips on the CRT. */
(function (global) {
  'use strict';

  function FeedInfinity() {
    this.queue = [];
    this.nextAt = 0;
    this.cursor = 0;
  }

  FeedInfinity.prototype.setState = function (state) {
    var q = [];
    var cards = (state && state.cards) || [];
    var feed = (state && state.feed) || [];
    var i;
    for (i = 0; i < Math.min(cards.length, 20); i++) {
      var c = cards[i];
      if (!c || c.beyond) continue;
      q.push({
        kind: c.type || 'RECORD',
        title: c.title || c.slug || 'UNTITLED',
        sub: (c.observed_at || '').slice(0, 10) + (c.pending ? '  · PENDING' : ''),
        bits: (c.holes || '').replace(/(..)/g, '$1 ').trim(),
        jack: '',
      });
    }
    for (i = 0; i < feed.length; i++) {
      var f = feed[i];
      q.push({
        kind: 'IMAGE',
        title: f.caption || ('PLATE ' + f.id),
        sub: (f.standing || 'held').toUpperCase(),
        bits: f.src || '',
        jack: f.jack || '',
      });
    }
    if (state && state.jack_line) {
      q.push({
        kind: 'WARNING',
        title: state.jack_line,
        sub: 'COMPARISON IN PROGRESS',
        bits: '',
        jack: state.jack_line,
      });
    }
    q.push({
      kind: 'EQUATION',
      title: 'E = M / R^(κ·ΔC)',
      sub: 'κ ' + ((state && state.kappa) || '—') + '   ΔC ' + ((state && state.delta_context) || '—'),
      bits: '001011000101',
      jack: '',
    });
    this.queue = q;
  };

  FeedInfinity.prototype.maybeShow = function (crt, now, emergyDisplay) {
    if (!crt || !crt.ready) return;
    if (now < this.nextAt) return;
    if (!this.queue.length) return;
    // Higher emergy → more structured / frequent clustering feel
    var gap = 9000 - Math.floor((emergyDisplay || 0.4) * 4500);
    this.nextAt = now + gap + Math.random() * 2000;
    var frame = this.queue[this.cursor % this.queue.length];
    this.cursor++;
    crt.showFeed(frame, 1800 + Math.random() * 1200);
  };

  global.TTGMachineFeed = FeedInfinity;
})(window);
