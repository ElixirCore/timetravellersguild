<?php
declare(strict_types=1);

/**
 * THE LEDGER — the collective book. Signed-in travellers may read it,
 * in the manner of /passport. Pages are punched in from the composer by
 * signed-in travellers; a keeper may tend any page.
 */

require_once __DIR__ . '/inc/ledger.php';

$me = ttg_current_user();
header('Cache-Control: no-store');

if (!$me) {
    $next = '/ledger/';
    ?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The Ledger — Time Travellers Guild</title>
<meta name="theme-color" content="#0e1418">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/ledger/assets/compose.css?v=1">
</head>
<body class="gate">
<main class="gate-card">
  <p class="beat-label">THE LEDGER · MEMBERS ONLY</p>
  <h1>THE COLLECTIVE BOOK</h1>
  <p>The ledger is for travellers on the register. Sign in with a magic link to read the book, cobble a page together, and punch it into the binding.</p>
  <p class="form-actions">
    <a class="door primary" href="<?= ttg_h(ttg_base('auth/') . '?next=' . rawurlencode($next)) ?>"><b>DOOR</b> SIGN IN</a>
    <a class="door" href="/people/"><b>DOOR</b> THE REGISTER</a>
  </p>
</main>
</body>
</html>
<?php
    exit;
}

$rows = ttg_ledger_db()->query("SELECT * FROM entries WHERE status = 'ledger' ORDER BY published_at ASC, id ASC LIMIT 400")->fetchAll();
$entries = array_map('ttg_ledger_public_row', $rows);
$keeper = ttg_ledger_keeper($me);
$json = json_encode([
    'entries' => $entries,
    'keeper' => $keeper,
    'signed_in' => (bool) $me,
    'me_slug' => (string) ($me['slug'] ?? ''),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) $json = '{"entries":[],"keeper":false,"signed_in":false}';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The Ledger — Time Travellers Guild</title>
<meta name="description" content="A collective book of time. Each page is a collage cobbled together by a traveller: screenshots composed, overlaid, blended and masked, then punched into the ledger.">
<meta name="theme-color" content="#0e1418">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/ledger/assets/book.css?v=1">
</head>
<body>
<div class="app">
  <div class="top">
    <h1>The Ledger</h1>
    <p>A collective book of time. Tap the cover or press Enter to open. Scroll or pinch to look closer.</p>
  </div>
  <div id="stage" tabindex="0" aria-label="The ledger, a book. Press Enter to open, arrow keys to turn pages, plus and minus to zoom.">
    <div id="zoom"><div class="scene"><div class="book" id="book"></div></div></div>
  </div>
  <div id="reader" aria-label="The ledger as plain text"></div>
  <div class="bar">
    <div class="group">
      <button type="button" id="prev">Back</button>
      <button type="button" id="next">Forward</button>
      <button type="button" id="reset">Reset zoom</button>
    </div>
    <div class="group">
      <span id="status" role="status" aria-live="polite"></span>
      <button type="button" id="readbtn" aria-pressed="false">Read as text</button>
      <a class="btn" href="/ledger/compose/"><?= $me ? '+ New page' : 'Sign in to compose' ?></a>
    </div>
  </div>
  <p class="note" id="note">Doors: <a href="/people/">the register</a> · <a href="/now">the tree</a> · <a href="/passport/">the passport</a>. A page is its traveller's own collage; a keeper tends the binding.</p>
</div>
<script>window.TTG_LEDGER=<?= $json ?>;</script>
<script src="/ledger/assets/book.js?v=2" defer></script>
</body>
</html>
