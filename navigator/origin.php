<?php
declare(strict_types=1);

/* Origin reader for the navigator: a keeper-only page that shows a record's
   full stored body and, when one was retained, the dossier text it came from.
   Private inbox sources stay keeper-only. Nothing here writes to the store. */

require_once dirname(__DIR__) . '/inc/graph.php';
ttg_graph_boot_session();
if (!ttg_guild_keeper()) {
    header('Location: /now', true, 302);
    exit;
}

$slug = trim((string) ($_GET['slug'] ?? ''));
$node = null;
if ($slug !== '' && strlen($slug) <= 160 && preg_match('/^[A-Za-z0-9._-]+$/', $slug) === 1) {
    $node = ttg_graph_node($slug);
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$title = is_array($node) ? trim((string) ($node['title'] ?? '')) : '';
$body = is_array($node) ? trim((string) ($node['body'] ?? '')) : '';
$srcId = is_array($node) ? ttg_graph_meta($node, 'source_id') : '';
$srcText = '';
if ($srcId !== '' && preg_match('/^[A-Za-z0-9_-]{1,64}$/', $srcId) === 1) {
    $path = ttg_graph_root() . '/inbox/' . $srcId . '.txt';
    if (is_file($path)) {
        $raw = @file_get_contents($path);
        if (is_string($raw)) $srcText = $raw;
    }
}
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ORIGIN — <?= ttg_h($title !== '' ? $title : 'Navigator') ?></title>
<meta name="robots" content="noindex">
<style>
body{background:#d9cb9e;color:#161814;font-family:'Courier New',Courier,monospace;margin:0 auto;padding:24px;max-width:720px}
a{color:#1e3a5f}
h1{font-size:16px;letter-spacing:.12em;text-transform:uppercase;color:#1e3a5f;margin:16px 0 4px}
h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7b8070;margin:24px 0 8px}
pre{white-space:pre-wrap;word-break:break-word;background:#cfc19a;border:2px solid #1e3a5f;padding:12px;font-size:14px;line-height:1.5;margin:0}
.note{color:#7b8070;font-size:13px}
</style>
</head>
<body>
<p><a href="/navigator">&larr; BACK TO THE NAVIGATOR</a></p>
<?php if (!is_array($node)): ?>
  <h1>No record under that slug</h1>
  <p class="note">The clerk found nothing filed as <?= ttg_h($slug !== '' ? $slug : '(blank)') ?>.</p>
<?php else: ?>
  <h1><?= ttg_h($title !== '' ? $title : 'Untitled') ?></h1>
  <p class="note"><?= ttg_h($slug) ?><?= !empty($node['pending']) ? ' &middot; PENDING' : '' ?></p>
  <?php if ($body !== ''): ?>
    <h2>The full stored body</h2>
    <pre><?= ttg_h($body) ?></pre>
  <?php endif; ?>
  <?php if ($srcText !== ''): ?>
    <h2>Retained origin text &middot; <?= ttg_h($srcId) ?></h2>
    <pre><?= ttg_h($srcText) ?></pre>
  <?php elseif ($srcId !== ''): ?>
    <p class="note">An origin was recorded (<?= ttg_h($srcId) ?>) but its text was not retained.</p>
  <?php endif; ?>
  <?php if ($body === '' && $srcText === ''): ?>
    <p class="note">Nothing further is stored for this record.</p>
  <?php endif; ?>
<?php endif; ?>
</body>
</html>
