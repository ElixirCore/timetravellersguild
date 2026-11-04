<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('off.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('off.h1')]];
require dirname(__DIR__) . '/inc/header.php';
$offices = det_offices();
?>
<div class="wrap">
  <h1><?= det_e('off.h1') ?></h1>
  <p><?= det_e('off.enquiries') ?></p>
  <p><a href="<?= det_h(det_url('maps')) ?>"><?= det_e('off.viewmap') ?></a></p>
  <?php foreach ($offices as $o): ?>
    <h2><?= det_h((string) det_l($o, 'name')) ?></h2>
    <p><span class="tag <?= $o['status']==='open'?'tag-open':($o['status']==='limited'?'tag-limited':'tag-closed') ?>"><?= det_h(det_status_label($o['status'])) ?></span></p>
    <p><?= det_h((string) det_l($o, 'role')) ?>. <?= det_h((string) det_l($o, 'address')) ?></p>
    <p><?= det_h((string) det_l($o, 'note')) ?></p>
  <?php endforeach; ?>
  <p><a href="<?= det_h(det_url('publications/det-circ-014')) ?>"><?= det_e('off.circ') ?></a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
