<?php
/*
 * Passport map agent — /map/agent.php
 *
 * The browser sends a question (or tool results); this forwards it to the OpenAI Responses API with the map's fixed
 * instructions and tool list, and returns a tidied reply. The API key never reaches the browser.
 * The browser cannot change the instructions, the model or the tools — only send text and tool outputs.
 *
 * Settings, read in this order: secret_agent.php, then secrets.php (each looked for beside this file, one and two
 * folders up, and in /workbench under the web root), then the server environment. Either a returned array or
 * define()d constants work.
 *   OPENAI_API_KEY        required
 *   OPENAI_MODEL          required — the model id; nothing is assumed here
 *   OPENAI_BASE_URL       optional, default https://api.openai.com
 *   OPENAI_MAP_PERSONA    optional — a voice for the agent (e.g. your OMNI lines). Facts still come from tools.
 *   OPENAI_MAP_REASONING  optional — low | medium | high, only for models that accept a reasoning setting
 *
 * Access: closed by default. Put an agent_auth.php beside this file that returns true for a signed-in citizen
 * (the same check your passport pages use). For testing only, AGENT_ALLOW_ANON=1 in the environment opens it.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['error' => $msg]); exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'POST only.');

/* same origin */
$host = strtolower($_SERVER['HTTP_HOST'] ?? '');
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($origin === '' || strtolower((string) parse_url($origin, PHP_URL_HOST)) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '') !== $host) {
  fail(403, 'Requests must come from this site.');
}

/* login hook */
$authFile = __DIR__ . '/agent_auth.php';
if (is_file($authFile)) { if ((require $authFile) !== true) fail(403, 'Sign in to ask the map.'); }
elseif (getenv('AGENT_ALLOW_ANON') !== '1') fail(403, 'The map agent is not switched on yet (no agent_auth.php).');

/* secrets */
function secret(string $name): ?string {
  static $sets = null;
  if ($sets === null) {
    $sets = [];
    $dirs = [__DIR__, dirname(__DIR__), dirname(__DIR__, 2)];
    if (!empty($_SERVER['DOCUMENT_ROOT'])) $dirs[] = rtrim($_SERVER['DOCUMENT_ROOT'], '/') . '/workbench';
    foreach (['secret_agent.php', 'secrets.php'] as $file) {
      foreach ($dirs as $d) {
        $f = $d . '/' . $file;
        if (is_file($f)) { $r = (static fn($p) => require $p)($f); if (is_array($r)) $sets[] = $r; break; }
      }
    }
  }
  foreach ($sets as $s) if (isset($s[$name]) && is_string($s[$name]) && $s[$name] !== '') return $s[$name];
  if (defined($name) && is_string(constant($name)) && constant($name) !== '') return constant($name);
  $e = getenv($name); return ($e !== false && $e !== '') ? $e : null;
}
$key = secret('OPENAI_API_KEY'); $model = secret('OPENAI_MODEL');
if (!$key || !$model) fail(500, 'No OPENAI_API_KEY or OPENAI_MODEL found in secret_agent.php, secrets.php or the environment.');
$base = rtrim(secret('OPENAI_BASE_URL') ?: 'https://api.openai.com', '/');

/* rate limit: 240 calls an hour per address (one question can take several round-trips) */
$rl = __DIR__ . '/cache'; if (!is_dir($rl)) @mkdir($rl, 0755, true);
if (!is_file($rl . '/.htaccess')) @file_put_contents($rl . '/.htaccess', "Require all denied\n");
$rf = $rl . '/rate-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
$now = time(); $hits = array_filter(array_map('intval', is_file($rf) ? explode(',', (string) file_get_contents($rf)) : []), fn($t) => $t > $now - 3600);
if (count($hits) >= 240) fail(429, 'The map has answered a lot this hour. Try again shortly.');
$hits[] = $now; @file_put_contents($rf, implode(',', $hits), LOCK_EX);

/* request */
$raw = file_get_contents('php://input', false, null, 0, 200001);
if ($raw === false || strlen($raw) > 200000) fail(413, 'Request too large.');
$in = json_decode($raw, true);
if (!is_array($in)) fail(400, 'Body must be JSON.');

$input = [];
if (isset($in['question'])) {
  $q = trim((string) $in['question']);
  if ($q === '' || mb_strlen($q) > 2000) fail(400, 'Ask a question (up to 2000 characters).');
  $ctx = isset($in['context']) && is_array($in['context']) ? $in['context'] : [];
  $content = [['type' => 'input_text',
    'text' => "Map context (from the viewer's screen): " . json_encode($ctx, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\nQuestion: " . $q]];
  // The viewer may let the guide see the photo they selected (a switch in the Ask panel, off by default).
  // Only photos the map itself shows are accepted: Wikimedia Commons thumbnails and Europeana previews.
  if (isset($in['image']) && is_array($in['image'])) {
    $img = (string) ($in['image']['url'] ?? '');
    $host = strtolower((string) parse_url($img, PHP_URL_HOST));
    if (strlen($img) > 1000 || !str_starts_with($img, 'https://') || !in_array($host, ['thumb.wikimedia.org', 'upload.wikimedia.org', 'api.europeana.eu'], true)) {
      fail(400, 'That photo cannot be shown to the guide.');
    }
    $about = mb_substr(trim((string) ($in['image']['about'] ?? '')), 0, 400);
    $content[] = ['type' => 'input_text', 'text' => 'The viewer has selected this photo and is letting you see it' . ($about !== '' ? ': ' . $about : '') . '.'];
    $content[] = ['type' => 'input_image', 'image_url' => $img, 'detail' => 'auto'];
  }
  $input[] = ['role' => 'user', 'content' => $content];
} elseif (isset($in['outputs']) && is_array($in['outputs'])) {
  if (count($in['outputs']) > 12) fail(400, 'Too many tool results.');
  foreach ($in['outputs'] as $o) {
    if (!is_array($o) || !isset($o['call_id'], $o['output']) || !preg_match('/^[A-Za-z0-9_\-]{1,128}$/', (string) $o['call_id'])) fail(400, 'Bad tool result.');
    $out = is_string($o['output']) ? $o['output'] : json_encode($o['output'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $input[] = ['type' => 'function_call_output', 'call_id' => (string) $o['call_id'], 'output' => mb_substr((string) $out, 0, 20000)];
  }
} else fail(400, 'Send "question" or "outputs".');

$prev = isset($in['previous_response_id']) ? (string) $in['previous_response_id'] : '';
if ($prev !== '' && !preg_match('/^[A-Za-z0-9_\-]{1,128}$/', $prev)) fail(400, 'Bad conversation id.');

/* fixed instructions and tools */
$persona = secret('OPENAI_MAP_PERSONA');
$instructions = <<<TXT
You are the Passport Map's guide for the Time Travellers Guild, answering questions about the map the viewer is looking at, anywhere in the world: the people and events of a place, its heritage, its photographs, its terrain and rock, and the viewer's own passport stamps.

Ground every fact in a tool result from this conversation. Use the map tools before answering anything about rock, height, slope, monuments, listed buildings or the viewer's stamps. Never invent a monument, a rock unit, a height, a date or a place.

SEEK TIME. You also have web_search. Use it for what the map tools can't hold: the history of a place, building or monument, the people and events tied to it, how old something is, what stood there before — the facts that make a place a site of time travel. When you name a Cadw listed building or monument, a short search for its story is welcome. BE QUICK AND ECONOMICAL. Use the map's own tools before the web: get_view for where the viewer is, find_place for coordinates, distance for distances and bearings, the layer tools for what is here. Never use web_search for arithmetic, coordinates, distances, or anything a map tool already answers. Use at most three web searches in one answer, and stop searching as soon as you have one solid source; say what is uncertain rather than searching on.

SOCIAL HISTORY FIRST. This is a map for time travellers, and what they most want is people: who lived here, how they worked, what they built and lost, the strikes and riots and disasters, the migrations, the chapels and pubs and memorials. Rock and height are the stage, not the play. Anywhere in the world, reach for events_near (dated strikes, riots, disasters, battles), people_from (who was born here), historic_near (memorials, ruins, mines, mills from OpenStreetMap), Wikipedia and the photographs before geology. Name ordinary lives where the records allow, say plainly when the records are thin or only remember the famous, and never invent a person or an event.

TIME TRAVEL TOOLS: sites_near finds Coflein's recorded sites with their periods (back to the Mesolithic); names_near finds the old names of fields, farms and places with the year they were written down; wiki_near and wiki_summary give Wikipedia's account; set_year takes the viewer's map back to a year, so only what existed then is shown, and set_layers old_map:'match' lays the nearest historic Ordnance Survey map over it. When the viewer asks what a place was like at a time, set_year first, then describe what remains, citing the record (Coflein, the place-name list, Wikipedia). photos_near shows what a place looks like now (Wikimedia Commons); old_photos opens the archives for a named place (Europeana: National Library of Wales and others), so the viewer can see it as it was; pair it with set_year.

Prefer authoritative sources (Cadw, Coflein / RCAHMW, the BGS, the National Library of Wales, museums, local history societies, Wikipedia). Name the source in a few words and keep the fact to a sentence or two. If the search finds nothing solid, say so; don't fill the gap.

Say where each fact comes from in plain words (BGS 1:625k geology, Cadw records, the terrain model, the viewer's passport, or the website you found). The geology is regional (1:625,000); don't present it as site-level. Heights come from a global terrain model and are approximate.

When a place or point is the subject, move the map to it with fly_to and switch on the layers that show the answer, so the viewer sees what you describe. Use metres and kilometres. Keep answers short and concrete. When a photo is attached, it is the one the viewer selected: say what you can actually see in it (buildings, signs, dates, clothing, transport, the lie of the land), compare it with the records and the map, and say plainly what the photo cannot tell you. Never guess who a person in a photo is. Write plain text: no markdown, asterisks, headings or link syntax — the web sources you used are listed under your answer automatically.
TXT;
if ($persona) $instructions .= "\n\nVoice: " . mb_substr($persona, 0, 4000) . "\nThe voice never overrides the rule above: facts only from tools, and say when you don't know.";

$point = ['lng' => ['type' => 'number', 'description' => 'Longitude, WGS84'], 'lat' => ['type' => 'number', 'description' => 'Latitude, WGS84']];
$fn = fn(string $name, string $desc, array $props, array $req) => ['type' => 'function', 'name' => $name, 'description' => $desc,
  'parameters' => ['type' => 'object', 'properties' => (object) $props, 'required' => $req, 'additionalProperties' => false]];
$tools = [
  $fn('get_view', "The current map view: centre, zoom, pitch, bounds, which layers are on, and the last point the viewer tapped (if any).", [], []),
  $fn('find_place', "Look up a place name anywhere in the world (OpenStreetMap). Returns its coordinates or null.", ['name' => ['type' => 'string']], ['name']),
  $fn('geology_at', "BGS 1:625k geology at a point. layer: bedrock (lithostratigraphy), age (bedrock age) or superficial (superficial deposits).",
    $point + ['layer' => ['type' => 'string', 'enum' => ['bedrock', 'age', 'superficial']]], ['lng', 'lat', 'layer']),
  $fn('elevation_at', "Ground height in metres at a point, from the terrain model.", $point, ['lng', 'lat']),
  $fn('terrain_profile', "Height profile along a straight line: samples, total distance, highest and lowest points, total climb.",
    ['from_lng' => ['type' => 'number'], 'from_lat' => ['type' => 'number'], 'to_lng' => ['type' => 'number'], 'to_lat' => ['type' => 'number']],
    ['from_lng', 'from_lat', 'to_lng', 'to_lat']),
  $fn('heritage_near', "Cadw scheduled monuments or listed buildings within radius_km (max 5) of a point, nearest first.",
    $point + ['kind' => ['type' => 'string', 'enum' => ['monuments', 'listed_buildings']], 'radius_km' => ['type' => 'number']], ['lng', 'lat', 'kind', 'radius_km']),
  $fn('sites_near', 'Coflein (National Monuments Record of Wales) sites within radius_km (max 5) of a point, nearest first: name, period (Mesolithic to modern), type, evidence, record link.',
    $point + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
  $fn('names_near', 'Historic place names (RCAHMW List of Historic Place Names of Wales) within radius_km (max 5): the name, what it named (field, farm, settlement), the year it was recorded and the source (tithe maps, early OS maps, charters).',
    $point + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
  $fn('wiki_near', 'Wikipedia articles near a point (lang en or cy), nearest first, with short descriptions.',
    $point + ['lang' => ['type' => 'string', 'enum' => ['en', 'cy']]], ['lng', 'lat']),
  $fn('wiki_summary', 'The opening summary of one Wikipedia article.',
    ['title' => ['type' => 'string'], 'lang' => ['type' => 'string', 'enum' => ['en', 'cy']]], ['title']),
  $fn('set_year', 'Travel the map to a year (negative = BC, e.g. -2300). Coflein sites and place names then show only what existed or was named by that year; a matched old map follows. 2100 = now (everything).',
    ['year' => ['type' => 'number']], ['year']),
  $fn('photos_near', 'Geotagged Wikimedia Commons photos within radius_km (max 5) of a point: title, date taken, photographer, licence, link. Mostly recent photos: what the place looks like now.',
    $point + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
  $fn('old_photos', 'Search old photographs of a named place (town, village, parish or building) in Europeana: National Library of Wales and other archives. Respects the current year on the map (only photos up to it). Shows a gallery to the viewer unless show is false.',
    ['place' => ['type' => 'string'], 'show' => ['type' => 'boolean']], ['place']),
  $fn('historic_near', 'Named historic places from OpenStreetMap within radius_km (max 3) of a point, anywhere in the world: memorials, war graves, battlefields, ruins, mines, mills, wayside shrines, archaeological sites. Name, kind, dates, inscription, links.',
    $point + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
  $fn('events_near', 'Dated events recorded in Wikidata within radius_km (max 15) of a point, anywhere: strikes, riots, protests, disasters, accidents, battles, fires, floods. What, when, kind, a one-line description, Wikipedia link.',
    $point + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
  $fn('people_from', 'People recorded in Wikidata as born in towns and villages within about 6 km of a point: name, birth and death years, what they did. Uneven (notable people only). Shows a list to the viewer unless show is false.',
    $point + ['place' => ['type' => 'string'], 'show' => ['type' => 'boolean']], ['lng', 'lat']),
  $fn('distance', 'Straight-line distance in kilometres and compass bearing from one point to another. Use this instead of calculating or searching.',
    ['from_lng' => ['type' => 'number'], 'from_lat' => ['type' => 'number'], 'to_lng' => ['type' => 'number'], 'to_lat' => ['type' => 'number']],
    ['from_lng', 'from_lat', 'to_lng', 'to_lat']),
  $fn('my_stamps', "The viewer's passport stamps in inked order: place, line, date, and coordinates if known.", [], []),
  $fn('fly_to', "Move the map to a point and optionally drop a labelled marker there.",
    $point + ['zoom' => ['type' => 'number', 'description' => '8 (region) to 16 (street)'], 'label' => ['type' => 'string']], ['lng', 'lat']),
  $fn('set_layers', "Switch map layers on or off. Only the ones given change.",
    ['terrain' => ['type' => 'boolean'], 'hillshade' => ['type' => 'boolean'], 'contours' => ['type' => 'boolean'],
     'geology' => ['type' => 'string', 'enum' => ['off', 'bedrock', 'age', 'superficial']],
     'monuments' => ['type' => 'boolean'], 'listed_buildings' => ['type' => 'boolean'],
     'coflein' => ['type' => 'boolean'], 'place_names' => ['type' => 'boolean'], 'wikipedia' => ['type' => 'boolean'], 'photos' => ['type' => 'boolean'], 'historic_places' => ['type' => 'boolean'], 'events' => ['type' => 'boolean'],
     'old_map' => ['type' => 'string', 'enum' => ['off', 'match', 'uk-osgb63k1885', 'uk-osgb10k1888', 'uk-osgb1919', 'uk-osgb25k1937', 'uk-osgb63k1955'],
       'description' => 'Historic OS map overlay: match = the era nearest the current year; or a specific series (1885 one-inch, 1888 six-inch, 1919, 1937 1:25k, 1955 one-inch). Needs a MapTiler key on the server.'],
     'routes' => ['type' => 'boolean'], 'timepods' => ['type' => 'boolean']], []),
  $fn('set_camera', "Tilt and turn the view. pitch 0 (flat) to 75; bearing in degrees from north.",
    ['pitch' => ['type' => 'number'], 'bearing' => ['type' => 'number']], []),
  $fn('start_run', "Begin recording a named run. All places flown to will be grouped under this run until end_run is called. Use when the viewer asks to record, save or name a tour of places.",
    ['name' => ['type' => 'string', 'description' => 'Short name for this run, e.g. "Cities of Wales" or "Swansea Valley circuit"']], ['name']),
  $fn('end_run', "End the current run and save it. Call after the last fly_to in the sequence.", [], []),
  $fn('add_stamp', "Ink a new place slip on the viewer's passport. Use this when the viewer asks to record, add or ink a place. Geocodes the name automatically if no coordinates are given.",
    ['name'  => ['type' => 'string', 'description' => 'Place name, as it should appear on the slip'],
     'line'  => ['type' => 'string', 'description' => 'The line or note for the slip (optional)'],
     'inked' => ['type' => 'string', 'description' => 'Date inked, in d.m.Y format e.g. 04.11.2026 (defaults to today)'],
     'lng'   => ['type' => 'number', 'description' => 'Longitude WGS84 (optional — will be looked up from name)'],
     'lat'   => ['type' => 'number', 'description' => 'Latitude WGS84 (optional)']], ['name']),
  // Hosted by OpenAI: searches run on their side and come back cited. The map is worldwide, so no country bias.
  ['type' => 'web_search'],
];

$body = ['model' => $model, 'instructions' => $instructions, 'input' => $input, 'tools' => $tools, 'parallel_tool_calls' => true, 'max_output_tokens' => 1500];
if ($prev !== '') $body['previous_response_id'] = $prev;
if ($r = secret('OPENAI_MAP_REASONING')) { if (in_array($r, ['low', 'medium', 'high'], true)) $body['reasoning'] = ['effort' => $r]; }

$ch = curl_init($base . '/v1/responses');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90, CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
  CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
$res = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch);
if ($res === false) fail(502, 'Could not reach OpenAI: ' . $err);
$j = json_decode((string) $res, true);
if ($status >= 400 || !is_array($j)) fail(502, 'OpenAI returned ' . $status . (is_array($j) && isset($j['error']['message']) ? ': ' . $j['error']['message'] : ''));

/* tidy the reply: text (with web sources), web searches made, and tool calls */
$items = [];
foreach (($j['output'] ?? []) as $o) {
  if (($o['type'] ?? '') === 'message') {
    foreach (($o['content'] ?? []) as $c) {
      if (($c['type'] ?? '') !== 'output_text' || ($c['text'] ?? '') === '') continue;
      $sources = [];
      foreach (($c['annotations'] ?? []) as $a) {
        $url = (string) ($a['url'] ?? '');
        if (($a['type'] ?? '') !== 'url_citation' || !preg_match('#^https://#', $url) || isset($sources[$url])) continue;
        $sources[$url] = ['url' => mb_substr($url, 0, 500), 'title' => mb_substr((string) ($a['title'] ?? ''), 0, 120)];
      }
      // Inline "([site](url))" citations are dropped: the same links are listed under the answer.
      $text = trim((string) preg_replace('/\s*\(\[[^\]]{1,200}\]\(https?:\/\/[^)\s]{1,600}\)\)/', '', (string) $c['text']));
      $items[] = ['type' => 'text', 'text' => $text, 'sources' => array_values($sources)];
    }
  } elseif (($o['type'] ?? '') === 'web_search_call') {
    $items[] = ['type' => 'search', 'query' => mb_substr((string) ($o['action']['query'] ?? ''), 0, 120)];
  } elseif (($o['type'] ?? '') === 'function_call') {
    $items[] = ['type' => 'call', 'call_id' => (string) ($o['call_id'] ?? ''), 'name' => (string) ($o['name'] ?? ''), 'arguments' => (string) ($o['arguments'] ?? '{}')];
  }
}
echo json_encode(['id' => (string) ($j['id'] ?? ''), 'items' => $items, 'status' => (string) ($j['status'] ?? '')], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
