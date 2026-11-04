<?php
declare(strict_types=1);

/* QUILL_MAILBOX_OUTBOUND_PULL_V1
 * Authenticated dead-drop retrieval for Quill's iMac.
 * Public users cannot call Quill through this endpoint.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

umask(0077);

function send_json(array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function home_dir(): string {
    $home = getenv('HOME');
    if (is_string($home) && $home !== '') {
        return rtrim($home, '/');
    }
    return dirname(__DIR__, 4);
}

function private_dir(): string {
    $dir = home_dir() . '/private/quill-mailbox';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Private mailbox directory unavailable.');
    }
    @chmod($dir, 0700);
    return $dir;
}

function auth_secret(): string {
    $path = private_dir() . '/poll-secret';
    if (!is_file($path)) {
        throw new RuntimeException('Poll secret unavailable.');
    }
    $value = trim((string)file_get_contents($path));
    if (!preg_match('/^[a-f0-9]{64}$/', $value)) {
        throw new RuntimeException('Poll secret invalid.');
    }
    return $value;
}

function require_auth(): void {
    $provided = trim((string)($_SERVER['HTTP_X_QUILL_MAIL_KEY'] ?? ''));
    $secret = auth_secret();
    if ($provided === '' || !hash_equals($secret, $provided)) {
        // Deliberately reveal nothing useful about this endpoint.
        send_json(['ok' => false], 404);
    }
}

function database(): SQLite3 {
    if (!class_exists('SQLite3')) {
        throw new RuntimeException('SQLite unavailable.');
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
    @chmod($path, 0600);
    return $db;
}

function pull_letters(int $limit): array {
    $stmt = database()->prepare(
        'SELECT id, created_at, sender_name, body '
        . 'FROM letters WHERE status = :status '
        . 'ORDER BY created_at ASC LIMIT :limit'
    );
    $stmt->bindValue(':status', 'QUEUED', SQLITE3_TEXT);
    $stmt->bindValue(':limit', $limit, SQLITE3_INTEGER);
    $result = $stmt->execute();
    if (!$result) {
        throw new RuntimeException('Mailbox query failed.');
    }

    $letters = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $letters[] = [
            'id' => (string)$row['id'],
            'created_at' => (string)$row['created_at'],
            'sender_name' => (string)$row['sender_name'],
            'body' => (string)$row['body'],
        ];
    }
    return $letters;
}

function acknowledge(array $ids): int {
    if (count($ids) > 20) {
        throw new InvalidArgumentException('Too many IDs.');
    }

    $db = database();
    $stmt = $db->prepare(
        'UPDATE letters SET status = :delivered '
        . 'WHERE id = :id AND status = :queued'
    );
    $changed = 0;

    $db->exec('BEGIN IMMEDIATE');
    try {
        foreach ($ids as $id) {
            if (!is_string($id) || !preg_match('/^letter-[a-f0-9]{16}$/', $id)) {
                throw new InvalidArgumentException('Invalid letter ID.');
            }
            $stmt->reset();
            $stmt->clear();
            $stmt->bindValue(':delivered', 'DELIVERED', SQLITE3_TEXT);
            $stmt->bindValue(':queued', 'QUEUED', SQLITE3_TEXT);
            $stmt->bindValue(':id', $id, SQLITE3_TEXT);
            if (!$stmt->execute()) {
                throw new RuntimeException('Mailbox acknowledgement failed.');
            }
            $changed += $db->changes();
        }
        $db->exec('COMMIT');
    } catch (Throwable $exc) {
        $db->exec('ROLLBACK');
        throw $exc;
    }

    return $changed;
}

try {
    require_auth();
    $method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method === 'GET') {
        $limit = (int)($_GET['limit'] ?? 10);
        $limit = max(1, min($limit, 20));
        send_json([
            'ok' => true,
            'letters' => pull_letters($limit),
        ]);
    }

    if ($method === 'POST') {
        $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > 12000) {
            send_json(['ok' => false, 'error' => 'request too large'], 413);
        }

        $raw = file_get_contents('php://input');
        $data = json_decode(is_string($raw) ? $raw : '', true);
        if (!is_array($data) || ($data['action'] ?? '') !== 'ack') {
            send_json(['ok' => false, 'error' => 'invalid request'], 400);
        }

        $ids = $data['ids'] ?? null;
        if (!is_array($ids)) {
            send_json(['ok' => false, 'error' => 'ids required'], 400);
        }

        send_json([
            'ok' => true,
            'acknowledged' => acknowledge(array_values($ids)),
        ]);
    }

    header('Allow: GET, POST');
    send_json(['ok' => false, 'error' => 'method not allowed'], 405);
} catch (InvalidArgumentException $exc) {
    send_json(['ok' => false, 'error' => $exc->getMessage()], 400);
} catch (Throwable $exc) {
    error_log('Quill mailbox pull failure: ' . $exc->getMessage());
    send_json(['ok' => false, 'error' => 'mailbox unavailable'], 503);
}
