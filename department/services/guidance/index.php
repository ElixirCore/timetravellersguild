<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/inc/boot.php';
$pageTitle = det_s('svc.guidance') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('svc.list')],['label'=>det_s('svc.guid.crumb')]];
require dirname(__DIR__, 2) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('svc.guidance') ?></h1>
  <p><?= det_e('assurance') ?></p>
  <div class="acc">
    <button type="button" aria-expanded="false"><?= det_e('guid.afternoon') ?></button>
    <div class="panel-body">
      <p><?= det_e('guid.afternoon.p') ?></p>
      <p><a href="<?= det_h(det_url('publications/det-guid-002')) ?>">DET-GUID-002</a></p>
    </div>
  </div>
  <div class="acc">
    <button type="button" aria-expanded="false"><?= det_e('guid.day') ?></button>
    <div class="panel-body">
      <p><?= det_e('guid.day.p') ?></p>
    </div>
  </div>
  <div class="acc">
    <button type="button" aria-expanded="false"><?= det_e('guid.report') ?></button>
    <div class="panel-body">
      <p><a href="<?= det_h(det_url('services/report')) ?>"><?= det_e('rep.h1') ?></a>. DET-01.</p>
    </div>
  </div>
  <div class="acc">
    <button type="button" aria-expanded="false"><?= det_e('guid.schools.btn') ?></button>
    <div class="panel-body">
      <p><a href="<?= det_h(det_url('services/schools')) ?>"><?= det_e('svc.schools') ?></a> · <a href="<?= det_h(det_url('publications/det-guid-009')) ?>">DET-GUID-009</a>.</p>
    </div>
  </div>
</div>
<?php require dirname(__DIR__, 2) . '/inc/footer.php'; ?>
