<?php
/*
 * Graph places for the passport map — /map/places.php
 *
 * Returns all PLACE nodes from the live graph (nodes.json) with coordinates.
 * Coordinates come from metadata.approx first, then from the proxy's shared
 * Nominatim cache (populated whenever the map geocodes a place via proxy.php).
 * For uncached nodes without approx, geocodes up to MAX_NEW per request and
 * stores the result in the same cache directory proxy.php uses, so subsequent
 * calls find it instantly.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../people/inc/db.php';
require_once __DIR__ . '/../inc/graph.php';

$user = ttg_current_user();
if (!$user) { http_response_code(401); echo '{"error":"Not signed in"}'; exit; }

const MAX_NEW = 4; // max Nominatim calls per request (rate-limits slowdown)
$CACHE = __DIR__ . '/cache';
if (!is_dir($CACHE)) { @mkdir($CACHE, 0755, true); @file_put_contents($CACHE . '/.htaccess', "Require all denied\n"); }

/* reuse proxy.php's cache layout: sha256('place:' + lowercase name) */
function places_cache_get(string $name, string $dir): ?array {
    $f = $dir . '/' . hash('sha256', 'place:' . mb_strtolower($name));
    if (!is_file($f)) return null;
    $j = @json_decode((string) @file_get_contents($f), true);
    return (is_array($j) && isset($j['lat']) && $j['lat'] !== null) ? $j : null;
}
function places_cache_set(string $name, array $coords, string $dir): void {
    $f = $dir . '/' . hash('sha256', 'place:' . mb_strtolower($name));
    $payload = json_encode(['lng' => $coords['lng'], 'lat' => $coords['lat'], 'label' => $coords['label'] ?? '']);
    @file_put_contents($f, $payload, LOCK_EX);
    @file_put_contents($f . '.type', 'application/json', LOCK_EX);
}
function places_nominatim(string $name, string $dir): ?array {
    $lock = fopen($dir . '/.nominatim.lock', 'c');
    flock($lock, LOCK_EX);
    $last = (float) @file_get_contents($dir . '/.nominatim.last');
    $wait = 1.1 - (microtime(true) - $last);
    if ($wait > 0) usleep((int) ($wait * 1e6));
    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
        'q' => $name, 'format' => 'jsonv2', 'limit' => 1,
    ]);
    $ctx = stream_context_create(['http' => ['header' => "User-Agent: TimeTravellersGuild-PassportMap/1.0\r\n", 'timeout' => 8]]);
    $res = @file_get_contents($url, false, $ctx);
    @file_put_contents($dir . '/.nominatim.last', (string) microtime(true));
    flock($lock, LOCK_UN); fclose($lock);
    if (!$res) return null;
    $j = @json_decode($res, true);
    if (!is_array($j) || !isset($j[0]['lat'])) return null;
    return ['lat' => (float) $j[0]['lat'], 'lng' => (float) $j[0]['lon'], 'label' => (string) ($j[0]['display_name'] ?? '')];
}

$nodes = ttg_graph_unique_nodes();
$places = [];
$dedup = []; // title → true, to filter pending-* duplicates when canonical exists
$newGeocoded = 0;

/* first pass: collect canonical (non-pending) titles */
foreach ($nodes as $node) {
    if (strtoupper((string) ($node['type'] ?? '')) !== 'PLACE') continue;
    $slug = (string) ($node['slug'] ?? '');
    if ($slug === '' || str_starts_with($slug, 'pending-')) continue;
    $dedup[mb_strtolower((string) ($node['title'] ?? ''))] = true;
}

foreach ($nodes as $node) {
    if (strtoupper((string) ($node['type'] ?? '')) !== 'PLACE') continue;
    $vis = strtoupper((string) ($node['visibility'] ?? ''));
    if (in_array($vis, ['PRIVATE', 'SEALED', 'LOST', 'DEPARTMENTAL'], true)) continue;

    $slug  = (string) ($node['slug'] ?? '');
    $title = (string) ($node['title'] ?? '');
    if ($slug === '' || $title === '') continue;

    /* skip pending-* when a canonical node with the same title exists */
    if (str_starts_with($slug, 'pending-') && isset($dedup[mb_strtolower($title)])) continue;

    $approx = (string) ($node['metadata']['approx'] ?? '');
    $lat = $lng = null;

    if ($approx !== '' && preg_match('/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/', trim($approx), $m)) {
        $lat = (float) $m[1]; $lng = (float) $m[2];
    } else {
        $cached = places_cache_get($title, $CACHE);
        if ($cached) {
            $lat = (float) $cached['lat']; $lng = (float) $cached['lng'];
        } elseif ($newGeocoded < MAX_NEW) {
            $coords = places_nominatim($title, $CACHE);
            if ($coords) {
                $lat = $coords['lat']; $lng = $coords['lng'];
                places_cache_set($title, $coords, $CACHE);
            }
            $newGeocoded++;
        }
    }

    if ($lat === null || $lng === null) continue;

    $places[] = [
        'slug'  => $slug,
        'title' => $title,
        'body'  => mb_substr((string) ($node['body'] ?? ''), 0, 300),
        'lat'   => $lat,
        'lng'   => $lng,
        'href'  => '/now/tree#' . $slug,
    ];
}

echo json_encode(['places' => $places], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
