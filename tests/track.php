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
require_once $root . '/inc/track.php';

expect(TTG_VISIT_JS === 'https://ffilm.org/visitors/visit.js', 'house tracker URL');
expect(function_exists('ttg_html_visit_tracker') && function_exists('ttg_visit_tracker_attach'), 'tracker helpers exist');

$tag = ttg_html_visit_tracker();
expect(str_contains($tag, TTG_VISIT_JS) && str_contains($tag, 'defer'), 'helper emits visit.js');
expect(ttg_html_visit_tracker() === '', 'helper is idempotent');

$html = ttg_visit_tracker_filter('<html><body>hi</body></html>');
expect(str_contains($html, 'ffilm.org/visitors/visit.js') && str_contains($html, '</body>'), 'filter injects before </body>');
expect(ttg_visit_tracker_filter('{"ok":true}') === '{"ok":true}', 'JSON object is not wrapped');
expect(ttg_visit_tracker_filter('[1,2]') === '[1,2]', 'JSON array is not wrapped');
$already = '<body><script src="https://ffilm.org/visitors/visit.js" defer></script></body>';
expect(ttg_visit_tracker_filter($already) === $already, 'filter is idempotent');
expect(ttg_visit_tracker_filter('plain text') === 'plain text', 'non-HTML is left alone');

$graph = (string) file_get_contents($root . '/inc/graph.php');
$network = (string) file_get_contents($root . '/inc/network.php');
$boot = (string) file_get_contents($root . '/department/inc/boot.php');
$hub = (string) file_get_contents($root . '/hub/inc/header.php');
$puzzle = (string) file_get_contents($root . '/jack/puzzle/index.php');
expect(str_contains($graph, "require_once __DIR__ . '/track.php'"), 'graph attaches the tracker');
expect(str_contains($network, "require_once __DIR__ . '/track.php'"), 'network attaches the tracker');
expect(str_contains($boot, '/inc/track.php'), 'department attaches the tracker');
expect(str_contains($hub, '/inc/track.php'), 'hub attaches the tracker before HTML');
expect(str_contains($puzzle, '/inc/track.php'), 'puzzle attaches the tracker');

$door = (string) file_get_contents($root . '/door.html');
expect(str_contains($door, 'ffilm.org/visitors/visit.js'), 'static door carries the tracker');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
