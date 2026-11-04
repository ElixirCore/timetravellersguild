<?php
declare(strict_types=1);

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$root = dirname(__DIR__);
require_once $root . '/inc/og.php';

expect(function_exists('ttg_og_head') && function_exists('ttg_og_filter'), 'OG helpers exist');
expect(defined('TTG_OG_ORIGIN') && TTG_OG_ORIGIN === 'https://timetravellersguild.com', 'canonical origin');

$doors = [
    '/' => 'intro',
    '/now' => 'now',
    '/now/tree' => 'now',
    '/jack' => 'jack',
    '/jack/tarot/' => 'tarot',
    '/deck/' => 'tarot',
    '/feed/' => 'feed',
    '/department/' => 'department',
    '/department/about/history' => 'department',
    '/join/' => 'join',
    '/signals/' => 'signals',
    '/watch/' => 'watch',
    '/hub/' => 'hub',
    '/station13/' => 'station13',
    '/square/' => 'square',
    '/triangla/' => 'triangla',
    '/cardiff/' => 'cardiff',
    '/cube/' => 'cube',
    '/machine/' => 'machine',
    '/people/' => 'people',
    '/field/' => 'field',
    '/navigator/' => 'navigator',
    '/arianrhod/' => 'arianrhod',
    '/archive/' => 'archive',
    '/door.html' => 'door',
    '/jack/puzzle/' => 'puzzle',
    '/jack/map/' => 'map',
    '/n/' => 'now',
];

foreach ($doors as $path => $key) {
    $og = ttg_og_for_path($path);
    expect(($og['key'] ?? '') === $key, "path $path → $key");
    expect(($og['title'] ?? '') !== '', "path $path has og:title");
    expect(str_contains((string) ($og['image'] ?? ''), '/assets/og/') && str_ends_with((string) $og['image'], '.png'), "path $path has og:image");
    $file = $root . parse_url((string) $og['image'], PHP_URL_PATH);
    expect(is_file((string) $file) && filesize((string) $file) > 1000, "card file exists for $key");
}

$html = ttg_og_filter('<html><head><title>NOW — test</title></head><body>hi</body></html>');
expect(str_contains($html, 'rel="icon"') && str_contains($html, '/assets/favicon.svg'), 'filter injects punch-card favicon');
expect(str_contains($html, 'property="og:image"') && str_contains($html, 'property="og:title"'), 'filter injects og:image and og:title');
expect(str_contains($html, 'name="twitter:card"') && str_contains($html, 'summary_large_image'), 'filter injects twitter:card');
expect(str_contains($html, 'rel="canonical"'), 'filter adds canonical when missing');
expect(str_contains($html, 'NOW — test'), 'filter keeps the page title');

$already = ttg_og_filter('<html><head><link rel="icon" href="/assets/favicon.svg"><meta property="og:image" content="x"><link rel="canonical" href="https://timetravellersguild.com/now"></head></html>');
expect(!str_contains(substr($already, 60), 'og:image" content="https://timetravellersguild.com/assets/og'), 'filter is idempotent when og:image exists');

expect(ttg_og_filter('{"ok":true}') === '{"ok":true}', 'JSON object is not wrapped');
expect(ttg_og_filter('[1,2]') === '[1,2]', 'JSON array is not wrapped');

$icons = [
    $root . '/assets/favicon.svg',
    $root . '/assets/favicon.ico',
    $root . '/assets/favicon-32.png',
    $root . '/assets/apple-touch-icon.png',
];
foreach ($icons as $icon) {
    expect(is_file($icon) && filesize($icon) > 80, basename($icon) . ' exists');
}
$svg = (string) file_get_contents($root . '/assets/favicon.svg');
expect(str_contains($svg, '5081') && str_contains($svg, '#f1e4c4') && str_contains($svg, '#c41e3a'), 'favicon is hopper stock, not a globe');

$statics = [
    'index.html' => ['/assets/favicon', 'og:image', 'og:title', 'now.png'],
    'station13/index.html' => ['favicon', 'og:image', 'og:title'],
    'cardiff/index.html' => ['favicon', 'og:image', 'og:title'],
    'triangla/index.html' => ['favicon', 'og:image', 'og:title'],
    'door.html' => ['favicon', 'og:image', 'og:title'],
    'jack/body/index.html' => ['favicon', 'og:image', 'og:title'],
    'jack/map/index.html' => ['favicon', 'og:image', 'og:title'],
    'join/index.html' => ['favicon', 'og:image', 'og:title'],
];
foreach ($statics as $rel => $needles) {
    $txt = (string) file_get_contents($root . '/' . $rel);
    $ok = true;
    foreach ($needles as $n) {
        if (!str_contains($txt, $n)) $ok = false;
    }
    expect($ok, "$rel carries favicon + og:image + og:title");
}

$track = (string) file_get_contents($root . '/inc/track.php');
expect(str_contains($track, "require_once __DIR__ . '/og.php'"), 'track attaches OG like visit.js');
$feed = (string) file_get_contents($root . '/feed/index.php');
expect(str_contains($feed, '/inc/track.php'), 'feed attaches the tracker (and therefore OG)');
$dept = (string) file_get_contents($root . '/department/inc/header.php');
$hub = (string) file_get_contents($root . '/hub/inc/header.php');
$people = (string) file_get_contents($root . '/people/inc/header.php');
$room = (string) file_get_contents($root . '/inc/room.php');
expect(str_contains($dept, 'ttg_og_head'), 'department header emits OG');
expect(str_contains($hub, 'ttg_og_head'), 'hub header emits OG');
expect(str_contains($people, 'ttg_og_head'), 'people header emits OG');
expect(str_contains($room, 'ttg_og_head'), 'room stub emits OG');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
