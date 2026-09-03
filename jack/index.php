<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

$payload = ttg_now_payload();
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '{"field":[],"edges":[],"you":{"known":false},"jack":{}}';
}

$local = new DateTimeImmutable('now');
$clock = strtoupper($local->format('H:i:s · l d F Y'));
$localPresent = $local->format('d.m.Y');
$youHref = (string) ($payload['you']['href'] ?? '/people/auth/');
$greeting = (string) ($payload['jack']['greeting'] ?? '');
$csrf = (string) ($payload['csrf'] ?? '');
$voice = !empty($payload['jack']['voice']);
$batch = 'TTG-' . $local->format('ymd') . '-' . strtoupper(substr($csrf !== '' ? $csrf : 'desk', 0, 4));

if ($greeting !== '') {
    ttg_jack_queue_speech($greeting);
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>JACK — timetravellersguild.com</title>
<meta name="description" content="Address the clerk. Punch-card desk, Festival of Britain, 1951.">
<meta name="theme-color" content="#f1e4c4">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=1951j">
<link rel="stylesheet" href="/assets/jack.css?v=1951j">
</head>
<body class="jack-room">
<a class="skip" href="#jackQ">Address the clerk</a>
<div id="vignette"></div>
<div id="grain"></div>

<header id="mast">
  <div class="site">TIMETRAVELLERSGUILD.COM</div>
  <div class="presents">
    <span>LOCAL PRESENT: <time id="localPresent"><?= ttg_h($localPresent) ?></time></span>
    <span>NETWORK PRESENT: 17.04.2033</span>
  </div>
</header>

<section id="here">
  <p id="clockLine"><?= ttg_h($clock) ?></p>
  <p id="position">JACK / CLERK — HOLLERITH DESK · 1951</p>
</section>

<main class="jack-machine" id="desk">
  <div class="jack-hopper" aria-hidden="true">
    <span class="feed-card"></span>
    <span class="feed-card"></span>
    <span class="feed-card"></span>
  </div>

  <article id="jack" class="ibm-card punch-sheet" aria-label="Clerk punch card">
    <header class="ibm-band">
      <span>IBM 5081 · GUILD ISSUE</span>
      <span>BATCH <span id="jackBatch"><?= ttg_h($batch) ?></span></span>
      <span>80 COL</span>
    </header>
    <div class="punch-face" aria-hidden="true">
      <div class="punch-ruler" id="jackRuler"></div>
      <div class="punch-belt" id="jackBelt"></div>
    </div>
    <p class="life-type">JACK / CLERK</p>
    <p id="jackGreeting"><?= ttg_h($greeting) ?></p>
    <div id="jackProcess" class="jack-process" hidden>
      <div class="card-feed" aria-hidden="true">
        <span class="feed-card"></span>
        <span class="feed-card"></span>
        <span class="feed-card"></span>
      </div>
      <p id="jackStage" class="punch-stage" aria-live="polite"></p>
    </div>
    <div id="jackLog"></div>
    <div id="jackOps"></div>

    <form id="jackForm" action="/now/jack" method="post" enctype="multipart/form-data">
      <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
      <label class="sr" for="jackQ">Address the clerk</label>
      <textarea id="jackQ" name="q" rows="3" maxlength="100000" autocomplete="off" placeholder="A question for the clerk…"></textarea>
      <div class="jack-row">
        <label class="file">Dossier file <input id="jackFile" name="dossier" type="file" accept=".txt,.md,.csv,text/plain"></label>
        <div class="jack-actions">
          <button type="button" id="jackTalk" data-idle="Speak">Speak</button>
          <button type="button" id="jackHear" hidden>Hear him</button>
          <button type="submit" name="intent" value="ask">Ask</button>
          <button type="submit" name="intent" value="lodge">Lodge</button>
        </div>
      </div>
      <p class="jack-hint">Enter asks. Shift+Enter is a new line. Lodge only when the tree should hold a dossier as pending leaves.<?= $voice ? ' He will read his reply.' : '' ?></p>
    </form>
    <audio id="jackAudio" hidden></audio>
  </article>
</main>

<nav id="dock" aria-label="Jack">
  <a href="/now">NOW</a>
  <a href="/now#capture">+</a>
  <a href="/jack" id="navJack" aria-current="page">JACK</a>
  <a href="/signals/">SIGNALS</a>
  <a href="<?= ttg_h($youHref) ?>" id="navYou">YOU</a>
</nav>

<script>window.TTG_GRAPH=<?= $json ?>;</script>
<script src="/assets/jack-desk.js?v=1951j"></script>
<script src="/assets/jack.js?v=1951j"></script>
</body>
</html>
