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

$page = (string) file_get_contents($root . '/hub/index.php');
$css = (string) file_get_contents($root . '/hub/assets/css/hub.css');
$js = (string) file_get_contents($root . '/hub/assets/js/hub.js');
$codex = (string) file_get_contents($root . '/hub/data/codex.json');
$fn = (string) file_get_contents($root . '/hub/inc/functions.php');

expect(is_file($root . '/hub/data/codex.json'), 'hub codex is filed');
expect(str_contains($fn, 'ttg_codex'), 'hub loads the codex');
expect(str_contains($page, 'id="disc"') && str_contains($page, 'face-nav') && str_contains($page, 'mem-card'), 'hub is a disc console with avenues');
expect(str_contains($codex, '"title": "Trajectory"') && str_contains($codex, '"title": "Modes"') && str_contains($codex, '"title": "Disciplines"'), 'codex faces are present');
expect(str_contains($codex, '"title": "Avenues"') && str_contains($codex, '"title": "Properties"'), 'avenues and properties are named');
expect(str_contains($codex, '"/now/tree"') && str_contains($codex, '"/jack"') && str_contains($page, 'card-grid'), 'avenues open live doors');
expect(str_contains($css, '--paper:#f1e4c4') && str_contains($css, 'disc-spin') && str_contains($css, 'mem-card'), 'paper + disc language, not punch stock');
expect(str_contains($css, '#dock') && str_contains($page, 'aria-current="page">HUB'), 'hub shares the NOW dock family');
expect(str_contains($js, 'data-face') && str_contains($js, 'replaceState'), 'faces turn with hash routes');
expect(str_contains($codex, 'Two presents') && str_contains($codex, 'Clerkship') && str_contains($codex, 'Unknown is valid'), 'codex explains the Guild at length');
expect(!str_contains($page, 'punch-sheet') && !str_contains($css, '5081'), 'hub is disc/cog tech, not punchcards');

require_once $root . '/hub/inc/functions.php';
$c = ttg_codex();
expect(count($c['faces'] ?? []) === 5, 'five faces on the cog');
expect(count($c['avenues'] ?? []) >= 8, 'avenues are slotted');
expect(($c['faces'][0]['title'] ?? '') === 'Trajectory', 'trajectory leads the disc');

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
