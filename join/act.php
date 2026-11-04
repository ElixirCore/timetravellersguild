<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo '{"ok":false,"error":"POST only."}';
    exit;
}

$raw = file_get_contents('php://input');
$input = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
if (!is_array($input)) $input = $_POST;

if (!ttg_graph_csrf_ok((string) ($input['csrf'] ?? ''))) {
    http_response_code(400);
    echo '{"ok":false,"error":"The clerk will not accept an unsigned slip."}';
    exit;
}

if (!ttg_jack_rate_allow('join', 8, true)) {
    http_response_code(429);
    echo '{"ok":false,"error":"The hopper is already holding your slip."}';
    exit;
}

$name = trim((string) ($input['name'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$place = trim((string) ($input['location'] ?? ''));
$mode = strtolower(trim((string) ($input['mode'] ?? 'arrival')));
$avatarPixels = trim((string) ($input['avatar_pixels'] ?? ''));
if (!in_array($mode, ['arrival', 'instrument', 'guild'], true)) $mode = 'arrival';
if ($name === '' || strlen($name) > 80) {
    http_response_code(400);
    echo '{"ok":false,"error":"A name is required."}';
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 160) {
    http_response_code(400);
    echo '{"ok":false,"error":"A working email is required."}';
    exit;
}
if ($avatarPixels !== '') {
    $decoded = json_decode($avatarPixels, true);
    if (!is_array($decoded) || count($decoded) !== 81) {
        $avatarPixels = '[]';
    }
}
$place = ttg_graph_redact_secrets($place);
if (strlen($place) > 120) $place = substr($place, 0, 120);
$name = ttg_graph_redact_secrets($name);
$message = trim((string) ($input['message'] ?? ''));
$message = ttg_graph_redact_secrets($message);
if (strlen($message) > 2000) $message = substr($message, 0, 2000);
$door = trim((string) ($input['door'] ?? ''));
if ($door !== '' && strlen($door) > 40) $door = substr($door, 0, 40);
if ($place === '' && $door === 'square') $place = 'Gillett Square';

$dir = dirname(__DIR__) . '/storage/join';
if (!is_dir($dir) && !@mkdir($dir, 0770, true) && !is_dir($dir)) {
    http_response_code(500);
    echo '{"ok":false,"error":"The hopper could not be written."}';
    exit;
}
$row = [
    'at' => (new DateTimeImmutable('now'))->format('c'),
    'name' => $name,
    'email' => $email,
    'location' => $place,
    'mode' => $mode,
    'door' => $door !== '' ? $door : 'join',
    'avatar_pixels' => $avatarPixels !== '' ? json_decode($avatarPixels, true) : [],
    'ip_hash' => ttg_graph_ip_hash(),
];
if ($message !== '') $row['message'] = $message;
$brief = ttg_briefing_relevant(ttg_briefing_read());
if (ttg_briefing_held($brief)) $row['briefing'] = $brief;
$line = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($line === false) {
    http_response_code(500);
    echo '{"ok":false,"error":"The hopper could not be written."}';
    exit;
}
$ok = (bool) @file_put_contents($dir . '/applications.jsonl', $line . "\n", FILE_APPEND | LOCK_EX);
if (!$ok) {
    http_response_code(500);
    echo '{"ok":false,"error":"The hopper could not be written."}';
    exit;
}

$first = preg_split('/\s+/', $name)[0] ?? $name;
echo json_encode([
    'ok' => true,
    'first' => $first,
    'note' => 'Coordinates punched. Held, not canon.',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
