<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/chat.php';
header('Cache-Control: no-store');

$pageTitle = 'Chat — Time Travellers Guild';
$me = ttg_current_user();
$csrf = $me ? ttg_csrf_token() : '';
$startConv = 0;
if ($me) {
    // /people/chat/?with=<slug> opens a DM; ?room=<slug> opens a room.
    $with = preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($_GET['with'] ?? '')));
    $room = preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($_GET['room'] ?? '')));
    if ($with !== '') {
        $other = ttg_user_by_slug($with);
        $conv = $other ? ttg_chat_open_dm((int) $me['id'], (int) $other['id']) : null;
        if ($conv) $startConv = (int) $conv['id'];
    } elseif ((int) ($_GET['c'] ?? 0) > 0) {
        // From a DM email: /people/chat/?c=<id>
        $conv = ttg_chat_conversation((int) $_GET['c']);
        if ($conv && ttg_chat_can_access($conv, (int) $me['id'])) $startConv = (int) $conv['id'];
    } elseif ($room !== '') {
        $stmt = ttg_chat_db()->prepare("SELECT id FROM chat_conversations WHERE kind = 'room' AND slug = ?");
        $stmt->execute([$room]);
        $startConv = (int) ($stmt->fetchColumn() ?: 0);
    }
}
require dirname(__DIR__) . '/inc/header.php';
?>
<?php if (!$me): ?>
<main class="auth-wrap">
  <section class="auth-card slip">
    <p class="beat-label">GUILD CHAT · MEMBERS ONLY</p>
    <h1>THE COMMON ROOM</h1>
    <p>The chat is for travellers on the register. Sign in with a magic link to read and write.</p>
    <p class="form-actions">
      <a class="door primary" href="<?= ttg_h(ttg_base('auth/')) ?>"><b>DOOR</b> SIGN IN</a>
      <a class="door" href="<?= ttg_h(ttg_base()) ?>"><b>DOOR</b> THE REGISTER</a>
    </p>
  </section>
</main>
<?php else: ?>
<main class="chat-main">
  <div class="chat" id="chat" data-api="/people/chat/api.php" data-csrf="<?= ttg_h($csrf) ?>" data-start="<?= $startConv ?>" data-me="<?= (int) $me['id'] ?>">
    <aside class="chat-side" aria-label="Conversations">
      <p class="beat-label">GUILD CHAT · NOT CANON</p>
      <nav id="convList" class="conv-list" aria-label="Rooms and messages"></nav>
      <details class="chat-people" id="peopleBox">
        <summary class="beat-label">NEW MESSAGE · THE REGISTER</summary>
        <input id="peopleFilter" type="search" placeholder="find a traveller" aria-label="Find a traveller">
        <ul id="peopleList" class="people-list"></ul>
      </details>
      <label class="chat-pref"><input type="checkbox" id="emailDm"> Email me when someone messages me and I'm away</label>
    </aside>

    <section class="chat-thread" aria-label="Conversation">
      <header class="thread-head">
        <button type="button" class="thread-back" id="backBtn" aria-label="Back to conversations">‹</button>
        <div class="thread-title">
          <h1 id="threadTitle">…</h1>
          <p id="threadSub" class="thread-sub"></p>
        </div>
      </header>
      <div class="thread-log" id="log" role="log" aria-live="polite" aria-relevant="additions">
        <button type="button" class="older" id="olderBtn" hidden>EARLIER SLIPS</button>
        <ol id="msgs" class="msgs"></ol>
      </div>
      <p class="thread-status" id="threadStatus" aria-live="polite"></p>
      <form class="composer" id="composer" autocomplete="off">
        <label class="sr" for="body">Message</label>
        <textarea id="body" name="body" rows="1" maxlength="<?= TTG_CHAT_MAX_CHARS ?>" placeholder="Write a slip…" enterkeyhint="send"></textarea>
        <button class="primary" type="submit" id="sendBtn">SEND</button>
      </form>
    </section>
  </div>
</main>
<script src="/people/assets/js/chat.js?v=8" defer></script>
<?php endif; ?>
<?php require dirname(__DIR__) . '/inc/footer.php'; ?>
