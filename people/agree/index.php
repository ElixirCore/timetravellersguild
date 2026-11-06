<?php
declare(strict_types=1);
/*
 * /people/agree/ — the grand narrative agreement. Asked once, before a traveller's first
 * submission, and again only when TTG_TERMS_VERSION changes.
 */
require_once dirname(__DIR__) . '/inc/terms.php';

$user = ttg_current_user();
$next = ttg_terms_next((string) ($_GET['next'] ?? $_POST['next'] ?? ''));
if (!$user) {
    ttg_redirect(ttg_base('auth/'));
}

$error = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    ttg_require_csrf();
    if (!empty($_POST['agree'])) {
        ttg_terms_record((int) $user['id']);
        ttg_redirect($next !== '' ? $next : ttg_base('profile/'));
    }
    $error = 'Tick the box to agree, or go back without submitting.';
}

$already = ttg_terms_agreed($user);
$pageTitle = 'Lend your work to the grand narrative — Time Travellers Guild';
require dirname(__DIR__) . '/inc/header.php';
?>
<main class="auth-wrap">
  <section class="auth-card slip agree-card">
    <p class="beat-label">THE GUILD · BEFORE YOUR WORK JOINS IT</p>
    <h1>LEND IT TO THE GRAND NARRATIVE</h1>
    <?php if ($already && !empty($_GET['close'])): ?>
      <p>Thank you. You've agreed. Go back to the tab you came from and press save again; your work is still there. You can close this tab.</p>
    <?php elseif ($already): ?>
      <p>You have already agreed<?= !empty($user['terms_agreed_at']) ? ' on ' . ttg_h(substr((string) $user['terms_agreed_at'], 0, 10)) : '' ?>. Nothing more to do.</p>
      <p class="form-actions"><a class="door primary" href="<?= ttg_h($next !== '' ? $next : ttg_base('profile/')) ?>"><b>DOOR</b> CARRY ON</a></p>
    <?php else: ?>
      <p>The Guild is building one collective story out of what its travellers bring. Before your first submission, it asks you to lend your part to it.</p>
      <ul class="agree-points">
        <li>Your <b>avatar</b>, <b>display name</b> and the <b>work you submit</b> (ledger pages, things you lodge on the map, case filings, stamps and trail points) may be shown, combined, retold and adapted in the Guild's grand narrative, including by Jack, the Guild's AI clerk.</li>
        <li>You <b>keep owning</b> your work. The licence is non-exclusive and royalty-free.</li>
        <li>What you submit is yours to lend, and it doesn't expose anyone else without their permission.</li>
        <li>You can <b>stop at any time</b>. Nothing new is used after that; pieces already woven in stay, without your name or avatar.</li>
        <li>Your email address, private chats and Jack's memory of you are never part of it.</li>
      </ul>
      <p>The full terms are in the <a href="/privacy/#narrative">privacy policy</a>.</p>
      <?php if ($error !== ''): ?><p class="error" role="alert"><?= ttg_h($error) ?></p><?php endif; ?>
      <form method="post" action="/people/agree/">
        <input type="hidden" name="csrf" value="<?= ttg_h(ttg_csrf_token()) ?>">
        <?php if ($next !== ''): ?><input type="hidden" name="next" value="<?= ttg_h($next) ?>"><?php endif; ?>
        <label class="check"><input type="checkbox" name="agree" value="1" required> I agree to lend my avatar and submitted work to the Guild's grand narrative, and I have read the <a href="/privacy/">privacy policy</a>.</label>
        <p class="form-actions">
          <button class="primary" type="submit">AGREE AND CARRY ON</button>
          <a class="door" href="<?= ttg_h($next !== '' ? $next : '/') ?>"><b>DOOR</b> NOT NOW</a>
        </p>
      </form>
      <p class="agree-small">Not now: you can still read and explore. You'll be asked again the next time you submit something.</p>
    <?php endif; ?>
  </section>
</main>
<style>
.agree-card{max-width:40rem;line-height:1.6}
.agree-points{padding-left:1.2rem}
.agree-points li{margin:.45rem 0}
.agree-small{font-size:.9rem;opacity:.75}
</style>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
