<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    header('Content-Type: application/json; charset=utf-8');
    echo '{"ok":false,"error":"POST only."}';
    exit;
}

$csrf = (string) ($_POST['csrf'] ?? '');
if (!ttg_graph_csrf_ok($csrf)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo '{"ok":false,"error":"The clerk will not accept an unsigned slip."}';
    exit;
}

$file = isset($_FILES['photo']) && is_array($_FILES['photo']) ? $_FILES['photo'] : null;
$result = ttg_graph_capture($_POST, $file);

$accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
$wantsJson = str_contains($accept, 'application/json');

if (!$wantsJson) {
    if (!empty($result['ok']) && !empty($result['node']['slug'])) {
        header('Location: /n/' . rawurlencode((string) $result['node']['slug']) . '/', true, 303);
        exit;
    }
    header('Location: /#capture', true, 303);
    exit;
}

http_response_code(!empty($result['ok']) ? 200 : 400);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
