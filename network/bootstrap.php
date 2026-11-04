<?php
declare(strict_types=1);
/**
 * /network — shared bootstrap. Sits on the existing /people auth (magic link,
 * users table, ttg_people_session cookie). Adds only its own tables.
 */
require_once dirname(__DIR__) . '/people/inc/db.php';
require_once dirname(__DIR__) . '/people/inc/mail.php';

const NET_ROOMS = ['commons' => 'The Commons'];
const NET_MAX_BODY = 1000;

function net_db(): PDO {
    static $ready = false;
    $pdo = ttg_db();
    if (!$ready) {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS net_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room TEXT NOT NULL DEFAULT '',
                from_id INTEGER NOT NULL,
                to_id INTEGER,
                body TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                deleted INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(from_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_net_room ON net_messages(room, id);
            CREATE INDEX IF NOT EXISTS idx_net_dm_to ON net_messages(to_id, from_id, id);
            CREATE INDEX IF NOT EXISTS idx_net_from ON net_messages(from_id, created_at);
            CREATE TABLE IF NOT EXISTS net_reads (
                user_id INTEGER NOT NULL, peer_id INTEGER NOT NULL, last_id INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(user_id, peer_id)
            );
            CREATE TABLE IF NOT EXISTS net_blocks (
                user_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL,
                PRIMARY KEY(user_id, blocked_id)
            );
            CREATE TABLE IF NOT EXISTS net_presence (user_id INTEGER PRIMARY KEY, at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS net_signin_rate (k TEXT NOT NULL, at INTEGER NOT NULL);
            CREATE INDEX IF NOT EXISTS idx_net_rate ON net_signin_rate(k, at);
        ");
        $ready = true;
    }
    return $pdo;
}

function net_clean(string $s, int $max): string {
    $s = str_replace("\r\n", "\n", $s);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    $s = preg_replace("/\n{4,}/", "\n\n\n", $s) ?? $s;
    return mb_substr(trim($s), 0, $max);
}

function net_origin() : string {
    return preg_replace('#/people/?$#', '', ttg_base()) ?: 'https://timetravellersguild.com';
}

/** Same-origin check for state-changing requests. */
function net_same_origin(): bool {
    $o = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($o === '') return true; // non-browser or same-origin GET-like; CSRF token still required
    $host = strtolower((string) parse_url($o, PHP_URL_HOST));
    $mine = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $mine = preg_replace('/:\d+$/', '', $mine) ?? $mine;
    return $host !== '' && $host === $mine;
}

function net_csrf_ok(string $given): bool {
    $t = ttg_csrf_token(); // starts the session if needed
    $ok = $given !== '' && hash_equals($t, $given);
    return $ok;
}

/** Sliding-window limiter on net_signin_rate. Returns true if allowed (and records). */
function net_rate(string $key, int $limit, int $window): bool {
    $pdo = net_db();
    $now = time();
    $pdo->prepare('DELETE FROM net_signin_rate WHERE at < ?')->execute([$now - 86400]);
    $st = $pdo->prepare('SELECT COUNT(*) FROM net_signin_rate WHERE k = ? AND at >= ?');
    $st->execute([$key, $now - $window]);
    if ((int) $st->fetchColumn() >= $limit) return false;
    $pdo->prepare('INSERT INTO net_signin_rate(k, at) VALUES(?, ?)')->execute([$key, $now]);
    return true;
}

function net_ip_key(): string {
    return hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . (string) (ttg_config()['app_secret'] ?? ''));
}

/** Pre-fill a brand-new account from the person's own /join slip (matched by the email they just proved). */
function net_apply_join_slip(array $user): void {
    $file = dirname(__DIR__) . '/storage/join/applications.jsonl';
    if (!is_file($file) || !is_readable($file)) return;
    $email = strtolower((string) ($user['email'] ?? ''));
    if ($email === '') return;
    $size = (int) @filesize($file);
    $fh = @fopen($file, 'rb');
    if (!$fh) return;
    if ($size > 2000000) fseek($fh, -2000000, SEEK_END);
    $data = (string) stream_get_contents($fh);
    fclose($fh);
    $found = null;
    foreach (array_reverse(explode("\n", $data)) as $line) {
        if ($line === '' || stripos($line, $email) === false) continue;
        $row = json_decode($line, true);
        if (is_array($row) && strtolower((string) ($row['email'] ?? '')) === $email) { $found = $row; break; }
    }
    if (!$found) return;
    $sets = []; $args = [];
    $cells = ttg_pixel_parse($found['avatar_pixels'] ?? []);
    if (!ttg_pixel_has_ink(ttg_pixel_parse($user['avatar_pixels'] ?? '')) && ttg_pixel_has_ink($cells)) {
        $sets[] = 'avatar_pixels = ?'; $args[] = ttg_pixel_encode($cells);
    }
    if (trim((string) ($user['location'] ?? '')) === '' && !empty($found['location'])) {
        $sets[] = 'location = ?'; $args[] = mb_substr(net_clean((string) $found['location'], 120), 0, 120);
    }
    $created = strtotime((string) ($user['created_at'] ?? '')) ?: 0;
    if ($created > time() - 900 && !empty($found['name'])) {
        $sets[] = 'display_name = ?'; $args[] = mb_substr(net_clean((string) $found['name'], 80), 0, 80);
    }
    if (!$sets) return;
    $args[] = (int) $user['id'];
    net_db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);
}
