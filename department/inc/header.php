<?php
declare(strict_types=1);
require_once __DIR__ . '/boot.php';

$pageTitle = $pageTitle ?? det_s('dept');
$pageDescription = $pageDescription ?? (det_s('wg') . '. ' . det_s('est') . '. ' . det_s('serving'));
$crumbs = $crumbs ?? [];
$bodyClass = $bodyClass ?? '';
$isHome = !empty($isHome);
$extraCss = $extraCss ?? [];
$canonical = $canonical ?? ('https://timetravellersguild.com' . (parse_url($_SERVER['REQUEST_URI'] ?? DET_WEB . '/', PHP_URL_PATH) ?: DET_WEB . '/'));
$lang = $GLOBALS['DET_LANG'] ?? 'en';
?>
<!doctype html>
<html lang="<?= $lang === 'cy' ? 'cy' : 'en' ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= det_h($pageTitle) ?></title>
<meta name="description" content="<?= det_h($pageDescription) ?>">
<meta name="theme-color" content="#111111">
<link rel="canonical" href="<?= det_h($canonical) ?>">
<?= ttg_og_head(['title' => $pageTitle, 'description' => $pageDescription, 'url' => $canonical]) ?>
<link rel="alternate" hreflang="en" href="<?= det_h(det_self_lang('en')) ?>">
<link rel="alternate" hreflang="cy" href="<?= det_h(det_self_lang('cy')) ?>">
<link rel="alternate" hreflang="x-default" href="<?= det_h(det_self_lang('en')) ?>">
<link rel="stylesheet" href="<?= det_h(DET_WEB) ?>/assets/department.css">
<noscript><style>.step{display:block}.step--confirm,.js-only{display:none!important}</style></noscript>
<?php foreach ($extraCss as $href): ?>
<link rel="stylesheet" href="<?= det_h($href) ?>">
<?php endforeach; ?>
<?php if (!empty($extraHead)): ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<?php endif; ?>
</head>
<body class="<?= det_h(trim($bodyClass . ($isHome ? ' home' : ''))) ?>" data-det-path="<?= det_h(det_path() === '' ? 'home' : det_path()) ?>" data-station="<?= det_h(det_station_url()) ?>">
<a class="skip" href="#main"><?= det_e('skip') ?></a>

<div class="cookie" id="cookie" hidden>
  <div class="wrap">
    <h2><?= det_e('cookie.h') ?></h2>
    <p><?= det_e('cookie.p') ?></p>
    <div class="cookie-actions">
      <button class="btn" type="button" id="cookie-ok"><?= det_e('cookie.ok') ?></button>
      <button class="btn btn-sec" type="button" id="cookie-no"><?= det_e('cookie.no') ?></button>
      <a href="<?= det_h(det_url('cookies')) ?>"><?= det_e('cookie.view') ?></a>
    </div>
  </div>
</div>

<div class="langbar">
  <div class="wrap">
    <?php if ($lang === 'en'): ?>
      <a href="<?= det_h(det_self_lang('cy')) ?>" lang="cy" hreflang="cy">Cymraeg</a>
    <?php else: ?>
      <a href="<?= det_h(det_self_lang('en')) ?>" lang="en" hreflang="en">English</a>
    <?php endif; ?>
  </div>
</div>

<header class="mast">
  <div class="mast-inner">
    <a class="brand" href="<?= det_h(det_url()) ?>">
      <svg viewBox="0 0 42 42" aria-hidden="true">
        <rect width="42" height="42" fill="#c8102e"/>
        <path d="M21 6l2.2 6.2 6.5.2-5.2 3.9 1.9 6.2L21 19.2 15.6 22.5l1.9-6.2-5.2-3.9 6.5-.2z" fill="#fff"/>
        <path d="M10 30h22v2H10z" fill="#fff"/>
      </svg>
      <span>
        <strong><?= det_e('wg') ?></strong>
        <small><?= det_e('wg.other') ?></small>
      </span>
    </a>
  </div>
</header>
<div class="deptbar">
  <div class="wrap">
    <a href="<?= det_h(det_url()) ?>"><?= det_e('dept') ?></a>
    <span class="cy"><?= det_h(det_t(['en'=>'Adran Amser Dros Ben','cy'=>'Department of Excess Time'])) ?></span>
  </div>
</div>

<?php if (!$isHome): ?>
<div class="wrap">
  <?php if (!empty($phase)): ?>
  <div class="phase"><span class="phase-tag"><?= det_e('phase.tag') ?></span> <?= det_h($phase) ?></div>
  <?php endif; ?>
  <?php if ($crumbs): ?>
  <nav class="crumbs" aria-label="<?= det_e('crumb.aria') ?>">
    <ol>
      <li><a href="<?= det_h(det_url()) ?>"><?= det_e('nav.home') ?></a></li>
      <?php foreach ($crumbs as $c): ?>
        <?php if (!empty($c['href'])): ?>
        <li><a href="<?= det_h($c['href']) ?>"><?= det_h($c['label']) ?></a></li>
        <?php else: ?>
        <li><?= det_h($c['label']) ?></li>
        <?php endif; ?>
      <?php endforeach; ?>
    </ol>
  </nav>
  <?php endif; ?>
</div>
<?php endif; ?>

<main id="main">
<div class="wrap"><p lang="en">DET is an FFILM.org artistic construction, not a statutory or governmental body.</p></div>