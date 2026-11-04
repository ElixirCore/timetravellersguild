<?php
declare(strict_types=1);

require_once __DIR__ . '/inc/graph.php';

$template = __DIR__ . '/index.html';
if (!is_file($template)) {
    $template = __DIR__ . '/indexold.html';
}
$html = file_get_contents($template);
if ($html === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "NOW is unreadable.\n";
    exit;
}

$payload = ttg_now_payload();
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '{"field":[],"edges":[],"you":{"known":false}}';
}

$local = new DateTimeImmutable('now');
$clock = strtoupper($local->format('H:i:s · l d F Y'));
$localPresent = $local->format('d.m.Y');
$youHref = (string) ($payload['you']['href'] ?? '/people/auth/');
$position = (string) ($payload['position'] ?? 'PRE-TRAVEL CIVILISATION');
$greeting = (string) ($payload['jack']['greeting'] ?? '');
if ($greeting !== '') {
    ttg_jack_queue_speech($greeting);
}

$mode = defined('TTG_NOW_MODE') ? (string) TTG_NOW_MODE : '';
if ($mode !== '' && !in_array($mode, ['now', 'boot', 'view'], true)) {
    $mode = '';
}
$inject = ($mode !== '' ? 'window.TTG_MODE=' . json_encode($mode, JSON_UNESCAPED_SLASHES) . ';' : '')
    . 'window.TTG_GRAPH=' . $json . ';';
$html = str_replace('/* TTG_GRAPH */', $inject, $html);
if ($mode === 'boot') {
    $html = str_replace(
        'https://timetravellersguild.com/now/tree',
        'https://timetravellersguild.com/now',
        $html
    );
}
$html = str_replace('<!-- TTG_FALLBACK -->', ttg_now_fallback_html(), $html);
$html = str_replace('<!-- TTG_CLOCK -->', ttg_h($clock), $html);
$html = str_replace('<!-- TTG_LOCAL_PRESENT -->', ttg_h($localPresent), $html);
$html = str_replace('<!-- TTG_POSITION -->', ttg_h($position), $html);
$html = str_replace('<!-- TTG_JACK -->', ttg_h($greeting), $html);
$html = str_replace('<!-- TTG_CSRF -->', ttg_h((string) ($payload['csrf'] ?? '')), $html);
$viewer = ttg_graph_viewer();
$html = str_replace('<!-- TTG_YOU_DOCK -->', ttg_html_navigator_dock($viewer), $html);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Clear-Site-Data: "cache"');
echo $html;
