<?php
declare(strict_types=1);

/**
 * THE LEDGER — a collective book of collages.
 *
 * A signed-in traveller cobbles a page together in the composer (layered
 * screenshots, blended and masked), keeps it as a private slip, and punches
 * it into the ledger when it is ready. The ledger is a public book, in the
 * manner of /passport. A keeper may tend any page.
 *
 * Auth is the people register (magic link, cookie ttg_people_session).
 * Keeper is the canonical ttg_guild_keeper() from /inc/graph.php.
 * Storage: people/data/ledger.sqlite + people/data/ledger/<entry>/ images,
 * all under the existing people/data "Require all denied" guard and only
 * ever served through /ledger/img.php.
 */

require_once dirname(__DIR__, 2) . '/people/inc/db.php';
require_once dirname(__DIR__, 2) . '/inc/graph.php';

const TTG_LEDGER_MAX_TITLE = 120;
const TTG_LEDGER_MAX_NOTE = 1400;
const TTG_LEDGER_MAX_LAYERS = 24;
const TTG_LEDGER_MAX_IMG_BYTES = 9000000;
const TTG_LEDGER_MAX_BODY = 64000000;
const TTG_LEDGER_SAVE_LIMIT = 60;
const TTG_LEDGER_PAGE_W = 1000;
const TTG_LEDGER_PAGE_H = 1400;
/** Burnt pages stay in the ashes this long before they are purged for good. */
const TTG_LEDGER_ASH_DAYS = 30;

const TTG_LEDGER_BLENDS = [
    'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'difference', 'exclusion', 'hard-light', 'soft-light', 'color-dodge',
    'color-burn', 'hue', 'saturation', 'color', 'luminosity',
];

function ttg_ledger_data_dir(): string {
    return dirname(__DIR__, 2) . '/people/data';
}

function ttg_ledger_store_dir(): string {
    $dir = ttg_ledger_data_dir() . '/ledger';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

function ttg_ledger_db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $pdo = new PDO('sqlite:' . ttg_ledger_data_dir() . '/ledger.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec("CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        doc TEXT NOT NULL DEFAULT '{}',
        keeper_note TEXT NOT NULL DEFAULT '',
        edited_by INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        published_at INTEGER
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_ledger_status ON entries(status, published_at)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_ledger_user ON entries(user_id, updated_at)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS saves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )");
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_ledger_saves ON saves(user_id, created_at)');
    return $pdo;
}

function ttg_ledger_entry(int $id): ?array {
    $stmt = ttg_ledger_db()->prepare('SELECT * FROM entries WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function ttg_ledger_keeper(?array $user = null): bool {
    $user ??= ttg_current_user();
    if (!$user) return false;
    return ttg_guild_keeper([
        'known' => true,
        'name' => (string) ($user['display_name'] ?? ''),
        'slug' => (string) ($user['slug'] ?? ''),
        'email' => (string) ($user['email'] ?? ''),
    ]);
}

function ttg_ledger_can_edit(array $entry, ?array $user): bool {
    if (!$user) return false;
    if ((int) $entry['user_id'] === (int) $user['id']) return true;
    return ttg_ledger_keeper($user);
}

function ttg_ledger_rate_ok(int $userId): bool {
    $db = ttg_ledger_db();
    $db->prepare('DELETE FROM saves WHERE created_at < ?')->execute([time() - 7200]);
    $stmt = $db->prepare('SELECT COUNT(*) FROM saves WHERE user_id = ? AND created_at >= ?');
    $stmt->execute([$userId, time() - 3600]);
    if ((int) $stmt->fetchColumn() >= TTG_LEDGER_SAVE_LIMIT) return false;
    $db->prepare('INSERT INTO saves(user_id, created_at) VALUES(?, ?)')->execute([$userId, time()]);
    return true;
}

function ttg_ledger_entry_dir(int $id): string {
    $dir = ttg_ledger_store_dir() . '/' . $id;
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

function ttg_ledger_clean_key(string $name): string {
    return preg_match('/^[a-z0-9_-]{1,64}$/', $name) === 1 ? $name : '';
}

function ttg_ledger_data_url(string $value): ?string {
    if (!str_starts_with($value, 'data:image/')) return null;
    $comma = strpos($value, ',');
    if ($comma === false) return null;
    $raw = base64_decode(substr($value, $comma + 1), true);
    return $raw === false ? null : $raw;
}

function ttg_ledger_valid_image(string $bytes): bool {
    if ($bytes === '' || strlen($bytes) > TTG_LEDGER_MAX_IMG_BYTES) return false;
    return str_starts_with($bytes, "\x89PNG\r\n\x1a\n")
        || str_starts_with($bytes, "\xff\xd8\xff")
        || str_starts_with($bytes, 'RIFF')
        || str_starts_with($bytes, 'GIF8');
}

/** Validate and normalise one layer from a posted document. */
function ttg_ledger_clean_layer(mixed $layer): ?array {
    if (!is_array($layer)) return null;
    $img = ttg_ledger_clean_key((string) ($layer['img'] ?? ''));
    if ($img === '') return null;
    $num = static fn (mixed $v, float $min, float $max, float $def): float => is_numeric($v) ? max($min, min($max, (float) $v)) : $def;
    $blend = (string) ($layer['blend'] ?? 'source-over');
    if (!in_array($blend, TTG_LEDGER_BLENDS, true)) $blend = 'source-over';
    return [
        'img' => $img,
        'name' => mb_substr(trim((string) ($layer['name'] ?? '')), 0, 60),
        'x' => $num($layer['x'] ?? null, -4000, 6000, 500),
        'y' => $num($layer['y'] ?? null, -4000, 6000, 700),
        'w' => $num($layer['w'] ?? null, 1, 4000, 400),
        'h' => $num($layer['h'] ?? null, 1, 4000, 400),
        'rot' => $num($layer['rot'] ?? null, -360, 360, 0),
        'blend' => $blend,
        'opacity' => $num($layer['opacity'] ?? null, 0, 1, 1),
        'masked' => !empty($layer['masked']),
        'hidden' => !empty($layer['hidden']),
    ];
}

function ttg_ledger_public_row(array $entry): array {
    $author = ttg_user_by_id((int) $entry['user_id']);
    $keeperTouched = !empty($entry['edited_by']) && (int) $entry['edited_by'] !== (int) $entry['user_id'];
    return [
        'id' => (int) $entry['id'],
        'title' => (string) $entry['title'],
        'note' => (string) $entry['note'],
        'author' => $author ? (string) $author['display_name'] : 'A traveller',
        'author_slug' => $author ? (string) $author['slug'] : '',
        'inked' => $entry['published_at'] ? gmdate('Y-m-d', (int) $entry['published_at']) : '',
        'keeper_note' => (string) $entry['keeper_note'],
        'keeper_touched' => $keeperTouched,
        'img' => '/ledger/img.php?e=' . (int) $entry['id'] . '&k=composite',
    ];
}

/** Purge pages that have lain in the ashes longer than TTG_LEDGER_ASH_DAYS. */
function ttg_ledger_purge_ashes(): void {
    $db = ttg_ledger_db();
    $stmt = $db->prepare("SELECT id FROM entries WHERE status = 'burnt' AND updated_at < ?");
    $stmt->execute([time() - TTG_LEDGER_ASH_DAYS * 86400]);
    foreach ($stmt->fetchAll() as $row) {
        $dir = ttg_ledger_store_dir() . '/' . (int) $row['id'];
        foreach (glob($dir . '/*.png') ?: [] as $f) @unlink($f);
        @rmdir($dir);
        $db->prepare("DELETE FROM entries WHERE id = ? AND status = 'burnt'")->execute([(int) $row['id']]);
    }
}
