<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('org.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.org')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('org.h1') ?></h1>
  <p><?= det_e('org.lede') ?></p>
  <h2><?= det_e('org.ps') ?></h2>
  <p><?= det_e('org.ps.d') ?></p>
  <h2><?= det_e('org.ops') ?></h2>
  <p><?= det_e('org.ops.d') ?></p>
  <h2><?= det_e('org.its') ?></h2>
  <p><?= det_e('org.its.d') ?></p>
  <h2><?= det_e('org.info') ?></h2>
  <p><?= det_e('org.info.d') ?></p>
  <h2><?= det_e('org.est') ?></h2>
  <p><?= det_e('org.est.d') ?></p>
  <p><?= det_e('org.staff') ?></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
