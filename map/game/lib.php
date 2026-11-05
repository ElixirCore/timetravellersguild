<?php
/*
 * The Desk: what travellers bring to the Passport Map, and what other travellers do with it.
 *
 *   A traveller LODGES something real at a place: a recollection, an object, a photograph or document, a name, a question.
 *   They say how they know it, and who may see it.
 *   Other travellers add HANDS to it: witness it, remember it differently, correct it with a source, or carry it to another
 *   place where it connects. Every hand is kept. Contradiction is kept, not resolved.
 *   Only the Keeper can accept an item to the Guild record (canon requires accountable human acceptance).
 *
 * Jack clerks, he does not author: the classification comes from what the traveller says about how they know,
 * the standing comes from the hands, and his lines are fixed filing slips. No model calls. No Common Room posts.
 *
 * Storage: people/data/game.sqlite. The earlier episode tables (game_runs, game_stubs, game_custody) are left as they are.
 */
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/people/inc/db.php';

const GAME_KEEPERS = [1];   // user ids who may accept items to the record (1 = Toby Godden, Keeper of Recollection)

const GAME_KINDS = ['recollection' => 'Recollection', 'object' => 'Object', 'document' => 'Photograph or document', 'name' => 'Name', 'question' => 'Question'];
// How the traveller knows it decides the class. Jack does not upgrade it.
const GAME_HOW = [
    'there' => ['label' => 'I was there', 'class' => 'OBSERVATION'],
    'told' => ['label' => 'I was told', 'class' => 'TESTIMONY'],
    'family' => ['label' => 'It is kept in my family', 'class' => 'RECOLLECTION'],
    'documented' => ['label' => 'It is documented (give the source)', 'class' => 'RECORD'],
    'asking' => ['label' => "I don't know: I'm asking", 'class' => 'OPEN QUESTION'],
];
const GAME_ACTS = ['witness' => 'witnessed it', 'differ' => 'remembers it differently', 'correct' => 'corrected it with a source', 'carry' => 'carried it'];

function game_db(): PDO {
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    $pdo = new PDO('sqlite:' . dirname(__DIR__, 2) . '/people/data/game.sqlite', null, null,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_TIMEOUT => 5]);
    $pdo->exec('PRAGMA journal_mode = WAL'); $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec("
      CREATE TABLE IF NOT EXISTS desk_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, kind TEXT NOT NULL, how TEXT NOT NULL, body TEXT NOT NULL,
        source_url TEXT NOT NULL DEFAULT '', near_title TEXT NOT NULL DEFAULT '', near_url TEXT NOT NULL DEFAULT '',
        lng REAL NOT NULL, lat REAL NOT NULL, year INTEGER, audience TEXT NOT NULL DEFAULT 'me',
        accepted_by INTEGER, accepted_at INTEGER, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS desk_hands (
        id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, user_id INTEGER NOT NULL, act TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '', lng REAL, lat REAL, place TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_desk_items_pos ON desk_items(lat, lng);
      CREATE INDEX IF NOT EXISTS idx_desk_hands_item ON desk_hands(item_id, id);
    ");
    return $pdo;
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

/** An http(s) link or ''. */
function game_url($u): string {
    $u = trim((string) $u);
    if ($u === '' || mb_strlen($u) > 500 || !preg_match('#^https?://[^\s<>"]+$#i', $u)) return '';
    return $u;
}

function game_name(int $uid): string {
    $u = ttg_user_by_id($uid);
    return $u ? (string) $u['display_name'] : 'A traveller';
}

function game_is_keeper(int $uid): bool { return in_array($uid, GAME_KEEPERS, true); }

/** May this traveller see this item? Their own, or anything shared with travellers. */
function game_visible(array $it, int $uid): bool { return $it['audience'] === 'travellers' || (int) $it['user_id'] === $uid; }

/**
 * Standing, from the hands, never from Jack's opinion.
 * ACCEPTED (Keeper) > DISPUTED (any differ or correct) > WITNESSED (another traveller witnessed it) > LODGED.
 */
function game_standing(array $it, array $hands): string {
    if ($it['accepted_at']) return 'ACCEPTED';
    $owner = (int) $it['user_id']; $disputed = false; $witnessed = false;
    foreach ($hands as $h) {
        if (in_array($h['act'], ['differ', 'correct'], true)) $disputed = true;
        if ($h['act'] === 'witness' && (int) $h['user_id'] !== $owner) $witnessed = true;
    }
    return $disputed ? 'DISPUTED' : ($witnessed ? 'WITNESSED' : 'LODGED');
}

/** Jack's filing note: fixed lines chosen by state. The quoted sentences are Guild record (Trailhead Register 13, card 04). */
function game_slip(array $it, array $hands, string $standing): string {
    $class = GAME_HOW[$it['how']]['class'] ?? 'TESTIMONY';
    $others = array_unique(array_map(fn($h) => (int) $h['user_id'], array_filter($hands, fn($h) => (int) $h['user_id'] !== (int) $it['user_id'])));
    $n = 1 + count($others);
    $hand = $n === 1 ? 'One hand.' : $n . ' hands.';
    return match ($standing) {
        'ACCEPTED' => "Accepted to the record by the Keeper. Filed as $class. $hand",
        'DISPUTED' => "Filed as $class. $hand The accounts disagree. \"Contradiction is not corruption while both sources remain intact.\" Both are kept.",
        'WITNESSED' => "Filed as $class. $hand Witnessed. Not yet accepted to the record.",
        default => $it['how'] === 'asking'
            ? "Filed as an open question. $hand Nobody has answered it yet."
            : "Filed as $class. $hand \"Leave it open until another witness can alter its standing.\"",
    };
}

function game_hand_view(array $h, int $uid): array {
    return ['id' => (int) $h['id'], 'act' => $h['act'], 'did' => GAME_ACTS[$h['act']] ?? $h['act'], 'who' => game_name((int) $h['user_id']), 'mine' => (int) $h['user_id'] === $uid,
        'body' => $h['body'], 'source_url' => $h['source_url'], 'place' => $h['place'],
        'lng' => $h['lng'] !== null ? (float) $h['lng'] : null, 'lat' => $h['lat'] !== null ? (float) $h['lat'] : null, 'at' => (int) $h['created_at']];
}

function game_hands(int $itemId): array {
    $st = game_db()->prepare('SELECT * FROM desk_hands WHERE item_id = ? ORDER BY id'); $st->execute([$itemId]);
    return $st->fetchAll();
}

function game_item_view(array $it, int $uid, bool $full): array {
    $hands = game_hands((int) $it['id']);
    $standing = game_standing($it, $hands);
    $v = ['id' => (int) $it['id'], 'kind' => $it['kind'], 'kind_label' => GAME_KINDS[$it['kind']] ?? $it['kind'], 'how' => $it['how'],
        'class' => GAME_HOW[$it['how']]['class'] ?? 'TESTIMONY', 'how_label' => GAME_HOW[$it['how']]['label'] ?? '',
        'body' => $it['body'], 'who' => game_name((int) $it['user_id']), 'mine' => (int) $it['user_id'] === $uid,
        'lng' => (float) $it['lng'], 'lat' => (float) $it['lat'], 'year' => $it['year'] !== null ? (int) $it['year'] : null,
        'audience' => $it['audience'], 'standing' => $standing, 'hands' => count($hands), 'at' => (int) $it['created_at']];
    // Where it has been carried, for the line on the map.
    $v['route'] = array_values(array_map(fn($h) => [(float) $h['lng'], (float) $h['lat']], array_filter($hands, fn($h) => $h['act'] === 'carry' && $h['lng'] !== null)));
    if ($full) {
        $v += ['source_url' => $it['source_url'], 'near_title' => $it['near_title'], 'near_url' => $it['near_url'],
            'slip' => game_slip($it, $hands, $standing), 'hand_list' => array_map(fn($h) => game_hand_view($h, $uid), $hands),
            'accepted_by' => $it['accepted_by'] ? game_name((int) $it['accepted_by']) : null];
    }
    return $v;
}
