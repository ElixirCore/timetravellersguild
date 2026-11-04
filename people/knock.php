<?php
declare(strict_types=1);
require_once __DIR__ . '/inc/db.php';
$user = ttg_current_user();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

ttg_require_csrf($_POST['csrf'] ?? '');

if (!$user) {
    header('Location: ' . ttg_base('auth/?next=' . urlencode('/people/')));
    exit;
}

$toSlug = preg_replace('/[^a-z0-9-]/', '', strtolower((string)($_POST['to_slug'] ?? '')));
$message = mb_substr(trim((string)($_POST['message'] ?? '')), 0, 160);

$target = $toSlug !== '' ? ttg_user_by_slug($toSlug) : null;
if (!$target) {
    http_response_code(404);
    exit;
}

$sent = ttg_send_knock((int)$user['id'], (int)$target['id'], $message);

$param = $sent ? 'knocked' : 'blocked';
header('Location: /people/' . rawurlencode($toSlug) . '/?' . $param . '=1');
exit;
