<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
ttg_graph_boot_session();

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$svg = file_get_contents(dirname(__DIR__) . '/jack/tarot/svg/deck.svg') ?: '';
$guild = ttg_graph_standing(['slug' => 'guild', 'type' => 'INSTITUTION', 'title' => 'The Time Travellers Guild']);
expect($guild['glyph'] === 'glyph-21-graph' && $guild['roman'] === 'XXI', 'guild files as the canonical graph');
$jack = ttg_graph_standing(['slug' => 'jacks-cube', 'type' => 'PLACE', 'title' => "Jack's Cube"]);
expect($jack['glyph'] === 'glyph-09-jack', 'Jack’s cube files as Jack at the desk');
$station = ttg_graph_standing(['slug' => 'station-xiii', 'type' => 'PLACE', 'title' => 'Station XIII']);
expect($station['glyph'] === 'glyph-13-station13', 'Station XIII files as XIII');
$unknown = ttg_graph_standing(['slug' => 'loose', 'type' => 'UNKNOWN', 'title' => 'Loose']);
expect($unknown['glyph'] === 'glyph-00-unclassified', 'unknown files as the unclassified node');
$doc = ttg_graph_standing(['slug' => 'a-dossier', 'type' => 'DOCUMENT', 'title' => 'A dossier']);
expect($doc['glyph'] === 'glyph-04-ledger', 'documents file as the ledger');
expect(str_contains($svg, 'id="' . $guild['glyph'] . '"') && str_contains($svg, 'id="' . $unknown['glyph'] . '"'), 'standing glyphs exist on the 5081 sheet');

$pending = [[
    'public_id' => '01TTGTESTPENDING000000001',
    'type' => 'DOCUMENT',
    'slug' => 'pending-test-slip',
    'title' => 'Test slip',
    'body' => 'Observation held exactly.',
    'visibility' => 'PUBLIC',
    'status' => 'PENDING',
    'pending' => true,
    'ip_hash' => 'secret',
    'metadata' => ['place' => 'unplaced', 'custodian' => 'jack'],
    'tree' => ['layer' => 'leaf', 'year' => 2026],
]];
$canon = [[
    'public_id' => '01TTGTESTCANON0000000001',
    'type' => 'PLACE',
    'slug' => 'test-place',
    'title' => 'Test place',
    'body' => 'Already canon.',
    'visibility' => 'PUBLIC',
    'status' => 'ACTIVE',
]];
$pendingEdges = [[
    'public_id' => '01TTGETEST1',
    'source' => 'pending-test-slip',
    'target' => 'test-place',
    'relationship' => 'OBSERVED_AT',
    'pending' => true,
]];
$canonEdges = [];

$applied = ttg_graph_confirm_apply($pending, $canon, $pendingEdges, $canonEdges, 'pending-test-slip', [
    'at' => '2026-09-06T13:00:00+00:00',
    'by' => 'tobywhy',
]);
expect(!empty($applied['ok']), 'confirm apply succeeds');
expect(count($applied['pending']) === 0, 'pending hopper is emptied');
expect(count($applied['canon']) === 2, 'canon gains the slip');
$written = $applied['node'] ?? [];
expect(($written['body'] ?? '') === 'Observation held exactly.', 'observation is not rewritten');
expect(empty($written['pending']) && ($written['status'] ?? '') === 'ACTIVE', 'confirmed slip is no longer pending');
expect(!isset($written['ip_hash']), 'ip hash is not promoted');
expect(($written['metadata']['classification'] ?? '') === 'canon', 'classification becomes canon');
expect(!empty($written['metadata']['irreversible']), 'a canon punch is marked irreversible');
expect(count($applied['promoted_edges']) === 1 && empty($applied['pending_edges']), 'pending edge promotes when both ends are canon');

$held = ttg_graph_confirm_apply($pending, $canon, $pendingEdges, $canonEdges, 'missing-slip');
expect(empty($held['ok']), 'missing slip is not confirmed');

$stillPendingEdge = [[
    'public_id' => '01TTGETEST2',
    'source' => 'pending-test-slip',
    'target' => 'still-pending-other',
    'relationship' => 'POSSIBLY_RELATED_TO',
    'pending' => true,
]];
$partial = ttg_graph_confirm_apply($pending, $canon, $stillPendingEdge, [], 'pending-test-slip');
expect($partial['ok'] && count($partial['pending_edges']) === 1 && count($partial['promoted_edges']) === 0, 'edge stays pending if the other end is not canon');

$rejected = ttg_graph_reject_apply($pending, $pendingEdges, 'pending-test-slip');
expect(!empty($rejected['ok']) && count($rejected['pending']) === 0 && count($rejected['pending_edges']) === 0, 'return removes the slip and its pending edges');

$tmp = sys_get_temp_dir() . '/ttg-nav-' . bin2hex(random_bytes(4));
mkdir($tmp, 0775, true);
file_put_contents($tmp . '/nodes.json', json_encode($canon, JSON_PRETTY_PRINT));
file_put_contents($tmp . '/edges.json', "[]\n");
file_put_contents($tmp . '/pending.json', json_encode($pending, JSON_PRETTY_PRINT));
file_put_contents($tmp . '/pending-edges.json', json_encode($pendingEdges, JSON_PRETTY_PRINT));
ttg_graph_root($tmp);
$denied = ttg_graph_confirm_pending('pending-test-slip', ['known' => false, 'slug' => null, 'name' => null]);
expect(empty($denied['ok']), 'anonymous visitor cannot write canon');
$still = json_decode((string) file_get_contents($tmp . '/pending.json'), true);
expect(is_array($still) && count($still) === 1, 'denied confirm does not empty the hopper');
$livePending = json_decode((string) file_get_contents(dirname(__DIR__) . '/graph/pending.json'), true);
expect(is_array($livePending), 'live pending graph was not replaced by the test root');

$field = ttg_graph_navigator_field(['known' => false, 'slug' => null, 'name' => null, 'first' => null]);
expect(isset($field['nodes'], $field['edges'], $field['viewer'], $field['csrf'], $field['punches'], $field['punch_tip'], $field['on_tape']), 'navigator field has nodes, edges, viewer, csrf, punch tape');
expect(empty($field['viewer']['keeper']), 'anonymous field is not keeper-gated open');
$haveStanding = true;
foreach ($field['nodes'] as $n) {
    if (empty($n['standing']['glyph'])) $haveStanding = false;
}
expect($haveStanding && count($field['nodes']) >= 1, 'every projected node carries a standing glyph');

$whoToby = [
    'known' => true,
    'keeper' => true,
    'slug' => 'tobywhy',
    'name' => 'Toby',
    'actor' => 'tobywhy',
    'href' => '/people/profile/',
];
$unsigned = ttg_graph_punch_who(['known' => false, 'slug' => null, 'name' => null, 'first' => null]);
expect(str_starts_with($unsigned['actor'], 'unsigned:'), 'unsigned presence is session-bound, not an address');
$a = ttg_graph_punch_append([
    'action' => 'LOOK',
    'actor' => 'tobywhy',
    'who' => $whoToby,
    'slug' => 'guild',
    'public_id' => '01TTGTESTCANON0000000001',
    'type' => 'INSTITUTION',
    'title' => 'The Time Travellers Guild',
    'standing' => 'THE CANONICAL GRAPH',
    'detail' => 'look',
    'at' => '2026-09-06T14:00:00+00:00',
    'body' => 'Observation held exactly.',
]);
$b = ttg_graph_punch_append([
    'action' => 'WRITE_CANON',
    'actor' => 'tobywhy',
    'slug' => 'pending-test-slip',
    'title' => 'Test slip',
    'body' => 'Observation held exactly.',
    'detail' => 'irreversible',
    'at' => '2026-09-06T14:00:01+00:00',
]);
expect(is_array($a) && is_array($b), 'punch tape accepts cards');
expect(($a['hash'] ?? '') !== '' && strlen((string) $a['hash']) === 64, 'a punch hash is SHA-256');
expect(($b['prev'] ?? '') === ($a['hash'] ?? ''), 'each punch names the previous hash');
expect(($a['body_hash'] ?? '') === hash('sha256', 'Observation held exactly.'), 'body hash commits the observation');
expect(ttg_graph_punch_verify([$a, $b]), 'the tape verifies as a hash chain');
expect(($a['who']['name'] ?? '') === 'Toby' && !empty($a['who']['keeper']), 'a punch names who is logged in');
$onTape = ttg_graph_punch_present();
$onNames = array_map(static fn ($p) => (string) ($p['actor'] ?? ''), $onTape);
expect(in_array('tobywhy', $onNames, true), 'the tape lists who is present from recent punches');
$tampered = $b;
$tampered['title'] = 'rewritten';
expect(!ttg_graph_punch_verify([$a, $tampered]), 'a rewritten punch fails the chain');
$again = ttg_graph_confirm_apply($pending, $applied['canon'], [], [], 'pending-test-slip');
expect(empty($again['ok']), 'a punched slip cannot be written twice');

foreach (glob($tmp . '/*') ?: [] as $f) @unlink($f);
@rmdir($tmp);
ttg_graph_root(dirname(__DIR__) . '/graph');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
