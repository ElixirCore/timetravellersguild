<?php
/**
 * wishlist/checkout.php - creates a one-off Stripe Checkout Session for one wishlist item.
 * - Price is read server-side from items.json; the client only sends an item id.
 * - The Stripe secret key is loaded server-side through the existing astro_secret() loader
 *   (same key Personal Sky uses). It is never sent to the browser.
 * - Does nothing until a file named ENABLED exists in this folder.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function wl_out(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') wl_out(405, ['error' => 'method']);

$origin = strtolower((string)parse_url($_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? ''), PHP_URL_HOST));
if (!in_array($origin, ['timetravellersguild.com', 'www.timetravellersguild.com'], true)) wl_out(403, ['error' => 'origin']);

if (!is_file(__DIR__ . '/ENABLED')) wl_out(503, ['error' => 'closed', 'message' => 'Contributions are not open yet.']);

// light throttle: 12 session requests per IP per hour
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
$tf = sys_get_temp_dir() . '/ttg-wishlist-' . md5($ip) . '.json';
$now = time();
$hits = [];
if (is_file($tf)) { $d = json_decode((string)file_get_contents($tf), true); if (is_array($d)) $hits = array_filter($d, fn($t) => $t > $now - 3600); }
if (count($hits) >= 12) wl_out(429, ['error' => 'rate', 'message' => 'Too many tries. Please wait a while.']);
$hits[] = $now;
@file_put_contents($tf, json_encode(array_values($hits)));

$in = json_decode((string)file_get_contents('php://input'), true);
$id = is_array($in) ? (string)($in['item'] ?? '') : '';
$cat = json_decode((string)file_get_contents(__DIR__ . '/items.json'), true);
$item = null;
foreach (($cat['groups'] ?? []) as $g) foreach ($g['items'] as $it) if ($it['id'] === $id) $item = $it;
if ($item === null) wl_out(400, ['error' => 'item']);

$secretsFile = __DIR__ . '/../../astro/secrets.php';
if (!is_file($secretsFile)) wl_out(503, ['error' => 'unconfigured', 'message' => 'Payments are not connected.']);
require_once $secretsFile;
$key = astro_secret('STRIPE_SECRET_KEY');
if ($key === '' || preg_match('/^paste[-_]/i', $key)) wl_out(503, ['error' => 'unconfigured', 'message' => 'Payments are not connected.']);

$base = 'https://timetravellersguild.com/wishlist/';
$ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_USERPWD => $key . ':',
    CURLOPT_TIMEOUT => 30,
    CURLOPT_POSTFIELDS => http_build_query([
        'mode' => 'payment',
        'success_url' => $base . '?thanks=1',
        'cancel_url' => $base,
        'submit_type' => 'donate',
        'line_items[0][quantity]' => 1,
        'line_items[0][price_data][currency]' => $cat['currency'] ?? 'gbp',
        'line_items[0][price_data][unit_amount]' => (int)$item['pence'],
        'line_items[0][price_data][product_data][name]' => 'Time Travellers Guild wishlist: ' . $item['name'],
        'metadata[source]' => 'ttg-wishlist',
        'metadata[item_id]' => $item['id'],
        'payment_intent_data[description]' => 'TTG wishlist contribution: ' . $item['name'],
        'payment_intent_data[metadata][source]' => 'ttg-wishlist',
        'payment_intent_data[metadata][item_id]' => $item['id'],
    ]),
]);
$res = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$data = is_string($res) ? json_decode($res, true) : null;
if ($status >= 400 || !is_array($data) || empty($data['url'])) wl_out(502, ['error' => 'stripe', 'message' => 'Checkout could not be started.']);
wl_out(200, ['url' => $data['url']]);
