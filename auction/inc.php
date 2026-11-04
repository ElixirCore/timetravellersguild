<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/people/inc/functions.php';

function auction_config(): array {
    static $cfg;
    if ($cfg !== null) return $cfg;
    $people = ttg_config();
    $cfg = [
        'lot_id' => 'lot-1',
        'lot_title' => 'LOT Nº1',
        'lot_subtitle' => 'Blind sealed max bid · magic-link confirmed',
        'currency' => 'GBP',
        'currency_symbol' => '£',
        'min_bid' => 1.0,
        'db_path' => __DIR__ . '/data/auction.sqlite',
        'link_lifetime' => 60 * 20,
        'mail_from' => (string) ($people['mail_from'] ?? 'guild@timetravellersguild.com'),
        'mail_enabled' => !empty($people['mail_enabled']),
        'public_base' => 'https://timetravellersguild.com/auction',
    ];
    $meta = __DIR__ . '/lot.json';
    if (is_file($meta)) {
        $raw = json_decode((string) file_get_contents($meta), true);
        if (is_array($raw)) {
            foreach (['lot_id', 'lot_title', 'lot_subtitle', 'currency', 'currency_symbol', 'min_bid'] as $k) {
                if (array_key_exists($k, $raw)) $cfg[$k] = $raw[$k];
            }
        }
    }
    return $cfg;
}

function auction_db(): PDO {
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    $path = (string) auction_config()['db_path'];
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pending (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            max_pence INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at INTEGER NOT NULL,
            used_at INTEGER,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bids (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lot_id TEXT NOT NULL,
            email TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            max_pence INTEGER NOT NULL,
            sealed_at INTEGER NOT NULL,
            UNIQUE(lot_id, email)
        );
        CREATE INDEX IF NOT EXISTS idx_bids_lot ON bids(lot_id);
    ");
    return $pdo;
}

function auction_public_base(): string {
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    if ($host !== '' && !str_contains($host, 'timetravellersguild.com')) {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        return $scheme . '://' . $host . '/auction';
    }
    return rtrim((string) auction_config()['public_base'], '/');
}

function auction_lot_data_uri(): string {
    foreach (['lot.jpg', 'lot.jpeg', 'lot.png', 'lot.webp', 'lot.gif'] as $name) {
        $path = __DIR__ . '/' . $name;
        if (!is_file($path) || filesize($path) < 32) continue;
        $bin = file_get_contents($path);
        if ($bin === false || $bin === '') continue;
        $mime = match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            default => 'image/jpeg',
        };
        return 'data:' . $mime . ';base64,' . base64_encode($bin);
    }
    // Fallback plate when no lot photo is on disk yet.
    $svg = <<<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a2433"/>
      <stop offset="100%" stop-color="#0c1018"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1500" fill="url(#g)"/>
  <rect x="48" y="48" width="1104" height="1404" fill="none" stroke="#c9a227" stroke-width="3"/>
  <text x="600" y="640" text-anchor="middle" fill="#c9a227" font-family="Georgia, serif" font-size="42" letter-spacing="12">AWAITING LOT PHOTO</text>
  <text x="600" y="720" text-anchor="middle" fill="#e8dcc0" font-family="Courier New, monospace" font-size="22" letter-spacing="6">DROP auction/lot.jpg · AUTO BASE64</text>
</svg>
SVG;
    return 'data:image/svg+xml;base64,' . base64_encode($svg);
}

function auction_pence(float $amount): int {
    return (int) round($amount * 100);
}

function auction_format_pence(int $pence): string {
    $cfg = auction_config();
    $sym = (string) $cfg['currency_symbol'];
    return $sym . number_format($pence / 100, 2, '.', ',');
}

function auction_sealed_count(string $lotId): int {
    $stmt = auction_db()->prepare('SELECT COUNT(*) FROM bids WHERE lot_id = ?');
    $stmt->execute([$lotId]);
    return (int) $stmt->fetchColumn();
}

function auction_bid_for_email(string $lotId, string $email): ?array {
    $stmt = auction_db()->prepare('SELECT * FROM bids WHERE lot_id = ? AND email = ? LIMIT 1');
    $stmt->execute([$lotId, $email]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function auction_create_pending(string $email, string $name, int $maxPence): string {
    $cfg = auction_config();
    $token = ttg_random_token(32);
    $hash = hash('sha256', $token);
    $expires = time() + (int) $cfg['link_lifetime'];
    $stmt = auction_db()->prepare(
        'INSERT INTO pending(email, name, max_pence, token_hash, expires_at, created_at) VALUES(?,?,?,?,?,?)'
    );
    $stmt->execute([$email, $name, $maxPence, $hash, $expires, time()]);
    return auction_public_base() . '/confirm.php?token=' . rawurlencode($token);
}

function auction_consume_pending(string $token): ?array {
    $hash = hash('sha256', $token);
    $pdo = auction_db();
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT * FROM pending WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ? LIMIT 1');
    $stmt->execute([$hash, time()]);
    $row = $stmt->fetch();
    if (!$row) {
        $pdo->rollBack();
        return null;
    }
    $pdo->prepare('UPDATE pending SET used_at = ? WHERE id = ?')->execute([time(), $row['id']]);
    $lotId = (string) auction_config()['lot_id'];
    $email = (string) $row['email'];
    $name = (string) $row['name'];
    $max = (int) $row['max_pence'];
    $existing = auction_bid_for_email($lotId, $email);
    if ($existing && (int) $existing['max_pence'] >= $max) {
        // Keep higher sealed bid; still mark pending used.
        $pdo->commit();
        return [
            'email' => $email,
            'name' => $name,
            'max_pence' => (int) $existing['max_pence'],
            'raised' => false,
            'kept' => true,
        ];
    }
    $pdo->prepare(
        'INSERT INTO bids(lot_id, email, name, max_pence, sealed_at) VALUES(?,?,?,?,?)
         ON CONFLICT(lot_id, email) DO UPDATE SET
           name = excluded.name,
           max_pence = excluded.max_pence,
           sealed_at = excluded.sealed_at'
    )->execute([$lotId, $email, $name, $max, time()]);
    $pdo->commit();
    return [
        'email' => $email,
        'name' => $name,
        'max_pence' => $max,
        'raised' => (bool) $existing,
        'kept' => false,
    ];
}

function auction_send_magic_link(string $email, string $link, int $maxPence): bool {
    require_once dirname(__DIR__) . '/people/inc/mail.php';
    $cfg = auction_config();
    if (empty($cfg['mail_enabled'])) return false;
    $amount = auction_format_pence($maxPence);
    $title = (string) $cfg['lot_title'];
    $subject = 'Confirm your sealed bid: ' . $title;
    $text = "THE TIME TRAVELLERS GUILD — AUCTION\n\n"
          . "You asked to seal a blind max bid of {$amount} on {$title}.\n\n"
          . "Confirm with this one-time link (expires in 20 minutes):\n\n"
          . $link . "\n\n"
          . "Until you confirm, nothing is sealed. Bids stay blind.\n"
          . "If you did not request this, ignore this email.\n\n"
          . "https://timetravellersguild.com/auction\n";
    $amountH = htmlspecialchars($amount, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $titleH = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $html = ttg_parchment_html([
        'kicker' => 'AUCTION · BLIND MAX BID',
        'title' => 'Seal your ceiling',
        'lede' => "Lot: {$title}. Your maximum will stay sealed from other bidders.",
        'body_html' => '<p style="margin:0 0 18px;font-family:\'Courier New\',Courier,monospace;font-size:15px;letter-spacing:0.08em;text-transform:uppercase;color:#1e3a5f;border:1.5px solid #1e3a5f;padding:12px 14px;background:#cfc19a;">Max bid to seal: <strong style="color:#c41e3a;letter-spacing:0.04em;">' . $amountH . '</strong><br><span style="font-size:11px;letter-spacing:0.14em;color:#7b8070;">' . $titleH . '</span></p>',
        'cta_label' => 'SEAL THIS BID',
        'cta_url' => $link,
        'fine' => 'This link expires in twenty minutes and can only be used once. Until you confirm, nothing is sealed.',
        'foot' => 'If you did not request this, ignore this slip. Only you will see your maximum.',
    ]);
    return ttg_send_mail($email, $subject, $text, [
        'from' => (string) $cfg['mail_from'],
        'from_name' => 'Time Travellers Guild Auction',
        'html' => $html,
    ]);
}
