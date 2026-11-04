<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('res.wp') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('res.h1'),'href'=>det_url('research')],['label'=>det_s('res.wp')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('res.wp') ?></h1>
  <ul class="plain">
    <li><a href="<?= det_h(det_url('publications/det-res-044')) ?>"><?= det_e('res.wp.044') ?></a></li>
    <li><a href="<?= det_h(det_url('publications/det-res-051')) ?>"><?= det_e('res.wp.051') ?></a></li>
  </ul>
  <p><?= det_e('res.wp.p') ?></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
