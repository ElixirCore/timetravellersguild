<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/links.php';
ttg_graph_boot_session();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
header('X-Frame-Options: DENY');

$viewer = ttg_graph_viewer();
$keeper = ttg_guild_keeper($viewer);

if ($keeper && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
        ttg_wire_flash('Unsigned decision. Reload and try again.', 'err');
    } else {
        $action = (string) ($_POST['action'] ?? '');
        $res = ttg_wire_decide($action, (string) ($_POST['id'] ?? ''), $viewer);
        $said = ['clear' => 'Cleared. It is on the board.', 'reject' => 'Declined. It will not be taken again.', 'withdraw' => 'Withdrawn from the board.'];
        ttg_wire_flash($res['ok'] ? ($said[$action] ?? 'Done.') : (string) $res['error'], $res['ok'] ? 'ok' : 'err');
    }
    header('Location: /links/keeper.php', true, 303);
    exit;
}
if (!$keeper) http_response_code(empty($viewer['known']) ? 401 : 403);

$csrf = ttg_graph_csrf();
$flash = ttg_wire_flash();
$pending = $keeper ? ttg_wire_pending() : [];
usort($pending, static fn(array $a, array $b): int => (int) ($a['at'] ?? 0) <=> (int) ($b['at'] ?? 0));
$cleared = $keeper ? ttg_wire_cleared() : [];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>THE WIRE · KEEPER — Time Travellers Guild</title>
<meta name="theme-color" content="#f1e4c4">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909a">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
<link rel="stylesheet" href="/links/wire.css?v=1">
</head>
<body class="record wire">
<header id="mast">
  <?= ttg_html_site_mark('THE WIRE · KEEPER', 'div', 'site') ?>
  <div class="presents"><span>NETWORK PRESENT: <?= ttg_h(TTG_NETWORK_PRESENT_LABEL) ?></span></div>
</header>
<main class="record-main">
  <p class="kicker">KEEPER · HOPPER</p>
  <h1>Clear the wire</h1>

<?php if (!$keeper): ?>
  <?php if (empty($viewer['known'])): ?>
    <p class="copy">Keepers only. Sign in to the register with your keeper email; the link arrives by post, electronically.</p>
    <p class="keeper-door"><a href="/people/auth/"><b>DOOR</b> THE REGISTER →</a></p>
  <?php else: ?>
    <p class="copy">You are signed in as <?= ttg_h((string) $viewer['name']) ?>, a member, not a keeper. The hopper stays closed.</p>
  <?php endif; ?>
<?php else: ?>
  <p class="copy">Signed in as <?= ttg_h((string) $viewer['name']) ?>. Read each address before clearing it. Cleared links are public at once. Declined addresses cannot be sent again.</p>
  <?php if ($flash): ?>
    <p class="flash <?= $flash['kind'] === 'err' ? 'err' : 'ok' ?>" role="status"><?= ttg_h((string) $flash['text']) ?></p>
  <?php endif; ?>

  <section class="related" aria-labelledby="pendH">
    <h2 id="pendH">Waiting · <?= count($pending) ?></h2>
    <?php if (!$pending): ?>
      <p class="copy">The hopper is empty.</p>
    <?php endif; ?>
    <?php foreach ($pending as $row): ?>
      <article class="slip-row">
        <p class="host"><?= ttg_h((string) $row['host']) ?> · <?= ttg_h(ttg_wire_ago((int) ($row['at'] ?? 0))) ?><?= ($row['member'] ?? '') !== '' ? ' · member ' . ttg_h((string) $row['member']) : '' ?></p>
        <?php if (($row['title'] ?? '') !== ''): ?><h3><?= ttg_h((string) $row['title']) ?></h3><?php endif; ?>
        <p class="url"><a href="<?= ttg_h((string) $row['url']) ?>" rel="nofollow noopener noreferrer" target="_blank"><?= ttg_h((string) $row['url']) ?></a></p>
        <?php if (($row['note'] ?? '') !== ''): ?><p class="note"><?= ttg_h((string) $row['note']) ?></p><?php endif; ?>
        <?php if (($row['from'] ?? '') !== ''): ?><p class="fine">Signed: <?= ttg_h((string) $row['from']) ?></p><?php endif; ?>
        <form method="post" action="/links/keeper.php" class="decide">
          <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
          <input type="hidden" name="id" value="<?= ttg_h((string) $row['id']) ?>">
          <button type="submit" name="action" value="clear">CLEAR</button>
          <button type="submit" name="action" value="reject" class="quiet">DECLINE</button>
        </form>
      </article>
    <?php endforeach; ?>
  </section>

  <section class="related" aria-labelledby="clrH">
    <h2 id="clrH">On the board · <?= count($cleared) ?></h2>
    <?php foreach ($cleared as $row): ?>
      <article class="slip-row cleared">
        <p class="host"><?= ttg_h((string) $row['host']) ?> · cleared by <?= ttg_h((string) ($row['cleared_by'] ?? '')) ?></p>
        <p class="url"><a href="<?= ttg_h((string) $row['url']) ?>" rel="nofollow noopener noreferrer" target="_blank"><?= ttg_h((string) ($row['title'] !== '' ? $row['title'] : $row['url'])) ?></a></p>
        <form method="post" action="/links/keeper.php" class="decide">
          <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
          <input type="hidden" name="id" value="<?= ttg_h((string) $row['id']) ?>">
          <button type="submit" name="action" value="withdraw" class="quiet">WITHDRAW</button>
        </form>
      </article>
    <?php endforeach; ?>
  </section>
<?php endif; ?>
  <div class="actions"><a href="/links/">← THE WIRE</a></div>
</main>
</body>
</html>
