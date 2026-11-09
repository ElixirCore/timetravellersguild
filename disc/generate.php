<?php
/* DISC · sound design. The page posts { prompt, seconds }; this asks
   ElevenLabs' sound-generation for a sub-second one-shot and keeps the mp3 in
   store/. The key lives in config.php and never leaves the server. */
header('Content-Type: application/json');
header('Cache-Control: no-store');
function fail($code, $msg) { http_response_code($code); echo json_encode(['ok' => false, 'error' => $msg]); exit; }

if (!is_file(__DIR__.'/config.php')) fail(500, 'config.php is missing - copy config.sample.php to config.php and add the key');
require __DIR__.'/config.php';

$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) fail(400, 'bad json');
$prompt  = trim((string)($in['prompt'] ?? ''));
$seconds = round((float)($in['seconds'] ?? 0.6), 2);
if ($prompt === '' || mb_strlen($prompt) > 400) fail(400, 'prompt 1-400 chars');
if ($seconds < 0.5 || $seconds > 1.0) fail(400, 'seconds 0.5-1.0');

if (!is_dir(STORE_DIR)) {
    @mkdir(STORE_DIR, 0755, true);
    @file_put_contents(STORE_DIR.'/.htaccess', "Require all denied\n");
}
if (!is_dir(STORE_DIR.'/clips')) @mkdir(STORE_DIR.'/clips', 0755, true);

/* daily cap and pacing, under a lock */
$uf = fopen(STORE_DIR.'/.usage.json', 'c+');
if (!$uf) fail(500, 'store is not writable');
flock($uf, LOCK_EX);
$u = json_decode((string)stream_get_contents($uf), true);
if (!is_array($u)) $u = [];
$today = gmdate('Y-m-d');
if (($u['date'] ?? '') !== $today) $u = ['date' => $today, 'count' => 0, 'last' => 0];
if ((int)$u['count'] >= DAILY_CAP) { flock($uf, LOCK_UN); fclose($uf); fail(429, 'daily cap reached ('.DAILY_CAP.')'); }
$wait = MIN_INTERVAL - (time() - (int)($u['last'] ?? 0));
if ($wait > 0) { flock($uf, LOCK_UN); fclose($uf); fail(429, 'wait '.$wait.'s'); }

$ch = curl_init('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['xi-api-key: '.EL_API_KEY, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['text' => $prompt, 'duration_seconds' => $seconds, 'prompt_influence' => 0.6]),
    CURLOPT_TIMEOUT => 60,
    CURLOPT_CONNECTTIMEOUT => 15,
]);
$audio = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($audio === false || $code !== 200) {
    flock($uf, LOCK_UN); fclose($uf);
    $detail = '';
    if (is_string($audio) && $audio !== '') {
        $j = json_decode($audio, true);
        $detail = $j['detail']['message'] ?? $j['detail'] ?? '';
        if (is_array($detail)) $detail = json_encode($detail);
    }
    fail(502, 'elevenlabs '.$code.($err ? ' '.$err : '').($detail ? ' - '.$detail : ''));
}

$id = gmdate('Ymd-His').'-'.bin2hex(random_bytes(3));
file_put_contents(STORE_DIR.'/clips/'.$id.'.mp3', $audio);
$u['count']++; $u['last'] = time();
ftruncate($uf, 0); rewind($uf); fwrite($uf, json_encode($u));
flock($uf, LOCK_UN); fclose($uf);

echo json_encode(['ok' => true, 'id' => $id, 'left_today' => DAILY_CAP - $u['count']]);
