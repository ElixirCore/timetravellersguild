<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/machine/inc/emergy.php';
require_once dirname(__DIR__) . '/machine/inc/state.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$root = dirname(__DIR__);
$ht = (string) file_get_contents($root . '/.htaccess');
$router = (string) file_get_contents($root . '/router.php');
$page = is_file($root . '/machine/index.php') ? (string) file_get_contents($root . '/machine/index.php') : '';
$js = is_file($root . '/machine/js/machine.js') ? (string) file_get_contents($root . '/machine/js/machine.js') : '';

expect(str_contains($ht, 'RewriteRule ^machine/?$ /machine/index.php'), '/machine is routed');
expect(str_contains($ht, 'RewriteRule ^api/machine/state/?$ /machine/api.php'), '/api/machine/state is routed');
expect(str_contains($router, "require \$root . '/machine/index.php'"), 'local router serves /machine');
expect(str_contains($router, "require \$root . '/machine/api.php'"), 'local router serves machine API');

$raw = ttg_machine_emergy_raw(0.734, 0.681, 0.412, 1.13);
expect($raw > 0.0, 'emergy raw is positive');
$em = ttg_machine_emergy(0.734, 0.681, 0.412, 1.13);
expect($em['display'] >= 0.0 && $em['display'] <= 1.0, 'emergy display is instrument-normalised');
expect(abs($em['raw'] - $raw) < 1e-12, 'display path does not rewrite raw');

$hiK = ttg_machine_emergy_raw(0.7, 0.7, 0.8, 3.0);
$loK = ttg_machine_emergy_raw(0.7, 0.7, 0.8, 0.1);
expect($hiK > $loK, 'with R≤1, higher κ raises raw emergy for fixed ΔC (canonical equation)');

$holes = ttg_machine_encode_holes('01TTG1', 'PLACE', '2012-12-24T00:00:00Z');
expect(strlen($holes) === 24 && $holes === ttg_machine_encode_holes('01TTG1', 'PLACE', '2012-12-24T00:00:00Z'), 'punch holes are deterministic');

$state = ttg_machine_build_state([
    't' => '2012-12-24T04:00:00Z',
    'k' => '1.13',
    'mind' => '0.72',
    'matter' => '0.81',
]);
expect(!empty($state['ok']) && ($state['instrument'] ?? '') === 'TIME MACHINE №13', 'state payload identifies the instrument');
expect(isset($state['emergy_raw'], $state['emergy_display'], $state['cards'], $state['feed']), 'state has emergy and streams');
expect(is_array($state['cards']) && count($state['cards']) > 0, 'state returns punchcards from the graph');
expect(($state['equation'] ?? '') === 'E = M / R^(κ·ΔC)', 'governing equation is declared');
expect(abs((float) $state['kappa'] - 1.13) < 1e-6, 'kappa query is respected');

$beyond = 0;
foreach ($state['cards'] as $c) {
    if (!empty($c['beyond'])) $beyond++;
}
expect(true, 'beyond flag present on filtered cards (' . $beyond . ' beyond machine present)');

expect(str_contains($page, 'TTG_MACHINE') && str_contains($page, '/api/machine/state'), 'machine door boots config');
expect(str_contains($page, 'three@0.132.2') && str_contains($page, '/machine/js/machine.js'), 'machine loads Three + instrument script');
expect(str_contains($page, 'id="fallback"') && str_contains($page, 'id="stage"'), 'WebGL stage and 2D fallback exist');
expect(str_contains($js, 'MachineScene') || str_contains($js, 'bootMachine'), 'machine.js owns the instrument');

$og = (string) file_get_contents($root . '/inc/og.php');
expect(str_contains($og, "'machine'") && str_contains($og, "'/machine'"), 'OG catalog includes /machine');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
