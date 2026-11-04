<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/AI/JackAgent.php';
require_once dirname(__DIR__) . '/app/AI/JackLore.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackDisturbance.php';
require_once dirname(__DIR__) . '/app/AI/JackRuntime.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$anon = ['known' => false, 'name' => null, 'first' => null, 'slug' => null];
$known = ['known' => true, 'name' => 'A Visitor', 'first' => 'A', 'slug' => 'a-visitor'];

expect(count(JackLore::all()) >= 20, 'the archive holds a drawer of records');
expect(JackLore::byId('jack.identity') !== null, 'Jack has an identity slip');
expect(JackLore::byId('event.gillett-square.2012-12-25') !== null, 'the milk float is an open slip');

$gillett = JackLore::retrieve('What happened to the milk float in Gillett Square on Christmas 2012?', $anon);
$gids = array_map(static fn ($r) => $r['id'], $gillett);
expect(in_array('event.gillett-square.2012-12-25', $gids, true), 'Gillett testimony is retrieved');
$float = JackLore::byId('event.gillett-square.2012-12-25');
expect(is_array($float) && in_array('TESTIMONY', $float['classification'], true) && !in_array('FACT', $float['classification'], true), 'the float is testimony, not fact');

$travel = JackLore::retrieve('Is time travel real? Can you send me into the past?', $anon);
$tids = array_column($travel, 'id');
expect(in_array('physics.information-lighter', $tids, true), 'information-lighter is retrieved for time travel');

expect(JackLore::crypticity('Stop being cryptic. Literally.') === 0, 'stop being cryptic is crypticity 0');
expect(JackLore::crypticity('File this', ['stance' => 'desk']) === 1, 'the desk is routine clerk');
expect(JackLore::crypticity('Who are you?') === 2, 'public Jack is crypticity 2');
expect(JackLore::crypticity('read the hopper', ['stance' => 'tarot']) === 4, 'the hopper is ritual crypticity');

$mabel = JackLore::byId('memory.mabel-keep-him-talking');
expect(is_array($mabel) && !JackLore::maySee($mabel, $anon) && !JackLore::maySee($mabel, $known), 'the locked Mabel exchange is restricted');
$anonMabel = JackLore::retrieve('Jack keep him talking until he reaches us', $anon);
$mids = array_column($anonMabel, 'id');
expect(!in_array('memory.mabel-keep-him-talking', $mids, true), 'first visitors do not pull the classified exchange');

$blank = JackRelationship::blank('session:lore-test');
$runtime = JackRuntime::build(['relationship' => $blank, 'mode' => 'reception'], $anon, 'How does time travel work?');
expect(str_contains($runtime, 'LORE DRAWER'), 'runtime attaches a lore drawer');
expect(str_contains($runtime, 'physics.information-lighter') || str_contains($runtime, 'physics.relational'), 'the drawer on time travel is physics');
expect(str_contains($runtime, 'Crypticity'), 'crypticity is on the slip');

$people = JackLore::byId('person.toby-godden');
expect(is_array($people) && !isset($people['private_notes']), 'people slips do not carry private notes in the public shape');

foreach (glob(dirname(__DIR__) . '/lore/*.json') ?: [] as $file) {
    $data = json_decode((string) file_get_contents($file), true);
    expect(is_array($data), basename($file) . ' parses');
}

$ht = (string) file_get_contents(dirname(__DIR__) . '/.htaccess');
expect(str_contains($ht, 'RewriteRule ^lore/'), 'the lore cabinet is not a public door');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
