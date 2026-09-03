<?php
declare(strict_types=1);
$uri = urldecode((string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'));
$root = __DIR__;
$file = $root . $uri;

if (preg_match('#(?:^|/)\.env(?:$|\.|/)#i', $uri) || preg_match('#^/(app|prompts|storage|data/jack)(/|$)#', $uri)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Forbidden\n";
    return true;
}

if (preg_match('#^/department/assets/#', $uri) || preg_match('#^/department/.+\.(css|js|json|png|svg|ico)$#', $uri)) {
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
if ($uri === '/jack' || $uri === '/jack/') {
    require $root . '/jack/index.php';
    return true;
}
if ($uri === '/now/capture' || $uri === '/now/capture/') {
    require $root . '/now/capture.php';
    return true;
}
if ($uri === '/now' || $uri === '/now/') {
    require $root . '/index.php';
    return true;
}

if (preg_match('#^/n(?:/([A-Za-z0-9_-]+))?/?$#', $uri, $m)) {
    if (isset($m[1]) && $m[1] !== '') {
        $_GET['id'] = $m[1];
    }
    require $root . '/n/index.php';
    return true;
}

if ($uri !== '/' && is_file($file)) {
    return false;
}
if (is_dir($file)) {
    foreach (['index.php', 'index.html'] as $idx) {
        $candidate = rtrim($file, '/') . '/' . $idx;
        if (is_file($candidate)) {
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
