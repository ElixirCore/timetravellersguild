<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/play.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$root = dirname(__DIR__);
$act = (string) file_get_contents($root . '/play/act.php');
$ht = (string) file_get_contents($root . '/.htaccess');
$router = (string) file_get_contents($root . '/router.php');
$intro = (string) file_get_contents($root . '/intro.php');
$introJs = (string) file_get_contents($root . '/assets/intro.js');
$cubeJs = (string) file_get_contents($root . '/cube/js/cube.js');
$nowJs = (string) file_get_contents($root . '/assets/now.js');
$graph = (string) file_get_contents($root . '/inc/graph.php');

expect(is_file($root . '/inc/play.php') && is_file($root . '/play/act.php'), 'play state has a door');
expect(str_contains($act, 'ttg_play_write') && str_contains($act, 'ttg_graph_csrf_ok'), 'the sitting is signed');
expect(str_contains($ht, 'play/act') && str_contains($router, '/play/act.php'), 'play is routed');
expect(str_contains($intro, 'THE SITTING') && str_contains($introJs, 'sitForm') && str_contains($introJs, 'playAct'), 'Jack interviews at the front door');
expect(str_contains($cubeJs, 'savePlay') && str_contains($cubeJs, 'resumePlay'), 'the cube remembers the sitting');
expect(str_contains($nowJs, 'PLAY:') && str_contains($nowJs, 'node.play') && str_contains($graph, 'ttg_play_field_nodes'), 'progress earns beads on the tree');

$round = ttg_play_clean([
    'name' => 'Ada',
    'place' => 'Dalston',
    'note' => 'I knocked.',
    'interviewed' => true,
    'cube' => ['best' => 3, 'lesson' => 2, 'restores' => 3],
]);
$encoded = ttg_play_encode($round);
$back = ttg_play_decode($encoded);

expect($back['interviewed'] && $back['name'] === 'Ada' && $back['cube']['best'] === 3, 'play cookie round-trips');
expect($back['cube']['lesson'] === 4, 'the next cube lesson follows the best restoration');
expect(count($back['beads']) === 4 && $back['beads'][0]['kind'] === 'interview' && $back['beads'][3]['id'] === 'cube-03', 'interview plus three restorations are four beads');
expect(ttg_play_public($back)['cube']['best'] === 3, 'the public sitting names the cube score');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
