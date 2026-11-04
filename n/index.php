<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/network.php';
require_once dirname(__DIR__) . '/inc/graph.php';

$id = trim((string) ($_GET['id'] ?? ''));
$node = $id !== '' ? ttg_graph_node($id) : null;
$index = [];
$life = null;

if ($id !== '' && (!$node || !ttg_graph_public($node))) {
    http_response_code(404);
    $pageTitle = 'Unplaced — The Time Travellers Guild';
    $kicker = 'UNKNOWN';
    $title = 'Unplaced';
    $body = 'This address is not yet attached to a stable chronology. Unknown is a valid state.';
    $canon = '/n/' . rawurlencode($id) . '/';
    $open = '';
    $meta = [
        'type' => 'UNKNOWN',
        'status' => 'UNRESOLVED',
        'observed' => '—',
        'visibility' => 'PUBLIC',
        'place' => 'unplaced',
        'custodian' => 'undisclosed',
    ];
    $neighbors = ['outgoing' => [], 'incoming' => []];
    $slug = $id;
} elseif ($node) {
    $slug = (string) ($node['slug'] ?? $id);
    $title = (string) ($node['title'] ?? 'Untitled');
    $body = (string) ($node['body'] ?? '');
    $kicker = ttg_graph_label_type((string) ($node['type'] ?? 'UNKNOWN'));
    $pageTitle = $title . ' — The Time Travellers Guild';
    $canon = ttg_graph_canonical($node);
    $open = ttg_graph_href($node);
    $obs = (string) ($node['observed_at'] ?? '');
    $life = ttg_graph_life($node);
    $meta = [
        'type' => $kicker,
        'status' => (string) ($node['status'] ?? '—'),
        'observed' => $obs !== '' ? $obs : '—',
        'visibility' => (string) ($node['visibility'] ?? 'PUBLIC'),
        'place' => (string) ($life['place'] ?? 'unplaced'),
        'custodian' => (string) ($life['custodian'] ?? 'undisclosed'),
    ];
    $neighbors = $life['neighbors'];
} else {
    $pageTitle = 'NOW — The Time Travellers Guild';
    $kicker = 'GRAPH';
    $title = 'The field, listed';
    $body = 'Every public node currently held. The tree on the frontpage is a projection of a bounded slice of this list, not a second database.';
    $canon = '/n/';
    $open = '/';
    $meta = [
        'type' => 'GRAPH',
        'status' => 'ACTIVE',
        'observed' => gmdate('c'),
        'visibility' => 'PUBLIC',
        'place' => '—',
        'custodian' => '—',
    ];
    $neighbors = ['outgoing' => [], 'incoming' => []];
    $slug = '';
    $index = ttg_graph_public_index();
}

if ($slug === 'department') {
    $body .= ' DET is an FFILM.org artistic construction, not a statutory or governmental body.';
}

$relWord = static function (string $rel): string {
    return str_replace('_', ' ', strtolower($rel));
};
$isRecord = $slug !== '' && $node && ttg_graph_public($node);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title><?= ttg_h($pageTitle) ?></title>
<meta name="description" content="<?= ttg_h($body) ?>">
<meta name="theme-color" content="#f1e4c4">
<link rel="canonical" href="https://timetravellersguild.com<?= ttg_h($canon) ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909a">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
<style>
main.record-main .kicker{font-family:var(--label);font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:var(--brass);margin:0 0 .8rem}
main.record-main h1{font-weight:400;font-size:clamp(2.1rem,7vw,3.6rem);line-height:.95;color:var(--ink);margin:0 0 .45rem}
.status{font-family:var(--label);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--brass-dim);margin:0 0 1.1rem}
.copy{font-size:1.12rem;max-width:42ch;margin:0 0 1.4rem}
.life{list-style:none;margin:0 0 1.6rem;padding:0;font-family:var(--label);font-size:.78rem;color:var(--brass-bright);line-height:1.85}
.life span{color:var(--brass-dim)}
.peel{margin:1.6rem 0;padding:1rem 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.peel h2{font-weight:400;font-size:.62rem;font-family:var(--label);letter-spacing:.16em;text-transform:uppercase;color:var(--brass-dim);margin:0 0 .5rem}
.peel p{margin:0 0 1rem;font-size:.98rem;color:var(--parch-dim)}
.peel .interp{font-style:italic}
dl{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin:2rem 0}
dt{font-family:var(--label);font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--brass-dim)}
dd{margin:.35rem 0 0;font-family:var(--label);font-size:.78rem;color:var(--brass-bright);word-break:break-word}
.actions{display:flex;flex-wrap:wrap;gap:.6rem;margin:1.8rem 0 0}
.actions a{display:inline-block;font-family:var(--label);font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border:1px solid var(--brass-faint);color:var(--brass-bright);padding:.5rem .85rem}
.actions a:hover{border-color:var(--brass);background:rgba(201,169,97,.08)}
.related{margin:2.6rem 0 0}
.related h2{font-weight:400;font-size:.78rem;font-family:var(--label);letter-spacing:.14em;color:var(--brass-dim);margin:0 0 .8rem}
.related ul,.index{list-style:none;margin:0;padding:0;display:grid;gap:.4rem}
.related a,.index a{display:flex;justify-content:space-between;gap:1rem;border:1px solid var(--rule);padding:.7rem .85rem;text-decoration:none}
.related a:hover,.index a:hover{border-color:var(--brass-dim)}
.related .n,.index .n{color:var(--ink)}
.related .p,.index .p{font-family:var(--label);font-size:.62rem;color:var(--brass-dim);text-align:right}
@media(max-width:640px){dl{grid-template-columns:1fr}}
</style>
</head>
<body class="record">
<header id="mast">
  <?= ttg_html_site_mark('', 'div', 'site') ?>
  <div class="presents">
    <span>LOCAL PRESENT: <time id="localPresent"><?= ttg_h((new DateTimeImmutable('now'))->format('d.m.Y')) ?></time></span>
    <span>NETWORK PRESENT: 17.04.2033</span>
  </div>
</header>
<main class="record-main">
  <p class="kicker"><?= ttg_h($kicker) ?></p>
  <h1><?= ttg_h($title) ?></h1>
  <?php if ($isRecord): ?>
    <p class="status"><?= ttg_h((string) $meta['status']) ?></p>
  <?php endif; ?>
  <p class="copy"><?= ttg_h($body) ?></p>

  <?php if ($isRecord && $life): ?>
  <ul class="life">
    <li><span>Last observed:</span> <?= ttg_h((string) $life['place']) ?></li>
    <li><span>Custodian:</span> <?= ttg_h((string) $life['custodian']) ?></li>
    <li><?= (int) $life['moments'] ?> associated moment<?= (int) $life['moments'] === 1 ? '' : 's' ?></li>
    <li><?= (int) $life['unresolved'] ?> unresolved relationship<?= (int) $life['unresolved'] === 1 ? '' : 's' ?></li>
    <?php if ($life['opening'] !== ''): ?>
      <li><?= ttg_h((string) $life['opening']) ?></li>
    <?php endif; ?>
  </ul>
  <div class="peel">
    <h2>Evidence</h2>
    <?php if (empty($life['evidence'])): ?>
      <p>None recorded. Absence is a valid observation.</p>
    <?php else: ?>
      <p><?php
        $bits = [];
        foreach (array_slice($life['evidence'], 0, 8) as $ev) {
            $bits[] = ttg_h((string) $ev['label']) . ' (' . ttg_h(str_replace('_', ' ', strtolower((string) $ev['via']))) . ')';
        }
        echo implode('; ', $bits);
      ?></p>
    <?php endif; ?>
    <h2>Interpretation</h2>
    <?php if (!empty($life['interpretation'])): ?>
      <p class="interp"><?= ttg_h((string) $life['interpretation']) ?></p>
    <?php else: ?>
      <p>No interpretation has been accepted. The evidence stands alone.</p>
    <?php endif; ?>
  </div>
  <?php endif; ?>

  <dl>
    <div><dt>type</dt><dd><?= ttg_h((string) $meta['type']) ?></dd></div>
    <div><dt>status</dt><dd><?= ttg_h((string) $meta['status']) ?></dd></div>
    <div><dt>observed</dt><dd><?= ttg_h((string) $meta['observed']) ?></dd></div>
    <div><dt>visibility</dt><dd><?= ttg_h((string) $meta['visibility']) ?></dd></div>
  </dl>
  <div class="actions">
    <a href="/now/tree">← NOW</a>
    <?php if ($open !== $canon && $open !== '' && $open !== '/'): ?>
      <a href="<?= ttg_h($open) ?>">cross</a>
    <?php endif; ?>
  </div>

  <?php if (!empty($index)): ?>
  <section class="related">
    <h2>Public nodes</h2>
    <ul class="index">
      <?php foreach ($index as $item): ?>
        <li>
          <a href="<?= ttg_h((string) $item['href']) ?>">
            <span class="n"><?= ttg_h((string) $item['title']) ?></span>
            <span class="p"><?= ttg_h((string) $item['type']) ?><?= !empty($item['year']) ? ' · ' . (int) $item['year'] : '' ?></span>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </section>
  <?php endif; ?>

  <?php if ($neighbors['outgoing'] || $neighbors['incoming']): ?>
  <section class="related">
    <h2>Edges</h2>
    <ul>
      <?php foreach ($neighbors['outgoing'] as $row): ?>
        <?php $other = $row['node']; ?>
        <li>
          <a href="<?= ttg_h(ttg_graph_canonical($other)) ?>">
            <span class="n"><?= ttg_h((string) ($other['title'] ?? '')) ?></span>
            <span class="p"><?= ttg_h($relWord((string) $row['relationship'])) ?> → <?= ttg_h((string) ($other['type'] ?? '')) ?></span>
          </a>
        </li>
      <?php endforeach; ?>
      <?php foreach ($neighbors['incoming'] as $row): ?>
        <?php $other = $row['node']; ?>
        <li>
          <a href="<?= ttg_h(ttg_graph_canonical($other)) ?>">
            <span class="n"><?= ttg_h((string) ($other['title'] ?? '')) ?></span>
            <span class="p">← <?= ttg_h($relWord((string) $row['relationship'])) ?> · <?= ttg_h((string) ($other['type'] ?? '')) ?></span>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </section>
  <?php elseif ($slug !== ''): ?>
  <section class="related">
    <h2>Edges</h2>
    <p class="copy">None recorded. Absence is a valid observation.</p>
  </section>
  <?php endif; ?>
</main>
<nav id="dock" aria-label="NOW">
  <a href="/now/tree">TREE</a>
  <a href="/join/">JOIN</a>
  <a href="/now/tree#capture">+</a>
  <a href="/jack">JACK</a>
  <a href="/signals/">SIGNALS</a>
  <?= ttg_html_navigator_dock() ?>
  <?= ttg_you_dock(ttg_graph_viewer()) ?>
</nav>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>