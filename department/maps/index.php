<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('off.h1') . ' — ' . det_s('dept');
$pageDescription = det_s('off.lede');
$crumbs = [['label' => det_s('off.h1')]];
require dirname(__DIR__) . '/inc/header.php';
$offices = det_offices();
?>
<div class="wrap">
  <h1><?= det_e('off.h1') ?></h1>
  <p class="lede"><?= det_e('off.lede') ?></p>
  <div class="map-wrap">
    <svg id="ukmap" viewBox="80 80 420 560" role="img" aria-label="<?= det_e('map.label') ?>">
      <path class="land" d="M250 120 l40 10 30 40 10 50-10 40 20 30 5 50-15 40 25 35 10 45-20 40-40 30-50 10-40-15-30-40 5-50-20-40 10-55 25-50 15-40 15-30z"/>
      <path class="land" d="M200 250 l-45 20-30 40 10 45 35 20 40-15 20-40-10-40z"/>
      <?php foreach ($offices as $o): ?>
      <g class="office <?= det_h($o['status']) ?>" data-name="<?= det_h((string) det_l($o, 'name')) ?>" data-role="<?= det_h((string) det_l($o, 'role')) ?>" data-note="<?= det_h((string) det_l($o, 'note')) ?>">
        <circle cx="<?= (int)$o['x'] ?>" cy="<?= (int)$o['y'] ?>" r="7"/>
        <text x="<?= (int)$o['x'] + 12 ?>" y="<?= (int)$o['y'] + 4 ?>"><?= det_h((string) det_l($o, 'name')) ?></text>
      </g>
      <?php endforeach; ?>
    </svg>
    <div class="map-key">
      <span><i class="o"></i> <?= det_e('open') ?></span>
      <span><i class="l"></i> <?= det_e('limited') ?></span>
      <span><i class="c"></i> <?= det_e('closed') ?></span>
    </div>
    <div id="office-panel"><p class="muted"><?= det_e('select.office') ?></p></div>
  </div>
  <?php foreach ($offices as $o): ?>
    <h2><?= det_h((string) det_l($o, 'name')) ?></h2>
    <p><span class="tag <?= $o['status']==='open'?'tag-open':($o['status']==='limited'?'tag-limited':'tag-closed') ?>"><?= det_h(det_status_label($o['status'])) ?></span></p>
    <p><?= det_h((string) det_l($o, 'role')) ?>. <?= det_h((string) det_l($o, 'address')) ?></p>
    <p><?= det_h((string) det_l($o, 'note')) ?></p>
  <?php endforeach; ?>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
