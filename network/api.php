<?php
declare(strict_types=1);
ini_set('display_errors', '0');
require_once __DIR__ . '/bootstrap.php';
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function out(array $d, int $code = 200): never { ttg_json(['ok' => $code < 400] + $d, $code); }
function bad(string $m, int $code = 400): never { out(['error' => $m], $code); }

$user = ttg_current_user();
if (!$user) out(['error' => 'Sign in first.', 'signed_out' => true], 401);
$me = (int) $user['id'];
$pdo = net_db();
$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
$a = (string) ($_GET['a'] ?? '');
$now = time();

// presence (at most one write per 20 s)
$st = $pdo->prepare('SELECT at FROM net_presence WHERE user_id = ?'); $st->execute([$me]);
$last = (int) $st->fetchColumn();
if ($last < $now - 20) $pdo->prepare('INSERT OR REPLACE INTO net_presence(user_id, at) VALUES(?, ?)')->execute([$me, $now]);

$in = [];
if ($method === 'POST') {
    if (!net_same_origin()) bad('Cross-site request refused.', 403);
    $hdr = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $ok = net_csrf_ok($hdr);
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    if (!$ok) bad('Invalid request token. Reload the page.', 400);
    $raw = file_get_contents('php://input', false, null, 0, 60000);
    $in = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
    if (!is_array($in)) bad('Bad request body.');
} elseif ($method !== 'GET') {
    bad('GET or POST only.', 405);
}

function member_row(array $r, int $now, int $me): array {
    return [
        'id' => (int) $r['id'],
        'name' => (string) $r['display_name'],
        'slug' => (string) $r['slug'],
        'role' => (string) $r['role'],
        'location' => (string) $r['location'],
        'bio' => (string) $r['bio'],
        'avatar' => ttg_pixel_parse((string) ($r['avatar_pixels'] ?? '')),
        'public' => (int) $r['is_public'] === 1,
        'online' => (int) ($r['seen'] ?? 0) >= $now - 120,
        'you' => (int) $r['id'] === $me,
    ];
}
function members(PDO $pdo, int $me, int $now): array {
    $st = $pdo->prepare('SELECT u.id, u.display_name, u.slug, u.role, u.location, u.bio, u.avatar_pixels, u.is_public, p.at AS seen
        FROM users u LEFT JOIN net_presence p ON p.user_id = u.id
        WHERE u.is_public = 1 OR u.id = ? ORDER BY u.display_name COLLATE NOCASE LIMIT 500');
    $st->execute([$me]);
    return array_map(fn($r) => member_row($r, $now, $me), $st->fetchAll());
}
function find_member(PDO $pdo, int $id): ?array {
    $st = $pdo->prepare('SELECT id, is_public FROM users WHERE id = ?'); $st->execute([$id]);
    return $st->fetch() ?: null;
}
function blocked_either(PDO $pdo, int $a, int $b): bool {
    $st = $pdo->prepare('SELECT 1 FROM net_blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?) LIMIT 1');
    $st->execute([$a, $b, $b, $a]);
    return (bool) $st->fetchColumn();
}
function msg_out(array $m): array {
    return ['id' => (int) $m['id'], 'from' => (int) $m['from_id'], 'to' => $m['to_id'] === null ? null : (int) $m['to_id'],
            'room' => (string) $m['room'], 'body' => (string) $m['body'], 'at' => (int) $m['created_at']];
}
function threads(PDO $pdo, int $me): array {
    $st = $pdo->prepare("SELECT CASE WHEN from_id = :me THEN to_id ELSE from_id END AS peer, MAX(id) AS last_id
        FROM net_messages WHERE room = '' AND deleted = 0 AND (from_id = :me OR to_id = :me) GROUP BY peer ORDER BY last_id DESC LIMIT 100");
    $st->execute([':me' => $me]);
    $out = [];
    foreach ($st->fetchAll() as $t) {
        $peer = (int) $t['peer'];
        $m = $pdo->prepare('SELECT body, from_id, created_at FROM net_messages WHERE id = ?'); $m->execute([(int) $t['last_id']]);
        $last = $m->fetch() ?: ['body' => '', 'from_id' => 0, 'created_at' => 0];
        $r = $pdo->prepare('SELECT last_id FROM net_reads WHERE user_id = ? AND peer_id = ?'); $r->execute([$me, $peer]);
        $read = (int) $r->fetchColumn();
        $u = $pdo->prepare("SELECT COUNT(*) FROM net_messages WHERE room = '' AND deleted = 0 AND from_id = ? AND to_id = ? AND id > ?");
        $u->execute([$peer, $me, $read]);
        $out[] = ['peer' => $peer, 'last_id' => (int) $t['last_id'], 'preview' => mb_substr((string) $last['body'], 0, 80),
                  'mine' => (int) $last['from_id'] === $me, 'at' => (int) $last['created_at'], 'unread' => (int) $u->fetchColumn()];
    }
    return $out;
}

switch ($a) {
case 'boot':
    $cfg = [];
    foreach (NET_ROOMS as $slug => $label) {
        $r = $pdo->prepare("SELECT MAX(id) FROM net_messages WHERE room = ? AND deleted = 0"); $r->execute([$slug]);
        $cfg[] = ['slug' => $slug, 'label' => $label, 'last_id' => (int) $r->fetchColumn()];
    }
    $b = $pdo->prepare('SELECT blocked_id FROM net_blocks WHERE user_id = ?'); $b->execute([$me]);
    out(['me' => $me, 'members' => members($pdo, $me, $now), 'threads' => threads($pdo, $me), 'rooms' => $cfg,
         'blocked' => array_map('intval', $b->fetchAll(PDO::FETCH_COLUMN)), 'max_body' => NET_MAX_BODY]);

case 'members':
    out(['members' => members($pdo, $me, $now)]);

case 'threads':
    out(['threads' => threads($pdo, $me)]);

case 'room':
    $room = (string) ($_GET['room'] ?? '');
    if (!isset(NET_ROOMS[$room])) bad('No such room.', 404);
    $since = max(0, (int) ($_GET['since'] ?? 0));
    $blk = 'AND from_id NOT IN (SELECT blocked_id FROM net_blocks WHERE user_id = :me)';
    if ($since === 0) {
        $st = $pdo->prepare("SELECT * FROM net_messages WHERE room = :r AND deleted = 0 $blk ORDER BY id DESC LIMIT 60");
        $st->execute([':r' => $room, ':me' => $me]);
        $rows = array_reverse($st->fetchAll());
    } else {
        $st = $pdo->prepare("SELECT * FROM net_messages WHERE room = :r AND deleted = 0 AND id > :s $blk ORDER BY id ASC LIMIT 100");
        $st->execute([':r' => $room, ':s' => $since, ':me' => $me]);
        $rows = $st->fetchAll();
    }
    out(['messages' => array_map('msg_out', $rows)]);

case 'dm':
    $peer = (int) ($_GET['peer'] ?? 0);
    if ($peer < 1 || $peer === $me || !find_member($pdo, $peer)) bad('No such member.', 404);
    $since = max(0, (int) ($_GET['since'] ?? 0));
    $q = "SELECT * FROM net_messages WHERE room = '' AND deleted = 0 AND ((from_id = :me AND to_id = :p) OR (from_id = :p AND to_id = :me))";
    if ($since === 0) {
        $st = $pdo->prepare("$q ORDER BY id DESC LIMIT 80"); $st->execute([':me' => $me, ':p' => $peer]);
        $rows = array_reverse($st->fetchAll());
    } else {
        $st = $pdo->prepare("$q AND id > :s ORDER BY id ASC LIMIT 100"); $st->execute([':me' => $me, ':p' => $peer, ':s' => $since]);
        $rows = $st->fetchAll();
    }
    if ($rows) {
        $max = max(array_map(fn($r) => (int) $r['id'], $rows));
        $pdo->prepare('INSERT INTO net_reads(user_id, peer_id, last_id) VALUES(?,?,?)
            ON CONFLICT(user_id, peer_id) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)')->execute([$me, $peer, $max]);
    }
    $bl = $pdo->prepare('SELECT 1 FROM net_blocks WHERE user_id = ? AND blocked_id = ?'); $bl->execute([$me, $peer]);
    out(['messages' => array_map('msg_out', $rows), 'blocked' => (bool) $bl->fetchColumn()]);

case 'send':
    if ($method !== 'POST') bad('POST only.', 405);
    if ((int) $user['is_public'] !== 1) bad('Your slip is private. Make it public in "Your slip" to speak on the network.', 403);
    if (!ttg_pixel_has_ink(ttg_pixel_parse((string) ($user['avatar_pixels'] ?? '')))) bad('Paint your 9×9 signet first (Your slip).', 403);
    $body = net_clean((string) ($in['body'] ?? ''), NET_MAX_BODY);
    if ($body === '') bad('Nothing to send.');
    $st = $pdo->prepare('SELECT COUNT(*) FROM net_messages WHERE from_id = ? AND created_at >= ?'); $st->execute([$me, $now - 30]);
    if ((int) $st->fetchColumn() >= 12) bad('Slow down a moment.', 429);
    if (isset($in['room'])) {
        $room = (string) $in['room'];
        if (!isset(NET_ROOMS[$room])) bad('No such room.', 404);
        $pdo->prepare("INSERT INTO net_messages(room, from_id, to_id, body, created_at) VALUES(?, ?, NULL, ?, ?)")->execute([$room, $me, $body, $now]);
    } else {
        $to = (int) ($in['to'] ?? 0);
        $t = $to > 0 && $to !== $me ? find_member($pdo, $to) : null;
        if (!$t || (int) $t['is_public'] !== 1 || blocked_either($pdo, $me, $to)) bad('That member is not receiving messages.', 403);
        $pdo->prepare("INSERT INTO net_messages(room, from_id, to_id, body, created_at) VALUES('', ?, ?, ?, ?)")->execute([$me, $to, $body, $now]);
    }
    $id = (int) $pdo->lastInsertId();
    $m = $pdo->prepare('SELECT * FROM net_messages WHERE id = ?'); $m->execute([$id]);
    out(['message' => msg_out($m->fetch())]);

case 'delete':
    if ($method !== 'POST') bad('POST only.', 405);
    $id = (int) ($in['id'] ?? 0);
    $st = $pdo->prepare("UPDATE net_messages SET deleted = 1, body = '' WHERE id = ? AND from_id = ?");
    $st->execute([$id, $me]);
    out(['deleted' => $st->rowCount() === 1]);

case 'block':
    if ($method !== 'POST') bad('POST only.', 405);
    $id = (int) ($in['id'] ?? 0);
    if ($id < 1 || $id === $me || !find_member($pdo, $id)) bad('No such member.', 404);
    if (!empty($in['on'])) $pdo->prepare('INSERT OR IGNORE INTO net_blocks(user_id, blocked_id) VALUES(?, ?)')->execute([$me, $id]);
    else $pdo->prepare('DELETE FROM net_blocks WHERE user_id = ? AND blocked_id = ?')->execute([$me, $id]);
    out(['blocked' => !empty($in['on'])]);

case 'profile':
    if ($method !== 'POST') bad('POST only.', 405);
    $name = net_clean((string) ($in['display_name'] ?? ''), 80);
    if ($name === '') bad('A name is required on the slip.');
    $role = net_clean((string) ($in['role'] ?? ''), 80) ?: 'traveller';
    $loc = net_clean((string) ($in['location'] ?? ''), 120);
    $bio = net_clean((string) ($in['bio'] ?? ''), 600);
    $pub = !empty($in['is_public']) ? 1 : 0;
    $px = ttg_pixel_encode(is_array($in['avatar_pixels'] ?? null) ? $in['avatar_pixels'] : (string) ($in['avatar_pixels'] ?? ''));
    $pdo->prepare('UPDATE users SET display_name = ?, role = ?, location = ?, bio = ?, avatar_pixels = ?, is_public = ?, updated_at = ? WHERE id = ?')
        ->execute([$name, $role, $loc, $bio, $px, $pub, gmdate('c'), $me]);
    $st = $pdo->prepare('SELECT u.id, u.display_name, u.slug, u.role, u.location, u.bio, u.avatar_pixels, u.is_public, p.at AS seen FROM users u LEFT JOIN net_presence p ON p.user_id = u.id WHERE u.id = ?');
    $st->execute([$me]);
    out(['member' => member_row($st->fetch(), $now, $me)]);

default:
    bad('Unknown action.', 404);
}
