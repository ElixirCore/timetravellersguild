/* Emergy client mirror — display only; raw equation stays canonical. */
(function (global) {
  'use strict';

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function emergyRaw(mind, matter, deltaContext, kappa) {
    var M = clamp(mind, 0.001, 1);
    var R = clamp(matter, 0.001, 1);
    var C = clamp(deltaContext, 0, 1);
    var K = clamp(kappa, 0, 3.33);
    return M / Math.pow(R, K * C);
  }

  function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  function emergyDisplay(raw) {
    var x = Math.log(Math.max(raw, 1e-9));
    return clamp(sigmoid((x + 0.2) * 1.1), 0, 1);
  }

  function emergy(mind, matter, deltaContext, kappa) {
    var raw = emergyRaw(mind, matter, deltaContext, kappa);
    return { raw: raw, display: emergyDisplay(raw) };
  }

  global.TTGMachineEmergy = {
    clamp: clamp,
    raw: emergyRaw,
    display: emergyDisplay,
    compute: emergy,
  };
})(window);
