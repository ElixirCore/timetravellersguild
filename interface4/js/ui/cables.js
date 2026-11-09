// Decorative patch cables drawn between .jack elements. Routing is fixed in code.
const ROUTES = [
  { from: 'jack-arp-out', to: 'jack-board-in-a', color: '#b8452e' },
  { from: 'jack-bass-out', to: 'jack-board-in-b', color: '#2e6e8f' },
  { from: 'jack-drum-out', to: 'jack-board-in-c', color: '#8a6840' },
  { from: 'jack-stylus-out', to: 'jack-board-in-d', color: '#6a5a9a' },
  { from: 'jack-field-out', to: 'jack-board-in-e', color: '#4a8a6a' },
  { from: 'jack-seed-out', to: 'jack-board-in-f', color: '#7fa03c' },
  { from: 'jack-board-out', to: 'jack-looper-in', color: '#7a8f38' },
];

function center(el, rigRect) {
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2 - rigRect.left,
    y: r.top + r.height / 2 - rigRect.top,
  };
}

export function drawCables() {
  const svg = document.getElementById('cables');
  const rig = document.getElementById('rig');
  if (!svg || !rig) return;
  const rigRect = rig.getBoundingClientRect();
  if (rigRect.width < 1 || rigRect.height < 1) return;
  svg.setAttribute('viewBox', `0 0 ${rigRect.width} ${rigRect.height}`);

  let markup = '';
  for (const route of ROUTES) {
    const fromEl = document.querySelector(`[data-jack="${route.from}"]`);
    const toEl = document.querySelector(`[data-jack="${route.to}"]`);
    if (!fromEl || !toEl) continue;
    const a = center(fromEl, rigRect);
    const b = center(toEl, rigRect);
    const sag = Math.min(120, Math.hypot(b.x - a.x, b.y - a.y) * 0.22 + 26);
    const midY = Math.max(a.y, b.y) + sag;
    const d = `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
    markup += `
      <path d="${d}" class="cable-shadow"></path>
      <path d="${d}" class="cable" style="stroke:${route.color}"></path>
      <path d="${d}" class="cable-shine"></path>
      <circle cx="${a.x}" cy="${a.y}" r="7" class="plug"></circle>
      <circle cx="${b.x}" cy="${b.y}" r="7" class="plug"></circle>`;
  }
  svg.innerHTML = markup;
}

export function initCables() {
  drawCables();
  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(drawCables, 80);
  };

  window.addEventListener('resize', schedule);

  const rig = document.getElementById('rig');
  if (rig && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => requestAnimationFrame(drawCables)).observe(rig);
  }

  document.fonts?.ready?.then(drawCables);
  setTimeout(drawCables, 200);
  setTimeout(drawCables, 600);
}
