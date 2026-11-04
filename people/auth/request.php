<?php
declare(strict_types=1);
// Authentication responses must never contain mail/transport diagnostics.
ini_set('display_errors', '0');
require_once __DIR__ . '/../inc/db.php';
require_once __DIR__ . '/../inc/mail.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') ttg_redirect(ttg_base('auth/'));
ttg_require_csrf();

$email = strtolower(trim((string)($_POST['email'] ?? '')));
$next = ttg_auth_next((string)($_POST['next'] ?? ''));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    exit('Enter a valid email address.');
}

header('Cache-Control: no-store');
ob_start();
$pageTitle = 'Check your email — The Time Travellers Guild';
require __DIR__ . '/../inc/header.php';
?>
<main class="auth-wrap">
  <section class="auth-card slip">
    <p class="beat-label">SIGN-IN REQUEST</p>
    <h1>CHECK YOUR EMAIL</h1>
    <p>Check your email for a sign-in link. If it arrives, it expires in twenty minutes and can only be used once.</p>
  </section>
</main>
<?php
require __DIR__ . '/../inc/footer.php';
$response = (string) ob_get_clean();

// Complete the same response before contacting mail, including on a timeout.
// Content-Length also bounds the response on servers without a finish hook.
ignore_user_abort(true);
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
header('Content-Length: ' . strlen($response));
echo $response;
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} elseif (function_exists('litespeed_finish_request')) {
    litespeed_finish_request();
} else {
    while (ob_get_level() > 0) ob_end_flush();
    flush();
}

// Tokens exist only after the browser response is finished. Discard transport
// output too, including warnings or exception messages containing the link.
ob_start(static fn(string $output): string => '');
set_error_handler(static function (int $severity): never {
    throw new ErrorException('Sign-in delivery failed.', 0, $severity);
});
try {
    $link = ttg_create_magic_link($email, $next);
    if (!ttg_send_magic_link($email, $link)) {
        error_log('Guild sign-in email delivery failed.');
    }
} catch (Throwable $e) {
    error_log('Guild sign-in email could not be issued.');
} finally {
    restore_error_handler();
    unset($link);
    ob_end_clean();
}
