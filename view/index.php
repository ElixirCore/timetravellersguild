<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

$payload = ttg_now_payload();
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '{"field":[],"edges":[],"you":{"known":false}}';
}

$local = new DateTimeImmutable('now');
$clock = strtoupper($local->format('H:i:s · l d F Y'));
$localPresent = $local->format('d.m.Y');
$position = (string) ($payload['position'] ?? 'PRE-TRAVEL CIVILISATION');

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
<title>VIEW — timetravellersguild.com</title>
<meta name="description" content="An autonomous orbit of the NOW tree. Deterministic search through the field.">
<meta name="theme-color" content="#f1e4c4">
<link rel="canonical" href="https://timetravellersguild.com/view">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:site_name" content="TIMETRAVELLERSGUILD.COM">
<meta property="og:title" content="VIEW — timetravellersguild.com">
<meta property="og:description" content="An autonomous orbit of the NOW tree. Deterministic search through the field.">
<meta property="og:image" content="https://timetravellersguild.com/assets/og/now.png">
<meta property="og:url" content="https://timetravellersguild.com/view">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909v">
<link rel="stylesheet" href="/assets/view.css?v=260909j">
</head>
<body class="view">
<a class="skip" href="#field-list">Field as a list</a>
<div id="vignette"></div>
<div id="grain"></div>

<header id="mast">
  <div class="site"><a href="/">TIMETRAVELLERSGUILD.COM</a></div>
  <div class="presents">
    <span>LOCAL PRESENT: <time id="localPresent"><?= ttg_h($localPresent) ?></time></span>
    <span>NETWORK PRESENT: 17.04.2033</span>
  </div>
</header>

<section id="here" aria-live="polite">
  <p id="clockLine"><?= ttg_h($clock) ?></p>
  <p id="position">VIEW · <?= ttg_h($position) ?></p>
</section>

<div id="projections" role="tablist" aria-label="Projection" hidden>
  <button type="button" role="tab" data-proj="TEMPORAL" aria-selected="true">TEMPORAL</button>
  <button type="button" role="tab" data-proj="SOCIAL" aria-selected="false">SOCIAL</button>
  <button type="button" role="tab" data-proj="SPATIAL" aria-selected="false">SPATIAL</button>
  <button type="button" role="tab" data-proj="INSTITUTIONAL" aria-selected="false">INSTITUTIONAL</button>
  <button type="button" role="tab" data-proj="SYMBOLIC" aria-selected="false">SYMBOLIC</button>
</div>

<aside id="chrono" aria-hidden="true" hidden>
  <ol id="chronoTicks"></ol>
  <div id="chronoHead"></div>
</aside>

<div id="surf" aria-hidden="true" hidden>
  <button type="button" id="surfPast">PAST</button>
  <p id="surfYear"><strong id="surfYearNum">2026</strong><span id="surfYearNote">LOCAL PRESENT</span></p>
  <button type="button" id="surfFuture">FUTURE</button>
</div>

<section id="viewHud" aria-live="polite">
  <p id="viewMode">SEARCHING</p>
  <p id="viewTitle">The field opens.</p>
  <p id="viewMeta"></p>
  <p id="viewBeat"></p>
</section>

<section id="viewLog" aria-label="Jack’s observations">
  <p class="view-log-head">JACK · TICKERTAPE</p>
  <div id="viewTape" class="view-tape">
    <ol id="viewLogList"></ol>
  </div>
</section>

<aside id="viewContext" aria-hidden="true">
  <p class="view-batch" id="viewBatch">IBM 5081 · VIEW · COL 01–80</p>
  <div class="view-ruler" id="viewRuler"></div>
  <div class="view-belt" id="viewBelt" aria-hidden="true"></div>
  <p class="view-stance" id="viewStance">TEMPORAL</p>
  <p class="view-epithet" id="viewEpithet">Elevation · time upright</p>
  <p class="view-body" id="viewBody">Time stands in the wood. Roots keep what has been observed; the crown leans toward network present.</p>
  <p class="view-sub" id="viewSub">Y12 · X · 0–9 · NOT CANON</p>
</aside>

<p id="viewWake" hidden>
  <a href="/now">ENTER THE TREE</a>
  <button type="button" id="viewResume">RESUME ORBIT</button>
</p>

<section id="field-list">
  <h1 class="sr">VIEW</h1>
  <p class="nogl-only">Without WebGL the orbit lists the field in order.</p>
  <ul id="fallbackList"><?= ttg_now_fallback_html() ?></ul>
</section>

<nav id="dock" aria-label="VIEW">
  <a href="/now">TREE</a>
  <a href="/view" aria-current="page">VIEW</a>
  <a href="/jack">JACK</a>
  <a href="/">HOME</a>
</nav>

<script>window.TTG_MODE='view';window.TTG_GRAPH=<?= $json ?>;</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="/assets/now.js?v=260910b"></script>
<script src="/assets/view.js?v=260909j"></script>
<script src="https://ffilm.org/visitors/visit.js" defer></script>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
