import { clamp } from '../state.js';
import { trimFieldPadRange } from '../audio/field-voice.js';

const MIN_MS = 40;
const EDGE_ZONE = 0.22;

function minLen(buffer) {
  return Math.max(64, Math.floor(buffer.sampleRate * (MIN_MS / 1000)));
}

function xToSample(canvas, clientX, buffer) {
  const rect = canvas.getBoundingClientRect();
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
  return Math.floor(ratio * buffer.length);
}

function pickDragMode(canvas, clientX) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const w = rect.width;
  if (x <= w * EDGE_ZONE) return 'start';
  if (x >= w * (1 - EDGE_ZONE)) return 'end';
  return x < w * 0.5 ? 'start' : 'end';
}

function drawHandle(ctx, x, h, flip) {
  ctx.strokeStyle = '#ffc46b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 0.5, 2);
  ctx.lineTo(x + 0.5, h - 2);
  ctx.stroke();

  ctx.fillStyle = '#ffc46b';
  ctx.beginPath();
  if (flip) {
    ctx.moveTo(x + 0.5, h - 3);
    ctx.lineTo(x - 5, h - 10);
    ctx.lineTo(x + 6, h - 10);
  } else {
    ctx.moveTo(x + 0.5, 3);
    ctx.lineTo(x - 5, 10);
    ctx.lineTo(x + 6, 10);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawFieldWaveform(canvas, buffer, preview = null) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, w, h);

  if (!buffer) {
    ctx.fillStyle = 'rgba(180,190,200,0.35)';
    ctx.font = '11px monospace';
    ctx.fillText('— empty —', 10, h / 2 + 4);
    return;
  }

  const data = buffer.getChannelData(0);
  const start = preview?.start ?? 0;
  const end = preview?.end ?? data.length;
  const startX = Math.floor((start / data.length) * w);
  const endX = Math.ceil((end / data.length) * w);
  const step = Math.max(1, Math.floor(data.length / w));

  function strokeWave(fromX, toX, color, alpha = 1) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = fromX; x < toX; x++) {
      const i = Math.min(data.length - 1, x * step);
      const y = (1 - data[i]) * 0.5 * h;
      if (x === fromX) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (startX > 0) {
    strokeWave(0, startX, '#6a7a68', 0.35);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, startX, h);
  }

  if (endX < w) {
    strokeWave(endX, w, '#6a7a68', 0.35);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(endX, 0, w - endX, h);
  }

  strokeWave(startX, endX, '#c8e4a8', 1);

  const trimmed = start > 0 || end < data.length;
  if (trimmed) {
    if (startX > 0) drawHandle(ctx, startX, h, false);
    if (endX < w) drawHandle(ctx, endX, h, true);
  }
}

export function wireFieldWaveformTrim(canvas, { getPadIndex, getBuffer, onTrimmed }) {
  let dragging = false;
  let dragMode = null;
  let preview = null;

  function redraw() {
    drawFieldWaveform(canvas, getBuffer(), preview);
  }

  async function finishDrag() {
    if (!dragging) return;
    dragging = false;
    dragMode = null;
    canvas.classList.remove('trimming', 'trim-start', 'trim-end');
    const buf = getBuffer();
    const pad = getPadIndex();
    if (!buf || !preview) return;
    const { start, end } = preview;
    preview = null;
    if (start <= 8 && end >= buf.length - 8) {
      redraw();
      return;
    }
    const changed = await trimFieldPadRange(pad, start, end);
    redraw();
    if (changed) onTrimmed?.();
  }

  canvas.addEventListener('pointerdown', (e) => {
    const buf = getBuffer();
    if (!buf) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    dragging = true;
    dragMode = pickDragMode(canvas, e.clientX);
    const sample = xToSample(canvas, e.clientX, buf);
    const min = minLen(buf);

    if (dragMode === 'start') {
      preview = { start: Math.min(sample, buf.length - min), end: buf.length };
      canvas.classList.add('trim-start');
    } else {
      preview = { start: 0, end: Math.max(sample, min) };
      canvas.classList.add('trim-end');
    }
    canvas.classList.add('trimming');
    redraw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !preview) return;
    const buf = getBuffer();
    if (!buf) return;
    const sample = xToSample(canvas, e.clientX, buf);
    const min = minLen(buf);

    if (dragMode === 'start') {
      preview.start = clamp(sample, 0, preview.end - min);
    } else {
      preview.end = clamp(sample, preview.start + min, buf.length);
    }
    redraw();
  });

  canvas.addEventListener('pointerup', () => finishDrag());
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    dragMode = null;
    preview = null;
    canvas.classList.remove('trimming', 'trim-start', 'trim-end');
    redraw();
  });

  return { redraw };
}
