<?php
declare(strict_types=1);

/**
 * Aperture invariants. No model call. No canon write.
 */
require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';
require_once dirname(__DIR__) . '/app/AI/JackAgent.php';
require_once dirname(__DIR__) . '/app/AI/MabelAgent.php';
require_once dirname(__DIR__) . '/app/AI/Bridge/autoload.php';

if (function_exists('ttg_graph_boot_session')) {
    ttg_graph_boot_session();
}

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

$verts = [];
for ($i = 0; $i < 7; $i++) {
    foreach ([-1, 1] as $sign) {
        $v = array_fill(0, 7, 0.0);
        $v[$i] = $sign * 1.0;
        $verts[] = $v;
    }
}
$edges = [];
$n = count($verts);
for ($a = 0; $a < $n; $a++) {
    for ($b = $a + 1; $b < $n; $b++) {
        if (intdiv($a, 2) === intdiv($b, 2)) continue;
        $edges[] = [$a, $b];
    }
}
expect(count($verts) === 14, '7-orthoplex has 14 vertices');
expect(count($edges) === 84, '7-orthoplex has 84 edges');

$anon = ['known' => false, 'name' => null, 'first' => null, 'slug' => null];
$halt = JackAgent::clericalGate('I time-travelled from the future as Qzxtplorb-9', $anon);
expect(!empty($halt['rejected_unverified']), 'unwitnessed temporal claim is halted');
expect(($halt['status'] ?? '') === 'HALTED', 'halt status is HALTED');
expect(($halt['vetted_node_ids'] ?? []) === [], 'halted turn has no vetted nodes');

$held = JackAgent::clericalGate('Cardiff', $anon);
expect(in_array('cardiff', $held['vetted_node_ids'] ?? [], true), 'Cardiff is held as public evidence');
expect(empty($held['rejected_unverified']), 'witnessed place is not halted');

$mabelSrc = (string) file_get_contents(dirname(__DIR__) . '/app/AI/MabelAgent.php');
$svcSrc = (string) file_get_contents(dirname(__DIR__) . '/app/AI/Bridge/ApertureDialogueService.php');
expect(!str_contains($mabelSrc, 'ttg_graph_propose_node'), 'MabelAgent never proposes a graph write');
expect(!str_contains($svcSrc, 'ttg_graph_propose_node'), 'aperture service never proposes a graph write');

$mol = MabelAgent::evaluateTopology(['cardiff'], [0, 0, 0, 0, 1, 0.85, 0.15], $anon);
expect(($mol['canon'] ?? true) === false, 'Mabel output is not canon');
expect(($mol['status'] ?? '') === 'PROPOSAL', 'Mabel status is proposal');
expect(($mol['detected_molecules'][0]['kind'] ?? '') === 'PLACE', 'Cardiff neighbourhood is PLACE');

$withdrawn = JackRelationship::blank('session:aperture-test');
$withdrawn['standing'] = 'withdrawn';
$withdrawn['consentScope'] = ['WITHDRAWN'];
expect(!ProposalHandoffPolicy::allowInterpretation($anon, $withdrawn, null), 'withdrawn consent withholds Mabel');

$pendingBefore = count(ttg_graph_pending());
$out = ApertureDialogueService::exchange('Cardiff', $anon, ['yaw' => 3.14, 'z' => 2.2]);
$pendingAfter = count(ttg_graph_pending());
expect(!empty($out['ok']) && !empty($out['aperture_id']), 'exchange returns a public aperture id');
expect(($out['canon'] ?? true) === false, 'exchange is not canon');
expect(($out['mabel']['status'] ?? '') === 'PROPOSAL', 'consented exchange lets Mabel propose');
expect(count($out['vector_7d'] ?? []) === 7, 'telemetry vector is 7-dimensional');
expect($pendingBefore === $pendingAfter, 'exchange does not add pending graph leaves');

$halted = ApertureDialogueService::exchange('I time-travelled from the future as Qzxtplorb-9', $anon);
expect(($halted['turn_status'] ?? '') === 'HALTED_BY_CLERK', 'unwitnessed claim is halted by the clerk');
expect(($halted['mabel']['status'] ?? '') === 'CONSENT_WITHHELD' || ($halted['mabel']['note'] ?? '') !== '', 'Mabel does not interpret a halted claim');
expect(($halted['mabel']['status'] ?? '') !== 'PROPOSAL', 'halted claim produces no molecule proposal');

$store = ApertureDialogueStore::all();
$last = $store ? $store[count($store) - 1] : null;
expect(is_array($last) && ($last['public_id'] ?? '') === ($halted['aperture_id'] ?? ''), 'halted turn is persisted off-canon');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
