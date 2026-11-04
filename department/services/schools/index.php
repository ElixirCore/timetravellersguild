<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/inc/boot.php';
$pageTitle = det_s('svc.schools') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('svc.list')],['label'=>det_s('svc.schools')]];
require dirname(__DIR__, 2) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('svc.schools') ?></h1>
  <p><?= det_e('sch.p1') ?></p>
  <p><?= det_e('sch.p2') ?></p>
  <p><?= det_e('sch.p3') ?></p>
  <p><a href="<?= det_h(det_url('publications/det-guid-009')) ?>"><?= det_e('sch.guid') ?></a></p>
  <p><a class="start" href="<?= det_h(det_url('forms/DET-33')) ?>"><?= det_e('sch.visit') ?></a></p>
</div>
<?php require dirname(__DIR__, 2) . '/inc/footer.php'; ?>
