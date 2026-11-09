/* Toby — the upload station.
   Every file travels on its own XHR (so it gets its own progress bar), three
   at a time, with automatic retries for flaky connections. */
(() => {
  'use strict';

  const TOKEN = document.querySelector('meta[name="toby-token"]').content;
  const BASE = document.querySelector('meta[name="toby-base"]').content;
  const API = BASE + '/upload/api.php';
  const CONCURRENCY = 3;
  const AUTO_RETRIES = 2;
  const UNDO_MS = 6000;
  const IMAGE_EXT = /\.(jpe?g|png|webp|hei[cf]|avif|gif|tiff?)$/i;

  const $ = id => document.getElementById(id);
  const queueEl = $('queue');
  const postsEl = $('posts');
  const tplItem = $('tpl-item').content.firstElementChild;
  const tplPost = $('tpl-post').content.firstElementChild;
  const baseTitle = document.title;

  const fmtBytes = n => n < 1e6 ? Math.max(1, Math.round(n / 1e3)) + ' KB' : (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + ' MB';
  const fmtTime = s => s < 50 ? `about ${Math.max(5, Math.round(s / 5) * 5)}s left` : `about ${Math.round(s / 60)} min left`;
  const debounce = (fn, ms) => { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); fn(...a); }; return d; };

  async function api(action, body, opts = {}) {
    const post = body !== undefined;
    const res = await fetch(`${API}?a=${action}`, {
      method: post ? 'POST' : 'GET',
      headers: post ? { 'Content-Type': 'application/json', 'X-Toby-Token': TOKEN } : {},
      body: post ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      keepalive: !!opts.keepalive,
    });
    const data = await res.json().catch(() => ({ error: 'The server sent something unexpected.' }));
    if (res.status === 401) signedOut();
    if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
    return data;
  }

  /* ================================================================ queue */

  const items = [];
  let active = 0;
  let localId = 0;
  let speed = null;   // smoothed bytes/ms for the ETA

  function addFiles(list) {
    const files = [...list].filter(f => f.type.startsWith('image/') || IMAGE_EXT.test(f.name));
    if (!files.length) return toast('Those don’t look like photos.');
    const batch = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    $('queue-wrap').hidden = false;
    files.forEach((file, i) => {
      const item = { id: ++localId, file, batch, idx: i, state: 'queued', loaded: 0, tries: 0, caption: '', post: null, xhr: null };
      queueEl.append(renderItem(item));
      items.push(item);
    });
    previewNext();
    pump();
    overall();
  }

  function renderItem(item) {
    const el = item.el = tplItem.cloneNode(true);
    el.querySelector('.item-name').textContent = item.file.name;
    el.querySelector('.item-badge').textContent = (item.file.name.split('.').pop() || '').toUpperCase().slice(0, 4);
    const cap = el.querySelector('.caption');
    const saveLater = debounce(() => item.post && saveCaption(item.post.id, item.caption), 700);
    cap.addEventListener('input', () => {
      item.caption = cap.value;
      if (item.post) { syncCaption(item.post.id, cap.value, cap); saveLater(); }
    });
    cap.addEventListener('blur', () => item.post && saveLater.flush());
    el.querySelector('.retry').addEventListener('click', () => retry(item));
    el.querySelector('.remove').addEventListener('click', () => removeItem(item));
    item.cap = cap;
    paint(item);
    return el;
  }

  function paint(item, msg) {
    const el = item.el;
    el.classList.toggle('uploading', item.state === 'uploading' || item.state === 'developing');
    el.classList.toggle('done', item.state === 'done');
    el.classList.toggle('failed', item.state === 'failed');
    el.querySelector('.retry').hidden = item.state !== 'failed';
    el.querySelector('.remove').title = el.querySelector('.remove').ariaLabel =
      item.state === 'uploading' || item.state === 'developing' ? 'Cancel upload' : 'Remove from list';
    const frac = item.state === 'done' ? 1 : item.loaded / (item.file.size || 1);
    el.querySelector('.meter i').style.setProperty('--p', frac.toFixed(4));
    const state = el.querySelector('.item-state');
    state.textContent = msg || {
      queued: 'Waiting · ' + fmtBytes(item.file.size),
      uploading: Math.floor(frac * 100) + '%',
      developing: 'Developing…',
      done: 'In the feed',
      failed: 'Failed',
      waiting: 'Retrying…',
    }[item.state];
  }

  /* little previews, one at a time, so forty 12-megapixel photos don't sink a phone */
  let previewing = false;
  async function previewNext() {
    if (previewing) return;
    const item = items.find(i => !i.previewed && i.state !== 'removed');
    if (!item) return;
    previewing = true;
    item.previewed = true;
    const img = item.el.querySelector('.item-thumb img');
    const url = URL.createObjectURL(item.file);
    try {
      const probe = new Image();
      probe.src = url;
      await probe.decode();
      const s = 128 / Math.min(probe.naturalWidth, probe.naturalHeight);
      const c = document.createElement('canvas');
      c.width = Math.round(probe.naturalWidth * Math.min(1, s));
      c.height = Math.round(probe.naturalHeight * Math.min(1, s));
      c.getContext('2d').drawImage(probe, 0, 0, c.width, c.height);
      img.src = c.toDataURL('image/jpeg', .72);
      item.el.querySelector('.item-badge').textContent = '';
      probe.src = '';
    } catch {
      /* HEIC outside Safari: keep the format badge until the server's thumbnail arrives */
    } finally {
      URL.revokeObjectURL(url);
      previewing = false;
      setTimeout(previewNext, 0);
    }
  }

  function pump() {
    while (active < CONCURRENCY) {
      const next = items.find(i => i.state === 'queued');
      if (!next) break;
      send(next);
    }
    overall();
  }

  function send(item) {
    active++;
    item.state = 'uploading';
    item.loaded = 0;
    item.sentCaption = item.caption;
    paint(item);

    const fd = new FormData();
    fd.append('photo', item.file, item.file.name);
    fd.append('caption', item.caption);
    fd.append('batch', item.batch);
    fd.append('idx', String(item.idx));

    const xhr = new XMLHttpRequest();
    item.xhr = xhr;
    let lastT = performance.now(), lastB = 0;
    xhr.open('POST', `${API}?a=upload`);
    xhr.setRequestHeader('X-Toby-Token', TOKEN);
    xhr.responseType = 'json';
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      item.loaded = Math.min(item.file.size, e.loaded / e.total * item.file.size);
      const now = performance.now();
      if (now - lastT > 250) {
        const v = (item.loaded - lastB) / (now - lastT);
        speed = speed == null ? v * active : speed * .8 + v * active * .2;
        lastT = now; lastB = item.loaded;
      }
      paint(item);
      overall();
    };
    xhr.upload.onload = () => { item.loaded = item.file.size; item.state = 'developing'; paint(item); overall(); };
    const finish = (ok, data, status) => {
      if (item.xhr !== xhr) return;   // cancelled or superseded
      item.xhr = null;
      active--;
      ok ? succeeded(item, data) : failed(item, data?.error, status);
      pump();
    };
    xhr.onload = () => {
      const d = xhr.response || { error: `Unexpected reply from the server (${xhr.status}).` };
      finish(xhr.status === 200 && d.post, d, xhr.status);
    };
    xhr.onerror = () => finish(false, { error: 'The connection dropped.' }, 0);
    xhr.ontimeout = () => finish(false, { error: 'That took too long.' }, 0);
    xhr.send(fd);
  }

  function succeeded(item, data) {
    item.state = 'done';
    item.post = data.post;
    const img = item.el.querySelector('.item-thumb img');
    if (!img.getAttribute('src')) { img.src = data.post.src.t[0]; item.el.querySelector('.item-badge').textContent = ''; }
    if (item.caption !== item.sentCaption) saveCaption(data.post.id, item.caption);
    paint(item);
    insertPost(data.post, data.index);
  }

  function failed(item, msg, status) {
    if (status === 401) return;
    const retryable = status === 0 || status >= 500 || status === 408 || status === 429;
    if (retryable && item.tries < AUTO_RETRIES) {
      item.tries++;
      item.state = 'waiting';
      const wait = 1500 * 2 ** (item.tries - 1);
      paint(item, `Retrying in ${Math.round(wait / 1000)}s…`);
      setTimeout(() => { if (item.state === 'waiting') { item.state = 'queued'; paint(item); pump(); } }, wait);
      return;
    }
    item.state = 'failed';
    item.loaded = 0;
    paint(item, msg || 'Failed');
    overall();
  }

  function retry(item) {
    if (item.state !== 'failed') return;
    item.tries = 0;
    item.state = 'queued';
    paint(item);
    pump();
  }

  function removeItem(item) {
    // once the bytes are up the server is already developing it; let that finish rather than orphan a post
    if (item.xhr && item.state === 'uploading') { const x = item.xhr; item.xhr = null; active--; x.abort(); }
    item.state = 'removed';
    item.el.classList.add('leaving');
    item.el.addEventListener('animationend', () => item.el.remove(), { once: true });
    items.splice(items.indexOf(item), 1);
    if (!items.length) $('queue-wrap').hidden = true;
    pump();
  }

  $('clear-done').addEventListener('click', () => items.filter(i => i.state === 'done').forEach(removeItem));
  $('retry-all').addEventListener('click', () => items.filter(i => i.state === 'failed').forEach(retry));

  let wasBusy = false;
  function overall() {
    const box = $('overall');
    const live = items.filter(i => i.state !== 'removed');
    if (!live.length) { box.hidden = true; document.title = baseTitle; return; }
    box.hidden = false;
    const total = live.reduce((s, i) => s + i.file.size, 0);
    const sent = live.reduce((s, i) => s + (i.state === 'done' || i.state === 'developing' ? i.file.size : i.loaded), 0);
    const done = live.filter(i => i.state === 'done').length;
    const bad = live.filter(i => i.state === 'failed').length;
    const busy = live.length - done - bad;
    const frac = total ? sent / total : 0;
    box.classList.toggle('active', busy > 0);
    $('overall-fill').style.setProperty('--p', (busy ? frac : 1).toFixed(4));
    $('retry-all').hidden = !bad;

    if (wasBusy && !busy) refreshPosts();
    wasBusy = busy > 0;

    let main, sub;
    if (busy) {
      main = `Uploading ${Math.min(live.length, done + 1)} of ${live.length}`;
      sub = `${fmtBytes(sent)} of ${fmtBytes(total)}`;
      if (speed > 0 && frac < .98) sub += ' · ' + fmtTime((total - sent) / speed / 1000);
      document.title = `(${Math.floor(frac * 100)}%) ${baseTitle}`;
    } else if (bad) {
      main = `${done} uploaded · ${bad} didn’t make it`;
      sub = 'Tap retry when you’re ready';
      document.title = baseTitle;
    } else {
      main = done === 1 ? 'Uploaded ✓' : `All ${done} uploaded ✓`;
      sub = 'They’re in the feed';
      document.title = baseTitle;
      speed = null;
    }
    $('overall-main').textContent = main;
    $('overall-sub').textContent = sub;
  }

  addEventListener('beforeunload', e => {
    if (items.some(i => ['queued', 'uploading', 'developing', 'waiting'].includes(i.state))) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ------------------------------------------------------- ways in: pick, drop, paste */

  const picker = $('picker');
  $('dropzone').addEventListener('click', e => { if (!e.target.closest('textarea')) picker.click(); });
  picker.addEventListener('change', () => { addFiles(picker.files); picker.value = ''; });

  let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; document.body.classList.add('dragover'); });
  addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--depth <= 0) { depth = 0; document.body.classList.remove('dragover'); } });
  addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
  });

  addEventListener('paste', e => {
    if (e.target.closest?.('textarea, input')) return;
    const files = [...(e.clipboardData?.files || [])];
    if (!files.length) return;
    e.preventDefault();
    const stamp = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    addFiles(files.map((f, i) => /^image\.\w+$/.test(f.name)
      ? new File([f], `Pasted ${stamp}${files.length > 1 ? ' ' + (i + 1) : ''}.${f.name.split('.').pop()}`, { type: f.type })
      : f));
  });

  /* ================================================================ posts */

  let posts = [];
  const els = new Map();
  const pendingDeletes = new Map();   // id → { post, index }
  let undoTimer = 0;

  function postEl(p) {
    let el = els.get(p.id);
    if (el) return el;
    el = tplPost.cloneNode(true);
    el.dataset.id = p.id;
    const thumb = el.querySelector('.post-thumb');
    thumb.style.setProperty('--c', p.c);
    thumb.style.setProperty('--lq', `url(${p.lq})`);
    const img = thumb.querySelector('img');
    img.addEventListener('load', () => img.classList.add('in'), { once: true });
    img.src = p.src.t[0];
    const cap = el.querySelector('.caption');
    cap.value = p.cap;
    const saveLater = debounce(() => saveCaption(p.id, cap.value), 800);
    cap.addEventListener('input', () => { syncCaption(p.id, cap.value, cap); saveLater(); });
    cap.addEventListener('blur', () => { if (cap.value !== (posts.find(x => x.id === p.id)?.cap ?? cap.value)) saveLater.flush(); });
    el.querySelector('.move-up').addEventListener('click', () => move(p.id, -1));
    el.querySelector('.move-down').addEventListener('click', () => move(p.id, 1));
    el.querySelector('.delete').addEventListener('click', () => softDelete(p.id));
    els.set(p.id, el);
    return el;
  }

  function renderPosts() {
    const keep = new Set(posts.map(p => p.id));
    for (const [id, el] of els) if (!keep.has(id)) { el.remove(); els.delete(id); }
    posts.forEach((p, i) => {
      const el = postEl(p);
      if (postsEl.children[i] !== el) postsEl.insertBefore(el, postsEl.children[i] || null);
      el.querySelector('.post-n').textContent = i + 1;
      el.querySelector('.move-up').disabled = i === 0;
      el.querySelector('.move-down').disabled = i === posts.length - 1;
    });
    $('post-count').textContent = posts.length ? `· ${posts.length}` : '';
    $('posts-empty').hidden = posts.length > 0;
  }

  function insertPost(p, index) {
    if (posts.some(x => x.id === p.id)) return;
    posts.splice(Math.max(0, Math.min(index ?? 0, posts.length)), 0, p);
    renderPosts();
    const el = els.get(p.id);
    el.classList.add('is-new');
    setTimeout(() => el.classList.remove('is-new'), 2600);
  }

  function syncCaption(id, text, except) {
    const p = posts.find(x => x.id === id);
    const card = els.get(id)?.querySelector('.caption');
    if (card && card !== except && document.activeElement !== card) card.value = text;
    for (const it of items) if (it.post?.id === id && it.cap !== except && document.activeElement !== it.cap) { it.cap.value = text; it.caption = text; }
    return p;
  }

  async function saveCaption(id, text) {
    const flag = els.get(id)?.querySelector('.saved');
    try {
      const { post } = await api('caption', { id, caption: text });
      const p = posts.find(x => x.id === id);
      if (p) p.cap = post.cap;
      if (flag) { flag.textContent = 'Saved'; flag.className = 'saved show'; clearTimeout(flag.t); flag.t = setTimeout(() => flag.classList.remove('show'), 1600); }
    } catch (e) {
      if (flag) { flag.textContent = 'Not saved'; flag.className = 'saved show err'; flag.title = e.message; }
    }
  }

  /* when a batch settles, take the server's word for order and captions */
  async function refreshPosts() {
    try {
      const { posts: fresh } = await api('list');
      posts = fresh.filter(p => !pendingDeletes.has(p.id));
      for (const p of posts) {
        const cap = els.get(p.id)?.querySelector('.caption');
        if (cap && document.activeElement !== cap) cap.value = p.cap;
      }
      renderPosts();
    } catch { /* the next action will surface any real problem */ }
  }

  const saveOrder = debounce(async () => {
    try {
      const data = await api('reorder', { ids: posts.map(p => p.id) });
      posts = data.posts.filter(p => !pendingDeletes.has(p.id));
      renderPosts();
    } catch (e) {
      toast('Couldn’t save the new order: ' + e.message);
    }
  }, 350);

  function move(id, dir) {
    const i = posts.findIndex(p => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= posts.length) return;
    [posts[i], posts[j]] = [posts[j], posts[i]];
    renderPosts();
    els.get(id).querySelector(dir < 0 ? '.move-up' : '.move-down').focus();
    saveOrder();
  }

  function softDelete(id) {
    const index = posts.findIndex(p => p.id === id);
    if (index < 0) return;
    const el = els.get(id);
    el.classList.add('removing');
    pendingDeletes.set(id, { post: posts[index], index });
    setTimeout(() => {
      if (!pendingDeletes.has(id)) return;
      posts = posts.filter(p => p.id !== id);
      renderPosts();
    }, 240);
    const n = pendingDeletes.size;
    toast(n === 1 ? 'Photo deleted' : `${n} photos deleted`, undoDeletes);
    clearTimeout(undoTimer);
    undoTimer = setTimeout(commitDeletes, UNDO_MS);
  }

  function undoDeletes() {
    clearTimeout(undoTimer);
    const back = [...pendingDeletes.values()].sort((a, b) => a.index - b.index);
    pendingDeletes.clear();
    for (const { post, index } of back) {
      els.get(post.id)?.classList.remove('removing');
      if (!posts.some(p => p.id === post.id)) posts.splice(Math.min(index, posts.length), 0, post);
    }
    renderPosts();
    hideToast();
  }

  function commitDeletes(keepalive = false) {
    clearTimeout(undoTimer);
    const ids = [...pendingDeletes.keys()];
    pendingDeletes.clear();
    hideToast();
    ids.forEach(id => api('delete', { id }, { keepalive }).catch(e => toast('Delete failed: ' + e.message)));
  }
  addEventListener('pagehide', () => { if (pendingDeletes.size) commitDeletes(true); });

  /* --------------------------------------------------------------- toast */

  function toast(text, onUndo) {
    $('toast-text').textContent = text;
    $('toast-undo').hidden = !onUndo;
    $('toast-undo').onclick = onUndo || null;
    const t = $('toast');
    t.hidden = false;
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    clearTimeout(t.timer);
    if (!onUndo) t.timer = setTimeout(hideToast, 4200);
  }
  function hideToast() { $('toast').hidden = true; }

  let signingOut = false;
  function signedOut() {
    if (signingOut) return;
    signingOut = true;
    toast('Signed out — taking you back to the door…');
    setTimeout(() => location.reload(), 1400);
  }

  $('logout').addEventListener('click', async () => {
    if (items.some(i => ['queued', 'uploading', 'developing'].includes(i.state)) && !confirm('Uploads are still running. Lock anyway?')) return;
    if (pendingDeletes.size) commitDeletes(true);
    try { await api('logout', {}); } finally { location.reload(); }
  });

  /* ---------------------------------------------------------------- boot */

  api('list').then(d => { posts = d.posts; renderPosts(); }).catch(e => toast('Couldn’t load the feed: ' + e.message));

  const bootSortable = () => {
    if (!window.Sortable) return;
    Sortable.create(postsEl, {
      animation: 180,
      handle: '.post-thumb',
      delay: 180,
      delayOnTouchOnly: true,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: () => {
        const byId = new Map(posts.map(p => [p.id, p]));
        posts = [...postsEl.children].map(li => byId.get(li.dataset.id)).filter(Boolean);
        renderPosts();
        saveOrder();
      },
    });
  };
  if (window.Sortable) bootSortable(); else addEventListener('load', bootSortable);
})();
