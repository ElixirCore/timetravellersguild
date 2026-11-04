/* Doors between rooms. Walk through. Projection is not storage. */
(function (J) {
  'use strict';

  var dwell = 0;
  var lastId = '';
  var going = false;

  function hrefOf(obj) {
    if (!obj) return '';
    if (obj.href) return String(obj.href);
    if (obj.metadata && obj.metadata.href) return String(obj.metadata.href);
    return '';
  }

  function isDoor(obj) {
    return !!(obj && (obj.type === 'door' || hrefOf(obj)));
  }

  function enter(obj) {
    var href = hrefOf(obj);
    if (!href || going) return false;
    going = true;
    window.location.href = href;
    return true;
  }

  function near(obj, pos, max) {
    if (!obj || typeof obj.x !== 'number') return false;
    var dx = pos.x - obj.x;
    var dz = pos.z - obj.z;
    return (dx * dx + dz * dz) < (max || 1.35);
  }

  function nearest(objects, pos, max) {
    var best = null;
    var bestD = max || 1.35;
    var i, o, d;
    for (i = 0; i < objects.length; i++) {
      o = objects[i];
      if (!isDoor(o) || !hrefOf(o)) continue;
      d = Math.hypot(pos.x - o.x, pos.z - o.z);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  function tick(dt, objects, pos, selectedId) {
    var obj = nearest(objects || [], pos, 1.25);
    if (!obj) {
      dwell = 0;
      lastId = '';
      return null;
    }
    if (obj.id !== lastId) {
      lastId = obj.id;
      dwell = 0;
    }
    dwell += dt || 0;
    if ((dwell > 0.55 && selectedId === obj.id) || dwell > 1.15) enter(obj);
    return obj;
  }

  J.Doors = {
    hrefOf: hrefOf,
    isDoor: isDoor,
    enter: enter,
    near: near,
    nearest: nearest,
    tick: tick
  };
})(window.Jack = window.Jack || {});
