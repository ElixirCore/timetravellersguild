<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/inc/graph.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackTarot.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackTarotDeck.php';
ttg_graph_boot_session();
$csrf = ttg_graph_csrf();
$dossiers = json_encode(JackTarot::dossierMap(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($dossiers === false) $dossiers = '{}';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>JACK / PUNCHCARD TAROT — timetravellersguild.com</title>
<meta name="theme-color" content="#d9cb9e">
<meta name="description" content="Jack’s punchcard tarot. Hold a question. Punch the hopper. Inspect each slip.">
<link rel="stylesheet" href="css/tarot.css?v=talk1">
<script src="/assets/jack-line.js?v=3"></script>
</head>
<body>
<noscript>
  <p>The hopper needs ordinary JavaScript. The slips will not fall without it.</p>
</noscript>
<?php readfile(__DIR__ . '/svg/deck.svg'); ?>

<?= ttg_html_site_mark() ?>

<div id="app" data-module="jack-tarot" data-cube="pending">
  <header>
    <p class="guild">JACK · CLERK · PUNCHCARD TAROT</p>
    <h1>PUNCHCARD TAROT</h1>
    <p class="rule">Hold a question. Punch the hopper. Tap a slip. Working slip. Not canon.</p>
  </header>

  <div id="dealer">
    <canvas id="jackPet" width="96" height="96" aria-label="Jack dealing the hopper"></canvas>
    <div class="dealer-who">
      <p class="dealer-name">JACK</p>
      <p id="jackForm">AT THE HOPPER</p>
    </div>
  </div>

  <div id="controls">
    <div class="question-wrap">
      <label class="label" for="question">What are you holding?</label>
      <textarea id="question" rows="3" maxlength="2000" placeholder="A decision, a person, a place, a thing you cannot file… or leave the hopper open."></textarea>
    </div>
    <div>
      <p class="label">How many holes</p>
      <div class="spread-buttons" id="spread-buttons"></div>
    </div>
    <button type="button" id="draw-btn">PUNCH THE HOPPER</button>
    <p class="small-note">Jack reads the slips against what you held. Tap a card to inspect it.</p>
  </div>

  <div id="reading-area" hidden>
    <p id="question-echo" class="question-echo" hidden></p>
    <p class="inspect-hint">Tap a slip to inspect it.</p>
    <div id="cards-grid"></div>
    <p id="hopper-loading" hidden>JACK IS READING THE HOPPER<span class="dots"></span></p>
    <div id="reading-text" hidden></div>
    <div id="reading-actions" hidden>
      <button type="button" id="copy-btn" class="action-btn">COPY SLIP</button>
      <button type="button" id="talk-btn" class="action-btn talk-btn" aria-pressed="false">HEAR JACK READ IT</button>
      <button type="button" id="new-reading-btn" class="action-btn">NEW HOPPER</button>
    </div>
    <p id="talk-status" class="talk-status" aria-live="polite"></p>
  </div>
</div>

<dialog id="inspect" class="inspect">
  <form method="dialog" class="inspect-inner">
    <p class="inspect-kicker" id="inspect-kicker">SLIP</p>
    <div class="inspect-grid">
      <div id="inspect-card" class="inspect-card"></div>
      <div class="inspect-copy">
        <p class="inspect-station" id="inspect-station"></p>
        <h2 id="inspect-title"></h2>
        <p class="inspect-meta" id="inspect-meta"></p>
        <p id="inspect-blurb"></p>
        <p id="inspect-lean"></p>
        <p id="inspect-sense"></p>
      </div>
    </div>
    <div class="inspect-nav">
      <a id="inspect-catalog" class="inspect-link" href="/deck/">Catalogue</a>
      <button type="submit" class="action-btn" value="close">CLOSE SLIP</button>
    </div>
  </form>
</dialog>

<nav class="doors" aria-label="Doors">
  <a class="door" href="/now"><b>NOW</b> THE TREE</a>
  <a class="door" href="/deck/"><b>DOOR</b> THE CATALOGUE</a>
  <a class="door" href="/jack/"><b>DOOR</b> DESK</a>
  <a class="door" href="/jack/room/engine/"><b>DOOR</b> ENGINE</a>
</nav>

<script>
window.TTG_TAROT_CSRF=<?= json_encode($csrf, JSON_UNESCAPED_SLASHES) ?>;
window.TTG_TAROT_DOSSIERS=<?= $dossiers ?>;
</script>
<script src="/jack/body/js/sprite.js"></script>
<script src="js/tarot.js?v=desk2"></script>
<script src="https://unpkg.com/@elevenlabs/client@1.28.0/dist/lib.iife.js"></script>
<script src="js/talk.js?v=talk1"></script>
</body>
</html>
