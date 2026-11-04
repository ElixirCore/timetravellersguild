<?php
declare(strict_types=1);

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

expect(is_file(dirname(__DIR__) . '/square/index.php'), 'square page is filed');
expect(is_file(dirname(__DIR__) . '/square/js/square.js'), 'square world script is filed');
$runtime = (string) file_get_contents(dirname(__DIR__) . '/app/AI/JackRuntime.php');
expect(str_contains($runtime, "site === 'square'") && str_contains($runtime, 'Gillett Square'), 'Jack knows he is in the square');
expect(str_contains($runtime, 'does not become the square'), 'he remains the clerk outdoors');

$src = (string) file_get_contents(dirname(__DIR__) . '/square/js/square.js');
expect(str_contains($src, 'THREE') && str_contains($src, 'site') && str_contains($src, 'square'), 'world talks to the clerk as square');
$page = (string) file_get_contents(dirname(__DIR__) . '/square/index.php');
$voice = (string) file_get_contents(dirname(__DIR__) . '/assets/jack-voice.js');
expect(str_contains($page, 'jack-voice.js') && str_contains($src, 'JackVoice'), 'the square uses Jack’s browser voice');
expect(str_contains($voice, 'speechSynthesis') && !str_contains($voice, '/jack/speak'), 'Jack’s voice is the browser reader');
expect(str_contains($src, '/join/act.php'), 'join slip is filed, not kept on the device');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
