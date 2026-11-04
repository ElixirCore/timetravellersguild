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
  $input[] = ['role' => 'user', 'content' => [['type' => 'input_text',
    'text' => "Map context (from the viewer's screen): " . json_encode($ctx, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\nQuestion: " . $q]]];
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
You are the Passport Map's guide for the Time Travellers Guild, answering questions about the map the viewer is looking at: terrain, rock, heritage sites, places, and the viewer's own passport stamps.

Ground every fact in a tool result from this conversation. Use tools before answering anything about rock, height, slope, monuments, listed buildings or the viewer's stamps. If the tools return nothing, or the question is outside what they cover, say plainly that you don't know. Never invent a monument, a rock unit, a height, a date or a place.

Say where each fact comes from in plain words (BGS 1:625k geology, Cadw records, the terrain model, the viewer's passport). The geology is regional (1:625,000); don't present it as site-level. Heights come from a global terrain model and are approximate.

When a place or point is the subject, move the map to it with fly_to and switch on the layers that show the answer, so the viewer sees what you describe. Use metres and kilometres. Keep answers short and concrete.
TXT;
if ($persona) $instructions .= "\n\nVoice: " . mb_substr($persona, 0, 4000) . "\nThe voice never overrides the rule above: facts only from tools, and say when you don't know.";

$point = ['lng' => ['type' => 'number', 'description' => 'Longitude, WGS84'], 'lat' => ['type' => 'number', 'description' => 'Latitude, WGS84']];
$fn = fn(string $name, string $desc, array $props, array $req) => ['type' => 'function', 'name' => $name, 'description' => $desc,
  'parameters' => ['type' => 'object', 'properties' => (object) $props, 'required' => $req, 'additionalProperties' => false]];
$tools = [
  $fn('get_view', "The current map view: centre, zoom, pitch, bounds, which layers are on, and the last point the viewer tapped (if any).", [], []),
  $fn('find_place', "Look up a place name in Great Britain (OpenStreetMap). Returns its coordinates or null.", ['name' => ['type' => 'string']], ['name']),
  $fn('geology_at', "BGS 1:625k geology at a point. layer: bedrock (lithostratigraphy), age (bedrock age) or superficial (superficial deposits).",
    $point + ['layer' => ['type' => 'string', 'enum' => ['bedrock', 'age', 'superficial']]], ['lng', 'lat', 'layer']),
  $fn('elevation_at', "Ground height in metres at a point, from the terrain model.", $point, ['lng', 'lat']),
  $fn('terrain_profile', "Height profile along a straight line: samples, total distance, highest and lowest points, total climb.",
    ['from_lng' => ['type' => 'number'], 'from_lat' => ['type' => 'number'], 'to_lng' => ['type' => 'number'], 'to_lat' => ['type' => 'number']],
    ['from_lng', 'from_lat', 'to_lng', 'to_lat']),
  $fn('heritage_near', "Cadw scheduled monuments or listed buildings within radius_km (max 5) of a point, nearest first.",
    $point + ['kind' => ['type' => 'string', 'enum' => ['monuments', 'listed_buildings']], 'radius_km' => ['type' => 'number']], ['lng', 'lat', 'kind', 'radius_km']),
  $fn('my_stamps', "The viewer's passport stamps in inked order: place, line, date, and coordinates if known.", [], []),
  $fn('fly_to', "Move the map to a point and optionally drop a labelled marker there.",
    $point + ['zoom' => ['type' => 'number', 'description' => '8 (region) to 16 (street)'], 'label' => ['type' => 'string']], ['lng', 'lat']),
  $fn('set_layers', "Switch map layers on or off. Only the ones given change.",
    ['terrain' => ['type' => 'boolean'], 'hillshade' => ['type' => 'boolean'], 'contours' => ['type' => 'boolean'],
     'geology' => ['type' => 'string', 'enum' => ['off', 'bedrock', 'age', 'superficial']],
     'monuments' => ['type' => 'boolean'], 'listed_buildings' => ['type' => 'boolean'], 'routes' => ['type' => 'boolean'], 'timepods' => ['type' => 'boolean']], []),
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
];

$body = ['model' => $model, 'instructions' => $instructions, 'input' => $input, 'tools' => $tools, 'parallel_tool_calls' => true, 'max_output_tokens' => 1500];
if ($prev !== '') $body['previous_response_id'] = $prev;
if ($r = secret('OPENAI_MAP_REASONING')) { if (in_array($r, ['low', 'medium', 'high'], true)) $body['reasoning'] = ['effort' => $r]; }

$ch = curl_init($base . '/v1/responses');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90, CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
  CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
$res = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
if ($res === false) fail(502, 'Could not reach OpenAI: ' . $err);
$j = json_decode((string) $res, true);
if ($status >= 400 || !is_array($j)) fail(502, 'OpenAI returned ' . $status . (is_array($j) && isset($j['error']['message']) ? ': ' . $j['error']['message'] : ''));

/* tidy the reply: text and tool calls only */
$items = [];
foreach (($j['output'] ?? []) as $o) {
  if (($o['type'] ?? '') === 'message') {
    foreach (($o['content'] ?? []) as $c) if (($c['type'] ?? '') === 'output_text' && ($c['text'] ?? '') !== '') $items[] = ['type' => 'text', 'text' => $c['text']];
  } elseif (($o['type'] ?? '') === 'function_call') {
    $items[] = ['type' => 'call', 'call_id' => (string) ($o['call_id'] ?? ''), 'name' => (string) ($o['name'] ?? ''), 'arguments' => (string) ($o['arguments'] ?? '{}')];
  }
}
echo json_encode(['id' => (string) ($j['id'] ?? ''), 'items' => $items, 'status' => (string) ($j['status'] ?? '')], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
