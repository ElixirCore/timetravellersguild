<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('cook.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.cookies')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('cook.h1') ?></h1>
  <p><?= det_e('cook.p') ?></p>
  <h2><?= det_e('cook.ess') ?></h2>
  <p><?= det_e('cook.ess.p') ?></p>
  <h2><?= det_e('cook.lang') ?></h2>
  <p><?= det_e('cook.lang.p') ?></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
