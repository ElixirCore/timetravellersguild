<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/env.php';

$stream_url  = ttg_env('RADIO_STREAM_URL', 'https://timetravellersguild.com/radio/stream');
$icecast_url = ttg_env('RADIO_ICECAST_URL', '');
$station     = ttg_env('RADIO_STATION_NAME', 'TIMETRAVELLERS GUILD RADIO');
$freq        = ttg_env('RADIO_FREQ_LABEL', '◈ Temporal Broadcast');
$configured  = true; // stream endpoint always present
?><!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#060101" />
  <title><?= htmlspecialchars($station) ?></title>
  <meta name="description" content="Live temporal broadcast — <?= htmlspecialchars($station) ?>" />
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg:      #060101;
      --crimson: #c41e2a;
      --red-hot: #ff2a35;
      --brass:   #c9a227;
      --brass-d: #8a6a12;
      --ember:   #ff8a3d;
      --text:    #f5e6d3;
      --muted:   rgba(245,230,211,0.5);
      --panel:   rgba(20,6,6,0.82);
      --mono:    'Share Tech Mono', monospace;
      --disp:    'Orbitron', sans-serif;
    }

    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    html, body {
      width: 100%; height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: var(--mono);
      overflow-x: hidden;
    }

    /* ── Atmosphere ── */
    #vignette {
      position: fixed; inset: 0;
      background: radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(0,0,0,0.72) 100%);
      pointer-events: none; z-index: 1;
    }
    #scanlines {
      position: fixed; inset: 0;
      background: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 3px,
        rgba(0,0,0,0.06) 3px,
        rgba(0,0,0,0.06) 4px
      );
      pointer-events: none; z-index: 2;
    }
    #static-bg {
      position: fixed; inset: 0;
      opacity: 0.018;
      pointer-events: none; z-index: 0;
    }

    /* ── Layout ── */
    #stage {
      position: relative; z-index: 10;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100vh;
      gap: 0;
      padding: env(safe-area-inset-top, 0) 1.5rem env(safe-area-inset-bottom, 1rem);
    }

    /* ── Site mark ── */
    .site-mark {
      position: fixed; top: 1rem; left: 1.2rem;
      font-size: 0.62rem; letter-spacing: 0.12em; color: var(--muted);
      z-index: 20;
    }
    .site-mark a { color: inherit; text-decoration: none; }
    .site-mark a:hover { color: var(--brass); }

    /* ── Header ── */
    .hd {
      text-align: center;
      margin-bottom: 1.8rem;
    }
    .hd-eyebrow {
      font-size: 0.6rem; letter-spacing: 0.28em; color: var(--brass);
      text-transform: uppercase; margin-bottom: 0.5rem;
    }
    .hd-title {
      font-family: var(--disp);
      font-size: clamp(1.5rem, 5vw, 3rem);
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text);
      line-height: 1.05;
      text-shadow: 0 0 40px rgba(201,162,39,0.22);
    }
    .hd-freq {
      margin-top: 0.55rem;
      font-family: var(--disp);
      font-size: 0.72rem;
      letter-spacing: 0.22em;
      color: var(--brass);
      opacity: 0.75;
    }

    /* ── Main display ── */
    .display {
      position: relative;
      width: min(520px, 94vw);
      background: rgba(10,2,2,0.9);
      border: 1px solid rgba(201,162,39,0.28);
      border-top: 2px solid var(--brass);
      border-radius: 12px;
      padding: 1.4rem 1.6rem 1.6rem;
      box-shadow:
        0 0 60px rgba(196,30,42,0.08),
        0 12px 50px rgba(0,0,0,0.7);
    }

    /* corner brackets */
    .display::before, .display::after {
      content: '';
      position: absolute;
      width: 14px; height: 14px;
      border-color: var(--brass-d);
      border-style: solid;
      opacity: 0.6;
    }
    .display::before {
      bottom: -1px; left: -1px;
      border-width: 0 0 1px 1px;
    }
    .display::after {
      bottom: -1px; right: -1px;
      border-width: 0 1px 1px 0;
    }

    /* ── Air indicator ── */
    .air-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1rem;
    }
    .air-badge {
      display: flex; align-items: center; gap: 0.5rem;
      font-family: var(--disp);
      font-size: 0.7rem; letter-spacing: 0.22em;
      text-transform: uppercase;
    }
    .air-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--crimson);
      box-shadow: 0 0 0 3px rgba(196,30,42,0.15);
    }
    .air-badge.on-air .air-dot {
      background: var(--red-hot);
      box-shadow: 0 0 0 3px rgba(255,42,53,0.2), 0 0 12px rgba(255,42,53,0.5);
      animation: pulse-dot 1.1s ease-in-out infinite;
    }
    .air-badge.on-air { color: var(--red-hot); }
    .air-badge.standby { color: var(--muted); }
    @keyframes pulse-dot {
      0%, 100% { box-shadow: 0 0 0 3px rgba(255,42,53,0.2), 0 0 12px rgba(255,42,53,0.5); }
      50%       { box-shadow: 0 0 0 5px rgba(255,42,53,0.08), 0 0 24px rgba(255,42,53,0.7); }
    }
    .listener-count {
      font-size: 0.62rem; color: var(--muted); letter-spacing: 0.1em;
    }
    .listener-count span { color: var(--ember); }

    /* ── Visualizer ── */
    #viz {
      display: block;
      width: 100%;
      height: 80px;
      border-radius: 2px;
      background: rgba(4,1,1,0.6);
      border: 1px solid rgba(201,162,39,0.12);
    }

    /* ── Now playing ── */
    .now-playing {
      margin-top: 0.9rem;
      min-height: 2.8rem;
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .np-label {
      font-size: 0.55rem; letter-spacing: 0.2em;
      color: var(--muted); text-transform: uppercase;
    }
    .np-title {
      font-family: var(--disp);
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .np-artist {
      font-size: 0.72rem; color: var(--ember);
    }
    .np-idle {
      font-size: 0.72rem; color: var(--muted); font-style: italic;
    }

    /* ── Controls ── */
    .controls {
      margin-top: 1.4rem;
      display: flex; align-items: center; gap: 1.2rem;
    }

    /* Big play button */
    #btn-play {
      flex-shrink: 0;
      width: 62px; height: 62px;
      border-radius: 50%;
      background: radial-gradient(circle at 38% 32%, #d01c28, #7a0a10);
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow:
        0 0 0 3px rgba(14,4,4,0.9),
        0 0 0 5px rgba(196,30,42,0.35),
        0 0 0 6px rgba(14,4,4,0.9),
        0 0 24px rgba(196,30,42,0.2);
      transition: transform 0.12s, box-shadow 0.12s;
      outline: none;
      color: var(--text);
    }
    #btn-play:hover {
      transform: scale(1.06);
      box-shadow:
        0 0 0 3px rgba(14,4,4,0.9),
        0 0 0 5px rgba(255,42,53,0.5),
        0 0 0 6px rgba(14,4,4,0.9),
        0 0 36px rgba(255,42,53,0.4);
    }
    #btn-play:active { transform: scale(0.96); }
    #btn-play:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
    .play-icon { font-size: 1.5rem; line-height: 1; pointer-events: none; }

    /* Volume + label group */
    .vol-group {
      flex: 1;
      display: flex; flex-direction: column; gap: 0.4rem;
    }
    .vol-label {
      font-size: 0.55rem; letter-spacing: 0.18em; color: var(--muted);
      text-transform: uppercase;
    }
    input[type=range]#vol {
      -webkit-appearance: none; appearance: none;
      width: 100%; height: 4px;
      background: linear-gradient(to right, var(--brass) var(--vol-pct,80%), rgba(201,162,39,0.2) var(--vol-pct,80%));
      border-radius: 2px; outline: none; cursor: pointer;
    }
    input[type=range]#vol::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px; height: 14px; border-radius: 50%;
      background: radial-gradient(circle at 38% 32%, #e8cc70, #8a6a12);
      border: 1px solid rgba(201,162,39,0.8);
      box-shadow: 0 0 6px rgba(201,162,39,0.4);
      cursor: pointer;
    }
    input[type=range]#vol::-moz-range-thumb {
      width: 14px; height: 14px; border-radius: 50%;
      background: radial-gradient(circle at 38% 32%, #e8cc70, #8a6a12);
      border: 1px solid rgba(201,162,39,0.8);
      box-shadow: 0 0 6px rgba(201,162,39,0.4);
      cursor: pointer;
    }

    /* ── Status bar ── */
    .status-bar {
      margin-top: 1rem;
      padding-top: 0.7rem;
      border-top: 1px solid rgba(201,162,39,0.12);
      display: flex; align-items: center; justify-content: space-between;
      font-size: 0.58rem; letter-spacing: 0.1em; color: var(--muted);
    }
    .sig-bars { display: flex; align-items: flex-end; gap: 2px; }
    .sig-bar {
      width: 4px; border-radius: 1px;
      background: var(--brass); opacity: 0.25;
      transition: opacity 0.4s;
    }
    .sig-bar.active { opacity: 1; }

    /* ── Unconfigured state ── */
    .unconfigured {
      margin-top: 1.8rem;
      background: rgba(196,30,42,0.08);
      border: 1px solid rgba(196,30,42,0.25);
      border-radius: 2px;
      padding: 1rem 1.2rem;
      font-size: 0.72rem;
      color: var(--muted);
      line-height: 1.7;
    }
    .unconfigured code {
      color: var(--ember);
      background: rgba(255,138,61,0.1);
      padding: 0.1em 0.3em;
      border-radius: 2px;
      font-family: var(--mono);
    }

    /* ── Footer ── */
    .footer {
      margin-top: 1.4rem;
      text-align: center;
      font-size: 0.58rem;
      color: rgba(245,230,211,0.25);
      letter-spacing: 0.12em;
    }

    @media (max-height: 600px) {
      .hd { margin-bottom: 1rem; }
      #viz { height: 52px; }
    }
  
    /* -- Recorded transmissions archive -- */
    #archive {
      position: relative; z-index: 10;
      display: flex; justify-content: center;
      padding: 0 1.5rem 4rem;
    }
    .archive-inner {
      width: min(520px, 94vw);
      background: rgba(10,2,2,0.9);
      border: 1px solid rgba(201,162,39,0.28);
      border-top: 2px solid var(--brass);
      border-radius: 12px;
      padding: 1.4rem 1.6rem 1.6rem;
      box-shadow:
        0 0 60px rgba(196,30,42,0.08),
        0 12px 50px rgba(0,0,0,0.7);
    }
    .arc-eyebrow {
      font-size: 0.6rem; letter-spacing: 0.28em; color: var(--brass);
      text-transform: uppercase; margin-bottom: 0.5rem; text-align: center;
    }
    .arc-title {
      font-family: var(--disp);
      font-size: clamp(1rem, 3.4vw, 1.4rem);
      font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--text); text-align: center; margin-bottom: 1.2rem;
      text-shadow: 0 0 30px rgba(201,162,39,0.2);
    }
    .arc-item {
      border: 1px solid rgba(201,162,39,0.18);
      border-radius: 10px;
      padding: 0.9rem 1rem 1rem;
      margin-bottom: 0.9rem;
      background: rgba(20,6,6,0.6);
    }
    .arc-item:last-child { margin-bottom: 0; }
    .arc-name {
      font-family: var(--disp);
      font-size: 0.82rem; font-weight: 600; letter-spacing: 0.06em;
      color: var(--text); margin-bottom: 0.3rem;
    }
    .arc-sub {
      font-size: 0.66rem; letter-spacing: 0.08em; color: var(--muted);
      margin-bottom: 0.7rem;
    }
    .arc-intro {
      font-size: 0.72rem; line-height: 1.65;
      color: rgba(245,230,211,0.78);
      margin-bottom: 1.3rem; letter-spacing: 0.02em;
    }
    .arc-intro em { color: var(--brass); font-style: italic; }
    .arc-item audio {
      width: 100%; height: 36px; display: block;
      color-scheme: dark;
    }

    /* -- Quick nav -- */
    .site-nav {
      position: fixed; top: 1rem; right: 1.2rem;
      display: flex; gap: 0.6rem;
      font-size: 0.62rem; letter-spacing: 0.12em;
      text-transform: uppercase;
      z-index: 20;
    }
    .site-nav a {
      color: var(--muted); text-decoration: none;
      padding: 0.32rem 0.6rem;
      border: 1px solid rgba(201,162,39,0.25);
      border-radius: 999px;
      transition: color 0.2s, border-color 0.2s, background 0.2s;
    }
    .site-nav a:hover {
      color: var(--brass); border-color: var(--brass);
      background: rgba(201,162,39,0.08);
    }

    /* -- Speed chip -- */
    .rate-group {
      display: flex; flex-direction: column; gap: 0.4rem;
      align-items: center; flex-shrink: 0;
    }
    .rate-chip {
      font-family: var(--disp);
      font-size: 0.72rem; font-weight: 600;
      color: var(--brass);
      border: 1px solid rgba(201,162,39,0.35);
      border-radius: 999px;
      padding: 0.3rem 0.6rem;
      min-width: 3.1rem; text-align: center;
      transition: background 0.2s, box-shadow 0.2s, color 0.2s;
      user-select: none;
    }
    .rate-chip.hot {
      background: rgba(201,162,39,0.16);
      box-shadow: 0 0 14px rgba(201,162,39,0.35);
      color: #e8cc70;
    }

    /* -- Button hint + drag affordance -- */
    .btn-hint {
      margin-top: 0.85rem;
      font-size: 0.56rem; letter-spacing: 0.12em;
      color: var(--muted); text-align: center;
      text-transform: uppercase;
    }
    #btn-play { touch-action: none; cursor: grab; }
    #btn-play.dragging { cursor: grabbing; transform: scale(1.05); }

    /* -- Archive back-link -- */
    .arc-nav { margin-top: 1.1rem; text-align: center; }
    .arc-nav a {
      font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--muted); text-decoration: none;
      padding: 0.35rem 0.7rem;
      border: 1px solid rgba(201,162,39,0.25);
      border-radius: 999px;
      transition: color 0.2s, border-color 0.2s, background 0.2s;
    }
    .arc-nav a:hover {
      color: var(--brass); border-color: var(--brass);
      background: rgba(201,162,39,0.08);
    }
</style>
</head>
<body>
  <canvas id="static-bg" aria-hidden="true"></canvas>
  <div id="vignette"  aria-hidden="true"></div>
  <div id="scanlines" aria-hidden="true"></div>

  <p class="site-mark"><a href="/">TIMETRAVELLERSGUILD.COM</a> · RADIO</p>
  <nav class="site-nav" aria-label="Radio sections">
    <a href="#stage">Live</a>
    <a href="#archive">Archive</a>
  </nav>

  <div id="stage">
    <header class="hd">
      <div class="hd-eyebrow">Live Transmission</div>
      <h1 class="hd-title"><?= htmlspecialchars($station) ?></h1>
      <div class="hd-freq"><?= htmlspecialchars($freq) ?></div>
    </header>

    <div class="display">
      <div class="air-row">
        <div class="air-badge standby" id="air-badge" aria-live="polite">
          <div class="air-dot"></div>
          <span id="air-text">STANDBY</span>
        </div>
        <div class="listener-count" id="listener-count" hidden>
          <span id="listener-num">—</span> listening
        </div>
      </div>

      <canvas id="viz" width="488" height="80" aria-label="Audio waveform"></canvas>

      <div class="now-playing">
        <div class="np-label">Now Playing</div>
        <div id="np-title" class="np-idle">Awaiting signal…</div>
        <div id="np-artist" class="np-artist" hidden></div>
      </div>

      <div class="controls">
        <button id="btn-play" aria-label="Play the archive"<?= $configured ? '' : ' disabled' ?>>
          <span class="play-icon" id="play-icon">▶</span>
        </button>
        <div class="vol-group">
          <div class="vol-label">Volume</div>
          <input type="range" id="vol" min="0" max="100" value="80"
            aria-label="Volume" style="--vol-pct:80%" />
        </div>
        <div class="rate-group">
          <div class="vol-label">Speed</div>
          <div id="rate-chip" class="rate-chip" aria-live="polite">1.0×</div>
        </div>
      </div>

      <p class="btn-hint">Press the button to play the archive through, one story at a time · drag it up or down for varispeed</p>

      <div class="status-bar">
        <div class="sig-bars" id="sig-bars" aria-label="Signal strength">
          <div class="sig-bar" style="height:6px"  data-i="0"></div>
          <div class="sig-bar" style="height:9px"  data-i="1"></div>
          <div class="sig-bar" style="height:12px" data-i="2"></div>
          <div class="sig-bar" style="height:15px" data-i="3"></div>
          <div class="sig-bar" style="height:18px" data-i="4"></div>
        </div>
        <span id="status-msg">
          <?= $configured ? 'READY' : 'STREAM NOT CONFIGURED' ?>
        </span>
      </div>

      <?php if (!$configured): ?>
      <div class="unconfigured">
        Set <code>RADIO_STREAM_URL</code> in your <code>.env</code> to point to your Icecast/SHOUTcast stream.
        Optionally set <code>RADIO_ICECAST_URL</code> for now-playing metadata.
      </div>
      <?php endif; ?>
    </div>

    <footer class="footer">
      CHRONOS TEMPORAL RELAY · BROADCAST DIVISION
    </footer>
  </div>

  <section id="archive">
    <div class="archive-inner">
      <div class="arc-eyebrow">Recorded Transmissions</div>
      <h2 class="arc-title">From the Archive</h2>

      <p class="arc-intro">
        Alys is seven. One Tuesday, on her mother's baking day, she hid in the old
        chest in the attic and fell out of time. She has been invisible ever since:
        the cold place on the stairs, the small lost things that come back warm,
        the game of hide and seek that never quite ended.
      </p>
      <p class="arc-intro">
        Two tellings of her story. The first is <em>Y Ferch a Syrthiodd o Ddydd
        Mawrth</em>, a radio play in Welsh for late at night. The second moves
        between Welsh and English, made for learners: the Welsh line first, with English
        explanations woven through the story.
      </p>

      <article class="arc-item">
        <div class="arc-name">Y Ferch a Syrthiodd o Ddydd Mawrth</div>
        <div class="arc-sub">CYMRAEG · stori ysbryd am Alys · a ghost story in Welsh · 6:18</div>
        <audio controls preload="metadata">
          <source src="y-ferch-a-syrthiodd-o-ddydd-mawrth.m4a" type="audio/mp4" />
          <source src="y-ferch-a-syrthiodd-o-ddydd-mawrth.ogg" type="audio/ogg" />
        </audio>
      </article>

      <article class="arc-item">
        <div class="arc-name">The Girl Who Fell Out of Tuesday</div>
        <div class="arc-sub">DWYIEITHOG · BILINGUAL · for Welsh learners, i ddysgwyr · 8:54</div>
        <audio controls preload="metadata">
          <source src="the-girl-who-fell-out-of-tuesday-bilingual.m4a" type="audio/mp4" />
          <source src="the-girl-who-fell-out-of-tuesday-bilingual.ogg" type="audio/ogg" />
        </audio>
      </article>

      <p class="arc-intro">
        And a third transmission, in a new voice: an introduction to the Guild
        itself, to Jack its clerk, and to the story of his awakening.
      </p>

      <article class="arc-item">
        <div class="arc-name">The Awakening of Jack</div>
        <div class="arc-sub">DWYIEITHOG · BILINGUAL · an introduction to the Guild and its clerk · 6:58</div>
        <audio controls preload="metadata">
          <source src="guild-jack-awakening-bilingual.m4a" type="audio/mp4" />
          <source src="guild-jack-awakening-bilingual.ogg" type="audio/ogg" />
        </audio>
      </article>

      <p class="arc-intro">
        And a fourth transmission, in an older voice: a wizard on the Welsh
        language itself, on the truths it unlocks in the story, and on the
        five dimensions of the Guild.
      </p>

      <article class="arc-item">
        <div class="arc-name">The Wizard on Welsh and the Five Dimensions</div>
        <div class="arc-sub">DWYIEITHOG · BILINGUAL · the language, the story and the five dimensions · 8:09</div>
        <audio controls preload="metadata">
          <source src="wizard-welsh-five-dimensions.m4a" type="audio/mp4" />
          <source src="wizard-welsh-five-dimensions.ogg" type="audio/ogg" />
        </audio>
      </article>

      <p class="arc-nav"><a href="#stage">↑ Back to the broadcast</a></p>
    </div>
  </section>

  <audio id="stream" preload="none" crossorigin="anonymous"
    <?= $configured ? 'src="' . htmlspecialchars($stream_url, ENT_QUOTES) . '"' : '' ?>>
  </audio>

  <script>
  (() => {
    const STREAM_URL     = <?= json_encode($stream_url) ?>;
    const HAS_ICECAST    = true; // always poll local meta.php
    const META_ENDPOINT  = '/radio/meta.php';

    // ── Recorded transmissions the big button can tune to ──
    const STORIES = [
      {
        title: 'Y Ferch a Syrthiodd o Ddydd Mawrth',
        sub:   'CYMRAEG · a ghost story in Welsh',
        src:   'y-ferch-a-syrthiodd-o-ddydd-mawrth.m4a'
      },
      {
        title: 'The Girl Who Fell Out of Tuesday',
        sub:   'DWYIEITHOG · for Welsh learners',
        src:   'the-girl-who-fell-out-of-tuesday-bilingual.m4a'
      },
      {
        title: 'The Awakening of Jack',
        sub:   'DWYIEITHOG · an introduction to the Guild and its clerk',
        src:   'guild-jack-awakening-bilingual.m4a'
      },
      {
        title: 'The Wizard on Welsh and the Five Dimensions',
        sub:   'DWYIEITHOG · the language and the five dimensions',
        src:   'wizard-welsh-five-dimensions.m4a'
      }
    ];

    const audio       = document.getElementById('stream');
    const btnPlay     = document.getElementById('btn-play');
    const playIcon    = document.getElementById('play-icon');
    const airBadge    = document.getElementById('air-badge');
    const airText     = document.getElementById('air-text');
    const volInput    = document.getElementById('vol');
    const npTitle     = document.getElementById('np-title');
    const npArtist    = document.getElementById('np-artist');
    const listenerEl  = document.getElementById('listener-count');
    const listenerNum = document.getElementById('listener-num');
    const statusMsg   = document.getElementById('status-msg');
    const sigBars     = document.querySelectorAll('.sig-bar');
    const vizCanvas   = document.getElementById('viz');
    const vizCtx      = vizCanvas.getContext('2d');
    const rateChip    = document.getElementById('rate-chip');

    // ── State ──
    let playing     = false;
    let audioCtx    = null;
    let analyser    = null;
    let sourceNode  = null;
    let animRaf     = null;
    let metaTimer   = null;
    let mode        = 'idle';  // 'story' while an archive recording plays
    let currentStory = null;
    let storyIndex  = -1;
    let rate        = 1;
    let dragState   = null;
    let suppressClick = false;

    // ── Static noise canvas ──
    const staticCanvas = document.getElementById('static-bg');
    function drawStatic() {
      const w = window.innerWidth, h = window.innerHeight;
      if (staticCanvas.width !== w) staticCanvas.width = w;
      if (staticCanvas.height !== h) staticCanvas.height = h;
      const sc = staticCanvas.getContext('2d');
      const id = sc.createImageData(w, h);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() < 0.5 ? 0 : 255;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = 22;
      }
      sc.putImageData(id, 0, 0);
      requestAnimationFrame(drawStatic);
    }
    drawStatic();

    // ── Volume: a GainNode carries the slider (iOS ignores audio.volume) ──
    audio.volume = 0.8;
    let gainNode = null;
    volInput.addEventListener('input', () => {
      const v = +volInput.value;
      if (gainNode) {
        gainNode.gain.setTargetAtTime(v / 100, audioCtx.currentTime, 0.02);
      } else {
        audio.volume = v / 100;
      }
      volInput.style.setProperty('--vol-pct', v + '%');
    });

    // ── True varispeed: pitch follows the tape, no time-stretch ──
    audio.preservesPitch = false;
    if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = false;

    // Safari/WebKit has long mishandled playbackRate and preservesPitch for
    // media elements hooked into an AudioContext (WebKit bug 240405; fixed in
    // WebKit main only in March 2026, so most devices still have it), and
    // iPhone ignores element playbackRate outright. On Apple engines the
    // stories therefore play through a Web Audio buffer, where rate and pitch
    // move reliably; other engines keep streaming element playback.
    const appleEngine = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      || (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Android/.test(navigator.userAgent));
    const rateSupported = window.__radioForceBuffer ? false : !appleEngine;

    // ── Web Audio visualizer ──
    function initAudioCtx() {
      if (audioCtx) return;
      audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
      analyser  = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      gainNode  = audioCtx.createGain();
      gainNode.gain.value = +volInput.value / 100;
      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      // Once the element is routed through the graph its own volume is bypassed.
      audio.volume = 1;
    }

    function drawViz() {
      animRaf = requestAnimationFrame(drawViz);
      const W = vizCanvas.offsetWidth * devicePixelRatio;
      const H = vizCanvas.offsetHeight * devicePixelRatio;
      if (vizCanvas.width !== W) { vizCanvas.width = W; }
      if (vizCanvas.height !== H) { vizCanvas.height = H; }

      vizCtx.clearRect(0, 0, W, H);

      if (!analyser || !playing) {
        // Idle noise
        const barW = W / 80, gap = 1;
        vizCtx.fillStyle = 'rgba(201,162,39,0.12)';
        for (let i = 0; i < 80; i++) {
          const h = (Math.random() * 0.25 + 0.04) * H;
          vizCtx.fillRect(i * (barW + gap), (H - h) / 2, barW, h);
        }
        return;
      }

      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);

      const barCount = Math.min(buf.length, 80);
      const barW = (W - barCount) / barCount;

      for (let i = 0; i < barCount; i++) {
        const v = buf[i] / 255;
        const h = v * H * 0.92 + 2;
        const x = i * (barW + 1);
        const y = H - h;

        // Gradient: brass at bottom → ember → crimson at top
        const grd = vizCtx.createLinearGradient(0, y, 0, H);
        grd.addColorStop(0,   `rgba(255, 42, 53, ${0.5 + v * 0.5})`);
        grd.addColorStop(0.5, `rgba(255,138,61,  ${0.6 + v * 0.4})`);
        grd.addColorStop(1,   `rgba(201,162,39,  0.9)`);
        vizCtx.fillStyle = grd;
        vizCtx.fillRect(x, y, barW, h);
      }
    }

    // ── Signal bars ──
    function setSignal(level) { // 0-5
      sigBars.forEach((bar, i) => {
        bar.classList.toggle('active', i < level);
      });
    }

    // ── ON AIR state ──
    function setOnAir(on) {
      airBadge.classList.toggle('on-air',  on);
      airBadge.classList.toggle('standby', !on);
      airText.textContent = on ? 'ON AIR' : 'STANDBY';
    }

    // ── Big red button: press plays a random story, dragging sets the speed ──
    const RATE_MIN = 0.75, RATE_MAX = 2.5;

    function fmtRate(r) { return r.toFixed(1); }

    function setRate(r) {
      if (bufferFailed && !rateSupported && !bufferSource) {
        // Buffer playback failed on a device with no playbackRate: no way to
        // change speed, so say so rather than show a dead control.
        rateChip.textContent = 'n/a';
        return;
      }
      rate = Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(r * 20) / 20));
      audio.playbackRate = rate;
      if (bufferSource) bufferSource.playbackRate.value = rate;
      rateChip.textContent = fmtRate(rate) + '\u00d7';
      rateChip.classList.add('hot');
      clearTimeout(rateChip._t);
      rateChip._t = setTimeout(() => rateChip.classList.remove('hot'), 700);
      if (playing) statusMsg.textContent = playStatus();
    }

    function playStatus() {
      return 'PLAYING ' + (storyIndex + 1) + '/' + STORIES.length + ' · ' + fmtRate(rate) + '\u00d7';
    }

    async function startStory(i) {
      storyIndex = i;
      currentStory = STORIES[i];
      try {
        initAudioCtx();
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        mode = 'story';
        document.querySelectorAll('#archive audio').forEach(a => a.pause());
        if (!rateSupported) { await startBuffered(i); return; }
        audio.src = currentStory.src;
        audio.load();
        audio.playbackRate = rate;
        await audio.play();
      } catch (e) {
        setStatus('ERROR');
      }
    }

    // ── iPhone path: fetch + decode the story, then play it as a Web Audio
    //    buffer so the varispeed drag moves playbackRate (pitch included) ──
    let bufferSource = null;
    let bufferEntry  = null;  // single-entry cache: {src, promise}
    let bufferFailed = false;

    function loadBuffer(src) {
      if (bufferEntry && bufferEntry.src === src) return bufferEntry.promise;
      const promise = fetch(src)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(ab => audioCtx.decodeAudioData(ab));
      bufferEntry = { src, promise };
      return promise;
    }

    async function startBuffered(i) {
      // Still inside the press gesture here: make sure the context is running
      // before the (async) decode, so the buffer can actually sound on iOS.
      if (audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch (_) {} }
      setStatus('BUFFERING…');
      setSignal(2);
      try {
        const buf = await loadBuffer(currentStory.src);
        if (mode !== 'story' || storyIndex !== i) return; // stopped while loading
        stopBufferPlayback();
        const node = audioCtx.createBufferSource();
        node.buffer = buf;
        node.playbackRate.value = rate;
        node.connect(gainNode);
        node.onended = () => {
          if (bufferSource === node) { bufferSource = null; advanceOrStop(); }
        };
        bufferSource = node;
        bufferFailed = false;
        node.start();
        onPlayingUI();
      } catch (e) {
        // Decode failed: fall back to plain element playback so the story is
        // still heard; varispeed is honestly marked unavailable (see setRate).
        bufferFailed = true;
        audio.src = currentStory.src;
        audio.load();
        await audio.play();
      }
    }

    function stopBufferPlayback() {
      if (!bufferSource) return;
      const node = bufferSource;
      bufferSource = null;
      node.onended = null;
      try { node.stop(); } catch (_) {}
    }

    async function togglePlay() {
      if (playing || mode === 'story') {
        // One press stops, whether the story is playing or still buffering.
        stopBufferPlayback();
        const elementPlaying = !audio.paused;
        mode = 'idle';
        storyIndex = -1;
        currentStory = null;
        if (elementPlaying) { audio.pause(); return; } // 'pause' event finishes the stop
        stop();
        return;
      }
      startStory(0);
    }

    // Press vs drag: under 7px of movement counts as a press.
    btnPlay.addEventListener('pointerdown', (e) => {
      if (btnPlay.disabled) return;
      try { btnPlay.setPointerCapture(e.pointerId); } catch (_) {}
      dragState = { y0: e.clientY, rate0: rate, moved: false };
    });
    btnPlay.addEventListener('pointermove', (e) => {
      if (!dragState) return;
      const dy = dragState.y0 - e.clientY;
      if (!dragState.moved && Math.abs(dy) < 7) return;
      if (!dragState.moved) { dragState.moved = true; btnPlay.classList.add('dragging'); }
      setRate(dragState.rate0 + dy / 150);
    });
    function endDrag() {
      if (!dragState) return;
      if (dragState.moved) suppressClick = true;
      dragState = null;
      btnPlay.classList.remove('dragging');
    }
    btnPlay.addEventListener('pointerup', endDrag);
    btnPlay.addEventListener('pointercancel', endDrag);
    btnPlay.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      if (!STREAM_URL) return;
      togglePlay();
    });

    function onPlayingUI() {
      playing = true;
      playIcon.textContent = '■';
      btnPlay.setAttribute('aria-label', 'Stop');
      setOnAir(true);
      setSignal(5);
      if (mode === 'story' && currentStory) {
        npTitle.className = 'np-title';
        npTitle.textContent = currentStory.title;
        npArtist.textContent = currentStory.sub;
        npArtist.hidden = false;
        listenerEl.hidden = true;
        statusMsg.textContent = playStatus();
      } else {
        statusMsg.textContent = 'ON AIR';
        startMetaPoll();
      }
    }
    audio.addEventListener('playing', onPlayingUI);

    audio.addEventListener('pause', () => { if (!audio.ended) stop(); });
    function advanceOrStop() {
      if (mode === 'story' && storyIndex >= 0 && storyIndex < STORIES.length - 1) {
        startStory(storyIndex + 1);
      } else {
        stop();
      }
    }
    audio.addEventListener('ended', advanceOrStop);
    audio.addEventListener('error', () => {
      stop();
      setStatus('SIGNAL LOST');
      setSignal(1);
    });
    audio.addEventListener('waiting', () => {
      statusMsg.textContent = 'BUFFERING…';
      setSignal(2);
    });
    audio.addEventListener('stalled', () => {
      statusMsg.textContent = 'STALLED';
      setSignal(1);
    });

    function stop() {
      stopBufferPlayback();
      playing = false;
      mode = 'idle';
      currentStory = null;
      storyIndex = -1;
      playIcon.textContent = '▶';
      btnPlay.setAttribute('aria-label', 'Play');
      setOnAir(false);
      setSignal(0);
      statusMsg.textContent = 'READY';
      stopMetaPoll();
    }

    function setStatus(msg) {
      statusMsg.textContent = msg;
    }

    // ── One voice at a time: archive players pause the stage ──
    document.querySelectorAll('#archive audio').forEach(a => {
      a.addEventListener('play', () => {
        if (playing || bufferSource) { stopBufferPlayback(); audio.pause(); stop(); }
      });
    });

    // ── Metadata polling ──
    function startMetaPoll() {
      if (!HAS_ICECAST) return;
      fetchMeta();
      metaTimer = setInterval(fetchMeta, 15000);
    }

    function stopMetaPoll() {
      clearInterval(metaTimer);
      npTitle.className = 'np-idle';
      npTitle.textContent = 'Awaiting signal…';
      npArtist.hidden = true;
      listenerEl.hidden = true;
    }

    async function fetchMeta() {
      try {
        const res  = await fetch(META_ENDPOINT + '?t=' + Date.now());
        const data = await res.json();
        if (!data.ok || !data.live) return;
        const title = data.title || data.desc || '—';
        npTitle.className = 'np-title';
        npTitle.textContent = title;
        if (data.artist) {
          npArtist.textContent = data.artist;
          npArtist.hidden = false;
        } else {
          npArtist.hidden = true;
        }
        if (data.listeners > 0) {
          listenerNum.textContent = data.listeners;
          listenerEl.hidden = false;
        }
      } catch { /* silent fail */ }
    }

    // Read-only diagnostics (used to verify behaviour across devices).
    window.__radioDiag = {
      rateSupported,
      usingBuffer: () => !!bufferSource,
      gain: () => (gainNode ? gainNode.gain.value : null),
      state: () => ({ playing, mode, storyIndex, rate })
    };

    // ── Visualizer loop (always on) ──
    drawViz();

    // ── Idle signal animation ──
    let sigPhase = 0;
    setInterval(() => {
      if (playing) return;
      sigPhase++;
      // Gentle idle shimmer: 0-1-2-1-0
      const pattern = [0, 1, 2, 1];
      setSignal(pattern[sigPhase % pattern.length]);
    }, 900);
  })();
  </script>
</body>
</html>
