<?php
header('Content-Type: application/json');
require __DIR__.'/config.php';

function fail($code, $msg) { http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg]); exit; }


$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) fail(400, 'bad json');
$mode    = (string)($in['mode'] ?? '');
$prompt  = trim((string)($in['prompt'] ?? ''));
$seconds = (int)($in['seconds'] ?? 0);

$durs = ['music' => [15, 30, 45, 60], 'sfx' => [3, 5, 8, 12]];
if (!isset($durs[$mode])) fail(400, 'bad mode');
if (!in_array($seconds, $durs[$mode], true)) fail(400, 'bad length');
if ($prompt === '' || mb_strlen($prompt) > 500) fail(400, 'prompt 1-500 chars');

// --- daily cap + pacing, under lock ---
$usageFile = __DIR__.'/.usage.json';
$uf = fopen($usageFile, 'c+');
if (!$uf) fail(500, 'usage store');
flock($uf, LOCK_EX);
$u = json_decode((string)stream_get_contents($uf), true);
if (!is_array($u)) $u = [];
$today = gmdate('Y-m-d');
if (($u['date'] ?? '') !== $today) $u = ['date' => $today, 'count' => 0, 'credits' => 0, 'last' => 0];
if ((int)$u['count'] >= DAILY_CAP) { flock($uf, LOCK_UN); fclose($uf); fail(429, 'daily cap reached ('.DAILY_CAP.')'); }
$wait = MIN_INTERVAL - (time() - (int)($u['last'] ?? 0));
if ($wait > 0) { flock($uf, LOCK_UN); fclose($uf); fail(429, 'wait '.$wait.'s'); }

// --- call ElevenLabs ---
if ($mode === 'music') {
    $url = 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128';
    $body = ['prompt' => $prompt, 'music_length_ms' => $seconds * 1000, 'model_id' => 'music_v1'];
    $est = $seconds * MUSIC_CR_SEC;
} else {
    $url = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128';
    $body = ['text' => $prompt, 'duration_seconds' => $seconds, 'prompt_influence' => 0.4];
    $est = $seconds * SFX_CR_SEC;
}
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['xi-api-key: '.EL_API_KEY, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($body),
    CURLOPT_TIMEOUT => 170,
    CURLOPT_CONNECTTIMEOUT => 20,
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
    fail(502, 'elevenlabs '.$code.($err ? ' '.$err : '').($detail ? ' — '.$detail : ''));
}

// --- store clip ---
$clipsDir = __DIR__.'/clips';
if (!is_dir($clipsDir)) { @mkdir($clipsDir, 0755, true); }
$id = gmdate('Ymd-His').'-'.bin2hex(random_bytes(3));
$file = $id.'.mp3';
file_put_contents($clipsDir.'/'.$file, $audio);

$metaFile = __DIR__.'/.clips.json';
$mf = fopen($metaFile, 'c+');
flock($mf, LOCK_EX);
$clips = json_decode((string)stream_get_contents($mf), true);
if (!is_array($clips)) $clips = [];
$clips[] = ['id' => $id, 'file' => $file, 'prompt' => $prompt, 'mode' => $mode, 'seconds' => $seconds, 'credits' => $est, 'ts' => time()];
$clips = array_slice($clips, -80);
ftruncate($mf, 0); rewind($mf); fwrite($mf, json_encode($clips));
flock($mf, LOCK_UN); fclose($mf);

$u['count']++; $u['credits'] += $est; $u['last'] = time();
ftruncate($uf, 0); rewind($uf); fwrite($uf, json_encode($u));
flock($uf, LOCK_UN); fclose($uf);

echo json_encode(['ok' => true, 'id' => $id, 'credits' => $est, 'left_today' => DAILY_CAP - $u['count']]);