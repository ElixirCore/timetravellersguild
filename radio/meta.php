<?php
declare(strict_types=1);
/**
 * radio/meta.php — proxy for Icecast status JSON (avoids CORS).
 * Called by the radio page to get now-playing metadata.
 */
require_once dirname(__DIR__) . '/inc/env.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');

// ── Local relay meta (from source.php buffer) ────────────
$bufDir  = ttg_env('RADIO_BUFFER_DIR', '/home/ffilsyql/ttg-private');
$metFile = rtrim($bufDir, '/') . '/radio-meta.json';
if (is_readable($metFile)) {
    $raw  = @file_get_contents($metFile);
    $data = $raw !== false ? (json_decode($raw, true) ?? []) : [];
    if (!empty($data)) {
        echo json_encode([
            'ok'        => true,
            'live'      => $data['live'] ?? false,
            'title'     => $data['title'] ?? null,
            'artist'    => null,
            'listeners' => 0,
            'bitrate'   => $data['bitrate'] ?? null,
            'genre'     => $data['genre'] ?? null,
            'desc'      => $data['name'] ?? null,
        ]);
        exit;
    }
}

$icecast = rtrim(ttg_env('RADIO_ICECAST_URL', ''), '/');
$mount   = ttg_env('RADIO_ICECAST_MOUNT', '/stream');

if ($icecast === '') {
    echo json_encode(['ok' => false, 'error' => 'no icecast url configured']);
    exit;
}

$url = $icecast . '/status-json.xsl';
$ctx = stream_context_create(['http' => ['timeout' => 4, 'ignore_errors' => true]]);
$raw = @file_get_contents($url, false, $ctx);

if ($raw === false) {
    echo json_encode(['ok' => false, 'error' => 'fetch failed']);
    exit;
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    echo json_encode(['ok' => false, 'error' => 'bad response']);
    exit;
}

// Flatten: find the matching mountpoint source
$sources = $data['icestats']['source'] ?? [];
if (isset($sources['listenurl'])) $sources = [$sources]; // single source

$match = null;
foreach ($sources as $src) {
    if (isset($src['listenurl']) && str_ends_with((string)$src['listenurl'], $mount)) {
        $match = $src;
        break;
    }
}
if ($match === null && !empty($sources)) {
    $match = $sources[0];
}

if ($match === null) {
    echo json_encode(['ok' => true, 'live' => false]);
    exit;
}

echo json_encode([
    'ok'       => true,
    'live'     => true,
    'title'    => $match['title'] ?? null,
    'artist'   => $match['artist'] ?? null,
    'listeners'=> (int)($match['listeners'] ?? 0),
    'bitrate'  => $match['bitrate'] ?? null,
    'genre'    => $match['genre'] ?? null,
    'desc'     => $match['server_description'] ?? null,
]);
