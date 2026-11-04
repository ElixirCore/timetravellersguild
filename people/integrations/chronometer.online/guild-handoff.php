<?php
declare(strict_types=1);

/*
Install at: /auth/guild-handoff.php
This endpoint receives a short-lived signed token from timetravellersguild.com,
verifies it, then sets a local secure cookie for this domain.

IMPORTANT: set the same shared secret used in /people/inc/config.php.
*/
const TTG_SHARED_SECRET = 'CHANGE_ME_TO_THE_SAME_LONG_RANDOM_SECRET';
const TTG_EXPECTED_AUDIENCE = 'chronometer.online';
const TTG_LOCAL_COOKIE = 'chronometer_guild_session';

function b64url_decode_str(string $data): string|false {
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($data, '-_', '+/'), true);
}

function verify_handoff(string $token): ?array {
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) return null;
    [$body, $sig] = $parts;
    $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $body, TTG_SHARED_SECRET, true)), '+/', '-_'), '=');
    if (!hash_equals($expected, $sig)) return null;
    $decoded = b64url_decode_str($body);
    if ($decoded === false) return null;
    $payload = json_decode($decoded, true);
    if (!is_array($payload)) return null;
    if (($payload['aud'] ?? '') !== TTG_EXPECTED_AUDIENCE) return null;
    if (($payload['iss'] ?? '') !== 'timetravellersguild.com') return null;
    if (time() > (int)($payload['exp'] ?? 0)) return null;
    return $payload;
}

$payload = verify_handoff((string)($_GET['token'] ?? ''));
if (!$payload) {
    http_response_code(400);
    exit('Invalid or expired Guild handoff.');
}

/*
For production, store a local session record server-side and put only a random
session identifier in the cookie. This compact receiver signs a local cookie
directly for easy deployment.
*/
$local = [
    'sub' => $payload['sub'],
    'email' => $payload['email'],
    'name' => $payload['name'],
    'slug' => $payload['slug'],
    'exp' => time() + 60 * 60 * 24 * 30,
];
$body = rtrim(strtr(base64_encode(json_encode($local)), '+/', '-_'), '=');
$sig = rtrim(strtr(base64_encode(hash_hmac('sha256', $body, TTG_SHARED_SECRET, true)), '+/', '-_'), '=');

setcookie(TTG_LOCAL_COOKIE, $body . '.' . $sig, [
    'expires' => $local['exp'],
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);

header('Location: /', true, 302);
exit;
