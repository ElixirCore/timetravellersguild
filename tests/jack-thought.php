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
