<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('org.its') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('res.h1'),'href'=>det_url('research')],['label'=>det_s('org.its')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('org.its') ?></h1>
  <p><?= det_e('res.its.p1') ?></p>
  <p><?= det_e('res.its.p2') ?></p>
  <p><?= det_e('res.its.p3') ?></p>
  <p><a href="<?= det_h(det_url('publications/det-ins-013')) ?>">DET-INS-013</a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
