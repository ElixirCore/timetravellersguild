<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('acc.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.access')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('acc.h1') ?></h1>
  <p><?= det_e('acc.p1') ?></p>
  <p><?= det_e('acc.p2') ?></p>
  <p><?= det_e('acc.p3') ?></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
