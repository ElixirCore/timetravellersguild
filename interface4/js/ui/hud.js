import { runtime } from '../state.js';
import { audioNow } from '../audio/context.js';
import { looperStatus } from '../audio/looper.js';
import { octaveRange } from '../engine/clock.js';

const $ = (id) => document.getElementById(id);

let arpRail = null;
let bassRail = null;
let drumGrid = null;
let fieldGrid = null;
let seedGrid = null;
let lastArpIdx = 0;

const LOOPER_LED = {
  EMPTY: '', ARMED: 'led-armed', REC: 'led-rec',
  LOOPING: 'led-loop', DUB: 'led-rec', STOPPED: 'led-held',
};

function uiTick() {
  if (runtime.playing) {
    const now = audioNow();
    let latestArp = null;
    let latestBass = null;
    let latestDrums = null;
    let latestField = null;
    let latestSeed = null;
    while (runtime.queue.length && runtime.queue[0].time <= now + 0.02) {
      const ev = runtime.queue.shift();
      if (ev.lane === 'arp') latestArp = ev;
      else if (ev.lane === 'bass') latestBass = ev;
      else if (ev.lane === 'drums') latestDrums = ev;
      else if (ev.lane === 'field') latestField = ev;
      else if (ev.lane === 'seed') latestSeed = ev;
    }
    if (latestArp) {
      arpRail.showPlayhead(latestArp);
      lastArpIdx = latestArp.idx;
    }
    if (latestBass) bassRail.showPlayhead(latestBass);
    if (latestDrums) drumGrid?.showPlayhead(latestDrums);
    if (latestField) fieldGrid?.showPlayhead(latestField);
    if (latestSeed) seedGrid?.showPlayhead(latestSeed);
    $('lcd-pos').textContent = runtime.dragInfo
      ?? `S${String(lastArpIdx + 1).padStart(2, '0')}·O${(runtime.lanes?.arp.oct ?? 0) + 1}/${octaveRange()}`;
  } else if (runtime.dragInfo) {
    $('lcd-pos').textContent = runtime.dragInfo;
  }

  const status = looperStatus();
  $('looper-lcd').textContent = status.text;
  const led = $('looper-led');
  led.className = `jewel jewel-big ${LOOPER_LED[status.st] ?? ''}`;
  $('looper-rec').classList.toggle('lit', status.st === 'ARMED' || status.st === 'REC' || status.st === 'DUB');
  $('looper-stop').classList.toggle('lit', status.st === 'LOOPING' || status.st === 'STOPPED');
  if (!runtime.playing) {
    arpRail?.clearPlayhead();
    bassRail?.clearPlayhead();
    drumGrid?.clearPlayhead();
    fieldGrid?.clearPlayhead();
    seedGrid?.clearPlayhead();
  }
}

export function initHud(units) {
  arpRail = units.arp.rail;
  bassRail = units.bass.rail;
  drumGrid = units.drums.grid;
  fieldGrid = units.field.grid;
  seedGrid = units.seedbed?.grid;
  setInterval(uiTick, 33);
}
