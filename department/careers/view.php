<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$slug = (string) ($_GET['slug'] ?? '');
$j = det_job($slug);
if (!$j) {
    http_response_code(404);
    $pageTitle = det_s('car.missing') . ' — ' . det_s('dept');
    $crumbs = [['label'=>det_s('nav.careers'),'href'=>det_url('careers')],['label'=>det_s('crumb.notfound')]];
    require dirname(__DIR__) . '/inc/header.php';
    echo '<div class="wrap"><h1>'.det_e('car.missing').'</h1><p>'.det_e('car.missing.p').'</p><p><a href="'.det_h(det_url('careers')).'">'.det_e('car.all.link').'</a></p></div>';
    require dirname(__DIR__) . '/inc/footer.php';
    exit;
}
$title = (string) det_l($j, 'title');
$pageTitle = $title . ' — ' . det_s('dept');
$pageDescription = (string) det_l($j, 'summary');
$crumbs = [['label'=>det_s('nav.careers'),'href'=>det_url('careers')],['label'=>$title]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <p class="caption"><?= det_h($j['id']) ?></p>
  <h1><?= det_h($title) ?></h1>
  <dl class="vmeta">
    <div><dt><?= det_e('car.grade') ?></dt><dd><?= det_h($j['grade']) ?></dd></div>
    <div><dt><?= det_e('car.salary') ?></dt><dd><?= det_h($j['salary']) ?></dd></div>
    <div><dt><?= det_e('car.location') ?></dt><dd><?= det_h((string) det_l($j, 'location')) ?></dd></div>
    <div><dt><?= det_e('car.contract') ?></dt><dd><?= det_h((string) det_l($j, 'type')) ?></dd></div>
    <div><dt><?= det_e('car.hours') ?></dt><dd><?= det_h((string) det_l($j, 'hours')) ?></dd></div>
    <div><dt><?= det_e('car.close.date') ?></dt><dd><?= det_h(det_date($j['closing'])) ?></dd></div>
  </dl>
  <p><?= det_h((string) det_l($j, 'summary')) ?></p>
  <h2><?= det_e('car.jd') ?></h2>
  <ul class="plain">
    <?php foreach (det_la($j, 'duties') ?: ($j['duties'] ?? []) as $d): ?><li><?= det_h((string) $d) ?></li><?php endforeach; ?>
  </ul>
  <h2><?= det_e('car.ps') ?></h2>
  <h3><?= det_e('car.ess') ?></h3>
  <ul class="plain">
    <?php foreach (det_la($j, 'essential') ?: ($j['essential'] ?? []) as $d): ?><li><?= det_h((string) $d) ?></li><?php endforeach; ?>
  </ul>
  <?php $des = det_la($j, 'desirable') ?: ($j['desirable'] ?? []); if ($des): ?>
  <h3><?= det_e('car.des') ?></h3>
  <ul class="plain">
    <?php foreach ($des as $d): ?><li><?= det_h((string) $d) ?></li><?php endforeach; ?>
  </ul>
  <?php endif; ?>
  <p><a class="start" href="<?= det_h(det_url('forms/DET-80')) ?>"><?= det_e('car.apply') ?><span aria-hidden="true"> →</span></a></p>
  <p class="muted"><?= det_e('car.foot') ?></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
