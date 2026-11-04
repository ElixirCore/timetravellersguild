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

$view = (string) file_get_contents($root . '/view/index.php');
$js = (string) file_get_contents($root . '/assets/view.js');
$nowJs = (string) file_get_contents($root . '/assets/now.js');
$css = (string) file_get_contents($root . '/assets/view.css');
$router = (string) file_get_contents($root . '/router.php');
$ht = (string) file_get_contents($root . '/.htaccess');

expect(is_file($root . '/view/index.php'), 'view page exists');
expect(str_contains($view, "TTG_MODE='view'") && str_contains($view, 'ttg_now_payload'), 'view injects the NOW field in screensaver mode');
expect(str_contains($view, '/assets/view.js') && str_contains($view, '/assets/now.js'), 'view loads the tree and the orbit');
expect(str_contains($js, 'tourOrder') && str_contains($js, 'PATTERN') && str_contains($js, 'PROJS'), 'orbit searches deterministically and highlights pattern');
expect(str_contains($js, 'function pause') && str_contains($view, 'ENTER THE TREE'), 'interaction wakes the screensaver toward /now');
expect(str_contains($nowJs, "MODE === 'view'") && str_contains($nowJs, 'tourOrder:') && str_contains($nowJs, 'isView ? 0.00105'), 'NOW exposes a view orbit and faster idle yaw');
expect(str_contains($css, '#viewHud') && str_contains($css, 'body.view'), 'view has a thin caption HUD');
expect(str_contains($router, "/view'") && str_contains($ht, 'view/?$'), 'view is routed');

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
