<?php
/*
 * The Desk API. POST JSON, signed in, X-CSRF header (the /people session token). No model calls, no Common Room posts.
 *   {op:"state", bbox:[w,s,e,n]}     items here that you may see, your own items, whether you are the Keeper
 *   {op:"item", id}                  one item with every hand on it and Jack's filing slip
 *   {op:"lodge", kind, how, body, source_url, near_title, near_url, lng, lat, year, audience:"me"|"travellers"}
 *   {op:"hand", item_id, act:"witness"|"differ"|"correct"|"carry", body, source_url, lng, lat, place}
 *   {op:"unhand", id}                remove your own hand
 *   {op:"withdraw", id}              withdraw your own item from view (its hands go with it)
 *   {op:"accept", id}                Keeper only: accept to the record
 */
declare(strict_types=1);
ini_set('display_errors', '0');
require_once __DIR__ . '/lib.php';
require_once dirname(__DIR__, 2) . '/people/inc/terms.php';
require_once dirname(__DIR__, 2) . '/app/Narrative/Narrative.php';
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') game_json(['ok' => false, 'error' => 'POST only.'], 405);
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $o = strtolower((string) parse_url($origin, PHP_URL_HOST)) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '');
    if ($o !== strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''))) game_json(['ok' => false, 'error' => 'Wrong door.'], 403);
}
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$stored = (string) ($_SESSION['csrf'] ?? ''); session_write_close();
if ($stored === '' || !hash_equals($stored, (string) ($_SERVER['HTTP_X_CSRF'] ?? ''))) game_json(['ok' => false, 'error' => 'The page has gone stale. Reload it.', 'reload' => true], 400);
$me = ttg_current_user();
if (!$me) game_json(['ok' => false, 'error' => 'Sign in first.', 'signin' => true], 401);
$uid = (int) $me['id'];
$in = json_decode((string) file_get_contents('php://input', false, null, 0, 16384), true);
if (!is_array($in)) game_json(['ok' => false, 'error' => 'Unreadable request.'], 400);
$db = game_db();

function game_coord($v, float $lo, float $hi): ?float { return is_numeric($v) && (float) $v >= $lo && (float) $v <= $hi ? round((float) $v, 5) : null; }
function game_item_for(int $id, int $uid): array {
    $st = game_db()->prepare("SELECT * FROM desk_items WHERE id = ? AND audience != 'withdrawn'"); $st->execute([$id]); $it = $st->fetch();
    if (!$it || !game_visible($it, $uid)) game_json(['ok' => false, 'error' => 'Nothing by that number is open to you.'], 404);
    return $it;
}
function game_quota(string $table, int $uid, int $max): void {
    $st = game_db()->prepare("SELECT COUNT(*) FROM $table WHERE user_id = ? AND created_at >= ?"); $st->execute([$uid, time() - 86400]);
    if ((int) $st->fetchColumn() >= $max) game_json(['ok' => false, 'error' => 'That is enough for one day. The desk will be here tomorrow.'], 429);
}

try {
    switch ((string) ($in['op'] ?? '')) {

    case 'state': {
        $b = is_array($in['bbox'] ?? null) ? array_map('floatval', array_slice($in['bbox'], 0, 4)) : [];
        if (count($b) < 4) $b = [-180, -85, 180, 85];
        $st = $db->prepare("SELECT * FROM desk_items WHERE audience != 'withdrawn' AND (audience = 'travellers' OR user_id = ?)
            AND lng BETWEEN ? AND ? AND lat BETWEEN ? AND ? ORDER BY id DESC LIMIT 300");
        $st->execute([$uid, $b[0], $b[2], $b[1], $b[3]]);
        $here = array_map(fn($it) => game_item_view($it, $uid, false), $st->fetchAll());
        $mine = $db->prepare("SELECT * FROM desk_items WHERE user_id = ? AND audience != 'withdrawn' ORDER BY id DESC LIMIT 50"); $mine->execute([$uid]);
        $sh = $db->prepare("SELECT COUNT(*) FROM desk_items WHERE audience = 'travellers' AND user_id != ?"); $sh->execute([$uid]);
        $shared = (int) $sh->fetchColumn();   // shared by other travellers, anywhere
        game_json(['ok' => true, 'me' => ['id' => $uid, 'name' => (string) $me['display_name'], 'keeper' => game_is_keeper($uid)],
            'here' => $here, 'mine' => array_map(fn($it) => game_item_view($it, $uid, false), $mine->fetchAll()), 'shared_total' => $shared,
            'kinds' => GAME_KINDS, 'how' => array_map(fn($h) => $h['label'], GAME_HOW)]);
    }

    case 'item': {
        game_json(['ok' => true, 'item' => game_item_view(game_item_for((int) ($in['id'] ?? 0), $uid), $uid, true), 'keeper' => game_is_keeper($uid)]);
    }

    case 'lodge': {
        ttg_terms_gate_json($me);
        $kind = (string) ($in['kind'] ?? ''); $how = (string) ($in['how'] ?? '');
        if (!isset(GAME_KINDS[$kind])) game_json(['ok' => false, 'error' => 'Say what it is.'], 422);
        if (!isset(GAME_HOW[$how])) game_json(['ok' => false, 'error' => 'Say how you know it.'], 422);
        $body = game_clean((string) ($in['body'] ?? ''), 2000);
        if (mb_strlen($body) < 10) game_json(['ok' => false, 'error' => 'Write a little more: what is it, and what happened here?'], 422);
        $src = game_url($in['source_url'] ?? '');
        if ($how === 'documented' && $src === '') game_json(['ok' => false, 'error' => 'A documented item needs its source: paste a link.'], 422);
        $lng = game_coord($in['lng'] ?? null, -180, 180); $lat = game_coord($in['lat'] ?? null, -85, 85);
        if ($lng === null || $lat === null) game_json(['ok' => false, 'error' => 'Put the cross on the place first.'], 422);
        $year = isset($in['year']) && is_numeric($in['year']) && (int) $in['year'] > -12000 && (int) $in['year'] < 2100 ? (int) $in['year'] : null;
        $aud = ($in['audience'] ?? '') === 'travellers' ? 'travellers' : 'me';
        game_quota('desk_items', $uid, 20);
        $db->prepare('INSERT INTO desk_items(user_id, kind, how, body, source_url, near_title, near_url, lng, lat, year, audience, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$uid, $kind, $how, $body, $src, game_clean((string) ($in['near_title'] ?? ''), 160), game_url($in['near_url'] ?? ''), $lng, $lat, $year, $aud, time()]);
        $newId = (int) $db->lastInsertId();
        Narrative::recordAct($uid, 'map', 'You lodged ' . strtolower(GAME_KINDS[$kind]) . ' on the Passport Map' . ($year ? ' for ' . $year : '') . ': “' . mb_substr($body, 0, 90) . (mb_strlen($body) > 90 ? '…' : '') . '”', '/map/play/');
        game_json(['ok' => true, 'id' => $newId]);
    }

    case 'hand': {
        ttg_terms_gate_json($me);
        $it = game_item_for((int) ($in['item_id'] ?? 0), $uid);
        $act = (string) ($in['act'] ?? '');
        if (!isset(GAME_ACTS[$act])) game_json(['ok' => false, 'error' => 'Witness it, remember it differently, correct it or carry it.'], 400);
        $owner = (int) $it['user_id'] === $uid;
        if ($owner && in_array($act, ['witness', 'differ'], true)) game_json(['ok' => false, 'error' => 'You cannot witness your own item. Someone else has to.'], 409);
        $body = game_clean((string) ($in['body'] ?? ''), 1200); $src = game_url($in['source_url'] ?? '');
        if ($act === 'differ' && mb_strlen($body) < 10) game_json(['ok' => false, 'error' => 'Say how you remember it.'], 422);
        if ($act === 'correct' && ($src === '' || mb_strlen($body) < 10)) game_json(['ok' => false, 'error' => 'A correction needs what is wrong and a source link.'], 422);
        $lng = null; $lat = null; $place = '';
        if ($act === 'carry') {
            $lng = game_coord($in['lng'] ?? null, -180, 180); $lat = game_coord($in['lat'] ?? null, -85, 85);
            if ($lng === null || $lat === null) game_json(['ok' => false, 'error' => 'Put the cross on the place you are carrying it to.'], 422);
            if (mb_strlen($body) < 10) game_json(['ok' => false, 'error' => 'Say why it belongs there too.'], 422);
            $place = game_clean((string) ($in['place'] ?? ''), 120);
        }
        if ($act === 'witness') {
            $dup = $db->prepare("SELECT 1 FROM desk_hands WHERE item_id = ? AND user_id = ? AND act = 'witness'"); $dup->execute([(int) $it['id'], $uid]);
            if ($dup->fetchColumn()) game_json(['ok' => false, 'error' => 'You have already witnessed this.'], 409);
        }
        game_quota('desk_hands', $uid, 40);
        $db->prepare('INSERT INTO desk_hands(item_id, user_id, act, body, source_url, lng, lat, place, created_at) VALUES(?,?,?,?,?,?,?,?,?)')
            ->execute([(int) $it['id'], $uid, $act, $body, $src, $lng, $lat, $place, time()]);
        game_json(['ok' => true]);
    }

    case 'unhand': {
        $st = $db->prepare('DELETE FROM desk_hands WHERE id = ? AND user_id = ?'); $st->execute([(int) ($in['id'] ?? 0), $uid]);
        if ($st->rowCount() === 0) game_json(['ok' => false, 'error' => 'That is not your hand to remove.'], 403);
        game_json(['ok' => true]);
    }

    case 'withdraw': {
        $st = $db->prepare("UPDATE desk_items SET audience = 'withdrawn' WHERE id = ? AND user_id = ?"); $st->execute([(int) ($in['id'] ?? 0), $uid]);
        if ($st->rowCount() === 0) game_json(['ok' => false, 'error' => 'Only the traveller who lodged it can withdraw it.'], 403);
        game_json(['ok' => true]);
    }

    case 'accept': {
        if (!game_is_keeper($uid)) game_json(['ok' => false, 'error' => 'Only the Keeper accepts items to the record.'], 403);
        $it = game_item_for((int) ($in['id'] ?? 0), $uid);
        if ($it['audience'] !== 'travellers') game_json(['ok' => false, 'error' => 'Only items shared with travellers can be accepted.'], 409);
        $db->prepare('UPDATE desk_items SET accepted_by = ?, accepted_at = ? WHERE id = ?')->execute([$uid, time(), (int) $it['id']]);
        game_json(['ok' => true]);
    }
    }
    game_json(['ok' => false, 'error' => 'Unknown operation.'], 400);
} catch (Throwable $e) {
    error_log('Desk API: ' . get_class($e) . ': ' . $e->getMessage());
    game_json(['ok' => false, 'error' => 'The desk jammed. Try again.'], 500);
}
