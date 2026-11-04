<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/JackOffice/autoload.php';

OfficeAuth::requireOffice();
$store = new OfficeStore();
$store->boot();
$events = OfficeLedger::recent($store->root(), 80);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JACK / LEDGER — timetravellersguild.com</title>
<meta name="theme-color" content="#f1e4c4">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909a">
<link rel="stylesheet" href="/assets/jack.css?v=1951o">
<style>
.ledger{max-width:46rem;margin:0 auto;padding:.6rem 1rem 7rem}
.ledger ol{list-style:none;margin:0;padding:0}
.ledger li{margin:0 0 1rem;padding-bottom:.8rem;border-bottom:1px solid var(--rule)}
.ledger .when{font-family:var(--label);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--scarlet)}
</style>
</head>
<body class="jack-room">
<div id="vignette"></div><div id="grain"></div>
<header id="mast">
  <?= ttg_html_site_mark('', 'div', 'site') ?>
  <div class="presents"><span>JACK / LEDGER</span><span>APPEND-ONLY</span></div>
</header>
<main class="ledger">
  <article class="ibm-card punch-sheet">
    <header class="ibm-band"><span>LEDGER</span><span>HUMAN READABLE</span><span>NO SECRETS</span></header>
    <p>Jack may read this bound. He cannot alter past entries.</p>
    <ol>
      <?php if ($events === []): ?>
        <li>The ledger is empty. The office has not yet acted.</li>
      <?php endif; ?>
      <?php foreach ($events as $e): ?>
        <li>
          <p class="when"><?= ttg_h((string) ($e['server_timestamp'] ?? '')) ?> · <?= ttg_h((string) ($e['actor'] ?? '')) ?></p>
          <p><strong><?= ttg_h((string) ($e['action'] ?? '')) ?></strong> — <?= ttg_h((string) ($e['result'] ?? '')) ?></p>
          <p><?= ttg_h((string) ($e['request_summary'] ?? '')) ?></p>
          <p>Validation: <?= ttg_h((string) ($e['validation_result'] ?? '')) ?> · Approval: <?= ttg_h((string) ($e['approval_state'] ?? '')) ?></p>
        </li>
      <?php endforeach; ?>
    </ol>
  </article>
</main>
<nav id="dock">
  <a href="/jack">JACK</a>
  <a href="/jack/room">ROOM</a>
  <a href="/jack/room/engine/">ENGINE</a>
  <a href="/jack/office">OFFICE</a>
  <a href="/jack/ledger" aria-current="page">LEDGER</a>
  <a href="/now">NOW</a>
</nav>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
