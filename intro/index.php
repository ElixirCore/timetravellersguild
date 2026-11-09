<?php
declare(strict_types=1);

/**
 * /intro — the front-of-house programme. Explains what timetravellersguild.com
 * is, lays out the windows into it (clerk, field, instruments, archive, and
 * the members' rooms), and invites a visitor to join or sign in with one email.
 * Sign-in itself is the magic link at /people/auth/request.php.
 */
require_once dirname(__DIR__) . '/people/inc/db.php';
require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/inc/og.php';

$user = ttg_current_user();
$viewer = ttg_graph_viewer();
$csrf = ttg_csrf_token();

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

$title = 'The Time Travellers Guild — an introduction';
$desc = 'A community project rooted in the Upper Swansea Valley: a clerk called Jack, a living field of stories, instruments to operate, and rooms for members. Here are the windows in.';

// Each window: [path, name, one line]. 'm' => true marks a members' room.
$wings = [
    [
        'key' => 'I · THE CLERK',
        'head' => 'Meet Jack',
        'lede' => 'Jack is the Guild’s clerk, a robot of punched card stock. He takes down what you tell him and files it. He doesn’t write canon; he lodges.',
        'windows' => [
            ['/', 'THE DESK', 'Jack at his desk. Speak to him and he opens a record.'],
            ['/jack', 'JACK’S CUBE', 'He lives inside a Rubik cube: desk, tap, hopper. Click a station.'],
            ['/lodge', 'THE LODGE', 'The written interview, for anyone without a microphone.'],
            ['/cube', 'CUBE', 'His geometry is slightly broken. Restore it one lesson at a time.'],
        ],
    ],
    [
        'key' => 'II · THE FIELD',
        'head' => 'Walk the tree',
        'lede' => 'Every story, place and object the Guild knows is a node in one public tree. The field is the same tree seen from five angles.',
        'windows' => [
            ['/now', 'NOW', 'The live tree: where the Guild stands today, and where you stand in it.'],
            ['/field/', 'THE FIELD', 'Five projections of one field. Tell Jack your story here.'],
            ['/view', 'VIEW', 'An autonomous orbit of the tree, searching on its own.'],
            ['/signals', 'SIGNALS', 'Coded broadcasts and transmissions without an agreed sender.'],
        ],
    ],
    [
        'key' => 'III · THE INSTRUMENTS',
        'head' => 'Operate the machines',
        'lede' => 'The Guild keeps numbered instruments. Some you can drive, some you just watch, and some broadcast whether or not anyone is listening.',
        'windows' => [
            ['/machine', 'TIME MACHINE №13', 'A living computational body for the Guild graph.'],
            ['/watch', 'THE WATCH №14', 'Glass plates on an orbit, warped through brass optics.'],
            ['/box', 'CHRONOS', 'The red K6 kiosk: a temporal relay booth.'],
            ['/screen', 'SCREEN', 'Three windows of footage on one schedule. Everyone sees the same edit.'],
            ['/radio', 'RADIO', 'The live temporal broadcast.'],
        ],
    ],
    [
        'key' => 'IV · THE ARCHIVE',
        'head' => 'Read the record',
        'lede' => 'The papers behind the Guild: how it was founded, what it supplies, and the work in progress.',
        'windows' => [
            ['/cardiff', 'THE FOUNDING', 'An archival note on the cross-temporal founding at Cardiff.'],
            ['/grimoire', 'GRIMOIRE', 'Ethics, elements, tools, attention, and a register of found objects.'],
            ['/film', 'FILM', 'Great Awakenings: the canon treatment, as a work in progress.'],
            ['/elixircorp', 'ELIXIRCORP', 'Suppliers to the time-travel craft. Founded 1926, reincorporated 2026.'],
        ],
    ],
    [
        'key' => 'V · THE MEMBERS’ ROOMS',
        'head' => 'Join and travel',
        'lede' => 'Membership is free and opens the rooms where travellers meet, map the valley and keep a record of where they’ve been.',
        'windows' => [
            ['/map/', 'MAP', 'The Upper Swansea Valley in 3D, with geology, heritage and a voice guide.', 'm'],
            ['/passport/', 'PASSPORT', 'Stamp places from the map. Jack writes your chronicle.', 'm'],
            ['/people/chat/', 'CHAT', 'The Common Room, private messages, and @jack on call.', 'm'],
            ['/ledger', 'THE LEDGER', 'A collective book of time, one collage page per traveller.', 'm'],
            ['/network', 'THE REGISTER', 'The members of the Guild, by the names they chose.', 'm'],
        ],
    ],
];

// Each window's plate: a screenshot in /assets/intro/<name>.webp, captured from the live page.
$plates = [
    '/' => 'desk', '/jack' => 'jack', '/lodge' => 'lodge', '/cube' => 'cube',
    '/now' => 'now', '/field/' => 'field', '/view' => 'view', '/signals' => 'signals',
    '/watch' => 'watch', '/box' => 'box', '/screen' => 'screen', '/radio' => 'radio',
    '/cardiff' => 'cardiff', '/grimoire' => 'grimoire', '/film' => 'film', '/elixircorp' => 'elixircorp',
    '/map/' => 'map', '/passport/' => 'passport', '/people/chat/' => 'chat', '/ledger' => 'ledger', '/network' => 'network',
];
$plate = static function (string $path) use ($plates): string {
    $name = $plates[$path] ?? '';
    return ($name !== '' && is_file(dirname(__DIR__) . '/assets/intro/' . $name . '.webp')) ? '/assets/intro/' . $name . '.webp?v=1' : '';
};

$first = $user ? (preg_split('/\s+/', trim((string) $user['display_name']))[0] ?? '') : '';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= ttg_h($title) ?></title>
<meta name="description" content="<?= ttg_h($desc) ?>">
<link rel="canonical" href="https://timetravellersguild.com/intro/">
<meta name="theme-color" content="#d9cb9e">
<?= ttg_og_head(['title' => $title, 'description' => $desc, 'url' => 'https://timetravellersguild.com/intro/']) ?>
<link rel="stylesheet" href="/assets/join.css?v=2">
<style>
.wrap{max-width:66rem;margin:0 auto}
.mast{display:block;max-width:66rem;margin:0 0 2rem}
.mast h1{margin:0 0 .8rem;font-size:clamp(1.9rem,6vw,3.2rem);letter-spacing:.14em;line-height:1.1}
.mast h1 small{display:block;font-size:.36em;letter-spacing:.3em;color:var(--terra);margin-bottom:.6rem}
.lede{font-size:1.05rem;max-width:40rem}
.hero-cta{display:flex;flex-wrap:wrap;gap:8px;margin:1.3rem 0 0}
.hero-cta .door{font-size:13px;padding:.65rem 1rem .55rem}

.contents{margin:0 0 2.6rem;padding:.9rem 1rem;border-top:1.5px solid var(--navy);border-bottom:1.5px solid var(--navy);
  display:flex;flex-wrap:wrap;gap:.4rem 1.4rem;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.contents a{color:var(--navy);text-decoration:none}
.contents a:hover,.contents a:focus-visible{color:var(--scarlet);text-decoration:underline}

.wing{margin:0 0 2.8rem;scroll-margin-top:16px}
.wing-head{display:grid;grid-template-columns:minmax(0,15rem) minmax(0,1fr);gap:.4rem 1.6rem;margin:0 0 1rem;align-items:baseline}
.wing-head h2{font-size:1.5rem;margin:0}
.wing-head .lede{font-size:15px;margin:0;grid-column:2;grid-row:1 / span 2}
.windows{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr));gap:10px;margin:0;padding:0;list-style:none}
.windows li{display:flex}
.win{flex:1;display:block;padding:1.3rem 1rem 1rem;border:1.5px solid var(--navy);background:var(--well);
  color:var(--ink);text-decoration:none;position:relative;
  clip-path:polygon(14px 0,100% 0,100% 100%,0 100%,0 14px)}
.win::before{content:"";position:absolute;top:0;left:0;width:14px;height:14px;
  background:linear-gradient(135deg,transparent 49%,var(--navy) 50%)}
.win .path{display:block;font-size:10px;letter-spacing:.14em;color:var(--terra);margin:0 0 4px}
.win .name{display:block;font-size:15px;letter-spacing:.12em;color:var(--navy);margin:0 0 6px}
.win .line{display:block;font-size:14px;line-height:1.45}
.win .lock{position:absolute;top:10px;right:10px;font-size:9px;letter-spacing:.16em;padding:2px 5px;border:1px solid var(--terra);color:var(--terra)}
.win:hover,.win:focus-visible{background:var(--navy);color:var(--paper);outline:none}
.win:hover .name,.win:focus-visible .name,.win:hover .path,.win:focus-visible .path{color:var(--paper)}
.win:hover .lock,.win:focus-visible .lock{border-color:var(--paper);color:var(--paper)}
.win:focus-visible{box-shadow:0 0 0 3px var(--scarlet)}
.wing.members .win{background:var(--paper)}
.win .plate{display:block;margin:-.3rem -.4rem .9rem;aspect-ratio:16/10;perspective:900px;position:relative}
.win .plate img,.win .plate i{display:block;width:100%;height:100%;object-fit:cover;object-position:top left;border:1.5px solid var(--navy);
  background:var(--ink);transform-origin:50% 100%;transform:rotateX(14deg) rotateZ(-1.2deg) scale(.94);
  box-shadow:0 12px 18px -10px rgba(22,24,20,.55);transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s}
.win .plate i{display:grid;place-items:center;font-style:normal;color:var(--paper);letter-spacing:.3em;font-size:22px;
  background:repeating-linear-gradient(0deg,transparent 0 9px,rgba(217,203,158,.12) 9px 10px),repeating-linear-gradient(90deg,transparent 0 9px,rgba(217,203,158,.12) 9px 10px),var(--ink)}
.windows li:nth-child(even) .win .plate img,.windows li:nth-child(even) .win .plate i{transform:rotateX(14deg) rotateZ(1.2deg) scale(.94)}
.win:hover .plate img,.win:focus-visible .plate img,.win:hover .plate i,.win:focus-visible .plate i{transform:none;box-shadow:0 4px 10px -6px rgba(0,0,0,.6)}
.wing.members .windows li:first-child{grid-column:1 / -1}
.wing.members .windows li:first-child .plate{aspect-ratio:16/6}

.mast{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,24rem);gap:1rem 2rem;align-items:center}
.mast > *{grid-column:1}
.fan{grid-column:2;grid-row:1 / span 4;position:relative;height:22rem;perspective:1100px}
.fp{position:absolute;margin:0;width:15rem;transform-style:preserve-3d;transition:transform .4s cubic-bezier(.2,.7,.2,1)}
.fp img{display:block;width:100%;height:auto;border:2px solid var(--navy);background:var(--ink);box-shadow:0 22px 30px -14px rgba(22,24,20,.6)}
.fp figcaption{margin-top:5px;font-size:9px;letter-spacing:.2em;color:var(--terra)}
.fp0{top:0;left:0;transform:rotateY(18deg) rotateX(8deg) rotateZ(-4deg)}
.fp1{top:3.2rem;left:5.5rem;transform:rotateY(-16deg) rotateX(10deg) rotateZ(3deg)}
.fp2{top:9rem;left:-.5rem;transform:rotateY(20deg) rotateX(12deg) rotateZ(-2deg)}
.fp3{top:12.2rem;left:6.5rem;transform:rotateY(-14deg) rotateX(6deg) rotateZ(4deg)}
.fan:hover .fp{transform:none}
.fp:hover{z-index:2}
@media(prefers-reduced-motion:reduce){.fp,.win .plate img{transition:none}}


.steps{margin:0 0 1.2rem;padding:0;list-style:none;counter-reset:s;display:grid;gap:6px}
.steps li{counter-increment:s;display:flex;gap:.7rem;align-items:baseline}
.steps li::before{content:counter(s);flex:none;display:inline-grid;place-items:center;width:1.6rem;height:1.6rem;border:1.5px solid var(--navy);font-size:12px;color:var(--navy)}
.join{scroll-margin-top:16px}
.join form.signup{display:flex;flex-direction:row;gap:8px;flex-wrap:wrap;margin:0;align-items:stretch}
.join form.signup input{flex:1 1 16rem;min-width:0;background:var(--paper);border:1.5px solid var(--navy);padding:.7rem .75rem;font-size:16px}
.join form.signup button{flex:0 0 auto;padding:.7rem 1.1rem}
.fine{margin:1rem 0 0;font-size:12px;color:var(--dim);line-height:1.55}
.fine p{margin:0 0 .4rem}
.welcome .door{margin-top:.8rem}

@media(max-width:700px){
  .wing-head{grid-template-columns:1fr}
  .wing-head .lede{grid-column:1;grid-row:auto}
  .windows{grid-template-columns:1fr}
  .mast{display:block;text-align:left}
  .fan{height:15rem;margin:1.6rem auto 0;max-width:21rem}
  .fp{width:11rem}
  .fp1{left:9rem;top:1.5rem}.fp2{top:6.5rem;left:0}.fp3{top:8rem;left:9.5rem}
  body{padding-top:22px}
}
</style>
</head>
<body>
<?= ttg_html_site_mark('INTRODUCTION') ?>
<p class="presents">THE TIME TRAVELLERS GUILD · A PROGRAMME FOR VISITORS</p>

<div class="wrap">
  <header class="mast">
    <h1><small><?= $first !== '' ? 'WELCOME BACK, ' . ttg_h(mb_strtoupper($first)) : 'YOU HAVE ARRIVED' ?></small>THE TIME TRAVELLERS GUILD</h1>
    <p class="lede">The Guild is a community project rooted in the Upper Swansea Valley, and a website you can walk around in. A clerk called Jack keeps the record. Travellers bring stories, places and found objects, and he files them into one public tree. Nothing here is canon until a keeper writes it so.</p>
    <p class="lede" style="margin-top:.8rem">This page is a map of the windows in. Most are open to anyone. The members’ rooms need one email address: no password, nothing to install, free.</p>
    <p class="hero-cta">
      <?php if (!$user): ?>
      <a class="door primary" href="#join"><b>DOOR</b>JOIN OR SIGN IN</a>
      <?php else: ?>
      <a class="door primary" href="/people/chat/"><b>DOOR</b>THE COMMON ROOM</a>
      <?php endif; ?>
      <a class="door" href="/"><b>DOOR</b>SPEAK TO JACK</a>
      <a class="door" href="/now"><b>DOOR</b>WALK THE TREE</a>
    </p>
    <div class="fan" aria-hidden="true">
      <?php foreach ([['/lodge', 'THE LODGE'], ['/now', 'THE TREE'], ['/map/', 'THE MAP'], ['/passport/', 'PASSPORT']] as $k => $f): ?>
      <figure class="fp fp<?= $k ?>"><img src="<?= ttg_h($plate($f[0])) ?>" alt="" width="640" height="400"><figcaption><?= ttg_h($f[1]) ?></figcaption></figure>
      <?php endforeach; ?>
    </div>
  </header>

  <nav class="contents" aria-label="Contents">
    <?php foreach ($wings as $n => $w): ?>
      <a href="#wing-<?= $n + 1 ?>"><?= ttg_h($w['key']) ?></a>
    <?php endforeach; ?>
  </nav>

  <?php foreach ($wings as $n => $w): ?>
  <?php $members = !empty(array_filter($w['windows'], fn($x) => isset($x[3]))); ?>
  <section class="wing<?= $members ? ' members' : '' ?>" id="wing-<?= $n + 1 ?>" aria-labelledby="wing-h-<?= $n + 1 ?>">
    <div class="wing-head">
      <p class="eyebrow" style="margin:0"><?= ttg_h($w['key']) ?></p>
      <h2 id="wing-h-<?= $n + 1 ?>"><?= ttg_h($w['head']) ?></h2>
      <p class="lede"><?= ttg_h($w['lede']) ?></p>
    </div>
    <ul class="windows">
      <?php foreach ($w['windows'] as $win): ?>
      <?php $locked = isset($win[3]) && !$user; ?>
      <li><a class="win" href="<?= ttg_h($locked ? '#join' : $win[0]) ?>"<?= $locked ? ' data-after="' . ttg_h($win[0]) . '"' : '' ?>>
        <span class="plate" aria-hidden="true"><?php if ($src = $plate($win[0])): ?><img src="<?= ttg_h($src) ?>" alt="" width="640" height="400" loading="lazy" decoding="async"><?php else: ?><i>№13</i><?php endif; ?></span>
        <?php if ($locked): ?><span class="lock">MEMBERS</span><?php endif; ?>
        <span class="path">TIMETRAVELLERSGUILD.COM<?= ttg_h(rtrim($win[0], '/')) ?></span>
        <span class="name"><?= ttg_h($win[1]) ?></span>
        <span class="line"><?= ttg_h($win[2]) ?></span>
      </a></li>
      <?php endforeach; ?>
    </ul>
  </section>
  <?php endforeach; ?>

  <?php if (!$user): ?>
  <section class="join" id="join" aria-labelledby="joinHead">
    <article class="slip form-slip">
      <p class="beat-label">JOIN · OR SIGN BACK IN</p>
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
        <p>Your email is never shown to other members. We only email you to sign in and, if you leave it switched on, when someone sends you a private message.</p>
        <p>Your name appears on the public register of travellers. You can hide it from <a href="/people/profile/">your slip</a> at any time. <a href="/privacy">Privacy</a>.</p>
      </div>
    </article>
  </section>
  <?php else: ?>
  <section class="join welcome" id="join" aria-labelledby="inHead">
    <article class="slip form-slip">
      <p class="beat-label">SIGNED IN</p>
      <h2 id="inHead">You’re a member of the Guild</h2>
      <p>Every window above is open to you. Change the name other travellers see, paint a stamp, or hide yourself from the register on your slip.</p>
      <a class="door" href="/people/profile/"><b>DOOR</b>YOUR SLIP</a>
    </article>
  </section>
  <?php endif; ?>
</div>

<nav id="dock" aria-label="NOW">
  <a href="/intro/" aria-current="page">INTRO</a>
  <a href="/field/">FIELD</a>
  <a href="/now">TREE</a>
  <a href="/jack">JACK</a>
  <?php if (!$user): ?><a href="/join/">JOIN</a><?php else: ?><a href="/people/chat/">CHAT</a><?php endif; ?>
  <?= ttg_html_navigator_dock($viewer) ?>
  <?= ttg_you_dock($viewer) ?>
</nav>
</body>
</html>
