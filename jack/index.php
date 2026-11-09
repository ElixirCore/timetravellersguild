<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
$officeAutoload = dirname(__DIR__) . '/app/JackOffice/autoload.php';
if (is_file($officeAutoload)) require_once $officeAutoload;

ttg_graph_boot_session();
$csrf = ttg_graph_csrf();
$keeper = class_exists('OfficeAuth') && OfficeAuth::mayUseOffice(ttg_graph_viewer());
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>JACK — timetravellersguild.com</title>
<meta name="description" content="Jack lives inside a Rubik cube. Desk, tap, hopper, Jack. Click a station and he changes state.">
<meta name="theme-color" content="#111214">
<link rel="stylesheet" href="/jack/css/one.css?v=jack4">
<style>
#jackIntro{margin:.5rem 0 .2rem}
#jackIntro .intro-line{margin:0 0 .4rem;font-size:.8rem;letter-spacing:.06em;color:var(--dim)}
#jackIntroStart{background:var(--scarlet);color:var(--well);border:0;border-radius:2px;padding:.55rem 1.2rem;font:inherit;letter-spacing:.14em;cursor:pointer}
#jackIntroStart:focus-visible{outline:2px solid var(--well);outline-offset:2px}
</style>
<script src="/assets/jack-line.js?v=3"></script>
</head>
<body data-stance="jack">
<noscript>
  <p>Jack lives in one room. It needs ordinary JavaScript.</p>
  <p><a href="/now">NOW — the tree</a></p>
</noscript>

<canvas id="stage" aria-label="Jack’s room"></canvas>
<div id="grain" aria-hidden="true"></div>

<?= ttg_html_site_mark('JACK') ?>
<p id="hint">INSIDE THE CUBE · CLICK A STATION</p>

<section id="console" aria-label="Jack">
  <button type="button" id="btnCopyChat" aria-label="Copy chat" title="Copy chat">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="2.5" width="8" height="4" rx="0.6"/>
      <path d="M9 4H7.2A2.2 2.2 0 0 0 5 6.2v12.6A2.2 2.2 0 0 0 7.2 21h9.6a2.2 2.2 0 0 0 2.2-2.2V6.2A2.2 2.2 0 0 0 16.8 4H15"/>
      <path d="M9 11h6M9 15h4"/>
    </svg>
  </button>
  <header>
    <canvas id="jackPet" width="96" height="96" aria-label="Jack"></canvas>
    <div class="who">
      <p class="name">JACK</p>
      <p id="jackForm">HE IS HERE</p>
      <p id="stanceLine">WITH JACK</p>
    </div>
    <p id="stanceHint">He is not on duty. He is present.</p>
  </header>
  <p id="asked" hidden></p>
  <div id="mods" hidden>
    <div class="nine-stage">
      <canvas id="nine" width="18" height="18" aria-label="9-bit clerk module"></canvas>
      <p id="nineName">PUNCH COL</p>
    </div>
    <div id="tape" aria-hidden="true">
      <div id="tapeTrack"></div>
    </div>
  </div>
  <p id="said" aria-live="polite"></p>
  <div id="jackIntro" hidden>
    <p class="intro-line">HE LEFT AN INTRODUCTION</p>
    <button type="button" id="jackIntroStart">START</button>
    <audio id="jackIntroAudio" preload="auto" playsinline>
      <source src="/jack/jack-intro.m4a" type="audio/mp4">
      <source src="/jack/jack-intro.ogg" type="audio/ogg">
    </audio>
  </div>
  <div id="talkLog" class="sr" role="log"></div>
  <form id="askForm" class="ask">
    <label class="sr" for="askQ">Speak to Jack</label>
    <textarea id="askQ" rows="2" maxlength="2000" autocomplete="off" placeholder="Speak to Jack…"></textarea>
    <button type="submit" id="btnAsk">ASK</button>
  </form>
  <nav class="doors" aria-label="Doors">
    <a href="/">HOME</a>
    <a href="/now">NOW</a>
    <a href="/cube">CUBE</a>
    <a href="/join/">JOIN</a>
<?php if ($keeper): ?>
    <a href="/jack/office">OFFICE</a>
    <a href="/jack/ledger">LEDGER</a>
<?php endif; ?>
  </nav>
</section>

<aside id="hopper" hidden>
  <header>
    <p>PUNCHCARD TAROT · THREE STATIONS · NOT CANON</p>
    <button type="button" id="btnHopperClose">CLOSE</button>
  </header>
  <div id="hopperGrid"></div>
  <p id="hopperLoad" hidden>PUNCHING SLIPS</p>
  <button type="button" id="btnPunch">PUNCH THE HOPPER</button>
</aside>

<audio id="jackAudio" hidden playsinline></audio>
<?php readfile(__DIR__ . '/tarot/svg/deck.svg'); ?>

<script>window.TTG_JACK=<?= json_encode(['csrf' => $csrf, 'jack' => '/now/jack'], JSON_UNESCAPED_SLASHES) ?>;</script>
<script src="/jack/body/js/sprite.js?v=18"></script>
<script src="/jack/tarot/js/tarot.js?v=desk2"></script>
<script src="/assets/jack-voice.js?v=2"></script>
<script src="/jack/js/nine.js?v=1"></script>
<script src="/jack/js/one.js?v=jack5"></script>
<script src="/jack/js/intro.js?v=2"></script>
<!-- the little Jack: press the face, he listens and speaks -->
</body>
</html>
