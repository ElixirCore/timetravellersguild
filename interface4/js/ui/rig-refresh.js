import { applyStrips } from '../audio/context.js';
import { applyAllPedals } from '../audio/pedals.js';
import { applyStylusFx } from '../audio/stylus-fx.js';

export function createRigRefresh(units) {
  return function refreshRig({ light = false } = {}) {
    applyStrips();
    applyAllPedals();
    applyStylusFx();

    if (light) return;

    units.master?.refreshAll?.();
    units.scene?.refreshAll?.();
    units.arp?.refreshAll?.();
    units.bass?.refreshAll?.();
    units.drums?.refreshAll?.();
    units.field?.refreshAll?.();
    units.seedbed?.refreshAll?.();
    units.stylus?.refreshAll?.();
    units.pedals?.refreshAll?.();
  };
}
