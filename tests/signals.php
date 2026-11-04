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

$page = (string) file_get_contents($root . '/signals/index.php');
$js = (string) file_get_contents($root . '/signals/js/signals.js');
$css = (string) file_get_contents($root . '/signals/css/signals.css');
$ari = (string) file_get_contents($root . '/signals/js/arianrhod.js');
$runtime = (string) file_get_contents($root . '/app/AI/JackRuntime.php');

expect(!str_contains($page, "require dirname(__DIR__) . '/inc/room.php'"), 'signals is a plane, not the generic room stub');
expect(str_contains($page, 'TTG_SIGNALS') && str_contains($page, '/signals/js/signals.js'), 'the plane is booted from a signed payload');
expect(str_contains($page, '/signals/css/signals.css') && is_file($root . '/signals/js/arianrhod.js'), 'scripts live in js/, sheets in css/');
expect(str_contains($page, 'id="viewport"') && str_contains($page, 'id="plane"') && str_contains($page, 'id="titleFlash"'), 'four-way viewport, punchcard boot, plane');
expect(str_contains($js, 'ArrowLeft') && str_contains($js, 'pointerdown') && (str_contains($js, 'keys.a') || str_contains($js, "keys.a")), 'the plane pans four ways');
expect(str_contains($js, 'HOLLERITH') && str_contains($js, 'IBM 5081') && str_contains($js, 'startTitleFlash'), 'cards punch in the house IBM 5081 language');
expect(str_contains($page, 'id="arianrhod"') && str_contains($ari, "W = 9") && str_contains($ari, 'sit'), 'Arianrhod is the 9×9 animated icon');
expect(str_contains($js, 'CELL_W') && str_contains($js, 'yearRow') && str_contains($js, 'typeCol'), 'tiles sit on a context grid, not a random scatter');
expect(str_contains($css, '.chip') && str_contains($js, 'className = \'chip\''), 'cards read as SIM-stock with a contact chip');
expect(str_contains($css, '#f2d322') && !str_contains($css, '#16130e') && !str_contains($page, 'id="cobweb"') && !str_contains($page, 'id="fauna"'), 'stock is yellow; the halloween climate is gone');
expect(str_contains($css, 'Courier') && str_contains($css, '#1e3a5f') && str_contains($css, '#c41e3a'), 'navy, scarlet, Courier stay house');
expect(str_contains($css, 'prefers-reduced-motion') && str_contains($js, 'prefers-reduced-motion'), 'the plane still reads when motion is off');
expect(str_contains($page, 'NOT CANON') && str_contains($js, 'Not canon'), 'slips stay working slips');
expect(str_contains($page, 'href="/signals/" aria-current="page"') && str_contains($page, 'ttg_html_navigator_dock'), 'the dock marks SIGNALS and keeps the navigator for Guild folk');
expect(str_contains($runtime, "site === 'signals'") && str_contains($runtime, 'Arianrhod'), 'Jack knows the plane and may name its icon');

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
