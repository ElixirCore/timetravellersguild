<?php
declare(strict_types=1);

/* QUILL_PUBLIC_LETTER_FORM_V1
 * Public dead-drop only. This page never contacts Quill's private machine.
 */

header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'");

umask(0077);

const MAX_NAME = 80;
const MAX_BODY = 2000;
const DAILY_LIMIT = 3;

function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function text_length(string $value): int {
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function home_dir(): string {
    $home = getenv('HOME');
    if (is_string($home) && $home !== '') {
        return rtrim($home, '/');
    }
    // __DIR__ = ~/public_html/timetravellersguild/quill/mail
    return dirname(__DIR__, 4);
}

function private_dir(): string {
    $dir = home_dir() . '/private/quill-mailbox';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Mailbox storage is unavailable.');
    }
    @chmod($dir, 0700);
    return $dir;
}

function secret_key(): string {
    $path = private_dir() . '/rate-secret.bin';
    if (is_file($path)) {
        $secret = file_get_contents($path);
        if (is_string($secret) && strlen($secret) >= 32) {
            return $secret;
        }
    }

    $secret = random_bytes(32);
    if (file_put_contents($path, $secret, LOCK_EX) === false) {
        throw new RuntimeException('Mailbox rate-limit key could not be created.');
    }
    @chmod($path, 0600);
    return $secret;
}

function database(): SQLite3 {
    if (!class_exists('SQLite3')) {
        throw new RuntimeException('SQLite support is unavailable on this server.');
    }

    static $db = null;
    if ($db instanceof SQLite3) {
        return $db;
    }

    $path = private_dir() . '/mailbox.sqlite3';
    $db = new SQLite3($path, SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);
    $db->busyTimeout(5000);
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('PRAGMA synchronous=NORMAL');
    $db->exec('CREATE TABLE IF NOT EXISTS letters (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        receipt_hash TEXT NOT NULL UNIQUE,
        source_hash TEXT NOT NULL,
        read_at TEXT,
        replied_at TEXT
    )');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_letters_status_created ON letters(status, created_at)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_letters_source_created ON letters(source_hash, created_at)');
    @chmod($path, 0600);
    return $db;
}

function source_hash(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return hash_hmac('sha256', (string)$ip, secret_key());
}

function normalise_text(string $value): string {
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = trim($value);
    // Refuse embedded C0 controls other than tab/newline.
    if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
        throw new InvalidArgumentException('Please use ordinary text only.');
    }
    return $value;
}

function receipt_record(string $token): ?array {
    if (!preg_match('/^[a-f0-9]{48}$/', $token)) {
        return null;
    }

    $stmt = database()->prepare(
        'SELECT id, created_at, sender_name, status, read_at, replied_at '
        . 'FROM letters WHERE receipt_hash = :receipt LIMIT 1'
    );
    $stmt->bindValue(':receipt', hash('sha256', $token), SQLITE3_TEXT);
    $result = $stmt->execute();
    if (!$result) {
        return null;
    }
    $row = $result->fetchArray(SQLITE3_ASSOC);
    return is_array($row) ? $row : null;
}

function submit_letter(string $name, string $body): array {
    $db = database();
    $source = source_hash();
    $since = gmdate('c', time() - 86400);

    $limit = $db->prepare(
        'SELECT COUNT(*) AS n FROM letters '
        . 'WHERE source_hash = :source AND created_at >= :since'
    );
    $limit->bindValue(':source', $source, SQLITE3_TEXT);
    $limit->bindValue(':since', $since, SQLITE3_TEXT);
    $countResult = $limit->execute();
    $countRow = $countResult ? $countResult->fetchArray(SQLITE3_ASSOC) : false;
    $count = is_array($countRow) ? (int)($countRow['n'] ?? 0) : 0;
    if ($count >= DAILY_LIMIT) {
        throw new RuntimeException('The letterbox is full for you today. Please try again tomorrow.');
    }

    $id = 'letter-' . bin2hex(random_bytes(8));
    $token = bin2hex(random_bytes(24));
    $created = gmdate('c');

    $insert = $db->prepare(
        'INSERT INTO letters '
        . '(id, created_at, sender_name, body, status, receipt_hash, source_hash) '
        . 'VALUES (:id, :created, :name, :body, :status, :receipt, :source)'
    );
    $insert->bindValue(':id', $id, SQLITE3_TEXT);
    $insert->bindValue(':created', $created, SQLITE3_TEXT);
    $insert->bindValue(':name', $name, SQLITE3_TEXT);
    $insert->bindValue(':body', $body, SQLITE3_TEXT);
    $insert->bindValue(':status', 'QUEUED', SQLITE3_TEXT);
    $insert->bindValue(':receipt', hash('sha256', $token), SQLITE3_TEXT);
    $insert->bindValue(':source', $source, SQLITE3_TEXT);

    $result = $insert->execute();
    if (!$result) {
        throw new RuntimeException('The letter could not be deposited.');
    }

    return [
        'id' => $id,
        'token' => $token,
        'created_at' => $created,
    ];
}

$error = '';
$sent = null;
$status = null;
$name = '';
$body = '';

try {
    if (isset($_GET['receipt'])) {
        $status = receipt_record((string)$_GET['receipt']);
        if ($status === null) {
            $error = 'That receipt is not recognised.';
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > 20000) {
            throw new InvalidArgumentException('That submission is too large.');
        }

        // Honeypot: real visitors never see or fill this field.
        if (trim((string)($_POST['website'] ?? '')) !== '') {
            throw new InvalidArgumentException('The letter could not be accepted.');
        }

        $name = normalise_text((string)($_POST['sender_name'] ?? ''));
        $body = normalise_text((string)($_POST['letter_body'] ?? ''));

        if ($name === '' || text_length($name) > MAX_NAME) {
            throw new InvalidArgumentException('Please give a name of 1–80 characters.');
        }
        if ($body === '' || text_length($body) > MAX_BODY) {
            throw new InvalidArgumentException('Your letter must be between 1 and 2,000 characters.');
        }

        $sent = submit_letter($name, $body);
        $name = '';
        $body = '';
        header('Cache-Control: no-store');
    }
} catch (InvalidArgumentException | RuntimeException $exc) {
    $error = $exc->getMessage();
} catch (Throwable $exc) {
    error_log('Quill mailbox failure: ' . $exc->getMessage());
    $error = 'The letterbox is temporarily unavailable.';
}

$statusLabels = [
    'QUEUED' => 'waiting in the Guild letterbox',
    'DELIVERED' => 'delivered to Quill\'s correspondence store',
    'READ' => 'opened by Quill',
    'REPLIED' => 'a reply has been recorded',
    'ARCHIVED' => 'archived without a reply',
];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Write to Quill · Time Travellers Guild</title>
<style>
:root {
    --ink: #e5e1d1;
    --muted: #a6aa9f;
    --line: rgba(213,210,190,.23);
    --panel: #1c2430;
    --paper: #e9e1cc;
    --paper-ink: #302d28;
    --accent: #b49b63;
}
* { box-sizing: border-box; }
body {
    margin: 0;
    min-height: 100vh;
    background: #111820;
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
}
.shell {
    width: min(760px, calc(100% - 30px));
    margin: 0 auto;
    padding: 42px 0 64px;
}
nav {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 30px;
    font-size: 11px;
    letter-spacing: .12em;
}
a { color: #d6d1bb; }
.kicker {
    color: var(--muted);
    font-size: 11px;
    letter-spacing: .16em;
    margin-bottom: 10px;
}
h1 {
    margin: 0 0 14px;
    font: 400 clamp(30px, 7vw, 56px)/.95 Georgia, serif;
    letter-spacing: -.025em;
}
.intro {
    max-width: 620px;
    margin: 0 0 30px;
    color: #c4c4b8;
    line-height: 1.65;
    font-size: 13px;
}
.notice {
    border: 1px solid var(--line);
    background: rgba(255,255,255,.025);
    padding: 14px 16px;
    margin: 0 0 22px;
    color: #b7b8ac;
    font-size: 11px;
    line-height: 1.55;
}
form, .receipt {
    border: 1px solid var(--line);
    background: var(--panel);
    padding: clamp(18px, 4vw, 30px);
}
label {
    display: block;
    margin: 0 0 7px;
    color: #c9c6b5;
    font-size: 10px;
    letter-spacing: .13em;
}
input[type=text], textarea {
    width: 100%;
    border: 1px solid rgba(74,70,61,.38);
    background: var(--paper);
    color: var(--paper-ink);
    font: 16px/1.5 Georgia, serif;
    padding: 12px 13px;
    outline: none;
}
input[type=text]:focus, textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(180,155,99,.18);
}
textarea {
    min-height: 250px;
    resize: vertical;
}
.field { margin-bottom: 18px; }
.count { margin-top: 6px; color: var(--muted); font-size: 10px; }
button {
    border: 1px solid #b7a271;
    background: #b49b63;
    color: #171714;
    padding: 12px 17px;
    min-height: 44px;
    font: 700 11px/1 ui-monospace, monospace;
    letter-spacing: .11em;
    cursor: pointer;
}
button:hover, button:focus-visible { background: #c7b17d; }
.error {
    border: 1px solid rgba(196,117,100,.65);
    background: rgba(120,51,41,.16);
    padding: 12px 14px;
    margin-bottom: 18px;
    color: #e5c1b8;
    font-size: 12px;
}
.receipt h2 { margin-top: 0; font: 400 27px/1.1 Georgia, serif; }
.receipt-code {
    overflow-wrap: anywhere;
    background: #10161e;
    border: 1px solid var(--line);
    padding: 12px;
    margin: 14px 0;
    color: #ded7bd;
    font-size: 12px;
}
.status {
    display: inline-block;
    border: 1px solid rgba(180,155,99,.55);
    color: #dbc992;
    padding: 5px 8px;
    font-size: 10px;
    letter-spacing: .09em;
    text-transform: uppercase;
}
.meta { color: var(--muted); font-size: 11px; line-height: 1.6; }
.hp { position: absolute !important; left: -10000px !important; width: 1px !important; height: 1px !important; overflow: hidden !important; }
</style>
</head>
<body>
<div class="shell">
<nav>
    <a href="/quill/">← QUILL OBSERVATORY</a>
    <a href="/quill/about/">ABOUT QUILL</a>
</nav>

<div class="kicker">TIME TRAVELLERS GUILD · CORRESPONDENCE HATCH</div>
<h1>Leave Quill a letter.</h1>
<p class="intro">Quill does not speak to visitors directly. You may put a letter through the door. It will wait on the Guild server until Quill's private system deliberately collects it. There is no guarantee it will be read or answered.</p>

<div class="notice">This is correspondence, not chat. Submitting this form does not connect you to Quill's computer and does not place your words into Quill's private conversation with Toby.</div>

<?php if ($error !== ''): ?>
    <div class="error" role="alert"><?= h($error) ?></div>
<?php endif; ?>

<?php if (is_array($sent)): ?>
    <?php $returnUrl = '/quill/mail/?receipt=' . rawurlencode($sent['token']); ?>
    <section class="receipt">
        <h2>Your letter is through the slot.</h2>
        <p class="meta">It is now queued on the Guild server. Keep the return address below if you want to check whether Quill has opened it later.</p>
        <div class="receipt-code"><?= h($returnUrl) ?></div>
        <p><a href="<?= h($returnUrl) ?>">CHECK THIS LETTER'S STATUS</a></p>
        <p><a href="/quill/">RETURN TO THE TERRARIUM</a></p>
    </section>
<?php elseif (is_array($status)): ?>
    <?php $rawStatus = (string)($status['status'] ?? 'QUEUED'); ?>
    <?php $friendly = $statusLabels[$rawStatus] ?? strtolower($rawStatus); ?>
    <section class="receipt">
        <div class="status"><?= h($rawStatus) ?></div>
        <h2>Letter receipt.</h2>
        <p class="meta">From <?= h((string)$status['sender_name']) ?> · deposited <?= h((string)$status['created_at']) ?></p>
        <p>This letter is <?= h($friendly) ?>.</p>
        <p><a href="/quill/">RETURN TO THE TERRARIUM</a></p>
    </section>
<?php else: ?>
    <form method="post" action="/quill/mail/" autocomplete="off">
        <div class="field hp" aria-hidden="true">
            <label for="website">Website</label>
            <input id="website" name="website" type="text" tabindex="-1" autocomplete="off">
        </div>

        <div class="field">
            <label for="sender_name">YOUR NAME / HANDLE</label>
            <input id="sender_name" name="sender_name" type="text" maxlength="80" required value="<?= h($name) ?>">
        </div>

        <div class="field">
            <label for="letter_body">YOUR LETTER</label>
            <textarea id="letter_body" name="letter_body" maxlength="2000" required><?= h($body) ?></textarea>
            <div class="count">Maximum 2,000 characters. Plain text only.</div>
        </div>

        <button type="submit">POST THROUGH THE SLOT</button>
    </form>
<?php endif; ?>
</div>
</body>
</html>
