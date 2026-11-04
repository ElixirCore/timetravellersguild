<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
header('Cache-Control: no-store');
header('Referrer-Policy: same-origin');
$user = ttg_current_user();
$csrf = ttg_csrf_token();
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
$bar = '';
if (is_file(dirname(__DIR__) . '/inc/network.php')) {
    try { require_once dirname(__DIR__) . '/inc/network.php'; $bar = ttg_network_bar('paper'); } catch (Throwable $e) { $bar = ''; }
}
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#d9cb9e">
<title>Network — Time Travellers Guild</title>
<meta name="description" content="Members of the Guild: the register, the commons, and private messages.">
<link rel="stylesheet" href="/network/app.css?v=1">
<?php if ($bar !== ''): ?><link rel="stylesheet" href="/assets/network.css"><?php endif; ?>
</head>
<body>
<?= $bar ?>
<?php if (!$user): ?>
<main class="card signin">
  <p class="kicker">GUILD NETWORK · MEMBERS ONLY</p>
  <h1>Enter the register</h1>
  <p>Members see each other's 9×9 signets, talk in the commons and send private messages. Sign in with your email. No password: a single-use link arrives by email and the same account works across the Guild.</p>
  <form method="post" action="/network/auth/request.php">
    <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
    <label for="email">Email address</label>
    <input id="email" name="email" type="email" required autocomplete="email" maxlength="160" placeholder="you@example.com">
    <p class="row"><button class="primary" type="submit">Send the link</button> <a class="ghost" href="/join/">Not on the register? Join</a></p>
  </form>
  <p class="fine">Your email is never shown to other members. If you have already filed a /join slip with this address, your name, place and signet are carried over the first time you sign in.</p>
</main>
<?php else: ?>
<div id="net" data-csrf="<?= ttg_h($csrf) ?>" data-pane="list">
  <aside id="side" aria-label="Register and conversations">
    <header class="sidehead">
      <button id="meBtn" class="me" type="button" title="Your slip"><span id="meFace" class="face sm"></span><span id="meName"></span></button>
      <form method="post" action="/network/auth/logout.php"><input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>"><button class="ghost small" type="submit">Sign out</button></form>
    </header>
    <button id="roomBtn" class="row-item" type="button"><span class="room-glyph" aria-hidden="true">#</span><span class="meta"><b>The Commons</b><i>everyone on the network</i></span></button>
    <h2>Conversations</h2>
    <div id="threads" class="list"></div>
    <h2>Register <span id="count" class="fine"></span></h2>
    <input id="search" type="search" placeholder="Search names, places, roles" aria-label="Search members" maxlength="60">
    <div id="members" class="list"></div>
  </aside>
  <main id="main">
    <div id="pane"></div>
  </main>
</div>
<script src="/network/app.js?v=1" defer></script>
<?php endif; ?>
</body>
</html>
