<?php
declare(strict_types=1);

/* Bootstrap for the site-wide "ask jack" glyph (assets/ask-jack.js).
 * Static pages cannot render a CSRF token or know who is signed in, so they ask here.
 * Returns only what the glyph needs: csrf, and for signed-in people their first name,
 * profile link and 9x9 pixel stamp. No email, no slug. */

require_once dirname(__DIR__) . '/inc/graph.php';

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo '{"ok":false}';
    exit;
}

$viewer = ttg_graph_viewer();
$known = !empty($viewer['known']);
$avatar = $known && is_array($viewer['avatar'] ?? null) ? array_values($viewer['avatar']) : [];
$inked = $known && count($avatar) === 81 && ttg_pixel_has_ink($avatar);

echo json_encode([
    'ok' => true,
    'csrf' => ttg_graph_csrf(),
    'you' => [
        'known' => $known,
        'first' => $known ? (string) ($viewer['first'] ?? '') : '',
        'href' => $known ? '/people/profile/' : '/people/auth/',
        'avatar' => $inked ? $avatar : [],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
