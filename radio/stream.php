<?php
declare(strict_types=1);
/**
 * radio/stream.php — Audio relay for listeners.
 *
 * Tails the relay buffer written by source.php and streams it
 * to the client with appropriate Icecast/Shoutcast headers.
 */

require_once dirname(__DIR__) . '/inc/env.php';

@set_time_limit(0);
ignore_user_abort(false);

$bufDir  = ttg_env('RADIO_BUFFER_DIR', '/home/ffilsyql/ttg-private');
$bufFile = rtrim($bufDir, '/') . '/radio-stream.buf';
$metFile = rtrim($bufDir, '/') . '/radio-meta.json';

// ── Check if live ────────────────────────────────────────
$meta        = [];
$rawMeta     = @file_get_contents($metFile);
if ($rawMeta !== false) {
    $meta = json_decode($rawMeta, true) ?? [];
}
$live = ($meta['live'] ?? false) === true;

if (!$live || !file_exists($bufFile)) {
    http_response_code(503);
    header('Content-Type: text/plain');
    header('Retry-After: 10');
    echo 'Stream not live';
    exit;
}

// ── Headers ──────────────────────────────────────────────
$contentType = $meta['content_type'] ?? 'audio/mpeg';
header('Content-Type: ' . $contentType);
header('Cache-Control: no-cache, no-store');
header('Pragma: no-cache');
header('X-Content-Duration: 0');
header('icy-name: ' . ttg_env('RADIO_STATION_NAME', 'TIMETRAVELLERS GUILD RADIO'));
header('icy-genre: ' . ($meta['genre'] ?? 'Temporal'));
header('icy-br: ' . ($meta['bitrate'] ?? '128'));
header('icy-metaint: 0');

// Start from the current end of the buffer so listeners don't
// receive stale/buffered data from before they tuned in.
$startOffset = filesize($bufFile);
$fh = @fopen($bufFile, 'rb');
if (!$fh) {
    http_response_code(503);
    exit;
}
if ($startOffset > 0) {
    fseek($fh, $startOffset);
}

@ob_end_flush();
@flush();

// ── Tail loop ────────────────────────────────────────────
$idleMs = 0;
while (connection_status() === CONNECTION_NORMAL) {
    $chunk = @fread($fh, 8192);
    if ($chunk === false || $chunk === '') {
        // No new data — check if source is still live
        if ($idleMs > 30000) break;   // 30s of silence → hang up
        $idleMs += 100;
        usleep(100000);
        // Re-check meta
        $rawMeta = @file_get_contents($metFile);
        if ($rawMeta !== false) {
            $m = json_decode($rawMeta, true) ?? [];
            if (($m['live'] ?? false) === false) break;
        }
        continue;
    }
    $idleMs = 0;
    echo $chunk;
    @flush();
}

@fclose($fh);
