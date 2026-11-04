/* TIME MACHINE №13 — synthesised mechanism sounds (no assets). */
(function (TTGM) {
  'use strict';

  function Sound() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('ttg.machine.mute') === '1'; } catch (e) {}
    this.hum = null;
  }

  Sound.prototype.unlock = function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  };

  Sound.prototype.setMuted = function (m) {
    this.muted = !!m;
    try { localStorage.setItem('ttg.machine.mute', m ? '1' : '0'); } catch (e) {}
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  };

  Sound.prototype._noise = function (dur, freq, q, gain) {
    if (!this.ctx || this.muted) return;
    var c = this.ctx, n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 2;
    var g = c.createGain(); g.gain.value = gain || 0.6;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  };

  Sound.prototype._tone = function (freq, dur, type, gain, slideTo) {
    if (!this.ctx || this.muted) return;
    var c = this.ctx, t = c.currentTime;
    var o = c.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    var g = c.createGain(); g.gain.setValueAtTime(gain || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  };

  Sound.prototype.tick = function () { this._noise(0.025, 3200, 6, 0.25); };
  Sound.prototype.detent = function () { this._noise(0.05, 1400, 3, 0.7); this._tone(180, 0.05, 'square', 0.04); };
  Sound.prototype.click = function () { this._noise(0.04, 2200, 2, 0.6); };
  Sound.prototype.toggle = function () { this._noise(0.06, 900, 2, 0.9); this._tone(90, 0.06, 'square', 0.05); };
  Sound.prototype.ratchet = function () { this._noise(0.03, 2600, 8, 0.5); };
  Sound.prototype.clunk = function () { this._noise(0.18, 220, 1, 1.4); this._tone(60, 0.25, 'sine', 0.5, 35); };
  Sound.prototype.print = function () {
    var self = this;
    for (var i = 0; i < 9; i++) setTimeout(function () { self._noise(0.03, 1800 + Math.random() * 800, 4, 0.4); }, i * 120);
  };
  Sound.prototype.fault = function () { this._tone(220, 0.35, 'sawtooth', 0.08, 110); this._tone(233, 0.35, 'sawtooth', 0.06, 116); };
  Sound.prototype.arrive = function () { this._tone(880, 0.9, 'sine', 0.12); this._tone(1320, 1.2, 'sine', 0.06); this._noise(0.4, 600, 0.7, 0.8); };

  /** Rising transit hum; level 0..1 controls pitch and loudness. */
  Sound.prototype.humStart = function () {
    if (!this.ctx || this.muted || this.hum) return;
    var c = this.ctx;
    var o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    var g = c.createGain(); g.gain.value = 0.0001;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
    o1.start(); o2.start();
    this.hum = { o1: o1, o2: o2, f: f, g: g };
  };
  Sound.prototype.humLevel = function (lv) {
    if (!this.hum) return;
    var t = this.ctx.currentTime;
    this.hum.o1.frequency.setTargetAtTime(40 + lv * 160, t, 0.05);
    this.hum.o2.frequency.setTargetAtTime(40.7 + lv * 161, t, 0.05);
    this.hum.f.frequency.setTargetAtTime(300 + lv * 2400, t, 0.05);
    this.hum.g.gain.setTargetAtTime(0.02 + lv * 0.1, t, 0.05);
  };
  Sound.prototype.humStop = function () {
    if (!this.hum) return;
    var h = this.hum, t = this.ctx.currentTime;
    h.g.gain.setTargetAtTime(0.0001, t, 0.15);
    setTimeout(function () { try { h.o1.stop(); h.o2.stop(); } catch (e) {} }, 800);
    this.hum = null;
  };

  TTGM.Sound = Sound;
})(window.TTGM);
