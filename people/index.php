<?php
declare(strict_types=1);
require_once __DIR__ . '/inc/db.php';
$pageTitle = 'Register — Time Travellers Guild';
require __DIR__ . '/inc/header.php';
$people = ttg_public_users();
$knockedSlug = (string)($_GET['knocked'] ?? '');
?>
<main>
  <section class="hero">
    <p class="presents">CAST REGISTER · PUBLIC LAYER · NOT CANON</p>
    <h1>PEOPLE</h1>
    <p>Each traveller punches their own slip. The 9×9 stamp is their face in the rooms. The register is a projection, not canon.</p>
    <?php if ($knockedSlug !== ''): ?><p class="status">Knocked on <?= ttg_h($knockedSlug) ?>'s door.</p><?php endif; ?>
    <?php if (!$user): ?>
      <a class="door primary" href="<?= ttg_h(ttg_base('auth/')) ?>"><b>DOOR</b> ENTER BY MAGIC LINK</a>
    <?php else: ?>
      <p class="status">Signed in as <?= ttg_h((string) $user['display_name']) ?>.</p>
      <p class="handoff-row">
        <a class="door" href="<?= ttg_h(ttg_base('profile/')) ?>"><b>DOOR</b> YOUR SLIP</a>
        <?php foreach (ttg_config()['handoff_targets'] as $key => $target): ?>
          <?php $handoff = ttg_handoff_url($user, (string) $key); ?>
          <?php if ($handoff): ?>
            <a class="door" href="<?= ttg_h($handoff) ?>"><b>DOOR</b> <?= ttg_h((string) $target['label']) ?></a>
          <?php endif; ?>
        <?php endforeach; ?>
      </p>
    <?php endif; ?>
  </section>

  <section class="directory">
    <div class="directory-head">
      <div>
        <p class="beat-label">IBM 5081 · PUBLIC HOPPER</p>
        <h2>The register</h2>
      </div>
      <label>Filter <input id="filter" type="search" placeholder="name, station, place"></label>
    </div>
    <?php if (!$people): ?>
      <div class="empty slip">No public slips yet. The first traveller has not punched a card.</div>
    <?php else: ?>
      <div class="people-grid" id="peopleGrid">
      <?php foreach ($people as $person): ?>
        <?php $cells = ttg_pixel_parse((string) ($person['avatar_pixels'] ?? '')); ?>
        <article class="person slip" data-search="<?= ttg_h(strtolower($person['display_name'].' '.$person['role'].' '.$person['location'].' '.$person['bio'])) ?>">
          <a class="person-link" href="/people/<?= ttg_h((string) $person['slug']) ?>/"><?= ttg_pixel_html($cells) ?></a>
          <div>
            <div class="role"><?= ttg_h((string) $person['role']) ?></div>
            <h3><a href="/people/<?= ttg_h((string) $person['slug']) ?>/"><?= ttg_h((string) $person['display_name']) ?></a></h3>
            <?php if ($person['location']): ?><div class="location"><?= ttg_h((string) $person['location']) ?></div><?php endif; ?>
            <?php if ($person['bio']): ?><p><?= ttg_h((string) $person['bio']) ?></p><?php endif; ?>
            <?php if ($user && (int)$user['id'] !== (int)$person['id']): ?>
            <p style="margin-top:6px"><a class="door" href="/people/<?= ttg_h((string) $person['slug']) ?>/"><b>DOOR</b> KNOCK</a></p>
            <?php endif; ?>
          </div>
        </article>
      <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </section>
</main>
<?php require __DIR__ . '/inc/footer.php'; ?>
