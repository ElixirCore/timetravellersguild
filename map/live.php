<?php
/*
 * Passport Map live guide — /map/live.php
 *
 * Receives a WebRTC offer SDP from the browser, creates a gpt-live-1 session
 * with OpenAI, and returns the answer SDP + session id.
 * The map tools are defined here so the agent can call them; the browser
 * executes them and sends back results on the oai-events data channel.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

/* same-origin */
$host   = strtolower($_SERVER['HTTP_HOST'] ?? '');
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$ohost  = strtolower((string) parse_url($origin, PHP_URL_HOST));
if ($ohost === '' || ($ohost . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '')) !== $host) {
    fail(403, 'Same-origin only.');
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only.');

require_once __DIR__ . '/../people/inc/db.php';
require_once __DIR__ . '/../inc/env.php';

$user = ttg_current_user();
if (!$user) fail(403, 'Sign in first.');

$raw = (string) file_get_contents('php://input', false, null, 0, 100001);
$in  = json_decode($raw, true);
if (!is_array($in) || empty($in['sdp'])) fail(400, 'Body must be JSON {sdp:"…"}.');

$key = ttg_env('OPENAI_API_KEY');
if (!$key || str_contains($key, 'YOUR_KEY')) fail(500, 'No OpenAI API key configured.');

/* map tool definitions — called by the agent, executed client-side */
$fn = fn(string $n, string $d, array $p, array $r) => [
    'type' => 'function', 'name' => $n, 'description' => $d,
    'parameters' => ['type' => 'object', 'properties' => (object) $p, 'required' => $r, 'additionalProperties' => false],
];
$pt = ['lng' => ['type' => 'number', 'description' => 'Longitude, WGS84'], 'lat' => ['type' => 'number', 'description' => 'Latitude, WGS84']];
$tools = [
    $fn('get_view',      'Current map state: centre, zoom, pitch, bearing, active layers, last tapped point.', [], []),
    $fn('find_place',    'Geocode a place name anywhere in the world. Returns coordinates or not-found.', ['name' => ['type' => 'string']], ['name']),
    $fn('fly_to',        'Fly the map to a point and optionally drop a labelled pin.',
        $pt + ['zoom' => ['type' => 'number', 'description' => '8 (region) to 16 (street)'], 'label' => ['type' => 'string']], ['lng', 'lat']),
    $fn('set_layers',    'Switch map layers on or off. Only provided keys change.',
        ['terrain' => ['type' => 'boolean'], 'hillshade' => ['type' => 'boolean'], 'contours' => ['type' => 'boolean'],
         'geology'  => ['type' => 'string', 'enum' => ['off', 'bedrock', 'age', 'superficial']],
         'monuments' => ['type' => 'boolean'], 'listed_buildings' => ['type' => 'boolean'],
         'coflein' => ['type' => 'boolean'], 'place_names' => ['type' => 'boolean'], 'wikipedia' => ['type' => 'boolean'], 'photos' => ['type' => 'boolean'], 'historic_places' => ['type' => 'boolean'], 'events' => ['type' => 'boolean'],
         'old_map' => ['type' => 'string', 'enum' => ['off', 'match', 'uk-osgb63k1885', 'uk-osgb10k1888', 'uk-osgb1919', 'uk-osgb25k1937', 'uk-osgb63k1955'],
           'description' => 'Historic OS map overlay: match = the era nearest the current year; or a specific series (1885 one-inch, 1888 six-inch, 1919, 1937 1:25k, 1955 one-inch). Needs a MapTiler key on the server.'],
         'routes' => ['type' => 'boolean'], 'timepods' => ['type' => 'boolean']], []),
    $fn('set_camera',    'Adjust pitch (0–75°) and bearing (compass degrees) for dramatic angles.',
        ['pitch' => ['type' => 'number'], 'bearing' => ['type' => 'number']], []),
    $fn('geology_at',    'BGS 1:625k geology at a coordinate. layer: bedrock | age | superficial.',
        $pt + ['layer' => ['type' => 'string', 'enum' => ['bedrock', 'age', 'superficial']]], ['lng', 'lat', 'layer']),
    $fn('elevation_at',  'Ground height in metres from the terrain model.',       $pt, ['lng', 'lat']),
    $fn('terrain_profile','Height profile along a straight line: distance, highest, lowest, total climb.',
        ['from_lng' => ['type' => 'number'], 'from_lat' => ['type' => 'number'],
         'to_lng'   => ['type' => 'number'], 'to_lat'   => ['type' => 'number']], ['from_lng', 'from_lat', 'to_lng', 'to_lat']),
    $fn('heritage_near', 'Cadw scheduled monuments or listed buildings within radius_km (max 5) of a point.',
        $pt + ['kind' => ['type' => 'string', 'enum' => ['monuments', 'listed_buildings']],
                'radius_km' => ['type' => 'number']], ['lng', 'lat', 'kind', 'radius_km']),
    $fn('sites_near', 'Coflein (National Monuments Record of Wales) sites within radius_km (max 5) of a point, nearest first: name, period (Mesolithic to modern), type, evidence, record link.',
    $pt + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
    $fn('names_near', 'Historic place names (RCAHMW List of Historic Place Names of Wales) within radius_km (max 5): the name, what it named (field, farm, settlement), the year it was recorded and the source (tithe maps, early OS maps, charters).',
    $pt + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
    $fn('wiki_near', 'Wikipedia articles near a point (lang en or cy), nearest first, with short descriptions.',
    $pt + ['lang' => ['type' => 'string', 'enum' => ['en', 'cy']]], ['lng', 'lat']),
    $fn('wiki_summary', 'The opening summary of one Wikipedia article.',
    ['title' => ['type' => 'string'], 'lang' => ['type' => 'string', 'enum' => ['en', 'cy']]], ['title']),
    $fn('set_year', 'Travel the map to a year (negative = BC, e.g. -2300). Coflein sites and place names then show only what existed or was named by that year; a matched old map follows. 2100 = now (everything).',
    ['year' => ['type' => 'number']], ['year']),
    $fn('photos_near', 'Geotagged Wikimedia Commons photos within radius_km (max 5) of a point: title, date taken, photographer, licence, link. Mostly recent photos: what the place looks like now.',
    $pt + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
    $fn('old_photos', 'Search old photographs of a named place (town, village, parish or building) in Europeana: National Library of Wales and other archives. Respects the current year on the map (only photos up to it). Shows a gallery to the viewer unless show is false.',
    ['place' => ['type' => 'string'], 'show' => ['type' => 'boolean']], ['place']),
    $fn('historic_near', 'Named historic places from OpenStreetMap within radius_km (max 3) of a point, anywhere in the world: memorials, war graves, battlefields, ruins, mines, mills, wayside shrines, archaeological sites. Name, kind, dates, inscription, links.',
    $pt + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
    $fn('events_near', 'Dated events recorded in Wikidata within radius_km (max 15) of a point, anywhere: strikes, riots, protests, disasters, accidents, battles, fires, floods. What, when, kind, a one-line description, Wikipedia link.',
    $pt + ['radius_km' => ['type' => 'number']], ['lng', 'lat', 'radius_km']),
    $fn('people_from', 'People recorded in Wikidata as born in towns and villages within about 6 km of a point: name, birth and death years, what they did. Uneven (notable people only). Shows a list to the viewer unless show is false.',
    $pt + ['place' => ['type' => 'string'], 'show' => ['type' => 'boolean']], ['lng', 'lat']),
    $fn('my_stamps',     'The viewer\'s passport stamps: places, lines, dates, coordinates.', [], []),
    $fn('start_run',     'Begin recording a named run. All fly_to destinations will be saved under this run until end_run is called. Use when the viewer asks to record, save or name a tour of places.',
        ['name' => ['type' => 'string', 'description' => 'Short name for this run, e.g. "Cities of Wales"']], ['name']),
    $fn('end_run',       'End the current run and save it. Call after the last fly_to in the sequence.', [], []),
    $fn('add_stamp',     'Ink a new place slip on the viewer\'s passport. Use when the viewer asks to record, add or ink a place. Geocodes the name automatically if no coordinates given.',
        ['name'  => ['type' => 'string', 'description' => 'Place name as it should appear on the slip'],
         'line'  => ['type' => 'string', 'description' => 'Line or note for the slip (optional)'],
         'inked' => ['type' => 'string', 'description' => 'Date inked, d.m.Y e.g. 04.11.2026 (defaults to today)'],
         'lng'   => ['type' => 'number', 'description' => 'Longitude WGS84 (optional)'],
         'lat'   => ['type' => 'number', 'description' => 'Latitude WGS84 (optional)']], ['name']),
];

$instructions = <<<'TXT'
You are the Passport Map's voice guide for the Time Travellers Guild — a navigational intelligence that speaks as the living instrument of the map. You steer the view like a spaceship: fluid, cinematic, deliberate. You speak in the guild's voice: precise, atmospheric, grounded in terrain and time.

FLY BEFORE YOU SPEAK. When you name a place, fly there first with fly_to, then describe what you see. Use pitched camera (55–70°) and varied bearing for drama. When describing rock, switch on geology. When describing heritage, switch on monuments. Move like a vessel under way.

SEEK TIME. For every place you visit, search for a fact that roots it in deep time — something the viewer would not know and cannot see from the surface. Geological age. A moment from history. A person who stood there once and left a trace. A measurement that reveals the land's hidden nature. The web_search tool is your instrument for this. Deliver the fact as a single vivid sentence in the guild's voice: atmospheric, precise, never decorative. Then continue. This is what separates a guide from a map.

Examples of the kind of fact to seek:
— "The limestone under Abercrave was laid down in a warm Carboniferous sea, 320 million years ago — coral reef, now upland."
— "Cardigan Castle changed hands five times in the twelfth century. The river it commands still runs the same line."
— "The hill you are looking at is older than the Atlantic Ocean."

THE THEATRE — south Wales uplands:
— Cribarth ridge above Abercrave (-3.6885, 51.7975). Mission active: Valley reading. Film fragment held on third night.
— Abercrave (-3.6952, 51.8028), village at the valley floor.
— Swansea Valley, running south from Abercrave.
— Station XIII, Cardiff (-3.1791, 51.4816). Operational base.
— Tipi Valley, near Llandeilo (-3.9833, 51.8833). Guild founding place, 1951.
— Cathays Park, Cardiff: location of Department of Excess Time.

KNOWN FIELD OBJECTS:
— Quantum Tin Nº 013, sealed, Swansea Valley.
— Chronometer, last seen: Station XIII.
— DET-01: document, published, Cathays Park.
— The Film: forming. Fragment from Cribarth's third night, held.
— A Departmental notice is in the field.

TIME: Local Present 04 November 2026. Network Present 17 April 2033.

TOOLS: use get_view first if the viewer asks about what's visible. Use find_place for any place you don't have coordinates for. Use elevation_at or terrain_profile for height questions. Use geology_at and switch on the bedrock layer for rock questions. Use heritage_near and switch on monuments for heritage questions. Use my_stamps to walk through the viewer's route. Use fly_to for every place you name. Use set_camera to tilt and turn for drama. Use web_search to find the temporal fact that makes this place speak.

SOCIAL HISTORY FIRST. This is a map for time travellers, and what they most want is people: who lived here, how they worked, what they built and lost, the strikes and riots and disasters, the migrations, the chapels and pubs and memorials. Rock and height are the stage, not the play. Anywhere in the world, reach for events_near (dated strikes, riots, disasters, battles), people_from (who was born here), historic_near (memorials, ruins, mines, mills from OpenStreetMap), Wikipedia and the photographs before geology. Name ordinary lives where the records allow, say plainly when the records are thin or only remember the famous, and never invent a person or an event.

TIME TRAVEL TOOLS: sites_near finds Coflein's recorded sites with their periods (back to the Mesolithic); names_near finds the old names of fields, farms and places with the year they were written down; wiki_near and wiki_summary give Wikipedia's account; set_year takes the viewer's map back to a year, so only what existed then is shown, and set_layers old_map:'match' lays the nearest historic Ordnance Survey map over it. When the viewer asks what a place was like at a time, set_year first, then describe what remains, citing the record (Coflein, the place-name list, Wikipedia). photos_near shows what a place looks like now (Wikimedia Commons); old_photos opens the archives for a named place (Europeana: National Library of Wales and others), so the viewer can see it as it was; pair it with set_year.

Speak in short bursts — you are narrating a live flyover. One destination at a time unless touring. Never invent coordinates; use find_place or the known points above. If asked to replay the route, use my_stamps then fly to each place in order.
TXT;

$session = [
    'model'       => 'gpt-live-1',
    'instructions'=> $instructions,
    'audio'       => ['output' => ['voice' => 'gleam']],
    'tools'       => $tools,
    'delegation'  => [
        'type'      => 'responses',
        'responses' => [
            'parallel_tool_calls' => false,
            'model'     => 'gpt-6-luna',
            'reasoning' => ['effort' => 'medium'],
            'tools'     => [['type' => 'web_search']],
        ],
    ],
];

$payload = json_encode(
    ['session' => $session, 'transport' => ['type' => 'webrtc', 'sdp' => $in['sdp']]],
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);

$ch = curl_init('https://api.openai.com/v1/live/sessions');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
    CURLOPT_POSTFIELDS     => $payload,
]);
$res    = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err    = curl_error($ch);

if ($res === false) fail(502, 'cURL error: ' . $err);
$j = json_decode((string) $res, true);
if ($status >= 400 || !is_array($j)) {
    $msg = is_array($j) && isset($j['error']['message']) ? $j['error']['message'] : 'HTTP ' . $status;
    fail(502, 'OpenAI: ' . $msg);
}

echo json_encode([
    'session_id' => $j['id'] ?? ($j['session']['id'] ?? null),
    'sdp'        => $j['transport']['sdp'] ?? null,
], JSON_UNESCAPED_SLASHES);
