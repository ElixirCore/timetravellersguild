<?php
declare(strict_types=1);
/**
 * /ad — five-axis dimensional film.
 * 0 → x → y → z → t → YOU. Hands off to /now/tree.
 */
require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/inc/track.php';

$payload = ttg_now_payload();
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '{"field":[],"edges":[],"you":{"known":false}}';
}

$pageTitle = 'AD — Five dimensions — The Time Travellers Guild';
$desc = 'Point, line, square, space, time, you. Thirty seconds of orthogonal geometry that boots the Guild field.';
$canonical = 'https://timetravellersguild.com/ad';
$v = '260910a';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= htmlspecialchars($pageTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></title>
<meta name="description" content="<?= htmlspecialchars($desc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?>">
<meta name="theme-color" content="#f1e4c4">
<link rel="canonical" href="<?= htmlspecialchars($canonical, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?>">
<?= ttg_og_head(['title' => $pageTitle, 'description' => $desc, 'url' => $canonical]) ?>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/ad/assets/ad.css?v=<?= htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?>">
</head>
<body>
<a class="skip-link" href="#enter">Skip to the tree</a>
<div id="stage" aria-hidden="true"></div>
<div id="grain" aria-hidden="true"></div>
<div id="vignette" aria-hidden="true"></div>

<header id="mast" class="hud">
  <div class="site"><a href="/">TIMETRAVELLERSGUILD.COM</a></div>
  <p class="kicker">INSTRUMENT · AD</p>
</header>

<section id="caption" class="hud" aria-live="polite">
  <p id="cap-ortho" hidden>ORTHOGONAL</p>
  <h1 id="cap-title">ZERO — THE POINT</h1>
  <p id="cap-axis">0</p>
</section>

<aside id="legend" class="hud" aria-label="Axes online">
  <ol id="legend-list">
    <li data-axis="x" hidden><b>x</b><span>LINE</span></li>
    <li data-axis="y" hidden><b>y</b><span>SQUARE</span></li>
    <li data-axis="z" hidden><b>z</b><span>SPACE</span></li>
    <li data-axis="t" hidden><b>t</b><span>TIME</span></li>
    <li data-axis="you" hidden><b>you</b><span>YOU</span></li>
  </ol>
</aside>

<p id="year" class="hud" hidden aria-live="polite"></p>
<p id="tape" class="hud" hidden aria-live="off"></p>

<section id="finale" class="hud" hidden>
  <p id="fin-dims">5 DIMENSIONS ONLINE</p>
  <p id="fin-here">YOU ARE HERE</p>
  <a id="enter" href="/now/tree">ENTER THE TREE</a>
</section>

<button type="button" id="skip" class="hud">SKIP</button>

<noscript>
  <main class="noscript">
    <h1>Five dimensions</h1>
    <p>ZERO — THE POINT. 1D — THE LINE — x. 2D — THE SQUARE — y. 3D — THE SPACE — z. 4D — THE TIME — t. 5D — THE YOU.</p>
    <p><a href="/now/tree">Enter the tree</a></p>
  </main>
</noscript>

<script>window.TTG_GRAPH=<?= $json ?>;</script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
<script src="/ad/assets/ad.js?v=<?= htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?>"></script>
<?= ttg_html_visit_tracker() ?>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
