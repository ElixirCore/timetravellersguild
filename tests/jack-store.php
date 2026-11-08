<?php
declare(strict_types=1);

/**
 * Jack's records survive crashes and damage. Works only in a temporary folder. No model call. No secrets.
 */
require_once dirname(__DIR__) . '/app/AI/JackStore.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $label): void
{
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $label\n"; }
    else { $fail++; echo "FAIL $label\n"; }
}

ini_set('error_log', '/dev/null'); // the refusals below are expected
$dir = sys_get_temp_dir() . '/ttg-jack-store-' . bin2hex(random_bytes(4));
mkdir($dir);
$file = "$dir/book.json";

expect(JackStore::read($file) === [], 'a file not yet written reads as empty');
expect(JackStore::saveJson($file, ['a' => 1]) && JackStore::read($file) === ['a' => 1], 'a saved file reads back');
chmod($file, 0640);
JackStore::saveJson($file, ['a' => 2]);
expect((fileperms($file) & 0777) === 0640, 'a replacement keeps the permissions of the original');
expect(glob("$dir/*.tmp") === [], 'no temporary file is left after a save');

/* A crash before the swap: a half-written temporary file exists, the book does not change. */
file_put_contents("$file.deadbeef.tmp", '{"half');
expect(JackStore::read($file) === ['a' => 2], 'a half-written copy from a crash does not touch the book');
unlink("$file.deadbeef.tmp");

/* A save that fails leaves the original alone. */
$blocked = "$dir/blocked.json";
mkdir($blocked); // a folder cannot be replaced by a file, so the swap must fail
expect(JackStore::replace($blocked, 'x') === false && is_dir($blocked), 'a failed swap reports failure and changes nothing');
expect(glob("$dir/*.tmp") === [], 'a failed swap cleans up after itself');

/* Damage is refused, not treated as empty. */
$bad = "$dir/bad.json";
file_put_contents($bad, '[{"userId":"user:one"');
expect(JackStore::read($bad) === null, 'a damaged file reads as unreadable, not empty');
$ran = JackStore::locked($bad, static function () use ($bad): string {
    if (JackStore::read($bad) === null) return 'refused';
    JackStore::saveJson($bad, []);
    return 'wrote';
});
expect($ran === 'refused' && file_get_contents($bad) === '[{"userId":"user:one"', 'a damaged file is left byte for byte');
file_put_contents("$dir/scalar.json", '7');
expect(JackStore::read("$dir/scalar.json") === null, 'valid JSON of the wrong shape is refused too');
file_put_contents("$dir/empty.json", '');
expect(JackStore::read("$dir/empty.json") === [], 'an empty file reads as not yet written');

/* The lock survives the file being swapped: many processes, no lost update, no reader ever sees a broken file. */
if (function_exists('proc_open')) {
    $counter = "$dir/counter.json";
    JackStore::saveJson($counter, ['n' => 0]);
    $child = "$dir/child.php";
    file_put_contents($child, '<?php require ' . var_export(dirname(__DIR__) . '/app/AI/JackStore.php', true) . '; $f = $argv[1]; $broken = 0;
        for ($i = 0; $i < 60; $i++) {
            if (JackStore::read($f) === null) $broken++;
            JackStore::locked($f, static function () use ($f) { $d = JackStore::read($f); $d["n"]++; JackStore::saveJson($f, $d); });
        }
        echo $broken;');
    $procs = [];
    for ($p = 0; $p < 6; $p++) {
        $procs[] = proc_open([PHP_BINARY, '-d', 'error_log=/dev/null', $child, $counter], [1 => ['pipe', 'w']], $pipes);
        $outs[] = $pipes[1];
    }
    $broken = 0;
    foreach ($outs as $o) $broken += (int) stream_get_contents($o);
    foreach ($procs as $pr) proc_close($pr);
    expect((JackStore::read($counter)['n'] ?? 0) === 360, 'six writers at once lose no update');
    expect($broken === 0, 'a reader never sees a half-written file');
} else {
    echo "SKIP concurrent writers (proc_open is disabled here)\n";
}

/* The stores use it. */
$root = dirname(__DIR__) . '/app/AI/';
foreach (['JackThought', 'JackMind', 'JackRelationship', 'JackMemory'] as $store) {
    $src = (string) file_get_contents($root . $store . '.php');
    // $lock is the thinking lock's own retry timestamp, which holds no records.
    expect(str_contains($src, 'JackStore::') && !preg_match('/ftruncate\(\$(?!lock\b)/', $src), "$store saves only through JackStore");
}

array_map('unlink', array_filter(glob("$dir/{,.}*", GLOB_BRACE) ?: [], 'is_file'));
rmdir($blocked);
rmdir($dir);

echo ($fail === 0 ? "\nALL $pass PASSED\n" : "\n$fail FAILED, $pass passed\n");
exit($fail === 0 ? 0 : 1);
