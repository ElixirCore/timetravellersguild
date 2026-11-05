<?php
/*
 * Guild game: state and rules for authored episodes on the Passport Map.
 * Storage: people/data/game.sqlite (its own file; never touches arg.sqlite, the trails or the passport register).
 * No model calls. Plot, rules and Jack's lines come from episode.php; state transitions are enforced here.
 */
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/people/inc/db.php';

function game_db(): PDO {
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    $path = dirname(__DIR__, 2) . '/people/data/game.sqlite';
    $pdo = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_TIMEOUT => 5]);
    $pdo->exec('PRAGMA journal_mode = WAL'); $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS game_runs (
        user_id INTEGER NOT NULL, ep TEXT NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER,
        PRIMARY KEY (user_id, ep));
      -- One row per traveller per stub: their own carbon copy of the receipt.
      CREATE TABLE IF NOT EXISTS game_stubs (
        user_id INTEGER NOT NULL, ep TEXT NOT NULL, stub TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'found',        -- found | returned | kept
        ret_year INTEGER, lng REAL, lat REAL,
        receipt TEXT NOT NULL DEFAULT '', audience TEXT NOT NULL DEFAULT 'me',   -- me | guild
        found_at INTEGER NOT NULL, decided_at INTEGER,
        PRIMARY KEY (user_id, ep, stub));
      -- Receipt 0001 is one shared object. Each traveller who reaches it may move it once; the chain is kept.
      CREATE TABLE IF NOT EXISTS game_custody (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ep TEXT NOT NULL, stub TEXT NOT NULL, user_id INTEGER NOT NULL,
        action TEXT NOT NULL,                        -- returned | signed | unsigned
        note TEXT NOT NULL DEFAULT '', audience TEXT NOT NULL DEFAULT 'me', lng REAL, lat REAL, created_at INTEGER NOT NULL,
        UNIQUE (ep, stub, user_id));
      CREATE INDEX IF NOT EXISTS idx_game_stubs_ep ON game_stubs(ep, stub, state);
    ");
    return $pdo;
}

function game_episode(): array {
    static $ep;
    return $ep ??= require __DIR__ . '/episode.php';
}

function game_json(array $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function game_clean(string $s, int $max): string {
    if (function_exists('mb_scrub')) $s = mb_scrub($s, 'UTF-8');
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]|[\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u', '', $s) ?? '';
    $s = trim(preg_replace("/\n{3,}/", "\n\n", str_replace(["\r\n", "\r"], "\n", $s)) ?? '');
    return mb_substr($s, 0, $max);
}

function game_name(int $uid): string {
    $u = ttg_user_by_id($uid);
    return $u ? (string) $u['display_name'] : 'A traveller';
}

/** Metres between two points. */
function game_dist(float $lat1, float $lng1, float $lat2, float $lng2): float {
    $t = M_PI / 180; $dLat = ($lat2 - $lat1) * $t; $dLng = ($lng2 - $lng1) * $t;
    $a = sin($dLat / 2) ** 2 + cos($lat1 * $t) * cos($lat2 * $t) * sin($dLng / 2) ** 2;
    return 2 * 6371000 * asin(min(1, sqrt($a)));
}

/** A traveller's own stubs, keyed A..D. */
function game_my_stubs(int $uid, string $ep): array {
    $st = game_db()->prepare('SELECT * FROM game_stubs WHERE user_id = ? AND ep = ?');
    $st->execute([$uid, $ep]);
    $out = [];
    foreach ($st->fetchAll() as $r) $out[$r['stub']] = $r;
    return $out;
}

/** Which stub the traveller should look for next, or null. A, B, C in order; D once A to C are decided. */
function game_next_stub(array $mine): ?string {
    foreach (['A', 'B', 'C'] as $k) if (!isset($mine[$k])) return $k;
    foreach (['A', 'B', 'C'] as $k) if ($mine[$k]['state'] === 'found') return null; // decide what you hold first
    return isset($mine['D']) ? null : 'D';
}

function game_decided_count(array $mine): int {
    $n = 0;
    foreach (['A', 'B', 'C'] as $k) if (isset($mine[$k]) && $mine[$k]['state'] !== 'found') $n++;
    return $n;
}

/**
 * The shared Jack: what he still remembers, given every traveller's decisions.
 * A stub's memory is HELD while nobody has returned it, FRAYING while keeps at least match returns, GONE once returns outnumber keeps.
 * Receipt 0001 follows the head of its custody chain.
 */
function game_memory(string $ep, int $uid): array {
    $db = game_db(); $E = game_episode(); $out = [];
    foreach (['A', 'B', 'C'] as $k) {
        $st = $db->prepare("SELECT SUM(state = 'returned') r, SUM(state = 'kept') k, COUNT(*) n FROM game_stubs WHERE ep = ? AND stub = ? AND state != 'found'");
        $st->execute([$ep, $k]); $c = $st->fetch();
        $r = (int) ($c['r'] ?? 0); $kp = (int) ($c['k'] ?? 0);
        $state = $r === 0 ? 'held' : ($kp >= $r ? 'fraying' : 'gone');
        $rc = $db->prepare("SELECT user_id, receipt, ret_year, decided_at FROM game_stubs WHERE ep = ? AND stub = ? AND state = 'returned' AND audience = 'guild' AND receipt != '' ORDER BY decided_at DESC LIMIT 6");
        $rc->execute([$ep, $k]);
        $out[$k] = ['stub' => $k, 'no' => $E['stubs'][$k]['no'], 'name' => $E['stubs'][$k]['name'], 'state' => $state, 'returned' => $r, 'kept' => $kp,
            'memory' => $state === 'gone' ? null : $E['stubs'][$k]['memory'],
            'receipts' => array_map(fn($x) => ['who' => game_name((int) $x['user_id']), 'mine' => (int) $x['user_id'] === $uid, 'text' => $x['receipt'], 'year' => $x['ret_year'] !== null ? (int) $x['ret_year'] : null], $rc->fetchAll())];
    }
    $chain = game_chain($ep, $uid);
    $head = $chain ? end($chain)['action'] : null;
    $out['D'] = ['stub' => 'D', 'no' => '0001', 'name' => $E['stubs']['D']['name'], 'state' => $head === 'returned' ? 'gone' : ($head === 'unsigned' ? 'open' : 'held'),
        'head' => $head, 'memory' => $head === 'returned' ? null : $E['stubs']['D']['memory'], 'receipts' => []];
    return $out;
}

/** Receipt 0001's custody chain, oldest first. Private entries show the action but not the name or note. */
function game_chain(string $ep, int $uid): array {
    $st = game_db()->prepare("SELECT * FROM game_custody WHERE ep = ? AND stub = 'D' ORDER BY id ASC");
    $st->execute([$ep]);
    return array_map(function ($r) use ($uid) {
        $public = $r['audience'] === 'guild'; $mine = (int) $r['user_id'] === $uid;
        return ['action' => $r['action'], 'who' => ($public || $mine) ? game_name((int) $r['user_id']) : 'A traveller', 'mine' => $mine,
            'note' => ($public || $mine) ? $r['note'] : '', 'private' => !$public, 'at' => (int) $r['created_at']];
    }, $st->fetchAll());
}

/** (unused in the simplified loop) Guild-visible set-down points from other travellers, for the map. Never live locations: only where someone chose to leave a stub, inside its ring. */
function game_marks(string $ep, int $uid): array {
    $st = game_db()->prepare("SELECT user_id, stub, ret_year, lng, lat, receipt, audience FROM game_stubs WHERE ep = ? AND state = 'returned' AND lng IS NOT NULL AND (audience = 'guild' OR user_id = ?)");
    $st->execute([$ep, $uid]);
    $marks = array_map(fn($r) => ['stub' => $r['stub'], 'year' => $r['ret_year'] !== null ? (int) $r['ret_year'] : null, 'lng' => (float) $r['lng'], 'lat' => (float) $r['lat'],
        'who' => game_name((int) $r['user_id']), 'mine' => (int) $r['user_id'] === $uid, 'receipt' => $r['receipt'], 'private' => $r['audience'] !== 'guild'], $st->fetchAll());
    $cs = game_db()->prepare("SELECT user_id, action, note, audience, lng, lat FROM game_custody WHERE ep = ? AND lng IS NOT NULL AND (audience = 'guild' OR user_id = ?) ORDER BY id");
    $cs->execute([$ep, $uid]);
    foreach ($cs->fetchAll() as $r) $marks[] = ['stub' => 'D', 'action' => $r['action'], 'lng' => (float) $r['lng'], 'lat' => (float) $r['lat'], 'who' => game_name((int) $r['user_id']),
        'mine' => (int) $r['user_id'] === $uid, 'receipt' => $r['note'], 'private' => $r['audience'] !== 'guild'];
    return $marks;
}

/** The client view of a stub. Text is only sent once the traveller has found it, so the plot is not in the page source ahead of play. */
function game_stub_view(string $k, ?array $row, bool $active): array {
    $s = game_episode()['stubs'][$k];
    $v = ['stub' => $k, 'no' => $s['no'], 'name' => $s['name'], 'place' => $s['place'], 'state' => $row['state'] ?? ($active ? 'seeking' : 'unseen')];
    if ($active || $row) $v += ['at' => ['lat' => $s['ring']['lat'], 'lng' => $s['ring']['lng']], 'year' => $s['year']];
    if ($row) {
        $v += ['front' => $s['front'], 'back' => $s['back'], 'real' => $s['real'], 'ask' => $s['ask'], 'canon' => $s['canon'] ?? null,
            'memory' => $s['memory'], 'lost' => $s['lost'] ?? null, 'choices' => $s['choices'] ?? null,
            'ret_year' => $row['ret_year'] !== null ? (int) $row['ret_year'] : null, 'receipt' => $row['receipt'], 'audience' => $row['audience'],
            'lng' => $row['lng'] !== null ? (float) $row['lng'] : null, 'lat' => $row['lat'] !== null ? (float) $row['lat'] : null];
        if ($row['state'] === 'returned' && $row['ret_year'] !== null) $v['said'] = ($s['returned'][(int) $row['ret_year']] ?? '') . ' ' . ($s['after_return'] ?? '');
        if ($row['state'] === 'kept') $v['said'] = $s['kept'] ?? '';
    }
    return $v;
}
