<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/../people/inc/db.php';

$user = ttg_current_user();
if (!$user) { http_response_code(401); echo '{"error":"Not signed in"}'; exit; }

$reg = dirname(__DIR__, 3) . '/ttg-passport/citizens.json';
$citizen = null;
if (is_file($reg)) {
    $all = json_decode(@file_get_contents($reg), true);
    if (is_array($all)) {
        $needle = mb_strtolower(trim((string)($user['display_name'] ?? '')));
        foreach ($all as $c) {
            if (mb_strtolower(trim((string)($c['name'] ?? ''))) === $needle) { $citizen = $c; break; }
        }
    }
}

$places = [];
foreach (is_array($citizen['places'] ?? null) ? $citizen['places'] : [] as $p) {
    $entry = [
        'name'  => (string)($p['name'] ?? ''),
        'line'  => (string)($p['line'] ?? ''),
        'inked' => (string)($p['inked'] ?? ''),
    ];
    if (isset($p['lat'], $p['lon'])) {
        $entry['lat'] = (float)$p['lat'];
        $entry['lng'] = (float)$p['lon'];
    }
    $places[] = $entry;
}

echo json_encode([
    'name'   => (string)($citizen['name']   ?? $user['display_name'] ?? ''),
    'number' => (string)($citizen['number'] ?? ''),
    'places' => $places,
], JSON_UNESCAPED_UNICODE);
