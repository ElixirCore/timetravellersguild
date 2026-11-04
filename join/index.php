<?php
declare(strict_types=1);

/**
 * /join — one door into the Guild. Explains what membership gives you
 * (chat, map, passport), then takes one email and sends a magic link that
 * lands back here, signed in. Signed-in visitors get their three doors.
 * Sign-in itself is /people/auth (magic link, no password).
 */
require_once dirname(__DIR__) . '/people/inc/db.php';
require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/inc/og.php';

$user = ttg_current_user();
$viewer = ttg_graph_viewer();
$csrf = ttg_csrf_token();
$named = isset($_GET['named']);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

$title = 'Join the Time Travellers Guild — chat, map and passport';
$desc = 'Free membership with one email and no password. Talk with other travellers, explore the Upper Swansea Valley in 3D, and keep a passport of the places you stamp.';

$instruments = [
    [
        'key' => 'CHAT',
        'href' => '/people/chat/',
        'head' => 'Talk with other travellers',
        'body' => 'The Common Room is open to every member. Message anyone on the register privately, and write @jack to call the Guild’s clerk into the conversation.',
    ],
    [
        'key' => 'MAP',
        'href' => '/map/',
        'head' => 'Explore the valley in 3D',
        'body' => 'The Upper Swansea Valley as terrain you can tilt and fly over, with geology and heritage layers, a voice guide you can talk to, and a trail of the places you visit.',
    ],
    [
        'key' => 'PASSPORT',
        'href' => '/passport/',
        'head' => 'Keep a record of where you’ve been',
        'body' => 'Stamp places from the map and they collect in your Guild passport. Jack writes a short chronicle from your stamps.',
    ],
];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= ttg_h($user ? 'You’re in — Time Travellers Guild' : $title) ?></title>
<meta name="description" content="<?= ttg_h($desc) ?>">
<link rel="canonical" href="https://timetravellersguild.com/join/">
<meta name="theme-color" content="#d9cb9e">
<?= ttg_og_head(['title' => $title, 'description' => $desc, 'url' => 'https://timetravellersguild.com/join/']) ?>
<link rel="stylesheet" href="/assets/join.css?v=2">
<style>
.wrap{max-width:46rem;margin:0 auto}
.mast{display:block;max-width:46rem}
.mast h1{margin:0 0 .6rem}
.lede{font-size:1.05rem;max-width:38rem}
.hero-cta{margin:1rem 0 0}
.hero-cta .door{font-size:13px;padding:.65rem 1rem .55rem}
.what{margin:0 auto 2rem}
.what .slips{grid-template-columns:repeat(3,minmax(0,1fr))}
.what .slip h3{font-size:1rem}
.what .slip p{font-size:14px}
.key{margin:0 0 6px;font-size:12px;letter-spacing:.2em;color:var(--scarlet)}
.steps{margin:0 0 1.2rem;padding:0;list-style:none;counter-reset:s;display:grid;gap:6px}
.steps li{counter-increment:s;display:flex;gap:.7rem;align-items:baseline}
.steps li::before{content:counter(s);flex:none;display:inline-grid;place-items:center;width:1.6rem;height:1.6rem;border:1.5px solid var(--navy);font-size:12px;color:var(--navy)}
.join form.signup{display:flex;flex-direction:row;gap:8px;flex-wrap:wrap;margin:0;align-items:stretch}
.join form.signup input{flex:1 1 16rem;min-width:0;background:var(--paper);border:1.5px solid var(--navy);padding:.7rem .75rem;font-size:16px}
.signup input:focus{outline:2px solid var(--terra);outline-offset:1px}
.join form.signup button{flex:0 0 auto;padding:.7rem 1.1rem}
.fine{margin:1rem 0 0;font-size:12px;color:var(--dim);line-height:1.55}
.fine p{margin:0 0 .4rem}
.doors3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 1.4rem}
.doors3 .door{display:block;padding:1rem .9rem;font-size:15px;min-width:0}
.doors3 .door b{font-size:9px;margin-bottom:4px}
.doors3 .door span{display:block;margin-top:6px;font-size:11px;letter-spacing:.04em;text-transform:none;opacity:.85}
.join form.namebox{display:flex;flex-direction:row;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:.6rem 0 0}
.join form.namebox label{flex:1 1 14rem;display:flex;flex-direction:column;gap:4px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--navy)}
.join form.namebox input{background:var(--paper);border:1.5px solid var(--navy);padding:.6rem .65rem;font-size:16px;text-transform:none;letter-spacing:0}
.join form.namebox button{padding:.6rem .9rem}
.saved{color:var(--terra)}
.more{font-size:12px;color:var(--dim);text-align:center}
.more a{color:var(--navy)}
@media(max-width:700px){
  .what .slips,.doors3{grid-template-columns:1fr}
  body{padding-top:22px}
}
</style>
</head>
<body>
<?= ttg_html_site_mark() ?>
<p class="presents">THE TIME TRAVELLERS GUILD · MEMBERSHIP</p>

<?php if (!$user): ?>
<div class="wrap">
  <header class="mast">
    <h1>JOIN THE GUILD</h1>
    <p class="lede">The Time Travellers Guild is a community project rooted in the Upper Swansea Valley. Membership is free. It takes one email address — no password, nothing to install — and opens three instruments.</p>
    <p class="hero-cta"><a class="door primary" href="#join"><b>DOOR</b>JOIN — IT’S FREE</a></p>
  </header>

  <section class="what" aria-labelledby="whatHead">
    <p class="eyebrow" id="whatHead">WHAT YOU GET</p>
    <div class="slips">
      <?php foreach ($instruments as $i): ?>
      <article class="slip">
        <p class="key"><?= ttg_h($i['key']) ?></p>
        <h3><?= ttg_h($i['head']) ?></h3>
        <p><?= ttg_h($i['body']) ?></p>
      </article>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="join" id="join" aria-labelledby="joinHead">
    <article class="slip form-slip">
      <p class="beat-label">HOW IT WORKS</p>
      <h2 id="joinHead">Enter with your email</h2>
      <ol class="steps">
        <li>Type your email below.</li>
        <li>Open the link we send you. It works once, for 20 minutes.</li>
        <li>You’re in. Choose the name other travellers see.</li>
      </ol>
      <form class="signup" method="post" action="/people/auth/request.php">
        <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
        <input type="hidden" name="next" value="/join/?welcome=1">
        <label class="sr" for="email">Email address</label>
        <input id="email" name="email" type="email" required autocomplete="email" inputmode="email" maxlength="160" placeholder="you@example.com">
        <button type="submit">SEND MY LINK</button>
      </form>
      <div class="fine">
        <p>Already a member? The same box signs you back in.</p>
        <p>Your email is never shown to other members. We only email you to sign in, and — if you leave it switched on — when someone sends you a private message.</p>
        <p>Your name appears on the public register of travellers. You can hide it from your slip at any time.</p>
      </div>
    </article>
  </section>
</div>

<?php else: ?>
<?php $first = preg_split('/\s+/', trim((string) $user['display_name']))[0] ?? ''; ?>
<div class="wrap">
  <header class="mast">
    <h1>YOU’RE IN<?= $first !== '' ? ', ' . ttg_h(mb_strtoupper($first)) : '' ?></h1>
    <p class="lede">Welcome to the Guild. Three doors are open to you.</p>
  </header>

  <nav class="doors3" aria-label="Your instruments">
    <?php foreach ($instruments as $n => $i): ?>
      <a class="door<?= $n === 0 ? ' primary' : '' ?>" href="<?= ttg_h($i['href']) ?>"><b>DOOR</b><?= ttg_h($i['key']) ?><span><?= ttg_h($i['head']) ?></span></a>
    <?php endforeach; ?>
  </nav>

  <section class="join" aria-labelledby="nameHead">
    <article class="slip form-slip">
      <p class="beat-label">YOUR NAME IN THE GUILD</p>
      <h2 id="nameHead">How other travellers see you</h2>
      <form class="namebox" method="post" action="/join/name.php">
        <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
        <label for="display_name">Name
          <input id="display_name" name="display_name" required maxlength="80" autocomplete="name" value="<?= ttg_h((string) $user['display_name']) ?>">
        </label>
        <button type="submit">SAVE</button>
      </form>
      <p class="status<?= $named ? ' saved' : '' ?>" role="status"><?= $named ? 'Saved.' : 'Shown in chat and on the register. Your email stays private.' ?></p>
      <p class="more">Paint a 9×9 stamp, add a note, or hide yourself from the register on <a href="/people/profile/">your slip</a>.</p>
    </article>
  </section>
</div>
<?php endif; ?>

<nav id="dock" aria-label="NOW">
  <a href="/field/">FIELD</a>
  <a href="/now">TREE</a>
  <a href="/join/" aria-current="page">JOIN</a>
  <a href="/jack">JACK</a>
  <a href="/people/chat/">CHAT</a>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($viewer) ?>
</nav>
</body>
</html>
