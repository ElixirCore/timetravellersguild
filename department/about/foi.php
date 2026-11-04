<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('foi.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.foi')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('foi.h1') ?></h1>
  <p><?= det_e('foi.p0') ?></p>
  <p><?= det_e('foi.p2') ?></p>
  <p><?= det_e('foi.p1') ?></p>
  <p><a href="<?= det_h(det_url('forms/DET-52')) ?>">DET-52</a></p>
  <p><a href="<?= det_h(det_url('publications/det-foi-log-2026')) ?>"><?= det_e('foi.log') ?></a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
