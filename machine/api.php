<?php
declare(strict_types=1);

require_once __DIR__ . '/inc/state.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo '{"ok":false,"error":"GET only."}';
    exit;
}

$state = ttg_machine_build_state($_GET);
echo json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
