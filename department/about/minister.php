<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('min.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.minister')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('min.h1') ?></h1>
  <p><?= det_e('min.p1') ?></p>
  <p><?= det_e('min.p2') ?></p>
  <h2><?= det_e('min.resp') ?></h2>
  <ul class="plain">
    <li><?= det_e('min.r1') ?></li>
    <li><?= det_e('min.r2') ?></li>
    <li><?= det_e('min.r3') ?></li>
    <li><?= det_e('min.r4') ?></li>
    <li><?= det_e('min.r5') ?></li>
  </ul>
  <p><a href="<?= det_h(det_url('publications/det-min-2026-03')) ?>"><?= det_e('min.stmt') ?></a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
