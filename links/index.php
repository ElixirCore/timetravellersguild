<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/links.php';
ttg_graph_boot_session();
$csrf = ttg_graph_csrf();
$stamp = ttg_wire_form_stamp();
$viewer = ttg_graph_viewer();
$keeper = ttg_guild_keeper($viewer);
$flash = ttg_wire_flash();
$cleared = ttg_wire_cleared();
$waiting = $keeper ? count(ttg_wire_pending()) : 0;
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>THE WIRE — Time Travellers Guild</title>
<meta name="description" content="Links transmitted by travellers. Nothing goes on the board until a keeper clears it.">
<meta name="theme-color" content="#f1e4c4">
<link rel="canonical" href="https://timetravellersguild.com/links/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909a">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
<link rel="stylesheet" href="/links/wire.css?v=1">
</head>
<body class="record wire">
<header id="mast">
  <?= ttg_html_site_mark('THE WIRE', 'div', 'site') ?>
  <div class="presents">
    <span>LOCAL PRESENT: <time><?= ttg_h((new DateTimeImmutable('now'))->format('d.m.Y')) ?></time></span>
    <span>NETWORK PRESENT: <?= ttg_h(TTG_NETWORK_PRESENT_LABEL) ?></span>
  </div>
</header>
<main class="record-main">
  <p class="kicker">SIGNAL · TRANSMISSIONS</p>
  <h1>The wire</h1>
  <p class="copy">Send the Guild a link. It goes into the hopper, not onto the board. A keeper reads every slip and clears the ones that belong. Nothing you send is public until then.</p>

  <?php if ($flash): ?>
    <p class="flash <?= $flash['kind'] === 'err' ? 'err' : 'ok' ?>" role="status"><?= ttg_h((string) $flash['text']) ?></p>
  <?php endif; ?>

  <?php if ($keeper): ?>
    <p class="keeper-door"><a href="/links/keeper.php"><b>KEEPER</b> <?= (int) $waiting ?> waiting in the hopper →</a></p>
  <?php endif; ?>

  <form class="slip-form" method="post" action="/links/act.php" autocomplete="off">
    <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
    <input type="hidden" name="stamp" value="<?= ttg_h($stamp) ?>">
    <p class="hp" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label></p>
    <label for="wUrl">Address <span>required</span></label>
    <input id="wUrl" name="url" type="url" inputmode="url" required maxlength="2048" placeholder="https://" spellcheck="false">
    <label for="wTitle">What it is <span>optional</span></label>
    <input id="wTitle" name="title" type="text" maxlength="100">
    <label for="wNote">Why the Guild should hold it <span>optional · 280</span></label>
    <textarea id="wNote" name="note" maxlength="280" rows="3"></textarea>
    <label for="wFrom">Signed <span>optional</span></label>
    <input id="wFrom" name="from" type="text" maxlength="60" value="<?= ttg_h((string) ($viewer['first'] ?? '')) ?>">
    <button type="submit">TRANSMIT</button>
    <p class="fine">One address per slip. Web addresses only. Tracking tags are stripped. The Guild does not open what you send until a keeper does.</p>
  </form>

  <section class="related board" aria-labelledby="boardH">
    <h2 id="boardH">Cleared · <?= count($cleared) ?></h2>
    <?php if (!$cleared): ?>
      <p class="copy">Nothing cleared yet. An empty board is a valid observation.</p>
    <?php else: ?>
      <ul>
        <?php foreach ($cleared as $row): ?>
          <li>
            <a href="<?= ttg_h((string) $row['url']) ?>" rel="nofollow ugc noopener noreferrer" target="_blank">
              <span class="n"><?= ttg_h((string) ($row['title'] !== '' ? $row['title'] : $row['host'])) ?></span>
              <span class="p"><?= ttg_h((string) $row['host']) ?><?= ($row['from'] ?? '') !== '' ? ' · ' . ttg_h((string) $row['from']) : '' ?></span>
            </a>
            <?php if (($row['note'] ?? '') !== ''): ?><p class="note"><?= ttg_h((string) $row['note']) ?></p><?php endif; ?>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </section>
</main>
<nav id="dock" aria-label="NOW">
  <a href="/now/tree">TREE</a>
  <a href="/signals/">SIGNALS</a>
  <a href="/links/" aria-current="page">WIRE</a>
  <a href="/jack">JACK</a>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($viewer) ?>
</nav>
</body>
</html>
