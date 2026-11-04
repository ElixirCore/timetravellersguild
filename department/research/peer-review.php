<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('res.pr') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('res.h1'),'href'=>det_url('research')],['label'=>det_s('res.pr')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('res.pr') ?></h1>
  <p><?= det_e('res.pr.p1') ?></p>
  <p><a href="<?= det_h(det_url('publications/det-rev-002')) ?>">DET-REV-002</a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
