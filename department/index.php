<?php
declare(strict_types=1);
require_once __DIR__ . '/inc/boot.php';
require_once __DIR__ . '/inc/pages.php';

$path = det_path();
$parts = $path === '' ? [] : explode('/', $path);
$q = (string) ($_GET['q'] ?? '');

if ($path === 'publications/det-codex-001') {
    require __DIR__ . '/publications/det-codex-001/index.php';
    exit;
}

$page = null;
$http = 200;

if ($path === '') {
    $page = det_page_home();
} elseif ($path === 'about') {
    $page = det_page_about();
} elseif ($path === 'about/history') {
    $page = det_page_history();
} elseif ($path === 'about/organisation') {
    $page = det_page_organisation();
} elseif ($path === 'about/minister') {
    $page = det_page_minister();
} elseif ($path === 'maps' || $path === 'about/offices') {
    $page = det_page_offices();
} elseif ($path === 'about/annual-reports') {
    $page = det_page_annual();
} elseif ($path === 'about/foi') {
    $page = det_page_foi();
} elseif ($path === 'contact') {
    $page = det_page_contact();
} elseif ($path === 'careers') {
    $page = det_page_careers(null);
} elseif (($parts[0] ?? '') === 'careers' && isset($parts[1])) {
    $job = det_job($parts[1]);
    if (!$job) { $http = 404; $page = det_not_found(); }
    else $page = det_page_careers($job);
} elseif ($path === 'publications') {
    $page = det_page_publications(null, $q);
} elseif (($parts[0] ?? '') === 'publications' && isset($parts[1])) {
    $id = strtoupper(str_replace('-', '-', $parts[1]));
    $id = strtoupper($parts[1]);
    $pub = det_pub($id) ?: det_pub(strtoupper(str_replace('_', '-', $parts[1])));
    if (!$pub) {
        foreach (det_json('publications') as $p) {
            if (strtolower($p['id']) === strtolower($parts[1])) { $pub = $p; break; }
        }
    }
    if (!$pub) { $http = 404; $page = det_not_found(); }
    else $page = det_page_publications($pub, '');
} elseif ($path === 'research') {
    $page = det_page_research('');
} elseif (($parts[0] ?? '') === 'research') {
    $page = det_page_research($parts[1] ?? '');
} elseif ($path === 'services') {
    $page = det_page_services('');
} elseif (($parts[0] ?? '') === 'services') {
    $page = det_page_services($parts[1] ?? '');
} elseif ($path === 'forms') {
    $page = det_page_forms(null);
} elseif (($parts[0] ?? '') === 'forms' && isset($parts[1])) {
    $form = det_form(strtoupper($parts[1]));
    if (!$form) { $http = 404; $page = det_not_found(); }
    else $page = det_page_forms($form);
} elseif (in_array($path, ['cookies','privacy','accessibility'], true)) {
    $page = det_page_static($path);
} else {
    $http = 404;
    $page = det_not_found();
}

function det_not_found(): array {
    return [
        'title' => det_s('404.h1') . ' — ' . det_s('dept'),
        'crumbs' => [['label' => det_s('crumb.notfound')]],
        'html' => '<div class="svc"><h1>'.det_e('404.h1').'</h1><p>'.det_e('404.p').'</p><p><a href="'.det_h(det_url()).'">'.det_e('dept').'</a></p></div>',
    ];
}

if ($http !== 200) http_response_code($http);

$pageTitle = $page['title'];
$pageDescription = $page['desc'] ?? (det_s('wg') . '. ' . det_s('dept') . '.');
$pageDesc = $pageDescription;
$crumbs = $page['crumbs'] ?? [];
$bodyClass = $page['bodyClass'] ?? '';
$isHome = ($path === '');
require __DIR__ . '/inc/header.php';
$mainClass = $page['mainClass'] ?? '';
if ($mainClass) echo '<div class="'.det_h($mainClass).'">';
echo $page['html'];
if ($mainClass) echo '</div>';
require __DIR__ . '/inc/footer.php';
