<?php
/*
 * Passport Map stamp writer — /map/stamp.php
 *
 * POST {name, line?, inked?, lng?, lat?}
 *   Adds a new place to the authenticated user's passport citizen record.
 *   The citizens.json file is written atomically with a file lock.
 *
 * Returns {ok:true, place:{name,line,inked,lng,lat}} on success.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only.');

/* same-origin */
$host   = strtolower($_SERVER['HTTP_HOST'] ?? '');
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$ohost  = strtolower((string) parse_url($origin, PHP_URL_HOST));
if ($ohost === '' || $ohost !== $host) fail(403, 'Same-origin only.');

require_once __DIR__ . '/../people/inc/db.php';
$user = ttg_current_user();
if (!$user) fail(403, 'Sign in first.');

$raw = (string) file_get_contents('php://input', false, null, 0, 10001);
$in  = json_decode($raw, true);
if (!is_array($in)) fail(400, 'JSON body required.');

$name  = mb_substr(trim((string) ($in['name']  ?? '')), 0, 120);
$line  = mb_substr(trim((string) ($in['line']  ?? '')), 0, 120);
$inked = mb_substr(trim((string) ($in['inked'] ?? '')), 0, 40);
$lng   = isset($in['lng']) ? (float) $in['lng'] : null;
$lat   = isset($in['lat']) ? (float) $in['lat'] : null;

if ($name === '') fail(400, 'name required.');

/* default inked date to today in d.m.Y format */
if ($inked === '') $inked = date('d.m.Y');

/* validate coords if provided */
if ($lng !== null && $lat !== null) {
    if ($lng < -11 || $lng > 3 || $lat < 49 || $lat > 61.5) fail(400, 'Coordinates outside Great Britain.');
}

$reg = dirname(__DIR__, 3) . '/ttg-passport/citizens.json';
if (!is_file($reg)) fail(500, 'Passport register not found.');

/* atomic read-modify-write with exclusive lock */
$fh = fopen($reg, 'c+');
if (!$fh) fail(500, 'Could not open the register.');
if (!flock($fh, LOCK_EX)) { fclose($fh); fail(500, 'Could not lock the register.'); }

$json = stream_get_contents($fh);
$all  = json_decode((string) $json, true);
if (!is_array($all)) { flock($fh, LOCK_UN); fclose($fh); fail(500, 'Register is not valid JSON.'); }

/* find the citizen matching this user's display name */
$needle = mb_strtolower(trim((string) ($user['display_name'] ?? '')));
$idx    = null;
foreach ($all as $i => $c) {
    if (mb_strtolower(trim((string) ($c['name'] ?? ''))) === $needle) { $idx = $i; break; }
}

if ($idx === null) {
    flock($fh, LOCK_UN); fclose($fh);
    fail(404, 'No citizen record found for "' . $user['display_name'] . '". Enrol at /passport/ first.');
}

/* build the new place entry */
$place = ['name' => $name, 'line' => $line, 'inked' => $inked];
if ($lng !== null && $lat !== null) {
    $place['lon'] = $lng;  // citizens.json uses 'lon' not 'lng'
    $place['lat'] = $lat;
}

/* prevent duplicate by name (case-insensitive) */
$nameLower = mb_strtolower($name);
foreach ($all[$idx]['places'] ?? [] as $p) {
    if (mb_strtolower((string) ($p['name'] ?? '')) === $nameLower) {
        flock($fh, LOCK_UN); fclose($fh);
        echo json_encode(['ok' => true, 'duplicate' => true, 'place' => $place]);
        exit;
    }
}

$all[$idx]['places'][] = $place;

/* write back */
$out = json_encode($all, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
ftruncate($fh, 0);
rewind($fh);
fwrite($fh, $out);
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);

echo json_encode(['ok' => true, 'duplicate' => false, 'place' => $place + ['lng' => $lng, 'lat' => $lat]]);
