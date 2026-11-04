<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$id = strtoupper((string) ($_GET['id'] ?? ''));
$f = det_form($id);
if (!$f) {
    http_response_code(404);
    $pageTitle = det_s('form.missing') . ' — ' . det_s('dept');
    $crumbs = [['label'=>det_s('form.h1'),'href'=>det_url('forms')],['label'=>det_s('crumb.notfound')]];
    require dirname(__DIR__) . '/inc/header.php';
    echo '<div class="wrap"><h1>'.det_e('form.missing').'</h1><p>'.det_e('form.missing.p').'</p><p><a href="'.det_h(det_url('forms')).'">'.det_e('form.all').'</a></p></div>';
    require dirname(__DIR__) . '/inc/footer.php';
    exit;
}
$title = (string) det_l($f, 'title');
$pageTitle = $f['id'] . ' ' . $title . ' — ' . det_s('dept');
$crumbs = [['label'=>det_s('form.h1'),'href'=>det_url('forms')],['label'=>$f['id']]];
$phase = $f['id'];
$labels = det_form_labels($id);
require dirname(__DIR__) . '/inc/header.php';
$result = $GLOBALS['DET_FORM_RESULT'] ?? null;
?>
<div class="wrap" style="max-width:40rem">
<?php if (is_array($result) && !empty($result['ok']) && (string) ($result['form_id'] ?? '') === $f['id']): ?>
  <div class="confirm">
    <h1><?= det_e('form.received') ?></h1>
    <p><?= det_e('form.ref') ?><br><strong><?= det_h((string) $result['ref']) ?></strong></p>
  </div>
  <p><?= det_e('form.recognised') ?></p>
  <p><?= det_e('assurance') ?></p>
  <p><a href="<?= det_h(det_url()) ?>"><?= det_e('form.return') ?></a></p>
<?php else: ?>
  <h1><?= det_h($f['id']) ?> <?= det_h($title) ?></h1>
  <p><?= det_h((string) det_l($f, 'summary')) ?></p>

  <form id="det-form" method="post" action="" data-form="<?= det_h($f['id']) ?>" data-err="<?= det_e('form.error') ?>" data-lbl-name="<?= det_e('form.name.lbl') ?>" data-lbl-email="<?= det_e('form.email') ?>" data-lbl-details="<?= det_e('form.details') ?>">
    <?= det_form_hidden_fields($f['id']) ?>
    <?php if (is_array($result) && empty($result['ok'])): ?>
    <div class="error-sum" data-form-error><h2><?= det_e('form.error') ?></h2></div>
    <?php else: ?>
    <div class="error-sum" data-form-error hidden></div>
    <?php endif; ?>
    <div class="step">
      <h2><?= det_e('form.name') ?></h2>
      <div class="field">
        <label for="full-name"><?= det_e('form.fullname') ?></label>
        <input id="full-name" name="name" type="text" autocomplete="name" required data-req>
      </div>
      <button class="btn js-only" type="button" data-next><?= det_e('continue') ?></button>
    </div>

    <div class="step">
      <button class="back js-only" type="button" data-back><?= det_e('back') ?></button>
      <h2><?= det_e('form.contact') ?></h2>
      <div class="field">
        <label for="email"><?= det_e('form.email') ?></label>
        <input id="email" name="email" type="email" autocomplete="email" required data-req>
      </div>
      <button class="btn js-only" type="button" data-next><?= det_e('continue') ?></button>
    </div>

    <div class="step">
      <button class="back js-only" type="button" data-back><?= det_e('back') ?></button>
      <h2><?= det_h($labels['place']) ?></h2>
      <div class="field">
        <label for="place"><?= det_h($labels['place']) ?></label>
        <input id="place" name="place" type="text" required data-req>
      </div>
      <button class="btn js-only" type="button" data-next><?= det_e('continue') ?></button>
    </div>

    <div class="step">
      <button class="back js-only" type="button" data-back><?= det_e('back') ?></button>
      <h2><?= det_e('form.date') ?></h2>
      <div class="field">
        <label for="event-date"><?= det_e('form.date.l') ?></label>
        <span class="hint"><?= det_e('form.date.h') ?></span>
        <input id="event-date" name="event-date" type="text" required data-req>
      </div>
      <button class="btn js-only" type="button" data-next><?= det_e('continue') ?></button>
    </div>

    <div class="step">
      <button class="back js-only" type="button" data-back><?= det_e('back') ?></button>
      <h2><?= det_h($labels['what']) ?></h2>
      <div class="field">
        <label for="account"><?= det_h($labels['what']) ?></label>
        <span class="hint"><?= det_h($labels['hint']) ?></span>
        <textarea id="account" name="details" required data-req></textarea>
      </div>
      <button class="btn js-only" type="button" data-next><?= det_e('continue') ?></button>
    </div>

    <div class="step">
      <button class="back js-only" type="button" data-back><?= det_e('back') ?></button>
      <h2><?= det_e('form.check') ?></h2>
      <div class="summary js-only" id="check-list" data-check></div>
      <button class="btn" type="submit" data-submit><?= det_e('form.send') ?></button>
    </div>

    <div class="step step--confirm">
      <div class="confirm">
        <h1><?= det_e('form.received') ?></h1>
        <p><?= det_e('form.ref') ?><br><strong id="ref-no" data-ref>—</strong></p>
      </div>
      <p><?= det_e('form.recognised') ?></p>
      <p><?= det_e('assurance') ?></p>
      <p><a href="<?= det_h(det_url()) ?>"><?= det_e('form.return') ?></a></p>
    </div>
  </form>
<?php endif; ?>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
