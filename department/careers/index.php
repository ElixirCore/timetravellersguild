<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('car.h1') . ' — ' . det_s('dept');
$pageDescription = det_s('car.lede');
$crumbs = [['label' => det_s('nav.careers')]];
require dirname(__DIR__) . '/inc/header.php';
$jobs = det_vacancies();
?>
<div class="wrap">
  <h1><?= det_e('car.h1') ?></h1>
  <p><?= det_e('car.lede') ?></p>
  <div class="filters">
    <div class="field">
      <label for="job-grade"><?= det_e('car.grade') ?></label>
      <select id="job-grade">
        <option value=""><?= det_e('car.all') ?></option>
        <option>AO</option>
        <option>EO</option>
        <option>HEO</option>
        <option>SEO</option>
        <option>Grade 7</option>
      </select>
    </div>
  </div>
  <table class="list">
    <thead>
      <tr><th><?= det_e('car.vacancy') ?></th><th><?= det_e('car.grade') ?></th><th><?= det_e('car.salary') ?></th><th><?= det_e('car.location') ?></th><th><?= det_e('car.closing') ?></th></tr>
    </thead>
    <tbody>
    <?php foreach ($jobs as $j): ?>
      <tr data-job="<?= det_h($j['grade']) ?>">
        <td><a href="<?= det_h(det_url('careers/'.$j['slug'])) ?>"><?= det_h((string) det_l($j,'title')) ?></a><br><span class="muted"><?= det_h($j['id']) ?></span></td>
        <td><?= det_h($j['grade']) ?></td>
        <td><?= det_h($j['salary']) ?></td>
        <td><?= det_h((string) det_l($j,'location')) ?></td>
        <td><?= det_h(det_date($j['closing'])) ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <p class="muted"><?= det_e('car.cv') ?></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
