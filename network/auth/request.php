<?php
declare(strict_types=1);
ini_set('display_errors', '0');
require_once dirname(__DIR__) . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') ttg_redirect('/network/');
if (!net_same_origin() || !net_csrf_ok((string) ($_POST['csrf'] ?? ''))) { http_response_code(400); exit('Invalid request token.'); }
$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 160) { http_response_code(422); exit('Enter a valid email address.'); }

// Same page whatever happens next, so the form cannot be used to probe which emails exist.
header('Cache-Control: no-store');
ob_start();
$pageTitle = 'Check your email — Guild network';
?><!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= ttg_h($pageTitle) ?></title><link rel="stylesheet" href="/network/app.css"></head>
<body class="solo"><main class="card"><p class="kicker">SIGN-IN REQUEST</p><h1>Check your email</h1>
<p>If the address can be reached, a single-use link is on its way. It expires in twenty minutes.</p>
<p><a href="/network/">Back</a></p></main></body></html>
<?php
$response = (string) ob_get_clean();
ignore_user_abort(true);
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
header('Content-Length: ' . strlen($response));
echo $response;
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
elseif (function_exists('litespeed_finish_request')) litespeed_finish_request();
else { while (ob_get_level() > 0) ob_end_flush(); flush(); }

ob_start(static fn(string $o): string => '');
set_error_handler(static function (int $s): never { throw new ErrorException('Sign-in delivery failed.', 0, $s); });
try {
    $ip = net_ip_key();
    // 8 requests/hour per visitor and 3 per 15 minutes per address; over the limit nothing is sent.
    if (net_rate('ip:' . $ip, 8, 3600) && net_rate('em:' . hash('sha256', $email), 3, 900)) {
        $link = ttg_create_magic_link($email); // same table/tokens as /people/auth
        $q = (string) parse_url($link, PHP_URL_QUERY);
        parse_str($q, $parts);
        $token = (string) ($parts['token'] ?? '');
        if ($token !== '') {
            $mine = net_origin() . '/network/auth/consume.php?token=' . rawurlencode($token);
            if (!ttg_send_magic_link($email, $mine)) error_log('Network sign-in email delivery failed.');
        }
    }
} catch (Throwable $e) {
    error_log('Network sign-in email could not be issued.');
} finally {
    restore_error_handler();
    ob_end_clean();
}
