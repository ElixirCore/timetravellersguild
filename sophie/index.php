<?php
declare(strict_types=1);
define('SOPHIE_PUBLIC', __DIR__);
require (getenv('SOPHIE_DATA') ?: dirname(__DIR__, 3) . '/sophie-data') . '/lib.php';

$cfg   = sophie_config();
$posts = array_map('post_public', posts_load());
$count = count($posts);
$first = $posts[0] ?? null;
$v     = fn(string $f) => SOPHIE_BASE . "/assets/$f?v=" . @filemtime(__DIR__ . "/assets/$f");
const FIRST_PAINT = 24;   // cells rendered on the server; the rest stream in as you scroll

header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

function cell(array $p, int $i): string
{
    [$t, $tw] = $p['src']['t'];
    [$m, $mw] = $p['src']['m'];
    $eager = $i < 6;
    $alt = $p['cap'] !== '' ? mb_strimwidth($p['cap'], 0, 120, '…') : 'Photo';
    return sprintf(
        '<a class="cell" href="#p/%1$s" data-i="%2$d" style="--c:%3$s;--lq:url(%4$s);--n:%2$d">'
        . '<img src="%5$s" srcset="%5$s %6$dw, %7$s %8$dw" sizes="(min-width: 960px) 309px, 33vw" alt="%9$s" %10$s decoding="async">'
        . '%11$s</a>',
        h($p['id']), $i, h($p['c']), h($p['lq']), h($t), $tw, h($m), $mw, h($alt),
        $eager ? ($i < 3 ? 'fetchpriority="high"' : '') : 'loading="lazy"',
        $p['cap'] !== '' ? '<span class="peek"><span>' . h(mb_strimwidth($p['cap'], 0, 90, '…')) . '</span></span>' : ''
    );
}
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, noimageindex">
<meta name="theme-color" content="#fbf7f1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#151210" media="(prefers-color-scheme: dark)">
<title><?= h($cfg['title']) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..700,100;1,9..144,300..700,100&family=Instrument+Sans:wght@400..600&display=swap">
<link rel="stylesheet" href="<?= h($v('feed.css')) ?>">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='1' x2='1' y2='0'><stop offset='0' stop-color='%23f5a35c'/><stop offset='.5' stop-color='%23e0586c'/><stop offset='1' stop-color='%239a5bd6'/></linearGradient></defs><circle cx='32' cy='32' r='28' fill='none' stroke='url(%23g)' stroke-width='7'/><circle cx='32' cy='32' r='12' fill='%23e0586c'/></svg>">
<?php if ($first): ?><link rel="preload" as="image" href="<?= h($first['src']['t'][0]) ?>"><?php endif ?>
</head>
<body>
<div class="page">
  <header class="profile">
    <button class="avatar<?= $first ? '' : ' empty' ?>" type="button" <?= $first ? 'data-open="0" aria-label="Open the newest photo"' : 'disabled aria-label="No photos yet"' ?>>
      <span class="ring" aria-hidden="true"></span>
      <?php if ($first): ?>
        <img src="<?= h($first['src']['t'][0]) ?>" alt="" style="background:<?= h($first['c']) ?>">
      <?php else: ?>
        <span class="mono"><?= h(mb_substr($cfg['title'], 0, 1)) ?></span>
      <?php endif ?>
    </button>
    <div class="who">
      <p class="handle"><?= h($cfg['handle']) ?></p>
      <h1><?= h($cfg['title']) ?></h1>
      <p class="stats"><strong data-count><?= $count ?></strong> <?= $count === 1 ? 'post' : 'posts' ?></p>
      <?php if ($cfg['bio'] !== ''): ?><p class="bio"><?= nl2br(h($cfg['bio'])) ?></p><?php endif ?>
    </div>
  </header>

  <nav class="tabs" aria-label="Views">
    <span class="tab" aria-current="page">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/></svg>
      Posts
    </span>
  </nav>

  <?php if ($count === 0): ?>
    <section class="empty-state">
      <div class="polaroids" aria-hidden="true"><i></i><i></i><i></i></div>
      <h2>Nothing here yet</h2>
      <p>The first photos are on their way.</p>
    </section>
  <?php else: ?>
    <main class="grid" id="grid">
      <?php foreach (array_slice($posts, 0, FIRST_PAINT) as $i => $p) echo cell($p, $i); ?>
    </main>
    <div class="more" id="more" aria-hidden="true"></div>
  <?php endif ?>

  <footer class="foot">made with <span class="heart" aria-label="love">♥</span> for <?= h($cfg['title']) ?></footer>
</div>

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Photo viewer" hidden>
  <div class="lb-backdrop"></div>
  <div class="lb-top">
    <span class="lb-count" aria-live="polite"></span>
    <button class="lb-btn lb-close" type="button" aria-label="Close (Esc)">
      <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>
  <div class="lb-track"></div>
  <button class="lb-btn lb-nav lb-prev" type="button" aria-label="Previous (←)"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
  <button class="lb-btn lb-nav lb-next" type="button" aria-label="Next (→)"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
  <div class="lb-meta"><p class="lb-cap"></p><p class="lb-date"></p></div>
</div>

<script type="application/json" id="posts"><?= json_encode($posts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
<script src="<?= h($v('feed.js')) ?>" defer></script>
</body>
</html>
