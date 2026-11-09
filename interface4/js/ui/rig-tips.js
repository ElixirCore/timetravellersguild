let floatEl;
let activeEl;

function ensureFloat() {
  if (floatEl) return floatEl;
  floatEl = document.createElement('div');
  floatEl.id = 'rig-tip-float';
  floatEl.className = 'rig-tip-float';
  floatEl.hidden = true;
  document.body.appendChild(floatEl);
  return floatEl;
}

function positionTip(el) {
  if (!floatEl || floatEl.hidden) return;
  const rect = el.getBoundingClientRect();
  const up = el.classList.contains('rig-tip-up');
  floatEl.classList.toggle('rig-tip-float-up', up);
  floatEl.style.left = `${rect.left + rect.width / 2}px`;
  floatEl.style.top = up ? `${rect.top - 10}px` : `${rect.bottom + 10}px`;
}

function showTip(el) {
  const text = el.getAttribute('data-tip');
  if (!text) return;
  activeEl = el;
  const float = ensureFloat();
  float.textContent = text;
  float.classList.toggle('rig-tip-float-sticker', el.classList.contains('rig-tip-sticker'));
  float.hidden = false;
  positionTip(el);
}

function hideTip() {
  activeEl = null;
  if (floatEl) floatEl.hidden = true;
}

export function initRigTips() {
  document.querySelectorAll('.rig-tip[data-tip]').forEach((el) => {
    el.addEventListener('mouseenter', () => showTip(el));
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('focus', () => showTip(el));
    el.addEventListener('blur', hideTip);
  });

  window.addEventListener('scroll', () => {
    if (activeEl) positionTip(activeEl);
  }, true);

  window.addEventListener('resize', () => {
    if (activeEl) positionTip(activeEl);
  });
}
