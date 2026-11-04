<?php
declare(strict_types=1);

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$root = dirname(__DIR__);
$intro = (string) file_get_contents($root . '/intro.php');
$chat = (string) file_get_contents($root . '/chat/index.php');
$tools = (string) file_get_contents($root . '/assets/jack-guild-tools.js');
$jack = (string) file_get_contents($root . '/now/jack.php');
$router = (string) file_get_contents($root . '/router.php');

expect(str_contains($intro, 'TTG_VOICE') && str_contains($intro, 'jack-guild-tools.js'), 'the front door signs the voice sitting');
expect(str_contains($intro, 'JackGuild.clientTools') && str_contains($intro, 'lodge a statement'), 'the front door offers Guild tools and lodging');
expect(str_contains($chat, 'TTG_VOICE') && str_contains($chat, 'JackGuild.clientTools'), '/chat uses the same Guild tools');
expect(str_contains($router, "'/chat'") && str_contains($router, 'chat/index.php'), '/chat is a PHP door');
expect(str_contains($tools, 'lodge_testimony') && str_contains($tools, "intent', 'lodge'") && str_contains($tools, "source', 'voice'"), 'the voice tool lodges through the clerk');
expect(str_contains($tools, "body.set('csrf'") && str_contains($tools, 'same-origin'), 'the lodge post carries the sitting and stays on origin');
expect(!str_contains($intro, 'csrf: document') && !preg_match('/dynamicVariables:[\\s\\S]*csrf/', $intro), 'the signed slip is not sent to ElevenLabs as a dynamic variable');
expect(str_contains($jack, "source === 'voice'") && str_contains($jack, '$testimony') && str_contains($jack, 'Confirm with the visitor'), 'the clerk refuses an unconfirmed voice lodge');
expect(str_contains($jack, 'JackIngest::run') && str_contains($jack, '$testimony !== \'\''), 'voice testimony is held by ingest, not a second clerk');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
