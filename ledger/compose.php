<?php
declare(strict_types=1);

/**
 * THE COMPOSER — cobble a page together: screenshots and images layered,
 * arranged, overlaid, blended and masked. Save a private slip, or punch
 * the page into the ledger. Signed-in travellers only; a keeper may open
 * and tend any page.
 */

require_once __DIR__ . '/inc/ledger.php';

$me = ttg_current_user();
header('Cache-Control: no-store');

if (!$me) {
    $next = '/ledger/compose/';
    $id = (int) ($_GET['id'] ?? 0);
    if ($id > 0) $next .= '?id=' . $id;
    ?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Compose — The Ledger — Time Travellers Guild</title>
<meta name="theme-color" content="#0e1418">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/ledger/assets/compose.css?v=1">
</head>
<body class="gate">
<main class="gate-card">
  <p class="beat-label">THE COMPOSER · MEMBERS ONLY</p>
  <h1>COBBLE A PAGE</h1>
  <p>The composer is for travellers on the register. Sign in with a magic link to compose, blend, mask and punch a page into the ledger.</p>
  <p class="form-actions">
    <a class="door primary" href="<?= ttg_h(ttg_base('auth/') . '?next=' . rawurlencode($next)) ?>"><b>DOOR</b> SIGN IN</a>
    <a class="door" href="/ledger/"><b>DOOR</b> READ THE LEDGER</a>
  </p>
</main>
</body>
</html>
<?php
    exit;
}

$keeper = ttg_ledger_keeper($me);
$entryId = (int) ($_GET['id'] ?? 0);
$boot = [
    'csrf' => ttg_csrf_token(),
    'keeper' => $keeper,
    'me' => (string) $me['display_name'],
    'id' => 0,
    'title' => '',
    'note' => '',
    'status' => 'new',
    'keeper_note' => '',
    'doc' => ['v' => 1, 'page' => ['w' => TTG_LEDGER_PAGE_W, 'h' => TTG_LEDGER_PAGE_H], 'layers' => []],
    'img_base' => '',
];
if ($entryId > 0) {
    $entry = ttg_ledger_entry($entryId);
    if (!$entry || !ttg_ledger_can_edit($entry, $me)) {
        http_response_code(403);
        exit('Only the traveller who inked this page, or a keeper, may open it.');
    }
    $doc = json_decode((string) $entry['doc'], true);
    if (!is_array($doc)) $doc = ['v' => 1, 'page' => ['w' => TTG_LEDGER_PAGE_W, 'h' => TTG_LEDGER_PAGE_H], 'layers' => []];
    $boot['id'] = (int) $entry['id'];
    $boot['title'] = (string) $entry['title'];
    $boot['note'] = (string) $entry['note'];
    $boot['status'] = (string) $entry['status'];
    $boot['keeper_note'] = (string) $entry['keeper_note'];
    $boot['doc'] = $doc;
    $boot['img_base'] = '/ledger/img.php?e=' . (int) $entry['id'];
}
$json = json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) $json = '{}';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>The Composer — The Ledger — Time Travellers Guild</title>
<meta name="theme-color" content="#0e1418">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/ledger/assets/compose.css?v=1">
</head>
<body>
<header class="top">
  <div class="top-left">
    <a class="wordmark" href="/ledger/">THE LEDGER</a>
    <span class="beat">THE COMPOSER<?= $keeper ? ' · KEEPER' : '' ?></span>
  </div>
  <div class="top-actions">
    <span id="saveStatus" class="save-status" role="status" aria-live="polite"></span>
    <button type="button" id="btnSave" class="btn">Save slip</button>
    <button type="button" id="btnPublish" class="btn gold">Punch into the ledger</button>
  </div>
</header>

<div class="bench">
  <aside class="side" id="side" aria-label="Layers">
    <p class="beat-label">LAYERS · TOP FIRST</p>
    <p class="hint">Add screenshots or images, or paste straight onto the page. Drag a layer to move it; drag its handles to scale and turn it. Blend and mask from the layer's row.</p>
    <ol id="layers" class="layers"></ol>
    <div class="side-actions">
      <label class="btn">Add images<input id="file" type="file" accept="image/*" multiple></label>
    </div>
    <div class="meta">
      <label>Title of the page <input id="title" type="text" maxlength="120" placeholder="Untitled" value="<?= ttg_h($boot['title']) ?>"></label>
      <label>A line it keeps (optional) <textarea id="note" rows="2" maxlength="1400" placeholder=""><?= ttg_h($boot['note']) ?></textarea></label>
      <?php if ($keeper && $boot['id'] > 0): ?>
      <label>Keeper's note <textarea id="keeperNote" rows="2" maxlength="1400" placeholder=""><?= ttg_h($boot['keeper_note']) ?></textarea></label>
      <?php endif; ?>
      <p class="hint" id="entryState"></p>
      <div class="side-actions">
        <button type="button" class="btn danger" id="btnWithdraw" hidden>Lift from the ledger</button>
        <button type="button" class="btn danger" id="btnDelete" hidden>Burn this page</button>
      </div>
    </div>
  </aside>

  <section class="stage-wrap">
    <div id="maskbar" class="maskbar" hidden>
      <span class="beat-label">MASK</span>
      <button type="button" class="btn on" id="maskErase">Erase</button>
      <button type="button" class="btn" id="maskRestore">Restore</button>
      <label>Brush <input type="range" id="brush" min="8" max="240" value="64"></label>
      <button type="button" class="btn" id="maskInvert">Invert</button>
      <button type="button" class="btn" id="maskClear">Clear</button>
      <button type="button" class="btn gold" id="maskDone">Done</button>
    </div>
    <div id="stage" class="stage">
      <canvas id="cv" width="1000" height="1400"></canvas>
      <canvas id="overlay" width="1000" height="1400"></canvas>
    </div>
  </section>
</div>

<script>window.TTG_COMPOSE=<?= $json ?>;</script>
<script src="/ledger/assets/compose.js?v=1" defer></script>
</body>
</html>
