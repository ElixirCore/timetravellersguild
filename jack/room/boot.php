<?php
declare(strict_types=1);

require_once __DIR__ . '/inc.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    ttg_body_json(['ok' => false, 'error' => 'GET only.'], 405);
}

try {
    ttg_body_json(ttg_body_boot());
} catch (Throwable $e) {
    ttg_body_json(['ok' => false, 'connected' => false, 'error' => 'The clerk could not open the drawer.'], 500);
}
