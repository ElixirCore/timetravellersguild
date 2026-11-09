<?php
declare(strict_types=1);
/**
 * /coindrop/coin.php - server-verified coin issuance and redemption for the Busking Jack box.
 * action=status: verify a paid Checkout Session with Stripe, issue its unique coin (idempotent).
 * action=drop: spend the coin exactly once (HMAC token required, atomic under lock).
 * Coin identity: 64-hex HMAC-SHA256(session_id, server salt). Only its 12-char prefix is displayed.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/stripe-config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

$input = json_decode((string)file_get_contents('php://input'), true);
$action = is_array($input) ? (string)($input['action'] ?? '') : '';
$sessionId = is_array($input) ? trim((string)($input['session_id'] ?? '')) : '';
$token = is_array($input) ? trim((string)($input['token'] ?? '')) : '';
if (!in_array($action, ['status', 'drop'], true) || !preg_match('/^cs_(live|test)_[A-Za-z0-9]+$/', $sessionId)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'reason' => 'bad_request']);
    exit;
}

$store = __DIR__ . '/coin-data.php';
$state = ['coins' => [], 'paylog' => []];
$fh = fopen($store, 'c+');
if ($fh) { flock($fh, LOCK_EX); }
if ($fh && filesize($store) > 0) {
    $raw = (string)stream_get_contents($fh);
    $json = substr($raw, strpos($raw, "\n"));
    $decoded = json_decode($json, true);
    if (is_array($decoded)) { $state = array_merge($state, $decoded); }
}
$done = function () use ($fh) { if ($fh) { flock($fh, LOCK_UN); fclose($fh); } };
$save = function () use ($fh, $state) {
    if ($fh) {
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, "<?php exit; ?>\n" . json_encode($state));
        fflush($fh);
    }
};

if (!isset($state['coins'][$sessionId])) {
    /* verify the session with Stripe before issuing */
    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions/' . rawurlencode($sessionId));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => COINDROP_STRIPE_SECRET . ':',
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $session = is_string($response) ? json_decode($response, true) : null;

    $paid = is_array($session)
        && $status < 400
        && (string)($session['object'] ?? '') === 'checkout.session'
        && (string)($session['mode'] ?? '') === 'payment'
        && ((string)($session['payment_status'] ?? '') === 'paid')
        && (int)($session['amount_total'] ?? 0) === 100
        && (string)($session['currency'] ?? '') === 'gbp'
        && (string)($session['metadata']['app'] ?? '') === 'coindrop-coin'
        && (bool)($session['livemode'] ?? false);

    if (!$paid) {
        $done();
        http_response_code(402);
        echo json_encode(['ok' => false, 'reason' => 'unpaid']);
        exit;
    }

    $fullToken = hash_hmac('sha256', $sessionId, COINDROP_SALT);
    $state['coins'][$sessionId] = [
        'token' => $fullToken,
        'coin' => substr($fullToken, 0, 12),
        'email' => strtolower(trim((string)($session['customer_details']['email'] ?? $session['customer_email'] ?? ''))),
        'issued_at' => time(),
        'spent' => false,
    ];
    $save();
}

$record = $state['coins'][$sessionId];

if ($action === 'status') {
    /* token returned only to whoever holds the session id from the Stripe redirect */
    $done();
    echo json_encode(['ok' => true, 'coin' => $record['coin'], 'token' => $record['token'], 'spent' => (bool)$record['spent']]);
    exit;
}

/* action=drop: requires the full HMAC token; atomic under the file lock */
if (!hash_equals((string)$record['token'], $token)) {
    $done();
    http_response_code(403);
    echo json_encode(['ok' => false, 'reason' => 'bad_token']);
    exit;
}
if ($record['spent']) {
    $done();
    http_response_code(409);
    echo json_encode(['ok' => false, 'reason' => 'already_spent', 'coin' => $record['coin']]);
    exit;
}
$state['coins'][$sessionId]['spent'] = true;
$state['coins'][$sessionId]['spent_at'] = time();
$save();
$done();
echo json_encode(['ok' => true, 'coin' => $record['coin']]);
