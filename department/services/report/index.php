<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/inc/boot.php';
$pageTitle = det_s('rep.h1') . ' — ' . det_s('dept');
$pageDescription = det_s('rep.lede');
$crumbs = [['label'=>det_s('svc.list')],['label'=>det_s('svc.report.crumb')]];
$phase = det_s('rep.phase');
require dirname(__DIR__, 2) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('rep.h1') ?></h1>
  <p class="lede"><?= det_e('rep.lede') ?></p>
  <p><?= det_e('rep.p') ?></p>
  <div class="inset">
    <p><?= det_e('rep.inset') ?></p>
  </div>
  <p><?= det_e('rep.need') ?></p>
  <ul class="plain">
    <li><?= det_e('rep.n1') ?></li>
    <li><?= det_e('rep.n2') ?></li>
    <li><?= det_e('rep.n3') ?></li>
  </ul>
  <p><a class="start" href="<?= det_h(det_url('forms/DET-01')) ?>"><?= det_e('start') ?></a></p>
  <p><a href="<?= det_h(det_url('services/guidance')) ?>"><?= det_e('svc.guidance') ?></a></p>
</div>
<?php require dirname(__DIR__, 2) . '/inc/footer.php'; ?>
