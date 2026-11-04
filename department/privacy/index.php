<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('priv.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.privacy')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('priv.h1') ?></h1>
  <p><?= det_e('priv.p1') ?></p>
  <p><?= det_e('priv.p2') ?></p>
  <p><a href="<?= det_h(det_url('publications/det-gdpr-001')) ?>">DET-GDPR-001</a></p>
  <p><a href="<?= det_h(det_url('forms/DET-52')) ?>">DET-52</a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
