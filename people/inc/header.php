<?php
declare(strict_types=1);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/chat.php';
require_once dirname(__DIR__, 2) . '/inc/network.php';
$user = ttg_current_user();
$pageTitle = $pageTitle ?? 'People — The Time Travellers Guild';
$path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$onPeople = preg_match('#^/people/?$#', $path) === 1;
$onProfile = str_contains($path, '/people/profile');
$onAuth = str_contains($path, '/people/auth');
$onChat = str_contains($path, '/people/chat');
$chatUnread = $user ? ttg_chat_unread_total((int) $user['id']) : 0;
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#d9cb9e">
<title><?= ttg_h($pageTitle) ?></title>
<?= ttg_og_head(['title' => $pageTitle, 'url' => 'https://timetravellersguild.com' . $path]) ?>
<link rel="stylesheet" href="<?= ttg_h(ttg_base('assets/css/people.css')) ?>?v=punch3">
<link rel="stylesheet" href="/assets/avatar.css?v=1">
<link rel="stylesheet" href="/assets/network.css">
<link rel="stylesheet" href="/people/assets/css/chat.css?v=8">
</head>
<body>
<?= ttg_network_bar('paper') ?>
<header class="site-header">
  <a class="wordmark" href="/">TIMETRAVELLERSGUILD.COM</a>
  <nav>
    <a href="<?= ttg_h(ttg_base()) ?>"<?= $onPeople ? ' aria-current="page"' : '' ?>>register</a>
    <?php if ($user): ?>
      <a href="/people/chat/"<?= $onChat ? ' aria-current="page"' : '' ?> id="navChat">chat<?php if ($chatUnread > 0): ?> <span class="nav-unread"><?= $chatUnread > 99 ? '99+' : $chatUnread ?></span><?php endif; ?></a>
      <a href="<?= ttg_h(ttg_base('profile/')) ?>"<?= $onProfile ? ' aria-current="page"' : '' ?>>your slip</a>
      <a href="<?= ttg_h(ttg_base('auth/logout.php')) ?>">sign out</a>
    <?php else: ?>
      <a href="<?= ttg_h(ttg_base('auth/')) ?>"<?= $onAuth ? ' aria-current="page"' : '' ?>>sign in</a>
    <?php endif; ?>
  </nav>
</header>
