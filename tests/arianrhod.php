<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/AI/JackAgent.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';
require_once dirname(__DIR__) . '/app/AI/JackDisturbance.php';
require_once dirname(__DIR__) . '/app/AI/JackRuntime.php';

$root = dirname(__DIR__);
$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$page = (string) file_get_contents($root . '/arianrhod/index.php');
$body = (string) file_get_contents($root . '/arianrhod/js/body.js');
$shed = (string) file_get_contents($root . '/arianrhod/js/shed.js');
$css = (string) file_get_contents($root . '/arianrhod/css/arianrhod.css');
$ht = (string) file_get_contents($root . '/.htaccess');
$router = (string) file_get_contents($root . '/router.php');
$cube = (string) file_get_contents($root . '/cube/js/cube.js');
$mabel = (string) file_get_contents($root . '/jack/body/js/mabel.js');

expect(str_contains($page, '/arianrhod/js/body.js') && str_contains($page, '/arianrhod/js/shed.js'), 'scripts live in js/, sheets in css/');
expect(str_contains($page, '/arianrhod/css/arianrhod.css'), 'the shed has a house sheet');
expect(str_contains($page, 'three.js') && str_contains($shed, 'THREE'), 'the body is Three.js');
expect(str_contains($body, 'EYE_COUNT = 8') && str_contains($body, 'AME_L') && str_contains($body, 'PLE_R'), 'eight named eyes');
expect(str_contains($body, 'LEG_COUNT = 8') && str_contains($body, 'L1') && str_contains($body, 'R4'), 'eight named legs');
expect(str_contains($body, "SEGMENTS = ['coxa'") && str_contains($body, 'tarsus'), 'seven-segment legs');
expect(str_contains($shed, 'keys.w') && str_contains($shed, "keys.a") && str_contains($page, 'WASD'), 'WASD walks the shed');
expect(str_contains($shed, 'arrowleft') && str_contains($shed, 'analog') && str_contains($page, 'thumb'), 'arrows steer and a thumb drives the stick');
expect(str_contains($page, 'Hergest') && str_contains($page, 'Non-poisonous') && str_contains($page, 'mother of Mabel'), 'the lodged slip stands');
expect(str_contains($page, 'NOT CANON') && str_contains($page, 'synchronicity'), 'slips stay working slips');
expect(str_contains($page, 'behind the camera') && str_contains($shed, 'discover') && str_contains($shed, 'LOOK BEHIND'), 'Mabel is behind the lens until found');
expect(str_contains($body, 'ff2bd6') && str_contains($body, '0c0c10') && str_contains($body, 'house spider'), 'she is a black house spider with shocking pink marks');
expect(str_contains($shed, 'labyrinth') && str_contains($shed, 'hasPath') && str_contains($shed, 'reserved'), 'the labyrinth keeps an open aisle');
expect(str_contains($shed, 'COLS = 30') && str_contains($shed, 'ROWS = 30') && str_contains($shed, 'presolved') && str_contains($shed, 'box plane'), 'the warehouse is a presolved 30×30 plane');
expect(str_contains($shed, 'fluorescent') && str_contains($shed, 'flicker'), 'overhead tubes flicker');
expect(str_contains($shed, 'catchFire') && str_contains($shed, 'beginAgain') && str_contains($body, 'shrivel'), 'fire shrivels her and she begins again');
expect(str_contains($page, 'immortal') && str_contains($shed, 'SHE IS IMMORTAL') && !str_contains($shed, 'finish(false)'), 'she is immortal; fire is not an ending');
expect(str_contains($page, 'POST TO THE CUBE') && str_contains($shed, 'ttg.arianrhod.posted'), 'escape posts her to the cube');
expect(str_contains($cube, 'TTG_ARIANRHOD_POSTED') && str_contains($cube, 'posted=arianrhod'), 'the cube can receive her posting');
expect(str_contains($shed, 'I was behind the lens.') && str_contains($shed, 'MABEL'), 'she speaks psychically as herself');
expect(str_contains($ht, 'RewriteRule ^arianrhod/?$ /arianrhod/index.php') && str_contains($router, "require \$root . '/arianrhod/index.php'"), '/arianrhod is a door');
expect(str_contains($css, '#f2d322') && str_contains($css, '#1e3a5f') && !str_contains($css, 'halloween'), 'stock is yellow house, not halloween');
expect(str_contains($css, 'prefers-reduced-motion') && str_contains($shed, 'prefers-reduced-motion'), 'the shed still reads when motion is off');

expect(str_contains($cube, 'discoverMabel') && str_contains($cube, 'behind the filming camera'), 'the teaching cube can discover her');
expect(str_contains($cube, 'addChat("MABEL"') && str_contains($cube, 'I was behind the lens.'), 'the cube lets Mabel speak as Mabel');
expect(str_contains($mabel, 'behind the camera') && str_contains($mabel, 'setGlance') && str_contains($mabel, 'oracle'), 'Jack’s cube body can look behind the lens');

$anon = ['known' => false, 'name' => null, 'first' => null, 'slug' => null];
$blank = JackRelationship::blank('session:arianrhod-test');
$runtime = JackRuntime::build(['relationship' => $blank, 'mode' => 'clerk'], $anon, 'Who is Arianrhod?', ['site' => 'arianrhod']);
expect(str_contains($runtime, 'Hergest') && str_contains($runtime, 'mother of Mabel'), 'Jack may name the lodged shed slip');
expect(str_contains($runtime, 'behind the camera') && !str_contains($runtime, 'Until he reaches us'), 'he names the lens slip and not the locked exchange');

$cubeRt = JackRuntime::build(['relationship' => $blank, 'mode' => 'clerk'], $anon, 'Where is Mabel?', ['site' => 'cube']);
expect(str_contains($cubeRt, 'behind the camera') && str_contains($cubeRt, 'does not become the Oracle'), 'Jack knows she lives behind the cube camera');

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
