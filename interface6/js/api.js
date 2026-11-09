/* INTERFACE v6 — seed api, as in v3-v5. The generation + clip library
   backend is shared with /interface and /interface2 (same STORE_DIR, same
   daily cap). API_BASE is the only destination-specific constant in this tree. */
export const API_BASE = '/interface2';

export async function fetchClips() {
  const r = await fetch(`${API_BASE}/clips.php`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`clips ${r.status}`);
  return r.json();
}

export async function generateClip({ mode, prompt, seconds }) {
  const r = await fetch(`${API_BASE}/generate.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, prompt, seconds }),
  });
  return r.json();
}

export function clipUrl(id, dl = false) {
  return `${API_BASE}/serve.php?f=${encodeURIComponent(id)}${dl ? '&dl=1' : ''}`;
}
