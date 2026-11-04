<?php
declare(strict_types=1);
require_once __DIR__ . '/../inc/db.php';

$token = trim((string)($_GET['token'] ?? ''));
// Where to land afterwards: an allow-list (ttg_auth_next), so this cannot become an open redirect.
$next = ttg_auth_next((string)($_GET['next'] ?? ''));
$user = $token !== '' ? ttg_consume_magic_link($token) : null;
if (!$user) {
    // A used or expired link: already signed in? just go there. Otherwise, ask for a fresh link.
    if ($next !== '' && ttg_current_user()) ttg_redirect($next);
    if ($next !== '') ttg_redirect(ttg_base('auth/?next=' . rawurlencode($next)));
    http_response_code(400);
    exit('This magic link is invalid, expired or already used.');
}
ttg_set_session((int)$user['id']);
ttg_redirect($next !== '' ? $next : ttg_base('profile/'));
