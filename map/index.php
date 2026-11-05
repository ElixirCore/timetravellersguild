<?php
declare(strict_types=1);
require_once __DIR__ . '/../people/inc/db.php';

$user = ttg_current_user();
if (!$user) {
    header('Location: ' . ttg_base('auth/?next=' . urlencode('/map/')));
    exit;
}

// Historic OS maps come from the National Library of Scotland via MapTiler, which needs a key.
// MapTiler keys are meant for the browser (restrict them to this domain in the MapTiler dashboard).
// Set MAPTILER_KEY in map/secret_agent.php (returned array) or the server environment.
$maptiler = '';
$secretFile = __DIR__ . '/secret_agent.php';
if (is_file($secretFile)) {
    $secrets = (static fn(string $f) => require $f)($secretFile);
    if (is_array($secrets) && is_string($secrets['MAPTILER_KEY'] ?? null)) $maptiler = $secrets['MAPTILER_KEY'];
}
if ($maptiler === '') $maptiler = (string) (getenv('MAPTILER_KEY') ?: '');
if (!preg_match('/^[A-Za-z0-9_-]{8,80}$/', $maptiler)) $maptiler = '';

$cfg = ['record' => '/map/record.php', 'live' => '/map/live.php', 'trail' => '/map/trail.php', 'maptiler' => $maptiler];
$html = file_get_contents(__DIR__ . '/index.html');
// Inject endpoint overrides (and the optional MapTiler key) before </head>
$inject = '<script>window.TTG_MAP=' . json_encode($cfg, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) . ';</script>';
echo str_replace('</head>', $inject . '</head>', $html);
