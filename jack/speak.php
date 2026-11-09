<?php
declare(strict_types=1);

/**
 * Jack’s voice. The engine prepares the queued slip and calls ElevenLabs here.
 * The API key never leaves the server. The browser never chooses the text.
 */

require_once dirname(__DIR__) . '/inc/env.php';
require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/JackVoice/autoload.php';

@set_time_limit(45);

header('Cache-Control: no-store');

function ttg_jack_speak_fail(int $status, string $error): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'voice' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    ttg_jack_speak_fail(405, 'POST only.');
}

if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    ttg_jack_speak_fail(400, 'The clerk will not accept an unsigned slip.');
}

if (!VoiceEngine::configured()) {
    ttg_jack_speak_fail(503, 'The clerk has not found his voice.');
}

$clientText = trim((string) ($_POST['text'] ?? ''));
if (function_exists('mb_strlen') ? mb_strlen($clientText) > 2000 : strlen($clientText) > 2000) {
    ttg_jack_speak_fail(400, 'That slip is too long to read aloud.');
}

$engine = new VoiceEngine();
$result = $engine->speakQueued($clientText, (int) ($_POST['part'] ?? 0));

if (empty($result['ok']) || !is_string($result['audio']) || $result['audio'] === '') {
    $http = (int) ($result['http'] ?? 503);
    $code = (string) ($result['error'] ?? 'synth_failed');
    $messages = [
        'unconfigured' => 'The clerk has not found his voice.',
        'nothing_to_read' => 'Nothing to read.',
        'not_own_slip' => 'The clerk will only read his own last slip.',
        'reader_occupied' => 'The reader is occupied. Try again presently.',
        'synth_failed' => 'The clerk could not find his voice.',
    ];
    ttg_jack_speak_fail($http >= 400 ? $http : 503, $messages[$code] ?? 'The clerk could not find his voice.');
}

header('Content-Type: audio/mpeg');
header('Content-Length: ' . (string) strlen($result['audio']));
header('X-Jack-Voice: ' . (!empty($result['cached']) ? 'cached' : 'fresh'));
if (!empty($result['more'])) header('X-Jack-More: 1');
echo $result['audio'];
