<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/jack/puzzle/lib.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) {
        $pass++;
        echo "PASS $name\n";
    } else {
        $fail++;
        echo "FAIL $name\n";
    }
}

$map = ttg_hollerith_map();
expect($map['A'] === [12, 1], 'A is 12+1');
expect($map['J'] === [11, 1], 'J is 11+1');
expect($map['S'] === [0, 2], 'S is 0+2');
expect($map['K'] === [11, 2], 'K is 11+2');
expect($map['1'] === [1], 'digit 1 is row 1 only');

$msg = 'ASK WHAT ENTERED THE FIELD';
$cols = ttg_hollerith_columns($msg);
expect(ttg_hollerith_decode($cols) === $msg, 'round-trip field card');
expect($cols[0] === [12, 1] && $cols[1] === [0, 2] && $cols[2] === [11, 2], 'ASK columns');
expect($cols[3] === [], 'space after ASK is blank');

$holes = 0;
foreach ($cols as $c) $holes += count($c);
expect($holes > 0, 'field card has punches');
$svg = ttg_hollerith_svg($msg, 'test', 80, false);
expect(substr_count($svg, 'class="hole"') === $holes, 'svg holes equal encoding');
expect(!str_contains($svg, $msg), 'field svg does not print the plaintext');
expect(ttg_hollerith_decode(ttg_hollerith_columns('JACK 1951')) === 'JACK 1951', 'round-trip example card');
$ex = ttg_hollerith_svg('JACK 1951', 'example', 40, true);
expect(str_contains($ex, 'print-lab'), 'example card prints letters');

expect(ttg_puzzle_ok('01', 'ask what entered the field'), 'p1 accepts case fold');
expect(ttg_puzzle_ok('02', 'Witness'), 'p2');
expect(ttg_puzzle_ok('03', 'trust'), 'p3');
expect(ttg_puzzle_ok('04', 'agency'), 'p4');
expect(ttg_puzzle_ok('05', '2,418'), 'p5 strips commas');
expect(ttg_puzzle_ok('06', '334'), 'p6');
expect(ttg_puzzle_ok('07', 'kindness'), 'p7');
expect(!ttg_puzzle_ok('03', 'TRUTS'), 'wrong order fails');
expect(!ttg_puzzle_ok('06', '333'), 'floor warehouses fail');

$from = new DateTimeImmutable('2026-09-03');
$to = new DateTimeImmutable('2033-04-17');
expect((int) $from->diff($to)->format('%a') === 2418, 'calendar 2418');

$cards = intdiv(1_000_000_000 * 10 + 2, 3);
expect($cards === 3333333334, 'ceil cards 3333333334');
expect((int) ceil($cards / 10_000_000) === 334, 'ceil warehouses 334');

$card = ttg_puzzle_card_text();
expect(hash_equals(ttg_puzzle_hashes()['card'], hash('sha256', $card)), 'card hash');
expect(ttg_puzzle_stamp($card) === strtoupper(substr(hash('sha256', $card), 0, 12)), 'stamp is first 12 hex');

echo $fail === 0 ? "OK $pass passed\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
