<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('form.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('form.h1')]];
require dirname(__DIR__) . '/inc/header.php';
$forms = det_forms();
?>
<div class="wrap">
  <h1><?= det_e('form.h1') ?></h1>
  <p><?= det_e('form.lede') ?></p>
  <table class="list">
    <thead><tr><th><?= det_e('form.number') ?></th><th><?= det_e('pub.title') ?></th></tr></thead>
    <tbody>
    <?php foreach ($forms as $f):
      $href = det_abs_href((string) ($f['href'] ?? det_url('forms/'.$f['id'])));
    ?>
      <tr>
        <td><a href="<?= det_h($href) ?>"><?= det_h($f['id']) ?></a></td>
        <td><?= det_h((string) det_l($f, 'title')) ?><br><span class="muted"><?= det_h((string) det_l($f, 'summary')) ?></span></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <p><a href="<?= det_h(det_url('publications/det-form-pack-2026')) ?>"><?= det_e('form.pack') ?></a></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
