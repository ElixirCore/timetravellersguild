<?php
declare(strict_types=1);

/**
 * Ledger API. POST JSON only, signed in only, CSRF header required.
 *   {op:"save", id?, title, note, publish, doc, composite, images, masks}
 *   {op:"mine"}                    → my slips (and every page, for a keeper)
 *   {op:"get", id}                 → one page's document (owner or keeper)
 *   {op:"withdraw", id}            → lift a page out of the ledger
 *   {op:"delete", id}              → burn a page and its images
 *   {op:"keeper", id, title, note, keeper_note}  → keeper tends a page
 */

ini_set('display_errors', '0');
require_once __DIR__ . '/inc/ledger.php';

header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    ttg_json(['ok' => false, 'error' => 'POST only.'], 405);
}

$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    if (strtolower((string) parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '')) !== strtolower($host)) {
        ttg_json(['ok' => false, 'error' => 'Wrong door.'], 403);
    }
}

if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$stored = (string) ($_SESSION['csrf'] ?? '');
session_write_close();
$given = (string) ($_SERVER['HTTP_X_CSRF'] ?? '');
if ($stored === '' || !hash_equals($stored, $given)) {
    ttg_json(['ok' => false, 'error' => 'The slip is unsigned. Reload the page.', 'reload' => true], 400);
}

$me = ttg_current_user();
if (!$me) {
    ttg_json(['ok' => false, 'error' => 'Sign in to write in the ledger.', 'signin' => true], 401);
}
$meId = (int) $me['id'];
$keeper = ttg_ledger_keeper($me);

$raw = file_get_contents('php://input', false, null, 0, TTG_LEDGER_MAX_BODY);
$in = json_decode(is_string($raw) ? $raw : '', true);
if (!is_array($in)) {
    ttg_json(['ok' => false, 'error' => 'Unreadable request.'], 400);
}
$op = (string) ($in['op'] ?? '');

try {
    switch ($op) {
        case 'save': {
            if (!$keeper && !ttg_ledger_rate_ok($meId)) {
                ttg_json(['ok' => false, 'error' => 'The clerk needs a breather. Try again within the hour.'], 429);
            }
            $id = (int) ($in['id'] ?? 0);
            $entry = $id > 0 ? ttg_ledger_entry($id) : null;
            if ($id > 0 && !$entry) ttg_json(['ok' => false, 'error' => 'No such page.'], 404);
            if ($entry && !ttg_ledger_can_edit($entry, $me)) {
                ttg_json(['ok' => false, 'error' => 'Only the traveller who inked this page, or a keeper, may change it.'], 403);
            }

            $title = mb_substr(trim((string) ($in['title'] ?? '')), 0, TTG_LEDGER_MAX_TITLE);
            $note = mb_substr(trim((string) ($in['note'] ?? '')), 0, TTG_LEDGER_MAX_NOTE);
            $publish = !empty($in['publish']);

            $doc = json_decode((string) ($in['doc'] ?? ''), true);
            if (!is_array($doc) || !is_array($doc['layers'] ?? null)) {
                ttg_json(['ok' => false, 'error' => 'The page description is unreadable.'], 422);
            }
            if (count($doc['layers']) > TTG_LEDGER_MAX_LAYERS) {
                ttg_json(['ok' => false, 'error' => 'Too many layers on one page.'], 422);
            }
            $layers = [];
            foreach ($doc['layers'] as $layer) {
                $clean = ttg_ledger_clean_layer($layer);
                if ($clean !== null) $layers[] = $clean;
            }
            $doc = ['v' => 1, 'page' => ['w' => TTG_LEDGER_PAGE_W, 'h' => TTG_LEDGER_PAGE_H], 'layers' => $layers];

            $composite = ttg_ledger_data_url((string) ($in['composite'] ?? ''));
            if ($composite === null || !ttg_ledger_valid_image($composite)) {
                ttg_json(['ok' => false, 'error' => 'The flattened page never arrived.'], 422);
            }

            $images = is_array($in['images'] ?? null) ? $in['images'] : [];
            $masks = is_array($in['masks'] ?? null) ? $in['masks'] : [];

            $now = time();
            if (!$entry) {
                ttg_ledger_db()->prepare('INSERT INTO entries(user_id, title, note, status, doc, created_at, updated_at) VALUES(?,?,?,?,?,?,?)')
                    ->execute([$meId, $title, $note, 'draft', json_encode($doc, JSON_UNESCAPED_SLASHES), $now, $now]);
                $id = (int) ttg_ledger_db()->lastInsertId();
                $entry = ttg_ledger_entry($id);
                if (!$entry) throw new RuntimeException('Entry vanished after insert');
            }
            $dir = ttg_ledger_entry_dir($id);

            foreach ($images as $key => $dataUrl) {
                $key = ttg_ledger_clean_key((string) $key);
                if ($key === '') continue;
                $bytes = ttg_ledger_data_url((string) $dataUrl);
                if ($bytes === null || !ttg_ledger_valid_image($bytes)) {
                    ttg_json(['ok' => false, 'error' => 'One of the images could not be read.'], 422);
                }
                file_put_contents($dir . '/img_' . $key . '.png', $bytes);
            }
            foreach ($masks as $key => $dataUrl) {
                $key = ttg_ledger_clean_key((string) $key);
                if ($key === '') continue;
                $maskPath = $dir . '/mask_' . $key . '.png';
                if ($dataUrl === null || $dataUrl === '') {
                    @unlink($maskPath);
                    continue;
                }
                $bytes = ttg_ledger_data_url((string) $dataUrl);
                if ($bytes === null || !ttg_ledger_valid_image($bytes)) {
                    ttg_json(['ok' => false, 'error' => 'One of the masks could not be read.'], 422);
                }
                file_put_contents($maskPath, $bytes);
            }

            foreach ($layers as $layer) {
                if (!is_file($dir . '/img_' . $layer['img'] . '.png')) {
                    ttg_json(['ok' => false, 'error' => 'A layer is missing its image.'], 422);
                }
            }
            file_put_contents($dir . '/composite.png', $composite);

            $keep = [];
            foreach ($layers as $layer) $keep[$layer['img']] = true;
            foreach (glob($dir . '/img_*.png') ?: [] as $f) {
                $k = substr(basename($f), 4, -4);
                if (!isset($keep[$k])) @unlink($f);
            }
            foreach (glob($dir . '/mask_*.png') ?: [] as $f) {
                $k = substr(basename($f), 5, -4);
                if (!isset($keep[$k])) @unlink($f);
            }

            $status = (string) $entry['status'];
            $publishedAt = $entry['published_at'] !== null ? (int) $entry['published_at'] : null;
            if ($publish && $status !== 'ledger') {
                $status = 'ledger';
                $publishedAt = $publishedAt ?: $now;
            }
            ttg_ledger_db()->prepare('UPDATE entries SET title=?, note=?, status=?, doc=?, updated_at=?, published_at=?, edited_by=? WHERE id=?')
                ->execute([$title, $note, $status, json_encode($doc, JSON_UNESCAPED_SLASHES), $now, $publishedAt, $meId, $id]);

            ttg_json(['ok' => true, 'id' => $id, 'status' => $status, 'url' => '/ledger/#entry-' . $id]);
        }

        case 'mine': {
            $out = ['ok' => true, 'keeper' => $keeper];
            $stmt = ttg_ledger_db()->prepare('SELECT id, title, status, updated_at, published_at FROM entries WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100');
            $stmt->execute([$meId]);
            $out['mine'] = array_map(static function (array $row): array {
                $row['id'] = (int) $row['id'];
                $row['thumb'] = '/ledger/img.php?e=' . (int) $row['id'] . '&k=composite';
                return $row;
            }, $stmt->fetchAll());
            if ($keeper) {
                $rows = ttg_ledger_db()->query("SELECT id, user_id, title, status, updated_at, published_at FROM entries ORDER BY updated_at DESC LIMIT 200")->fetchAll();
                $out['all'] = array_map(static function (array $row): array {
                    $author = ttg_user_by_id((int) $row['user_id']);
                    return [
                        'id' => (int) $row['id'],
                        'title' => (string) $row['title'],
                        'status' => (string) $row['status'],
                        'author' => $author ? (string) $author['display_name'] : 'A traveller',
                        'updated_at' => (int) $row['updated_at'],
                        'published_at' => $row['published_at'] !== null ? (int) $row['published_at'] : null,
                    ];
                }, $rows);
            }
            ttg_json($out);
        }

        case 'get': {
            $entry = ttg_ledger_entry((int) ($in['id'] ?? 0));
            if (!$entry) ttg_json(['ok' => false, 'error' => 'No such page.'], 404);
            if (!ttg_ledger_can_edit($entry, $me)) {
                ttg_json(['ok' => false, 'error' => 'Only the traveller who inked this page, or a keeper, may open it.'], 403);
            }
            $doc = json_decode((string) $entry['doc'], true);
            if (!is_array($doc)) $doc = ['v' => 1, 'page' => ['w' => TTG_LEDGER_PAGE_W, 'h' => TTG_LEDGER_PAGE_H], 'layers' => []];
            ttg_json([
                'ok' => true,
                'entry' => [
                    'id' => (int) $entry['id'],
                    'title' => (string) $entry['title'],
                    'note' => (string) $entry['note'],
                    'status' => (string) $entry['status'],
                    'keeper_note' => (string) $entry['keeper_note'],
                    'mine' => (int) $entry['user_id'] === $meId,
                ],
                'doc' => $doc,
                'img_base' => '/ledger/img.php?e=' . (int) $entry['id'],
            ]);
        }

        case 'withdraw': {
            $entry = ttg_ledger_entry((int) ($in['id'] ?? 0));
            if (!$entry) ttg_json(['ok' => false, 'error' => 'No such page.'], 404);
            if (!ttg_ledger_can_edit($entry, $me)) {
                ttg_json(['ok' => false, 'error' => 'Only the traveller who inked this page, or a keeper, may lift it.'], 403);
            }
            ttg_ledger_db()->prepare("UPDATE entries SET status='withdrawn', updated_at=? WHERE id=?")->execute([time(), (int) $entry['id']]);
            ttg_json(['ok' => true, 'status' => 'withdrawn']);
        }

        case 'delete': {
            $entry = ttg_ledger_entry((int) ($in['id'] ?? 0));
            if (!$entry) ttg_json(['ok' => false, 'error' => 'No such page.'], 404);
            if (!ttg_ledger_can_edit($entry, $me)) {
                ttg_json(['ok' => false, 'error' => 'Only the traveller who inked this page, or a keeper, may burn it.'], 403);
            }
            $dir = ttg_ledger_store_dir() . '/' . (int) $entry['id'];
            foreach (glob($dir . '/*.png') ?: [] as $f) @unlink($f);
            @rmdir($dir);
            ttg_ledger_db()->prepare('DELETE FROM entries WHERE id = ?')->execute([(int) $entry['id']]);
            ttg_json(['ok' => true]);
        }

        case 'keeper': {
            if (!$keeper) ttg_json(['ok' => false, 'error' => 'The ledger is tended by keepers.'], 403);
            $entry = ttg_ledger_entry((int) ($in['id'] ?? 0));
            if (!$entry) ttg_json(['ok' => false, 'error' => 'No such page.'], 404);
            $title = mb_substr(trim((string) ($in['title'] ?? $entry['title'])), 0, TTG_LEDGER_MAX_TITLE);
            $note = mb_substr(trim((string) ($in['note'] ?? $entry['note'])), 0, TTG_LEDGER_MAX_NOTE);
            $keeperNote = mb_substr(trim((string) ($in['keeper_note'] ?? '')), 0, TTG_LEDGER_MAX_NOTE);
            ttg_ledger_db()->prepare('UPDATE entries SET title=?, note=?, keeper_note=?, edited_by=?, updated_at=? WHERE id=?')
                ->execute([$title, $note, $keeperNote, $meId, time(), (int) $entry['id']]);
            ttg_json(['ok' => true]);
        }
    }
    ttg_json(['ok' => false, 'error' => 'Unknown operation.'], 400);
} catch (Throwable $e) {
    error_log('Guild ledger API: ' . get_class($e) . ': ' . $e->getMessage());
    ttg_json(['ok' => false, 'error' => 'The binding jammed. Try again.'], 500);
}
