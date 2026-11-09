<?php
declare(strict_types=1);
/**
 * Geocentric Chronometer №13 — Guild instrument.
 * Contemplative orrery / clock (third state). Doors into the Guild and Ffilm.
 */
require_once dirname(__DIR__) . '/inc/network.php';

$pageTitle = 'Chronometer №13 — The Time Travellers Guild';
$desc = 'Geocentric chronometer of the Time Travellers Guild: dial, orrery, Rose of Venus, temporal throttle. Instrument №13.';
$canonical = 'https://timetravellersguild.com/chronometer/';
$cssV = '260910c';
$jsV = '260910c';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title><?= ttg_h($pageTitle) ?></title>
<meta name="description" content="<?= ttg_h($desc) ?>">
<meta name="theme-color" content="#0c0906">
<link rel="canonical" href="<?= ttg_h($canonical) ?>">
<?= ttg_og_head(['title' => $pageTitle, 'description' => $desc, 'url' => $canonical]) ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&family=Cutive+Mono&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/chronometer/css/chronometer.css?v=<?= ttg_h($cssV) ?>">
</head>
<body>
<div id="stage"></div>

<div id="ornaments">
  <button type="button" class="orn" id="crown" aria-label="Open the cabinet" title="The Cabinet">❧</button>
  <button type="button" class="orn hud" id="veil" aria-label="Veil the instruments" title="Veil / Unveil">◉</button>
  <button type="button" class="orn hud" id="earthview" aria-label="Return to the chronometer" title="Return to the chronometer">⊕</button>
</div>

<nav id="doors" class="hud" aria-label="Guild doors">
  <a href="/">Guild</a>
  <a href="/now">NOW</a>
  <a href="/hub/">Hub</a>
  <a href="/watch/">Watch</a>
  <a href="/film/">Film</a>
  <a href="https://ffilm.org/">Ffilm</a>
</nav>

<header id="masthead" class="panel hud" aria-label="Title">
  <h1><a href="/">The Time Travellers Guild</a></h1>
  <div class="sub">Geocentric Chronometer · Instrument № 13</div>
</header>

<nav id="cabinet" aria-label="The cabinet">
  <div class="cab-h">Temporal Position</div>
  <div id="cab-date">—</div>
  <div id="cab-time">—</div>
  <div id="cab-jd">JD —</div>

  <div class="cab-h">Excursion</div>
  <input id="jump" type="datetime-local" aria-label="Jump to date">
  <div class="cab-note">Set a date above, or work the throttle lever below the dial.</div>

  <div class="cab-h">Inscriptions</div>
  <div class="cab-row"><span>The Rose of Venus</span>
    <button type="button" class="switch on" id="rose-toggle">Shown</button></div>
  <div class="cab-note">Eight years of Venus's geocentric wandering, traced upon the base plate — the five-petalled figure she draws in our sky.</div>

  <div class="cab-h">Terrestrial Resonance</div>
  <canvas id="res-scope" width="480" height="80"></canvas>
  <div class="cab-row"><span class="cab-note" style="margin:0">fundamental 7.83 Hz</span>
    <button type="button" class="switch" id="res-toggle">Sound</button></div>

  <div class="cab-h">Guild Doors</div>
  <ul class="cab-doors">
    <li><a href="/"><b>Station</b><span>timetravellersguild.com</span></a></li>
    <li><a href="/now"><b>NOW</b><span>entrance · tree</span></a></li>
    <li><a href="/now/tree"><b>Tree</b><span>living present</span></a></li>
    <li><a href="/hub/"><b>Hub</b><span>modes · avenues</span></a></li>
    <li><a href="/machine"><b>Machine</b><span>field engine</span></a></li>
    <li><a href="/watch/"><b>Watch</b><span>instrument №14</span></a></li>
    <li><a href="/view"><b>View</b><span>optical plate</span></a></li>
    <li><a href="/film/"><b>Film</b><span>Guild cinema</span></a></li>
    <li><a href="/feed/"><b>Feed</b><span>signals in</span></a></li>
    <li><a href="/jack"><b>Jack</b><span>navigator</span></a></li>
    <li><a href="/join/"><b>Join</b><span>arrival</span></a></li>
    <li><a href="/field/"><b>Field</b><span>open ground</span></a></li>
    <li><a href="/calendar/"><b>Calendar</b><span>appointments</span></a></li>
    <li><a href="/research/"><b>Research</b><span>notes</span></a></li>
    <li><a href="/archive/"><b>Archive</b><span>held stock</span></a></li>
    <li><a href="/signals/"><b>Signals</b><span>outgoing</span></a></li>
  </ul>

  <div class="cab-h">Ffilm</div>
  <ul class="cab-doors">
    <li><a href="https://ffilm.org/"><b>Ffilm.org</b><span>house of film</span></a></li>
    <li><a href="https://ffilm.org/visitors/"><b>Visitors</b><span>house counter</span></a></li>
  </ul>
  <div class="cab-note">Civilian biwheel rebuild continues at <a href="https://chronometer.online/" style="color:var(--brass)">chronometer.online</a>. This plate is the Guild’s open instrument №13.</div>

  <div class="cab-h">On Accuracy</div>
  <div class="cab-note">Positions hold to a few arcminutes near the present era — verified against recorded eclipses and outer-planet sign ingresses. Pluto follows an approximation sound between roughly 1900 and 2100; beyond that window, trust him not. Mark also: the Moon travels her own breadth each hour, some thirteen degrees a day. For natal work, the exact hour and place matter greatly; dates entered here are read in this device's local time. When Sol and Luna truly meet or oppose, the instrument draws a golden thread through the Earth. Consult a professional ephemeris before setting store by any chart.</div>

  <div class="cab-h">Handling</div>
  <div class="cab-note">Drag to tilt and turn. Pinch or scroll to draw near or away. Touch a wandering body for its dossier. The ◉ seal veils all instruments.</div>
</nav>

<section id="dossier" class="panel hud" aria-label="Selected body">
  <button type="button" id="do-close" aria-label="Close">✕</button>
  <div id="do-glyph">☉</div>
  <div id="do-name">Sol</div>
  <div id="do-sign">—</div>
  <div class="do-row"><span>ECLIPTIC LON</span><b id="do-lon">—</b></div>
  <div class="do-row"><span>MOTION</span><b id="do-motion">—</b></div>
  <div class="do-row" id="do-extra-row" style="display:none"><span id="do-extra-k">—</span><b id="do-extra-v">—</b></div>
  <div class="do-row" id="do-elong-row" style="display:none"><span>ELONG. FROM SOL</span><b id="do-elong-v">—</b></div>
  <button type="button" class="switch" id="do-pin">Draw near</button>
</section>

<section id="throttle" class="panel hud" aria-label="Time travel controls">
  <div class="th-label">Temporal Throttle</div>
  <div id="th-top">
    <button type="button" class="th-btn" id="btn-x1" title="True time">×1</button>
    <input id="lever" type="range" min="-1000" max="1000" value="40" step="1"
      aria-label="Rate of temporal travel">
    <button type="button" class="th-btn" id="btn-now" title="Return to the present">NOW</button>
  </div>
  <div id="th-caption"><span id="th-rate">true time</span><span id="th-disp"></span></div>
</section>

<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
<script src="/chronometer/js/chronometer.js?v=<?= ttg_h($jsV) ?>"></script>
</body>
</html>
