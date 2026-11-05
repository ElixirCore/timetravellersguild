<?php
declare(strict_types=1);
require_once __DIR__ . '/../people/inc/db.php';

// /map/interface/ includes this file with $TTG_INTERFACE = true: the same map, in the Guild's cyberpunk ARG skin.
$interface = !empty($TTG_INTERFACE);
$user = ttg_current_user();
if (!$user) {
    header('Location: ' . ttg_base('auth/?next=' . urlencode($interface ? '/map/interface/' : '/map/')));
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
if ($maptiler === '') $maptiler = (string) (getenv('MAPTILER_KEY') ?: '');
if (!preg_match('/^[A-Za-z0-9_-]{8,80}$/', $maptiler)) $maptiler = '';

$cfg = ['record' => '/map/record.php', 'live' => '/map/live.php', 'trail' => '/map/trail.php', 'maptiler' => $maptiler, 'europeana' => $europeana,
    'agent' => '/map/agent.php', 'proxy' => '/map/proxy.php'];
if ($interface) {
    $cfg['interface'] = true;
    $cfg['arg'] = '/map/arg/api.php';
    $cfg['csrf'] = ttg_csrf_token();
    $cfg['me'] = (string) $user['display_name'];
}
$html = file_get_contents(__DIR__ . '/index.html');
// Inject endpoint overrides (and the optional MapTiler key) before </head>
$inject = '<script>window.TTG_MAP=' . json_encode($cfg, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) . ';</script>';
if ($interface) {
    $inject .= '<link rel="stylesheet" href="/map/arg/interface.css?v=1">';
    $html = str_replace('<title>Passport Map — Time Travellers Guild</title>', '<title>GUILD://INTERFACE — Time Travellers Guild</title>', $html);
    $html = str_replace('</body>', '<script src="/map/arg/interface.js?v=1" defer></script></body>', $html);
}
echo str_replace('</head>', $inject . '</head>', $html);
