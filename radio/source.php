<?php
declare(strict_types=1);
/**
 * radio/source.php — Icecast-compatible source endpoint.
 *
 * Configure BUTT:
 *   Server type : Icecast 2
 *   Address     : timetravellersguild.com
 *   Port        : 80  (or 443 for HTTPS)
 *   Password    : <RADIO_SOURCE_PASSWORD>
 *   Mountpoint  : /radio/source
 *
 * BUTT opens a SOURCE connection; this script reads the incoming audio
 * stream and writes chunks to the relay buffer file. Listeners connect
 * to radio/stream.php which tails that buffer.
 */

require_once dirname(__DIR__) . '/inc/env.php';

@set_time_limit(0);
ignore_user_abort(false);

// ── Auth ─────────────────────────────────────────────────
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$pass       = ttg_env('RADIO_SOURCE_PASSWORD', 'hackme');
$expected   = 'Basic ' . base64_encode('source:' . $pass);

if ($authHeader !== $expected) {
    http_response_code(401);
    header('WWW-Authenticate: Basic realm="Icecast 2.0"');
    header('Content-Type: text/plain');
    echo 'Unauthorized';
    exit;
}

// ── Buffer file ──────────────────────────────────────────
$bufDir  = ttg_env('RADIO_BUFFER_DIR', '/home/ffilsyql/ttg-private');
$bufFile = rtrim($bufDir, '/') . '/radio-stream.buf';
$metFile = rtrim($bufDir, '/') . '/radio-meta.json';

// Write source metadata (content-type, bitrate etc.)
$meta = [
    'live'        => true,
    'started'     => time(),
    'content_type'=> $_SERVER['HTTP_CONTENT_TYPE'] ?? 'audio/mpeg',
    'bitrate'     => $_SERVER['HTTP_X_AUDIOCAST_BITRATE'] ?? null,
    'name'        => $_SERVER['HTTP_X_AUDIOCAST_NAME'] ?? null,
    'genre'       => $_SERVER['HTTP_X_AUDIOCAST_GENRE'] ?? null,
    'title'       => null,
];
@file_put_contents($metFile, json_encode($meta));

// Touch the buffer file
@file_put_contents($bufFile, '', LOCK_EX);

// Icecast OK response
header('HTTP/1.0 200 OK');
@ob_end_flush();
@flush();

// ── Stream relay loop ────────────────────────────────────
$input  = @fopen('php://input', 'rb');
$output = @fopen($bufFile, 'ab');

if (!$input || !$output) {
    http_response_code(500);
    exit;
}

while (!feof($input) && connection_status() === CONNECTION_NORMAL) {
    $chunk = @fread($input, 8192);
    if ($chunk === false || $chunk === '') {
        usleep(10000);
        continue;
    }
    @fwrite($output, $chunk);
    @fflush($output);
}

// Mark stream as ended
@fclose($output);
@fclose($input);
@file_put_contents($metFile, json_encode(array_merge($meta, ['live' => false, 'ended' => time()])));
