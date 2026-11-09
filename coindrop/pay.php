<?php
declare(strict_types=1);
/**
 * /coindrop/pay.php - create a GBP1 Stripe Checkout Session for a Busking Jack coin.
 * One-off payment on the Godden Interactive Stripe account. No subscription, no email loop.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/stripe-config.php';

if (defined('COINDROP_PAUSED') && COINDROP_PAUSED) {
    http_response_code(503);
    echo json_encode(['error' => 'paused']);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

/* rate limit: 12 sessions per ip per hour */
$store = __DIR__ . '/coin-data.php';
$state = ['coins' => [], 'paylog' => []];
if (is_file($store)) {
    $raw = (string)file_get_contents($store);
    $json = substr($raw, strpos($raw, "\n"));
    $decoded = json_decode($json, true);
    if (is_array($decoded)) { $state = array_merge($state, $decoded); }
}
$now = time();
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$state['paylog'] = array_values(array_filter($state['paylog'], fn($e) => ($e['t'] ?? 0) > $now - 3600));
$mine = array_filter($state['paylog'], fn($e) => ($e['ip'] ?? '') === $ip);
if (count($mine) >= 12) {
    http_response_code(429);
    echo json_encode(['error' => 'rate_limited']);
    exit;
}
$state['paylog'][] = ['ip' => $ip, 't' => $now];
file_put_contents($store, "<?php exit; ?>\n" . json_encode($state), LOCK_EX);

$payload = [
    'mode' => 'payment',
    'success_url' => 'https://timetravellersguild.com/coindrop/?session_id={CHECKOUT_SESSION_ID}',
    'cancel_url' => 'https://timetravellersguild.com/coindrop/?cancelled=1',
    'line_items[0][quantity]' => 1,
    'line_items[0][price_data][currency]' => 'gbp',
    'line_items[0][price_data][unit_amount]' => 100,
    'line_items[0][price_data][product_data][name]' => 'Busking Jack coin',
    'line_items[0][price_data][product_data][description]' => 'A GBP1 digital coin for the Time Travellers Guild money box. Jack speaks when it drops.',
    'payment_intent_data[description]' => 'Busking Jack coin - timetravellersguild.com/coindrop',
    'metadata[app]' => 'coindrop-coin',
    'payment_intent_data[metadata][app]' => 'coindrop-coin',
];

$ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_USERPWD => COINDROP_STRIPE_SECRET . ':',
    CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    CURLOPT_POSTFIELDS => http_build_query($payload),
    CURLOPT_TIMEOUT => 30,
]);
$response = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = is_string($response) ? json_decode($response, true) : null;
if ($status >= 400 || !is_array($data) || empty($data['url'])) {
    http_response_code(502);
    echo json_encode(['error' => 'checkout_unavailable', 'detail' => (string)($data['error']['message'] ?? 'stripe error')]);
    exit;
}
echo json_encode(['url' => $data['url']]);
