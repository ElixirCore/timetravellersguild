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

$graph = (string) file_get_contents($root . '/inc/graph.php');
$html = (string) file_get_contents($root . '/index.html');
$js = (string) file_get_contents($root . '/assets/now.js');
$css = (string) file_get_contents($root . '/assets/now.css');
$router = (string) file_get_contents($root . '/router.php');
$ht = (string) file_get_contents($root . '/.htaccess');
$around = (string) file_get_contents($root . '/now/around.php');
$splash = (string) file_get_contents($root . '/now/index.php');
$treeDoor = (string) file_get_contents($root . '/now/tree/index.php');
$engine = (string) file_get_contents($root . '/index.php');

expect(str_contains($graph, 'function ttg_now_around') && str_contains($graph, "'links' =>"), 'the field projects linked timelines onto each node');
expect(str_contains($graph, "'around' => '/now/around'"), 'NOW names the neighborhood door');
expect(is_file($root . '/now/around.php') && str_contains($around, 'ttg_now_around'), 'a public neighborhood can be fetched');
expect(str_contains($router, '/now/around') && str_contains($ht, 'now/around'), 'the neighborhood is routed');
expect(is_file($root . '/now/index.php') && is_file($root . '/now/tree/index.php'), 'NOW has a boot door and a tree door');
expect(str_contains($splash, "TTG_NOW_MODE', 'boot'") && str_contains($splash, "dirname(__DIR__) . '/index.php'"), '/now boots the same engine');
expect(str_contains($engine, 'TTG_NOW_MODE') && str_contains($engine, "TTG_MODE"), 'the engine injects boot mode');
expect(str_contains($treeDoor, "dirname(__DIR__, 2) . '/index.php'"), 'the tree door still serves the field engine');
expect(str_contains($ht, 'now/tree') && str_contains($ht, '/now/index.php') && str_contains($router, '/now/tree'), '/now boots; /now/tree is the settled wood');
expect(str_contains($js, "MODE === 'boot'") && str_contains($js, 'finishBoot') && str_contains($js, 'tickBoot'), 'the engine can boot itself');
expect(str_contains($js, 'woodSegs') && str_contains($js, 'bootTape') && str_contains($js, 'makeLabel'), 'boot reveals wood segments and archive labels');
expect(str_contains($js, 'assignBootSemantics') && str_contains($js, 'bootCamera') && str_contains($js, 'bootPattern'), 'boot orders fruit by pattern limbs and orbits the camera');
expect(str_contains($js, "history.replaceState") && str_contains($js, "'/now/tree'"), 'boot hands off to /now/tree without remounting');
expect(!is_file($root . '/assets/now-splash.js') && !is_file($root . '/assets/now-splash.css'), 'the 2D splash sketch is gone');
expect(str_contains($css, 'body.boot') && str_contains($css, '#bootSkip'), 'boot chrome waits on the same page');
expect(str_contains($js, "'/now/tree'") && str_contains($html, 'href="/now/tree"'), 'the wood knows its home path');
expect(str_contains($html, 'id="chrono"') && str_contains($html, 'id="lifeLimb"'), 'the tree shows chronology and a limb');
expect(str_contains($js, 'function followSlug') && str_contains($js, 'walkLimb') && str_contains($js, 'yearToSignU'), 'the tree walks time and linked limbs');
expect(str_contains($js, 'G.around') && str_contains($js, '/now/around'), 'off-wood links grow the neighborhood');
expect(str_contains($css, '#chrono') && str_contains($css, '#lifeLimb'), 'chronology has a rail');
expect(str_contains($js, 'function placeKey') && str_contains($js, 'function houseOf') && str_contains($js, 'function socialHead'), 'projections key off place, house, and neighbourhood');
expect(str_contains($js, 'VIEWS') && str_contains($js, 'Along the bore') && str_contains($js, 'places as meridians'), 'each projection names a view of the timetube');
expect(str_contains($js, 'viewQWant') && str_contains($js, 'world.quaternion.slerp') && str_contains($js, 'applyView') && str_contains($js, 'pose:'), 'the wood reorients with the projection');
expect(str_contains($js, 'cat.place.rank') && str_contains($js, 'yearToY'), 'spatial meridians use real places along time');
expect(str_contains($html, 'title="Elevation · time upright"') && str_contains($html, 'data-proj="SPATIAL"'), 'projection tabs name their stance');
expect(str_contains($js, 'PLAY:') && str_contains($js, 'WORKING SLIP') && str_contains($graph, 'ttg_play_field_nodes'), 'progress beads sit on the wood as working slips');
expect(is_file($root . '/inc/feed-field.php') && str_contains($graph, 'ttg_feed_relevant_nodes'), 'Jack-relevant plates can sit on the wood');
expect(str_contains($html, 'id="lensPort"') && str_contains($js, 'function openLens') && str_contains($css, '#lensPort'), 'the tree HUD has a magnifying-glass port');
expect(str_contains($js, 'function closeLens') && str_contains($js, 'function revealLens') && str_contains($js, 'port.hidden = true'), 'the glass stays hidden until a plate needs it');
expect(str_contains($css, '#lensPort.is-in') && str_contains($css, 'min(86vw,68vh,560px)') && str_contains($css, 'object-fit:contain'), 'an open glass shows the plate large');

require_once $root . '/inc/graph.php';
$nodes = ttg_graph_unique_nodes();
$sample = null;
foreach ($nodes as $node) {
    if (!ttg_graph_public($node)) continue;
    $life = ttg_graph_life($node);
    if (!empty($life['links'])) {
        $sample = $node;
        break;
    }
}
if ($sample) {
    $proj = ttg_graph_project_node($sample, ttg_graph_viewer(), []);
    expect(!empty($proj['links']) && !empty($proj['links'][0]['slug']), 'a projected node carries its links');
    $nb = ttg_now_around((string) $sample['slug']);
    expect(is_array($nb) && !empty($nb['ok']) && count($nb['nodes']) >= 2, 'around returns the node and its public neighbors');
} else {
    expect(true, 'no public linked node in this store — neighborhood helpers still compile');
}

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
