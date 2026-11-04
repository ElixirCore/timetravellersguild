<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/AI/JackAgent.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackRuntime.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';
require_once dirname(__DIR__) . '/app/AI/JackDisturbance.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$agent = (string) file_get_contents(dirname(__DIR__) . '/app/AI/JackAgent.php');
expect(str_contains($agent, 'searchTokens') && str_contains($agent, 'str_contains($q, $titleL)'), 'graph search matches titles inside a question');

$mabel = JackAgent::searchGraph('Who is Mabel?');
expect($mabel !== [] && strtolower((string) ($mabel[0]['title'] ?? '')) === 'mabel', 'Who is Mabel? finds Mabel');

$swan = JackAgent::searchGraph('What is the Black Swan?');
$swanTitles = array_map(static fn ($h) => strtolower((string) ($h['title'] ?? '')), $swan);
expect(in_array('black swan', $swanTitles, true), 'What is the Black Swan? finds the Black Swan record');

$node = ttg_graph_node('pending-black-swan-3f2787');
expect(is_array($node) && ($node['title'] ?? '') === 'Black Swan', 'Black Swan is on file in nodes.json');

$runtime = JackRuntime::build(
    ['relationship' => JackRelationship::blank('session:search-test'), 'mode' => 'reception'],
    ['known' => false, 'name' => null, 'first' => null, 'slug' => null],
    'Tell me about the Black Swan',
    ['site' => 'jack']
);
expect(str_contains($runtime, 'Black Swan') && str_contains($runtime, 'BLACK SWAN IMMINENT'), 'Jack runtime surfaces the Black Swan body');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
