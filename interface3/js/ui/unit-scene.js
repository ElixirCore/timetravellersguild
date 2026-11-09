import { runtime, onSave } from '../state.js';
import {
  sceneBank,
  loadSceneBank,
  saveSceneBank,
  getActiveSlot,
  setActiveSlot,
  SCENE_COUNT,
} from '../scenes/bank.js';
import {
  saveToScene,
  recallScene,
  isSceneDirty,
  arpPreview,
  activeUnitCount,
} from '../scenes/snapshot.js';

const $ = (id) => document.getElementById(id);

const SCENE_TIP = 'Click to select this slot · SAVE stores the whole rig · RECALL loads it · double-click name to rename';

export function buildSceneUnit({ refreshRig }) {
  loadSceneBank();

  const host = $('scene-strip');
  const statusEl = $('scene-status');

  function slotStatus(i) {
    const slot = sceneBank.slots[i];
    if (!slot.snapshot) return 'empty';
    if (getActiveSlot() === i && isSceneDirty(i)) return 'dirty';
    if (runtime.sceneRecalledSlot === i) return 'live';
    return 'stored';
  }

  function renderCards() {
    host.innerHTML = sceneBank.slots.map((slot, i) => {
      const status = slotStatus(i);
      const selected = getActiveSlot() === i ? ' selected' : '';
      const preview = slot.snapshot ? arpPreview(slot.snapshot) : '· · · · · · · ·';
      const meta = slot.snapshot
        ? `${activeUnitCount(slot.snapshot)} units`
        : '—';
      return `<article class="scene-card status-${status}${selected}" data-slot="${i}">
        <button type="button" class="scene-select" data-slot="${i}">
          <header><strong class="scene-name-tip" data-tip="${SCENE_TIP}">${slot.name}</strong><span class="scene-badge">${status.toUpperCase()}</span></header>
          <div class="scene-preview" aria-hidden="true">${preview}</div>
          <div class="scene-meta">${meta}</div>
        </button>
        <div class="scene-actions">
          <button type="button" class="pbtn pbtn-tiny scene-recall" data-slot="${i}" ${slot.snapshot ? '' : 'disabled'}>RECALL</button>
          <button type="button" class="pbtn pbtn-tiny scene-save" data-slot="${i}">SAVE</button>
        </div>
      </article>`;
    }).join('');

    host.querySelectorAll('.scene-select').forEach((btn) => {
      btn.addEventListener('click', () => {
        setActiveSlot(Number(btn.dataset.slot));
        refreshStatus();
      });
    });

    host.querySelectorAll('.scene-save').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const i = Number(btn.dataset.slot);
        setActiveSlot(i);
        btn.disabled = true;
        btn.textContent = '…';
        await saveToScene(i);
        btn.disabled = false;
        btn.textContent = 'SAVE';
        refreshRig();
        refreshStatus();
      });
    });

    host.querySelectorAll('.scene-recall').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const i = Number(btn.dataset.slot);
        setActiveSlot(i);
        btn.disabled = true;
        const ok = await recallScene(i);
        btn.disabled = false;
        if (ok) refreshRig();
        refreshStatus();
      });
    });

    host.querySelectorAll('.scene-card header strong').forEach((el, i) => {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const name = window.prompt('Scene name', sceneBank.slots[i].name);
        if (!name?.trim()) return;
        sceneBank.slots[i].name = name.trim().toUpperCase().slice(0, 12);
        saveSceneBank();
        renderCards();
        refreshStatus();
      });
    });
  }

  function refreshStatus() {
    const i = getActiveSlot();
    const slot = sceneBank.slots[i];
    const dirty = isSceneDirty(i);
    const parts = [
      slot?.name ?? '—',
      dirty ? 'unsaved' : (runtime.sceneRecalledSlot === i ? 'live' : 'selected'),
    ];
    if (statusEl) statusEl.textContent = parts.join(' · ');
    renderCards();
  }

  renderCards();
  refreshStatus();

  onSave(() => refreshStatus());

  return { refreshAll: refreshStatus };
}
