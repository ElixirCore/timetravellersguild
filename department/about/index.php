<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('nav.about') . ' — ' . det_s('dept');
$pageDescription = det_s('about.lede');
$crumbs = [['label' => det_s('nav.about')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <div class="grid grid-2">
    <div>
      <h1><?= det_e('about.h1') ?></h1>
      <p class="lede"><?= det_e('about.lede') ?></p>
      <p><?= det_e('about.p1') ?></p>
      <p><?= det_e('axiom') ?></p>
      <nav class="topics">
        <a class="topic" href="<?= det_h(det_url('about/history.php')) ?>"><h3><?= det_e('nav.history') ?></h3><p><?= det_e('about.history.d') ?></p></a>
        <a class="topic" href="<?= det_h(det_url('about/organisation.php')) ?>"><h3><?= det_e('nav.org') ?></h3><p><?= det_e('about.org.d') ?></p></a>
        <a class="topic" href="<?= det_h(det_url('about/minister.php')) ?>"><h3><?= det_e('nav.minister') ?></h3><p><?= det_e('about.min.d') ?></p></a>
        <a class="topic" href="<?= det_h(det_url('about/offices.php')) ?>"><h3><?= det_e('nav.offices') ?></h3><p><?= det_e('about.off.d') ?></p></a>
        <a class="topic" href="<?= det_h(det_url('about/annual-reports.php')) ?>"><h3><?= det_e('nav.reports') ?></h3><p><?= det_e('about.ar.d') ?></p></a>
        <a class="topic" href="<?= det_h(det_url('careers')) ?>"><h3><?= det_e('nav.careers') ?></h3><p><?= det_e('about.car.d') ?></p></a>
        <a class="topic" href="<?= det_h(det_url('about/foi.php')) ?>"><h3><?= det_e('nav.foi') ?></h3><p><?= det_e('about.foi.d') ?></p></a>
        <a class="topic" href="<?= det_h(det_url('contact')) ?>"><h3><?= det_e('nav.contact') ?></h3><p><?= det_e('about.con.d') ?></p></a>
      </nav>
    </div>
    <aside class="related">
      <h2><?= det_e('read.first') ?></h2>
      <ul>
        <li><a href="<?= det_h(det_url('publications/det-codex-001')) ?>"><?= det_e('about.codex') ?></a></li>
        <li><a href="<?= det_h(det_url('publications/det-hist-1951')) ?>"><?= det_e('about.instrument') ?></a></li>
      </ul>
    </aside>
  </div>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
