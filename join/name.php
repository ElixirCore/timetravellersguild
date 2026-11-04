<?php
declare(strict_types=1);

/** Set the name other travellers see. Only the display name; nothing else on the slip changes. */
require_once dirname(__DIR__) . '/people/inc/db.php';

$user = ttg_current_user();
if (!$user) ttg_redirect('/join/');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') ttg_redirect('/join/?welcome=1');
ttg_require_csrf();

$name = trim(preg_replace('/\s+/u', ' ', (string) ($_POST['display_name'] ?? '')) ?? '');
$name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? '';
if ($name === '') ttg_redirect('/join/?welcome=1');

ttg_db()->prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?')
    ->execute([mb_substr($name, 0, 80), gmdate('c'), (int) $user['id']]);
ttg_redirect('/join/?welcome=1&named=1');
