<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/AI/JackAgent.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';
require_once dirname(__DIR__) . '/app/AI/JackMode.php';
require_once dirname(__DIR__) . '/app/AI/JackDisturbance.php';
require_once dirname(__DIR__) . '/app/AI/JackRuntime.php';
require_once dirname(__DIR__) . '/app/AI/JackCharacter.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$root = dirname(__DIR__);
$page = (string) file_get_contents($root . '/one/index.php');
$js = (string) file_get_contents($root . '/one/one.js');
$css = (string) file_get_contents($root . '/one/one.css');
$jack = (string) file_get_contents($root . '/now/jack.php');
$ht = (string) file_get_contents($root . '/.htaccess');

expect(str_contains($page, 'TTG_ONE') && str_contains($page, 'one.js'), 'ONE is a public door');
expect(str_contains($js, "stance === 'tap'") && str_contains($js, 'setStance'), 'clicking a station changes Jack’s state');
expect(str_contains($js, "id: 'desk'") && str_contains($js, "id: 'tap'") && str_contains($js, "id: 'tarot'") && str_contains($js, "id: 'jack'"), 'desk, tap, hopper and Jack are in the room');
expect(str_contains($js, "site', 'one'") && str_contains($js, 'stance'), 'the room talks to the clerk as ONE');
expect(str_contains($js, 'JackVoice') && str_contains($page, 'jack-voice.js'), 'Jack speaks with the browser reader');
expect(str_contains($js, 'three-stations') && str_contains($page, 'hopper'), 'the hopper lives in the same room');
expect(str_contains($css, 'data-stance') && str_contains($css, '--amber'), 'the room lighting follows his state');

$anon = ['known' => false, 'name' => null, 'first' => null, 'slug' => null];
$blank = JackRelationship::blank('session:one-test');
$desk = JackRuntime::build(['relationship' => $blank, 'mode' => 'clerk'], $anon, 'File this', ['site' => 'one', 'stance' => 'desk']);
$tap = JackRuntime::build(['relationship' => $blank, 'mode' => 'bartime'], $anon, 'Tell me about time', ['site' => 'one', 'stance' => 'tap']);
$tarot = JackRuntime::build(['relationship' => $blank, 'mode' => 'clerk'], $anon, 'draw', ['site' => 'one', 'stance' => 'tarot']);
$him = JackRuntime::build(['relationship' => $blank, 'mode' => 'reception'], $anon, 'Who are you?', ['site' => 'one', 'stance' => 'jack']);

expect(str_contains($desk, 'on duty') && str_contains($desk, 'ONE room'), 'the desk is official');
expect(str_contains($tap, 'Bartime') && str_contains($tap, 'tap'), 'the tap is easy last orders');
expect(str_contains($tarot, 'hopper') && str_contains($tarot, 'Punchcard tarot'), 'the hopper is punchcard tarot');
expect(str_contains($him, 'present as himself'), 'clicking Jack is presence');
expect(str_contains($jack, "site === 'one'") && str_contains($jack, "stance === 'tap'"), 'the clerk endpoint honours the tap');
expect(str_contains($ht, 'RewriteRule ^one/'), '/one is routed');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
