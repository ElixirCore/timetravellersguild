<?php
declare(strict_types=1);
require_once __DIR__ . '/../inc/db.php';
if (ttg_current_user()) ttg_redirect(ttg_base('profile/'));
$briefNote = ttg_briefing_note(ttg_briefing_read());
$pageTitle = 'Sign in — Time Travellers Guild';
require __DIR__ . '/../inc/header.php';
?>
<main class="auth-wrap">
  <section class="auth-card slip">
    <p class="beat-label">ZIPLOCK · MAGIC LINK</p>
    <h1>ENTER THE REGISTER</h1>
    <p>No password. A single-use link is sent to your email. Then you punch your own slip.</p>
    <?php if ($briefNote !== ''): ?>
      <p class="brief-hold">Your front-door briefing travels with this link and is filed on your slip.</p>
      <p class="brief-note"><?= ttg_h($briefNote) ?></p>
    <?php endif; ?>
    <form method="post" action="<?= ttg_h(ttg_base('auth/request.php')) ?>">
      <input type="hidden" name="csrf" value="<?= ttg_h(ttg_csrf_token()) ?>">
      <label>Email address
        <input type="email" name="email" required autocomplete="email" placeholder="you@example.com">
      </label>
      <p class="form-actions">
        <button class="primary" type="submit">SEND THE LINK</button>
        <a class="door" href="/join/"><b>DOOR</b> JOIN</a>
      </p>
    </form>
  </section>
</main>
<?php require __DIR__ . '/../inc/footer.php'; ?>
