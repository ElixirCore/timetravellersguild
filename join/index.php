<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
ttg_graph_boot_session();
$csrf = ttg_graph_csrf();
$viewer = ttg_graph_viewer();
$brief = ttg_briefing_read();
$briefNote = ttg_briefing_note($brief);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>JOIN — Time Travellers Guild</title>
<meta name="description" content="The clerk is holding a record. Complete the missing line. The slip is provisional, not canon.">
<meta name="theme-color" content="#d9cb9e">
<link rel="stylesheet" href="/assets/join.css">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
</head>
<body>
<noscript>
  <p>The clerk is holding a record. Complete the missing line before the field opens.</p>
  <p><a href="#join">The slip</a> · <a href="/people/auth/">The register</a> · <a href="/field/">The field</a></p>
</noscript>

<?= ttg_html_site_mark() ?>
<p class="presents">JOIN · A PROGRAMME · NOT CANON</p>

<header class="mast">
  <canvas id="jackPet" width="96" height="96" aria-label="Jack, clerk, holding the join hopper"></canvas>
  <div>
    <p id="jackForm">THE HOPPER IS OPEN TO ARRIVALS</p>
    <h1>JOIN</h1>
    <p class="lede">The record is already open. The Guild keeps no canon. A slip in your name has been filed before arrival. Complete the missing line and the clerk will hold the entry provisionally while you move through the public tree.</p>
  </div>
</header>

<p class="doors hero-doors">
  <a class="door primary" href="#join"><b>DOOR</b> PUNCH COORDINATES</a>
  <a class="door" href="/people/auth/"><b>DOOR</b> THE REGISTER</a>
  <a class="door" href="/field/"><b>DOOR</b> THE FIELD</a>
  <a class="door" href="/now"><b>DOOR</b> THE TREE</a>
  <?= ttg_html_navigator_door($viewer) ?>
  <a class="door" href="/jack"><b>DOOR</b> THE DESK</a>
  <a class="door" href="/square/"><b>DOOR</b> THE SQUARE</a>
  <a class="door" href="/jack/tarot/"><b>DOOR</b> PUNCHCARD TAROT</a>
</p>

<section class="journey" id="journey">
  <p class="eyebrow">FOUR STATIONS</p>
  <h2>The Guild journey</h2>
  <div class="slips">
    <article class="slip">
      <p class="beat-label">I · ARRIVAL</p>
      <h3>Try an instrument</h3>
      <p>A drop-in taster. No commitment. Hold a chronometer, hear a story, see what the Guild does.</p>
      <p class="mode">NOW</p>
    </article>
    <article class="slip">
      <p class="beat-label">II · INSTRUMENT</p>
      <h3>Make something real</h3>
      <p>A hands-on workshop: a short film, a star-chart, a soundscape, or a small working tool.</p>
      <p class="mode">PAST &amp; NOW</p>
    </article>
    <article class="slip">
      <p class="beat-label">III · SIGNAL</p>
      <h3>Send it forward</h3>
      <p>Publish or share what you made — into the Guild’s open tools, or a local showcase.</p>
      <p class="mode">FUTURE</p>
    </article>
    <article class="slip">
      <p class="beat-label">IV · GUILD</p>
      <h3>Bring the next arrival</h3>
      <p>Volunteer, mentor, or join a production. The people who run the Guild started at station one.</p>
      <p class="mode">HELD TOGETHER</p>
    </article>
  </div>
</section>

<section class="workshops">
  <p class="eyebrow">POP-UP FORMATS</p>
  <h2>Four working slips</h2>
  <div class="slips">
    <article class="slip">
      <p class="beat-label">PROGRAMME</p>
      <h3>Chronometer building</h3>
      <p>Assemble a working orrery and star-chart, and learn the astronomy that makes it move.</p>
    </article>
    <article class="slip">
      <p class="beat-label">RECOLLECTION</p>
      <h3>Oral history time capsule</h3>
      <p>Record a family or community story and send it forward through the archive.</p>
    </article>
    <article class="slip">
      <p class="beat-label">RECORD</p>
      <h3>Pocket film unit</h3>
      <p>A same-day short-film workshop using phones and free tools, ending in a public screening.</p>
    </article>
    <article class="slip">
      <p class="beat-label">CLASSIFICATION</p>
      <h3>A corner of the internet</h3>
      <p>Make a personal one-page site with free tools — and keep the keys to it.</p>
    </article>
  </div>
</section>

<section class="join" id="join">
  <article class="slip form-slip">
    <p class="beat-label">IBM 5081 · JOIN SLIP</p>
    <h2>Complete the missing line</h2>
    <p>The clerk already has a provisional entry in your name. Correct the record, state where you are speaking from, and the file will remain open.</p>
    <?php if ($briefNote !== ''): ?>
      <p class="brief-hold">Jack already holds your front-door briefing. It will be filed with this slip.</p>
      <p class="brief-note"><?= ttg_h($briefNote) ?></p>
    <?php endif; ?>
    <form id="joinForm">
      <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
      <input type="hidden" name="avatar_pixels" id="avatarPixels" value="[]">
      <label for="name">Name</label>
      <input id="name" name="name" type="text" required autocomplete="name" maxlength="80">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="email" maxlength="160">
      <label for="location">Nearest town or valley</label>
      <input id="location" name="location" type="text" placeholder="e.g. Abercrave" maxlength="120">
      <div class="stamp-block">
        <p class="beat-label">9×9 SIGNATURE</p>
        <div id="stampGrid" class="stamp-grid" role="grid" aria-label="Nine by nine signet"></div>
        <div class="stamp-tools">
          <label class="sr" for="stampColor">Colour</label>
          <input id="stampColor" type="color" value="#1e3a5f" title="Pick a colour">
          <button type="button" id="stampPick" class="ghost">Sample</button>
          <button type="button" id="stampFill" class="ghost">Fill</button>
          <button type="button" id="stampClear" class="ghost">Clear</button>
        </div>
        <div id="stampSwatches" class="stamp-swatches" aria-label="Stamp colour palette"></div>
      </div>
      <label for="mode">Where the clerk should place you</label>
      <select id="mode" name="mode">
        <option value="arrival">I · Arrival — send a taster</option>
        <option value="instrument">II · Instrument — I want to make something</option>
        <option value="guild">IV · Guild — I want to volunteer</option>
      </select>
      <p class="form-actions">
        <button type="submit" id="joinSubmit">FILE THE SLIP</button>
        <a class="door" href="/people/auth/"><b>DOOR</b> THE REGISTER</a>
      </p>
      <p class="status" id="status" role="status"><?= !empty($viewer['known']) ? 'The clerk already holds the record for ' . ttg_h((string) $viewer['name']) . '.' : 'Founded 2012, Dalston · Upper Swansea Valley' ?></p>
    </form>
  </article>
</section>

<nav id="dock" aria-label="NOW">
  <a href="/field/">FIELD</a>
  <a href="/now">TREE</a>
  <a href="/join/" aria-current="page">JOIN</a>
  <a href="/jack">JACK</a>
  <a href="/signals/">SIGNALS</a>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($viewer) ?>
</nav>

<script src="/jack/body/js/sprite.js"></script>
<script src="/assets/join.js"></script>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
