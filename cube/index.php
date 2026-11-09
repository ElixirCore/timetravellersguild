<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

ttg_graph_boot_session();
$csrf = ttg_graph_csrf();
$play = ttg_play_public(ttg_play_read());
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover" />
<title>JACK / CUBE</title>
<meta name="description" content="Jack has slightly broken geometry. Restore the cube, one lesson at a time." />
<meta name="theme-color" content="#d9cb9e" />
<link rel="stylesheet" href="/cube/css/cube.css?v=11" />
</head>
<body>

<noscript>
  <p>Jack broke the cube. This lesson needs ordinary JavaScript.</p>
  <p><a href="/jack">Jack</a> · <a href="/now">NOW</a></p>
</noscript>

<div id="grain" aria-hidden="true"></div>
<?= ttg_html_site_mark('CUBE') ?>

<div id="hud">
  <div class="badge" id="roundBadge">LESSON 01</div>
  <div class="badge" id="moveBadge">1 TWIST</div>
  <a class="badge" href="/">HOME</a>
  <a class="badge" href="/now">NOW</a>
  <a class="badge" href="/jack">JACK</a>
  <a class="badge" href="/arianrhod">ARIANRHOD</a>
</div>
<p id="mabelPsychic" hidden></p>

<div id="jackLayer">
  <div id="jack">
    <div class="jackCard">
      <div class="jackFace">
        <div class="eye left"></div>
        <div class="eye right"></div>
        <div class="mouth"></div>
      </div>

      <div class="holeRow">
        <div class="hole"></div>
        <div class="hole"></div>
        <div class="hole"></div>
        <div class="hole"></div>
        <div class="hole"></div>
        <div class="hole"></div>
        <div class="hole"></div>
        <div class="hole"></div>
        <div class="hole"></div>
      </div>
    </div>
  </div>

  <div id="speech">
    Initialising clerk.
  </div>
</div>

<div id="board">
<div id="controls">

  <div class="row three" id="axisRow">
    <button id="axisX" type="button">X</button>
    <button id="axisY" type="button" class="on">Y</button>
    <button id="axisZ" type="button">Z</button>
  </div>

  <div class="row two">
    <button id="sliceDown" type="button">SLICE −</button>
    <button id="sliceUp" type="button">SLICE +</button>
  </div>

  <div class="row two">
    <button id="turnCCW" type="button">⟲ TURN</button>
    <button id="turnCW" type="button">TURN ⟳</button>
  </div>

  <button id="nextBtn" type="button">NEXT LESSON</button>
</div>

<div id="chatDock">

  <div id="chatLog"></div>

  <form id="chatForm">
    <input
      id="chatInput"
      type="text"
      autocomplete="off"
      autocapitalize="sentences"
      placeholder="Talk to Jack…"
    />
    <button id="sendBtn" type="submit">↵</button>
  </form>

</div>
</div>

<div id="err"></div>

<script>window.TTG_CUBE=<?= json_encode(['csrf' => $csrf, 'jack' => '/now/jack', 'playAct' => '/play/act', 'play' => $play], JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/controls/OrbitControls.js"></script>
<script src="/arianrhod/js/body.js?v=3"></script>
<script src="/cube/js/cube.js?v=10"></script>
</body>
</html>
