<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/inc/graph.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackRelationship.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackAgent.php';
require_once dirname(__DIR__, 2) . '/app/AI/MabelAgent.php';
require_once dirname(__DIR__, 2) . '/app/AI/Bridge/autoload.php';

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo '{"ok":false,"error":"POST only."}';
    exit;
}

if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    http_response_code(400);
    echo '{"ok":false,"error":"The clerk will not accept an unsigned slip."}';
    exit;
}

if (function_exists('ttg_jack_rate_allow') && !ttg_jack_rate_allow('aperture', 8)) {
    http_response_code(429);
    echo '{"ok":false,"error":"The aperture will not take another turn from this position presently."}';
    exit;
}

$q = trim((string) ($_POST['q'] ?? $_POST['message'] ?? ''));
if ($q === '') {
    http_response_code(400);
    echo '{"ok":false,"error":"Nothing entered the aperture."}';
    exit;
}
if (function_exists('mb_strlen') ? mb_strlen($q) > 2000 : strlen($q) > 2000) {
    $q = function_exists('mb_substr') ? mb_substr($q, 0, 2000) : substr($q, 0, 2000);
}

$viewer = ttg_graph_viewer();
$body = [
    'yaw' => (float) ($_POST['yaw'] ?? 0),
    'z' => (float) ($_POST['z'] ?? 0),
    'focus' => trim((string) ($_POST['focus'] ?? '')),
];
$slug = trim((string) ($_POST['context'] ?? ''));

try {
    $out = ApertureDialogueService::exchange($q, $viewer, $body, $slug !== '' ? $slug : null);
    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    echo '{"ok":false,"canon":false,"error":"The aperture would not open."}';
}
