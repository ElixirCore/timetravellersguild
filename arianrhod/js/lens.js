/* Warehouse lens. Chromatic aberration, barrel, vignette. No extra composer. */
(function (A) {
  'use strict';

  A.Lens = {
    attach: function (THREE, renderer, scene, camera, opts) {
      opts = opts || {};
      var reduced = !!opts.reduced;
      var w = 1;
      var h = 1;
      var rt = new THREE.WebGLRenderTarget(2, 2, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBFormat
      });
      var uniforms = {
        tDiffuse: { value: rt.texture },
        resolution: { value: new THREE.Vector2(2, 2) },
        amount: { value: reduced ? 0 : 0.0042 },
        time: { value: 0 }
      };
      var mat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: [
          'varying vec2 vUv;',
          'void main(){',
          '  vUv = uv;',
          '  gl_Position = vec4(position.xy, 0.0, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D tDiffuse;',
          'uniform vec2 resolution;',
          'uniform float amount;',
          'uniform float time;',
          'varying vec2 vUv;',
          'void main(){',
          '  vec2 n = vUv - 0.5;',
          '  float r = length(n);',
          '  vec2 uv = 0.5 + n * (1.0 + 0.07 * r * r);',
          '  vec2 dir = n * amount * (0.25 + r * 2.6);',
          '  float ca = texture2D(tDiffuse, uv + dir).r;',
          '  float cg = texture2D(tDiffuse, uv).g;',
          '  float cb = texture2D(tDiffuse, uv - dir).b;',
          '  float vig = smoothstep(1.18, 0.28, r);',
          '  float grain = fract(sin(dot(uv + time, vec2(12.9898, 78.233))) * 43758.5453);',
          '  vec3 col = vec3(ca, cg, cb) * vig;',
          '  col += (grain - 0.5) * 0.035;',
          '  gl_FragColor = vec4(col, 1.0);',
          '}'
        ].join('\n')
      });
      var quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), mat);
      var lensScene = new THREE.Scene();
      var lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      lensScene.add(quad);

      function resize(nw, nh) {
        w = Math.max(2, nw | 0);
        h = Math.max(2, nh | 0);
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        rt.setSize(Math.round(w * dpr), Math.round(h * dpr));
        uniforms.resolution.value.set(w * dpr, h * dpr);
      }

      return {
        resize: resize,
        render: function (time) {
          uniforms.time.value = time || 0;
          renderer.setRenderTarget(rt);
          renderer.render(scene, camera);
          renderer.setRenderTarget(null);
          renderer.render(lensScene, lensCam);
        },
        setAmount: function (n) { uniforms.amount.value = n; }
      };
    }
  };
})(window.Arianrhod = window.Arianrhod || {});
