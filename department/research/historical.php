<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('res.hist') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('res.h1'),'href'=>det_url('research')],['label'=>det_s('res.hist')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('res.hist') ?></h1>
  <ul class="plain">
    <li><a href="<?= det_h(det_url('publications/det-codex-001')) ?>"><?= det_e('res.hist.codex') ?></a></li>
    <li><a href="<?= det_h(det_url('publications/det-hist-1951')) ?>"><?= det_e('res.hist.1951') ?></a></li>
    <li><a href="<?= det_h(det_url('publications/det-hist-1963')) ?>"><?= det_e('res.hist.1963') ?></a></li>
  </ul>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
