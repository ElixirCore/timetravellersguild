<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';
require_once dirname(__DIR__) . '/app/AI/JackAgent.php';
require_once dirname(__DIR__) . '/app/AI/JackCharacter.php';
require_once dirname(__DIR__) . '/app/AI/JackMode.php';
require_once dirname(__DIR__) . '/app/AI/JackDisturbance.php';
require_once dirname(__DIR__) . '/app/AI/JackRuntime.php';
require_once dirname(__DIR__) . '/app/AI/JackTarot.php';
require_once dirname(__DIR__) . '/app/AI/JackTarotDeck.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$deck = JackTarot::deck();
expect(count($deck) === 78, 'deck has 78 slips');
expect(isset(JackTarot::names()['The Fool']) && isset(JackTarot::names()['Ace of Cups']), 'major and pip slips are named');
expect((JackTarot::SPREADS['three-stations']['count'] ?? 0) === 3, 'three stations is three slips');
expect((JackTarot::SPREADS['full-hopper']['count'] ?? 0) === 10, 'full hopper is ten slips');

$anon = ['known' => false, 'name' => null, 'first' => null, 'slug' => null];
$blank = JackRelationship::blank('session:tarot-test');
$ctx = JackRuntime::build(['relationship' => $blank, 'mode' => 'clerk'], $anon, 'draw', ['site' => 'tarot']);
expect(str_contains($ctx, 'punchcard tarot') && str_contains($ctx, 'not the Oracle'), 'tarot runtime is Jack’s hopper, not the Oracle');
expect(str_contains($ctx, 'Patter is the work'), 'tarot runtime asks for patter');
expect(str_contains(JackTarot::addendum(), 'you are not the Oracle'), 'addendum forbids becoming Mabel');
expect(str_contains(JackTarot::addendum(), 'Patter is the work'), 'addendum asks for hopper patter');
expect(str_contains(JackCharacter::stable(), 'punchcard tarot'), 'character knows the punchcard tarot');
expect(str_contains(JackCharacter::stable(), 'Patter is the work'), 'character asks for hopper patter');

$towerBrief = JackTarotDeck::briefFor('The Tower', true);
expect(str_contains($towerBrief, 'THE HOUSE AT ABERCRAVE') && str_contains($towerBrief, 'bracing a ruin'), 'a face-down Tower carries compiled inverted sense');
expect(str_contains(JackTarot::stationNotes('three-stations'), 'Held:') && str_contains(JackTarot::stationNotes('three-stations'), 'Unfiled:'), 'three stations have clerk notes');

$fallback = JackTarot::fallbackReading(
    [['name' => 'The Tower', 'reversed' => true]],
    ['The slip'],
    'What is ending?'
);
expect(str_contains($fallback, 'The Tower') && str_contains($fallback, 'FACE-DOWN') && str_contains($fallback, 'Not canon'), 'quiet hopper names the slip without inventing weather');
expect(str_contains($fallback, 'THE HOUSE AT ABERCRAVE') && str_contains($fallback, 'compiled'), 'quiet hopper still reads from the compiled face');
expect(str_contains($fallback, 'You held: What is ending?'), 'quiet hopper keeps the question on the blotter');
$inspect = JackTarot::inspectSlip(['name' => 'The Tower', 'reversed' => true], 'Held', 'Should I leave Cardiff?');
expect($inspect['title'] === 'THE HOUSE AT ABERCRAVE' && str_contains($inspect['lean'], 'Should I leave Cardiff?'), 'an inspect slip leans on the held question');
$page = (string) file_get_contents(dirname(__DIR__) . '/jack/tarot/index.php');
expect(str_contains($page, 'id="question"') && str_contains($page, 'id="inspect"') && str_contains($page, 'What are you holding?'), 'the hopper page holds a question and an inspect sheet');
$str = JackTarot::filing('Strength');
$jus = JackTarot::filing('Justice');
expect($str['roman'] === 'XI' && $str['glyph'] === 'glyph-11-consent', 'Strength files as XI Consent');
expect($jus['roman'] === 'VIII' && $jus['glyph'] === 'glyph-08-provenance', 'Justice files as VIII Provenance');
$svg = file_get_contents(dirname(__DIR__) . '/jack/tarot/svg/deck.svg') ?: '';
expect(str_contains($svg, 'id="card-chassis"') && str_contains($svg, 'id="glyph-09-jack"') && str_contains($svg, 'id="glyph-21-graph"'), '5081 sprite holds chassis and standing glyphs');
$compiled = JackTarotDeck::all();
$fool = JackTarotDeck::byId('major-00');
$ace = JackTarotDeck::byCatalog('Ace of Cups');
expect(count($compiled) === 78 && $fool && $ace, 'the catalogue holds seventy-eight compiled slips');
expect(($fool['href'] ?? '') === '/deck/major-00' && str_contains(JackTarotDeck::slipMarkup($fool), 'UNINITIALISED ADDRESS'), 'a slip has a /deck door and a punch face');
$face = JackTarotDeck::faceMarkup($fool);
expect(
    (!empty($fool['has_face']) && str_contains($face, 'major-00.webp'))
    || (empty($fool['has_face']) && str_contains($face, 'slip-face')),
    'a filed face is used; otherwise the punch slip stands in'
);
$ht = (string) file_get_contents(dirname(__DIR__) . '/.htaccess');
$router = (string) file_get_contents(dirname(__DIR__) . '/router.php');
expect(str_contains($ht, 'RewriteRule ^deck/') && str_contains($router, 'deck'), '/deck is a public door');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
