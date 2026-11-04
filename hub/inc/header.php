<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/inc/track.php';
require_once __DIR__ . '/functions.php';
$config = ttg_config();
$pageTitle = $pageTitle ?? ($config['site_name'] . ' — Hub');
$canonical = $canonical ?? $config['canonical_base'];
$hubDesc = $hubDesc ?? 'Modes, disciplines, avenues, properties and trajectory of the Time Travellers Guild. Station XIII console.';
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f1e4c4">
<meta name="description" content="<?= ttg_h($hubDesc) ?>">
<link rel="canonical" href="<?= ttg_h($canonical) ?>">
<title><?= ttg_h($pageTitle) ?></title>
<?= ttg_og_head(['title' => $pageTitle, 'description' => $hubDesc, 'url' => $canonical]) ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= ttg_h(ttg_asset('css/hub.css')) ?>">
</head>
<body>
