<?php
declare(strict_types=1);

/**
 * Serves ledger images from the guarded people/data store. The ledger is
 * members-only: a composite of a page in the ledger needs a signed-in
 * traveller. Layer sources, masks, and anything unpublished need the
 * traveller who inked the page, or a keeper.
 */

require_once __DIR__ . '/inc/ledger.php';

$id = (int) ($_GET['e'] ?? 0);
$kind = (string) ($_GET['k'] ?? '');
$f = ttg_ledger_clean_key((string) ($_GET['f'] ?? ''));

$entry = $id > 0 ? ttg_ledger_entry($id) : null;
if (!$entry) {
    http_response_code(404);
    exit('No such page.');
}

$name = '';
if ($kind === 'composite') {
    $name = 'composite.png';
} elseif (($kind === 'img' || $kind === 'mask') && $f !== '') {
    $name = $kind . '_' . $f . '.png';
} else {
    http_response_code(400);
    exit('Bad request.');
}

$path = ttg_ledger_store_dir() . '/' . (int) $entry['id'] . '/' . $name;
if (!is_file($path)) {
    http_response_code(404);
    exit('No such image.');
}

$shared = $kind === 'composite' && (string) $entry['status'] === 'ledger';
$me = ttg_current_user();
if (!$me) {
    http_response_code(403);
    exit('The ledger is for signed-in travellers.');
}
if (!$shared && !ttg_ledger_can_edit($entry, $me)) {
    http_response_code(403);
    exit('This slip is not yours to read.');
}

header('Content-Type: image/png');
header('Content-Length: ' . (string) filesize($path));
header('Cache-Control: ' . ($shared ? 'private, max-age=300' : 'private, no-store'));
header('X-Content-Type-Options: nosniff');
readfile($path);
