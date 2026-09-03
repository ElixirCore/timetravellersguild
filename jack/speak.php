<?php
declare(strict_types=1);

/**
 * Jack’s voice. ElevenLabs is called only here.
 * The API key never leaves the server.
 */

require_once dirname(__DIR__) . '/inc/env.php';
require_once dirname(__DIR__) . '/inc/graph.php';

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

if (!ttg_eleven_configured()) {
    ttg_jack_speak_fail(503, 'The clerk has not found his voice.');
}

$text = trim((string) ($_POST['text'] ?? ''));
if ($text === '') {
    ttg_jack_speak_fail(400, 'Nothing to read.');
}
if (function_exists('mb_strlen') ? mb_strlen($text) > 2000 : strlen($text) > 2000) {
    ttg_jack_speak_fail(400, 'That slip is too long to read aloud.');
}

if (!ttg_jack_speech_ok($text)) {
    ttg_jack_speak_fail(403, 'The clerk will only read his own last slip.');
}

if (!ttg_jack_speak_rate_ok()) {
    ttg_jack_speak_fail(429, 'The reader is occupied. Try again presently.');
}

$apiKey = ttg_env('ELEVENLABS_API_KEY');
$voiceId = ttg_eleven_voice_id();
$model = ttg_env('ELEVENLABS_MODEL', 'eleven_multilingual_v2');
if ($model === '' || !preg_match('/^[A-Za-z0-9._-]{3,64}$/', $model)) {
    $model = 'eleven_multilingual_v2';
}

$body = json_encode([
    'text' => $text,
    'model_id' => $model,
    'voice_settings' => [
        'stability' => 0.58,
        'similarity_boost' => 0.72,
        'style' => 0.15,
        'use_speaker_boost' => true,
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($body === false) {
    ttg_jack_speak_fail(500, 'The reader could not take the slip.');
}

$url = 'https://api.elevenlabs.io/v1/text-to-speech/' . rawurlencode($voiceId);
$ch = curl_init($url);
if ($ch === false) {
    ttg_jack_speak_fail(503, 'The reader is away from the desk.');
}

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Accept: audio/mpeg',
        'Content-Type: application/json',
        'xi-api-key: ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 40,
    CURLOPT_CONNECTTIMEOUT => 10,
]);

$audio = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($audio === false || $code < 200 || $code >= 300 || $err !== '' || $audio === '') {
    ttg_jack_speak_fail(503, 'The clerk could not find his voice.');
}

header('Content-Type: audio/mpeg');
header('Content-Length: ' . (string) strlen($audio));
echo $audio;
