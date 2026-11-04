<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('res.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('res.h1')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('res.h1') ?></h1>
  <p><?= det_e('res.lede') ?></p>
  <nav class="topics">
    <a class="topic" href="<?= det_h(det_url('research/institute.php')) ?>"><h3><?= det_e('org.its') ?></h3><p><?= det_e('res.its.d') ?></p></a>
    <a class="topic" href="<?= det_h(det_url('research/archive.php')) ?>"><h3><?= det_e('res.arc') ?></h3><p><?= det_e('res.arc.d') ?></p></a>
    <a class="topic" href="<?= det_h(det_url('research/working-papers.php')) ?>"><h3><?= det_e('res.wp') ?></h3><p><?= det_e('res.wp.d') ?></p></a>
    <a class="topic" href="<?= det_h(det_url('research/peer-review.php')) ?>"><h3><?= det_e('res.pr') ?></h3><p><?= det_e('res.pr.d') ?></p></a>
    <a class="topic" href="<?= det_h(det_url('research/geometry.php')) ?>"><h3><?= det_e('res.geo') ?></h3><p><?= det_e('res.geo.d') ?></p></a>
    <a class="topic" href="<?= det_h(det_url('research/historical.php')) ?>"><h3><?= det_e('res.hist') ?></h3><p><?= det_e('res.hist.d') ?></p></a>
    <a class="topic" href="<?= det_h(det_url('research/field-reports.php')) ?>"><h3><?= det_e('res.field') ?></h3><p><?= det_e('res.field.d') ?></p></a>
  </nav>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
