<?php
/*
 * Passport Map guide trail — /map/trail.php
 *
 * GET  → {trail:[{id,label,lng,lat,note,tree_slug,tree_title,created_at}]}
 * POST {label,lng,lat,note?,tree_slug?} → {ok:true,id,tree_slug,tree_title}
 *
 * Every fly_to the voice guide makes is saved here, auto-matched to a
 * graph PLACE node by proximity (5 km threshold) or exact title match.
 * tree_slug links the point to /now/tree#<slug>.
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
require_once __DIR__ . '/../inc/graph.php';

$user = ttg_current_user();
if (!$user) fail(403, 'Sign in first.');

/* ── GET: return user's trail ── */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = ttg_db()->prepare(
        'SELECT id, label, lng, lat, note, tree_slug, tree_title, created_at
         FROM guide_trail WHERE user_id = ? ORDER BY created_at ASC'
    );
    $stmt->execute([(int) $user['id']]);
    echo json_encode(['trail' => $stmt->fetchAll()]);
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

$label  = mb_substr(trim((string) ($in['label'] ?? '')), 0, 120);
$lng    = (float) ($in['lng'] ?? 0);
$lat    = (float) ($in['lat'] ?? 0);
$note   = mb_substr(trim((string) ($in['note'] ?? '')), 0, 400);
$runId  = isset($in['run_id']) ? (int) $in['run_id'] : null;
$treeSlug  = preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($in['tree_slug'] ?? '')));
$treeTitle = '';

/* validate run_id ownership if provided */
if ($runId !== null) {
    $chk = ttg_db()->prepare('SELECT id FROM guide_runs WHERE id = ? AND user_id = ?');
    $chk->execute([$runId, (int) $user['id']]);
    if (!$chk->fetch()) $runId = null; // silently ignore invalid run
}

if ($label === '') fail(400, 'label required.');
if ($lng < -11 || $lng > 3 || $lat < 49 || $lat > 61.5) fail(400, 'Coordinates outside Great Britain.');

/* haversine in km */
$hav = static function (float $lng1, float $lat1, float $lng2, float $lat2): float {
    $R = 6371.0; $t = M_PI / 180;
    $dLat = ($lat2 - $lat1) * $t; $dLng = ($lng2 - $lng1) * $t;
    $a = sin($dLat / 2) ** 2 + cos($lat1 * $t) * cos($lat2 * $t) * sin($dLng / 2) ** 2;
    return 2 * $R * asin(sqrt($a));
};

/* auto-match to graph PLACE node if tree_slug not supplied */
if ($treeSlug === '') {
    $nodes = ttg_graph_nodes(); // keyed by slug (and public_id)
    $seen  = [];
    $bestKm = 5.0; $bestNode = null;

    foreach ($nodes as $n) {
        if (!is_array($n) || ($n['type'] ?? '') !== 'PLACE') continue;
        $slug = (string) ($n['slug'] ?? '');
        if ($slug === '' || isset($seen[$slug])) continue;
        $seen[$slug] = true;

        $approx = (string) ($n['metadata']['approx'] ?? '');
        if ($approx !== '') {
            [$nlat, $nlng] = array_map('floatval', explode(',', $approx, 2));
            $km = $hav($lng, $lat, $nlng, $nlat);
            if ($km < $bestKm) { $bestKm = $km; $bestNode = $n; }
        }
    }
    if ($bestNode) {
        $treeSlug  = (string) $bestNode['slug'];
        $treeTitle = (string) ($bestNode['title'] ?? '');
    } else {
        // fall back: exact title match (case-insensitive)
        $needle = strtolower($label);
        foreach ($nodes as $n) {
            if (!is_array($n) || ($n['type'] ?? '') !== 'PLACE') continue;
            if (strtolower((string) ($n['title'] ?? '')) === $needle) {
                $treeSlug  = (string) ($n['slug'] ?? '');
                $treeTitle = (string) ($n['title'] ?? '');
                break;
            }
        }
    }
}

/* look up title for a caller-supplied slug */
if ($treeSlug !== '' && $treeTitle === '') {
    $nodes = ttg_graph_nodes();
    $n = $nodes[$treeSlug] ?? null;
    if ($n) $treeTitle = (string) ($n['title'] ?? '');
}

ttg_db()->prepare(
    'INSERT INTO guide_trail(user_id,run_id,label,lng,lat,note,tree_slug,tree_title,created_at) VALUES(?,?,?,?,?,?,?,?,?)'
)->execute([(int) $user['id'], $runId, $label, $lng, $lat, $note, $treeSlug, $treeTitle, time()]);

$id = (int) ttg_db()->lastInsertId();
echo json_encode(['ok' => true, 'id' => $id, 'tree_slug' => $treeSlug, 'tree_title' => $treeTitle]);
