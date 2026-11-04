<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo '{"ok":false,"error":"GET only."}';
    exit;
}

$slug = trim((string) ($_GET['slug'] ?? ''));
$around = ttg_now_around($slug);
if ($around === null) {
    http_response_code(404);
    echo '{"ok":false,"error":"That record is not on a public timeline."}';
    exit;
}

echo json_encode($around, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
