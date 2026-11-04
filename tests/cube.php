<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/AI/JackAgent.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';
require_once dirname(__DIR__) . '/app/AI/JackDisturbance.php';
require_once dirname(__DIR__) . '/app/AI/JackRuntime.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$root = dirname(__DIR__);
$page = (string) file_get_contents($root . '/cube/index.php');
$js = (string) file_get_contents($root . '/cube/js/cube.js');
$css = (string) file_get_contents($root . '/cube/css/cube.css');
$ht = (string) file_get_contents($root . '/.htaccess');
$router = (string) file_get_contents($root . '/router.php');

expect(str_contains($page, 'JACK / CUBE') && str_contains($page, '/cube/js/cube.js'), 'the cube lesson has a door');
expect(str_contains($page, 'TTG_CUBE') && str_contains($page, '/now/jack'), 'the cube talks to the clerk');
expect(!str_contains($page, 'Location: /jack'), 'the cube is not a redirect to Jack’s room');
expect(str_contains($ht, 'RewriteRule ^cube/?$ /cube/index.php') && !str_contains($ht, 'RewriteRule ^cube/?$ /jack'), '/cube stays at the lesson');
expect(str_contains($router, "require \$root . '/cube/index.php'"), 'the local router serves the lesson');
expect(str_contains($js, 'startLesson') && str_contains($js, 'OUTER_ONLY') && str_contains($js, 'rotateSlice'), 'the cube turns outer slices');
expect(str_contains($js, '"site","cube"') && str_contains($js, 'localJack') && str_contains($js, 'unavailable'), 'chat goes to the clerk, with a quiet fallback');
expect(str_contains($js, 'savePlay') && str_contains($page, 'playAct'), 'cube restorations are filed on the sitting');
expect(str_contains($css, '#jackLayer') && str_contains($css, '#controls'), 'Jack and the twist board are drawn');
expect(str_contains($page, 'id="board"') && str_contains($css, '#board'), 'the twist board and chat share a dock');
expect(str_contains($css, '--paper:#d9cb9e') && str_contains($css, '--navy:#1e3a5f'), 'the lesson sits on manila stock');
expect(str_contains($page, "ttg_html_site_mark('CUBE')") && str_contains($css, '.site-mark a'), 'cube wordmark links home');
expect(str_contains($page, 'href="/"') && str_contains($page, 'HOME'), 'cube is not an orphan — home is on the hud');
expect(str_contains($css, '--kb') && str_contains($js, 'visualViewport'), 'the chat dock follows the phone keyboard');

$anon = ['known' => false, 'name' => null, 'first' => null, 'slug' => null];
$blank = JackRelationship::blank('session:cube-lesson-test');
$runtime = JackRuntime::build(['relationship' => $blank, 'mode' => 'clerk'], $anon, 'Why is the cube broken?', ['site' => 'cube', 'focus' => 'Lesson 01 · 1 twist']);
expect(str_contains($runtime, 'JACK / CUBE') && str_contains($runtime, 'remedial geometry'), 'Jack knows this is the teaching cube');
expect(str_contains($runtime, 'Lesson 01'), 'the present lesson is on the blotter');
expect(!str_contains($runtime, 'does not become the field'), 'cube runtime is not the field briefing');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
