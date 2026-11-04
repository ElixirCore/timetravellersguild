<?php
declare(strict_types=1);

require_once __DIR__ . '/inc.php';

$cfg = auction_config();
$lotId = (string) $cfg['lot_id'];
$sealed = auction_sealed_count($lotId);
$dataUri = auction_lot_data_uri();
$csrf = ttg_csrf_token();
$status = trim((string) ($_GET['status'] ?? ''));
$mine = null;
if ($status === 'sealed' && !empty($_GET['e'])) {
    $email = strtolower(trim((string) $_GET['e']));
    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $mine = auction_bid_for_email($lotId, $email);
    }
}

$pageTitle = $cfg['lot_title'] . ' — Auction — Time Travellers Guild';
$desc = 'Blind max-bid auction. Enter your ceiling. Confirm by magic link. No other bids are shown.';
$canonical = auction_public_base() . '/';
$v = '260910b';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= ttg_h($pageTitle) ?></title>
<meta name="description" content="<?= ttg_h($desc) ?>">
<meta name="theme-color" content="#0c1018">
<link rel="canonical" href="<?= ttg_h($canonical) ?>">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/auction/assets/auction.css?v=<?= ttg_h($v) ?>">
</head>
<body>
<a class="skip" href="#bid">Skip to bid</a>
<header class="top">
  <p class="mark"><a href="/">TIMETRAVELLERSGUILD.COM</a></p>
  <p class="kicker">AUCTION · BLIND · MAGIC LINK</p>
</header>

<main class="stage">
  <figure class="lot">
    <img src="<?= ttg_h($dataUri) ?>" alt="<?= ttg_h((string) $cfg['lot_title']) ?>" width="1200" height="1500" decoding="async">
  </figure>

  <section class="panel" id="bid">
    <p class="eyebrow">SEALED CEILING</p>
    <h1><?= ttg_h((string) $cfg['lot_title']) ?></h1>
    <p class="lede"><?= ttg_h((string) $cfg['lot_subtitle']) ?></p>
    <p class="blind">Bids are blind. You name a maximum. Others cannot see it. Confirmation arrives by one-time email link.</p>
    <p class="tally" aria-live="polite"><b><?= (int) $sealed ?></b> sealed · amounts withheld</p>

    <?php if ($status === 'check'): ?>
      <p class="flash ok">Check your email. The link seals the bid and expires in twenty minutes.</p>
    <?php elseif ($status === 'sealed' && $mine): ?>
      <p class="flash ok">Sealed. Your max is <?= ttg_h(auction_format_pence((int) $mine['max_pence'])) ?>. Only you see this figure.</p>
    <?php elseif ($status === 'bad'): ?>
      <p class="flash bad">That link is invalid, expired, or already used. Enter a new max bid below.</p>
    <?php elseif ($status === 'err'): ?>
      <p class="flash bad">Could not take that bid. Check the amount and try again.</p>
    <?php endif; ?>

    <form class="bid-form" method="post" action="/auction/request.php" autocomplete="on">
      <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
      <label>Email
        <input type="email" name="email" required autocomplete="email" placeholder="you@example.com">
      </label>
      <label>Name <span class="opt">(optional)</span>
        <input type="text" name="name" maxlength="80" autocomplete="name" placeholder="How the clerk should address you">
      </label>
      <label>Maximum bid (<?= ttg_h((string) $cfg['currency']) ?>)
        <span class="money">
          <span class="sym" aria-hidden="true"><?= ttg_h((string) $cfg['currency_symbol']) ?></span>
          <input type="number" name="max_bid" required min="<?= ttg_h((string) $cfg['min_bid']) ?>" step="0.01" inputmode="decimal" placeholder="0.00">
        </span>
      </label>
      <p class="fine">This is a ceiling, not a live shout. The Guild holds it sealed until the lot closes. Raising later replaces a lower sealed bid for the same email.</p>
      <button type="submit">SEND MAGIC LINK TO SEAL</button>
    </form>

    <p class="doors">
      <a href="/now">NOW</a>
      <a href="/people/auth/">REGISTER</a>
      <a href="/">HOME</a>
    </p>
  </section>
</main>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
