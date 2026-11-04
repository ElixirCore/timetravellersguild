<?php
/*
 * Passport Map guide runs — /map/run.php
 *
 * GET  → {runs:[{id,name,created_at,points:[{id,label,lng,lat,tree_slug,tree_title,created_at}]}]}
 * POST {action:'start', name}        → {ok:true, run_id}
 * POST {action:'end',   run_id}      → {ok:true}
 * POST {action:'delete',run_id}      → {ok:true}
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

require_once __DIR__ . '/../people/inc/db.php';
$user = ttg_current_user();
if (!$user) fail(403, 'Sign in first.');
$uid = (int) $user['id'];

/* ── GET: list runs with their points ── */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $runs = ttg_db()->prepare(
        'SELECT id, name, created_at FROM guide_runs WHERE user_id = ? ORDER BY created_at DESC'
    );
    $runs->execute([$uid]);
    $rows = $runs->fetchAll();

    $pts = ttg_db()->prepare(
        'SELECT id, run_id, label, lng, lat, tree_slug, tree_title, created_at
         FROM guide_trail WHERE user_id = ? AND run_id IS NOT NULL ORDER BY created_at ASC'
    );
    $pts->execute([$uid]);
    $byRun = [];
    foreach ($pts->fetchAll() as $p) {
        $byRun[(int) $p['run_id']][] = $p;
    }

    $out = [];
    foreach ($rows as $r) {
        $out[] = ['id' => (int) $r['id'], 'name' => (string) $r['name'],
                  'created_at' => (int) $r['created_at'],
                  'points' => $byRun[(int) $r['id']] ?? []];
    }
    echo json_encode(['runs' => $out]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only.');

/* same-origin */
$host   = strtolower($_SERVER['HTTP_HOST'] ?? '');
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$ohost  = strtolower((string) parse_url($origin, PHP_URL_HOST));
if ($ohost === '' || $ohost !== $host) fail(403, 'Same-origin only.');

$raw = (string) file_get_contents('php://input', false, null, 0, 10001);
$in  = json_decode($raw, true);
if (!is_array($in)) fail(400, 'JSON body required.');

$action = (string) ($in['action'] ?? '');

if ($action === 'start') {
    $name = mb_substr(trim((string) ($in['name'] ?? '')), 0, 120);
    if ($name === '') fail(400, 'name required.');
    ttg_db()->prepare('INSERT INTO guide_runs(user_id,name,created_at) VALUES(?,?,?)')
        ->execute([$uid, $name, time()]);
    echo json_encode(['ok' => true, 'run_id' => (int) ttg_db()->lastInsertId()]);
    exit;
}

if ($action === 'end') {
    // end is a no-op server-side (run stays open for more points); client clears activeRunId
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'delete') {
    $runId = (int) ($in['run_id'] ?? 0);
    if ($runId <= 0) fail(400, 'run_id required.');
    // verify ownership
    $check = ttg_db()->prepare('SELECT id FROM guide_runs WHERE id = ? AND user_id = ?');
    $check->execute([$runId, $uid]);
    if (!$check->fetch()) fail(404, 'Run not found.');
    ttg_db()->prepare('UPDATE guide_trail SET run_id = NULL WHERE run_id = ?')->execute([$runId]);
    ttg_db()->prepare('DELETE FROM guide_runs WHERE id = ?')->execute([$runId]);
    echo json_encode(['ok' => true]);
    exit;
}

fail(400, 'Unknown action. Use start, end or delete.');
