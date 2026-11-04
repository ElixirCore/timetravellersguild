<?php
declare(strict_types=1);
define('SOPHIE_PUBLIC', dirname(__DIR__));
require (getenv('SOPHIE_DATA') ?: dirname(__DIR__, 4) . '/sophie-data') . '/lib.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

sophie_session();
$cfg = sophie_config();
$hash = (string)$cfg['password_hash'];
$error = '';
$wait = 0;

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['password'])) {
    $wait = throttle_wait();
    if ($hash === '') {
        $error = 'No password has been set yet.';
    } elseif ($wait > 0) {
        $error = 'Too many tries. Breathe, then try again in ' . ($wait >= 90 ? ceil($wait / 60) . ' minutes' : "$wait seconds") . '.';
    } elseif (!csrf_ok($_POST['t'] ?? null)) {
        $error = 'That form went stale — try once more.';
    } elseif (password_verify((string)$_POST['password'], $hash)) {
        throttle_record(true);
        if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
            try { config_write_hash(password_hash((string)$_POST['password'], PASSWORD_DEFAULT)); } catch (Throwable $e) {}
        }
        session_regenerate_id(true);
        $_SESSION = ['sophie_ok' => true, 'sophie_hash' => hash_fingerprint(), 'csrf' => bin2hex(random_bytes(24))];
        header('Location: ' . SOPHIE_BASE . '/upload/', true, 303);
        exit;
    } else {
        usleep(random_int(400_000, 900_000));
        throttle_record(false);
        $error = "That's not it.";
    }
}

$authed = is_authed();
$token = csrf_token();
$v = fn(string $f) => SOPHIE_BASE . "/assets/$f?v=" . @filemtime(SOPHIE_PUBLIC . "/assets/$f");
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#fbf7f1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#151210" media="(prefers-color-scheme: dark)">
<title><?= $authed ? 'Upload station' : 'Station door' ?> · <?= h($cfg['title']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..700,100;1,9..144,300..700,100&family=Instrument+Sans:wght@400..600&display=swap">
<link rel="stylesheet" href="<?= h($v('station.css')) ?>">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='6' y='14' width='52' height='40' rx='9' fill='%23e0586c'/><rect x='22' y='8' width='20' height='10' rx='4' fill='%23e0586c'/><circle cx='32' cy='34' r='12' fill='%23fbf7f1'/><circle cx='32' cy='34' r='6' fill='%23e0586c'/></svg>">
<meta name="sophie-token" content="<?= h($token) ?>">
<meta name="sophie-base" content="<?= h(SOPHIE_BASE) ?>">
</head>
<body class="<?= $authed ? 'is-station' : 'is-door' ?>">

<?php if (!$authed): ?>
<main class="door">
  <form class="door-card<?= $error ? ' shake' : '' ?>" method="post" autocomplete="on">
    <div class="door-mark" aria-hidden="true"><span></span></div>
    <p class="eyebrow"><?= h($cfg['title']) ?></p>
    <h1>Upload station</h1>
    <?php if ($hash === ''): ?>
      <p class="door-note">No password set yet. On the server, run
        <code>php ~/sophie-data/set-password.php</code> and choose one. Then come back here.</p>
    <?php else: ?>
      <input type="hidden" name="t" value="<?= h($token) ?>">
      <input type="text" name="username" value="sophie" autocomplete="username" hidden>
      <label class="field">
        <span>Password</span>
        <input type="password" name="password" autocomplete="current-password" required autofocus <?= $wait > 0 ? 'disabled' : '' ?>>
      </label>
      <button class="btn btn-primary" type="submit" <?= $wait > 0 ? 'disabled' : '' ?>>Unlock <span aria-hidden="true">→</span></button>
      <p class="door-error" role="alert"><?= h($error) ?></p>
    <?php endif ?>
  </form>
  <a class="door-back" href="<?= h(SOPHIE_BASE) ?>/">← back to the feed</a>
</main>

<?php else: ?>
<div class="drop-veil" aria-hidden="true"><div><span class="veil-icon"></span>Let go to upload</div></div>

<header class="bar">
  <a class="brand" href="<?= h(SOPHIE_BASE) ?>/" title="View the feed">
    <span class="brand-dot" aria-hidden="true"></span>
    <span><?= h($cfg['title']) ?></span>
  </a>
  <span class="bar-title">Upload station</span>
  <nav class="bar-links">
    <a href="<?= h(SOPHIE_BASE) ?>/" target="_blank" rel="noopener">View feed ↗</a>
    <button class="linkish" type="button" id="logout">Lock</button>
  </nav>
</header>

<div class="overall" id="overall" hidden>
  <div class="overall-text"><strong id="overall-main"></strong><span id="overall-sub"></span></div>
  <div class="meter"><i id="overall-fill"></i></div>
  <button class="btn btn-small" type="button" id="retry-all" hidden>Retry failed</button>
</div>

<main class="station">
  <section class="dropzone" id="dropzone">
    <input type="file" id="picker" multiple accept="image/*,.heic,.heif,.avif" hidden>
    <div class="stack" aria-hidden="true"><i></i><i></i><i></i></div>
    <h1>Add photos</h1>
    <p>Drag them anywhere on this page, <button class="linkish strong" type="button" id="pick">choose files</button>,
      or paste a screenshot.</p>
    <p class="fine">JPG, PNG, WebP, HEIC · up to 80 MB each · location data is stripped</p>
  </section>

  <section class="queue-wrap" id="queue-wrap" hidden>
    <div class="section-head">
      <h2>On their way</h2>
      <button class="linkish" type="button" id="clear-done">Clear finished</button>
    </div>
    <ol class="queue" id="queue"></ol>
  </section>

  <section class="manage">
    <div class="section-head">
      <h2>In the feed <span class="count" id="post-count"></span></h2>
      <p class="hint">Drag to reorder · captions save themselves</p>
    </div>
    <ol class="posts" id="posts"></ol>
    <p class="posts-empty" id="posts-empty" hidden>Nothing in the feed yet. The first photo you add lands right here.</p>
  </section>
</main>

<div class="toast" id="toast" role="status" aria-live="polite" hidden><span id="toast-text"></span><button class="linkish strong" type="button" id="toast-undo">Undo</button></div>

<template id="tpl-item">
  <li class="item">
    <div class="item-thumb"><img alt=""><span class="item-badge"></span></div>
    <div class="item-body">
      <div class="item-row">
        <span class="item-name"></span>
        <span class="item-state"></span>
      </div>
      <div class="meter"><i></i></div>
      <textarea class="caption" rows="1" maxlength="2200" placeholder="Add a caption (optional)"></textarea>
    </div>
    <div class="item-actions">
      <button class="icon-btn retry" type="button" title="Retry" aria-label="Retry" hidden><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/></svg></button>
      <button class="icon-btn remove" type="button" title="Remove from queue" aria-label="Remove from queue"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
  </li>
</template>

<template id="tpl-post">
  <li class="post">
    <div class="post-thumb"><img alt="" loading="lazy" decoding="async"><span class="post-n"></span></div>
    <textarea class="caption" rows="2" maxlength="2200" placeholder="Caption…"></textarea>
    <div class="post-actions">
      <button class="icon-btn move-up" type="button" title="Move earlier" aria-label="Move earlier"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <button class="icon-btn move-down" type="button" title="Move later" aria-label="Move later"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
      <span class="saved" aria-live="polite"></span>
      <button class="icon-btn danger delete" type="button" title="Delete" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg></button>
    </div>
  </li>
</template>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js" integrity="sha512-TelkP3PCMJv+viMWynjKcvLsQzx6dJHvIGhfqzFtZKgAjKM1YPqcwzzDEoTc/BHjf43PcPzTQOjuTr4YdE8lNQ==" crossorigin="anonymous" referrerpolicy="no-referrer" defer></script>
<script src="<?= h($v('station.js')) ?>" defer></script>
<?php endif ?>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
