<?php
declare(strict_types=1);

/**
 * /jack/llm — Jack's brain for the ElevenLabs voice agent (Custom LLM).
 * ElevenLabs posts Chat Completions here with the Custom LLM API key as a
 * bearer token. The page's sitting token arrives in elevenlabs_extra_body.
 */
require_once dirname(__DIR__) . '/app/AI/JackBrain.php';
JackBrain::boot();
require_once dirname(__DIR__) . '/app/AI/JackSitting.php';
require_once dirname(__DIR__) . '/app/AI/JackLlm.php';

@set_time_limit(90);
/* Anything printed here is spoken. Errors go to the log, never the line. */
@ini_set('display_errors', '0');
header('Cache-Control: no-store');

function ttg_llm_fail(int $status, string $error): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => ['message' => $error, 'type' => 'jack_llm']], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    ttg_llm_fail(405, 'POST only.');
}

$secret = ttg_env('JACK_LLM_SECRET');
if (strlen($secret) < 32) {
    ttg_llm_fail(503, 'The voice line is not connected.');
}
$auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if ($auth === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
        if (strtolower((string) $k) === 'authorization') $auth = (string) $v;
    }
}
if (!preg_match('/^Bearer\s+(.+)$/i', trim($auth), $m) || !hash_equals($secret, trim($m[1]))) {
    ttg_llm_fail(401, 'Unsigned line.');
}

$body = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($body)) {
    ttg_llm_fail(400, 'Unreadable slip.');
}
$chat = JackLlm::read($body);

/* Who is on the line. No sitting means an anonymous caller who leaves no trace. */
$sitting = JackSitting::take((string) ($chat['extra']['sitting'] ?? ''));
if ($sitting !== null) {
    $viewer = $sitting['viewer'];
    $relationship = JackRelationship::load($sitting['subject']);
    $persist = true;
    $touch = $sitting['turn'] === 1;
    $site = $sitting['site'];
} else {
    $viewer = ['known' => false, 'name' => null, 'first' => null, 'slug' => null, 'email' => null];
    $relationship = JackRelationship::blank('voice:anonymous');
    $persist = false;
    $touch = false;
    $site = 'intro';
}

$page = '';
foreach (['page_title' => 'Title', 'page_url' => 'Address', 'page_context' => 'Content'] as $key => $label) {
    $v = trim((string) ($chat['extra'][$key] ?? ''));
    if ($v !== '') $page .= $label . ': ' . $v . "\n";
}

$id = 'chatcmpl-jack-' . bin2hex(random_bytes(6));
$away = 'The clerk is away from the desk. The field remains.';

if (!$chat['stream']) {
    $thought = JackBrain::turn($chat['message'], [
        'channel' => 'voice', 'site' => $site, 'thread' => $chat['thread'], 'suffix' => $chat['suffix'],
        'page' => $page, 'viewer' => $viewer, 'relationship' => $relationship,
        'persist' => $persist, 'touch' => $touch, 'passthrough' => $chat['tools'],
    ]);
    $content = $thought['ok'] ? $thought['text'] : $away;
    if ($content === '' && $thought['handoff'] === []) $content = 'I do not have that as a record.';
    $message = ['role' => 'assistant', 'content' => $content];
    if ($thought['handoff'] !== []) {
        $message['tool_calls'] = array_map(static function (array $c): array {
            unset($c['index']);
            return $c;
        }, JackLlm::toolCalls($thought['handoff']));
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'id' => $id,
        'object' => 'chat.completion',
        'created' => time(),
        'model' => 'jack',
        'choices' => [['index' => 0, 'message' => $message, 'finish_reason' => $thought['handoff'] !== [] ? 'tool_calls' : 'stop']],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/* Stream. Nothing may sit in a buffer between Jack and the caller's ear. */
@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', '0');
if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
while (ob_get_level() > 0) @ob_end_flush();
header('Content-Type: text/event-stream; charset=utf-8');
header('X-Accel-Buffering: no');

$send = static function (string $frame): void {
    echo $frame;
    @flush();
};
$send(JackLlm::chunk($id, ['role' => 'assistant']));

$said = false;
$thought = JackBrain::turn($chat['message'], [
    'channel' => 'voice', 'site' => $site, 'thread' => $chat['thread'], 'suffix' => $chat['suffix'],
    'page' => $page, 'viewer' => $viewer, 'relationship' => $relationship,
    'persist' => $persist, 'touch' => $touch, 'passthrough' => $chat['tools'],
    'onDelta' => static function (string $delta) use ($send, $id, &$said): void {
        if ($delta === '') return;
        $said = true;
        $send(JackLlm::chunk($id, ['content' => $delta]));
    },
]);

if (!$said && (!$thought['ok'] || $thought['text'] === '') && $thought['handoff'] === []) {
    $send(JackLlm::chunk($id, ['content' => $thought['ok'] ? 'I do not have that as a record.' : $away]));
}
if ($thought['handoff'] !== []) {
    $send(JackLlm::chunk($id, ['tool_calls' => JackLlm::toolCalls($thought['handoff'])]));
    $send(JackLlm::chunk($id, [], 'tool_calls'));
} else {
    $send(JackLlm::chunk($id, [], 'stop'));
}
$send("data: [DONE]\n\n");
