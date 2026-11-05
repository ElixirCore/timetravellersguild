<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/inc/avatar.php';

function ttg_config(): array {
    static $config;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

if (!function_exists('ttg_h')) {
    function ttg_h(string $value): string {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

function ttg_base(string $path = ''): string {
    // Auth links must never derive their origin from request/proxy headers.
    $base = rtrim((string) ttg_config()['base_url'], '/');
    return $base . ($path !== '' ? '/' . ltrim($path, '/') : '');
}

function ttg_b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function ttg_b64url_decode(string $data): string|false {
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($data, '-_', '+/'), true);
}

function ttg_sign(array $payload, ?string $secret = null): string {
    $secret ??= (string)ttg_config()['app_secret'];
    $body = ttg_b64url_encode(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    $sig = ttg_b64url_encode(hash_hmac('sha256', $body, $secret, true));
    return $body . '.' . $sig;
}

function ttg_verify(string $token, ?string $secret = null): ?array {
    $secret ??= (string)ttg_config()['app_secret'];
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) return null;
    [$body, $sig] = $parts;
    $expected = ttg_b64url_encode(hash_hmac('sha256', $body, $secret, true));
    if (!hash_equals($expected, $sig)) return null;
    $decoded = ttg_b64url_decode($body);
    if ($decoded === false) return null;
    $payload = json_decode($decoded, true);
    if (!is_array($payload)) return null;
    if (isset($payload['exp']) && time() > (int)$payload['exp']) return null;
    return $payload;
}

function ttg_random_token(int $bytes = 32): string {
    return ttg_b64url_encode(random_bytes($bytes));
}

function ttg_slug(string $value): string {
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    return trim($value, '-') ?: 'traveller';
}

function ttg_redirect(string $url): never {
    header('Location: ' . $url, true, 302);
    exit;
}

function ttg_json(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function ttg_csrf_token(): string {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = ttg_random_token(24);
    return (string)$_SESSION['csrf'];
}

/**
 * Where a sign-in may land afterwards. An allow-list of site paths, so a
 * `next` value can never become an open redirect. Returns '' if not allowed.
 */
function ttg_auth_next(string $next): string {
    return preg_match('#^/(?:join/\?welcome=1|map/(?:interface/|play/)?|passport/|people/chat/(?:\?c=\d{1,10})?)$#', $next) === 1 ? $next : '';
}

function ttg_cookie_secure(): bool
{
    return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
}

function ttg_user_hydrate(?array $user): ?array
{
    if ($user === null) {
        return null;
    }
    $user['avatar'] = ttg_pixel_parse($user['avatar_pixels'] ?? '');
    return $user;
}

function ttg_require_csrf(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $given = (string)($_POST['csrf'] ?? '');
    $stored = (string)($_SESSION['csrf'] ?? '');
    if ($stored === '' || !hash_equals($stored, $given)) {
        http_response_code(400);
        exit('Invalid request token.');
    }
}
