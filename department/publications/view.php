<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/boot.php';
$slug = (string) ($_GET['slug'] ?? '');
$p = det_pub($slug);
if (!$p) {
    http_response_code(404);
    $pageTitle = det_s('pub.missing') . ' — ' . det_s('dept');
    $crumbs = [['label' => det_s('nav.publications'), 'href' => det_url('publications')], ['label' => det_s('crumb.notfound')]];
    require dirname(__DIR__) . '/inc/header.php';
    echo '<div class="wrap"><h1>'.det_e('pub.missing').'</h1><p>'.det_e('pub.missing.p').'</p><p><a href="'.det_h(det_url('publications')).'">'.det_e('pub.library').'</a></p></div>';
    require dirname(__DIR__) . '/inc/footer.php';
    exit;
}
if (!empty($p['premium'])) {
    header('Location: ' . det_url('publications/det-codex-001'), true, 302);
    exit;
}
$pageTitle = $p['id'] . ' ' . (string) det_l($p, 'title') . ' — ' . det_s('dept');
$pageDescription = (string) det_l($p, 'summary');
$crumbs = [
    ['label' => det_s('nav.publications'), 'href' => det_url('publications')],
    ['label' => $p['id']],
];
require dirname(__DIR__) . '/inc/header.php';
$paras = det_la($p, 'paras') ?: ($p['paras'] ?? []);
?>
<div class="wrap">
  <div class="grid grid-2">
    <article>
      <p class="caption"><?= det_h($p['id']) ?></p>
      <h1><?= det_h((string) det_l($p, 'title')) ?></h1>
      <p class="muted"><?= det_h(det_ptype((string) ($p['type'] ?? ''))) ?> · <?= det_h(det_date($p['date'])) ?><?php if (!empty($p['isbn'])): ?> · <?= det_h($p['isbn']) ?><?php endif; ?><?php if (!empty($p['pages'])): ?> · <?= (int)$p['pages'] ?> <?= det_e('pub.pp') ?><?php endif; ?></p>
      <p><?= det_h((string) det_l($p, 'summary')) ?></p>
      <?php foreach ($paras as $para): ?>
        <p><?= det_h((string) $para) ?></p>
      <?php endforeach; ?>
      <h2><?= det_e('pub.rev') ?></h2>
      <table class="list">
        <thead><tr><th><?= det_e('pub.ver') ?></th><th><?= det_e('pub.date') ?></th><th><?= det_e('pub.note') ?></th></tr></thead>
        <tbody>
        <?php foreach (($p['revisions'] ?? []) as $r): ?>
          <tr>
            <td><?= det_h($r['ver']) ?></td>
            <td><?= det_h(det_date($r['date'])) ?></td>
            <td><?= det_h(det_rev_note($p, $r)) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
      <p class="muted"><?= det_e('pub.html.note') ?></p>
    </article>
    <aside class="related">
      <h2><?= det_e('pub.this') ?></h2>
      <ul>
        <li><?= det_e('pub.published') ?> <?= det_h(det_date($p['date'])) ?></li>
        <li><?= det_e('pub.last') ?> <?= det_h(det_date($p['revised'] ?? $p['date'])) ?></li>
        <li><a href="<?= det_h(det_url('publications')) ?>"><?= det_e('pub.all') ?></a></li>
      </ul>
    </aside>
  </div>
</div>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
