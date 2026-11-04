<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/inc/graph.php';
require_once __DIR__ . '/emergy.php';

function ttg_machine_parse_time(?string $raw): string
{
    $raw = trim((string) $raw);
    if ($raw === '') {
        return gmdate('c');
    }
    $raw = str_replace(' ', 'T', $raw);
    try {
        $dt = new DateTimeImmutable($raw);
        return $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    } catch (Throwable $e) {
        return gmdate('c');
    }
}

function ttg_machine_parse_float($v, float $default, float $lo, float $hi): float
{
    if ($v === null || $v === '') return $default;
    if (!is_numeric($v)) return $default;
    return ttg_machine_clamp((float) $v, $lo, $hi);
}

/** Deterministic 96-bit punch pattern as hex. */
function ttg_machine_encode_holes(string $publicId, string $type, string $observedAt): string
{
    $src = $publicId . '|' . $type . '|' . $observedAt;
    return substr(hash('sha256', $src), 0, 24);
}

function ttg_machine_matter_weight(array $node, array $weights): float
{
    if (!empty($node['pending'])) {
        return (float) ($weights['pending'] ?? 0.6);
    }
    $type = strtoupper((string) ($node['type'] ?? 'UNKNOWN'));
    if (isset($weights[$type])) {
        return (float) $weights[$type];
    }
    $status = strtoupper((string) ($node['status'] ?? ''));
    if ($status === 'ACTIVE' || $status === 'COMPLETED' || $status === 'CANON') {
        return (float) ($weights['canon'] ?? 1.0);
    }
    return (float) ($weights['default'] ?? 0.5);
}

/**
 * Mind coherence proxy: focus neighbourhood connectivity, scaled by field size.
 */
function ttg_machine_mind_base(string $focus, int $activeCount, int $target = 12): float
{
    $coherence = 0.35;
    if ($focus !== '') {
        $n = ttg_graph_node($focus);
        if ($n && ttg_graph_public($n)) {
            $nb = ttg_graph_neighbors($focus);
            $deg = count($nb['outgoing'] ?? []) + count($nb['incoming'] ?? []);
            $coherence = ttg_machine_clamp(0.25 + min($deg, 16) / 20.0, 0.2, 0.95);
        }
    } elseif ($activeCount > 0) {
        $coherence = ttg_machine_clamp(0.3 + min($activeCount, $target) / ($target * 2.0), 0.2, 0.85);
    }
    $scale = min($activeCount / max($target, 1), 1.0);
    return ttg_machine_clamp($coherence * max($scale, 0.15), 0.05, 1.0);
}

/** @param list<array<string,mixed>> $cards */
function ttg_machine_matter_base(array $cards, array $weights): float
{
    if ($cards === []) return 0.15;
    $sum = 0.0;
    $n = 0;
    foreach ($cards as $c) {
        if (!empty($c['beyond'])) continue;
        $sum += ttg_machine_matter_weight($c, $weights);
        $n++;
    }
    if ($n < 1) return 0.12;
    return ttg_machine_clamp($sum / $n, 0.05, 1.0);
}

function ttg_machine_delta_context(string $machinePresent, string $focus, string $dcAxis): float
{
    return ttg_machine_delta_context_parts($machinePresent, $focus, $dcAxis)['total'];
}

/**
 * ΔC with its five axis components and weights, for the radar instrument.
 * @return array{total:float,axes:array<string,float>,weights:array<string,float>}
 */
function ttg_machine_delta_context_parts(string $machinePresent, string $focus, string $dcAxis): array
{
    $cfg = ttg_machine_config();
    $network = (string) ($cfg['network_present'] ?? '2033-04-17T00:00:00Z');
    $tMachine = strtotime($machinePresent);
    if ($tMachine === false) $tMachine = time();
    $tNetwork = strtotime($network) ?: $tMachine;
    $tLocal = time();
    $years = abs($tMachine - $tLocal) / (365.25 * 24 * 3600);
    $temporal = ttg_machine_clamp($years / 80.0, 0.0, 1.0);

    $spatial = 0.2;
    $social = 0.15;
    $institutional = 0.15;
    $symbolic = 0.2;

    if ($focus !== '') {
        $node = ttg_graph_node($focus);
        if (is_array($node) && ttg_graph_public($node)) {
            $type = strtoupper((string) ($node['type'] ?? ''));
            $place = ttg_graph_meta($node, 'place');
            if ($place !== '' || $type === 'PLACE') $spatial = 0.55;
            if ($type === 'PERSON') $social = 0.6;
            if ($type === 'INSTITUTION') $institutional = 0.65;
            if (in_array($type, ['SIGNAL', 'UNKNOWN', 'MOONLY'], true)) $symbolic = 0.55;
            $obs = strtotime((string) ($node['observed_at'] ?? ''));
            if ($obs === false) $obs = $tMachine;
            $temporal = ttg_machine_clamp(
                (abs($obs - $tMachine) / (365.25 * 24 * 3600)) / 40.0,
                0.0,
                1.0
            );
        }
    }

    $axis = strtoupper($dcAxis);
    $w = ['TIME' => 0.2, 'PLACE' => 0.2, 'PEOPLE' => 0.2, 'INSTITUTIONS' => 0.2, 'SYMBOLS' => 0.2];
    if (isset($w[$axis])) {
        foreach ($w as $k => $_) {
            $w[$k] = $k === $axis ? 0.45 : 0.1375;
        }
    }

    $axesVals = [
        'TIME' => $temporal,
        'PLACE' => $spatial,
        'PEOPLE' => $social,
        'INSTITUTIONS' => $institutional,
        'SYMBOLS' => $symbolic,
    ];
    $total = 0.0;
    foreach ($axesVals as $k => $v) $total += $w[$k] * $v;
    return [
        'total' => ttg_machine_clamp($total, 0.0, 1.0),
        'axes' => array_map(static fn ($v) => round($v, 4), $axesVals),
        'weights' => array_map(static fn ($v) => round($v, 4), $w),
    ];
}

/** @return list<array<string,mixed>> */
function ttg_machine_feed_items(int $cap): array
{
    $pdo = function_exists('ttg_feed_db') ? ttg_feed_db() : null;
    if (!$pdo) return [];
    try {
        $rows = $pdo->query('
            SELECT id, filename, created_at, analysis_json
            FROM images
            WHERE analysed_at IS NOT NULL
            ORDER BY id DESC
            LIMIT ' . (int) max(1, min($cap, 40)) . '
        ')->fetchAll();
    } catch (Throwable $e) {
        return [];
    }
    if (!is_array($rows)) return [];
    $out = [];
    foreach ($rows as $row) {
        $a = function_exists('ttg_feed_analysis') ? ttg_feed_analysis($row) : [];
        $standing = function_exists('ttg_feed_standing') ? ttg_feed_standing($a) : 'held';
        $fn = (string) ($row['filename'] ?? '');
        $out[] = [
            'id' => (int) ($row['id'] ?? 0),
            'src' => $fn !== '' ? '/feed/images/' . rawurlencode($fn) : '',
            'caption' => (string) ($a['caption'] ?? ''),
            'standing' => $standing,
            'jack' => (string) ($a['jack'] ?? ''),
        ];
    }
    return $out;
}

/**
 * @param array<string,mixed> $query
 * @return array<string,mixed>
 */
function ttg_machine_build_state(array $query = []): array
{
    $cfg = ttg_machine_config();
    $viewer = ttg_graph_viewer();
    $personEdges = ttg_graph_person_edge_set($viewer);

    $kappa = ttg_machine_parse_float(
        $query['k'] ?? $query['kappa'] ?? null,
        (float) $cfg['kappa_default'],
        (float) $cfg['kappa_min'],
        (float) $cfg['kappa_max']
    );
    $mindKnob = ttg_machine_parse_float(
        $query['mind'] ?? null,
        (float) $cfg['mind_default'],
        0.001,
        1.0
    );
    $matterKnob = ttg_machine_parse_float(
        $query['matter'] ?? null,
        (float) $cfg['matter_default'],
        0.001,
        1.0
    );
    $machinePresent = ttg_machine_parse_time(isset($query['t']) ? (string) $query['t'] : null);
    $focus = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($query['focus'] ?? '')) ?? '';
    $dcAxis = strtoupper(trim((string) ($query['dc'] ?? 'TIME')));
    $axes = $cfg['dc_axes'] ?? ['TIME'];
    if (!in_array($dcAxis, $axes, true)) $dcAxis = 'TIME';

    $tMachine = strtotime($machinePresent);
    if ($tMachine === false) $tMachine = time();
    $cap = (int) ($cfg['card_cap'] ?? 48);
    $weights = $cfg['matter_weights'] ?? [];

    // Selector bank: excluded record kinds (CSV). PENDING is a pseudo-kind.
    $exclude = [];
    foreach (explode(',', (string) ($query['x'] ?? '')) as $xk) {
        $xk = strtoupper(preg_replace('/[^A-Za-z0-9_]/', '', $xk) ?? '');
        if ($xk !== '') $exclude[$xk] = true;
    }

    $all = [];
    foreach (ttg_graph_unique_nodes() as $node) {
        if (!is_array($node) || !ttg_graph_public($node)) continue;
        $all[] = $node;
    }
    foreach (ttg_graph_pending() as $node) {
        if (!is_array($node)) continue;
        $node['pending'] = true;
        $all[] = $node;
    }

    $typeCounts = [];
    $timeline = [];
    $pool = [];
    foreach ($all as $node) {
        $t = strtoupper((string) ($node['type'] ?? 'UNKNOWN'));
        $typeCounts[$t] = ($typeCounts[$t] ?? 0) + 1;
        if (!empty($node['pending'])) $typeCounts['PENDING'] = ($typeCounts['PENDING'] ?? 0) + 1;
        if (isset($exclude[$t]) || (!empty($node['pending']) && isset($exclude['PENDING']))) continue;
        $pool[] = $node;
        $ts = strtotime((string) ($node['observed_at'] ?? ''));
        if ($ts !== false) {
            $y = (int) gmdate('Y', $ts);
            $timeline[$y] = ($timeline[$y] ?? 0) + 1;
        }
    }
    arsort($typeCounts);
    ksort($timeline);

    usort($pool, static function ($a, $b) use ($focus) {
        $ia = (float) ($a['importance'] ?? 0);
        $ib = (float) ($b['importance'] ?? 0);
        if ($focus !== '') {
            $sa = (string) ($a['slug'] ?? '');
            $sb = (string) ($b['slug'] ?? '');
            if ($sa === $focus) $ia += 2;
            if ($sb === $focus) $ib += 2;
        }
        return $ib <=> $ia;
    });

    $cards = [];
    $edgeCount = count(ttg_graph_load('edges.json')) + count(ttg_graph_load('pending-edges.json'));
    foreach (array_slice($pool, 0, $cap) as $node) {
        $proj = ttg_graph_project_node($node, $viewer, $personEdges);
        $obs = (string) ($proj['observed_at'] ?? '');
        $obsTs = $obs !== '' ? strtotime($obs) : false;
        $beyond = $obsTs !== false && $obsTs > $tMachine;
        $pid = (string) ($proj['id'] ?? $proj['slug'] ?? '');
        $cards[] = [
            'public_id' => $pid,
            'slug' => (string) ($proj['slug'] ?? ''),
            'type' => (string) ($proj['type'] ?? 'UNKNOWN'),
            'title' => (string) ($proj['title'] ?? ''),
            'observed_at' => $obs,
            'status' => (string) ($proj['status'] ?? ''),
            'importance' => (float) ($proj['importance'] ?? 0),
            'pending' => !empty($proj['pending']),
            'beyond' => $beyond,
            'href' => (string) ($proj['href'] ?? ''),
            'place' => (string) ($proj['place'] ?? ''),
            'holes' => ttg_machine_encode_holes($pid, (string) ($proj['type'] ?? ''), $obs),
        ];
    }

    $active = array_values(array_filter($cards, static fn ($c) => empty($c['beyond'])));
    $mindBase = ttg_machine_mind_base($focus, count($active));
    $matterBase = ttg_machine_matter_base($cards, $weights);
    $mind = ttg_machine_clamp($mindBase * 0.35 + $mindKnob * 0.65, 0.001, 1.0);
    $matter = ttg_machine_clamp($matterBase * 0.35 + $matterKnob * 0.65, 0.001, 1.0);
    $dcParts = ttg_machine_delta_context_parts($machinePresent, $focus, $dcAxis);
    $delta = $dcParts['total'];
    $em = ttg_machine_emergy($mind, $matter, $delta, $kappa);

    $jackLine = '';
    if (count($active) < 3) {
        $jackLine = 'MATTER STARVATION — MORE EVIDENCE REQUIRED';
    } elseif ($mind > 0.88 && $delta > 0.7) {
        $jackLine = 'FIELD SATURATION — REDUCE MIND APERTURE';
    } elseif ($focus !== '' && empty(ttg_graph_node($focus))) {
        $jackLine = 'UNKNOWN DATE OR FOCUS — CARD NOT ON FILE';
    }

    $feed = ttg_machine_feed_items((int) ($cfg['feed_cap'] ?? 24));

    return [
        'ok' => true,
        'instrument' => 'TIME MACHINE №13',
        'local_present' => date('c'),
        'machine_present' => $machinePresent,
        'network_present' => (string) ($cfg['network_present'] ?? ''),
        'mind' => round($mind, 6),
        'matter' => round($matter, 6),
        'mind_knob' => round($mindKnob, 6),
        'matter_knob' => round($matterKnob, 6),
        'mind_base' => round($mindBase, 6),
        'matter_base' => round($matterBase, 6),
        'delta_context' => round($delta, 6),
        'dc_axis' => $dcAxis,
        'dc_axes' => $dcParts['axes'],
        'dc_weights' => $dcParts['weights'],
        'kappa' => round($kappa, 6),
        'emergy_raw' => $em['raw'],
        'emergy_display' => round($em['display'], 6),
        'field' => [
            'node_count' => count($pool),
            'edge_count' => $edgeCount,
            'active_cards' => count($active),
            'total_nodes' => count($all),
        ],
        'type_counts' => $typeCounts,
        'excluded' => array_keys($exclude),
        'timeline' => $timeline,
        'focus' => $focus,
        'cards' => $cards,
        'feed' => $feed,
        'jack_line' => $jackLine,
        'equation' => 'E = M / R^(κ·ΔC)',
    ];
}
