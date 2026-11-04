<?php
declare(strict_types=1);

/**
 * /jack/live-session — creates an OpenAI GPT-Live WebRTC session.
 *
 * Client POSTs {csrf, sdp} → server negotiates with OpenAI Live API
 * and returns {ok, session_id, sdp} (the remote SDP answer).
 * The API key never leaves this server.
 */

require_once dirname(__DIR__) . '/inc/env.php';
require_once dirname(__DIR__) . '/inc/graph.php';

@set_time_limit(30);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function live_fail(int $status, string $error): never {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $error]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    live_fail(405, 'POST only.');
}

if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    live_fail(400, 'Unsigned slip.');
}

$sdp = trim((string) ($_POST['sdp'] ?? ''));
if ($sdp === '') live_fail(400, 'SDP offer required.');

$key = ttg_env('OPENAI_API_KEY');
if ($key === '') live_fail(503, 'The live line is not connected.');

/* Configuration sent once at session creation — never resent after session.started */
$session_config = [
    'model' => 'gpt-live-1',
    'audio' => [
        'output' => ['voice' => 'gleam'],
    ],
    'delegation' => [
        'type' => 'responses',
        'responses' => [
            'parallel_tool_calls' => false,
            'model' => 'gpt-6-luna',
            'reasoning' => ['effort' => 'medium'],
            'tools' => [['type' => 'web_search']],
        ],
    ],
];

$payload = json_encode([
    'session'   => $session_config,
    'transport' => ['type' => 'webrtc', 'sdp' => $sdp],
]);

$ctx = stream_context_create([
    'http' => [
        'method'  => 'POST',
        'header'  => implode("\r\n", [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $key,
            'OpenAI-Beta: live-sessions=v1',
        ]),
        'content' => $payload,
        'timeout' => 20,
        'ignore_errors' => true,
    ],
]);

$raw = @file_get_contents('https://api.openai.com/v1/live/sessions', false, $ctx);
if ($raw === false) live_fail(502, 'Could not reach the live line.');

$resp = json_decode($raw, true);
if (!is_array($resp)) live_fail(502, 'Unreadable response from live line.');

if (!empty($resp['error'])) {
    live_fail(502, (string) ($resp['error']['message'] ?? 'Live line refused.'));
}

$answer_sdp   = (string) ($resp['transport']['sdp'] ?? '');
$session_id   = (string) ($resp['session']['id'] ?? '');

if ($answer_sdp === '' || $session_id === '') {
    live_fail(502, 'Live line returned an incomplete handshake.');
}

echo json_encode(['ok' => true, 'session_id' => $session_id, 'sdp' => $answer_sdp]);
