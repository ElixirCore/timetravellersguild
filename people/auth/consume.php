<?php
declare(strict_types=1);
require_once __DIR__ . '/../inc/db.php';

$token = trim((string)($_GET['token'] ?? ''));
$user = $token !== '' ? ttg_consume_magic_link($token) : null;
if (!$user) {
    http_response_code(400);
    exit('This magic link is invalid, expired or already used.');
}
ttg_set_session((int)$user['id']);
ttg_redirect(ttg_base('profile/'));
