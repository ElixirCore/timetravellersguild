/* Jack cell address. Same tetrahedron as app/AI/JackMap.php. */
(function (M) {
  'use strict';

  var S = 1 / Math.sqrt(3);
  var VERTS = [
    [S, S, S],
    [S, -S, -S],
    [-S, S, -S],
    [-S, -S, S]
  ];
  var FACES = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) {
    var l = Math.sqrt(dot(a, a));
    if (l < 1e-12) return [0, 1, 0];
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  function latLonToVec(lat, lon) {
    var phi = (90 - lat) * Math.PI / 180;
    var th = lon * Math.PI / 180;
    return [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
  }

  function childTriangle(tri, child) {
    var m01 = norm(add(tri[0], tri[1]));
    var m12 = norm(add(tri[1], tri[2]));
    var m20 = norm(add(tri[2], tri[0]));
    if (child === 0) return [tri[0], m01, m20];
    if (child === 1) return [tri[1], m12, m01];
    if (child === 2) return [tri[2], m20, m12];
    return [m01, m12, m20];
  }

  function closestFace(p) {
    var best = 0, bestDot = -Infinity, i, f, c, d;
    for (i = 0; i < FACES.length; i++) {
      f = FACES[i];
      c = norm(add(add(VERTS[f[0]], VERTS[f[1]]), VERTS[f[2]]));
      d = dot(c, p);
      if (d > bestDot) { bestDot = d; best = i; }
    }
    return best;
  }

  function closestChild(p, tri) {
    var best = 0, bestDot = -Infinity, c, t, cent, d;
    for (c = 0; c < 4; c++) {
      t = childTriangle(tri, c);
      cent = norm(add(add(t[0], t[1]), t[2]));
      d = dot(cent, p);
      if (d > bestDot) { bestDot = d; best = c; }
    }
    return best;
  }

  function address(lat, lon, depth) {
    var p = latLonToVec(lat, lon);
    var face = closestFace(p);
    var f = FACES[face];
    var tri = [VERTS[f[0]], VERTS[f[1]], VERTS[f[2]]];
    var path = [];
    var d = Math.max(0, Math.min(12, depth == null ? 6 : depth));
    var i, ch;
    for (i = 0; i < d; i++) {
      ch = closestChild(p, tri);
      path.push(ch);
      tri = childTriangle(tri, ch);
    }
    return { lat: lat, lon: lon, tetra_face: face, path: path, depth: d };
  }

  function cellKey(addr) {
    return String(addr.tetra_face) + ':' + (addr.path || []).join('');
  }

  function facesAtDepth(depth) {
    var out = [];
    function walk(tri, face, path, d) {
      if (d >= depth) {
        out.push({ face: face, path: path.slice(), a: tri[0], b: tri[1], c: tri[2] });
        return;
      }
      var c;
      for (c = 0; c < 4; c++) walk(childTriangle(tri, c), face, path.concat([c]), d + 1);
    }
    var i, f;
    for (i = 0; i < FACES.length; i++) {
      f = FACES[i];
      walk([VERTS[f[0]], VERTS[f[1]], VERTS[f[2]]], i, [], 0);
    }
    return out;
  }

  M.Tetra = {
    VERTS: VERTS,
    FACES: FACES,
    latLonToVec: latLonToVec,
    address: address,
    cellKey: cellKey,
    facesAtDepth: facesAtDepth,
    norm: norm
  };
})(window.JackMap = window.JackMap || {});
