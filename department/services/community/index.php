<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/inc/boot.php';
$pageTitle = det_s('svc.community') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('svc.list')],['label'=>det_s('svc.com.crumb')]];
require dirname(__DIR__, 2) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('svc.community') ?></h1>
  <p><?= det_e('com.p1') ?></p>
  <p><?= det_e('com.p2') ?></p>
  <p><a href="<?= det_h(det_url('publications/det-com-012')) ?>"><?= det_e('com.frame') ?></a></p>
  <p><a class="start" href="<?= det_h(det_url('forms/DET-17')) ?>"><?= det_e('com.start') ?></a></p>
</div>
<?php require dirname(__DIR__, 2) . '/inc/footer.php'; ?>
