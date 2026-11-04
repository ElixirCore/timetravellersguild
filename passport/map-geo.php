<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: same-origin');

$lat = (float)($_GET['lat'] ?? 0);
$lon = (float)($_GET['lon'] ?? 0);
$r   = min(20.0, max(0.5, (float)($_GET['r'] ?? 3)));

if (!$lat && !$lon) { echo '{"error":"missing params"}'; exit; }
if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) { echo '{"error":"invalid coords"}'; exit; }

$cacheDir = dirname(__DIR__, 3) . '/ttg-passport/geo-cache';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0750, true);

$key   = md5(sprintf('%.5f,%.5f,%.2f', $lat, $lon, $r));
$cache = "$cacheDir/$key.json";

if (is_file($cache) && time() - filemtime($cache) < 604800) { // 7-day TTL
    header('X-Cache: HIT');
    readfile($cache);
    exit;
}

$dLat = $r / 111.0;
$dLon = $r / (111.0 * cos(deg2rad($lat)));
$bbox = sprintf('%.6f,%.6f,%.6f,%.6f',
    $lat - $dLat, $lon - $dLon,
    $lat + $dLat, $lon + $dLon
);

$query = <<<OVERPASS
[out:json][timeout:30];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track)$"]({$bbox});
  way["waterway"~"^(river|stream|canal|drain)$"]({$bbox});
  way["natural"="coastline"]({$bbox});
  way["railway"="rail"]({$bbox});
  way["natural"~"^(wood|water|heath|scrub|grassland|sand|wetland)$"]({$bbox});
  way["landuse"~"^(forest|farmland|meadow|orchard|residential|commercial|industrial|retail|cemetery)$"]({$bbox});
  way["leisure"~"^(park|nature_reserve|garden)$"]({$bbox});
);
out body;
>;
out skel qt;
OVERPASS;

$ch = curl_init('https://overpass-api.de/api/interpreter');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => 'data=' . urlencode($query),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 35,
    CURLOPT_HTTPHEADER     => ['User-Agent: TTG-Passport/1.0 (tobywhy@gmail.com)'],
]);
$resp = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($code !== 200 || !$resp) {
    http_response_code(502);
    echo json_encode(['error' => 'upstream failed', 'code' => $code]);
    exit;
}

@file_put_contents($cache, $resp);
header('X-Cache: MISS');
echo $resp;
