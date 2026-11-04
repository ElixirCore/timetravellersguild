<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

ttg_graph_boot_session();
$viewer = ttg_graph_viewer();
$personEdges = ttg_graph_person_edge_set($viewer);
$nodes = [];
foreach (ttg_graph_unique_nodes() as $node) {
    if (!ttg_graph_public($node)) continue;
    $nodes[] = ttg_graph_project_node($node, $viewer, $personEdges);
}
$have = [];
foreach ($nodes as $n) {
    $slug = (string) ($n['slug'] ?? '');
    if ($slug !== '') $have[$slug] = true;
}
$edges = [];
foreach (ttg_graph_all_edges() as $edge) {
    $s = (string) ($edge['source'] ?? '');
    $t = (string) ($edge['target'] ?? '');
    if ($s === '' || $t === '' || !isset($have[$s]) || !isset($have[$t])) continue;
    $edges[] = [
        'source' => $s,
        'target' => $t,
        'relationship' => (string) ($edge['relationship'] ?? 'POSSIBLY_RELATED_TO'),
        'confidence' => isset($edge['confidence']) ? (float) $edge['confidence'] : null,
    ];
}
$payload = [
    'csrf' => ttg_graph_csrf(),
    'coord' => 'S-88.13',
    'you' => [
        'known' => (bool) ($viewer['known'] ?? false),
        'name' => (string) ($viewer['name'] ?? ''),
        'href' => (string) ($viewer['href'] ?? '/people/auth/'),
        'avatar' => ttg_pixel_parse($viewer['avatar'] ?? []),
    ],
    'nodes' => $nodes,
    'edges' => $edges,
];
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '{"nodes":[],"edges":[],"you":{"known":false},"csrf":"","coord":"S-88.13"}';
}
session_write_close();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>SIGNALS — Time Travellers Guild</title>
<meta name="description" content="Audio fragments, coded broadcasts, public notices, machine outputs and transmissions without an agreed sender. A punchcard plane. Not canon.">
<meta name="theme-color" content="#f2d322">
<link rel="stylesheet" href="/signals/css/signals.css?v=3">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
</head>
<body class="booting">
<noscript>
  <p>SIGNALS is a punchcard plane of the public record. Without JavaScript the list remains.</p>
  <p><a href="/n/">The list</a> · <a href="/now">The tree</a> · <a href="/jack">The desk</a></p>
  <ul>
    <?php foreach ($nodes as $n): ?>
      <li><a href="<?= ttg_h((string) ($n['href'] ?? '/n/')) ?>"><?= ttg_h((string) ($n['title'] ?? '')) ?></a> — <?= ttg_h((string) ($n['type'] ?? '')) ?></li>
    <?php endforeach; ?>
  </ul>
</noscript>

<div id="titleFlash" aria-hidden="true">
  <canvas id="titleCard" width="800" height="352" aria-label="IBM 5081 title card, punching SIGNALS"></canvas>
  <p class="title-skip">IBM 5081 · TAP TO ENTER THE PLANE</p>
</div>

<?= ttg_html_site_mark() ?>
<p class="presents">SIGNALS · IBM 5081 · NOT CANON</p>

<div id="hud">
  <a href="/arianrhod" id="arianrhodDoor" title="Arianrhod">
    <canvas id="arianrhod" width="96" height="96" aria-label="Arianrhod, the spider of the signals plane"></canvas>
  </a>
  <div class="hud-copy">
    <p id="jackForm">ARIANRHOD IS LISTENING</p>
    <p id="coordRead">S-88.13 · COL 000 · ROW 000</p>
    <label class="sr" for="find">Find a slip</label>
    <input id="find" type="search" maxlength="80" placeholder="FIND A SLIP" autocomplete="off" spellcheck="false">
  </div>
</div>

<div id="viewport" aria-label="Punchcard plane of the public record">
  <svg id="threads" aria-hidden="true"></svg>
  <div id="plane"></div>
</div>

<article id="slip" hidden>
  <div class="punch-face">
    <span class="punch-clip" aria-hidden="true"></span>
    <p class="punch-batch" id="slipBatch">IBM 5081 · 80 COL</p>
    <div class="punch-ruler" id="slipRuler" aria-hidden="true"></div>
    <canvas id="slipBelt" width="640" height="72" aria-hidden="true"></canvas>
  </div>
  <p class="beat-label" id="slipAxis"></p>
  <h2 id="slipTitle"></h2>
  <p class="slip-meta" id="slipMeta"></p>
  <p class="beat-text" id="slipBody"></p>
  <p class="slip-why" id="slipWhy"></p>
  <ul class="slip-near" id="slipNear"></ul>
  <p class="slip-actions">
    <a id="slipOpen" href="/n/">THE RECORD</a>
    <button type="button" id="slipClose">CLOSE</button>
  </p>
</article>

<p class="hint">DRAG · WASD · TILED BY CONTEXT · WORKING SLIPS · NOT CANON</p>

<nav id="dock" aria-label="NOW">
  <a href="/field/">FIELD</a>
  <a href="/now">TREE</a>
  <a href="/join/">JOIN</a>
  <a href="/jack">JACK</a>
  <a href="/signals/" aria-current="page">SIGNALS</a>
  <a href="/arianrhod">ARIANRHOD</a>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($payload['you'] ?? ['href' => '/people/auth/']) ?>
</nav>

<script>window.TTG_SIGNALS=<?= $json ?>;</script>
<script src="/signals/js/arianrhod.js?v=3"></script>
<script src="/signals/js/signals.js?v=3"></script>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
