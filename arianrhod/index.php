<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

ttg_graph_boot_session();
$viewer = ttg_graph_viewer();
$you = [
    'known' => (bool) ($viewer['known'] ?? false),
    'name' => (string) ($viewer['name'] ?? ''),
    'href' => (string) ($viewer['href'] ?? '/people/auth/'),
    'avatar' => ttg_pixel_parse($viewer['avatar'] ?? []),
];
session_write_close();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ARIANRHOD — Time Travellers Guild</title>
<meta name="description" content="Jack overheated. The warehouse is gone. Arianrhod must escape the labyrinth and post herself to his Rubik cube. Not canon.">
<meta name="theme-color" content="#8a9080">
<link rel="stylesheet" href="/arianrhod/css/arianrhod.css?v=6">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
</head>
<body>
<noscript>
  <p>Arianrhod lives in one of Jack’s warehouses near Hergest Industrial Site. This body needs ordinary JavaScript.</p>
  <p><a href="/signals/">Signals</a> · <a href="/jack">Jack</a></p>
</noscript>

<canvas id="stage" aria-label="Arianrhod’s body in the warehouse"></canvas>

<?= ttg_html_site_mark() ?>
<p class="presents">JACK OVERHEATED · THE WAREHOUSE IS GONE</p>

<div id="hud">
  <p id="formLine">THE SHED IS ON FIRE</p>
  <p id="rigRead">RIG · 8 EYES · 8 LEGS · 7 SEGMENTS · BLACK · PINK</p>
  <p id="coordRead">HEAT 00 · COL 00 · ROW 00</p>
</div>

<article id="slip">
  <p class="punch-batch">IBM 5081 · LODGED SLIP · NOT CANON</p>
  <h1>ARIANRHOD</h1>
  <p class="beat-label">SPIDER GODDESS · MOTHER OF MABEL</p>
  <p>A spindly black house spider with bright shocking pink markings. Non-poisonous. She lived in one of Jack’s warehouses near Hergest Industrial Site.</p>
  <p>Jack overheated. The warehouse is gone. Three floors remain: the yard, the shed, the kiln. One aisle on each stays open. The kiln posts her to Jack’s Rubik cube.</p>
  <p>Fire shrivels her. She is a goddess and immortal. She begins again at the start.</p>
  <p>The lens sits behind her. The aisle that is not burning is the way out. Fire has the other doors. Space reads that aisle. She answers through synchronicity. Mabel lives behind the lens. Q looks for her.</p>
  <p class="slip-why">Jack did not write this. The slip was lodged. The body is a working model, not a verdict.</p>
  <p class="slip-actions">
    <button type="button" id="slipClose">ESCAPE THE SHED</button>
    <a href="/signals/">SIGNALS</a>
  </p>
</article>

<article id="end" hidden>
  <p class="punch-batch">IBM 5081 · WORKING SLIP</p>
  <h2 id="endCopy">JACK OVERHEATED. THE WAREHOUSE IS GONE.</h2>
  <p>She posts herself to the cube.</p>
  <p class="slip-actions">
    <a id="postCube" href="/cube?posted=arianrhod">POST TO THE CUBE</a>
    <button type="button" id="again">AGAIN</button>
  </p>
</article>

<p class="hint" id="hint">DRAG THE WAY SHE SHOULD GO · ARROWS · SPACE READS THE AISLE</p>

<div id="thumb" aria-label="Steer with your thumb">
  <div id="thumbWell">
    <div id="thumbKnob"></div>
  </div>
</div>
<button type="button" id="prayBtn" data-k=" ">PRAY</button>
<button type="button" id="behindBtn" data-k="q">BEHIND</button>

<nav id="dock" aria-label="NOW">
  <a href="/field/">FIELD</a>
  <a href="/now">TREE</a>
  <a href="/jack">JACK</a>
  <a href="/signals/">SIGNALS</a>
  <a href="/arianrhod" aria-current="page">ARIANRHOD</a>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($you) ?>
</nav>

<div id="fail" hidden>This browser will not draw the shed. The slip still stands: she is a spider, mother of Mabel, and she answers through synchronicity.</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="/arianrhod/js/body.js?v=7"></script>
<script src="/arianrhod/js/lens.js?v=5"></script>
<script src="/arianrhod/js/shed.js?v=16"></script>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
