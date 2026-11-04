<?php
declare(strict_types=1);

/**
 * Stop DM emails. Linked from every DM email and its List-Unsubscribe header.
 * The per-person token is the authority, so no sign-in is needed.
 * GET shows a button (mail scanners prefetch links and must not unsubscribe anyone);
 * POST turns emails off. That includes RFC 8058 one-click POSTs from mail clients.
 */
ini_set('display_errors', '0');
require_once dirname(__DIR__) . '/inc/chat.php';
header('Cache-Control: no-store');

$uid = (int) ($_GET['u'] ?? $_POST['u'] ?? 0);
$token = (string) ($_GET['t'] ?? $_POST['t'] ?? '');
$valid = false;
if ($uid > 0 && $token !== '' && ttg_user_by_id($uid)) {
    $valid = hash_equals(ttg_chat_prefs($uid)['quiet_token'], $token);
}

$done = false;
if ($valid && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    ttg_chat_set_email_dm($uid, false);
    $done = true;
    if (($_POST['List-Unsubscribe'] ?? '') === 'One-Click') {
        http_response_code(200);
        header('Content-Type: text/plain; charset=utf-8');
        exit("Unsubscribed.\n");
    }
}
if (!$valid) http_response_code(404);

$pageTitle = 'Message emails — Time Travellers Guild';
require dirname(__DIR__) . '/inc/header.php';
?>
<main class="auth-wrap">
  <section class="auth-card slip">
    <p class="beat-label">GUILD CHAT · EMAILS</p>
    <?php if (!$valid): ?>
      <h1>NO SUCH SLIP</h1>
      <p>This link is not valid. Sign in and use the switch in the chat to change your emails.</p>
      <p class="form-actions"><a class="door" href="/people/chat/"><b>DOOR</b> THE CHAT</a></p>
    <?php elseif ($done): ?>
      <h1>QUIET NOW</h1>
      <p>No more emails about new messages. You can turn them back on in the chat.</p>
      <p class="form-actions"><a class="door" href="/people/chat/"><b>DOOR</b> THE CHAT</a></p>
    <?php else: ?>
      <h1>STOP MESSAGE EMAILS?</h1>
      <p>You get at most one email per conversation until you've read it, and only when you're away. Stop them entirely?</p>
      <form method="post" class="form-actions">
        <input type="hidden" name="u" value="<?= $uid ?>">
        <input type="hidden" name="t" value="<?= ttg_h($token) ?>">
        <button class="primary" type="submit">STOP THE EMAILS</button>
        <a class="door" href="/people/chat/"><b>DOOR</b> KEEP THEM</a>
      </form>
    <?php endif; ?>
  </section>
</main>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
