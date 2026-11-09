<?php
declare(strict_types=1);

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

require_once dirname(__DIR__) . '/inc/briefing.php';

$page = (string) file_get_contents(dirname(__DIR__) . '/intro.php');
$js = (string) file_get_contents(dirname(__DIR__) . '/assets/intro.js');
$css = (string) file_get_contents(dirname(__DIR__) . '/assets/intro.css');
$sprite = (string) file_get_contents(dirname(__DIR__) . '/jack/body/js/sprite.js');
$runtime = (string) file_get_contents(dirname(__DIR__) . '/app/AI/JackRuntime.php');
$act = (string) file_get_contents(dirname(__DIR__) . '/intro/act.php');
$joinAct = (string) file_get_contents(dirname(__DIR__) . '/join/act.php');
$peopleDb = (string) file_get_contents(dirname(__DIR__) . '/people/inc/db.php');

$round = ttg_briefing_clean([
    'seen' => ['jack', 'tree', 'nope'],
    'done' => true,
    'forgotten' => true,
    'card' => ['name' => 'The Hermit', 'job' => 'JACK AT THE DESK'],
    'asks' => ['Who are you?'],
    'nodes' => ['Abercrave'],
]);
$encoded = ttg_briefing_encode($round);
$back = ttg_briefing_decode($encoded);

expect(str_contains($page, 'id="titleFlash"') && str_contains($page, 'id="titleCard"') && str_contains($page, 'booting'), 'the front door flashes a punchcard title before Jack');
expect(str_contains($js, 'THE TIME') && str_contains($js, 'TRAVELLERS GUILD') && str_contains($js, 'startTitleFlash'), 'the title is punched onto IBM stock in pixel type');
expect(str_contains($css, '#titleFlash') && str_contains($css, 'pixelated'), 'the title card is a punchcard overlay');
expect(str_contains($js, "ORDER = ['jack', 'you', 'tree']"), 'orientation is Jack → sitting → NOW');
expect(str_contains($js, 'clerk of the Time Travellers Guild') && str_contains($js, 'I lodge it as your account') && str_contains($js, 'What do you remember'), 'Jack opens by saying who he is and what he does, and invites a recollection');
expect(str_contains($page, 'id="deskAsk"') && str_contains($page, 'id="deskReply"') && str_contains($page, "fetch('/now/jack'") && !str_contains($js, 'chatLog'), 'front door keeps one conversation surface with Jack');
expect(str_contains($page, 'Ask him something') && !str_contains($js, 'STARTERS'), 'the front door invites a question of your own, not cryptic cards');
expect(!str_contains($js, 'CARDS = [') && !str_contains($js, 'tree-beads'), 'cryptic trailhead bead picker is gone');
expect(str_contains($js, 'sitForm') && str_contains($js, '/play/act'), 'sitting still files a name on the blotter');
expect(str_contains($js, 'WALK THE TREE') && str_contains($page, 'id="titleFlash" href="/now"'), 'intro still walks the public tree at /now');
expect(str_contains($page, 'href="/now"') && str_contains($page, 'href="/cube"') && str_contains($page, '<b>CUBE</b> JACK') && !str_contains($page, 'href="/feed/"'), 'front page doors are NOW and Jack’s cube, with FEED off the front');
expect(str_contains($page, 'door primary') && str_contains($page, '<b>NOW</b> THE TREE'), 'NOW is the primary door');
expect(str_contains($js, 'SKIP TO NOW') && str_contains($js, "(cfg && cfg.tree) || '/now'"), 'skip goes straight toward NOW');
expect(str_contains($css, 'body.briefing #dock') && !str_contains($css, 'body.briefing .always-on') && str_contains($css, '.jack-reader'), 'briefing hides dock; punch reader is styled');
expect(str_contains($sprite, 'kfeffefk') && str_contains($sprite, 'kkkkkkkk') && !str_contains($sprite, 'desk-dog'), 'Jack has a square head with two eyes');
expect(preg_match('~/assets/intro\.css\?v=\d+~', $page) === 1 && preg_match('~/assets/jack-line\.js\?v=\d+~', $page) === 1, 'front door assets are cache-busted');
expect(str_contains($page, 'ttg_html_site_mark()'), 'front door wordmark links home');
expect(str_contains($js, 'site') && str_contains($js, 'intro') && str_contains($js, '/now/jack'), 'the front door can ask the clerk');
expect(str_contains($js, 'startPunchProcess') && str_contains($js, 'Slip received. Card punched.'), 'asking Jack shows the punch-card process');
expect(str_contains($js, "asks: []") && !str_contains($js, 'asks.push'), 'chat asks are not remembered between sessions');
expect(str_contains($page, "fetch('/jack/speak.php'") && str_contains($page, 'speechSynthesis') && str_contains($page, 'ttg_voice_credit()') && str_contains($page, 'id="jackDesk" class="closed"'), 'the front door speaks through the site voice, falls back to the device, and closes the desk when the budget is spent');
expect(str_contains($runtime, "site === 'intro'") && str_contains($runtime, 'Do not praise the website') && str_contains($runtime, 'Lead with Guild propositions'), 'Jack is forthcoming and does not praise the site');
$briefing = (string) file_get_contents(dirname(__DIR__) . '/inc/briefing.php');
expect(str_contains($briefing, 'session-local') && str_contains($briefing, 'do not replay them on the front door'), 'front-door brief payload omits chat asks');
expect($back['done'] && $back['card']['name'] === 'The Hermit' && $back['seen'] === ['jack', 'tree'], 'briefing cookie round-trips');
expect(str_contains($js, 'ttg_brief') && str_contains($js, 'persist') && str_contains($act, 'ttg_briefing_write'), 'the briefing is written to a cookie');
expect(str_contains($joinAct, "row['briefing']") && str_contains($peopleDb, 'magic_links') && str_contains($peopleDb, 'briefing'), 'signup keeps the briefing as relevant data');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
