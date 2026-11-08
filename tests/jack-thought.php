<?php
declare(strict_types=1);

/**
 * What a keeper's strike reaches, and what a visitor's press may spend. No model call. No secrets. Writes nothing.
 */
require_once dirname(__DIR__) . '/app/AI/JackThought.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $label): void
{
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $label\n"; }
    else { $fail++; echo "FAIL $label\n"; }
}

/* A strike reaches every thought that made the thing, and no others. */
$thoughts = [
    ['id' => 'a', 'text' => 'formed h1', 'changes' => [['did' => 'came to hold', 'id' => 'h1']], 'inferred' => []],
    ['id' => 'b', 'text' => 'revised h1', 'changes' => [['did' => 'revised', 'id' => 'h1']], 'inferred' => []],
    ['id' => 'c', 'text' => 'made i1', 'changes' => [], 'inferred' => [['did' => 'linked', 'id' => 'i1']]],
    ['id' => 'd', 'text' => 'made h2', 'changes' => [['did' => 'came to hold', 'id' => 'h2']], 'inferred' => []],
    ['id' => 'e', 'text' => 'older shape, no changes key'],
];
$noHeld = JackThought::blankHeld();
$noBook = JackThought::blankInferences();
expect(JackThought::unstruck($thoughts, $noHeld, $noBook) === $thoughts, 'with nothing struck every thought shows');

$ids = static fn (array $list): array => array_column($list, 'id');
$h = ['struck' => [['id' => 'h1', 'text' => 'x', 'from' => 'a']]] + $noHeld;
expect($ids(JackThought::unstruck($thoughts, $h, $noBook)) === ['c', 'd', 'e'], 'striking a belief withholds the thoughts that formed and revised it');
$b = ['struck' => [['id' => 'i1', 'note' => 'x', 'from' => 'c']]] + $noBook;
expect($ids(JackThought::unstruck($thoughts, $noHeld, $b)) === ['a', 'b', 'd', 'e'], 'striking an inference withholds the thought that made it');
$h2 = ['struck' => [['id' => 'h9', 'text' => 'x', 'from' => 'd']]] + $noHeld;
expect($ids(JackThought::unstruck($thoughts, $h2, $noBook)) === ['a', 'b', 'c', 'e'], 'the forming thought is withheld even if its changes no longer name the id');

/* Anything that means what was struck is refused, in either kind of proposal. */
$struck = ['A stamp is not proof of travel.'];
$near = static fn (string $said, array $against): ?float => str_contains($said, 'NEAR') ? 0.7 : 0.1;
$ops = [['do' => 'hold', 'text' => 'NEAR the struck idea'], ['do' => 'hold', 'text' => 'something else'], ['do' => 'link', 'a' => 'x', 'b' => 'y', 'note' => 'NEAR again'], ['do' => 'drop', 'id' => 'h3']];
$kept = JackThought::clearOfStruck($ops, $struck, $near);
expect(count($kept) === 2 && $kept[0]['text'] === 'something else' && $kept[1]['do'] === 'drop', 'proposals close in meaning are refused; others and drops pass');
expect(JackThought::clearOfStruck($ops, [], $near) === $ops, 'nothing is refused when nothing is struck');
expect(JackThought::clearOfStruck($ops, $struck, static fn (): ?float => null) === $ops, 'if meaning cannot be measured, proposals go on to the word check');
expect(count(JackThought::clearOfStruck([['do' => 'hold', 'text' => ['not', 'a', 'string']]], $struck, $near)) === 1, 'a malformed proposal does not crash the check');
$edge = static fn (float $score): int => count(JackThought::clearOfStruck([['do' => 'hold', 'text' => 'x']], $struck, static fn (): ?float => $score));
expect($edge(0.45) === 0 && $edge(0.44) === 1, 'the line sits at 0.45');

/* The visitors' meter. */
expect(JackThought::callsToday('2026-11-08 7', '2026-11-08') === 7, 'the meter reads today');
expect(JackThought::callsToday('2026-11-07 24', '2026-11-08') === 0, 'a new UTC day starts at zero');
expect(JackThought::callsToday('', '2026-11-08') === 0, 'an empty meter is zero');

/* A thought can leave him with something short of a conviction, or with nothing. */
[$same, $none] = JackThought::applyChanges($noHeld, [], 't', 1);
expect($same === $noHeld && $none === [], 'a thought may change nothing');
[$f, $d] = JackThought::applyChanges($noHeld, [['do' => 'prefer', 'text' => 'Handwritten shelf marks over printed ones, every time.'], ['do' => 'irk', 'text' => 'The way the Domesday disc outlived the machine that read it.'], ['do' => 'wonder', 'text' => 'Who was meant to read the 2029 transmission?']], 't', 1);
expect(array_column($f['felt'], 'kind') === ['preference', 'irritation', 'question'] && $f['holds'] === [], 'preferences, irritations and questions are kept beside beliefs, not as beliefs');
expect(array_column($d, 'did') === ['came to prefer', 'was irritated by', 'was left wondering'], 'each is recorded for what it is');
[$g, $d] = JackThought::applyChanges($f, [['do' => 'settle', 'id' => 'h3', 'why' => 'found out']], 't', 2);
expect(count($g['felt']) === 2 && $g['faded'][0]['why'] === 'found out' && $d[0]['did'] === 'let go of', 'one can be let go of, with a reason');
$many = $noHeld;
for ($i = 0; $i < 13; $i++) { [$many] = JackThought::applyChanges($many, [['do' => 'wonder', 'text' => "Unique question number word$i zebra$i quantum$i harbour$i"]], 't', $i); }
expect(count($many['felt']) === 12 && count($many['faded']) === 1 && str_contains($many['faded'][0]['text'], 'word0'), 'when he carries too many the oldest fades by itself, and nothing is refused');
[$k] = JackThought::applyChanges(['struck' => [['id' => 'h1', 'text' => 'Handwritten shelf marks over printed ones, every time.']]] + $noHeld, [['do' => 'prefer', 'text' => 'Handwritten shelf marks over printed ones, every time.']], 't', 1);
expect($k['felt'] === [], 'a struck idea cannot come back as a preference');

/* In conversation he is given the thoughts nearest what is being said. */
$book = [['id' => 'n', 'text' => 'Newest about tarot hoppers.'], ['id' => 'm', 'text' => 'Middle about pigeons.'], ['id' => 'd', 'text' => 'The Domesday laserdisc taught me something.'], ['id' => 'o', 'text' => 'Oldest about bridges.']];
$picked = array_column(JackThought::pickThoughts($book, 'What happened to the Domesday disc?', 1, 1), 'id');
expect($picked === ['d', 'n'], 'the nearest thought comes first, then the newest');
expect(array_column(JackThought::pickThoughts($book, 'hello', 3, 2), 'id') === ['n', 'm'], 'with nothing near, the newest come');
expect(JackThought::pickThoughts([], 'anything') === [], 'with no thoughts, none');

/* Graph inferences stay off until a keeper turns them on here on purpose. */
expect(JackThought::INFERENCES === false, 'graph inferences are switched off');

/* The doors. */
$src = (string) file_get_contents(dirname(__DIR__) . '/jack/think.php');
expect(str_contains($src, "JackPolicy::isKeeper(ttg_graph_viewer())") && str_contains($src, "think('pressed', \$keeper)"), 'the button decides by the server-side keeper check');
expect(!preg_match('/\$_(POST|GET|REQUEST)\[[\'"](keeper|may)/i', $src), 'the request cannot claim to be a keeper');
$cron = (string) file_get_contents(dirname(__DIR__) . '/scripts/jack-think.php');
expect(str_contains($cron, "think('alone')"), 'the schedule may still change what he holds');

echo ($fail === 0 ? "\nALL $pass PASSED\n" : "\n$fail FAILED, $pass passed\n");
exit($fail === 0 ? 0 : 1);
