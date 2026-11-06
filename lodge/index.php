<?php
declare(strict_types=1);

require_once __DIR__ . '/../inc/graph.php';
ttg_graph_boot_session();
$csrf = ttg_graph_csrf();
$brief = ttg_briefing_read();
$play = ttg_play_read();
$viewer = ttg_graph_viewer();
$guild = ttg_guild_member($viewer);
$field = ttg_graph_navigator_field();

$sample = [];
$used = [];
foreach (['root', 'trunk', 'branch', 'leaf'] as $zone) {
    foreach ($field['nodes'] as $n) {
        if (!is_array($n) || !empty($n['pending'])) continue;
        $title = trim((string) ($n['title'] ?? ''));
        if ($title === '') continue;
        if (($n['zone'] ?? '') !== $zone) continue;
        $key = (string) ($n['slug'] ?? $n['id'] ?? $title);
        if (isset($used[$key])) continue;
        $used[$key] = true;
        $sample[] = [
            'title' => $title,
            'type' => (string) ($n['type'] ?? ''),
            'zone' => $zone,
            'href' => (string) ($n['href'] ?? '/n/'),
            'body' => (string) ($n['body'] ?? ''),
        ];
        break;
    }
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>JACK — Time Travellers Guild</title>
<meta name="description" content="The clerk is present. A record has been opened. One line is missing. Speak to Jack, then walk the public tree.">
<meta name="theme-color" content="#d9cb9e">
<link rel="stylesheet" href="/assets/intro.css?v=16">
<script src="/assets/jack-line.js?v=3"></script>
</head>
<body class="booting">
<a id="titleFlash" href="/now" aria-label="The Time Travellers Guild — enter NOW">
  <canvas id="titleCard" width="800" height="352" aria-hidden="true"></canvas>
  <p class="title-skip">CLICK TO ENTER NOW · OR WAIT</p>
</a>
<noscript>
<style>
#titleFlash{display:none!important}
body.booting .site-mark,body.booting .always-on,body.booting #stage{visibility:visible}
</style>
  <p>The clerk is present. A record has been opened in your name. It is incomplete.</p>
  <p>Two presents sit on one timeline: local 2026, network 17.04.2033. The public tree is NOW.</p>
  <p><a href="/now">NOW — the tree</a> · <a href="/cube">Jack’s cube</a></p>
</noscript>

<?= ttg_html_site_mark() ?>

<p class="doors always-on" aria-label="Instruments">
  <a class="door primary" href="/now"><b>NOW</b> THE TREE</a>
  <a class="door" href="/cube"><b>CUBE</b> JACK</a>
</p>

<div id="stage">
  <button type="button" id="jackHit" class="jack-hit" aria-label="Jack, the clerk. Click him to continue.">
    <canvas id="jackPet" width="96" height="96" aria-hidden="true"></canvas>
  </button>
  <p id="jackForm">THE CLERK IS IN</p>

  <div id="liveLine" class="sr" aria-live="polite">
    <span id="beatLabel">THE CLERK</span>
    <span id="beatText"></span>
  </div>

  <details id="threadBox" class="thread-box" open>
    <summary>INTERVIEW TRANSCRIPT <span id="threadCount">0 ENTRIES</span></summary>
    <section id="thread" class="thread" aria-label="Conversation with Jack"></section>
  </details>

  <div id="work"></div>

  <p class="controls" id="controls">
    <button type="button" id="advance">NEXT</button>
    <button type="button" id="skip">SKIP TO NOW</button>
  </p>

  <div id="invite" hidden>
    <p class="invite-line">The sitting is filed. Pick a door.</p>
    <p class="doors">
      <a class="door primary" href="/now"><b>NOW</b> THE TREE</a>
      <a class="door" href="/cube"><b>CUBE</b> JACK</a>
    </p>
    <p class="invite-quiet">Your name is now attached to the record. The full signet slip remains available from the register.</p>
  </div>
</div>

<script>window.TTG_INTRO=<?= json_encode(['csrf' => $csrf, 'jack' => '/now/jack', 'act' => '/intro/act', 'playAct' => '/play/act', 'joinAct' => '/join/act.php', 'voiceAct' => '/intro/voice', 'tree' => '/now', 'navigator' => $guild ? '/navigator' : '', 'leaves' => $sample, 'brief' => ttg_briefing_relevant($brief), 'play' => ttg_play_public($play), 'viewer' => ['known' => !empty($viewer['known']), 'name' => (string) ($viewer['name'] ?? ''), 'slug' => (string) ($viewer['slug'] ?? '')]], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;</script>
<script src="/jack/body/js/sprite.js?v=19"></script>
<script src="/assets/jack-voice.js?v=3"></script>
<script src="/assets/intro.js?v=21"></script>
<nav id="dock" aria-label="Guild">
  <a href="/now">NOW</a>
  <a href="/cube">CUBE</a>
  <a href="/chat">JACK</a>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($viewer) ?>
</nav>
<!-- the little Jack: press the face, he listens and speaks -->
<script src="https://ffilm.org/elevenlabs/jack-face.js" data-room="the Lodge desk - typed statements (timetravellersguild.com/lodge)"></script>
<?php if (!empty($viewer['known'])): require_once __DIR__ . '/../people/inc/db.php'; ?>
<script src="/assets/narrative.js?v=1" data-csrf="<?= htmlspecialchars(ttg_csrf_token(), ENT_QUOTES) ?>" defer></script>
<?php endif; ?>
</body>
</html>