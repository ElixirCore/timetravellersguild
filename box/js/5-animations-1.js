/**
 * animations.js — Animation controller for travel, doors, lamp, camera.
 */

export const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

export class AnimationController {
  constructor() {
    this.animations = [];
    this.doorsOpen = false;
    this.isTraveling = false;
    this.lampFlashing = false;
  }

  tween(target, property, from, to, duration, easing = ease.inOut, onComplete = null) {
    const parts = property.split('.');
    const obj = parts.length > 1 ? target[parts[0]] : target;
    const prop = parts.length > 1 ? parts[1] : parts[0];
    obj[prop] = from;

    this.animations.push({
      obj,
      prop,
      from,
      to,
      duration,
      elapsed: 0,
      easing,
      onComplete,
    });
  }

  update(delta) {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i];
      anim.elapsed += delta;
      const t = Math.min(anim.elapsed / anim.duration, 1);
      const easedT = anim.easing(t);
      anim.obj[anim.prop] = anim.from + (anim.to - anim.from) * easedT;

      if (t >= 1) {
        anim.obj[anim.prop] = anim.to;
        if (anim.onComplete) anim.onComplete();
        this.animations.splice(i, 1);
      }
    }
  }

  /**
   * Full dematerialize → vortex → rematerialize sequence.
   */
  timeTravel(tardis, vortex, energyRings, onPhase, onComplete) {
    if (this.isTraveling) return;
    this.isTraveling = true;

    const lamp = tardis.getObjectByName('lamp');
    const lampLight = tardis.getObjectByName('lampLight');
    const lampMat = lamp?.material;
    const vortexMat = vortex.material;

    if (onPhase) onPhase('charging');

    const shakeDuration = 1.6;
    const origin = { x: tardis.position.x, z: tardis.position.z };

    this.animations.push({
      obj: tardis.position,
      prop: 'x',
      from: tardis.position.x,
      to: tardis.position.x,
      duration: shakeDuration,
      elapsed: 0,
      easing: (t) => {
        const intensity = Math.sin(t * Math.PI) * 0.1;
        tardis.position.x = origin.x + (Math.random() - 0.5) * intensity;
        tardis.position.z = origin.z + (Math.random() - 0.5) * intensity;
        tardis.rotation.z = (Math.random() - 0.5) * intensity * 0.4;
        if (lampMat) lampMat.emissiveIntensity = 0.7 + Math.sin(t * 48) * 0.55;
        if (lampLight) lampLight.intensity = 2 + Math.sin(t * 48) * 4;
        return t;
      },
      onComplete: () => {
        tardis.position.x = origin.x;
        tardis.position.z = origin.z;
        tardis.rotation.z = 0;

        if (onPhase) onPhase('dematerialize');
        vortex.visible = true;
        energyRings.visible = true;
        this.tween(vortexMat, 'opacity', 0, 0.85, 0.9, ease.out);

        this._flickerFade(tardis, 1.4, () => {
          if (onPhase) onPhase('vortex');
          setTimeout(() => {
            if (onPhase) onPhase('rematerialize');
            this._flickerAppear(tardis, 1.4, () => {
              this.tween(vortexMat, 'opacity', 0.85, 0, 1.0, ease.in, () => {
                vortex.visible = false;
                energyRings.visible = false;
                if (lampMat) lampMat.emissiveIntensity = 0.7;
                if (lampLight) lampLight.intensity = 2.2;
                this.isTraveling = false;
                if (onPhase) onPhase('stable');
                if (onComplete) onComplete();
              });
            });
          }, 2200);
        });
      },
    });
  }

  _setMaterialsOpacity(root, opacity) {
    root.traverse((child) => {
      if (!child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        m.transparent = true;
        m.opacity = opacity;
        m.depthWrite = opacity > 0.85;
      });
    });
  }

  _flickerFade(tardis, duration, onComplete) {
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / (duration * 1000);
      if (t >= 1) {
        tardis.visible = false;
        if (onComplete) onComplete();
        return;
      }
      const rate = 5 + t * 35;
      tardis.visible = Math.sin(performance.now() * rate * 0.01) > t - 0.45;
      this._setMaterialsOpacity(tardis, 1 - t * 0.55);
      requestAnimationFrame(tick);
    };
    tick();
  }

  _flickerAppear(tardis, duration, onComplete) {
    tardis.visible = true;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / (duration * 1000);
      if (t >= 1) {
        tardis.visible = true;
        this._setMaterialsOpacity(tardis, 1);
        tardis.traverse((child) => {
          if (!child.material) return;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (m.name === 'windowMaterial' || m.userData?.keepTransparent) {
              m.transparent = true;
              m.opacity = m.userData?.baseOpacity ?? 0.55;
              m.depthWrite = false;
            } else {
              m.transparent = false;
              m.opacity = 1;
              m.depthWrite = true;
            }
          });
        });
        if (onComplete) onComplete();
        return;
      }
      const rate = 32 - t * 26;
      tardis.visible = Math.sin(performance.now() * rate * 0.01) > 0.45 - t;
      this._setMaterialsOpacity(tardis, 0.4 + t * 0.6);
      requestAnimationFrame(tick);
    };
    tick();
  }

  toggleDoors(doors) {
    if (!doors || this.isTraveling) return;
    const { leftDoor, rightDoor } = doors;
    const target = this.doorsOpen ? 0 : -Math.PI / 2.4;
    this.tween(leftDoor, 'rotation.y', leftDoor.rotation.y, target, 0.9, ease.elastic);
    this.tween(rightDoor, 'rotation.y', rightDoor.rotation.y, -target, 0.9, ease.elastic);
    this.doorsOpen = !this.doorsOpen;
    return this.doorsOpen;
  }

  flashLamp(tardis, flashes = 6) {
    if (this.lampFlashing) return;
    this.lampFlashing = true;
    const lamp = tardis.getObjectByName('lamp');
    const lampLight = tardis.getObjectByName('lampLight');
    const flashEl = document.getElementById('flash');
    let n = 0;

    const pulse = () => {
      if (n >= flashes) {
        if (lamp?.material) lamp.material.emissiveIntensity = 0.7;
        if (lampLight) lampLight.intensity = 2.2;
        if (flashEl) flashEl.classList.remove('active');
        this.lampFlashing = false;
        return;
      }
      const on = n % 2 === 0;
      if (lamp?.material) lamp.material.emissiveIntensity = on ? 2.2 : 0.25;
      if (lampLight) lampLight.intensity = on ? 6 : 0.4;
      if (flashEl) flashEl.classList.toggle('active', on);
      n += 1;
      setTimeout(pulse, on ? 70 : 110);
    };
    pulse();
  }
}
