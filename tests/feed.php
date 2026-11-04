<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$page = (string) file_get_contents($root . '/feed/index.php');
$ht = (string) file_get_contents($root . '/.htaccess');
$router = (string) file_get_contents($root . '/router.php');
$rooms = (string) file_get_contents($root . '/data/rooms.json');
$watch = (string) file_get_contents($root . '/watch/index.php');

expect(is_file($root . '/feed/index.php'), 'the instrument has a door');
expect(str_contains($page, 'FEED∞') && str_contains($page, 'verifyFaetimePass'), 'FEED∞ keeps the Faetime seam');
expect(str_contains($page, "api=feed") || str_contains($page, "api:'feed'") || str_contains($page, "api:'feed'"), 'the field asks ?api=feed');
expect(str_contains($page, "\$_GET['api']") && str_contains($page, "'feed'"), 'the selector answers api=feed');
expect(str_contains($page, 'WARP THE WEFT') && str_contains($page, 'webgl') && str_contains($page, 'u_scrollLen') && str_contains($page, 'Heat haze'), 'the field shimmers as heat haze from shake and scroll');
expect(str_contains($page, 'ttg_env') && str_contains($page, 'ttg_openai_'), 'machine vision reads the Guild environment');
expect(!str_contains($page, 'name="openai_api_key"') && !str_contains($page, 'name="api_key"'), 'the clerk never prints an API key into HTML');
expect(str_contains($ht, 'RewriteRule ^feed/?$ /feed/index.php') && str_contains($ht, 'RewriteRule ^feed/feed-data/ - [F,L]'), '/feed is routed and feed-data is denied');
expect(str_contains($router, "require \$root . '/feed/index.php'"), 'the local router serves the instrument');
expect(str_contains($rooms, '"slug": "feed"') && str_contains($rooms, '"href": "/feed/"'), 'rooms.json registers feed');
expect(str_contains($rooms, '"slug": "watch"') && preg_match('/"slug": "watch"[\\s\\S]*?"feed"/', $rooms) === 1, 'watch limbs include feed');
expect(str_contains($rooms, '"slug": "archive"') && preg_match('/"slug": "archive"[\\s\\S]*?"feed"/', $rooms) === 1, 'archive limbs include feed');
expect(str_contains($watch, 'href="/feed/"'), 'the Watch colophon opens feed∞');
expect(is_file($root . '/feed/images/.gitkeep'), 'the plate folder is waiting');
expect(str_contains($page, 'INGEST_MAX_EDGE') && str_contains($page, 'ingestToJpeg') && str_contains($page, "api'] === 'ingest'"), 'uploads are milled to contained JPEG');
expect(str_contains($page, 'mill-rail') && str_contains($page, 'CHLOROPHYLL RAIL') && str_contains($page, 'MILL HAS THE PLATE'), 'the clerk mill shows what the server is doing');
expect(str_contains($page, 'feed-slip') && str_contains($page, 'slip-threads') && str_contains($page, 'buildSlip'), 'machine tags are woven through the ribbon');
expect(str_contains($page, 'class="infinity"') && str_contains($page, 'infinity-gyre') && str_contains($page, 'IBM 5081'), 'FEED marks the corner and the slip is punch stock');
expect(!str_contains($page, 'class="tag-field"') && !str_contains($page, 'class="jack-line"'), 'writing stays off the plate');
expect(str_contains($page, 'id="punchDock"') && str_contains($page, 'function openPunch') && str_contains($page, 'translate3d(104%'), 'a tap slides the punchcard in from the right');
expect(str_contains($page, 'scroll-snap-type:y proximity') && str_contains($page, '-webkit-overflow-scrolling:touch'), 'the ribbon scrolls as one joined surface');
expect(str_contains($page, 'function shuffleRows') && str_contains($page, 'cycleSeen') && str_contains($page, 'Bag empty'), 'the field shuffles and only repeats when the bag is empty');
expect(str_contains($page, 'function hrefAllowed') && str_contains($page, 'ffilm.org') && str_contains($page, 'function jackBriefing'), 'Jack is briefed on the ffilm.org house');
expect(str_contains($page, 'private detective') && str_contains($page, 'OPEN TICKETS') && str_contains($page, 'PUNCH CARDS'), 'Jack files punches and provisional tickets');
expect(str_contains($page, "api'] === 'revise'") && str_contains($page, 'id="dossier"') && str_contains($page, 'FILE THE CARD'), 'a guild person can overwrite Jack’s card');
expect(str_contains($page, 'refileAll') && str_contains($page, 'RE-FILE ALL'), 'the clerk can send Jack through the whole hopper again');
expect(str_contains($page, 'directionHTML') && str_contains($page, 'a.direction'), 'house directions print as doors');
expect(str_contains($page, 'analysis_machine_json') && str_contains($page, 'original_name') && str_contains($page, 'CREATE TABLE IF NOT EXISTS revisions'), 'file measure and Jack’s card are databased');
expect(str_contains($page, '"standing"') && str_contains($page, 'RELEVANT — ON THE TREE') && str_contains($page, 'id="lensPort"'), 'Jack can graduate a plate onto the tree lens');
expect(
    str_contains($page, '${visible.length')
    && !preg_match('/\$\{visible\.length\}\s*\n\s*\? `/', $page),
    'the slip template keeps visible text inside the interpolation'
);
expect(str_contains($page, 'function telemetryHouse') && str_contains($page, "api'] === 'telemetry'"), 'the house answers ?api=telemetry');
expect(str_contains($page, 'id="telemBtn"') && str_contains($page, 'id="telemDock"') && str_contains($page, 'function openTelem'), 'a TELEMETRY button opens the live sitting');
expect(str_contains($page, 'THIS SITTING') && str_contains($page, 'paintTelemetry') && str_contains($page, 'MOTION'), 'the dock reads shake, scroll, and dwell live');
expect(!str_contains($page, 'ffilm.org/visitors') && !str_contains($page, 'visit.js'), 'feed telemetry is not the house visitor counter');

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
