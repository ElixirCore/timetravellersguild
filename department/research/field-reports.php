<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('res.field') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('res.h1'),'href'=>det_url('research')],['label'=>det_s('res.field')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('res.field') ?></h1>
  <ul class="plain">
    <li><a href="<?= det_h(det_url('publications/det-field-088')) ?>"><?= det_e('res.field.088') ?></a></li>
    <li><a href="<?= det_h(det_url('publications/det-field-091')) ?>"><?= det_e('res.field.091') ?></a></li>
  </ul>
  <p><?= det_e('res.field.p') ?></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
