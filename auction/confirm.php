<?php
declare(strict_types=1);

require_once __DIR__ . '/inc.php';

$token = trim((string) ($_GET['token'] ?? ''));
$result = $token !== '' ? auction_consume_pending($token) : null;
if (!$result) {
    ttg_redirect(auction_public_base() . '/?status=bad');
}

$q = http_build_query([
    'status' => 'sealed',
    'e' => (string) $result['email'],
]);
ttg_redirect(auction_public_base() . '/?' . $q);
