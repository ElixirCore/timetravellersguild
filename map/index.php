<?php
declare(strict_types=1);
require_once __DIR__ . '/../people/inc/db.php';

// /map/interface/ includes this file with $TTG_INTERFACE = true: the same map, in the Guild's cyberpunk ARG skin.
$interface = !empty($TTG_INTERFACE);
// /map/play/ includes this file with $TTG_PLAY = true: the same parchment map, with the Guild game docked beside it.
$play = !empty($TTG_PLAY);
$user = ttg_current_user();
if (!$user) {
    header('Location: ' . ttg_base('auth/?next=' . urlencode($interface ? '/map/interface/' : ($play ? '/map/play/' : '/map/'))));
    exit;
}

// Historic OS maps come from the National Library of Scotland via MapTiler, which needs a key.
// MapTiler keys are meant for the browser (restrict them to this domain in the MapTiler dashboard).
// Set MAPTILER_KEY in map/secret_agent.php (returned array) or the server environment.
$maptiler = '';
$europeana = false; // only whether a key exists: the Europeana key itself stays on the server (proxy.php uses it)
$secretFile = __DIR__ . '/secret_agent.php';
if (is_file($secretFile)) {
    $secrets = (static fn(string $f) => require $f)($secretFile);
    if (is_array($secrets) && is_string($secrets['MAPTILER_KEY'] ?? null)) $maptiler = $secrets['MAPTILER_KEY'];
    if (is_array($secrets) && is_string($secrets['EUROPEANA_KEY'] ?? null) && $secrets['EUROPEANA_KEY'] !== '') $europeana = true;
}
if (!$europeana && (string) (getenv('EUROPEANA_KEY') ?: '') !== '') $europeana = true;
// Flickr photos: only whether a key exists (proxy.php holds the key itself).
$flickr = is_array($secrets ?? null) && preg_match('/^[0-9a-f]{32}$/i', (string) ($secrets['FLICKR_KEY'] ?? '')) === 1;
if (!$flickr && preg_match('/^[0-9a-f]{32}$/i', (string) (getenv('FLICKR_KEY') ?: '')) === 1) $flickr = true;
// Mapillary street-level photos: a client token (MLY|app id|hash), made for use in the browser like the MapTiler key.
$mapillary = is_array($secrets ?? null) ? (string) ($secrets['MAPILLARY_TOKEN'] ?? '') : '';
if ($mapillary === '') $mapillary = (string) (getenv('MAPILLARY_TOKEN') ?: '');
if (!preg_match('/^MLY\|\d{5,25}\|[0-9a-f]{20,64}$/i', $mapillary)) $mapillary = '';
if ($maptiler === '') $maptiler = (string) (getenv('MAPTILER_KEY') ?: '');
if (!preg_match('/^[A-Za-z0-9_-]{8,80}$/', $maptiler)) $maptiler = '';

$cfg = ['record' => '/map/record.php', 'live' => '/map/live.php', 'trail' => '/map/trail.php', 'maptiler' => $maptiler, 'europeana' => $europeana, 'flickr' => $flickr, 'mapillary' => $mapillary,
    'agent' => '/map/agent.php', 'proxy' => '/map/proxy.php'];
if ($interface) {
    $cfg['interface'] = true;
    $cfg['arg'] = '/map/arg/api.php';
    $cfg['csrf'] = ttg_csrf_token();
    $cfg['me'] = (string) $user['display_name'];
}
if ($play) {
    $cfg['game'] = '/map/game/api.php';
    $cfg['csrf'] = ttg_csrf_token();
}
$html = file_get_contents(__DIR__ . '/index.html');
// Inject endpoint overrides (and the optional MapTiler key) before </head>
$inject = '<script>window.TTG_MAP=' . json_encode($cfg, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) . ';</script>';
if ($interface) {
    $inject .= '<link rel="stylesheet" href="/map/arg/interface.css?v=1">';
    $html = str_replace('<title>Passport Map — Time Travellers Guild</title>', '<title>GUILD://INTERFACE — Time Travellers Guild</title>', $html);
    $html = str_replace('</body>', '<script src="/map/arg/interface.js?v=1" defer></script></body>', $html);
}
if ($play) {
    $inject .= '<link rel="stylesheet" href="/map/game/game.css?v=2">';
    $html = str_replace('<title>Passport Map — Time Travellers Guild</title>', '<title>The Desk — Time Travellers Guild</title>', $html);
    $html = str_replace('</body>', '<script src="/map/game/game.js?v=2" defer></script></body>', $html);
}
echo str_replace('</head>', $inject . '</head>', $html);
