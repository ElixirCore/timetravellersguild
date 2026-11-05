<?php
/*
 * Passport map relay — timetravellersguild.com/map/proxy.php
 *
 * Fetches from three fixed upstreams only and caches the answers on disk:
 *   src=bgs    BGS 1:625k geology WMS (GetMap tiles, GetFeatureInfo)
 *   src=cadw   Cadw scheduled monuments / listed buildings (DataMapWales WFS, GeoJSON)
 *   src=place  place-name lookup (OpenStreetMap Nominatim), cached for good
 *   src=cadw   layer=nmrw   Coflein / National Monuments Record of Wales sites (RCAHMW, DataMapWales WFS)
 *   src=cadw   layer=names  List of Historic Place Names of Wales (RCAHMW, DataMapWales WFS)
 *   src=wiki   Wikipedia articles near a point (en / cy), and src=wikisum for one article's summary
 *   src=commons  geotagged Wikimedia Commons photos near a point (thumbnail, date taken, author, licence)
 *   src=europeana  old photographs by place name (Europeana; needs EUROPEANA_KEY in secret_agent.php)
 *   src=osmhist  OpenStreetMap historic places (memorials, battlefields, ruins, mines…) in a 0.05° cell, worldwide (Overpass)
 *   src=wdevents dated events near a point (Wikidata: strikes, riots, disasters, battles…), worldwide
 *   src=wdpeople people born in settlements near a point (Wikidata), worldwide
 *   src=he       England: Historic England layers in a cell (listed buildings, scheduled monuments, parks and gardens,
 *                battlefields, World Heritage Sites, conservation areas, Heritage at Risk 2026, Greater London
 *                Archaeological Priority Areas), from Historic England's open ArcGIS services, GeoJSON
 *   src=plaques  commemorative plaques in a cell (Open Plaques), worldwide but richest in London
 *   src=oldmaps  georeferenced old maps covering a point: Allmaps (David Rumsey, Library of Congress, Internet Archive…)
 *                and mapwarper.net, local maps first; each with its own tile URL for an overlay
 *
 * It is not an open proxy: the host is fixed per source and only named parameters pass through.
 * No keys are needed, so secrets.php is not used.
 */
declare(strict_types=1);

const UA = 'TimeTravellersGuild-PassportMap/1.0 (+https://timetravellersguild.com/map)';
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
  header('Vary: Accept-Encoding');
  // The host does not compress these; JSON cells shrink about tenfold.
  if (str_contains((string) $type, 'json') && strlen($body) > 2048 && function_exists('gzencode')
      && str_contains((string) ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? ''), 'gzip') && !headers_sent()) {
    $z = gzencode($body, 6);
    if ($z !== false) { header('Content-Encoding: gzip'); $body = $z; }
  }
  header('Content-Length: ' . strlen($body));
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
  $types = ['sam' => 'inspire-wg:Cadw_SAM', 'lb' => 'inspire-wg:Cadw_ListedBuildings',
            'nmrw' => 'geonode:rcahmw_nmrw_terrestrialsites_rcahmw_bng', 'names' => 'geonode:rcahmw_historicplacenames_wales_recordednames'];
  // RCAHMW layers carry dozens of fields (and mis-encoded Welsh duplicates): keep only what the map shows.
  $keep = ['nmrw' => ['nprn', 'name', 'site_type', 'period', 'evidence', 'community', 'unitary_au', 'old_county', 'url'],
           'names' => ['enw_name', 'place_type', 'discy_pdes', 'blwgyn_eye', 'parish', 'county', 'prim_srce', 'url_en']];
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
  if (!isset($keep[$layer])) out(cached($CACHE, $url, 7 * 86400, fn() => fetch_url($url, 40)), 86400);
  $fields = $keep[$layer];
  out(cached($CACHE, 'slim:' . $url, 7 * 86400, function () use ($url, $fields) {
    [$body, $code, $type] = fetch_url($url, 40);
    $j = $code === 200 ? json_decode($body, true) : null;
    if (!is_array($j) || !isset($j['features'])) return [$body, $code === 200 ? 502 : $code, $type];
    $out = [];
    foreach ($j['features'] as $f) {
      if (!isset($f['geometry']['coordinates'])) continue;
      $p = [];
      foreach ($fields as $k) {
        $v = $f['properties'][$k] ?? null;
        if (is_string($v)) $v = trim(mb_convert_encoding($v, 'UTF-8', 'UTF-8'));
        if ($v !== null && $v !== '' && $v !== 'None') $p[$k] = $v;
      }
      $g = $f['geometry'];
      if (($g['type'] ?? '') === 'Point') $g['coordinates'] = [round((float) $g['coordinates'][0], 5), round((float) $g['coordinates'][1], 5)];
      if (isset($p['url_en'])) $p['url_en'] = str_replace('https://historicplacenames.rcahmw.gov.uk/placenames/recordedname/', '', (string) $p['url_en']);
      $out[] = ['type' => 'Feature', 'id' => $f['id'] ?? null, 'geometry' => $g, 'properties' => $p];
    }
    return [json_encode(['type' => 'FeatureCollection', 'features' => $out], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

if ($src === 'wiki' || $src === 'wikisum') {
  $lang = ($_GET['lang'] ?? 'en') === 'cy' ? 'cy' : 'en';
  $host = 'https://' . $lang . '.wikipedia.org';
  if ($src === 'wiki') {
    $lat = (float) ($_GET['lat'] ?? 0); $lng = (float) ($_GET['lng'] ?? 0);
    if ($lat < -85 || $lat > 85 || $lng < -180 || $lng > 180) fail(400, 'Bad point');
    // Rounded to the client's 0.1° cell centres, so the cache is shared.
    $lat = round($lat, 2); $lng = round($lng, 2);
    $url = $host . '/w/api.php?' . http_build_query(['action' => 'query', 'format' => 'json', 'formatversion' => 2,
      'generator' => 'geosearch', 'ggscoord' => $lat . '|' . $lng, 'ggsradius' => 10000, 'ggslimit' => 60,
      'prop' => 'coordinates|description|pageimages', 'piprop' => 'thumbnail', 'pithumbsize' => 320, 'pilimit' => 60]);
    out(cached($CACHE, $url, 7 * 86400, function () use ($url, $lang) {
      [$body, $code] = fetch_url($url);
      $j = $code === 200 ? json_decode($body, true) : null;
      if (!is_array($j) || isset($j['error'])) return ['', is_array($j) ? 503 : ($code === 200 ? 502 : $code), ''];
      $fs = [];
      foreach (($j['query']['pages'] ?? []) as $pg) {
        $c = $pg['coordinates'][0] ?? null; if (!$c) continue;
        $fs[] = ['type' => 'Feature', 'id' => $lang . ':' . (int) ($pg['pageid'] ?? 0),
          'geometry' => ['type' => 'Point', 'coordinates' => [(float) $c['lon'], (float) $c['lat']]],
          'properties' => array_filter(['title' => (string) ($pg['title'] ?? ''), 'lang' => $lang, 'description' => (string) ($pg['description'] ?? ''),
            'thumb' => (string) ($pg['thumbnail']['source'] ?? '')], fn($v) => $v !== '')];
      }
      return [json_encode(['type' => 'FeatureCollection', 'features' => $fs], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
    }), 86400);
  }
  $title = trim((string) ($_GET['title'] ?? ''));
  if ($title === '' || mb_strlen($title) > 200) fail(400, 'Bad title');
  $url = $host . '/api/rest_v1/page/summary/' . rawurlencode(str_replace(' ', '_', $title));
  out(cached($CACHE, $url, 7 * 86400, function () use ($url) {
    [$body, $code] = fetch_url($url);
    $j = $code === 200 ? json_decode($body, true) : null;
    if (!is_array($j)) return ['', $code === 200 ? 502 : $code, ''];
    return [json_encode(['title' => (string) ($j['title'] ?? ''), 'extract' => mb_substr((string) ($j['extract'] ?? ''), 0, 1200),
      'url' => (string) ($j['content_urls']['desktop']['page'] ?? ''), 'thumb' => (string) ($j['thumbnail']['source'] ?? '')],
      JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

if ($src === 'place') {
  $name = trim((string) ($_GET['q'] ?? ''));
  if ($name === '' || mb_strlen($name) > 80) fail(400, 'Bad place');
  $key = 'place:world:' . mb_strtolower($name);
  $r = cached($CACHE, $key, 0, function () use ($name, $CACHE) {
    // Nominatim asks for no more than one request a second: serialise and space them out.
    $lock = fopen($CACHE . '/.nominatim.lock', 'c'); flock($lock, LOCK_EX);
    $last = (float) @file_get_contents($CACHE . '/.nominatim.last');
    $wait = 1.1 - (microtime(true) - $last); if ($wait > 0) usleep((int) ($wait * 1e6));
    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query(['q' => $name, 'format' => 'jsonv2', 'limit' => 1]);
    [$body, $code] = fetch_url($url);
    file_put_contents($CACHE . '/.nominatim.last', (string) microtime(true)); flock($lock, LOCK_UN); fclose($lock);
    if ($code !== 200) return ['', $code, ''];
    $j = json_decode($body, true);
    $hit = is_array($j) && isset($j[0]['lat']) ? ['lng' => (float) $j[0]['lon'], 'lat' => (float) $j[0]['lat'], 'label' => $j[0]['display_name'] ?? ''] : ['lng' => null, 'lat' => null];
    return [json_encode($hit), 200, 'application/json'];
  });
  out($r, 86400);
}

$plain = static fn($v): string => trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags((string) $v), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');

if ($src === 'commons') {
  $lat = (float) ($_GET['lat'] ?? 0); $lng = (float) ($_GET['lng'] ?? 0);
  if ($lat < -85 || $lat > 85 || $lng < -180 || $lng > 180) fail(400, 'Bad point');
  $lat = round($lat, 2); $lng = round($lng, 2);
  $key = 'commons:v4:' . $lat . ',' . $lng;
  out(cached($CACHE, $key, 7 * 86400, function () use ($lat, $lng, $plain) {
    $api = 'https://commons.wikimedia.org/w/api.php?';
    // MediaWiki reports errors (e.g. "search is too busy") with HTTP 200: treat them as failures so they are never cached.
    $call = static function (string $url): ?array {
      for ($try = 0; $try < 2; $try++) {
        [$b, $c] = fetch_url($url);
        $j = $c === 200 ? json_decode($b, true) : null;
        if (is_array($j) && !isset($j['error'])) return $j;
        usleep(700000);
      }
      return null;
    };
    $j = $call($api . http_build_query(['action' => 'query', 'format' => 'json', 'formatversion' => 2, 'list' => 'geosearch',
      'gscoord' => $lat . '|' . $lng, 'gsradius' => 1600, 'gslimit' => 100, 'gsnamespace' => 6]));
    if ($j === null) return ['', 503, ''];
    $coords = [];
    foreach (($j['query']['geosearch'] ?? []) as $g) $coords[(string) $g['title']] = [(float) $g['lon'], (float) $g['lat']];
    $fs = [];
    foreach (array_chunk(array_keys($coords), 50) as $chunk) {
      $j2 = $call($api . http_build_query(['action' => 'query', 'format' => 'json', 'formatversion' => 2, 'titles' => implode('|', $chunk),
        'prop' => 'imageinfo', 'iiprop' => 'url|mime|extmetadata', 'iiurlwidth' => 480,
        'iiextmetadatafilter' => 'DateTimeOriginal|LicenseShortName|Artist|ImageDescription|ObjectName|Categories']));
      if ($j2 === null) return ['', 503, '']; // partial results are not cached either
      foreach (($j2['query']['pages'] ?? []) as $pg) {
        $ii = $pg['imageinfo'][0] ?? null; $t = (string) ($pg['title'] ?? '');
        if (!$ii || !isset($coords[$t]) || !str_starts_with((string) ($ii['mime'] ?? ''), 'image/') || empty($ii['thumburl'])) continue;
        $m = $ii['extmetadata'] ?? [];
        $date = $plain($m['DateTimeOriginal']['value'] ?? '');
        $year = preg_match('/\b(1[5-9]\d\d|20\d\d)\b/', $date, $ym) ? (int) $ym[1] : null;
        // Archive photos often carry the scan or upload date (e.g. a Lawrence Collection negative of 1888 "dated" 2007).
        // When Commons files the photo under an earlier year or decade ("Ireland in the 1880s", "1888 in Wales",
        // "Photographs taken on 1888-07-30"), believe the categories.
        $dated = '';
        $catYear = null;
        foreach (explode('|', (string) ($m['Categories']['value'] ?? '')) as $cat) {
          if (preg_match('/(?:^|\s)in the (1[5-9]\d0|20[0-2]0)s\b/i', $cat, $cm) || preg_match('/^(1[5-9]\d0|20[0-2]0)s (?:in|photographs)\b/i', $cat, $cm)) { $y = (int) $cm[1]; $label = $cm[1] . 's'; }
          elseif (preg_match('/^(1[5-9]\d\d|20[0-2]\d) (?:in|photographs)\b/i', $cat, $cm) || preg_match('/^Photographs taken on (1[5-9]\d\d|20[0-2]\d)/i', $cat, $cm)) { $y = (int) $cm[1]; $label = $cm[1]; }
          else continue;
          if ($catYear === null || $y < $catYear) { $catYear = $y; $dated = 'the ' . $label; if (strlen($label) === 4) $dated = $label; }
        }
        if ($catYear !== null && ($year === null || $catYear < $year - 10)) { $year = $catYear; } else { $dated = ''; }
        $fs[] = ['type' => 'Feature', 'id' => (int) ($pg['pageid'] ?? 0), 'geometry' => ['type' => 'Point', 'coordinates' => $coords[$t]],
          'properties' => array_filter([
            'title' => mb_substr(preg_replace('/\s*-\s*geograph\.org\.uk\s*-\s*\d+\s*$/i', '', $plain($m['ObjectName']['value'] ?? '') ?: preg_replace('/^File:|\.[a-z0-9]{3,4}$/i', '', $t)) ?? '', 0, 140),
            'thumb' => (string) $ii['thumburl'], 'page' => (string) ($ii['descriptionurl'] ?? ''),
            'date' => mb_substr($date, 0, 40), 'year' => $year, 'dated' => $dated,
            'author' => mb_substr($plain($m['Artist']['value'] ?? ''), 0, 80), 'licence' => mb_substr($plain($m['LicenseShortName']['value'] ?? ''), 0, 40),
            'desc' => mb_substr($plain($m['ImageDescription']['value'] ?? ''), 0, 240)], fn($v) => $v !== '' && $v !== null)];
      }
    }
    return [json_encode(['type' => 'FeatureCollection', 'features' => $fs], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

if ($src === 'europeana') {
  $secret = __DIR__ . '/secret_agent.php';
  $s = is_file($secret) ? (static fn(string $f) => require $f)($secret) : [];
  $key = is_array($s) ? (string) ($s['EUROPEANA_KEY'] ?? '') : '';
  if ($key === '') $key = (string) (getenv('EUROPEANA_KEY') ?: '');
  if ($key === '') fail(503, 'Old photographs need a Europeana key (EUROPEANA_KEY in map/secret_agent.php).');
  $place = trim((string) ($_GET['place'] ?? ''));
  if ($place === '' || mb_strlen($place) > 80 || !preg_match('/^[\p{L}\p{N} \'’.,()&-]+$/u', $place)) fail(400, 'Bad place');
  $to = (int) ($_GET['to'] ?? 0);
  $q = '"' . str_replace('"', '', $place) . '"' . ($to >= 1800 && $to <= 2100 ? ' AND YEAR:[1500 TO ' . $to . ']' : '');
  $url = 'https://api.europeana.eu/record/v2/search.json?' . http_build_query(['wskey' => $key, 'query' => $q, 'qf' => 'TYPE:IMAGE', 'rows' => 30, 'profile' => 'standard']);
  out(cached($CACHE, $url, 7 * 86400, function () use ($url, $plain) {
    [$body, $code] = fetch_url($url, 25);
    $j = $code === 200 ? json_decode($body, true) : null;
    if (!is_array($j) || empty($j['success'])) return ['', $code === 200 ? 502 : $code, ''];
    $items = [];
    foreach (($j['items'] ?? []) as $it) {
      $thumb = (string) ($it['edmPreview'][0] ?? '');
      $link = (string) ($it['guid'] ?? '');
      if (!preg_match('#^https://api\.europeana\.eu/#', $thumb)) $thumb = '';
      if (!preg_match('#^https://www\.europeana\.eu/#', $link)) $link = '';
      $items[] = array_filter(['title' => mb_substr($plain($it['title'][0] ?? ''), 0, 160), 'year' => (string) ($it['year'][0] ?? ''),
        'provider' => mb_substr($plain($it['dataProvider'][0] ?? ''), 0, 80), 'creator' => mb_substr($plain($it['dcCreator'][0] ?? ''), 0, 80),
        'thumb' => $thumb, 'link' => $link, 'rights' => (string) ($it['rights'][0] ?? '')], fn($v) => $v !== '');
    }
    usort($items, fn($a, $b) => ((int) ($a['year'] ?? 9999)) <=> ((int) ($b['year'] ?? 9999)));
    return [json_encode(['total' => (int) ($j['totalResults'] ?? 0), 'items' => $items], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

/* Overpass and Wikidata can be slow: give these sources more than the default 30 s (where the host allows it). */
if (in_array($src, ['osmhist', 'wdevents', 'wdpeople'], true)) @set_time_limit(100);

/* Wikidata query service: busy answers are retried once (only if the first failed quickly) and never cached. */
$sparql = static function (string $q): ?array {
  $url = 'https://query.wikidata.org/sparql?' . http_build_query(['query' => $q, 'format' => 'json']);
  $t0 = microtime(true);
  for ($try = 0; $try < 2; $try++) {
    [$b, $c] = fetch_url($url, 40);
    $j = $c === 200 ? json_decode($b, true) : null;
    if (is_array($j) && isset($j['results']['bindings'])) return $j['results']['bindings'];
    if (microtime(true) - $t0 > 20) break;
    usleep(1500000);
  }
  return null;
};
$point = static function (): array {
  $lat = round((float) ($_GET['lat'] ?? 0), 2); $lng = round((float) ($_GET['lng'] ?? 0), 2);
  if ($lat < -85 || $lat > 85 || $lng < -180 || $lng > 180 || ($lat == 0.0 && $lng == 0.0)) fail(400, 'Bad point');
  return [$lat, $lng];
};
$qid = static fn(string $uri): string => preg_match('#/(Q\d+)$#', $uri, $m) ? $m[1] : '';
$yearOf = static function (string $iso): ?int {
  // Wikidata dates look like "1966-10-21T00:00:00Z" or "-0055-01-01T00:00:00Z"
  return preg_match('/^(-?)(\d{1,6})-/', $iso, $m) ? (int) (($m[1] === '-' ? -1 : 1) * (int) $m[2]) : null;
};

if ($src === 'osmhist') {
  $bbox = (string) ($_GET['bbox'] ?? '');
  if (!preg_match('/^-?\d{1,3}\.\d{1,2},-?\d{1,2}\.\d{1,2},-?\d{1,3}\.\d{1,2},-?\d{1,2}\.\d{1,2}$/', $bbox)) fail(400, 'Bad bbox');
  $b = array_map('floatval', explode(',', $bbox));
  if ($b[2] - $b[0] > 0.051 || $b[3] - $b[1] > 0.051) fail(400, 'Area too large');
  $q = '[out:json][timeout:45];nwr["historic"]["name"](' . $b[1] . ',' . $b[0] . ',' . $b[3] . ',' . $b[2] . ');out center tags 800;';
  out(cached($CACHE, 'osmhist:v1:' . $bbox, 30 * 86400, function () use ($q) {
    // The main public server first; if it fails quickly (busy, rate-limited), one public mirror.
    $j = null; $t0 = microtime(true);
    foreach (['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'] as $ep) {
      [$body, $code] = fetch_url($ep . '?' . http_build_query(['data' => $q]), 50);
      $j = $code === 200 ? json_decode($body, true) : null;
      // Overpass reports timeouts and overload as a "remark" with HTTP 200: never cache those.
      if (!is_array($j) || !isset($j['elements']) || preg_match('/runtime error|timed out|too many/i', (string) ($j['remark'] ?? ''))) $j = null;
      if ($j !== null || microtime(true) - $t0 > 40) break;
    }
    if ($j === null) return ['', 503, ''];
    $fs = [];
    foreach ($j['elements'] as $e) {
      $lon = $e['lon'] ?? ($e['center']['lon'] ?? null); $lat = $e['lat'] ?? ($e['center']['lat'] ?? null);
      if ($lon === null || $lat === null) continue;
      $t = $e['tags'] ?? [];
      $p = [];
      foreach (['name', 'name:en', 'historic', 'memorial', 'start_date', 'end_date', 'wikidata', 'wikipedia', 'inscription', 'description', 'heritage', 'site_type', 'castle_type', 'ruins'] as $k) {
        if (isset($t[$k]) && is_string($t[$k]) && trim($t[$k]) !== '') $p[str_replace(':', '_', $k)] = mb_substr(trim($t[$k]), 0, $k === 'inscription' || $k === 'description' ? 300 : 120);
      }
      $p['osm'] = $e['type'] . '/' . $e['id'];
      $fs[] = ['type' => 'Feature', 'id' => crc32($p['osm']), 'geometry' => ['type' => 'Point', 'coordinates' => [round((float) $lon, 5), round((float) $lat, 5)]], 'properties' => $p];
    }
    return [json_encode(['type' => 'FeatureCollection', 'features' => $fs], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

if ($src === 'wdevents') {
  [$lat, $lng] = $point();
  out(cached($CACHE, 'wdevents:v1:' . $lat . ',' . $lng, 14 * 86400, function () use ($lat, $lng, $sparql, $qid, $yearOf) {
    $q = 'SELECT ?item ?itemLabel ?itemDescription ?date ?end ?typeLabel ?coord ?article WHERE {
      SERVICE wikibase:around { ?item wdt:P625 ?coord. bd:serviceParam wikibase:center "Point(' . $lng . ' ' . $lat . ')"^^geo:wktLiteral. bd:serviceParam wikibase:radius "10". }
      ?item wdt:P31 ?type. FILTER(?type NOT IN (wd:Q5))
      OPTIONAL { ?item wdt:P585 ?d1 } OPTIONAL { ?item wdt:P580 ?d2 } OPTIONAL { ?item wdt:P582 ?end }
      BIND(COALESCE(?d1, ?d2) AS ?date) FILTER(BOUND(?date))
      OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,cy,fr,de,es,it". }
    } LIMIT 300';
    $rows = $sparql($q);
    if ($rows === null) return ['', 503, ''];
    $by = [];
    foreach ($rows as $x) {
      $id = $qid((string) ($x['item']['value'] ?? '')); if ($id === '') continue;
      if (!preg_match('/Point\(([-\d.eE]+) ([-\d.eE]+)\)/', (string) ($x['coord']['value'] ?? ''), $m)) continue;
      $label = (string) ($x['itemLabel']['value'] ?? '');
      if ($label === '' || preg_match('/^Q\d+$/', $label)) $label = (string) ($x['typeLabel']['value'] ?? 'Event');
      if (!isset($by[$id])) $by[$id] = ['type' => 'Feature', 'id' => (int) substr($id, 1), 'geometry' => ['type' => 'Point', 'coordinates' => [round((float) $m[1], 5), round((float) $m[2], 5)]],
        'properties' => array_filter(['label' => mb_substr($label, 0, 140), 'qid' => $id, 'year' => $yearOf((string) ($x['date']['value'] ?? '')),
          'date' => substr((string) ($x['date']['value'] ?? ''), 0, 10), 'end' => substr((string) ($x['end']['value'] ?? ''), 0, 10),
          'kind' => mb_substr((string) ($x['typeLabel']['value'] ?? ''), 0, 60), 'desc' => mb_substr((string) ($x['itemDescription']['value'] ?? ''), 0, 200),
          'wiki' => (string) ($x['article']['value'] ?? '')], fn($v) => $v !== '' && $v !== null)];
    }
    return [json_encode(['type' => 'FeatureCollection', 'features' => array_values($by)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

if ($src === 'wdpeople') {
  [$lat, $lng] = $point();
  // Optional year: only people born by then, asked of Wikidata directly (a big city has thousands of births, so filtering a sample afterwards finds nobody).
  $to = isset($_GET['to']) ? max(-3000, min(2100, (int) $_GET['to'])) : 2100;
  out(cached($CACHE, 'wdpeople:v3:' . $lat . ',' . $lng . ':' . $to, 30 * 86400, function () use ($lat, $lng, $to, $sparql, $qid, $yearOf) {
    // Birthplaces must be settlements, municipalities or cities (any subclass: French communes are municipalities);
    // regions like "South Wales" would pull in half a country.
    $q = 'SELECT ?p ?pLabel ?pDescription ?birth ?death ?placeLabel ?article WHERE {
      SERVICE wikibase:around { ?place wdt:P625 ?c. bd:serviceParam wikibase:center "Point(' . $lng . ' ' . $lat . ')"^^geo:wktLiteral. bd:serviceParam wikibase:radius "6". }
      VALUES ?cls { wd:Q486972 wd:Q15284 wd:Q515 }
      ?place wdt:P31/wdt:P279* ?cls. ?p wdt:P19 ?place; wdt:P31 wd:Q5.
      ' . ($to < 2100 ? '?p wdt:P569 ?birth. FILTER(YEAR(?birth) <= ' . $to . ')' : 'OPTIONAL { ?p wdt:P569 ?birth }') . ' OPTIONAL { ?p wdt:P570 ?death }
      OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,cy,fr,de,es,it". }
    } ORDER BY ?birth LIMIT 150';
    $rows = $sparql($q);
    if ($rows === null) return ['', 503, ''];
    $by = [];
    foreach ($rows as $x) {
      $id = $qid((string) ($x['p']['value'] ?? '')); if ($id === '' || isset($by[$id])) continue;
      $name = (string) ($x['pLabel']['value'] ?? ''); if ($name === '' || preg_match('/^Q\d+$/', $name)) continue;
      $by[$id] = array_filter(['name' => mb_substr($name, 0, 120), 'qid' => $id, 'born' => $yearOf((string) ($x['birth']['value'] ?? '')), 'died' => $yearOf((string) ($x['death']['value'] ?? '')),
        'place' => mb_substr((string) ($x['placeLabel']['value'] ?? ''), 0, 80), 'desc' => mb_substr((string) ($x['pDescription']['value'] ?? ''), 0, 160),
        'wiki' => (string) ($x['article']['value'] ?? '')], fn($v) => $v !== '' && $v !== null);
    }
    $people = array_values($by);
    usort($people, fn($a, $b) => ($a['born'] ?? 9999) <=> ($b['born'] ?? 9999));
    return [json_encode(['people' => $people], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

if ($src === 'he') {
  // Historic England open data (OGL v3). Fixed service, layer and fields per kind; only the bbox passes through.
  $base = 'https://services-eu1.arcgis.com/ZOdPfBS3aqqDYPUQ/arcgis/rest/services/';
  $nhle = 'National_Heritage_List_for_England_NHLE_v02_VIEW';
  $HE = [
    'helb'  => [$nhle, 0, 'ListEntry,Name,Grade,ListDate,hyperlink', false],
    'hesm'  => [$nhle, 6, 'ListEntry,Name,SchedDate,hyperlink', true],
    'hepg'  => [$nhle, 7, 'ListEntry,Name,Grade,RegDate,hyperlink', true],
    'hebf'  => [$nhle, 8, 'ListEntry,Name,RegDate,hyperlink', true],
    'hewh'  => [$nhle, 10, 'ListEntry,Name,InscrDate,hyperlink', true],
    'heca'  => ['Conservation_Areas', 0, 'NAME,DATE_OF_DE,LPA', true],
    'heapa' => ['Greater_London_Archaeological_Priority_Areas__APAs_', 1, 'primary_re,descriptio,designatio,area_type', true],
    'hear'  => ['Historic England Heritage at Risk Register 2026 points', 0, 'List_Entry,HeritageCa,Risk_Metho,EntryName,URL', false],
  ];
  $layer = $_GET['layer'] ?? ''; $bbox = $_GET['bbox'] ?? '';
  if (!isset($HE[$layer])) fail(400, 'Bad layer');
  if (!preg_match('/^-?\d{1,3}\.\d{1,2},-?\d{1,2}\.\d{1,2},-?\d{1,3}\.\d{1,2},-?\d{1,2}\.\d{1,2}$/', $bbox)) fail(400, 'Bad bbox');
  $b = array_map('floatval', explode(',', $bbox));
  if ($b[2] - $b[0] > 0.11 || $b[3] - $b[1] > 0.11) fail(400, 'Area too large');
  if ($b[2] < -6.5 || $b[0] > 2.0 || $b[3] < 49.8 || $b[1] > 55.9) out([json_encode(['type' => 'FeatureCollection', 'features' => []]), 200, 'application/json', 'SKIP'], 86400);
  [$svc, $lid, $fields, $poly] = $HE[$layer];
  $q = ['where' => '1=1', 'geometry' => $bbox, 'geometryType' => 'esriGeometryEnvelope', 'inSR' => 4326, 'spatialRel' => 'esriSpatialRelIntersects',
        'outFields' => $fields, 'outSR' => 4326, 'f' => 'geojson', 'resultRecordCount' => 2000, 'geometryPrecision' => 6];
  if ($poly) $q['maxAllowableOffset'] = 0.00002;
  $url = $base . rawurlencode($svc) . '/FeatureServer/' . $lid . '/query?' . http_build_query($q);
  set_time_limit(60);
  out(cached($CACHE, 'he2:' . $url, 14 * 86400, function () use ($url, $layer) {
    [$body, $code, $type] = fetch_url($url, 40);
    $j = $code === 200 ? json_decode($body, true) : null;
    if (!is_array($j) || !isset($j['features'])) return [$body, $code === 200 ? 502 : $code, $type];  // ArcGIS errors come back as 200
    $out = [];
    foreach ($j['features'] as $f) {
      if (empty($f['geometry'])) continue;
      $p = $f['properties'] ?? [];
      // Archaeological Priority Area descriptions arrive as HTML: keep plain text.
      if (isset($p['descriptio'])) $p['descriptio'] = mb_substr(trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags((string) $p['descriptio']), ENT_QUOTES | ENT_HTML5, 'UTF-8'))), 0, 1200);
      foreach ($p as $k => $v) if ($v === null || $v === '' || $v === ' ') unset($p[$k]);
      $out[] = ['type' => 'Feature', 'id' => $f['id'] ?? null, 'geometry' => $f['geometry'], 'properties' => $p + ['kind' => $layer]];
    }
    return [json_encode(['type' => 'FeatureCollection', 'features' => $out], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

if ($src === 'plaques') {
  // Open Plaques (openplaques.org): plaque inscriptions with positions. Photos there are mostly all-rights-reserved, so none are relayed.
  $bbox = $_GET['bbox'] ?? '';
  if (!preg_match('/^-?\d{1,3}\.\d{1,2},-?\d{1,2}\.\d{1,2},-?\d{1,3}\.\d{1,2},-?\d{1,2}\.\d{1,2}$/', $bbox)) fail(400, 'Bad bbox');
  $b = array_map('floatval', explode(',', $bbox));
  if ($b[2] - $b[0] > 0.11 || $b[3] - $b[1] > 0.11) fail(400, 'Area too large');
  $url = 'https://openplaques.org/plaques.json?box=' . rawurlencode('[' . $b[3] . ',' . $b[0] . '],[' . $b[1] . ',' . $b[2] . ']');
  set_time_limit(60);
  out(cached($CACHE, 'op1:' . $url, 7 * 86400, function () use ($url) {
    [$body, $code, $type] = fetch_url($url, 40);
    $j = $code === 200 ? json_decode($body, true) : null;
    if (!is_array($j)) return [$body, $code === 200 ? 502 : $code, $type];
    $out = [];
    foreach ($j as $r) {
      if (!isset($r['latitude'], $r['longitude'], $r['id'])) continue;
      $ins = trim(preg_replace('/\s+/', ' ', (string) ($r['inscription'] ?? '')));
      // "from": the earliest year the inscription names, so the plaque appears once its subject's time has begun.
      $from = preg_match_all('/\b(1[0-9]{3}|20[0-2][0-9])\b/', $ins, $m) ? min(array_map('intval', $m[1])) : 2100;
      $out[] = ['type' => 'Feature', 'id' => (int) $r['id'], 'geometry' => ['type' => 'Point', 'coordinates' => [round((float) $r['longitude'], 5), round((float) $r['latitude'], 5)]],
        'properties' => ['id' => (int) $r['id'], 'inscription' => mb_substr($ins, 0, 600), 'from' => $from]];
    }
    return [json_encode(['type' => 'FeatureCollection', 'features' => $out], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

if ($src === 'oldmaps') {
  [$lat, $lng] = $point();
  @set_time_limit(60);
  out(cached($CACHE, 'oldmaps:v2:' . $lat . ',' . $lng, 7 * 86400, function () use ($lat, $lng) {
    $maps = []; $ok = 0;
    $km2 = static function (float $w, float $s, float $e, float $n): float {
      $mid = deg2rad(($s + $n) / 2); return abs(($e - $w) * 111.32 * cos($mid) * ($n - $s) * 110.57);
    };
    $yr = static fn(string $t): ?int => preg_match('/\b(1[0-9]\d\d|20[0-2]\d)\b/', $t, $m) ? (int) $m[1] : null;

    // Allmaps: georeferenced IIIF maps from libraries (David Rumsey, Library of Congress, Internet Archive, …)
    [$b, $c] = fetch_url('https://api.allmaps.org/maps?' . http_build_query(['intersects' => $lat . ',' . $lng, 'limit' => 60]), 25);
    $j = $c === 200 ? json_decode($b, true) : null;
    if (is_array($j)) {
      $ok++;
      foreach ($j as $m) {
        $id = preg_match('#/maps/([0-9a-f]{8,32})$#', (string) ($m['id'] ?? ''), $mm) ? $mm[1] : '';
        $geo = array_values(array_filter(array_map(fn($g) => $g['geo'] ?? null, $m['gcps'] ?? [])));
        if ($id === '' || count($geo) < 3) continue;
        $xs = array_column($geo, 0); $ys = array_column($geo, 1);
        $w = min($xs); $e = max($xs); $s0 = min($ys); $n = max($ys);
        if (($e - $w) * ($n - $s0) < 1e-6) continue; // georeferencing collapsed to a dot: useless as an overlay
        $res = (string) ($m['resource']['id'] ?? '');
        $host = strtolower((string) parse_url($res, PHP_URL_HOST));
        $names = ['davidrumsey' => 'David Rumsey Map Collection', 'loc.gov' => 'Library of Congress', 'archive.org' => 'Internet Archive',
          'mapwarper' => 'mapwarper.net', 'bodleian' => 'Bodleian Libraries, Oxford', 'nls.uk' => 'National Library of Scotland',
          'nypl' => 'New York Public Library', 'harvard' => 'Harvard Library', 'yale' => 'Yale University', 'princeton' => 'Princeton University Library',
          'leiden' => 'Leiden University Library', 'e-rara' => 'e-rara (Swiss libraries)', 'tamu' => 'Texas A&M University Libraries',
          'digitalcommonwealth' => 'Digital Commonwealth (Boston Public Library)', 'archief.nl' => 'Nationaal Archief (Netherlands)',
          'bl.uk' => 'British Library', 'gallica' => 'Bibliothèque nationale de France', 'bnf.fr' => 'Bibliothèque nationale de France',
          'stanford' => 'Stanford Libraries', 'umich' => 'University of Michigan', 'contentdm' => 'a university library (CONTENTdm)'];
        $prov = $host !== '' ? $host : 'Allmaps';
        foreach ($names as $needle => $name) { if (str_contains($host, $needle)) { $prov = $name; break; } }
        $maps[] = ['source' => 'allmaps', 'id' => $id, 'title' => $prov . ' map', 'provider' => $prov, 'year' => null,
          'bbox' => [round($w, 4), round($s0, 4), round($e, 4), round($n, 4)], 'km2' => round($km2($w, $s0, $e, $n)),
          'tiles' => 'https://allmaps.xyz/maps/' . $id . '/{z}/{x}/{y}.png', 'link' => 'https://viewer.allmaps.org/?url=' . rawurlencode('https://annotations.allmaps.org/maps/' . $id)];
      }
    }
    // mapwarper.net: maps people have georeferenced, with titles; first those within the area, then the smallest that cover it.
    foreach ([['within', 0.35, 30], ['intersect', 0.0001, 40]] as [$op, $pad, $per]) {
      $bbox = ($lng - $pad) . ',' . ($lat - $pad) . ',' . ($lng + $pad) . ',' . ($lat + $pad);
      [$b, $c] = fetch_url('https://mapwarper.net/api/v1/maps?' . http_build_query(['bbox' => $bbox, 'operation' => $op, 'per_page' => $per]), 20);
      $j = $c === 200 ? json_decode($b, true) : null;
      if (!is_array($j)) continue;
      $ok++;
      foreach (($j['data'] ?? []) as $m) {
        $a = $m['attributes'] ?? []; $id = (string) ($m['id'] ?? '');
        if (($a['status'] ?? '') !== 'warped' || !ctype_digit($id)) continue;
        $bb = array_map('floatval', explode(',', (string) ($a['bbox'] ?? '')));
        if (count($bb) !== 4 || $bb[2] - $bb[0] > 200) continue;
        $title = trim((string) ($a['title'] ?? '')) ?: 'Untitled map';
        $thumb = (string) ($m['links']['thumb'] ?? '');
        $maps['mw' . $id] = ['source' => 'mapwarper', 'id' => $id, 'title' => mb_substr($title, 0, 120), 'provider' => 'mapwarper.net',
          'year' => $yr($title . ' ' . ($a['date_depicted'] ?? '')), 'bbox' => array_map(fn($v) => round($v, 4), $bb), 'km2' => round($km2($bb[0], $bb[1], $bb[2], $bb[3])),
          'tiles' => 'https://mapwarper.net/maps/tile/' . $id . '/{z}/{x}/{y}.png', 'link' => 'https://mapwarper.net/maps/' . $id,
          'thumb' => str_starts_with($thumb, '/uploads/') ? 'https://mapwarper.net' . $thumb : ''];
      }
    }
    if ($ok === 0) return ['', 503, ''];
    $maps = array_values($maps);
    usort($maps, fn($x, $y) => $x['km2'] <=> $y['km2']);   // the most local first
    return [json_encode(['maps' => array_slice($maps, 0, 80)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 200, 'application/json'];
  }), 86400);
}

fail(400, 'Unknown source');
