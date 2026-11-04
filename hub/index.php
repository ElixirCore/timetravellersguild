<?php
declare(strict_types=1);
require_once __DIR__ . '/inc/functions.php';

$codex = ttg_codex();
$faces = $codex['faces'] ?? [];
$avenues = $codex['avenues'] ?? [];
$stations = ttg_stations();
$local = new DateTimeImmutable('now');

$pageTitle = 'HUB — The Time Travellers Guild';
$canonical = 'https://timetravellersguild.com/hub/';
$hubDesc = 'Modes, disciplines, avenues, properties and trajectory of the Time Travellers Guild. Station XIII console — disc, cog, readout.';
require __DIR__ . '/inc/header.php';
?>
<a class="skip" href="#codex">Skip to the codex</a>
<div id="grain" aria-hidden="true"></div>
<div id="vignette" aria-hidden="true"></div>

<header id="mast">
  <div class="site"><a href="/">TIMETRAVELLERSGUILD.COM</a></div>
  <div class="presents">
    <span>LOCAL PRESENT: <time><?= ttg_h($local->format('d.m.Y')) ?></time></span>
    <span>NETWORK PRESENT: 17.04.2033</span>
    <span class="hub-badge">HUB · STATION XIII</span>
  </div>
</header>

<main id="hub">
  <section class="hero" aria-label="Console">
    <div class="hero-copy">
      <p class="kicker">PUBLIC CONSOLE</p>
      <h1>HUB</h1>
      <p class="lede">The Guild’s face at Station XIII — a disc left on the clerk’s desk. Turn the cog for trajectory, modes, disciplines, avenues and properties. Enter an avenue when the readout is enough.</p>
      <p class="signal">Not punch stock. A games console that learned the field.</p>
    </div>

    <div class="console" id="console">
      <div class="disc-wrap">
        <div class="disc" id="disc" aria-hidden="true">
          <div class="disc-ring outer"></div>
          <div class="disc-ring mid"></div>
          <div class="disc-ring inner"></div>
          <div class="disc-hub">
            <span class="dh-mark">TTG</span>
            <span class="dh-sub">XIII</span>
          </div>
          <div class="cog-teeth" id="teeth"></div>
        </div>
        <div class="led-row" aria-hidden="true">
          <i class="led on scarlet"></i><i class="led on gold"></i><i class="led on navy"></i><i class="led"></i>
        </div>
      </div>

      <nav class="face-nav" id="faceNav" aria-label="Codex faces" role="tablist">
        <?php foreach ($faces as $i => $face): ?>
          <button type="button"
            role="tab"
            id="tab-<?= ttg_h((string) $face['id']) ?>"
            aria-controls="panel-<?= ttg_h((string) $face['id']) ?>"
            aria-selected="<?= $i === 0 ? 'true' : 'false' ?>"
            data-face="<?= ttg_h((string) $face['id']) ?>"
            data-index="<?= (int) $i ?>">
            <span class="tooth"><?= ttg_h((string) ($face['tooth'] ?? sprintf('%02d', $i + 1))) ?></span>
            <span class="name"><?= ttg_h((string) $face['title']) ?></span>
          </button>
        <?php endforeach; ?>
      </nav>
    </div>
  </section>

  <section id="codex" class="codex" aria-live="polite">
    <?php foreach ($faces as $i => $face): ?>
      <article
        class="face<?= $i === 0 ? ' is-active' : '' ?>"
        id="panel-<?= ttg_h((string) $face['id']) ?>"
        role="tabpanel"
        aria-labelledby="tab-<?= ttg_h((string) $face['id']) ?>"
        data-face="<?= ttg_h((string) $face['id']) ?>"
        <?= $i === 0 ? '' : 'hidden' ?>>
        <header class="face-head">
          <p class="tooth-line">DISC <?= ttg_h((string) ($face['tooth'] ?? '')) ?> · <?= ttg_h(strtoupper((string) $face['id'])) ?></p>
          <h2><?= ttg_h((string) $face['title']) ?></h2>
          <p class="epithet"><?= ttg_h((string) ($face['epithet'] ?? '')) ?></p>
          <p class="lede"><?= ttg_h((string) ($face['lede'] ?? '')) ?></p>
        </header>
        <div class="face-body">
          <?php foreach (($face['sections'] ?? []) as $sec): ?>
            <section class="slot">
              <h3><?= ttg_h((string) ($sec['h'] ?? '')) ?></h3>
              <p><?= ttg_h((string) ($sec['p'] ?? '')) ?></p>
            </section>
          <?php endforeach; ?>
        </div>
      </article>
    <?php endforeach; ?>
  </section>

  <section class="avenues" aria-label="Avenues">
    <header class="block-head">
      <p class="kicker">MEMORY CARDS</p>
      <h2>Avenues</h2>
      <p>Live doors into the same field. Slot in.</p>
    </header>
    <ul class="card-grid">
      <?php foreach ($avenues as $av): ?>
        <li>
          <a class="mem-card led-<?= ttg_h((string) ($av['led'] ?? 'navy')) ?>" href="<?= ttg_h((string) ($av['href'] ?? '#')) ?>">
            <span class="led" aria-hidden="true"></span>
            <span class="lab"><?= ttg_h((string) ($av['label'] ?? '')) ?></span>
            <span class="sub"><?= ttg_h((string) ($av['sub'] ?? '')) ?></span>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </section>

  <section class="stations" aria-label="Station ring">
    <header class="block-head">
      <p class="kicker">SECOND DISC</p>
      <h2>Station ring</h2>
      <p>The older map still turns — archive rooms and live reception on one ring.</p>
    </header>
    <ul class="station-ring" id="stationRing">
      <?php foreach ($stations as $st): ?>
        <li>
          <a href="<?= ttg_h((string) ($st['href'] ?? ('/hub/station/' . ($st['slug'] ?? '') . '/'))) ?>">
            <span class="sk"><?= ttg_h((string) ($st['kicker'] ?? '')) ?></span>
            <span class="st"><?= ttg_h((string) ($st['title'] ?? '')) ?></span>
            <span class="ss"><?= ttg_h((string) ($st['signal'] ?? '')) ?></span>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </section>
</main>

<nav id="dock" aria-label="Guild">
  <a href="/now">TREE</a>
  <a href="/hub/" aria-current="page">HUB</a>
  <a href="/join/">JOIN</a>
  <a href="/jack">JACK</a>
  <a href="/signals/">SIGNALS</a>
</nav>

<?php require __DIR__ . '/inc/footer.php'; ?>
