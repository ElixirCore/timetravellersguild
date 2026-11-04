<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$pageTitle = det_s('contact.h1') . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('nav.contact')]];
require dirname(__DIR__) . '/inc/header.php';
?>
<div class="wrap">
  <h1><?= det_e('contact.h1') ?></h1>
  <p><?= det_e('dept') ?><br>Parc Cathays<br><?= ($GLOBALS['DET_LANG']??'en')==='cy' ? 'Caerdydd' : 'Cardiff' ?><br>CF10 3NQ</p>
  <p><?= det_e('contact.counter') ?></p>
  <p><?= det_e('contact.welsh') ?></p>
  <h2><?= det_e('contact.report') ?></h2>
  <p><a href="<?= det_h(det_url('services/report')) ?>">DET-01</a></p>
  <?= det_form_wizard_html('CONTACT', ['done' => 'form.received', 'keep' => 'form.recognised', 'class' => '']) ?>
  <h2><?= det_e('nav.foi') ?></h2>
  <p><a href="<?= det_h(det_url('about/foi.php')) ?>"><?= det_e('contact.rights') ?></a></p>
  <h2><?= det_e('contact.field') ?></h2>
  <p><?= det_e('contact.abercrave') ?></p>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
