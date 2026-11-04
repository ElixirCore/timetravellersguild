<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/inc/briefing.php';

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

if (!ttg_graph_csrf_ok((string) ($input['csrf'] ?? ''))) {
    http_response_code(400);
    echo '{"ok":false,"error":"The clerk will not accept an unsigned slip."}';
    exit;
}

$brief = ttg_briefing_write(is_array($input['brief'] ?? null) ? $input['brief'] : []);
echo json_encode([
    'ok' => true,
    'brief' => ttg_briefing_relevant($brief),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
