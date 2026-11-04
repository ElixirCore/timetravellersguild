<?php
declare(strict_types=1);

require_once __DIR__ . '/lib.php';

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo '{"ok":false,"error":"POST only."}';
    exit;
}

$n = (string) ($_POST['n'] ?? '');
if (preg_match('/^[1-7]$/', $n) === 1) {
    $n = '0' . $n;
}

if ($n === 'card') {
    $norm = trim(preg_replace('/\s+/u', ' ', (string) ($_POST['q'] ?? '')) ?? '');
    $ok = hash_equals(ttg_puzzle_hashes()['card'], hash('sha256', $norm));
    echo json_encode([
        'ok' => $ok,
        'stamp' => $ok ? ttg_puzzle_stamp($norm) : null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!isset(ttg_puzzle_hashes()[$n])) {
    http_response_code(400);
    echo '{"ok":false,"error":"Unknown slip."}';
    exit;
}

echo json_encode([
    'ok' => ttg_puzzle_ok($n, (string) ($_POST['q'] ?? '')),
    'n' => $n,
], JSON_UNESCAPED_UNICODE);
