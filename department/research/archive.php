<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('res.arc') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('res.h1'),'href'=>det_url('research')],['label'=>det_s('res.arc')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('res.arc') ?></h1>
  <p><?= det_e('res.arc.p1') ?></p>
  <p><?= det_e('res.arc.p2') ?></p>
  <p><?= det_e('res.arc.p3') ?></p>
  <p><a href="<?= det_h(det_url('services/research-access')) ?>"><?= det_e('res.apply') ?></a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
