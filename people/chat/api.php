<?php
declare(strict_types=1);

/**
 * Guild chat API. POST JSON only, signed in only, CSRF header required.
 *   {op:"sync", conv, after, since, typing?}  → sidebar, new messages, deletions, presence
 *   {op:"history", conv, before}              → older messages
 *   {op:"send", conv, body, client_id}        → store; @jack in a room queues Jack
 *   {op:"delete", id}                         → withdraw own message
 *   {op:"dm", user_id}                        → open (or find) a DM
 *   {op:"read", conv, upto}                   → mark read
 */

ini_set('display_errors', '0');
require_once dirname(__DIR__) . '/inc/chat.php';

header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    ttg_json(['ok' => false, 'error' => 'POST only.'], 405);
}

// Same-origin only, when the browser says where it came from.
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    if (strtolower((string) parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '')) !== strtolower($host)) {
        ttg_json(['ok' => false, 'error' => 'Wrong door.'], 403);
    }
}

if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$stored = (string) ($_SESSION['csrf'] ?? '');
session_write_close(); // never hold the session lock while polling
$given = (string) ($_SERVER['HTTP_X_CSRF'] ?? '');
if ($stored === '' || !hash_equals($stored, $given)) {
    ttg_json(['ok' => false, 'error' => 'The slip is unsigned. Reload the page.', 'reload' => true], 400);
}

$me = ttg_current_user();
if (!$me) {
    ttg_json(['ok' => false, 'error' => 'Sign in to chat.', 'signin' => true], 401);
}
$meId = (int) $me['id'];

$raw = file_get_contents('php://input', false, null, 0, 16384);
$in = json_decode(is_string($raw) ? $raw : '', true);
if (!is_array($in)) {
    ttg_json(['ok' => false, 'error' => 'Unreadable request.'], 400);
}
$op = (string) ($in['op'] ?? '');

/** Load a conversation the caller may use, or stop. */
$conversation = static function (int $id) use ($meId): array {
    $conv = $id > 0 ? ttg_chat_conversation($id) : null;
    if (!$conv || !ttg_chat_can_access($conv, $meId)) {
        ttg_json(['ok' => false, 'error' => 'No such conversation.'], 404);
    }
    if ($conv['kind'] === 'room') ttg_chat_join((int) $conv['id'], $meId, (int) $conv['last_message_id']);
    return $conv;
};

try {
    switch ($op) {
        case 'sync': {
            $convId = (int) ($in['conv'] ?? 0);
            $after = max(0, (int) ($in['after'] ?? 0));
            $since = max(0, (int) ($in['since'] ?? 0));
            $out = ['ok' => true, 'now' => time()];
            $conv = $convId > 0 ? $conversation($convId) : null;
            ttg_chat_touch($meId, $conv ? (int) $conv['id'] : null, !empty($in['typing']));

            $out['convs'] = ttg_chat_list($meId);
            $ids = [];
            if ($conv) {
                $msgs = ttg_chat_messages((int) $conv['id'], $after);
                $out['messages'] = $msgs;
                $out['deleted'] = $since > 0 ? ttg_chat_deleted_since((int) $conv['id'], $since - 2) : [];
                $out['typing'] = ttg_chat_typing((int) $conv['id'], $meId);
                $out['jack_thinking'] = $conv['kind'] === 'room' && ttg_chat_locked('jack:' . (int) $conv['id']);
                $out['has_more'] = $after === 0 && count($msgs) >= TTG_CHAT_PAGE;
                foreach ($msgs as $m) $ids[] = $m['user_id'];
                $ids = array_merge($ids, $out['typing']);
                if ($msgs && empty($in['hidden'])) {
                    ttg_chat_mark_read((int) $conv['id'], $meId, (int) end($msgs)['id']);
                    foreach ($out['convs'] as &$c) if ($c['id'] === (int) $conv['id']) $c['unread'] = 0;
                    unset($c);
                }
            }
            $out['online'] = ttg_chat_online();
            if ($after === 0) {
                $out['me'] = ttg_chat_person($me);
                $out['directory'] = ttg_chat_directory($meId);
                $out['email_dm'] = ttg_chat_prefs($meId)['email_dm'];
            }
            $out['people'] = ttg_chat_people($ids);
            ttg_json($out);
        }

        case 'history': {
            $conv = $conversation((int) ($in['conv'] ?? 0));
            $before = max(1, (int) ($in['before'] ?? 0));
            $msgs = ttg_chat_messages((int) $conv['id'], 0, $before);
            ttg_json([
                'ok' => true,
                'messages' => $msgs,
                'has_more' => count($msgs) >= TTG_CHAT_PAGE,
                'people' => ttg_chat_people(array_map(fn ($m) => $m['user_id'], $msgs)),
            ]);
        }

        case 'send': {
            $conv = $conversation((int) ($in['conv'] ?? 0));
            $body = ttg_chat_clean((string) ($in['body'] ?? ''));
            if ($body === '') ttg_json(['ok' => false, 'error' => 'Nothing to punch.'], 422);
            if ($why = ttg_chat_rate_check($meId)) ttg_json(['ok' => false, 'error' => $why], 429);

            $jackNote = null;
            $wantsJack = $conv['kind'] === 'room' && ttg_chat_mentions_jack($body);
            if ($wantsJack) {
                $jackNote = ttg_chat_jack_gate($meId, (int) $conv['id']);
                if ($jackNote === null && !ttg_chat_lock('jack:' . (int) $conv['id'], ttg_chat_limits()['jack_lock_s'])) {
                    $jackNote = 'Jack is already writing a slip in this room.';
                }
            }
            $msg = ttg_chat_insert((int) $conv['id'], $meId, $body);
            ttg_chat_touch($meId, (int) $conv['id']);
            $payload = [
                'ok' => true,
                'message' => $msg,
                'client_id' => mb_substr((string) ($in['client_id'] ?? ''), 0, 40),
                'jack' => $wantsJack ? ($jackNote === null ? 'called' : 'refused') : null,
                'jack_note' => $jackNote,
            ];
            $callJack = $wantsJack && $jackNote === null;
            $isDm = $conv['kind'] === 'dm';
            if (!$callJack && !$isDm) ttg_json($payload);

            // Finish the sender's response first, then email / let Jack think.
            $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            ignore_user_abort(true);
            @set_time_limit(60);
            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            header('Content-Length: ' . strlen((string) $json));
            header('Connection: close');
            echo $json;
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } elseif (function_exists('litespeed_finish_request')) {
                litespeed_finish_request();
            } else {
                while (ob_get_level() > 0) ob_end_flush();
                flush();
            }
            if ($isDm) ttg_chat_maybe_notify($conv, $me, $msg);
            if ($callJack) ttg_chat_jack_reply((int) $conv['id'], $msg, $me);
            exit;
        }

        case 'delete': {
            $ok = ttg_chat_delete((int) ($in['id'] ?? 0), $meId);
            ttg_json($ok ? ['ok' => true] : ['ok' => false, 'error' => 'Only your own slips can be withdrawn.'], $ok ? 200 : 403);
        }

        case 'dm': {
            $conv = ttg_chat_open_dm($meId, (int) ($in['user_id'] ?? 0));
            if (!$conv) ttg_json(['ok' => false, 'error' => 'That traveller is not on the public register.'], 404);
            ttg_json(['ok' => true, 'conv' => (int) $conv['id']]);
        }

        case 'prefs': {
            if (array_key_exists('email_dm', $in)) ttg_chat_set_email_dm($meId, (bool) $in['email_dm']);
            ttg_json(['ok' => true, 'email_dm' => ttg_chat_prefs($meId)['email_dm']]);
        }

        case 'read': {
            $conv = $conversation((int) ($in['conv'] ?? 0));
            ttg_chat_mark_read((int) $conv['id'], $meId, min((int) ($in['upto'] ?? 0), (int) $conv['last_message_id']));
            ttg_json(['ok' => true]);
        }
    }
    ttg_json(['ok' => false, 'error' => 'Unknown operation.'], 400);
} catch (Throwable $e) {
    error_log('Guild chat API: ' . get_class($e) . ': ' . $e->getMessage());
    ttg_json(['ok' => false, 'error' => 'The exchange jammed. Try again.'], 500);
}
