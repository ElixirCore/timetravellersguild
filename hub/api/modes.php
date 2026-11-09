<?php
declare(strict_types=1);

/**
 * Live readout for the hub's Modes face. Jack runs the console from this.
 *
 * Read-only. Canon nodes and edges only (no pending slips). Picks rotate every
 * quarter hour so the console changes without becoming a feed. Posture is
 * JackMode::select() for this visitor at this hour: the same rule the desk uses.
 *
 * Loads the main graph helpers, not hub/inc/functions.php: the hub's
 * ttg_config() and the people module's ttg_config() share a name.
 */

require_once dirname(__DIR__, 2) . '/inc/graph.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackMode.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=60');
header('X-Content-Type-Options: nosniff');

date_default_timezone_set('Europe/London');
$now = time();
$seed = intdiv($now, 900);

$nodes = [];
foreach (ttg_graph_unique_nodes() as $n) {
    if (!ttg_graph_public($n) || !empty($n['pending'])) continue;
    $nodes[] = $n;
}
usort($nodes, static fn(array $a, array $b): int => strcmp((string) $a['slug'], (string) $b['slug']));
$edges = ttg_graph_edges();

/** Stable shuffle for this quarter hour. */
$pick = static function (array $list, string $salt) use ($seed): mixed {
    if (!$list) return null;
    $i = hexdec(substr(hash('sha256', $seed . '|' . $salt), 0, 8)) % count($list);
    return $list[$i];
};
$filing = static function (array $n, string $salt) use ($pick): ?array {
    $v = $pick(array_values(array_filter((array) ($n['voices'] ?? []), 'is_array')), $salt . $n['slug']);
    return $v ? ['voice' => (string) ($v['voice'] ?? ''), 'class' => (string) ($v['class'] ?? ''), 'text' => (string) ($v['text'] ?? '')] : null;
};
$card = static function (?array $n, string $salt, string $tag = '') use ($filing): ?array {
    if (!$n) return null;
    return [
        'title' => (string) ($n['title'] ?? ''),
        'href' => ttg_graph_canonical($n),
        'type' => ttg_graph_label_type((string) ($n['type'] ?? '')),
        'year' => ttg_graph_year($n),
        'layer' => ttg_graph_layer($n),
        'tag' => $tag,
        'filing' => $filing($n, $salt),
    ];
};
$ofType = static fn(array $types): array => array_values(array_filter($nodes, static fn(array $n): bool => in_array(strtoupper((string) ($n['type'] ?? '')), $types, true)));

// Layers and the newest canon leaf.
$layers = ['root' => 0, 'trunk' => 0, 'branch' => 0, 'leaf' => 0, 'fruit' => 0];
foreach ($nodes as $n) $layers[ttg_graph_layer($n)] = ($layers[ttg_graph_layer($n)] ?? 0) + 1;
$byConfirmed = $nodes;
usort($byConfirmed, static fn(array $a, array $b): int => strcmp(ttg_graph_meta($b, 'confirmed_at'), ttg_graph_meta($a, 'confirmed_at')));
$newest = ($byConfirmed[0] ?? null) && ttg_graph_meta($byConfirmed[0], 'confirmed_at') !== '' ? $byConfirmed[0] : null;

// Pattern mode: relationship types that recur (≥2), most frequent first.
$rels = [];
foreach ($edges as $e) {
    $r = (string) ($e['relationship'] ?? '');
    if ($r !== '') $rels[$r] = ($rels[$r] ?? 0) + 1;
}
arsort($rels);
$pattern = [];
foreach ($rels as $r => $c) {
    if ($c < 2) break;
    $pattern[] = ['rel' => str_replace('_', ' ', $r), 'count' => $c];
    if (count($pattern) >= 4) break;
}

// Five projections, each with one real node.
$dated = array_values(array_filter($nodes, static fn(array $n): bool => ttg_graph_year($n) > 0));
$symType = $pick(array_keys(array_count_values(array_map(static fn(array $n): string => strtoupper((string) $n['type']), $nodes))), 'symtype') ?? 'UNKNOWN';
$projections = [
    ['name' => 'TEMPORAL', 'line' => 'Time stood upright.', 'node' => $card($pick($dated, 'temporal'), 'temporal', 'year')],
    ['name' => 'SOCIAL', 'line' => 'Neighbourhoods along the bore.', 'node' => $card($pick($ofType(['PERSON']), 'social'), 'social')],
    ['name' => 'SPATIAL', 'line' => 'Places laid as meridians.', 'node' => $card($pick($ofType(['PLACE']), 'spatial'), 'spatial')],
    ['name' => 'INSTITUTIONAL', 'line' => 'Houses cut along the section.', 'node' => $card($pick($ofType(['INSTITUTION', 'DOCUMENT']), 'institutional'), 'institutional')],
    ['name' => 'SYMBOLIC', 'line' => 'Types set as meridians: ' . ttg_graph_label_type($symType) . ', ' . count($ofType([$symType])) . ' held.', 'node' => $card($pick($ofType([$symType]), 'symbolic'), 'symbolic')],
];

// VIEW: a short deterministic tour, each stop with one filing.
$tour = [];
$pool = array_values(array_filter($nodes, static fn(array $n): bool => !empty($n['voices'])));
for ($i = 0; $i < 6 && $pool; $i++) {
    $n = $pick($pool, 'tour' . $i);
    $pool = array_values(array_filter($pool, static fn(array $m): bool => $m['slug'] !== $n['slug']));
    $tour[] = $card($n, 'tour' . $i);
}

// Jack's posture toward whoever is reading.
$viewer = ttg_graph_viewer();
$hour = (int) date('G', $now);
$posture = JackMode::select($viewer, [], '', ['hour' => $hour]);
$postureLines = [
    'reception' => 'Reception. A stranger at the desk is welcome and owes nothing.',
    'clerk' => 'Clerk. A known traveller; the drawers are open.',
    'after_hours' => 'After hours. The lamp is on. Answers are shorter and kinder.',
    'bartime' => 'Bartime. Off the record, still on the premises.',
    'incident' => 'Incident. Plain language only.',
    'contested_record' => 'Contested record. Both accounts held.',
    'private_holding' => 'Private holding. Nothing lodged.',
];

$payload = [
    'ok' => true,
    'generated' => gmdate('c', $now),
    'local' => date('H:i', $now),
    'next_turn' => ($seed + 1) * 900 - $now,
    'now' => [
        'canon' => count($nodes),
        'edges' => count($edges),
        'pending' => count(ttg_graph_pending()),
        'newest' => $card($newest, 'newest'),
    ],
    'projections' => $projections,
    'pattern' => $pattern,
    'tour' => array_values(array_filter($tour)),
    'jack' => [
        'posture' => $posture,
        'line' => $postureLines[$posture] ?? '',
        'known' => !empty($viewer['known']),
        'postures' => array_keys($postureLines),
    ],
    'boot' => ['layers' => $layers],
];
echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
