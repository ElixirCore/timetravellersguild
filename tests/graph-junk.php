<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

expect(ttg_graph_is_junk_slip('https://mobile.facebook.com/dating?al_applink_data=%7B%22x%22%7D'), 'a Facebook Dating deep link is junk');
expect(ttg_graph_is_junk_slip('Facebook Dating link', 'A mobile Facebook Dating link containing encoded app-link metadata was supplied in the dossier.'), 'an extracted Facebook Dating leaf is junk');
expect(ttg_graph_is_junk_slip('ElixirCorp:stayhukan!'), 'a password-shaped title is junk');
expect(ttg_graph_is_junk_slip('WORTH MORE THAN MONEY — PRIVATE KEY', 'A dossier was lodged with the clerk.'), 'a private-key paste is junk');
expect(!ttg_graph_is_junk_slip('Bute Street', 'On Bute Street, Cardiff, a paper cup sat on a windowsill after rain.'), 'a field note is not junk');
expect(!ttg_graph_is_junk_slip('The Time Travellers Guild'), 'the Guild is not junk');
expect(!ttg_graph_is_junk_slip('Hi. I\'m Nic'), 'ordinary testimony is not junk');

$refused = ttg_graph_propose_node([
    'title' => 'https://mobile.facebook.com/dating?al_applink_data=x',
    'type' => 'DOCUMENT',
    'body' => 'tracking',
]);
expect(empty($refused['ok']), 'propose_node refuses a dating link');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
