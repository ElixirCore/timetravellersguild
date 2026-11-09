<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

$payload = ttg_now_payload();
// The public tour shows canon only: no pending slips, working slips or lens beads, and no edges to them.
$tourSlugs = [];
$payload['field'] = array_values(array_filter((array) ($payload['field'] ?? []), static function ($n) use (&$tourSlugs): bool {
    if (!is_array($n) || empty($n['slug'])) return false;
    if (!empty($n['pending']) || !empty($n['play']) || !empty($n['lens'])) return false;
    $tourSlugs[(string) $n['slug']] = true;
    return true;
}));
$payload['edges'] = array_values(array_filter((array) ($payload['edges'] ?? []), static function ($e) use ($tourSlugs): bool {
    return is_array($e) && isset($tourSlugs[(string) ($e['source'] ?? '')], $tourSlugs[(string) ($e['target'] ?? '')]);
}));
$canonSlugs = [];
foreach (ttg_graph_unique_nodes() as $cn) {
    if (!empty($cn['slug']) && ttg_graph_public($cn)) $canonSlugs[(string) $cn['slug']] = true;
}
foreach (ttg_graph_pending() as $pn) unset($canonSlugs[(string) ($pn['slug'] ?? '')]);
foreach ($payload['field'] as &$fn) {
    if (!empty($fn['why']['evidence']) && is_array($fn['why']['evidence'])) {
        $fn['why']['evidence'] = array_values(array_filter($fn['why']['evidence'], static fn($ev) => is_array($ev) && isset($canonSlugs[(string) ($ev['slug'] ?? '')])));
    }
    if (!empty($fn['links']) && is_array($fn['links'])) {
        $fn['links'] = array_values(array_filter($fn['links'], static fn($l) => is_array($l) && isset($canonSlugs[(string) ($l['slug'] ?? '')])));
    }
}
unset($fn);
unset($payload['play']);
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '{"field":[],"edges":[],"you":{"known":false}}';
}

// Right-hand context for each bead in the orbit: its filings and its noted edges.
$fieldSlugs = [];
foreach ((array) ($payload['field'] ?? []) as $f) {
    if (is_array($f) && !empty($f['slug'])) $fieldSlugs[(string) $f['slug']] = true;
}
$slugOf = [];
$titleOf = [];
$context = [];
foreach (ttg_graph_unique_nodes() as $n) {
    $slug = (string) ($n['slug'] ?? '');
    if ($slug === '' || !ttg_graph_public($n)) continue;
    if (!empty($n['public_id'])) $slugOf[(string) $n['public_id']] = $slug;
    $slugOf[$slug] = $slug;
    $titleOf[$slug] = (string) ($n['title'] ?? $slug);
    if (!isset($fieldSlugs[$slug])) continue;
    $voices = [];
    foreach ((array) ($n['voices'] ?? []) as $v) {
        if (!is_array($v) || trim((string) ($v['text'] ?? '')) === '') continue;
        $voices[] = ['voice' => (string) ($v['voice'] ?? ''), 'class' => (string) ($v['class'] ?? ''), 'text' => (string) $v['text']];
    }
    $context[$slug] = ['voices' => $voices, 'notes' => []];
}
foreach (array_merge(ttg_graph_edges(), ttg_graph_inferred_edges()) as $e) {
    $note = trim((string) ($e['note'] ?? ''));
    if ($note === '') continue;
    $s = $slugOf[(string) ($e['source'] ?? '')] ?? '';
    $t = $slugOf[(string) ($e['target'] ?? '')] ?? '';
    if ($s === '' || $t === '') continue;
    $rel = strtolower(str_replace('_', ' ', (string) ($e['relationship'] ?? 'related')));
    foreach ([[$s, $t], [$t, $s]] as [$a, $b]) {
        if (!isset($context[$a]) || count($context[$a]['notes']) >= 4) continue;
        $context[$a]['notes'][] = ['rel' => $rel, 'title' => $titleOf[$b] ?? $b, 'note' => $note, 'by' => (string) ($e['noted_by'] ?? '')];
    }
}
$contextJson = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?: '{}';

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
<meta name="description" content="Jack tours the NOW tree on his own: following threads, opening cards and reading them. Take the reins whenever you like.">
<meta name="theme-color" content="#f1e4c4">
<link rel="canonical" href="https://timetravellersguild.com/view">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:site_name" content="TIMETRAVELLERSGUILD.COM">
<meta property="og:title" content="VIEW — timetravellersguild.com">
<meta property="og:description" content="Jack tours the NOW tree on his own: following threads, opening cards and reading them. Take the reins whenever you like.">
<meta property="og:image" content="https://timetravellersguild.com/assets/og/now.png">
<meta property="og:url" content="https://timetravellersguild.com/view">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909v">
<link rel="stylesheet" href="/assets/view.css?v=261106a">
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
  <p id="viewSay" aria-live="off"></p>
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
  <blockquote class="view-filing" id="viewFiling" hidden><p id="viewFilingText"></p><footer id="viewFilingBy"></footer></blockquote>
  <ul class="view-notes" id="viewNotes" hidden></ul>
  <p class="view-sub" id="viewSub">Y12 · X · 0–9 · NOT CANON</p>
</aside>

<div id="reins" class="reins" data-who="jack">
  <span class="reins-dot" aria-hidden="true"></span>
  <span class="reins-who" id="reinsWho" role="status" aria-live="polite">JACK HAS THE REINS</span>
  <span class="reins-note" id="reinsNote">Touch anything to take them</span>
  <button type="button" id="reinsBtn">TAKE THE REINS</button>
</div>

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

<script>window.TTG_MODE='view';window.TTG_GRAPH=<?= $json ?>;window.TTG_VIEW_CONTEXT=<?= $contextJson ?>;</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="/assets/now.js?v=261106a"></script>
<script src="/assets/view.js?v=261106a"></script>
<script src="https://ffilm.org/visitors/visit.js" defer></script>
</body>
</html>
