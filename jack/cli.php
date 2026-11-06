<?php
declare(strict_types=1);

/**
 * /jack/cli.php — the Keeper's terminal line to Jack's desk (the /jack command in Claude Code).
 *
 * POST JSON {q, thread?} with "Authorization: Bearer <token>".
 * The token itself is never stored here: the server keeps only its SHA-256 in JACK_CLI_SECRET_SHA256
 * (private .env). A valid token speaks as one account only, JACK_CLI_USER (default the Keeper),
 * and that account must be a keeper.
 *
 * It opens a sign-in session for this one request, hands the message to the same desk the
 * /lodge/ page uses (now/jack.php: memory, tools, web search, reading the site), and removes
 * the session when the reply has been written.
 */

require_once dirname(__DIR__) . '/inc/env.php';
require_once dirname(__DIR__) . '/people/inc/db.php';
require_once dirname(__DIR__) . '/inc/graph.php';

@ini_set('display_errors', '0');
header('Cache-Control: no-store');

$fail = static function (int $code, string $msg): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
};

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $fail(405, 'POST only.');

$want = strtolower(trim(ttg_env('JACK_CLI_SECRET_SHA256')));
if (!preg_match('/^[0-9a-f]{64}$/', $want)) $fail(503, 'The terminal line is not connected.');
$auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if ($auth === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
        if (strtolower((string) $k) === 'authorization') $auth = (string) $v;
    }
}
/* Some hosts drop Authorization before PHP sees it; X-Jack-Token always arrives. */
if ($auth === '' && !empty($_SERVER['HTTP_X_JACK_TOKEN'])) $auth = 'Bearer ' . (string) $_SERVER['HTTP_X_JACK_TOKEN'];
if (!preg_match('/^Bearer\s+(\S{32,200})$/i', trim($auth), $m) || !hash_equals($want, hash('sha256', $m[1]))) {
    usleep(300000);
    $fail(401, 'Unsigned line.');
}

$in = json_decode((string) file_get_contents('php://input', false, null, 0, 20000), true);
$q = is_array($in) ? trim((string) ($in['q'] ?? '')) : '';
if ($q === '') $fail(400, 'Say something to Jack.');

$slug = trim(ttg_env('JACK_CLI_USER', 'tobywhy'));
$st = ttg_db()->prepare('SELECT * FROM users WHERE slug = ? LIMIT 1');
$st->execute([$slug]);
$user = ttg_user_hydrate($st->fetch() ?: null);
if (!$user) $fail(503, 'The terminal line names no traveller on the register.');

/* A sign-in session for this request only. */
$token = bin2hex(random_bytes(24));
ttg_db()->prepare('INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)')
    ->execute([(int) $user['id'], hash('sha256', $token), time() + 600, time()]);
$_COOKIE['ttg_people_session'] = $token;
register_shutdown_function(static function () use ($token): void {
    try {
        ttg_db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    } catch (Throwable $e) {
        error_log('jack/cli: could not remove the request session');
    }
    if (session_status() === PHP_SESSION_ACTIVE) @session_destroy();
});

require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
if (!JackPolicy::isKeeper(ttg_graph_viewer())) $fail(403, 'The terminal line is for a keeper.');

/* Hand the message to the desk exactly as the /lodge/ page would. */
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['HTTP_REFERER'] = 'https://timetravellersguild.com/lodge/';
unset($_SERVER['HTTP_SEC_FETCH_DEST']);
$_FILES = [];
$_POST = [
    'csrf' => ttg_graph_csrf(),
    'q' => mb_substr($q, 0, 4000),
    'intent' => 'ask',
    'site' => 'intro',
    'focus' => 'The Keeper, speaking from the workshop terminal',
    'thread' => is_array($in) ? mb_substr((string) ($in['thread'] ?? ''), -1500) : '',
];
require dirname(__DIR__) . '/now/jack.php';
