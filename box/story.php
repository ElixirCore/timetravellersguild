<?php
declare(strict_types=1);
/**
 * box/story.php — Generate a vivid opening story for a CHRONOS destination.
 *
 * POST or GET: dest, era, year
 * Returns: { story: "..." } or { error: "..." }
 */

require_once __DIR__ . '/../inc/env.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

$dest = trim((string)($_POST['dest'] ?? $_GET['dest'] ?? ''));
$era  = trim((string)($_POST['era']  ?? $_GET['era']  ?? ''));
$year = trim((string)($_POST['year'] ?? $_GET['year'] ?? ''));

if ($dest === '') {
    http_response_code(400);
    echo json_encode(['error' => 'dest required']);
    exit;
}

if (!ttg_openai_configured()) {
    http_response_code(503);
    echo json_encode(['error' => 'OpenAI API not configured']);
    exit;
}

$place   = $dest . ($era !== '' ? " — {$era}" : '') . ($year !== '' ? " ({$year})" : '');
$prompt  = "The CHRONOS booth has just materialised at: {$place}.\n\n"
         . "Write the opening of a high-octane, non-cliché time-travel story set exactly here. "
         . "Three tight paragraphs. Vivid sensory detail, immediate danger or strangeness, "
         . "no info-dump. End on a hook. Under 170 words. Never start with 'Suddenly'.";

$payload = [
    'model'    => ttg_openai_model(),
    'messages' => [
        [
            'role'    => 'system',
            'content' => 'You write visceral, surprising, literary short-fiction openings. '
                       . 'Three paragraphs, under 170 words total. No clichés. No AI filler phrases.',
        ],
        ['role' => 'user', 'content' => $prompt],
    ],
    'max_completion_tokens' => 4096,
];

$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . ttg_env('OPENAI_API_KEY'),
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_TIMEOUT        => 25,
]);
$res = curl_exec($ch);
$err = curl_error($ch);
curl_close($ch);

if ($err || $res === false) {
    http_response_code(502);
    echo json_encode(['error' => $err ?: 'curl failed']);
    exit;
}

$data  = json_decode((string)$res, true);
$story = $data['choices'][0]['message']['content'] ?? null;

if (!is_string($story) || $story === '') {
    http_response_code(502);
    echo json_encode(['error' => 'no story returned', 'raw' => $data]);
    exit;
}

echo json_encode(['story' => trim($story)]);
