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
    this.isTraveling = false;  // kept for API compat; means "call in progress"
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
   * Dial / place a call. Lamp rings, status cycles through connecting → connected → call ended.
   * No dematerialisation — it's a phone box.
   */
  dialCall(tardis, onPhase, onComplete) {
    if (this.isTraveling) return;
    this.isTraveling = true;

    const lamp = tardis.getObjectByName('lamp');
    const lampLight = tardis.getObjectByName('lampLight');
    const lampMat = lamp?.material;

    if (onPhase) onPhase('dialling');

    // Ring lamp 4 times (phone ringing cadence: 0.4s on, 0.2s off, repeat)
    let rings = 0;
    const totalRings = 8; // 4 double-rings
    const ringPulse = () => {
      if (rings >= totalRings) {
        if (onPhase) onPhase('connected');
        setTimeout(() => {
          if (onPhase) onPhase('stable');
          if (lampMat) lampMat.emissiveIntensity = 0.8;
          if (lampLight) lampLight.intensity = 2.0;
          this.isTraveling = false;
          if (onComplete) onComplete();
        }, 2400);
        return;
      }
      const on = rings % 2 === 0;
      if (lampMat) lampMat.emissiveIntensity = on ? 2.4 : 0.3;
      if (lampLight) lampLight.intensity = on ? 5.5 : 0.5;
      rings += 1;
      setTimeout(ringPulse, on ? 400 : 200);
    };
    ringPulse();
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
