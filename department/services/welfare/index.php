<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/inc/boot.php';
$pageTitle = det_s('svc.welfare') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('svc.list')],['label'=>det_s('svc.wel.crumb')]];
require dirname(__DIR__, 2) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('svc.welfare') ?></h1>
  <p><?= det_e('wel.maxim') ?></p>
  <div class="inset">
    <p><?= det_e('wel.hours') ?></p>
  </div>
  <p><?= det_e('wel.p2') ?></p>
  <p><?= det_e('wel.p3') ?></p>
  <p><a href="<?= det_h(det_url('publications/det-pol-007')) ?>"><?= det_e('wel.pol') ?></a></p>
  <p><a class="start" href="<?= det_h(det_url('forms/DET-22')) ?>"><?= det_e('wel.claim') ?></a></p>
</div>
<?php require dirname(__DIR__, 2) . '/inc/footer.php'; ?>
