<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/inc/boot.php';
$pageTitle = det_s('svc.research') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('svc.list')],['label'=>det_s('svc.access.crumb')]];
$phase = 'DET-78';
require dirname(__DIR__, 2) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('svc.research') ?></h1>
  <p><?= det_e('acc.res.p1') ?></p>
  <p><?= det_e('acc.res.p2') ?></p>
  <p><?= det_e('acc.res.p3') ?></p>
  <p><a class="start" href="<?= det_h(det_url('forms/DET-78')) ?>"><?= det_e('start') ?></a></p>
</div>
<?php require dirname(__DIR__, 2) . '/inc/footer.php'; ?>
