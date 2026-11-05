<?php
/*
 * Guild game API. POST JSON, signed in, X-CSRF header (the /people session token). No model calls, no Common Room posts.
 *   {op:"state"}                                     the episode as this traveller has reached it, plus the shared Jack
 *   {op:"start"}                                     take the receipt book
 *   {op:"find", stub}                                go to the next stub: it opens when you arrive
 *   {op:"decide", stub, action:"return"|"keep", receipt, audience:"me"|"guild"}
 *   {op:"custody", action:"returned"|"signed", note, audience}   receipt 0001, once per traveller
 */
declare(strict_types=1);
ini_set('display_errors', '0');
require_once __DIR__ . '/lib.php';
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
if (!$me) game_json(['ok' => false, 'error' => 'Sign in to play.', 'signin' => true], 401);
$uid = (int) $me['id'];
$in = json_decode((string) file_get_contents('php://input', false, null, 0, 16384), true);
if (!is_array($in)) game_json(['ok' => false, 'error' => 'Unreadable request.'], 400);

$E = game_episode(); $ep = $E['id']; $db = game_db();
$run = $db->prepare('SELECT * FROM game_runs WHERE user_id = ? AND ep = ?'); $run->execute([$uid, $ep]); $run = $run->fetch() ?: null;

function game_point(array $in, array $ring): array {
    $lng = $in['lng'] ?? null; $lat = $in['lat'] ?? null;
    if (!is_numeric($lng) || !is_numeric($lat)) game_json(['ok' => false, 'error' => 'Choose where to set it down first.'], 422);
    if (game_dist((float) $lat, (float) $lng, $ring['lat'], $ring['lng']) > $ring['r'] + 60) game_json(['ok' => false, 'error' => 'That spot is outside the ring. Set it down inside the dashed circle.'], 422);
    return [round((float) $lng, 5), round((float) $lat, 5)];
}
function game_audience($a): string { return $a === 'guild' ? 'guild' : 'me'; }

try {
    switch ((string) ($in['op'] ?? '')) {

    case 'state': {
        $mine = $run ? game_my_stubs($uid, $ep) : [];
        $next = $run ? game_next_stub($mine) : null;
        $chain = game_chain($ep, $uid);
        $myD = null; foreach ($chain as $c) if ($c['mine']) $myD = $c;
        $stubs = [];
        foreach (['A', 'B', 'C', 'D'] as $k) {
            $v = game_stub_view($k, $mine[$k] ?? null, $next === $k);
            if ($k === 'D' && isset($mine['D'])) {
                $v['state'] = $myD ? $myD['action'] : 'found';
                if ($myD) $v['said'] = $E['stubs']['D']['done'][$myD['action']] ?? '';
            }
            $stubs[] = $v;
        }
        $decided = game_decided_count($mine);
        $returnedAny = false; foreach (['A', 'B', 'C'] as $k) if (($mine[$k]['state'] ?? '') === 'returned') $returnedAny = true;
        game_json(['ok' => true, 'me' => ['id' => $uid, 'name' => (string) $me['display_name']],
            'episode' => ['id' => $ep, 'title' => $E['title'], 'place' => $E['place'], 'opening' => $E['opening']],
            'started' => (bool) $run, 'finished' => (bool) ($run['finished_at'] ?? null), 'next' => $next, 'decided' => $decided, 'stubs' => $stubs,
            'reversal' => $decided >= 2 ? ['lines' => $E['reversal'], 'coda' => $returnedAny ? $E['reversal_returned'] : $E['reversal_kept']] : null,
            'memory' => game_memory($ep, $uid), 'chain' => $chain,
            'travellers' => (int) $db->query("SELECT COUNT(*) FROM game_runs WHERE ep = " . $db->quote($ep))->fetchColumn(),
            'ending' => ($run['finished_at'] ?? null) ? $E['ending'] : null]);
    }

    case 'start': {
        if (!$run) $db->prepare('INSERT INTO game_runs(user_id, ep, started_at) VALUES(?,?,?)')->execute([$uid, $ep, time()]);
        game_json(['ok' => true]);
    }

    case 'find': {
        if (!$run) game_json(['ok' => false, 'error' => 'Take the receipt book first.'], 409);
        $k = (string) ($in['stub'] ?? '');
        $mine = game_my_stubs($uid, $ep);
        if ($k !== game_next_stub($mine)) game_json(['ok' => false, 'error' => 'That stub is not the one you are looking for yet.'], 409);
        $db->prepare('INSERT OR IGNORE INTO game_stubs(user_id, ep, stub, found_at) VALUES(?,?,?,?)')->execute([$uid, $ep, $k, time()]);
        game_json(['ok' => true, 'found' => true, 'stub' => $k]);
    }

    case 'decide': {
        $k = (string) ($in['stub'] ?? '');
        if (!in_array($k, ['A', 'B', 'C'], true)) game_json(['ok' => false, 'error' => 'Unknown stub.'], 400);
        $mine = game_my_stubs($uid, $ep); $row = $mine[$k] ?? null;
        if (!$row) game_json(['ok' => false, 'error' => 'You have not found that stub.'], 409);
        if ($row['state'] === 'returned') game_json(['ok' => false, 'error' => 'That hour has already gone back. It cannot be taken again.'], 409);
        $s = $E['stubs'][$k]; $action = (string) ($in['action'] ?? '');
        $receipt = game_clean((string) ($in['receipt'] ?? ''), 600); $aud = game_audience($in['audience'] ?? 'me');
        if ($action === 'keep') {
            $db->prepare("UPDATE game_stubs SET state = 'kept', ret_year = NULL, lng = NULL, lat = NULL, receipt = ?, audience = ?, decided_at = ? WHERE user_id = ? AND ep = ? AND stub = ?")
                ->execute([$receipt, $aud, time(), $uid, $ep, $k]);
        } elseif ($action === 'return') {
            $year = (int) array_key_first($s['years']);
            $lng = $s['ring']['lng']; $lat = $s['ring']['lat'];
            $db->prepare("UPDATE game_stubs SET state = 'returned', ret_year = ?, lng = ?, lat = ?, receipt = ?, audience = ?, decided_at = ? WHERE user_id = ? AND ep = ? AND stub = ?")
                ->execute([$year, $lng, $lat, $receipt, $aud, time(), $uid, $ep, $k]);
        } else game_json(['ok' => false, 'error' => 'Return it or keep it.'], 400);
        game_json(['ok' => true]);
    }

    case 'custody': {
        $mine = game_my_stubs($uid, $ep);
        if (!isset($mine['D'])) game_json(['ok' => false, 'error' => 'You have not reached receipt 0001.'], 409);
        $action = (string) ($in['action'] ?? '');
        if (!isset($E['stubs']['D']['choices'][$action])) game_json(['ok' => false, 'error' => 'Return it or sign it over.'], 400);
        $note = game_clean((string) ($in['note'] ?? ''), 600); $aud = game_audience($in['audience'] ?? 'me');
        $lng = null; $lat = null;
        $db->beginTransaction();
        $ins = $db->prepare('INSERT OR IGNORE INTO game_custody(ep, stub, user_id, action, note, audience, lng, lat, created_at) VALUES(?,?,?,?,?,?,?,?,?)');
        $ins->execute([$ep, 'D', $uid, $action, $note, $aud, $lng, $lat, time()]);
        if ($ins->rowCount() === 0) { $db->rollBack(); game_json(['ok' => false, 'error' => 'You have already decided receipt 0001. The next traveller may change it.'], 409); }
        $db->prepare('UPDATE game_runs SET finished_at = ? WHERE user_id = ? AND ep = ? AND finished_at IS NULL')->execute([time(), $uid, $ep]);
        $db->commit();
        game_json(['ok' => true]);
    }
    }
    game_json(['ok' => false, 'error' => 'Unknown operation.'], 400);
} catch (Throwable $e) {
    if (game_db()->inTransaction()) game_db()->rollBack();
    error_log('Game API: ' . get_class($e) . ': ' . $e->getMessage());
    game_json(['ok' => false, 'error' => 'The desk jammed. Try again.'], 500);
}
