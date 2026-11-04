<?php
declare(strict_types=1);
require_once __DIR__ . '/inc/db.php';
$user = ttg_current_user();

$slug = preg_replace('/[^a-z0-9-]/', '', strtolower((string)($_GET['slug'] ?? '')));
$person = $slug !== '' ? ttg_user_by_slug($slug) : null;
if (!$person) {
    http_response_code(404);
    $pageTitle = 'Not found — Time Travellers Guild';
    require __DIR__ . '/inc/header.php';
    echo '<main><section class="hero"><p class="presents">404 · NOT ON THE REGISTER</p><h1>No slip here.</h1><p><a class="door" href="/people/"><b>DOOR</b> THE REGISTER</a></p></section></main>';
    require __DIR__ . '/inc/footer.php';
    exit;
}

$isSelf = $user && (int)$user['id'] === (int)$person['id'];
$knocked = isset($_GET['knocked']);
$blocked = isset($_GET['blocked']);

$pageTitle = $person['display_name'] . ' — Time Travellers Guild';
require __DIR__ . '/inc/header.php';

$cells = ttg_pixel_parse((string)($person['avatar_pixels'] ?? ''));
?>
<main>
  <section class="hero">
    <p class="presents">TRAVELLER · PUBLIC SLIP · NOT CANON</p>
    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px">
      <?= ttg_pixel_html($cells) ?>
      <div>
        <div class="role" style="margin-bottom:4px"><?= ttg_h((string)$person['role']) ?></div>
        <h1 style="margin:0 0 4px"><?= ttg_h((string)$person['display_name']) ?></h1>
        <?php if ($person['location']): ?><p class="status" style="margin:0 0 8px"><?= ttg_h((string)$person['location']) ?></p><?php endif; ?>
        <?php if ($person['bio']): ?><p style="max-width:40ch"><?= ttg_h((string)$person['bio']) ?></p><?php endif; ?>
      </div>
    </div>

    <?php if ($isSelf): ?>
      <p class="handoff-row"><a class="door" href="/people/profile/"><b>DOOR</b> EDIT YOUR SLIP</a></p>
    <?php elseif ($user): ?>
      <p class="handoff-row"><a class="door primary" href="/people/chat/?with=<?= ttg_h($slug) ?>"><b>DOOR</b> SEND A MESSAGE</a></p>
      <?php if ($knocked): ?>
        <p class="status">Knocked. They'll see it on their slip.</p>
      <?php elseif ($blocked): ?>
        <p class="status">You already knocked on their door today.</p>
      <?php else: ?>
        <form class="knock-form" method="post" action="/people/knock">
          <input type="hidden" name="csrf" value="<?= ttg_h(ttg_csrf_token()) ?>">
          <input type="hidden" name="to_slug" value="<?= ttg_h($slug) ?>">
          <label class="beat-label" for="knock_msg">KNOCK ON THEIR DOOR</label>
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:6px">
            <input id="knock_msg" name="message" type="text" maxlength="160" placeholder="Leave a word (optional)" style="flex:1;min-width:200px">
            <button class="primary" type="submit">KNOCK</button>
          </div>
        </form>
      <?php endif; ?>
    <?php else: ?>
      <a class="door primary" href="/people/auth/"><b>DOOR</b> SIGN IN TO KNOCK</a>
    <?php endif; ?>

    <p style="margin-top:20px"><a class="door" href="/people/"><b>DOOR</b> THE REGISTER</a></p>
  </section>
</main>
<?php require __DIR__ . '/inc/footer.php'; ?>
