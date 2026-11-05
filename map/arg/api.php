<?php
/*
 * Narrative engine API. POST JSON, signed in, X-CSRF header (the /people session token).
 *   {op:"state", since}                 world: open cases, recent closures, log since an id, my standing
 *   {op:"case", id}                      a dossier: clues, filings, corroborations
 *   {op:"open", lng, lat, year, place, context}   Jack opens a case here, seeded from what the map knows
 *   {op:"file", case_id, step, body, evidence, lng, lat, year}   file a report; Jack rules on it
 *   {op:"corroborate", filing_id}        back another traveller's filing; two voices make canon
 */
declare(strict_types=1);
ini_set('display_errors', '0');
require_once __DIR__ . '/lib.php';
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') arg_json(['ok' => false, 'error' => 'POST only.'], 405);
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $o = strtolower((string) parse_url($origin, PHP_URL_HOST)) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '');
    if ($o !== strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''))) arg_json(['ok' => false, 'error' => 'Wrong door.'], 403);
}
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$stored = (string) ($_SESSION['csrf'] ?? ''); session_write_close();
if ($stored === '' || !hash_equals($stored, (string) ($_SERVER['HTTP_X_CSRF'] ?? ''))) arg_json(['ok' => false, 'error' => 'The slip is unsigned. Reload.', 'reload' => true], 400);
$me = ttg_current_user();
if (!$me) arg_json(['ok' => false, 'error' => 'Sign in to play.', 'signin' => true], 401);
$uid = (int) $me['id'];
$in = json_decode((string) file_get_contents('php://input', false, null, 0, 65536), true);
if (!is_array($in)) arg_json(['ok' => false, 'error' => 'Unreadable request.'], 400);
$db = arg_db();
@set_time_limit(90);

try {
    switch ((string) ($in['op'] ?? '')) {

    case 'state': {
        $since = max(0, (int) ($in['since'] ?? 0));
        $open = $db->query("SELECT * FROM arg_cases WHERE status = 'open' ORDER BY id DESC")->fetchAll();
        $closed = $db->query("SELECT * FROM arg_cases WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 10")->fetchAll();
        $st = $db->prepare($since > 0 ? 'SELECT * FROM arg_log WHERE id > ? ORDER BY id ASC LIMIT 100' : 'SELECT * FROM (SELECT * FROM arg_log WHERE id > ? ORDER BY id DESC LIMIT 40) ORDER BY id ASC');
        $st->execute([$since]);
        $log = array_map(fn($l) => ['id' => (int) $l['id'], 'kind' => $l['kind'], 'case_id' => $l['case_id'] !== null ? (int) $l['case_id'] : null, 'who' => arg_name((int) $l['user_id']), 'text' => $l['text'], 'at' => (int) $l['created_at']], $st->fetchAll());
        $mine = $db->prepare('SELECT COUNT(*) AS filed, SUM(canon) AS canon FROM arg_filings WHERE user_id = ?'); $mine->execute([$uid]); $m = $mine->fetch();
        $stab = $open ? (int) round(array_sum(array_column($open, 'stability')) / count($open)) : 100;
        arg_json(['ok' => true, 'now' => time(), 'open' => array_map('arg_case_row', $open), 'closed' => array_map('arg_case_row', $closed), 'log' => $log,
            'me' => ['id' => $uid, 'name' => (string) $me['display_name'], 'filed' => (int) ($m['filed'] ?? 0), 'canon' => (int) ($m['canon'] ?? 0)], 'stability' => $stab]);
    }

    case 'case': {
        $id = (int) ($in['id'] ?? 0);
        $c = $db->prepare('SELECT * FROM arg_cases WHERE id = ?'); $c->execute([$id]); $case = $c->fetch();
        if (!$case) arg_json(['ok' => false, 'error' => 'No such case.'], 404);
        $cl = $db->prepare('SELECT * FROM arg_clues WHERE case_id = ? ORDER BY id'); $cl->execute([$id]);
        $fl = $db->prepare('SELECT f.*, (SELECT COUNT(*) FROM arg_corroborations k WHERE k.filing_id = f.id) AS backers,
            (SELECT COUNT(*) FROM arg_corroborations k WHERE k.filing_id = f.id AND k.user_id = ?) AS mine FROM arg_filings f WHERE case_id = ? ORDER BY id DESC LIMIT 80');
        $fl->execute([$uid, $id]);
        arg_json(['ok' => true, 'case' => arg_case_row($case),
            'puzzle' => arg_puzzle($case),
            'clues' => array_map(fn($x) => ['id' => (int) $x['id'], 'text' => $x['text'], 'lng' => $x['lng'] !== null ? (float) $x['lng'] : null, 'lat' => $x['lat'] !== null ? (float) $x['lat'] : null, 'year' => $x['year'] !== null ? (int) $x['year'] : null, 'by' => arg_name((int) $x['found_by'])], $cl->fetchAll()),
            'filings' => array_map(fn($f) => ['id' => (int) $f['id'], 'who' => arg_name((int) $f['user_id']), 'mine' => (int) $f['user_id'] === $uid, 'step' => $f['step'], 'body' => $f['body'],
                'evidence' => json_decode((string) $f['evidence'], true) ?: null, 'classification' => $f['classification'], 'ruling' => $f['ruling'], 'canon' => (bool) $f['canon'],
                'backers' => (int) $f['backers'], 'backed' => (bool) $f['mine'], 'at' => (int) $f['created_at']], $fl->fetchAll())]);
    }

    case 'puzzle-check':
    case 'puzzle': {
        $cid = (int) ($in['case_id'] ?? 0);
        $q = $db->prepare("SELECT * FROM arg_cases WHERE id = ? AND status = 'open'"); $q->execute([$cid]); $case = $q->fetch();
        $puzzle = $case ? arg_puzzle($case) : null;
        if (!$puzzle) arg_json(['ok'=>false,'error'=>'No checked puzzle is available for this case.'],404);
        $key = (string)($in['key'] ?? ''); $answer = arg_clean((string)($in['answer'] ?? ''), 160);
        if (!arg_puzzle_correct($key, $answer)) arg_json(['ok'=>true,'correct'=>false,'message'=>'Not matched. Reopen the museum article and compare its model captions and construction history. Nothing has been filed and no model call was used.']);
        if ($in['op'] === 'puzzle-check') arg_json(['ok'=>true,'correct'=>true,'message'=>'Matches the source. Read-only check; no filing saved.']);
        $tag = 'puzzle:' . $puzzle['id'] . ':' . $key;
        $db->beginTransaction();
        $prior = $db->prepare('SELECT id FROM arg_filings WHERE case_id=? AND user_id=? AND evidence LIKE ?'); $prior->execute([$cid,$uid,'%"task":"'.$tag.'"%']);
        if ($prior->fetchColumn()) { $db->rollBack(); arg_json(['ok'=>true,'correct'=>true,'message'=>'You already filed this answer. No duplicate finding or reward was added.']); }
        $step = ['compare'=>'COMPARE','year'=>'RECORD','date'=>'RETURN'][$key];
        $body = ['compare'=>'Model comparison: a courtyard garden was roofed over.','year'=>'The courtyard-extension model is dated 1988.','date'=>'The foundation stone was laid on 26 June 1912.'][$key];
        $ev = json_encode(['task'=>$tag,'title'=>$puzzle['source_title'],'url'=>$puzzle['source_url']],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
        $ruling = 'Matches the checked Museum Wales record. This is a sourced finding, not evidence for the withdrawn catalogue-number claim. Another traveller may corroborate it.';
        $db->prepare('INSERT INTO arg_filings(case_id,user_id,step,body,evidence,lng,lat,year,classification,ruling,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')->execute([$cid,$uid,$step,$body,$ev,$case['lng'],$case['lat'],$case['year'],'RECORD',$ruling,time()]);
        $db->commit();
        arg_log('file',$cid,$uid,arg_name($uid).' completed '.$step.' on the checked museum task');
        arg_json(['ok'=>true,'correct'=>true,'message'=>'Answer checked and finding saved. No model call used.']);
    }

    case 'open': {
        $lng = arg_num($in['lng'] ?? null, -180, 180); $lat = arg_num($in['lat'] ?? null, -85, 85);
        if ($lng === null || $lat === null) arg_json(['ok' => false, 'error' => 'Stand somewhere first.'], 400);
        if ((int) $db->query("SELECT COUNT(*) FROM arg_cases WHERE status = 'open'")->fetchColumn() >= ARG_MAX_OPEN) arg_json(['ok' => false, 'error' => 'The Department has too many open cases. Close one first.'], 429);
        if (!arg_rate($uid, 'open', ARG_LIMITS['open_day_user'], 86400)) arg_json(['ok' => false, 'error' => 'You have opened enough cases for today.'], 429);
        $near = $db->prepare("SELECT id, title FROM arg_cases WHERE status = 'open' AND ABS(lat - ?) < 0.05 AND ABS(lng - ?) < 0.08");
        $near->execute([$lat, $lng]);
        if ($existing = $near->fetch()) arg_json(['ok' => false, 'error' => 'A case is already open here: ' . $existing['title'], 'case_id' => (int) $existing['id']], 409);
        $year = isset($in['year']) && is_numeric($in['year']) ? max(-12000, min(2100, (int) $in['year'])) : null;
        $ctx = is_array($in['context'] ?? null) ? $in['context'] : [];
        if (!array_filter($ctx)) arg_json(['ok'=>false,'error'=>'No nearby records are loaded yet. Select a real map record or wait for the map layers before opening a case. Jack will not invent missing evidence.'],422);
        $out = arg_model('Open a NEW case at this place. The traveller is standing at the point given' . ($year !== null && $year < 2100 ? ', looking at the year ' . $year : '') . '. Ground it in the real records provided, make a precise, achievable investigation using only those records. No invented evidence hunt. Put the source, exact question and completion condition in the brief. If no supported puzzle can be made, ask for a concrete observation from the available record without inventing an anomaly. Reply as JSON: {"title": short evocative case title, "brief": 2-4 sentences, Jack\'s case note, "place": place name, "year": the year the case centres on (number, may be negative for BC), "stability": 15-70 (how fractured this place\'s timeline is), "clues": [2-3 objects {"text": one sentence, "lng": number, "lat": number, "year": number}] with every clue within 3 km of the point and pointing at something a traveller could find on the map (an event, a historic place, an old map, a photo, a person born there)}.',
            ['point' => ['lng' => $lng, 'lat' => $lat], 'year' => $year, 'place' => arg_clean((string) ($in['place'] ?? ''), 120), 'map_records_here' => $ctx,
             'other_open_cases' => array_map(fn($c) => $c['title'] . ' (' . $c['place'] . ')', $db->query("SELECT title, place FROM arg_cases WHERE status = 'open' LIMIT 12")->fetchAll())], $uid, 'open');
        if (!$out || empty($out['title'])) arg_json(['ok' => false, 'error' => 'Jack could not reach the registry. Try again.'], 503);
        $db->beginTransaction();
        $db->prepare('INSERT INTO arg_cases(title, brief, place, lng, lat, year, stability, opened_by, created_at) VALUES(?,?,?,?,?,?,?,?,?)')->execute([
            arg_clean((string) $out['title'], 120), arg_clean((string) ($out['brief'] ?? ''), 900), arg_clean((string) ($out['place'] ?? ($in['place'] ?? '')), 120),
            $lng, $lat, is_numeric($out['year'] ?? null) ? (int) $out['year'] : $year, max(5, min(95, (int) ($out['stability'] ?? 40))), $uid, time()]);
        $cid = (int) $db->lastInsertId();
        foreach (array_slice(is_array($out['clues'] ?? null) ? $out['clues'] : [], 0, 3) as $k) {
            $kl = arg_num($k['lng'] ?? null, $lng - 0.06, $lng + 0.06); $kt = arg_num($k['lat'] ?? null, $lat - 0.04, $lat + 0.04);
            $db->prepare('INSERT INTO arg_clues(case_id, text, lng, lat, year, created_at) VALUES(?,?,?,?,?,?)')->execute([$cid, arg_clean((string) ($k['text'] ?? ''), 300), $kl, $kt, is_numeric($k['year'] ?? null) ? (int) $k['year'] : null, time()]);
        }
        $db->commit();
        $title = arg_clean((string) $out['title'], 120);
        arg_log('open', $cid, $uid, arg_name($uid) . ' woke a case: ' . $title);
        arg_announce('NEW CASE · ' . $title . "\n" . arg_clean((string) ($out['brief'] ?? ''), 400) . "\nOpen the Passport Map interface to investigate: /map/interface/");
        arg_json(['ok' => true, 'case_id' => $cid]);
    }

    case 'file': {
        $cid = (int) ($in['case_id'] ?? 0);
        $c = $db->prepare("SELECT * FROM arg_cases WHERE id = ? AND status = 'open'"); $c->execute([$cid]); $case = $c->fetch();
        if (!$case) arg_json(['ok' => false, 'error' => 'That case is not open.'], 404);
        $step = strtoupper((string) ($in['step'] ?? 'NOTICE'));
        if (!in_array($step, ['NOTICE', 'RECORD', 'COMPARE', 'TEST', 'RETURN'], true)) $step = 'NOTICE';
        $body = arg_clean((string) ($in['body'] ?? ''), 1200);
        if (mb_strlen($body) < 8) arg_json(['ok' => false, 'error' => 'File something Jack can read.'], 422);
        if (!arg_rate($uid, 'file', ARG_LIMITS['file_hour'], 3600)) arg_json(['ok' => false, 'error' => 'The registry is full of your slips this hour. Rest.'], 429);
        $ev = is_array($in['evidence'] ?? null) ? $in['evidence'] : null;
        if ($ev) $ev = array_map(fn($v) => is_string($v) ? arg_clean($v, 300) : (is_numeric($v) ? $v + 0 : null), array_slice($ev, 0, 10, true));
        $lng = arg_num($in['lng'] ?? null, -180, 180); $lat = arg_num($in['lat'] ?? null, -85, 85);
        $year = isset($in['year']) && is_numeric($in['year']) ? (int) $in['year'] : null;
        $cl = $db->prepare('SELECT text, year FROM arg_clues WHERE case_id = ? ORDER BY id'); $cl->execute([$cid]);
        $prior = $db->prepare('SELECT step, body, classification, canon FROM arg_filings WHERE case_id = ? ORDER BY id DESC LIMIT 12'); $prior->execute([$cid]);
        $puzzle = arg_puzzle($case);
        $out = arg_model('A traveller files a ' . $step . ' report on this case. Rule on it as games master. If corrected_task is supplied, it overrides the original brief and clues; never demand the withdrawn catalogue number. Use only the linked checked task and accept supported answers. Do not invent a new lead without supplied evidence. Reply as JSON: {"classification": one of TESTIMONY, RECORD, DISPUTED, ANOMALY, "ruling": Jack\'s reply to the traveller, 2-4 sentences, in-world, "stability_delta": integer -10..10 (good evidence stabilises the timeline, wild claims fracture it), "glitch": 0-3 (how hard the interface should glitch), "clue": null or {"text": a new lead this filing earned, "lng": number, "lat": number, "year": number} within 3 km of the case}.',
            ['case' => ['title' => $case['title'], 'brief' => $case['brief'], 'place' => $case['place'], 'year' => $case['year'], 'stability' => (int) $case['stability']],
             'checked_source_facts' => $puzzle ? ['courtyard_change'=>'A courtyard garden was roofed over','extension_model_year'=>1988,'foundation_stone_date'=>'26 June 1912'] : null, 'corrected_task' => $puzzle, 'superseded_original' => $puzzle !== null, 'clues' => $puzzle ? [] : $cl->fetchAll(), 'recent_filings' => $prior->fetchAll(), 'this_filing' => ['by' => arg_name($uid), 'step' => $step, 'body' => $body, 'evidence' => $ev, 'at' => ['lng' => $lng, 'lat' => $lat, 'year' => $year]]], $uid, 'file');
        if (!$out) arg_json(['ok' => false, 'error' => 'Jack could not reach the registry. Your slip was not filed; try again.'], 503);
        $class = arg_class((string) ($out['classification'] ?? 'TESTIMONY'));
        $ruling = arg_clean((string) ($out['ruling'] ?? ''), 900);
        $db->beginTransaction();
        $db->prepare('INSERT INTO arg_filings(case_id, user_id, step, body, evidence, lng, lat, year, classification, ruling, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$cid, $uid, $step, $body, $ev ? json_encode($ev, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : '', $lng, $lat, $year, $class, $ruling, time()]);
        $fid = (int) $db->lastInsertId();
        $delta = max(-10, min(10, (int) ($out['stability_delta'] ?? 0)));
        $db->prepare('UPDATE arg_cases SET stability = MAX(0, MIN(100, stability + ?)) WHERE id = ?')->execute([$delta, $cid]);
        $clue = null;
        if (is_array($out['clue'] ?? null) && !empty($out['clue']['text'])) {
            $k = $out['clue'];
            $db->prepare('INSERT INTO arg_clues(case_id, text, lng, lat, year, found_by, created_at) VALUES(?,?,?,?,?,?,?)')->execute([$cid, arg_clean((string) $k['text'], 300),
                arg_num($k['lng'] ?? null, (float) $case['lng'] - 0.06, (float) $case['lng'] + 0.06), arg_num($k['lat'] ?? null, (float) $case['lat'] - 0.04, (float) $case['lat'] + 0.04),
                is_numeric($k['year'] ?? null) ? (int) $k['year'] : null, $uid, time()]);
            $clue = arg_clean((string) $k['text'], 300);
        }
        $db->commit();
        arg_log('file', $cid, $uid, arg_name($uid) . ' filed ' . $step . ' (' . $class . ') on ' . $case['title'] . ($clue ? ' · new lead' : ''));
        arg_json(['ok' => true, 'filing_id' => $fid, 'classification' => $class, 'ruling' => $ruling, 'stability_delta' => $delta, 'glitch' => max(0, min(3, (int) ($out['glitch'] ?? 1))), 'clue' => $clue]);
    }

    case 'corroborate': {
        $fid = (int) ($in['filing_id'] ?? 0);
        $f = $db->prepare('SELECT f.*, c.status, c.title FROM arg_filings f JOIN arg_cases c ON c.id = f.case_id WHERE f.id = ?'); $f->execute([$fid]); $fil = $f->fetch();
        if (!$fil || $fil['status'] !== 'open') arg_json(['ok' => false, 'error' => 'Nothing to back there.'], 404);
        if ((int) $fil['user_id'] === $uid) arg_json(['ok' => false, 'error' => 'You cannot corroborate yourself. Another traveller must.'], 409);
        $db->prepare('INSERT OR IGNORE INTO arg_corroborations(filing_id, user_id, created_at) VALUES(?,?,?)')->execute([$fid, $uid, time()]);
        $n = $db->prepare('SELECT COUNT(*) FROM arg_corroborations WHERE filing_id = ?'); $n->execute([$fid]); $backers = (int) $n->fetchColumn();
        $madeCanon = false; $closed = null;
        if (!$fil['canon'] && $backers >= ARG_CORROBORATIONS && $fil['classification'] !== 'DISPUTED') {
            $db->prepare('UPDATE arg_filings SET canon = 1 WHERE id = ?')->execute([$fid]);
            $db->prepare('UPDATE arg_cases SET stability = MIN(100, stability + 8) WHERE id = ?')->execute([(int) $fil['case_id']]);
            $madeCanon = true;
            arg_log('canon', (int) $fil['case_id'], $uid, arg_name($uid) . ' corroborated ' . arg_name((int) $fil['user_id']) . '\'s ' . $fil['step'] . ': it is CANON now.');
            $cc = $db->prepare('SELECT COUNT(*) FROM arg_filings WHERE case_id = ? AND canon = 1'); $cc->execute([(int) $fil['case_id']]);
            if ((int) $cc->fetchColumn() >= ARG_CANON_TO_CLOSE) $closed = arg_close_case((int) $fil['case_id'], $uid);
        }
        arg_json(['ok' => true, 'backers' => $backers, 'canon' => $madeCanon || (bool) $fil['canon'], 'closed' => $closed]);
    }
    }
    arg_json(['ok' => false, 'error' => 'Unknown operation.'], 400);
} catch (Throwable $e) {
    if (arg_db()->inTransaction()) arg_db()->rollBack();
    error_log('ARG API: ' . get_class($e) . ': ' . $e->getMessage());
    arg_json(['ok' => false, 'error' => 'The registry jammed. Try again.'], 500);
}

/** Close a case: Jack writes the report and, from its loose threads, opens the next case. */
function arg_close_case(int $cid, int $uid): ?array {
    $db = arg_db();
    $c = $db->prepare('SELECT * FROM arg_cases WHERE id = ?'); $c->execute([$cid]); $case = $c->fetch();
    if (!$case || $case['status'] !== 'open') return null;
    $canon = $db->prepare('SELECT step, body, ruling FROM arg_filings WHERE case_id = ? AND canon = 1 ORDER BY id'); $canon->execute([$cid]);
    $out = arg_model('The travellers have corroborated enough to CLOSE this case. Reply as JSON: {"report": Jack\'s closing case report, 4-6 sentences, naming what the Guild now holds as CANON. Do not revive a withdrawn claim or invent factual evidence; any successor must be a precise question answerable from canon supplied here, "next": {"title": a successor case born from a loose thread, "brief": 2-3 sentences, "place": place name, "lng": number, "lat": number, "year": number} within 30 km of this case}.',
        ['case' => ['title' => $case['title'], 'brief' => $case['brief'], 'place' => $case['place'], 'year' => $case['year']], 'corrected_task'=>arg_puzzle($case), 'canon' => $canon->fetchAll()], $uid, 'close');
    $report = arg_clean((string) ($out['report'] ?? 'Case closed. The registry holds the corroborated findings as canon.'), 1500);
    $db->prepare("UPDATE arg_cases SET status = 'closed', report = ?, closed_at = ?, stability = MAX(stability, 80) WHERE id = ?")->execute([$report, time(), $cid]);
    arg_log('close', $cid, 0, 'CASE CLOSED · ' . $case['title']);
    $next = null;
    if (is_array($out['next'] ?? null) && !empty($out['next']['title'])) {
        $n = $out['next'];
        $lng = arg_num($n['lng'] ?? null, (float) $case['lng'] - 0.4, (float) $case['lng'] + 0.4) ?? (float) $case['lng'];
        $lat = arg_num($n['lat'] ?? null, (float) $case['lat'] - 0.3, (float) $case['lat'] + 0.3) ?? (float) $case['lat'];
        $db->prepare('INSERT INTO arg_cases(title, brief, place, lng, lat, year, stability, parent_id, opened_by, created_at) VALUES(?,?,?,?,?,?,?,?,0,?)')
            ->execute([arg_clean((string) $n['title'], 120), arg_clean((string) ($n['brief'] ?? ''), 900), arg_clean((string) ($n['place'] ?? ''), 120), $lng, $lat,
                is_numeric($n['year'] ?? null) ? (int) $n['year'] : null, 35, $cid, time()]);
        $next = ['id' => (int) $db->lastInsertId(), 'title' => arg_clean((string) $n['title'], 120)];
        arg_log('open', $next['id'], 0, 'Jack opened a successor case: ' . $next['title']);
    }
    arg_announce('CASE CLOSED · ' . $case['title'] . "\n" . mb_substr($report, 0, 700) . ($next ? "\nA thread leads on: " . $next['title'] : ''));
    return ['report' => $report, 'next' => $next];
}