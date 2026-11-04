<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/env.php';
require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/JackVoice/autoload.php';

@set_time_limit(45);
header('Cache-Control: no-store');

function ttg_intro_voice_fail(int $status, string $error): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'voice' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    ttg_intro_voice_fail(405, 'POST only.');
}

if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    ttg_intro_voice_fail(400, 'The clerk will not accept an unsigned slip.');
}

if (!VoiceEngine::configured()) {
    ttg_intro_voice_fail(503, 'The clerk has not found his voice.');
}

$text = trim((string) ($_POST['text'] ?? ''));
if ($text === '' || (function_exists('mb_strlen') ? mb_strlen($text) > 2000 : strlen($text) > 2000)) {
    ttg_intro_voice_fail(400, 'That slip is too long to read aloud.');
}

$result = (new VoiceEngine())->speakPrepared($text);
if (empty($result['ok']) || !is_string($result['audio']) || $result['audio'] === '') {
    ttg_intro_voice_fail((int) ($result['http'] ?? 503), 'The clerk could not find his voice.');
}

header('Content-Type: audio/mpeg');
header('Content-Length: ' . (string) strlen($result['audio']));
header('X-Jack-Voice: ' . (!empty($result['cached']) ? 'cached' : 'fresh'));
echo $result['audio'];
