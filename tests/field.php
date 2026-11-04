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

$page = (string) file_get_contents($root . '/field/index.php');
$js = (string) file_get_contents($root . '/assets/field.js');
$css = (string) file_get_contents($root . '/assets/field.css');
$runtime = (string) file_get_contents($root . '/app/AI/JackRuntime.php');
$join = (string) file_get_contents($root . '/join/index.php');

expect(str_contains($page, 'field.css') && str_contains($page, 'HOLD TO TALK'), 'field page is a talk-first punch slip');
expect(str_contains($page, 'TEMPORAL') === false && str_contains($js, 'TEMPORAL') && str_contains($js, 'SYMBOLIC'), 'five projections are drawn, not stored, on the canvas');
expect(str_contains($js, "site', 'field'") || str_contains($js, 'site", "field"') || str_contains($js, "set('site', 'field')"), 'spoken stories are marked as field testimony');
expect(str_contains($js, 'SpeechRecognition') && str_contains($js, '/now/jack'), 'the telephone talks to the live clerk');
expect(str_contains($css, '#d9cb9e') && str_contains($css, 'Courier'), 'field stock is manila Courier');
expect(str_contains($runtime, "site === 'field'"), 'Jack knows when he is standing in the field');
expect(str_contains($join, 'href="/field/"'), 'the join field door opens the field');
expect(!str_contains($js, 'THREE') && !str_contains($page, 'three.js'), 'the field is not a Three.js store');

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
