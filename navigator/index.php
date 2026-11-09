<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
ttg_graph_boot_session();
if (!ttg_guild_keeper()) {
    header('Location: /now', true, 302);
    exit;
}
$field = ttg_graph_navigator_field();
$json = json_encode($field, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '{"nodes":[],"edges":[],"viewer":{"keeper":false},"present":{}}';
}
$enter = ttg_graph_punch_enter(ttg_graph_viewer());
if (is_array($enter)) {
    $field['punches'][] = $enter;
    $field['punch_tip'] = (string) ($enter['hash'] ?? $field['punch_tip'] ?? '');
    $field['on_tape'] = ttg_graph_punch_present();
}
$keeper = !empty($field['viewer']['keeper']);
$you = ttg_graph_punch_who(ttg_graph_viewer());
$pendingN = 0;
foreach ($field['nodes'] as $n) {
    if (!empty($n['pending'])) $pendingN++;
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>NAVIGATOR — Time Travellers Guild</title>
<meta name="description" content="Walk the timetree. Pending slips are not canon. A keeper writes canon.">
<meta name="theme-color" content="#d9cb9e">
<link rel="stylesheet" href="/assets/navigator.css?v=5">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
</head>
<body>
<noscript>
  <p>The navigator is a projection of the same tree. Without JavaScript, the field is listed.</p>
  <p><a href="/field/">The field</a> · <a href="/n/">The list</a> · <a href="/jack/tarot/">Punchcard tarot</a></p>
  <ul>
    <?php foreach ($field['nodes'] as $n): ?>
      <li><?= !empty($n['pending']) ? 'PENDING · ' : '' ?><?= ttg_h((string) ($n['title'] ?? '')) ?> — <?= ttg_h((string) ($n['type'] ?? '')) ?> · <?= ttg_h((string) ($n['standing']['title'] ?? '')) ?></li>
    <?php endforeach; ?>
  </ul>
</noscript>

<?php readfile(dirname(__DIR__) . '/jack/tarot/svg/deck.svg'); ?>

<?= ttg_html_site_mark() ?>
<p class="presents">NAVIGATOR · <?= ttg_h((string) ($field['present']['network_label'] ?? '17.04.2033')) ?></p>

<label class="sr" for="treeSearch">Search the tree</label>
<input id="treeSearch" type="search" maxlength="120" autocomplete="off" spellcheck="false" placeholder="SEARCH THE TREE — TITLE · PLACE · SLUG">

<canvas id="tree" aria-label="The timetree, projected"></canvas>

<button type="button" id="btnFullscreen" aria-label="Toggle fullscreen tree view" title="Fullscreen / exit fullscreen">⛶</button>

<aside id="hud">
  <?= ttg_you_face($field['viewer'] ?? $you) ?>
  <p id="jackForm">WALKING THE TREE</p>
  <canvas id="jackPet" width="96" height="96" aria-label="Jack, clerk of the tree"></canvas>
  <p class="counts"><span id="countCanon"><?= count($field['nodes']) - $pendingN ?></span> CANON · <span id="countPending"><?= $pendingN ?></span> PENDING</p>
  <p class="filters" id="filters">
    <button type="button" data-filter="all" class="on">ALL</button>
    <button type="button" data-filter="canon">CANON</button>
    <button type="button" data-filter="pending">PENDING</button>
    <button type="button" data-filter="root">ROOT</button>
    <button type="button" data-filter="trunk">TRUNK</button>
    <button type="button" data-filter="branch">BRANCH</button>
    <button type="button" data-filter="leaf">LEAF</button>
    <button type="button" data-filter="fruit">FRUIT</button>
  </p>
</aside>

<article id="slip" hidden>
  <button type="button" id="slipClose" aria-label="Close record">✕</button>
  <p class="beat-label" id="slipStanding"></p>
  <p class="slip-title" id="slipTitle"></p>
  <p class="slip-meta" id="slipMeta"></p>
  <p class="beat-text" id="slipBody"></p>
  <p class="slip-why" id="slipWhy"></p>
  <p class="slip-actions">
    <a id="slipOpen" href="/n/">THE RECORD</a>
    <a id="slipOrigin" href="/navigator/" target="_blank" rel="noopener" style="display:none">ORIGIN TEXT</a>
    <?php if ($keeper): ?>
      <button type="button" id="btnEdit" hidden>EDIT SLIP</button>
      <button type="button" id="btnConfirm" hidden>PUNCH INTO CANON</button>
      <button type="button" id="btnReject" hidden>RETURN SLIP</button>
      <button type="button" id="btnDelete" hidden>DELETE RECORD</button>
    <?php endif; ?>
  </p>
  <?php if ($keeper): ?>
  <div id="slipEditForm" hidden>
    <label class="edit-label" for="editTitle">TITLE</label>
    <input id="editTitle" type="text" maxlength="120" placeholder="Title of the record">
    <label class="edit-label" for="editBody">BODY</label>
    <textarea id="editBody" maxlength="1400" rows="4" placeholder="Description · observations"></textarea>
    <div class="edit-row">
      <span>
        <label class="edit-label" for="editType">TYPE</label>
        <input id="editType" type="text" maxlength="40" placeholder="PERSON / EVENT / …">
      </span>
      <span>
        <label class="edit-label" for="editYear">YEAR</label>
        <input id="editYear" type="number" min="1900" max="2100" placeholder="e.g. 2026">
      </span>
    </div>
    <div class="edit-row">
      <span>
        <label class="edit-label" for="editZone">ZONE</label>
        <select id="editZone">
          <option value="root">ROOT</option>
          <option value="trunk">TRUNK</option>
          <option value="branch">BRANCH</option>
          <option value="leaf" selected>LEAF</option>
          <option value="fruit">FRUIT</option>
        </select>
      </span>
      <span>
        <label class="edit-label" for="editPlace">PLACE</label>
        <input id="editPlace" type="text" maxlength="80" placeholder="Location">
      </span>
    </div>
    <p class="slip-actions edit-actions">
      <button type="button" id="btnSavePending">SAVE CHANGES</button>
      <button type="button" id="btnEditCancel">CANCEL</button>
    </p>
    <p class="slip-note" id="editNote"></p>
  </div>
  <?php endif; ?>
  <p class="slip-hash" id="slipHash" hidden></p>
  <p class="slip-note" id="slipNote"><?= $keeper ? 'A punch cannot be unpunched. Observation is not rewritten.' : 'Pending is not canon. A keeper punches canon.' ?></p>
</article>

<p class="doors">
  <a class="door" href="/now"><b>DOOR</b> THE TREE</a>
  <a class="door" href="/"><b>DOOR</b> JACK</a>
  <a class="door" href="/field/"><b>DOOR</b> THE FIELD</a>
  <a class="door" href="/jack/tarot/"><b>DOOR</b> PUNCHCARD TAROT</a>
  <a class="door" href="/n/"><b>DOOR</b> THE LIST</a>
  <a class="door" href="/join/"><b>DOOR</b> THE PROGRAMME</a>
</p>

<section id="tape" aria-label="Punch stream, hash-chained">
  <p class="tape-mark">CCTV · APPEND-ONLY · SHA-256 · YOU <?= ttg_you_face($field['viewer'] ?? []) ?><a id="tapeYou" href="<?= ttg_h((string) $you['href']) ?>"><?= ttg_h($you['known'] ? strtoupper($you['name'] . ($you['keeper'] ? ' · KEEPER' : '')) : 'UNSIGNED') ?></a> · TIP <code id="tapeTip"><?= ttg_h((string) ($field['punch_tip'] ?? '')) ?></code></p>
  <p class="tape-present" id="tapePresent" aria-label="Logged in on the tape"></p>
  <div id="tapeTrack"></div>
</section>

<script>window.TTG_TREE=<?= $json ?>;</script>
<script src="/jack/body/js/sprite.js"></script>
<script src="/assets/navigator.js?v=10"></script>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
