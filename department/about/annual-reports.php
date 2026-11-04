<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('ar.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.reports')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('ar.h1') ?></h1>
  <p><?= det_e('ar.lede') ?></p>
  <ul class="plain">
    <?php foreach (det_publications() as $p):
      if (($p['type'] ?? '') !== 'Annual report' && !str_starts_with((string)($p['id'] ?? ''), 'DET-AR')) continue; ?>
    <li><a href="<?= det_h(det_url('publications/'.strtolower($p['id']))) ?>"><?= det_h($p['id'].' — '.(string) det_l($p, 'title')) ?></a></li>
    <?php endforeach; ?>
  </ul>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
