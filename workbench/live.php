<?php
/**
 * live.php: starts a voice session. The page sends its WebRTC offer here; this posts it to OpenAI with the key from
 * secret_agent.php and returns the answer. The key never reaches the browser.
 * Same guard as agent.php (same-origin, agent_auth.php login hook, rate limit).
 * ASSUMPTION: the request shape follows the snippet you pasted (POST {base}/v1/live/sessions with "session" and
 * "transport": {"type":"webrtc","sdp":...}). I could not test it against OpenAI and have not read the Live API docs.
 * Settings in secret_agent.php: OPENAI_LIVE_MODEL (required), OPENAI_LIVE_VOICE, OPENAI_LIVE_DELEGATE_MODEL (blank = no delegation).
 */
declare(strict_types=1);
require __DIR__ . '/agent_common.php';
$model = secret('OPENAI_LIVE_MODEL');
if (!$model) fail(500, 'No OPENAI_LIVE_MODEL found in secret_agent.php, secrets.php or the environment.');
$raw = file_get_contents('php://input', false, null, 0, 65537);
if ($raw === false || strlen($raw) > 65536) fail(413, 'Request too large.');
$in = json_decode($raw, true);
$sdp = is_array($in) && isset($in['sdp']) && is_string($in['sdp']) ? $in['sdp'] : '';
if ($sdp === '' || strncmp($sdp, 'v=0', 3) !== 0) fail(400, 'Body must be JSON with the offer as "sdp".');
$session = ['model' => $model];
if ($voice = secret('OPENAI_LIVE_VOICE')) $session['audio'] = ['output' => ['voice' => $voice]];
if ($dm = secret('OPENAI_LIVE_DELEGATE_MODEL')) {
    $session['delegation'] = ['type' => 'responses', 'responses' => ['parallel_tool_calls' => false, 'model' => $dm, 'reasoning' => ['effort' => 'medium'], 'tools' => [['type' => 'web_search']]]];
}
// UNVERIFIED: whether the live session accepts "instructions". Off unless OPENAI_LIVE_INSTRUCTIONS is 1, so a working setup stays working.
if (secret('OPENAI_LIVE_INSTRUCTIONS') === '1') { $ins = trim(((string) secret('OPENAI_PERSONA')) . "\n\n" . guild_digest()); if ($ins !== '') $session['instructions'] = $ins; }
$body = ['session' => $session, 'transport' => ['type' => 'webrtc', 'sdp' => $sdp]];
$ch = curl_init($base . '/v1/live/sessions');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
$res = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
if ($res === false) fail(502, 'Could not reach the provider: ' . $err);
$j = json_decode((string) $res, true);
if ($status >= 400 || !is_array($j)) { fail($status >= 400 && $status < 600 ? $status : 502, is_array($j) && isset($j['error']['message']) ? (string) $j['error']['message'] : 'The provider answered ' . $status . '.'); }
$ans = $j['transport']['sdp'] ?? '';
if (!is_string($ans) || $ans === '') fail(502, 'The provider reply had no answer SDP.');
echo json_encode(['sdp' => $ans]);
