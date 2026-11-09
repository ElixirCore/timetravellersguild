<?php
/* HALO · ElevenLabs. The page posts
     { mode: "sound", prompt, seconds }      -> sound-generation, a one-shot
     { mode: "music", prompt, ms }           -> music, a short clip
   Music is instrumental unless the words ask for a voice (vocals, singing,
   lyrics, choir, rap...). The key lives in config.php and never leaves here. */
header('Content-Type: application/json');
header('Cache-Control: no-store');
function fail($code, $msg) { http_response_code($code); echo json_encode(['ok' => false, 'error' => $msg]); exit; }

if (!is_file(__DIR__.'/config.php')) fail(500, 'config.php is missing - copy config.sample.php to config.php and add the key');
require __DIR__.'/config.php';
if (!defined('MUSIC_CAP')) define('MUSIC_CAP', 12);

$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) fail(400, 'bad json');
$mode   = ($in['mode'] ?? 'sound') === 'music' ? 'music' : 'sound';
$prompt = trim((string)($in['prompt'] ?? ''));
if ($prompt === '' || mb_strlen($prompt) > 450) fail(400, 'prompt 1-450 chars');

if ($mode === 'sound') {
    $seconds = round((float)($in['seconds'] ?? 0.8), 2);
    if ($seconds < 0.5 || $seconds > 2.0) fail(400, 'seconds 0.5-2');
    $url  = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';
    $body = ['text' => $prompt, 'duration_seconds' => $seconds, 'prompt_influence' => 0.6];
    $cap  = DAILY_CAP;
} else {
    $ms = (int)($in['ms'] ?? 8000);
    if ($ms < 3000 || $ms > 30000) fail(400, 'ms 3000-30000');
    $voice = preg_match('/\b(vocals?|voices?|sing|sings|singing|singer|sung|lyrics?|choir|choral|rap|rapping|acapella|a cappella)\b/i', $prompt);
    if (!$voice && !preg_match('/instrumental/i', $prompt)) $prompt .= ', instrumental';
    $url  = 'https://api.elevenlabs.io/v1/music/stream?output_format=mp3_44100_128';
    $body = ['prompt' => $prompt, 'music_length_ms' => $ms, 'force_instrumental' => !$voice];
    $cap  = MUSIC_CAP;
}

if (!is_dir(STORE_DIR)) {
    @mkdir(STORE_DIR, 0755, true);
    @file_put_contents(STORE_DIR.'/.htaccess', "Require all denied\n");
}
if (!is_dir(STORE_DIR.'/clips')) @mkdir(STORE_DIR.'/clips', 0755, true);

/* daily caps and pacing, under a lock */
$uf = fopen(STORE_DIR.'/.usage.json', 'c+');
if (!$uf) fail(500, 'store is not writable');
flock($uf, LOCK_EX);
$u = json_decode((string)stream_get_contents($uf), true);
if (!is_array($u)) $u = [];
$today = gmdate('Y-m-d');
if (($u['date'] ?? '') !== $today) $u = ['date' => $today, 'sound' => 0, 'music' => 0, 'last' => 0];
$used = (int)($u[$mode] ?? 0);
if ($used >= $cap) { flock($uf, LOCK_UN); fclose($uf); fail(429, 'daily '.$mode.' cap reached ('.$cap.')'); }
$wait = MIN_INTERVAL - (time() - (int)($u['last'] ?? 0));
if ($wait > 0) { flock($uf, LOCK_UN); fclose($uf); fail(429, 'wait '.$wait.'s'); }

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['xi-api-key: '.EL_API_KEY, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($body),
    CURLOPT_TIMEOUT => 150,
    CURLOPT_CONNECTTIMEOUT => 15,
]);
$audio = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($audio === false || $code !== 200 || strlen((string)$audio) < 200) {
    flock($uf, LOCK_UN); fclose($uf);
    $detail = '';
    if (is_string($audio) && $audio !== '') {
        $j = json_decode($audio, true);
        $detail = $j['detail']['message'] ?? $j['detail'] ?? '';
        if (is_array($detail)) $detail = json_encode($detail);
    }
    fail(502, 'elevenlabs '.$code.($err ? ' '.$err : '').($detail ? ' - '.substr($detail, 0, 300) : ''));
}

$id = gmdate('Ymd-His').'-'.bin2hex(random_bytes(3));
file_put_contents(STORE_DIR.'/clips/'.$id.'.mp3', $audio);
$u[$mode] = $used + 1; $u['last'] = time();
ftruncate($uf, 0); rewind($uf); fwrite($uf, json_encode($u));
flock($uf, LOCK_UN); fclose($uf);

echo json_encode(['ok' => true, 'id' => $id, 'mode' => $mode, 'left_today' => $cap - $u[$mode]]);
