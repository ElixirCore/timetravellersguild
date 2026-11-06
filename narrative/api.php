<?php
declare(strict_types=1);

/**
 * /narrative/api.php — the signed-in traveller's story so far (for /assets/narrative.js).
 * POST JSON, same-origin, X-CSRF header (the /people session token).
 *   {op:"story"}                    → {premise, act, beats[], threads[]}
 *   {op:"premise", premise}         → set what their story is about, in their words
 *   {op:"withdraw", id}             → take one of their own beats out (yes-and: only they can)
 */

ini_set('display_errors', '0');
require_once dirname(__DIR__) . '/app/Narrative/Narrative.php';
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') ttg_json(['ok' => false, 'error' => 'POST only.'], 405);
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $o = strtolower((string) parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : ''));
    if ($o !== strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''))) ttg_json(['ok' => false, 'error' => 'Wrong door.'], 403);
}
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$stored = (string) ($_SESSION['csrf'] ?? '');
session_write_close();
if ($stored === '' || !hash_equals($stored, (string) ($_SERVER['HTTP_X_CSRF'] ?? ''))) {
    ttg_json(['ok' => false, 'error' => 'The slip is unsigned. Reload the page.'], 400);
}
$me = ttg_current_user();
if (!$me) ttg_json(['ok' => false, 'error' => 'Sign in to keep a story.', 'signin' => true], 401);
$uid = (int) $me['id'];
$in = json_decode((string) file_get_contents('php://input', false, null, 0, 20000), true);
if (!is_array($in)) ttg_json(['ok' => false, 'error' => 'Unreadable request.'], 400);

try {
    switch ((string) ($in['op'] ?? '')) {
        case 'story':
            ttg_json(['ok' => true] + Narrative::story($uid));
        case 'premise':
            Narrative::setPremise($uid, (string) ($in['premise'] ?? ''));
            ttg_json(['ok' => true] + Narrative::story($uid));
        case 'withdraw':
            if (!Narrative::withdraw($uid, (int) ($in['id'] ?? 0))) ttg_json(['ok' => false, 'error' => 'No such beat in your story.'], 404);
            ttg_json(['ok' => true] + Narrative::story($uid));
    }
    ttg_json(['ok' => false, 'error' => 'Unknown operation.'], 400);
} catch (Throwable $e) {
    error_log('Narrative API: ' . $e->getMessage());
    ttg_json(['ok' => false, 'error' => 'The story drawer jammed.'], 500);
}
