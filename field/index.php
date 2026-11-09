<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
ttg_graph_boot_session();
$payload = ttg_now_payload();
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '{"field":[],"edges":[],"you":{"known":false},"csrf":"","jack":{}}';
}
$you = $payload['you'] ?? [];
$greeting = (string) (($payload['jack']['greeting'] ?? '') ?: 'The field is open. Tell me what entered.');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>THE FIELD — Time Travellers Guild</title>
<meta name="description" content="Five projections of one field. Tell Jack your story. He lodges. He does not write canon.">
<meta name="theme-color" content="#d9cb9e">
<link rel="stylesheet" href="/assets/field.css">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
</head>
<body>
<noscript>
  <p>The field is five projections of one record. Without JavaScript, speak is closed. The list remains.</p>
  <p><a href="/n/">The list</a> · <a href="/jack">The desk</a> · <a href="/join/">Join</a></p>
  <ul>
    <?php foreach (($payload['field'] ?? []) as $n): ?>
      <li><?= ttg_h((string) ($n['title'] ?? '')) ?> — <?= ttg_h((string) ($n['type'] ?? '')) ?></li>
    <?php endforeach; ?>
  </ul>
</noscript>

<?= ttg_html_site_mark() ?>
<p class="presents">FIELD · 5 PROJECTIONS · NOT CANON</p>

<canvas id="field" aria-label="The five-dimensional field, projected"></canvas>

<aside id="hud">
  <p id="jackForm">THE FIELD IS OPEN</p>
  <canvas id="jackPet" width="96" height="96" aria-label="Jack, clerk of the field"></canvas>
  <p class="axis-read" id="axisRead">YOU ARE HERE</p>
</aside>

<article id="slip" hidden>
  <p class="beat-label" id="slipAxis"></p>
  <p class="slip-title" id="slipTitle"></p>
  <p class="slip-meta" id="slipMeta"></p>
  <p class="beat-text" id="slipBody"></p>
  <p class="slip-actions">
    <a id="slipOpen" href="/n/">THE RECORD</a>
    <button type="button" id="slipClose">CLOSE</button>
  </p>
</article>

<section id="talk" aria-label="Tell Jack your story">
  <p class="beat-label">IBM 5081 · FIELD SLIP</p>
  <p id="jackLine" class="jack-line"><?= ttg_h($greeting) ?></p>
  <div id="log" aria-live="polite"></div>
  <label class="sr" for="story">Your story</label>
  <textarea id="story" name="q" rows="3" maxlength="4000" placeholder="Hold TALK, or type what entered the field."></textarea>
  <p class="talk-row">
    <button type="button" id="talkBtn">HOLD TO TALK</button>
    <button type="button" id="askBtn">ASK JACK</button>
    <button type="button" id="lodgeBtn">HOLD THE STORY</button>
  </p>
  <p class="status" id="status" role="status">The clerk will hear a story. He does not write canon.</p>
</section>

<p class="doors">
  <a class="door" href="/join/"><b>DOOR</b> THE PROGRAMME</a>
  <a class="door" href="/now"><b>DOOR</b> THE TREE</a>
  <?= ttg_html_navigator_door($you) ?>
  <a class="door" href="/jack"><b>DOOR</b> THE DESK</a>
</p>

<nav id="dock" aria-label="NOW">
  <a href="/field/" aria-current="page">FIELD</a>
  <a href="/now">TREE</a>
  <a href="/join/">JOIN</a>
  <a href="/jack">JACK</a>
  <a href="/signals/">SIGNALS</a>
  <?= ttg_html_navigator_dock($you) ?>
  <?= ttg_you_dock($you) ?>
</nav>

<script>window.TTG_FIELD=<?= $json ?>;</script>
<script src="/jack/body/js/sprite.js"></script>
<script src="/assets/field.js"></script>
</body>
</html>
