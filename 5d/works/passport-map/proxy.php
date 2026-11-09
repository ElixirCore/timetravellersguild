<?php
/*
 * Passport map relay — timetravellersguild.com/passport/map/proxy.php
 *
 * Fetches from three fixed upstreams only and caches the answers on disk:
 *   src=bgs    BGS 1:625k geology WMS (GetMap tiles, GetFeatureInfo)
 *   src=cadw   Cadw scheduled monuments / listed buildings (DataMapWales WFS, GeoJSON)
 *   src=place  place-name lookup (OpenStreetMap Nominatim), cached for good
 *
 * It is not an open proxy: the host is fixed per source and only named parameters pass through.
 * No keys are needed, so secrets.php is not used.
 */
declare(strict_types=1);

const UA = 'TimeTravellersGuild-PassportMap/1.0 (+https://timetravellersguild.com/passport/map)';
$CACHE = __DIR__ . '/cache';
if (!is_dir($CACHE)) { @mkdir($CACHE, 0755, true); @file_put_contents($CACHE . '/.htaccess', "Require all denied\n"); }

function fail(int $code, string $msg): void {
  http_response_code($code); header('Content-Type: text/plain; charset=utf-8'); echo $msg; exit;
}
function fetch_url(string $url, int $timeout = 20): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3,
    CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_USERAGENT => UA, CURLOPT_ENCODING => '']);
  $body = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  $type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
  curl_close($ch);
  return [$body === false ? '' : $body, $code, $type];
}
function cached(string $dir, string $key, int $ttl, callable $get): array {
  $f = $dir . '/' . hash('sha256', $key);
  if (is_file($f) && ($ttl === 0 || filemtime($f) > time() - $ttl) && is_file($f . '.type')) {
    return [file_get_contents($f), 200, file_get_contents($f . '.type'), 'HIT'];
  }
  [$body, $code, $type] = $get();
  if ($code === 200 && $body !== '') { @file_put_contents($f, $body, LOCK_EX); @file_put_contents($f . '.type', $type, LOCK_EX); }
  return [$body, $code, $type, 'MISS'];
}
function pick(array $allowed): array {
  $out = [];
  foreach ($_GET as $k => $v) {
    if (!is_string($v)) continue;
    $K = strtoupper((string) $k);
    if (in_array($K, $allowed, true)) $out[$K] = substr($v, 0, 200);
  }
  return $out;
}
function out(array $r, int $maxAge): void {
  [$body, $code, $type, $hit] = $r;
  if ($code !== 200) fail(502, 'Upstream returned ' . $code);
  header('Content-Type: ' . ($type ?: 'application/octet-stream'));
  header('Cache-Control: public, max-age=' . $maxAge);
  header('X-Relay-Cache: ' . $hit);
  echo $body; exit;
}

$src = $_GET['src'] ?? '';

if ($src === 'bgs') {
  $q = pick(['SERVICE', 'VERSION', 'REQUEST', 'LAYERS', 'QUERY_LAYERS', 'STYLES', 'CRS', 'BBOX', 'WIDTH', 'HEIGHT',
             'FORMAT', 'TRANSPARENT', 'I', 'J', 'INFO_FORMAT', 'FEATURE_COUNT']);
  if (($q['SERVICE'] ?? '') !== 'WMS' || !in_array($q['REQUEST'] ?? '', ['GetMap', 'GetFeatureInfo'], true)) fail(400, 'Bad request');
  if (!preg_match('/^GBR_BGS_625k_[A-Z]{2,3}$/', $q['LAYERS'] ?? '')) fail(400, 'Bad layer');
  if (!preg_match('/^-?[\d.]+,-?[\d.]+,-?[\d.]+,-?[\d.]+$/', $q['BBOX'] ?? '')) fail(400, 'Bad bbox');
  $url = 'https://ogc.bgs.ac.uk/cgi-bin/BGS_Bedrock_and_Superficial_Geology/ows?' . http_build_query($q);
  $tile = $q['REQUEST'] === 'GetMap';
  out(cached($CACHE, $url, $tile ? 30 * 86400 : 7 * 86400, fn() => fetch_url($url)), $tile ? 7 * 86400 : 3600);
}

if ($src === 'cadw') {
  $types = ['sam' => 'inspire-wg:Cadw_SAM', 'lb' => 'inspire-wg:Cadw_ListedBuildings'];
  $layer = $_GET['layer'] ?? '';
  $bbox = $_GET['bbox'] ?? '';
  if (!isset($types[$layer])) fail(400, 'Bad layer');
  if (!preg_match('/^-?\d{1,3}\.\d{1,2},-?\d{1,2}\.\d{1,2},-?\d{1,3}\.\d{1,2},-?\d{1,2}\.\d{1,2}$/', $bbox)) fail(400, 'Bad bbox');
  $b = array_map('floatval', explode(',', $bbox));
  if ($b[2] - $b[0] > 0.11 || $b[3] - $b[1] > 0.11) fail(400, 'Area too large');
  $url = 'https://datamap.gov.wales/geoserver/ows?' . http_build_query([
    'service' => 'WFS', 'version' => '1.0.0', 'request' => 'GetFeature', 'typename' => $types[$layer],
    'outputFormat' => 'application/json', 'srsName' => 'EPSG:4326', 'maxFeatures' => 3000,
    'bbox' => $bbox . ',EPSG:4326']);
  out(cached($CACHE, $url, 7 * 86400, fn() => fetch_url($url, 40)), 86400);
}

if ($src === 'place') {
  $name = trim((string) ($_GET['q'] ?? ''));
  if ($name === '' || mb_strlen($name) > 80) fail(400, 'Bad place');
  $key = 'place:' . mb_strtolower($name);
  $r = cached($CACHE, $key, 0, function () use ($name, $CACHE) {
    // Nominatim asks for no more than one request a second: serialise and space them out.
    $lock = fopen($CACHE . '/.nominatim.lock', 'c'); flock($lock, LOCK_EX);
    $last = (float) @file_get_contents($CACHE . '/.nominatim.last');
    $wait = 1.1 - (microtime(true) - $last); if ($wait > 0) usleep((int) ($wait * 1e6));
    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query(['q' => $name, 'format' => 'jsonv2', 'limit' => 1, 'countrycodes' => 'gb']);
    [$body, $code] = fetch_url($url);
    file_put_contents($CACHE . '/.nominatim.last', (string) microtime(true)); flock($lock, LOCK_UN); fclose($lock);
    if ($code !== 200) return ['', $code, ''];
    $j = json_decode($body, true);
    $hit = is_array($j) && isset($j[0]['lat']) ? ['lng' => (float) $j[0]['lon'], 'lat' => (float) $j[0]['lat'], 'label' => $j[0]['display_name'] ?? ''] : ['lng' => null, 'lat' => null];
    return [json_encode($hit), 200, 'application/json'];
  });
  out($r, 86400);
}

fail(400, 'Unknown source');
