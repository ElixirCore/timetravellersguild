<?php
declare(strict_types=1);
require_once __DIR__ . '/network.php';

$slug = (string) ($slug ?? '');
$room = ttg_room($slug);
if (!$room) {
    http_response_code(404);
    $room = [
        'slug' => $slug,
        'title' => 'Unplaced',
        'kicker' => 'elsewhen',
        'copy' => 'This address is not yet attached to a stable chronology.',
        'signal' => 'Elsewhen is not another time. It is time without permission.',
        'coord' => 'E-?',
        'access' => 'unknown',
        'status' => 'drifting',
        'href' => '/elsewhen/',
        'continue' => 'Go to Elsewhen',
        'links' => ['elsewhen', 'station'],
    ];
}

$pageTitle = ($room['title'] ?? 'Room') . ' — The Time Travellers Guild';
$continue = (string) ($room['continue'] ?? 'Continue');
$continueHref = (string) ($room['continue_href'] ?? $room['href'] ?? '/');
$isSelf = ttg_href_here($continueHref);
$related = [];
foreach (($room['links'] ?? []) as $linkSlug) {
    $linked = ttg_room((string) $linkSlug);
    if ($linked) $related[] = $linked;
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title><?= ttg_h($pageTitle) ?></title>
<meta name="description" content="<?= ttg_h((string) ($room['copy'] ?? '')) ?>">
<meta name="theme-color" content="#070706">
<link rel="canonical" href="https://timetravellersguild.com/<?= ttg_h($slug) ?>/">
<?= ttg_og_head(['title' => $pageTitle, 'description' => (string) ($room['copy'] ?? ''), 'url' => 'https://timetravellersguild.com/' . $slug . '/']) ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;1,400&family=Courier+Prime:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/network.css">
<style>
:root{
  --ink:#070706; --ink-2:#0e0d0b; --rule:#231f19;
  --brass:#c9a961; --brass-dim:#7d6838; --brass-faint:#3d3320; --brass-bright:#e4c583;
  --sage:#a8bfa8; --parch:#ded7c8; --parch-dim:#948d80;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--parch);font-family:"EB Garamond",Georgia,serif;font-size:18px;line-height:1.62}
a{color:inherit}
main{max-width:42rem;margin:0 auto;padding:2.4rem 6vw 4.5rem}
.kicker{font-family:"Courier Prime",monospace;font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:var(--brass);margin:0 0 .8rem}
h1{font-weight:400;font-size:clamp(2.4rem,8vw,4.4rem);line-height:.95;color:#f4eede;margin:0 0 1.1rem}
.copy{font-size:1.12rem;max-width:36ch;margin:0 0 1.4rem}
blockquote{margin:1.8rem 0;padding:0 0 0 1.1rem;border-left:2px solid var(--brass);font-style:italic;color:var(--parch-dim)}
dl{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:2rem 0}
dt{font-family:"Courier Prime",monospace;font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--brass-dim)}
dd{margin:.35rem 0 0;font-family:"Courier Prime",monospace;font-size:.78rem;color:var(--brass-bright)}
.actions{display:flex;flex-wrap:wrap;gap:.6rem;margin:1.8rem 0 0}
.actions a{display:inline-block;font-family:"Courier Prime",monospace;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border:1px solid var(--brass-faint);color:var(--brass-bright);padding:.5rem .85rem}
.actions a:hover{border-color:var(--brass);background:rgba(201,169,97,.08)}
.related{margin:2.6rem 0 0}
.related h2{font-weight:400;font-size:.78rem;font-family:"Courier Prime",monospace;letter-spacing:.14em;color:var(--brass-dim);margin:0 0 .8rem}
.related ul{list-style:none;margin:0;padding:0;display:grid;gap:.4rem}
.related a{display:flex;justify-content:space-between;gap:1rem;border:1px solid var(--rule);padding:.7rem .85rem;text-decoration:none}
.related a:hover{border-color:var(--brass-dim)}
.related .n{color:#f4eede}
.related .p{font-family:"Courier Prime",monospace;font-size:.62rem;color:var(--brass-dim)}
@media(max-width:640px){dl{grid-template-columns:1fr}}
</style>
</head>
<body>
<?= ttg_network_bar() ?>
<main>
  <p class="kicker"><?= ttg_h((string) ($room['kicker'] ?? 'room')) ?></p>
  <h1><?= ttg_h((string) ($room['title'] ?? 'Room')) ?></h1>
  <p class="copy"><?= ttg_h((string) ($room['copy'] ?? '')) ?></p>
  <?php if (!empty($room['signal'])): ?>
    <blockquote><?= ttg_h((string) $room['signal']) ?></blockquote>
  <?php endif; ?>
  <dl>
    <div><dt>coordinate</dt><dd><?= ttg_h((string) ($room['coord'] ?? '—')) ?></dd></div>
    <div><dt>access</dt><dd><?= ttg_h((string) ($room['access'] ?? '—')) ?></dd></div>
    <div><dt>status</dt><dd><?= ttg_h((string) ($room['status'] ?? '—')) ?></dd></div>
  </dl>
  <div class="actions">
    <a href="/now">← the tree</a>
    <a href="/hub/">hub</a>
    <?php if (!$isSelf && $continueHref !== '' && $continueHref !== '/'): ?>
      <a href="<?= ttg_h($continueHref) ?>"><?= ttg_h($continue) ?></a>
    <?php endif; ?>
  </div>
  <?php if ($related): ?>
  <section class="related">
    <h2>Limb</h2>
    <ul>
      <?php foreach ($related as $linked): ?>
        <li>
          <a href="<?= ttg_h((string) $linked['href']) ?>">
            <span class="n"><?= ttg_h((string) $linked['title']) ?></span>
            <span class="p">/<?= ttg_h((string) $linked['slug']) ?>/</span>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </section>
  <?php endif; ?>
  <?= ttg_limbs($slug) ?>
</main>
<?= ttg_html_visit_tracker() ?>
</body>
</html>
<?php
exit;
