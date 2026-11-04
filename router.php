<?php
declare(strict_types=1);
require_once __DIR__ . '/app/Http/PublicPath.php';
require_once __DIR__ . '/app/Privacy/WithdrawnMedia.php';
$uri = rawurldecode(explode('?', (string) ($_SERVER['REQUEST_URI'] ?? '/'), 2)[0]);
$root = (string) realpath(__DIR__);

if (!str_starts_with($uri, '/') || PublicPath::denied($uri)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Forbidden\n";
    return true;
}

if (str_starts_with(strtolower($uri), '/feed/images/') && WithdrawnMedia::contains(basename($uri))) {
    http_response_code(410);
    header('Cache-Control: no-store');
    header('Content-Type: text/plain; charset=utf-8');
    echo "Gone\n";
    return true;
}

// Existing symlinks must pass the same boundary and private-path checks.
$file = PublicPath::resolve($root, $uri);
if ($file === false && (file_exists($root . $uri) || is_link($root . $uri))) {
    http_response_code(403);
    echo "Forbidden\n";
    return true;
}

if ($file !== false && is_file($file) && (preg_match('#^/department/assets/#', $uri) || preg_match('#^/department/.+\.(css|js|json|png|svg|ico)$#', $uri))) {
    return false;
}
if ($uri === '/department' || str_starts_with($uri, '/department/')) {
    require $root . '/department/index.php';
    return true;
}

if ($uri === '/now/jack' || $uri === '/now/jack/') {
    require $root . '/now/jack.php';
    return true;
}
if ($uri === '/jack/speak' || $uri === '/jack/speak/') {
    require $root . '/jack/speak.php';
    return true;
}
if ($uri === '/jack/room-action' || $uri === '/jack/room-action/') {
    require $root . '/jack/room-action.php';
    return true;
}
if ($uri === '/jack/office-action' || $uri === '/jack/office-action/') {
    require $root . '/jack/office-action.php';
    return true;
}
if ($uri === '/jack/office' || $uri === '/jack/office/') {
    require $root . '/jack/office.php';
    return true;
}
if ($uri === '/jack/room' || $uri === '/jack/room/') {
    if (PublicPath::resolve($root, '/jack/room/index.html') !== false) {
        return false;
    }
    header('Location: /jack/body/', true, 302);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Redirecting to /jack/body/\n";
    return true;
}
if ($uri === '/jack/ledger' || $uri === '/jack/ledger/') {
    require $root . '/jack/ledger.php';
    return true;
}
if (preg_match('#^/jack/puzzle/check(?:\\.php)?/?$#', $uri)) {
    require $root . '/jack/puzzle/check.php';
    return true;
}
if ($uri === '/jack/puzzle' || $uri === '/jack/puzzle/') {
    require $root . '/jack/puzzle/index.php';
    return true;
}
if (preg_match('#^/(?:jack/tarot/)?deck(?:/([A-Za-z0-9-]+))?/?$#', $uri, $m)) {
    if (!empty($m[1]) && !isset($_GET['card'])) {
        $_GET['card'] = $m[1];
    }
    require $root . '/jack/tarot/deck/index.php';
    return true;
}
if ($uri === '/jack/tarot' || $uri === '/jack/tarot/') {
    require $root . '/jack/tarot/index.php';
    return true;
}
if ($uri === '/jack/tarot/read.php') {
    require $root . '/jack/tarot/read.php';
    return true;
}
if ($uri === '/jack/body' || $uri === '/jack/body/') {
    $body = PublicPath::resolve($root, '/jack/body/index.html');
    if ($body !== false) return false;
}
if ($uri === '/api/machine/state' || $uri === '/api/machine/state/') {
    require $root . '/machine/api.php';
    return true;
}
if (preg_match('#^/api/map/([a-z]+)/?$#', $uri, $m)) {
    $_GET['op'] = $m[1];
    require $root . '/jack/map/api.php';
    return true;
}
if ($uri === '/jack/map' || $uri === '/jack/map/') {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $map = PublicPath::resolve($root, '/jack/map/index.html');
    if ($map === false) {
        http_response_code(404);
        return true;
    }
    readfile($map);
    return true;
}
if ($uri === '/jack/room/engine') {
    header('Location: /jack/room/engine/', true, 302);
    return true;
}
if (preg_match('#^/jack/room/engine/(.*)$#', $uri, $m)) {
    $rel = $m[1] === '' ? 'index.html' : $m[1];
    $engineFile = PublicPath::resolve($root . '/jack/body/engine', '/' . $rel);
    $publicEngineFile = PublicPath::resolve($root, '/jack/body/engine/' . $rel);
    if ($engineFile !== false && $engineFile === $publicEngineFile && is_file($engineFile)) {
        $ext = strtolower(pathinfo($engineFile, PATHINFO_EXTENSION));
        $types = [
            'html' => 'text/html; charset=utf-8',
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
            'json' => 'application/json; charset=utf-8',
        ];
        if (!isset($types[$ext])) {
            http_response_code(403);
            return true;
        }
        header('Content-Type: ' . $types[$ext]);
        header('Cache-Control: no-store');
        readfile($engineFile);
        return true;
    }
}
if (preg_match('#^/jack/(?:body|room)/(boot|act|aperture)\\.php$#', $uri, $m)) {
    require $root . '/jack/body/' . $m[1] . '.php';
    return true;
}
if ($uri === '/jack' || $uri === '/jack/') {
    require $root . '/jack/index.php';
    return true;
}
if ($uri === '/now/around' || $uri === '/now/around/') {
    require $root . '/now/around.php';
    return true;
}
if ($uri === '/now/capture' || $uri === '/now/capture/') {
    require $root . '/now/capture.php';
    return true;
}
if ($uri === '/field' || $uri === '/field/') {
    require $root . '/field/index.php';
    return true;
}
if ($uri === '/view/observe' || $uri === '/view/observe/') {
    require $root . '/view/observe.php';
    return true;
}
if ($uri === '/view' || $uri === '/view/') {
    require $root . '/view/index.php';
    return true;
}
if ($uri === '/ad' || $uri === '/ad/') {
    require $root . '/ad/index.php';
    return true;
}
if ($uri === '/auction' || $uri === '/auction/') {
    require $root . '/auction/index.php';
    return true;
}
if ($uri === '/auction/request' || $uri === '/auction/request.php' || $uri === '/auction/request/') {
    require $root . '/auction/request.php';
    return true;
}
if ($uri === '/auction/confirm' || $uri === '/auction/confirm.php' || $uri === '/auction/confirm/') {
    require $root . '/auction/confirm.php';
    return true;
}
if ($uri === '/feed' || $uri === '/feed/') {
    require $root . '/feed/index.php';
    return true;
}
if ($uri === '/intro/act' || $uri === '/intro/act.php' || $uri === '/intro/act/') {
    require $root . '/intro/act.php';
    return true;
}
if ($uri === '/play/act' || $uri === '/play/act.php' || $uri === '/play/act/') {
    require $root . '/play/act.php';
    return true;
}
if ($uri === '/join/act' || $uri === '/join/act.php' || $uri === '/join/act/') {
    require $root . '/join/act.php';
    return true;
}
if ($uri === '/join' || $uri === '/join/') {
    require $root . '/join/index.php';
    return true;
}
if ($uri === '/square' || $uri === '/square/') {
    require $root . '/square/index.php';
    return true;
}
if ($uri === '/one' || $uri === '/one/') {
    header('Location: /jack', true, 302);
    return true;
}
if ($uri === '/cube' || $uri === '/cube/') {
    require $root . '/cube/index.php';
    return true;
}
if ($uri === '/machine' || $uri === '/machine/') {
    require $root . '/machine/index.php';
    return true;
}
if ($uri === '/arianrhod' || $uri === '/arianrhod/') {
    require $root . '/arianrhod/index.php';
    return true;
}
if ($uri === '/navigator' || $uri === '/navigator/') {
    require $root . '/navigator/index.php';
    return true;
}
if ($uri === '/navigator/act' || $uri === '/navigator/act.php' || $uri === '/navigator/act/') {
    require $root . '/navigator/act.php';
    return true;
}
if ($uri === '/' || $uri === '') {
    require $root . '/intro.php';
    return true;
}
if ($uri === '/now/tree' || $uri === '/now/tree/') {
    require $root . '/now/tree/index.php';
    return true;
}
if ($uri === '/now' || $uri === '/now/') {
    require $root . '/now/index.php';
    return true;
}

if (preg_match('#^/n(?:/([A-Za-z0-9_-]+))?/?$#', $uri, $m)) {
    if (isset($m[1]) && $m[1] !== '') {
        $_GET['id'] = $m[1];
    }
    require $root . '/n/index.php';
    return true;
}

if ($uri !== '/' && $file !== false && is_file($file)) {
    return false;
}
if ($file !== false && is_dir($file)) {
    foreach (['index.php', 'index.html'] as $idx) {
        $candidate = PublicPath::resolve($root, rtrim($uri, '/') . '/' . $idx);
        if ($candidate !== false && is_file($candidate)) {
            if (str_ends_with($idx, '.html')) return false;
            require $candidate;
            return true;
        }
    }
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "Not Found\n";
return true;
