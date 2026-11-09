<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/inc/og.php';
require_once __DIR__ . '/inc/state.php';
$blueprint = require __DIR__ . '/inc/blueprint.php';

ttg_graph_boot_session();
$csrf = ttg_graph_csrf();

$bootQuery = [];
foreach (['t', 'k', 'mind', 'matter', 'focus', 'dc', 'x'] as $key) {
    if (isset($_GET[$key]) && (string) $_GET[$key] !== '') {
        $bootQuery[$key] = (string) $_GET[$key];
    }
}
$boot = ttg_machine_build_state($bootQuery);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover" />
<title>TIME MACHINE №13 — Time Travellers Guild</title>
<meta name="description" content="Instrument №13. A living computational body for the Guild graph. Operate the machine." />
<meta name="theme-color" content="#0a0c10" />
<?= function_exists('ttg_og_head') ? ttg_og_head() : '' ?>
<link rel="stylesheet" href="/machine/css/machine.css?v=9" />
</head>
<body>
<noscript>
  <main class="noscript">
    <h1>TIME MACHINE №13</h1>
    <p>The instrument needs ordinary JavaScript. The archive remains.</p>
    <p><a href="/">HOME</a> · <a href="/jack">JACK</a> · <a href="/now">NOW</a></p>
  </main>
</noscript>

<?= ttg_html_site_mark('MACHINE') ?>

<nav id="dock" aria-label="Guild">
  <button type="button" id="dockReadout">READOUT</button>
  <button type="button" id="dockField">FIELD</button>
  <button type="button" id="dockSound" class="dock-quiet">SOUND ON</button>
  <a href="/">HOME</a>
  <a href="/jack">JACK</a>
  <a href="/now">NOW</a>
</nav>

<div id="stage">
  <canvas id="gl" aria-label="Time Machine №13"></canvas>
</div>

<div id="flash" aria-hidden="true"></div>

<div id="hover-tip" hidden role="tooltip">
  <strong id="hover-tip-title"></strong>
  <span id="hover-tip-body"></span>
</div>

<section id="fallback" hidden>
  <header>
    <h1>TIME MACHINE №13</h1>
    <p class="eq">E = M / R<sup>(κ·ΔC)</sup></p>
  </header>
  <dl class="meters">
    <div><dt>LOCAL</dt><dd id="fbLocal">—</dd></div>
    <div><dt>MACHINE</dt><dd id="fbMachine">—</dd></div>
    <div><dt>EMERGY</dt><dd id="fbEmergy">—</dd></div>
  </dl>
  <label>MIND <input id="fbMind" type="range" min="0.001" max="1" step="0.001" /></label>
  <label>MATTER <input id="fbMatter" type="range" min="0.001" max="1" step="0.001" /></label>
  <label>Δ CONTEXT <input id="fbDc" type="range" min="0" max="1" step="0.001" disabled /></label>
  <label>κ <input id="fbKappa" type="range" min="0" max="3.33" step="0.01" /></label>
  <label>MACHINE PRESENT <input id="fbTime" type="datetime-local" /></label>
  <p id="fbJack" class="jack-line"></p>
  <ul id="fbCards"></ul>
</section>

<p id="intake" hidden>&#9673; RECEIVING NEW RECORDS</p>

<a id="recordLink" href="/n/" hidden>OPEN RECORD &#8599;</a>

<aside id="inspect" hidden>
  <button type="button" id="inspectClose" aria-label="Release card">×</button>
  <p class="kind" id="inspectType"></p>
  <h2 id="inspectTitle"></h2>
  <dl>
    <div><dt>OBSERVED</dt><dd id="inspectDate"></dd></div>
    <div><dt>STATUS</dt><dd id="inspectStatus"></dd></div>
    <div><dt>ID</dt><dd id="inspectId"></dd></div>
  </dl>
  <p id="inspectBody" class="inspect-body" hidden></p>
  <div id="inspectNerves" class="nerves" aria-live="polite"></div>
  <a id="inspectLink" href="/n/">OPEN RECORD</a>
  <button type="button" id="inspectRelease">RELEASE INTO MECHANISM</button>
</aside>


<aside id="readout" hidden aria-label="Instrument readout"></aside>

<p id="err" hidden></p>

<script>
window.TTG_MACHINE = <?= json_encode([
    'csrf' => $csrf,
    'api' => '/api/machine/state',
    'jack' => '/jack',
    'boot' => $boot,
    'blueprint' => $blueprint,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
</script>
<script src="https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/controls/OrbitControls.js"></script>
<script src="/machine/js/materials.js?v=21"></script>
<script src="/machine/js/emergy.js?v=21"></script>
<script src="/machine/js/crt.js?v=22"></script>
<script src="/machine/js/readout.js?v=21"></script>
<script src="/machine/js/feed-infinity.js?v=21"></script>
<script src="/machine/js/cards.js?v=28"></script>
<script src="/machine/js/core.js?v=1"></script>
<script src="/machine/js/sound.js?v=1"></script>
<script src="/machine/js/journey.js?v=1"></script>
<script src="/machine/js/actions.js?v=1"></script>
<script src="/machine/js/components-controls.js?v=1"></script>
<script src="/machine/js/components-displays.js?v=1"></script>
<script src="/machine/js/machine.js?v=30"></script>
</body>
</html>
