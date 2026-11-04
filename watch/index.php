<?php
/**
 * timetravellersguild.com/watch/index.php
 * ─────────────────────────────────────────────────────────────────────────────
 * THE WATCH — Instrument №14 of the Time Travellers Guild.
 *
 * Reads /watch/images/ (jpg, jpeg, png), builds a scrubbable stop-motion
 * timeline, and renders it through a single-pass optical instrument:
 * lens warp, radial aberration, precession drift, halation — no digital
 * tearing, no glitch blocks. The playhead itself moves like a body in an
 * elliptical orbit: quick at perihelion, slow at aphelion, per the
 * Eccentricity dial.
 *
 * Single file. No CDNs, no fonts phoned home, no build step.
 *
 * Endpoints:
 *   index.php                   the instrument
 *   index.php?api=1             JSON plate index (used for live re-scan)
 *   ?sort=name|mtime|size|random   &dir=asc|desc   &seed=123   &limit=400
 */
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/network.php';

/* ───────────────────────────────────────────────────────────────── config ── */

// Name of the plate folder, sitting alongside this file: /watch/images
const PLATE_SUB  = 'images';
// Filesystem path to the images.
define('PLATE_DIR', __DIR__ . '/' . PLATE_SUB);
// Public URL of the same folder, worked out from wherever this script lives,
// so moving index.php doesn't break the link.
define('PLATE_URL', rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/watch/index.php')), '/') . '/' . PLATE_SUB);
// Hard ceiling on how many plates we hand to the browser.
const PLATE_MAX  = 600;
const PLATE_EXT  = ['jpg', 'jpeg', 'png'];

/* ──────────────────────────────────────────────────────────── plate index ── */

function marquee_scan(string $dir): array {
    if (!is_dir($dir)) return [];
    $dh = @opendir($dir);
    if ($dh === false) return [];
    $out = [];
    while (($f = readdir($dh)) !== false) {
        if ($f === '' || $f[0] === '.') continue;
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (!in_array($ext, PLATE_EXT, true)) continue;
        $p = $dir . DIRECTORY_SEPARATOR . $f;
        if (!is_file($p)) continue;
        $out[] = ['name' => $f, 'mtime' => (int) @filemtime($p), 'bytes' => (int) @filesize($p)];
    }
    closedir($dh);
    return $out;
}

function marquee_order(array $plates, string $sort, string $dir, int $seed): array {
    switch ($sort) {
        case 'mtime':
            usort($plates, static fn($a, $b) => $a['mtime'] <=> $b['mtime']);
            break;
        case 'size':
            usort($plates, static fn($a, $b) => $a['bytes'] <=> $b['bytes']);
            break;
        case 'random':
            usort($plates, static fn($a, $b) => strnatcasecmp($a['name'], $b['name']));
            mt_srand($seed);
            for ($i = count($plates) - 1; $i > 0; $i--) {
                $j = mt_rand(0, $i);
                [$plates[$i], $plates[$j]] = [$plates[$j], $plates[$i]];
            }
            return $plates; // direction is meaningless for a shuffle
        case 'name':
        default:
            usort($plates, static fn($a, $b) => strnatcasecmp($a['name'], $b['name']));
    }
    if ($dir === 'desc') $plates = array_reverse($plates);
    return $plates;
}

$sort  = (string) ($_GET['sort'] ?? 'name');
$order = (string) ($_GET['dir']  ?? 'asc');
$seed  = (int)    ($_GET['seed'] ?? 1);
$limit = max(1, min(PLATE_MAX, (int) ($_GET['limit'] ?? PLATE_MAX)));

$all    = marquee_scan(PLATE_DIR);
$total  = count($all);
$all    = marquee_order($all, $sort, $order, $seed);
$all    = array_slice($all, 0, $limit);

$base   = rtrim(PLATE_URL, '/');
$plates = array_map(static function (array $p) use ($base): array {
    return [
        'src'   => $base . '/' . rawurlencode($p['name']),
        'name'  => $p['name'],
        'mtime' => $p['mtime'],
    ];
}, $all);

$payload = [
    'plates' => $plates,
    'cfg'    => [
        'total'   => $total,
        'shown'   => count($plates),
        'sort'    => $sort,
        'dir'     => $order,
        'seed'    => $seed,
        'folder'  => $base . '/',
        'missing' => !is_dir(PLATE_DIR),
        'scanned' => date('c'),
    ],
];

if (isset($_GET['api'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

$json = json_encode(
    $payload,
    JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);
$empty = count($plates) === 0;
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The Watch — Time Travellers Guild</title>
<meta name="description" content="Instrument №14 of the Time Travellers Guild: an orbital viewer for glass plates, warped through brass optics.">
<meta name="theme-color" content="#0a0e18">
<link rel="stylesheet" href="/assets/network.css">
<style>
/* ═══════════════════════════════════════════════════════════════════════════
   THE WATCH — void-blue casing, brass optics, parchment star-charts.
   An instrument, not a page.
   ═══════════════════════════════════════════════════════════════════════ */
:root{
  --void:#0a0e18;          /* the room: deep instrument-case blue-black     */
  --case:#141b2e;          /* the casing itself                             */
  --case-lo:#0a0e18;
  --paper:#e8dfc4;         /* aged star-chart paper                         */
  --paper-lo:#c9ba8c;
  --ink:#171307;
  --brass:#c1994e;
  --brass-hi:#f5e3b0;
  --brass-lo:#5a4420;
  --signal:#b23b3f;        /* record / alarm red on old dials               */
  --verdigris:#3d6a72;     /* patinated copper accent                       */
  --rule:rgba(193,153,78,.32);

  --display:"Bodoni 72","Bodoni MT",Didot,"Didot LT STD","Playfair Display","Hoefler Text",Garamond,serif;
  --body:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  --util:"Courier New",Courier,ui-monospace,monospace;
}

*{box-sizing:border-box}
html,body{margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{
  background:var(--void);
  color:var(--paper);
  font-family:var(--body);
  font-size:16px;
  line-height:1.5;
  overflow-x:hidden;
  background-image:
    radial-gradient(120% 90% at 50% -10%, rgba(193,153,78,.09), transparent 60%),
    radial-gradient(140% 120% at 50% 120%, rgba(61,106,114,.16), transparent 55%);
}
body::after{           /* fine star-dust over everything, cheap and constant */
  content:"";position:fixed;inset:0;pointer-events:none;z-index:99;opacity:.16;
  mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='260' height='260' filter='url(%23n)'/%3E%3C/svg%3E");
}
::selection{background:var(--verdigris);color:var(--brass-hi)}
:focus-visible{outline:2px solid var(--brass-hi);outline-offset:3px}

.wrap{max-width:1180px;margin:0 auto;padding:clamp(14px,3vw,34px) clamp(12px,3vw,28px) 80px}

/* ── playbill ──────────────────────────────────────────────────────────── */
.playbill{text-align:center;padding:8px 0 22px;position:relative}
.playbill .above{
  font-family:var(--util);font-size:11px;letter-spacing:.42em;text-transform:uppercase;
  color:var(--brass);margin:0 0 14px
}
.playbill h1{
  font-family:var(--display);font-weight:400;margin:0;
  font-size:clamp(38px,10vw,86px);line-height:.92;letter-spacing:.06em;
  color:var(--paper);
  text-shadow:0 1px 0 rgba(0,0,0,.9),0 0 26px rgba(193,153,78,.22);
}
.playbill h1 em{font-style:italic;letter-spacing:.02em;color:var(--brass-hi)}
.playbill .under{
  margin:12px auto 0;max-width:52ch;font-style:italic;color:var(--paper-lo);
  font-size:clamp(13px,2.4vw,16px)
}
.hr{display:flex;align-items:center;gap:12px;margin:16px 0 0;color:var(--rule)}
.hr::before,.hr::after{content:"";flex:1;height:1px;background:currentColor}
.hr svg{width:54px;height:14px;color:var(--brass);opacity:.85}

/* ── cabinet: the stage ────────────────────────────────────────────────── */
.cabinet{
  position:relative;border-radius:5px;
  padding:clamp(10px,2.2vw,20px);
  background:
    linear-gradient(160deg,#1c2540,#0a0e18 55%,#151d33);
  box-shadow:
    inset 0 0 0 1px rgba(0,0,0,.6),
    inset 0 0 0 4px rgba(193,153,78,.28),
    inset 0 0 0 5px rgba(0,0,0,.55),
    inset 0 34px 60px rgba(0,0,0,.42),
    0 26px 50px rgba(0,0,0,.62);
}
.cabinet::before,.cabinet::after{
  content:"";position:absolute;width:26px;height:26px;border:1px solid rgba(193,153,78,.5);
  pointer-events:none
}
.cabinet::before{top:7px;left:7px;border-right:0;border-bottom:0;border-radius:4px 0 0 0}
.cabinet::after{bottom:7px;right:7px;border-left:0;border-top:0;border-radius:0 0 4px 0}

.stage{
  position:relative;aspect-ratio:16/10;width:100%;border-radius:2px;overflow:hidden;
  background:#05070d;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.9), inset 0 0 70px rgba(0,0,0,.85);
  touch-action:pan-y;cursor:ew-resize;
}
@media (max-width:640px){.stage{aspect-ratio:4/3}}
.stage canvas{display:block;width:100%;height:100%}

.veil{
  position:absolute;inset:0;display:grid;place-items:center;text-align:center;
  background:rgba(10,14,24,.88);gap:10px;padding:24px;transition:opacity .4s
}
.veil[hidden]{display:none}
.veil p{margin:0;font-family:var(--util);font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--brass)}
.veil .bar{width:min(300px,70vw);height:3px;background:rgba(0,0,0,.7);box-shadow:inset 0 0 0 1px rgba(193,153,78,.35)}
.veil .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--brass-lo),var(--brass-hi));transition:width .2s}

/* mechanical counter, bottom-left of stage */
.counter{
  position:absolute;left:12px;bottom:12px;display:flex;gap:6px;align-items:stretch;
  padding:5px 7px;border-radius:3px;background:linear-gradient(#0f1522,#050710);
  box-shadow:inset 0 0 0 1px rgba(193,153,78,.4),0 3px 8px rgba(0,0,0,.6);
  font-family:var(--util);font-size:15px;letter-spacing:.12em;color:var(--brass-hi);
  text-shadow:0 0 9px rgba(245,227,176,.5);user-select:none
}
.counter small{display:block;font-size:8px;letter-spacing:.2em;color:var(--brass);opacity:.7;text-shadow:none}
.counter .cell{padding:0 4px;text-align:center}
.counter .rec{color:#ff6a5e;text-shadow:0 0 10px rgba(255,60,50,.8)}

/* ── filmstrip ─────────────────────────────────────────────────────────── */
.strip-hold{margin-top:14px;position:relative}
.strip{
  display:flex;gap:0;overflow-x:auto;overflow-y:hidden;padding:11px 0;
  background:
    linear-gradient(#0a0e18,#0a0e18) padding-box,
    repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 9px, rgba(193,153,78,.13) 9px 15px) border-box;
  border-top:9px solid transparent;border-bottom:9px solid transparent;
  scrollbar-width:thin;scrollbar-color:var(--brass-lo) transparent;
  touch-action:pan-x;
}
.strip::-webkit-scrollbar{height:8px}
.strip::-webkit-scrollbar-thumb{background:var(--brass-lo);border-radius:4px}
.thumb{
  position:relative;flex:0 0 auto;width:86px;height:64px;margin-right:5px;
  background:#000;overflow:hidden;cursor:grab;
  box-shadow:inset 0 0 0 1px rgba(193,153,78,.22);
  filter:sepia(.4) contrast(1.05) brightness(.82) saturate(.9);transition:filter .18s,transform .18s
}
.thumb img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.thumb b{
  position:absolute;left:0;bottom:0;font-family:var(--util);font-size:9px;letter-spacing:.08em;
  background:rgba(10,14,24,.82);color:var(--brass);padding:1px 4px
}
.thumb i{
  position:absolute;right:2px;top:2px;font-family:var(--util);font-style:normal;font-size:9px;
  color:var(--ink);background:var(--brass);padding:0 3px;border-radius:2px
}
.thumb:hover{filter:sepia(.15) brightness(1)}
.thumb.on{filter:none;box-shadow:inset 0 0 0 2px var(--brass-hi),0 0 16px rgba(193,153,78,.5);transform:translateY(-2px)}
.thumb.lift{opacity:.5;cursor:grabbing;transform:scale(.92)}

/* ── console ───────────────────────────────────────────────────────────── */
.console{
  margin-top:18px;border-radius:4px;padding:clamp(12px,2.4vw,20px);
  background:linear-gradient(180deg,#1a2338,#101728 40%,#0a0e18);
  box-shadow:inset 0 1px 0 rgba(245,227,176,.2),inset 0 0 0 1px rgba(0,0,0,.7),0 16px 34px rgba(0,0,0,.55);
}
.rack{display:grid;gap:clamp(10px,2vw,18px);grid-template-columns:repeat(auto-fit,minmax(232px,1fr))}
.panel{
  border-radius:3px;padding:13px 13px 15px;
  background:linear-gradient(180deg,rgba(245,227,176,.05),rgba(0,0,0,.28));
  box-shadow:inset 0 0 0 1px rgba(193,153,78,.20)
}
.panel > h2{
  margin:0 0 11px;font-family:var(--util);font-size:10px;letter-spacing:.3em;text-transform:uppercase;
  color:var(--brass);font-weight:400;
  padding-bottom:7px;border-bottom:1px solid rgba(193,153,78,.2)
}

/* transport */
.transport{display:flex;flex-wrap:wrap;gap:7px}
.key{
  appearance:none;border:0;cursor:pointer;color:var(--paper);
  font-family:var(--util);font-size:11px;letter-spacing:.12em;text-transform:uppercase;
  padding:9px 11px;border-radius:3px;flex:1 1 auto;min-width:44px;
  background:linear-gradient(180deg,#1c2438,#0a0e18);
  box-shadow:inset 0 1px 0 rgba(245,227,176,.14),inset 0 0 0 1px rgba(193,153,78,.24),0 3px 0 rgba(0,0,0,.55);
  transition:transform .06s,box-shadow .06s,color .15s
}
.key:hover{color:var(--brass-hi)}
.key:active,.key.on{
  transform:translateY(2px);color:var(--brass-hi);
  box-shadow:inset 0 2px 6px rgba(0,0,0,.75),inset 0 0 0 1px rgba(193,153,78,.5),0 1px 0 rgba(0,0,0,.5)
}
.key.on{background:linear-gradient(180deg,#3a2e10,#1e1808)}
.key.wide{flex:1 1 100%}
.key.blood{color:#f0b8b0}
.key.blood.on{background:linear-gradient(180deg,var(--signal),#4a1416);color:#ffd9d2}

/* knobs */
.knobs{display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:12px 8px}
.knob{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;user-select:none;touch-action:none;cursor:ns-resize}
.knob .well{position:relative;width:54px;height:54px}
.knob .arc{
  position:absolute;inset:-5px;border-radius:50%;
  background:conic-gradient(from 225deg, var(--brass-hi) calc(var(--t,0) * 270deg), rgba(0,0,0,.45) 0 270deg, transparent 270deg);
  -webkit-mask:radial-gradient(circle, transparent 60%, #000 63%);
          mask:radial-gradient(circle, transparent 60%, #000 63%);
  opacity:.8
}
.knob .dial{
  position:absolute;inset:0;border-radius:50%;
  background:
    radial-gradient(circle at 34% 28%, #fbeec6, #c1994e 44%, #7c5a24 72%, #33220c);
  box-shadow:inset 0 2px 3px rgba(255,255,255,.45),inset 0 -3px 6px rgba(0,0,0,.6),0 5px 9px rgba(0,0,0,.55);
}
.knob .dial::before{ /* knurling */
  content:"";position:absolute;inset:3px;border-radius:50%;
  background:repeating-conic-gradient(from 0deg, rgba(0,0,0,.22) 0deg 3deg, rgba(255,255,255,.10) 3deg 6deg);
  opacity:.5;mask:radial-gradient(circle, transparent 52%, #000 56%)
}
.knob .rot{position:absolute;inset:0;transform:rotate(var(--a,-135deg));transition:transform .05s linear}
.knob .tick{position:absolute;left:50%;top:5px;width:2px;height:16px;margin-left:-1px;border-radius:1px;
  background:linear-gradient(#1a1109,#4a3416);box-shadow:0 0 2px rgba(0,0,0,.7)}
.knob.live .dial{box-shadow:inset 0 2px 3px rgba(255,255,255,.45),0 0 0 2px rgba(245,227,176,.4),0 5px 12px rgba(0,0,0,.6)}
.knob label{
  font-family:var(--util);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--brass);
  text-shadow:0 1px 0 rgba(0,0,0,.8)
}
.knob output{font-family:var(--util);font-size:11px;color:var(--paper);letter-spacing:.06em}

/* notice */
.notice{
  margin-top:18px;padding:16px 18px;border-radius:3px;
  background:linear-gradient(180deg,var(--paper),var(--paper-lo));color:var(--ink);
  box-shadow:0 12px 26px rgba(0,0,0,.5),inset 0 0 0 1px rgba(23,19,7,.35),inset 0 0 0 4px rgba(232,223,196,.9),inset 0 0 0 5px rgba(23,19,7,.5);
}
.notice h2{
  margin:0 0 4px;font-family:var(--display);font-size:20px;font-weight:400;letter-spacing:.14em;text-transform:uppercase;text-align:center
}
.notice .sub{margin:0 0 12px;text-align:center;font-style:italic;font-size:13px;color:#5a4a2e}
.notice dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px 20px;margin:0;font-size:13px}
.notice .row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dotted rgba(23,19,7,.3);padding:3px 0}
.notice kbd{font-family:var(--util);font-size:11px;background:rgba(23,19,7,.1);border:1px solid rgba(23,19,7,.3);border-radius:2px;padding:0 5px;white-space:nowrap}
.notice details{margin-top:10px}
.notice summary{cursor:pointer;font-family:var(--util);font-size:11px;letter-spacing:.16em;text-transform:uppercase}

.colophon{margin-top:26px;text-align:center;font-size:12px;color:rgba(232,223,196,.42);font-style:italic}
.colophon code{font-family:var(--util);font-style:normal;color:var(--brass)}

.empty{
  margin:40px auto;max-width:640px;padding:26px;border-radius:3px;text-align:center;
  background:linear-gradient(180deg,var(--paper),var(--paper-lo));color:var(--ink);
  box-shadow:0 12px 26px rgba(0,0,0,.5)
}
.empty h2{font-family:var(--display);font-weight:400;letter-spacing:.1em;margin:0 0 8px}
.empty code{font-family:var(--util);background:rgba(23,19,7,.1);padding:2px 6px;border-radius:2px}

@media (prefers-reduced-motion:reduce){
  *{animation-duration:.001ms!important;transition-duration:.001ms!important}
}
</style>
</head>
<body>
<?= ttg_network_bar() ?>
<div class="wrap">

  <header class="playbill">
    <p class="above">Time Travellers Guild &nbsp;·&nbsp; Instrument №14</p>
    <h1>The <em>Watch</em></h1>
    <p class="under">Plates from the archive, set in orbit. Drag the picture to wind the reel; turn the brass to bend the light.</p>
    <div class="hr" aria-hidden="true">
      <svg viewBox="0 0 54 14">
        <ellipse cx="27" cy="7" rx="23" ry="5.4" fill="none" stroke="currentColor" stroke-width="1" opacity=".6"/>
        <circle cx="5" cy="7" r="1.7" fill="currentColor"/>
        <circle cx="49" cy="7" r="1.1" fill="currentColor" opacity=".55"/>
      </svg>
    </div>
  </header>

<?php if ($empty): ?>

  <div class="empty">
    <h2>The case is empty</h2>
    <p>No <?= implode(', ', PLATE_EXT) ?> found in <code><?= htmlspecialchars($base . '/', ENT_QUOTES) ?></code>.</p>
    <p>Drop plates into <code>/watch/<?= PLATE_SUB ?>/</code>, or edit <code>PLATE_DIR</code> and <code>PLATE_URL</code> at the top of this file, then reload.</p>
  </div>

<?php else: ?>

  <main class="cabinet">
    <div class="stage" id="stage">
      <canvas id="gl" aria-label="Orbiting plates"></canvas>
      <div class="veil" id="veil">
        <p id="veilText">Aligning the instrument</p>
        <div class="bar"><i id="veilBar"></i></div>
      </div>
      <div class="counter" id="counter">
        <div class="cell"><small>Position</small><span id="cFrame">000</span></div>
        <div class="cell"><small>Transit</small><span id="cTotal">000</span></div>
        <div class="cell"><small>Pace</small><span id="cFps">12</span></div>
        <div class="cell" id="cState"><small>State</small><span>held</span></div>
      </div>
    </div>

    <div class="strip-hold">
      <div class="strip" id="strip" aria-label="Reel"></div>
    </div>

    <section class="console">
      <div class="rack">

        <div class="panel">
          <h2>Transport</h2>
          <div class="transport">
            <button class="key" data-act="first" title="First frame">&#124;&#9664;</button>
            <button class="key" data-act="prev" title="Step back">&#9664;&#9664;</button>
            <button class="key" data-act="play" id="btnPlay" title="Run / hold">&#9654;</button>
            <button class="key" data-act="next" title="Step on">&#9654;&#9654;</button>
            <button class="key" data-act="last" title="Last frame">&#9654;&#124;</button>
            <button class="key" data-act="loop" id="btnLoop" title="Return to the start">Loop</button>
            <button class="key" data-act="boust" id="btnBoust" title="Run there and back">Boustrophedon</button>
            <button class="key" data-act="follow" id="btnFollow" title="Keep the reel centred on the playhead">Follow</button>
          </div>
        </div>

        <div class="panel">
          <h2>Orbit</h2>
          <div class="knobs">
            <div class="knob" data-key="fps"  data-min="1"  data-max="36" data-step="1"   data-def="12"  data-fmt="int"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Transit</label><output>12</output></div>
            <div class="knob" data-key="ecc"   data-min="0" data-max=".9" data-step=".01" data-def=".35"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Eccentric.</label><output>0.35</output></div>
            <div class="knob" data-key="blend" data-min="0" data-max="1"  data-step=".01" data-def=".35"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Swing</label><output>0.35</output></div>
            <div class="knob" data-key="zoom"  data-min="1" data-max="2"  data-step=".01" data-def="1.05"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Aperture</label><output>1.05</output></div>
            <div class="knob" data-key="flux"  data-min="0" data-max="1"  data-step=".01" data-def=".15"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Flux</label><output>0.15</output></div>
          </div>
        </div>

        <div class="panel">
          <h2>Optics</h2>
          <div class="knobs">
            <div class="knob" data-key="warp"     data-min="0" data-max="1" data-step=".01" data-def=".18"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Warp</label><output>0.18</output></div>
            <div class="knob" data-key="aberr"    data-min="0" data-max="1" data-step=".01" data-def=".22"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Aberration</label><output>0.22</output></div>
            <div class="knob" data-key="drift"    data-min="0" data-max="1" data-step=".01" data-def=".15"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Drift</label><output>0.15</output></div>
            <div class="knob" data-key="halation" data-min="0" data-max="1" data-step=".01" data-def=".35"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Halation</label><output>0.35</output></div>
            <div class="knob" data-key="grain"    data-min="0" data-max="1" data-step=".01" data-def=".18"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Grain</label><output>0.18</output></div>
            <div class="knob" data-key="tone"     data-min="0" data-max="1" data-step=".01" data-def=".55"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Tone</label><output>0.55</output></div>
            <div class="knob" data-key="vign"     data-min="0" data-max="1" data-step=".01" data-def=".50"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Shade</label><output>0.50</output></div>
            <div class="knob" data-key="eyepiece" data-min="0" data-max="1" data-step=".01" data-def=".35"><div class="well"><div class="arc"></div><div class="dial"><div class="rot"><span class="tick"></span></div></div></div><label>Eyepiece</label><output>0.35</output></div>
          </div>
        </div>

        <div class="panel">
          <h2>Cut the reel</h2>
          <div class="transport">
            <button class="key" data-act="dup" title="Copy this frame in place">Double</button>
            <button class="key" data-act="del" title="Cut this frame out">Cut</button>
            <button class="key" data-act="holdup" title="Linger longer here">Hold +</button>
            <button class="key" data-act="holddn" title="Linger less">Hold &minus;</button>
            <button class="key" data-act="shuffle">Shuffle</button>
            <button class="key" data-act="reverse">Reverse</button>
            <button class="key wide" data-act="reset">Restore the reel</button>
          </div>
        </div>

        <div class="panel">
          <h2>Take away</h2>
          <div class="transport">
            <button class="key" data-act="png">Save frame</button>
            <button class="key blood" data-act="rec" id="btnRec">Record</button>
            <button class="key" data-act="savereel">Save reel</button>
            <button class="key" data-act="loadreel">Open reel</button>
            <button class="key wide" data-act="rescan">Re-read the case</button>
            <button class="key wide" data-act="watch" id="btnWatch">Watch for new plates</button>
          </div>
          <input type="file" id="reelFile" accept="application/json,.json" hidden>
        </div>

      </div>
    </section>

    <section class="notice">
      <h2>Notice to Operators</h2>
      <p class="sub">The instrument answers to hand, wheel and key alike.</p>
      <dl>
        <div class="row"><span>Wind the reel</span><kbd>drag the picture</kbd></div>
        <div class="row"><span>Wind by wheel</span><kbd>scroll over picture</kbd></div>
        <div class="row"><span>Change the pace</span><kbd>Shift + scroll</kbd></div>
        <div class="row"><span>Run / hold</span><kbd>Space</kbd> <kbd>tap</kbd></div>
        <div class="row"><span>Step one frame</span><kbd>&larr;</kbd> <kbd>&rarr;</kbd></div>
        <div class="row"><span>Pace up / down</span><kbd>&uarr;</kbd> <kbd>&darr;</kbd></div>
        <div class="row"><span>Double / cut</span><kbd>D</kbd> <kbd>X</kbd></div>
        <div class="row"><span>Catch a flare</span><kbd>G</kbd></div>
        <div class="row"><span>Save the frame</span><kbd>S</kbd></div>
        <div class="row"><span>Record</span><kbd>R</kbd></div>
        <div class="row"><span>Reset a knob</span><kbd>double-click it</kbd></div>
        <div class="row"><span>Reorder frames</span><kbd>drag a thumbnail</kbd></div>
      </dl>
      <details>
        <summary>On the instrument</summary>
        <p style="font-size:13px;margin:8px 0 0">
          Plates are read from <code><?= htmlspecialchars($base . '/', ENT_QUOTES) ?></code> each time the page loads.
          Add <code>?sort=random&amp;seed=7</code> for a fresh order, <code>?sort=mtime&amp;dir=desc</code> for newest first,
          or <code>?limit=120</code> to keep it light. The playhead itself moves like an orbiting body &mdash; quick
          near perihelion, slow near aphelion &mdash; and the <em>Eccentricity</em> dial sets how unevenly it sweeps.
          <em>Watch for new plates</em> re-reads the folder every minute and adds anything dropped in, without
          losing your cuts.
        </p>
      </details>
    </section>

    <p class="colophon">
      Instrument №14 · <a href="/now" style="color:inherit">.;. tree</a> · <a href="/hub/" style="color:inherit">hub</a> · <a href="/archive/" style="color:inherit">archive</a> · <a href="/feed/" style="color:inherit">feed∞</a>
      &nbsp;·&nbsp; <span id="colo"></span>
    </p>
    <?= ttg_limbs('watch') ?>
  </main>

<?php endif; ?>
</div>

<script>window.__WATCH__ = <?= $json ?>;</script>
<?php if (!$empty): ?>
<script>
(() => {
'use strict';

/* ═════════════════════════════════════════════════════ state ═══════════ */

const DATA   = window.__WATCH__;
let   PLATES = DATA.plates.slice();
const CFG    = DATA.cfg;

const params = {
  fps:12, ecc:.35, blend:.35, zoom:1.05, flux:.15,
  warp:.18, aberr:.22, drift:.15, halation:.35, grain:.18, tone:.55, vign:.50, eyepiece:.35
};

let timeline = PLATES.map((_, i) => ({ i, hold: 1 }));   // editable reel
let schedule = [];    // flattened source indices
let owner    = [];    // schedule slot -> timeline entry
let head     = 0;     // playhead, in schedule units (fractional)
let playing  = false;
let loop     = true;
let boust    = false; // there-and-back
let dirn     = 1;
let follow   = true;
let flare    = 0;     // transient lens-flare boost, from Flux or the G key

const $  = s => document.querySelector(s);
const el = {
  stage:$('#stage'), canvas:$('#gl'), veil:$('#veil'), veilText:$('#veilText'),
  veilBar:$('#veilBar'), strip:$('#strip'),
  cFrame:$('#cFrame'), cTotal:$('#cTotal'), cFps:$('#cFps'), cState:$('#cState span'),
  btnPlay:$('#btnPlay'), btnLoop:$('#btnLoop'), btnBoust:$('#btnBoust'),
  btnFollow:$('#btnFollow'), btnRec:$('#btnRec'), btnWatch:$('#btnWatch'),
  reelFile:$('#reelFile'), colo:$('#colo')
};

function rebuild(){
  schedule.length = 0; owner.length = 0;
  timeline.forEach((e, ti) => {
    const h = Math.max(1, e.hold|0);
    for (let k = 0; k < h; k++){ schedule.push(e.i); owner.push(ti); }
  });
  if (!schedule.length){ schedule.push(0); owner.push(0); }
  head = Math.min(head, schedule.length - 0.001);
  el.cTotal.textContent = String(schedule.length).padStart(3,'0');
}
rebuild();

/* ═════════════════════════════════════════════════════ webgl ═══════════ */

const gl = el.canvas.getContext('webgl', {
  alpha:false, antialias:false, depth:false, stencil:false,
  premultipliedAlpha:false, preserveDrawingBuffer:true, powerPreference:'high-performance'
});

const VERT = `
attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// A single optical instrument: lens warp, radial (true-to-optics) aberration,
// slow precession drift, halation bloom, emulsion grain, brass vignette and
// an optional eyepiece reticle. No block-tear, no random glitch.
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA, uB;
uniform vec2  uSizeA, uSizeB, uRes;
uniform float uMix, uTime, uZoom;
uniform float uWarp, uAberr, uDrift, uGrain, uHalation, uTone, uVign, uEyepiece;

float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 cover(vec2 uv, vec2 img){
  float ra = uRes.x / max(uRes.y, 1.0);
  float ia = img.x  / max(img.y, 1.0);
  vec2 s = (ra > ia) ? vec2(1.0, ia/ra) : vec2(ra/ia, 1.0);
  return (uv - 0.5) * s / uZoom + 0.5;
}

/* barrel/pincushion lens warp, radial about the optical centre */
vec2 lensWarp(vec2 uv, float amt){
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  c *= 1.0 + amt * r2 * 1.35;
  return c + 0.5;
}

/* slow precession: the whole field turns gently about its centre */
vec2 precess(vec2 uv, float ang){
  vec2 c = uv - 0.5;
  float s = sin(ang), co = cos(ang);
  c = mat2(co, -s, s, co) * c;
  return c + 0.5;
}

vec3 samplePlate(sampler2D tex, vec2 uv, vec2 imgSize){
  vec2 base = cover(uv, imgSize);
  base = lensWarp(base, uWarp);
  vec2  c   = base - 0.5;
  float r   = length(c);
  vec2  dir = r > 0.0001 ? c / r : vec2(0.0);
  float ab  = uAberr * 0.022 * r;
  float rC = texture2D(tex, base + dir * ab).r;
  float gC = texture2D(tex, base).g;
  float bC = texture2D(tex, base - dir * ab).b;
  return vec3(rC, gC, bC);
}

void main(){
  vec2 uv = precess(vUv, uDrift * uTime * 0.055);

  vec3 a = samplePlate(uA, uv, uSizeA);
  vec3 b = samplePlate(uB, uv, uSizeB);
  vec3 col = mix(a, b, uMix);

  /* halation: a soft four-tap bloom lifted from the bright plate */
  float gr = 0.006 + uHalation * 0.012;
  vec3 glow =
      samplePlate(uA, uv + vec2(gr, 0.0), uSizeA)
    + samplePlate(uA, uv - vec2(gr, 0.0), uSizeA)
    + samplePlate(uA, uv + vec2(0.0, gr), uSizeA)
    + samplePlate(uA, uv - vec2(0.0, gr), uSizeA);
  glow *= 0.25;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += glow * uHalation * smoothstep(0.5, 1.0, lum) * 0.65;

  /* brass/void duotone */
  vec3 sh = vec3(0.055, 0.05, 0.10);
  vec3 md = vec3(0.30, 0.27, 0.36);
  vec3 hi = vec3(0.97, 0.90, 0.72);
  vec3 duo = (lum < 0.5) ? mix(sh, md, lum * 2.0) : mix(md, hi, (lum - 0.5) * 2.0);
  col = mix(col, duo, uTone);

  /* continuous emulsion grain, no strobing dust blocks */
  float n = hash(vUv * uRes + fract(uTime) * vec2(97.0, 57.0));
  col += (n - 0.5) * uGrain * 0.11;

  /* brass-tinted vignette */
  vec2 v = (vUv - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
  float vig = smoothstep(1.05, 0.30, length(v));
  col *= mix(1.0, vig, uVign);
  col = mix(col, col * vec3(1.08, 0.98, 0.82), uVign * 0.3);

  /* eyepiece reticle, as if viewed through the instrument's glass */
  if (uEyepiece > 0.001){
    float d = length(v);
    float ring  = smoothstep(0.004, 0.0, abs(d - 0.86));
    float cross = smoothstep(0.002, 0.0, min(abs(v.x), abs(v.y))) * step(d, 0.86);
    col = mix(col, vec3(0.85, 0.72, 0.42), (ring + cross * 0.4) * uEyepiece);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

let prog = null, U = {}, TEXMAX = 1024;

function compile(type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    console.error(gl.getShaderInfoLog(s)); return null;
  }
  return s;
}

function initGL(){
  if (!gl) return false;
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return false;
  prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(prog)); return false; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  ['uA','uB','uSizeA','uSizeB','uRes','uMix','uTime','uZoom',
   'uWarp','uAberr','uDrift','uGrain','uHalation','uTone','uVign','uEyepiece']
    .forEach(n => U[n] = gl.getUniformLocation(prog, n));

  gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  TEXMAX = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048, 1400);
  return true;
}

const HAS_GL = initGL();
if (!HAS_GL){
  el.veil.hidden = false;
  el.veilText.textContent = 'This browser will not open the instrument';
}

/* ══════════════════════════════════════════ plates, textures, memory ═══ */

const TEX_BUDGET = 176 * 1024 * 1024;   // roughly, in bytes of RGBA
const imgs   = new Map();               // index -> {img|null, state}
const texes  = new Map();               // index -> {tex, w, h, used, bytes}
let   texBytes = 0, inflight = 0, loadedCount = 0, tick = 0;
const queue  = [];
const CONC   = 6;

function want(i){
  if (i < 0 || i >= PLATES.length || imgs.has(i)) return;
  imgs.set(i, { img:null, state:'queued' });
  queue.push(i);
  pump();
}

function pump(){
  while (inflight < CONC && queue.length){
    let bi = 0, bd = Infinity, cur = schedule[Math.floor(head)] || 0;
    for (let k = 0; k < queue.length; k++){
      const d = Math.abs(queue[k] - cur);
      if (d < bd){ bd = d; bi = k; }
    }
    const i = queue.splice(bi, 1)[0];
    const rec = imgs.get(i);
    rec.state = 'loading';
    inflight++;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      rec.img = img; rec.state = 'ok'; inflight--; loadedCount++;
      progress(); pump();
    };
    img.onerror = () => { rec.state = 'error'; inflight--; progress(); pump(); };
    img.src = PLATES[i].src;
  }
}

function prep(img){
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  if (long <= TEXMAX) return { src:img, w:img.naturalWidth, h:img.naturalHeight };
  const s = TEXMAX / long;
  const w = Math.max(1, Math.round(img.naturalWidth  * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return { src:c, w, h };
}

function texFor(i){
  const cached = texes.get(i);
  if (cached){ cached.used = ++tick; return cached; }
  const rec = imgs.get(i);
  if (!rec || rec.state !== 'ok' || !rec.img.naturalWidth) { want(i); return null; }

  const p = prep(rec.img);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p.src);

  const entry = { tex, w:p.w, h:p.h, used:++tick, bytes:p.w*p.h*4 };
  texes.set(i, entry);
  texBytes += entry.bytes;
  evict();
  return entry;
}

function evict(){
  while (texBytes > TEX_BUDGET && texes.size > 8){
    let oldest = null, key = null;
    texes.forEach((v, k) => { if (!oldest || v.used < oldest.used){ oldest = v; key = k; } });
    if (key === null) break;
    gl.deleteTexture(oldest.tex);
    texBytes -= oldest.bytes;
    texes.delete(key);
  }
}

function progress(){
  const target = Math.min(PLATES.length, 14);
  const p = Math.min(1, loadedCount / target);
  el.veilBar.style.width = (p * 100).toFixed(0) + '%';
  if (loadedCount >= 1){ el.veil.hidden = true; }
}

for (let i = 0; i < Math.min(14, PLATES.length); i++) want(i);

/* ══════════════════════════════════════════════════════ render loop ════ */

let last = performance.now(), t0 = last;

function resize(){
  const r = el.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(r.width * dpr));
  const h = Math.max(2, Math.round(r.height * dpr));
  if (el.canvas.width !== w || el.canvas.height !== h){
    el.canvas.width = w; el.canvas.height = h;
  }
}
addEventListener('resize', resize, { passive:true });

/* the playhead moves like a body on an ellipse: quick near perihelion
   (head ≈ 0), slow near aphelion (head ≈ n/2), scaled by Eccentricity   */
function advance(dt){
  if (!playing || schedule.length < 2) return;
  const n = schedule.length;
  const ang = (head / n) * Math.PI * 2;
  const speedMul = 1 + params.ecc * Math.cos(ang);
  head += dirn * dt * params.fps * Math.max(0.15, speedMul);
  if (boust){
    if (head >= n - 1){ head = n - 1; dirn = -1; }
    else if (head <= 0){ head = 0; dirn = 1; }
  } else if (loop){
    head = ((head % n) + n) % n;
  } else if (head >= n - 1){
    head = n - 1; setPlaying(false);
  } else if (head < 0){ head = 0; setPlaying(false); }
}

function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;

  advance(dt);

  if (params.flux > 0 && Math.random() < params.flux * dt * 1.1){
    flare = 0.5 + Math.random() * 0.5;
  }
  flare = Math.max(0, flare - dt * 1.6);

  // keep the neighbourhood warm
  const at = Math.floor(head);
  for (let k = -4; k <= 20; k++){
    const s = schedule[(at + k + schedule.length * 2) % schedule.length];
    if (s !== undefined) want(s);
  }

  if (!HAS_GL) return;
  resize();

  const a = texFor(schedule[at % schedule.length]);
  const bIdx = schedule[(at + 1) % schedule.length];
  const b = params.blend > 0.001 ? texFor(bIdx) : null;

  gl.viewport(0, 0, el.canvas.width, el.canvas.height);
  if (!a){ gl.clearColor(0.04, 0.055, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT); updateCounter(); return; }

  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (b || a).tex);

  const n   = schedule.length;
  const ang = (head / n) * Math.PI * 2;
  const zoomEff = params.zoom * (1 + 0.05 * params.ecc * Math.cos(ang)) + flare * 0.02;
  const haloEff = Math.min(1, params.halation + flare * 0.7);

  gl.uniform2f(U.uSizeA, a.w, a.h);
  gl.uniform2f(U.uSizeB, (b||a).w, (b||a).h);
  gl.uniform2f(U.uRes, el.canvas.width, el.canvas.height);
  gl.uniform1f(U.uMix, b ? (head - at) * params.blend : 0);
  gl.uniform1f(U.uTime, (now - t0) / 1000);
  gl.uniform1f(U.uZoom, zoomEff);
  gl.uniform1f(U.uWarp, params.warp);
  gl.uniform1f(U.uAberr, params.aberr);
  gl.uniform1f(U.uDrift, params.drift);
  gl.uniform1f(U.uGrain, params.grain);
  gl.uniform1f(U.uHalation, haloEff);
  gl.uniform1f(U.uTone, params.tone);
  gl.uniform1f(U.uVign, params.vign);
  gl.uniform1f(U.uEyepiece, params.eyepiece);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  updateCounter();
}
requestAnimationFrame(frame);

let lastShown = -1;
function updateCounter(){
  const at = Math.floor(head) % Math.max(1, schedule.length);
  el.cFrame.textContent = String(at + 1).padStart(3, '0');
  el.cFps.textContent = String(Math.round(params.fps));
  if (at !== lastShown){ lastShown = at; markStrip(at); }
}

/* ══════════════════════════════════════════════════════════ the strip ══ */

let stripNodes = [];

function drawStrip(){
  const frag = document.createDocumentFragment();
  stripNodes = timeline.map((e, ti) => {
    const d = document.createElement('div');
    d.className = 'thumb'; d.dataset.ti = String(ti);
    d.title = PLATES[e.i] ? PLATES[e.i].name : '';
    const im = document.createElement('img');
    im.loading = 'lazy'; im.decoding = 'async'; im.alt = '';
    im.src = PLATES[e.i] ? PLATES[e.i].src : '';
    const b = document.createElement('b'); b.textContent = String(ti + 1);
    d.append(im, b);
    if (e.hold > 1){ const i2 = document.createElement('i'); i2.textContent = '\u00d7' + e.hold; d.append(i2); }
    frag.append(d);
    return d;
  });
  el.strip.replaceChildren(frag);
  lastShown = -1;
}

function markStrip(at){
  const ti = owner[at];
  stripNodes.forEach((n, k) => n.classList.toggle('on', k === ti));
  const node = stripNodes[ti];
  if (node && follow){
    const goal = node.offsetLeft - el.strip.clientWidth / 2 + node.offsetWidth / 2;
    el.strip.scrollLeft += (goal - el.strip.scrollLeft) * 0.28;
  }
}

/* drag to reorder, tap to jump */
let dragTi = -1, dragNode = null, dragStart = 0, dragMoved = false;

el.strip.addEventListener('pointerdown', e => {
  const t = e.target.closest('.thumb'); if (!t) return;
  dragTi = +t.dataset.ti; dragNode = t; dragStart = e.clientX; dragMoved = false;
  t.setPointerCapture(e.pointerId);
});
el.strip.addEventListener('pointermove', e => {
  if (dragTi < 0) return;
  if (!dragMoved && Math.abs(e.clientX - dragStart) > 7){ dragMoved = true; dragNode.classList.add('lift'); }
});
el.strip.addEventListener('pointerup', e => {
  if (dragTi < 0) return;
  if (!dragMoved){
    const at = owner.indexOf(dragTi);
    if (at >= 0){ head = at; setPlaying(false); }
  } else {
    dragNode.classList.remove('lift');
    let target = timeline.length - 1;
    for (const n of stripNodes){
      const r = n.getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2){ target = +n.dataset.ti; break; }
    }
    const moved = timeline.splice(dragTi, 1)[0];
    if (target > dragTi) target--;
    timeline.splice(Math.max(0, Math.min(timeline.length, target)), 0, moved);
    rebuild(); drawStrip();
  }
  dragTi = -1; dragNode = null;
});
el.strip.addEventListener('pointercancel', () => {
  if (dragNode) dragNode.classList.remove('lift');
  dragTi = -1; dragNode = null;
});

/* ══════════════════════════════════════════════════ stage gestures ═════ */

let sDown = false, sX = 0, sT = 0, sMoved = 0, vel = 0, wasPlaying = false;

el.stage.addEventListener('pointerdown', e => {
  sDown = true; sX = e.clientX; sT = performance.now(); sMoved = 0; vel = 0;
  wasPlaying = playing; if (playing) setPlaying(false);
  el.stage.setPointerCapture(e.pointerId);
});
el.stage.addEventListener('pointermove', e => {
  if (!sDown) return;
  const dx = e.clientX - sX; sX = e.clientX;
  sMoved += Math.abs(dx);
  const k = 42 / Math.max(220, el.stage.clientWidth);
  scrub(-dx * k);
  vel = -dx * k;
});
function releaseStage(){
  if (!sDown) return;
  sDown = false;
  const quick = performance.now() - sT < 260;
  if (sMoved < 7 && quick){ setPlaying(!wasPlaying ? true : false); return; }
  if (Math.abs(vel) > 0.02) fling(vel);
}
el.stage.addEventListener('pointerup', releaseStage);
el.stage.addEventListener('pointercancel', releaseStage);

let flingId = 0;
function fling(v){
  cancelAnimationFrame(flingId);
  let speed = v * 34;
  const step = () => {
    speed *= 0.93;
    if (Math.abs(speed) < 0.05) return;
    scrub(speed / 60);
    flingId = requestAnimationFrame(step);
  };
  flingId = requestAnimationFrame(step);
}

el.stage.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.shiftKey){
    setParam('fps', params.fps - Math.sign(e.deltaY));
    return;
  }
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  scrub(Math.sign(d) * Math.max(0.5, Math.min(4, Math.abs(d) / 40)));
}, { passive:false });

function scrub(delta){
  const n = schedule.length;
  head = ((head + delta) % n + n) % n;
  if (playing) setPlaying(false);
}

/* ══════════════════════════════════════════════════════════ controls ═══ */

function setPlaying(v){
  playing = v;
  el.btnPlay.innerHTML = v ? '&#10073;&#10073;' : '&#9654;';
  el.btnPlay.classList.toggle('on', v);
  el.cState.textContent = v ? 'running' : 'held';
}

function setParam(key, v){
  const k = knobs[key];
  if (k) k.set(v); else params[key] = v;
}

const knobs = {};
document.querySelectorAll('.knob').forEach(node => {
  const key  = node.dataset.key;
  const min  = +node.dataset.min, max = +node.dataset.max;
  const step = +node.dataset.step || 0.01;
  const def  = +node.dataset.def;
  const isInt = node.dataset.fmt === 'int';
  const out  = node.querySelector('output');
  const rot  = node.querySelector('.rot');

  function set(v){
    v = Math.max(min, Math.min(max, v));
    v = Math.round(v / step) * step;
    params[key] = v;
    const t = (v - min) / (max - min);
    node.style.setProperty('--t', t.toFixed(4));
    rot.style.transform = 'rotate(' + (-135 + 270 * t).toFixed(2) + 'deg)';
    out.textContent = isInt ? String(Math.round(v)) : v.toFixed(2);
  }
  knobs[key] = { set, def };
  set(def);

  let live = false, lastY = 0;
  node.addEventListener('pointerdown', e => {
    live = true; lastY = e.clientY; node.classList.add('live');
    node.setPointerCapture(e.pointerId); e.preventDefault();
  });
  node.addEventListener('pointermove', e => {
    if (!live) return;
    const dy = lastY - e.clientY; lastY = e.clientY;
    set(params[key] + dy * (max - min) / 190);
  });
  const off = () => { live = false; node.classList.remove('live'); };
  node.addEventListener('pointerup', off);
  node.addEventListener('pointercancel', off);
  node.addEventListener('wheel', e => {
    e.preventDefault();
    set(params[key] - Math.sign(e.deltaY) * (max - min) / 50);
  }, { passive:false });
  node.addEventListener('dblclick', () => set(def));
});

function currentTi(){ return owner[Math.floor(head) % schedule.length]; }

const acts = {
  play(){ setPlaying(!playing); },
  prev(){ setPlaying(false); scrub(-1); },
  next(){ setPlaying(false); scrub(1); },
  first(){ setPlaying(false); head = 0; },
  last(){ setPlaying(false); head = schedule.length - 1; },
  loop(){ loop = !loop; el.btnLoop.classList.toggle('on', loop); },
  boust(){ boust = !boust; el.btnBoust.classList.toggle('on', boust); },
  follow(){ follow = !follow; el.btnFollow.classList.toggle('on', follow); },

  dup(){
    const ti = currentTi();
    timeline.splice(ti + 1, 0, { i: timeline[ti].i, hold: timeline[ti].hold });
    rebuild(); drawStrip();
  },
  del(){
    if (timeline.length <= 1) return;
    const ti = currentTi();
    timeline.splice(ti, 1);
    rebuild(); drawStrip();
  },
  holdup(){ const e = timeline[currentTi()]; e.hold = Math.min(24, e.hold + 1); rebuild(); drawStrip(); },
  holddn(){ const e = timeline[currentTi()]; e.hold = Math.max(1, e.hold - 1); rebuild(); drawStrip(); },
  shuffle(){
    for (let i = timeline.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [timeline[i], timeline[j]] = [timeline[j], timeline[i]];
    }
    rebuild(); drawStrip();
  },
  reverse(){ timeline.reverse(); rebuild(); drawStrip(); },
  reset(){
    timeline = PLATES.map((_, i) => ({ i, hold:1 }));
    head = 0; rebuild(); drawStrip();
  },

  png(){
    el.canvas.toBlob(b => {
      if (b) save(b, 'watch-' + String(Math.floor(head) + 1).padStart(3, '0') + '.png');
    }, 'image/png');
  },
  rec(){ recording ? stopRec() : startRec(); },
  savereel(){
    const reel = {
      v:1, made:new Date().toISOString(), folder:CFG.folder, params:{...params},
      frames: timeline.map(e => ({ name: PLATES[e.i] ? PLATES[e.i].name : null, hold: e.hold }))
    };
    save(new Blob([JSON.stringify(reel, null, 2)], { type:'application/json' }), 'watch-reel.json');
  },
  loadreel(){ el.reelFile.click(); },
  rescan(){ rescan(true); },
  watch(){
    watching = !watching;
    el.btnWatch.classList.toggle('on', watching);
    clearInterval(watchTimer);
    if (watching) watchTimer = setInterval(() => rescan(false), 60000);
  }
};

document.querySelectorAll('[data-act]').forEach(b => {
  b.addEventListener('click', () => { const f = acts[b.dataset.act]; if (f) f(); });
});
el.btnLoop.classList.toggle('on', loop);
el.btnFollow.classList.toggle('on', follow);

addEventListener('keydown', e => {
  if (e.target.matches('input,textarea')) return;
  const K = {
    ' ':   () => acts.play(),
    ArrowRight: () => acts.next(),
    ArrowLeft:  () => acts.prev(),
    ArrowUp:    () => setParam('fps', params.fps + 1),
    ArrowDown:  () => setParam('fps', params.fps - 1),
    d: () => acts.dup(), x: () => acts.del(),
    g: () => { flare = 1; },
    s: () => acts.png(), r: () => acts.rec(),
    Home: () => acts.first(), End: () => acts.last()
  };
  const f = K[e.key] || K[e.key.toLowerCase()];
  if (f){ e.preventDefault(); f(); }
});

/* ══════════════════════════════════════════════════ take away ══════════ */

function save(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}

let recorder = null, recording = false, chunks = [];

function startRec(){
  if (!el.canvas.captureStream || typeof MediaRecorder === 'undefined'){
    el.btnRec.textContent = 'No recorder here'; return;
  }
  const stream = el.canvas.captureStream(30);
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mime = types.find(t => MediaRecorder.isTypeSupported(t));
  if (!mime){ el.btnRec.textContent = 'No recorder here'; return; }
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => save(new Blob(chunks, { type:'video/webm' }), 'watch.webm');
  recorder.start();
  recording = true;
  el.btnRec.textContent = 'Stop';
  el.btnRec.classList.add('on');
  el.cState.classList.add('rec');
  if (!playing) setPlaying(true);
}
function stopRec(){
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  recording = false;
  el.btnRec.textContent = 'Record';
  el.btnRec.classList.remove('on');
  el.cState.classList.remove('rec');
}

el.reelFile.addEventListener('change', async () => {
  const f = el.reelFile.files[0]; if (!f) return;
  try{
    const reel = JSON.parse(await f.text());
    const byName = new Map(PLATES.map((p, i) => [p.name, i]));
    const next = [];
    (reel.frames || []).forEach(fr => {
      const i = byName.get(fr.name);
      if (i !== undefined) next.push({ i, hold: Math.max(1, fr.hold | 0 || 1) });
    });
    if (next.length){ timeline = next; head = 0; rebuild(); drawStrip(); }
    if (reel.params) Object.keys(reel.params).forEach(k => setParam(k, reel.params[k]));
  } catch(err){
    el.veil.hidden = false;
    el.veilText.textContent = 'That reel would not open';
    setTimeout(() => { el.veil.hidden = true; }, 2200);
  }
  el.reelFile.value = '';
});

/* ══════════════════════════════════════════════ re-read the case ═══════ */

let watching = false, watchTimer = 0;

async function rescan(announce){
  try{
    const url = new URL(location.href);
    url.searchParams.set('api', '1');
    const r = await fetch(url.toString(), { cache:'no-store' });
    const d = await r.json();
    const have = new Set(PLATES.map(p => p.name));
    const fresh = d.plates.filter(p => !have.has(p.name));
    if (fresh.length){
      fresh.forEach(p => {
        PLATES.push(p);
        timeline.push({ i: PLATES.length - 1, hold: 1 });
      });
      rebuild(); drawStrip();
      flash(fresh.length + (fresh.length === 1 ? ' new plate' : ' new plates'));
    } else if (announce){
      flash('Nothing new in the case');
    }
  } catch(err){
    if (announce) flash('The case did not answer');
  }
}

let flashTimer = 0;
function flash(msg){
  el.veilText.textContent = msg;
  el.veil.hidden = false;
  el.veilBar.style.width = '100%';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.veil.hidden = true; }, 1600);
}

/* ══════════════════════════════════════════════════════════ ignition ═══ */

drawStrip();
resize();
setPlaying(false);
el.colo.textContent = CFG.shown + ' of ' + CFG.total + ' plates, ordered by ' + CFG.sort;
setTimeout(() => { if (loadedCount > 2) setPlaying(true); }, 900);

})();
</script>
<?php endif; ?>
</body>
</html>
