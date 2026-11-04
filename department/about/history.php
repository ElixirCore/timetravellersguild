<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('hist.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.history')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('hist.h1') ?></h1>
  <p><?= det_e('hist.p1') ?></p>
  <p><?= det_e('hist.p2') ?></p>
  <h2>1951</h2>
  <p><?= det_e('hist.1951') ?></p>
  <h2>1963</h2>
  <p><?= det_e('hist.1963') ?></p>
  <h2>2008</h2>
  <p><?= det_e('hist.2008') ?></p>
  <h2>2025–26</h2>
  <p><?= det_e('hist.2526') ?></p>
  <p><a href="<?= det_h(det_url('publications/det-hist-1951')) ?>"><?= det_e('about.instrument') ?></a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
