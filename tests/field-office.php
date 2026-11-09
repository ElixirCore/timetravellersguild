<?php
declare(strict_types=1);
/* Field Office: renders the public page, the desk (every view and action) and the supplier page from the CLI.
 * Uses a throwaway database copy; run: php tests/field-office.php */
putenv('TTG_FO_TEST_STAFF=1');
$root = dirname(__DIR__);
$store = $root . '/storage/fieldoffice';
$backup = is_dir($store) ? $store . '.bak-' . getmypid() : null;
if ($backup) rename($store, $backup);
$pass = 0; $fail = 0;
$ok = function (bool $c, string $what) use (&$pass, &$fail) { echo ($c ? 'PASS ' : 'FAIL ') . $what . "\n"; $c ? $pass++ : $fail++; };
/** Render a page in a child PHP process with the given request. */
$render = function (string $file, array $get = [], array $post = [], string $method = 'GET') use ($root): string {
    $boot = '$_GET=' . var_export($get, true) . ';$_POST=' . var_export($post, true) . ';$_SERVER["REQUEST_METHOD"]="' . $method . '";$_SERVER["REQUEST_URI"]="/";'
        . 'require_once "' . $root . '/inc/graph.php";ttg_graph_boot_session();if($_POST)$_POST["csrf"]=ttg_graph_csrf();'
        . 'chdir("' . dirname($root . '/' . $file) . '");require "' . $root . '/' . $file . '";';
    $cmd = 'TTG_FO_TEST_STAFF=1 php -d display_errors=1 -d error_reporting=-1 -d session.save_path=' . escapeshellarg(sys_get_temp_dir()) . ' -r ' . escapeshellarg($boot) . ' 2>&1';
    return (string) shell_exec($cmd);
};
try {
    $pub = $render('field-office/index.php');
    $ok(str_contains($pub, 'If Thursday Fails') && str_contains($pub, 'Proposed · venue pending') && !preg_match('/(Warning|Notice|Fatal|Deprecated)/', $pub), 'public page renders cleanly');
    $desk = $render('field-office/desk/index.php');
    $ok(str_contains($desk, 'staff desk') && substr_count($desk, '?s=thursday-') >= 6 && !preg_match('/(Warning|Notice|Fatal|Deprecated)/', $desk), 'desk lists six sessions cleanly');
    $one = $render('field-office/desk/index.php', ['s' => 'thursday-2']);
    $ok(str_contains($one, 'Session record') && str_contains($one, 'If Thursday fails: move this session') && !preg_match('/(Warning|Notice|Fatal|Deprecated)/', $one), 'desk session view renders cleanly');
    $clean = static fn (string $html) => !preg_match('/(Warning|Notice|Fatal|Deprecated)/', $html);
    $r = $render('field-office/desk/index.php', [], ['s' => 'thursday-2', 'do' => 'save', 'venue_name' => 'Bute room 1.04', 'venue_address' => 'Cardiff', 'keyholder' => 'Elin', 'fallback' => "Cathays Library\nFairoak Rd"], 'POST');
    $ok(str_contains($r, 'Saved.') && $clean($r), 'desk save');
    $r = $render('field-office/desk/index.php', [], ['s' => 'thursday-2', 'do' => 'confirm'], 'POST');
    $ok(str_contains($r, 'Not published') && str_contains($r, 'funding approval') && $clean($r), 'desk refuses Confirmed without funding approval');
    $r = $render('field-office/desk/index.php', [], ['s' => 'thursday-2', 'do' => 'confirm', 'funding' => 'approved', 'booking' => 'booked', 'starts_at' => '2027-05-13T18:00', 'arrival_en' => 'Side door'], 'POST');
    $ok(str_contains($r, 'Published as Confirmed') && $clean($r), 'desk publishes Confirmed once approved and booked');
    $r = $render('field-office/desk/index.php', [], ['s' => 'thursday-2', 'do' => 'move', 'venue_name' => 'Cathays Library', 'venue_address' => 'Fairoak Rd'], 'POST');
    $ok(str_contains($r, 'Not moved') && str_contains($r, 'instruction about the original room'), 'desk refuses a move without an instruction about the original room');
    $r = $render('field-office/desk/index.php', [], ['s' => 'thursday-2', 'do' => 'move', 'venue_name' => 'Cathays Library', 'venue_address' => 'Fairoak Rd', 'original_note_en' => 'Bute is locked tonight.'], 'POST');
    $ok(str_contains($r, 'Moved. The public page now shows Moved') && $clean($r), 'desk moves the session');
    $pubS = $render('field-office/index.php', ['s' => 'thursday-2']);
    $ok(str_contains($pubS, '>Moved<') && str_contains($pubS, 'Do not go to the original room') && str_contains($pubS, 'Bute room 1.04') && str_contains($pubS, 'Cathays Library') && !str_contains($pubS, 'Elin'), 'public page shows Moved, both rooms, never the keyholder');
    $sheet = $render('field-office/desk/index.php', ['sheet' => 'thursday-2']);
    $ok(str_contains($sheet, "host's sheet") && str_contains($sheet, 'Walk-ins') && str_contains($sheet, 'Elin') && $clean($sheet), 'printable sheet');
    $r = $render('field-office/desk/index.php', [], ['s' => 'thursday-2', 'do' => 'supplier_link'], 'POST');
    preg_match('#quote/\?t=([A-Za-z0-9_-]+)#', $r, $m);
    $ok(!empty($m[1]), 'supplier link made');
    $q = $render('field-office/quote/index.php', ['t' => $m[1] ?? 'x']);
    $ok(str_contains($q, 'Thursday 2') && !str_contains($q, 'Elin') && !str_contains($q, '@') && $clean($q), 'supplier page shows the session, no staff or participant details');
    $q = $render('field-office/quote/index.php', [], ['t' => $m[1] ?? 'x', 'supplier' => 'Hall Co', 'amount' => '£120', 'access_details' => 'Step-free via side'], 'POST');
    $ok(str_contains($q, 'gone to the producer'), 'supplier sends a quote');
    $d = $render('field-office/desk/index.php', ['s' => 'thursday-2']);
    $ok(str_contains($d, 'Hall Co') && str_contains($d, '£120'), 'quote reaches the desk');
    $ok(str_contains($render('field-office/quote/index.php', ['t' => 'nope']), 'not active'), 'unknown supplier link refused');
} finally {
    shell_exec('rm -rf ' . escapeshellarg($store));
    if ($backup) rename($backup, $store);
}
echo "\n$pass passed, $fail failed\n";
