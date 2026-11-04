<?php
declare(strict_types=1);

/**
 * /jack/sitting — a voice door asks for a sitting token as the call starts.
 * The token goes to ElevenLabs and back to /jack/llm; the visitor stays here.
 */
require_once dirname(__DIR__) . '/app/AI/JackBrain.php';
JackBrain::boot();
require_once dirname(__DIR__) . '/app/AI/JackSitting.php';

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
if (!ttg_jack_rate_allow('sitting', 20)) {
    http_response_code(429);
    echo '{"ok":false,"error":"Enough calls from this position for the hour."}';
    exit;
}

$site = strtolower(trim((string) ($_POST['site'] ?? 'intro')));
if (!in_array($site, ['intro', 'cube', 'jack', 'square', 'field'], true)) {
    $site = 'intro';
}
$viewer = ttg_graph_viewer();
$token = JackSitting::mint($viewer, JackPolicy::subjectKey($viewer), $site);
if ($token === '') {
    http_response_code(503);
    echo '{"ok":false,"error":"The desk could not open a sitting."}';
    exit;
}
echo json_encode(['ok' => true, 'sitting' => $token, 'ttl' => JackSitting::TTL]);
