<?php
declare(strict_types=1);
require_once __DIR__ . '/../inc/db.php';
require_once __DIR__ . '/../inc/terms.php';

$user = ttg_current_user();
if (!$user) ttg_redirect(ttg_base('auth/'));
if ($_SERVER['REQUEST_METHOD'] !== 'POST') ttg_redirect(ttg_base('profile/'));
ttg_require_csrf();

/* The avatar and name are lent to the grand narrative: agree once, here on the slip or at /people/agree/. */
if (!ttg_terms_agreed($user)) {
    if (empty($_POST['agree_terms'])) {
        http_response_code(422);
        exit('Tick the grand narrative agreement on your slip to save it. Go back to keep your changes.');
    }
    ttg_terms_record((int) $user['id']);
}

$name = trim((string) ($_POST['display_name'] ?? ''));
$role = trim((string) ($_POST['role'] ?? 'traveller'));
$location = trim((string) ($_POST['location'] ?? ''));
$bio = trim((string) ($_POST['bio'] ?? ''));
$isPublic = isset($_POST['is_public']) ? 1 : 0;
$pixels = ttg_pixel_encode(ttg_pixel_parse((string) ($_POST['avatar_pixels'] ?? '')));

if ($name === '') {
    http_response_code(422);
    exit('A name is required on the slip.');
}

$stmt = ttg_db()->prepare('UPDATE users SET display_name=?, role=?, location=?, avatar_pixels=?, bio=?, is_public=?, updated_at=? WHERE id=?');
$stmt->execute([
    mb_substr($name, 0, 80),
    mb_substr($role !== '' ? $role : 'traveller', 0, 80),
    mb_substr($location, 0, 120),
    $pixels,
    mb_substr($bio, 0, 600),
    $isPublic,
    gmdate('c'),
    $user['id'],
]);
ttg_redirect(ttg_base('profile/?punched=1'));
