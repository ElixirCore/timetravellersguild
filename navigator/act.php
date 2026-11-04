<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo '{"ok":false,"error":"POST only."}';
    exit;
}

$raw = file_get_contents('php://input');
$input = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
if (!is_array($input)) $input = $_POST;

$csrf = (string) ($input['csrf'] ?? '');
if (!ttg_graph_csrf_ok($csrf)) {
    http_response_code(400);
    echo '{"ok":false,"error":"The clerk will not accept an unsigned slip."}';
    exit;
}

if (!ttg_guild_keeper()) {
    http_response_code(403);
    echo '{"ok":false,"error":"The navigator is reserved for keepers."}';
    exit;
}

$action = strtolower(trim((string) ($input['action'] ?? '')));
$id = trim((string) ($input['slug'] ?? $input['id'] ?? $input['detail'] ?? ''));
$viewer = ttg_graph_viewer();
$extra = [
    'detail' => trim((string) ($input['detail'] ?? $input['filter'] ?? '')),
    'data' => is_array($input['data'] ?? null) ? $input['data'] : [],
];

$result = ttg_graph_punch_action($action, $id, $viewer, $extra);
if (!empty($result['ok'])) {
    $result['on_tape'] = ttg_graph_punch_present();
}
$code = 200;
if (empty($result['ok'])) {
    $code = !empty($result['rate']) ? 429 : (in_array($action, ['confirm', 'reject', 'return', 'delete'], true) ? 403 : 400);
}
http_response_code($code);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
