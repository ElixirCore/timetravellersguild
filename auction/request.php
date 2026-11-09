<?php
declare(strict_types=1);

require_once __DIR__ . '/inc.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ttg_redirect(auction_public_base() . '/');
}

ttg_require_csrf();

$cfg = auction_config();
$email = strtolower(trim((string) ($_POST['email'] ?? '')));
$name = trim(preg_replace('/\s+/', ' ', (string) ($_POST['name'] ?? '')) ?? '');
$maxRaw = str_replace([',', ' '], '', (string) ($_POST['max_bid'] ?? ''));
$max = is_numeric($maxRaw) ? (float) $maxRaw : 0.0;
$min = (float) $cfg['min_bid'];

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $max < $min) {
    ttg_redirect(auction_public_base() . '/?status=err');
}

$maxPence = auction_pence($max);
if ($maxPence < auction_pence($min)) {
    ttg_redirect(auction_public_base() . '/?status=err');
}

$link = auction_create_pending($email, $name, $maxPence);
$sent = auction_send_magic_link($email, $link, $maxPence);

if ($sent) {
    ttg_redirect(auction_public_base() . '/?status=check');
}

$pageTitle = 'Confirm link — Auction';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= ttg_h($pageTitle) ?></title>
<link rel="stylesheet" href="/auction/assets/auction.css?v=260910a">
</head>
<body>
<main class="panel solo">
  <p class="eyebrow">MAIL OFF · DEV LINK</p>
  <h1>Seal manually</h1>
  <p class="lede">Outbound mail is disabled in config. Use this one-time link to seal <?= ttg_h(auction_format_pence($maxPence)) ?>.</p>
  <p class="dev-link"><a href="<?= ttg_h($link) ?>"><?= ttg_h($link) ?></a></p>
  <p class="doors"><a href="/auction/">BACK</a></p>
</main>
</body>
</html>
