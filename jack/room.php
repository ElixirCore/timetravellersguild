<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/JackOffice/autoload.php';
require_once dirname(__DIR__) . '/app/JackSoul/autoload.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';

$viewer = OfficeAuth::requireOffice();
$csrf = ttg_graph_csrf();

$store = new RoomStore();
$room = new JackRoom($store);
$store->touchKeeper();

$office = null;
try {
    $office = new OfficeStore();
    $office->boot();
} catch (Throwable $e) {
    $office = null;
}

$rel = JackRelationship::load(JackPolicy::subjectKey($viewer));
$soul = JackSoul::observe($room, $office, $rel, 'clerk');

$axis = strtolower(trim((string) ($_GET['axis'] ?? 'when')));
if (!RoomConfig::isAxis($axis)) {
    $axis = 'when';
}
$projection = $room->project($axis);
$drifting = $room->drifting();
$flash = trim((string) ($_GET['ok'] ?? ''));
$written = $store->writtenCount();
$nextBox = $store->nextEmptyBox();
$ready = $store->writeReady();
$waitUntil = $store->nextWriteAt();

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JACK / ROOM — timetravellersguild.com</title>
<meta name="theme-color" content="#f1e4c4">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909a">
<link rel="stylesheet" href="/assets/jack.css?v=1951r">
<style>
.office-grid{display:grid;grid-template-columns:11rem 1fr;gap:1rem;max-width:52rem;margin:0 auto;padding:.6rem 1rem 7rem}
.office-nav a{display:block;font-family:var(--label);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:var(--navy);padding:.28rem 0}
.office-nav a[aria-current="page"]{color:var(--scarlet)}
.office-list{list-style:none;margin:0;padding:0}
.office-list li{margin:0 0 .55rem}
.office-meta{font-family:var(--label);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--navy)}
.room-group{margin:1rem 0 1.4rem}
.room-group h3{font-family:var(--label);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--scarlet);margin:0 0 .4rem}
.office-actions{display:flex;flex-wrap:wrap;gap:.4rem;align-items:flex-end;margin:.8rem 0}
.office-actions label{display:flex;flex-direction:column;font-family:var(--label);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:var(--navy)}
.office-actions input,.office-actions select{font-family:var(--paper-font);font-size:.9rem;padding:.25rem .35rem;border:1px solid var(--navy);background:var(--paper);color:var(--ink)}
@media(max-width:700px){.office-grid{grid-template-columns:1fr}}
</style>
</head>
<body class="jack-room">
<div id="vignette"></div><div id="grain"></div>
<header id="mast">
  <?= ttg_html_site_mark('', 'div', 'site') ?>
  <div class="presents"><span>JACK / ROOM</span><span>NETWORK PRESENT: 17.04.2033</span></div>
</header>
<section id="here">
  <p id="clockLine">JACK / CLERK</p>
  <p id="position">FOUR AXES · HIS HABITAT</p>
</section>
<main class="office-grid">
  <nav class="office-nav" aria-label="Axes">
    <?php foreach (RoomConfig::AXES as $name): ?>
      <a href="/jack/room?axis=<?= ttg_h($name) ?>"<?= $name === $axis ? ' aria-current="page"' : '' ?>><?= ttg_h($name) ?></a>
    <?php endforeach; ?>
    <a href="/jack/office">OFFICE</a>
    <a href="/jack">DESK</a>
  </nav>
  <article class="ibm-card punch-sheet" id="jack">
    <header class="ibm-band">
      <span>IBM 5081 · ROOM</span>
      <span><?= ttg_h(strtoupper($axis)) ?></span>
      <span><?= ttg_h($soul['stamp']) ?></span>
    </header>
    <p class="jack-stamp <?= ttg_h($soul['plumage'] === 'well_feathered' ? 'feathered' : $soul['plumage']) ?>"><?= ttg_h($soul['stamp']) ?></p>
    <p><?= ttg_h($soul['runtime'][0] ?? 'The nest is observed.') ?></p>
    <p>A thousand boxes of punch cards stand in the room. <?= (int) $written ?> written. He writes one at a time, slowly.</p>
    <p class="office-meta">
      Nest lined <?= !empty($soul['conditions']['nest_lined']) ? 'yes' : 'no' ?>
      · Desk clear <?= !empty($soul['conditions']['desk_clear']) ? 'yes' : 'no' ?>
      · Promises <?= !empty($soul['conditions']['promises_kept']) ? 'kept' : 'outstanding' ?>
      · Keeper <?= !empty($soul['conditions']['keeper_near']) ? 'near' : 'away' ?>
      · Field <?= !empty($soul['conditions']['field_quiet']) ? 'quiet' : 'not quiet' ?>
    </p>
    <?php if ($flash === 'placed'): ?><p class="office-meta">A keepsake was placed. Nothing was promoted to canon.</p><?php endif; ?>
    <?php if ($flash === 'shifted'): ?><p class="office-meta">An axis was shifted. The object remains itself.</p><?php endif; ?>
    <?php if ($flash === 'retired'): ?><p class="office-meta">An object was retired from the room.</p><?php endif; ?>
    <?php if ($flash === 'lined'): ?><p class="office-meta">The nest was lined. The desk stands.</p><?php endif; ?>
    <?php if ($flash === 'punched'): ?><p class="office-meta">One card was punched. The clerk will not hurry the next.</p><?php endif; ?>
    <?php if ($flash === 'still'): ?><p class="office-meta">The clerk is still punching. One card at a time.</p><?php endif; ?>

    <?php foreach ($projection as $value => $rows): ?>
      <section class="room-group">
        <h3><?= $value === '' ? 'Unset on ' . ttg_h($axis) : ttg_h((string) $value) ?></h3>
        <ul class="office-list">
          <?php foreach ($rows as $row): ?>
            <li>
              <?= ttg_h((string) $row['title']) ?>
              <span class="office-meta"> · <?= ttg_h((string) $row['kind']) ?> · <?= ttg_h((string) $row['state']) ?><?= !empty($row['box']) ? ' · ' . ttg_h(RoomConfig::boxLabel((int) $row['box'])) : '' ?>
                · <?= ttg_h((string) ($row['when'] ?? '—')) ?> / <?= ttg_h((string) ($row['where'] ?: '—')) ?> / <?= ttg_h((string) ($row['with'] ?: '—')) ?> / <?= ttg_h((string) ($row['under'] ?: '—')) ?></span>
              <?php if (empty($row['protected']) && ($row['state'] ?? '') !== 'retired'): ?>
                <form class="office-actions" method="post" action="/jack/room-action">
                  <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
                  <input type="hidden" name="id" value="<?= ttg_h((string) $row['id']) ?>">
                  <input type="hidden" name="axis" value="<?= ttg_h($axis) ?>">
                  <label>Shift <?= ttg_h($axis) ?>
                    <?php if ($axis === 'when'): ?>
                      <input type="number" name="value" min="1000" max="2999" placeholder="year">
                    <?php else:
                        $opts = $axis === 'where' ? RoomConfig::WHERE : ($axis === 'with' ? RoomConfig::WITH : RoomConfig::UNDER); ?>
                      <select name="value">
                        <option value="">unset</option>
                        <?php foreach ($opts as $opt): ?>
                          <option value="<?= ttg_h($opt) ?>"<?= ($row[$axis] ?? '') === $opt ? ' selected' : '' ?>><?= ttg_h($opt) ?></option>
                        <?php endforeach; ?>
                      </select>
                    <?php endif; ?>
                  </label>
                  <button type="submit" name="do" value="shift">Shift</button>
                  <button type="submit" name="do" value="retire">Retire</button>
                </form>
              <?php endif; ?>
            </li>
          <?php endforeach; ?>
        </ul>
      </section>
    <?php endforeach; ?>

    <h3 class="office-meta">Drifting pile</h3>
    <?php if ($drifting === []): ?>
      <p class="office-meta">Nothing is drifting. Absence is a valid observation.</p>
    <?php else: ?>
      <ul class="office-list">
        <?php foreach ($drifting as $obj): ?>
          <li><?= ttg_h($obj->title) ?> <span class="office-meta"> · unset <?= ttg_h(implode(', ', $obj->at->driftingAxes())) ?></span></li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>

    <h3 class="office-meta">Punch one card</h3>
    <p class="office-meta">IBM 5081 · 80 columns · boxes 0001–1000 · next <?= $nextBox ? ttg_h(RoomConfig::boxLabel($nextBox)) : 'none empty' ?><?= $ready ? '' : ' · waiting until ' . ttg_h(gmdate('H:i:s', $waitUntil)) . ' GMT' ?></p>
    <form class="office-actions" method="post" action="/jack/room-action">
      <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
      <label>Box
        <input type="number" name="box" min="1" max="1000" value="<?= $nextBox ? (int) $nextBox : 1 ?>" <?= $ready ? '' : 'disabled' ?>>
      </label>
      <label>Card (80 col)
        <input type="text" name="card" maxlength="80" required <?= $ready ? '' : 'disabled' ?>>
      </label>
      <button type="submit" name="do" value="punch" <?= $ready ? '' : 'disabled' ?>>Punch</button>
    </form>

    <form class="office-actions" method="post" action="/jack/room-action">
      <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
      <label>Keepsake title <input type="text" name="title" maxlength="80" required></label>
      <label>When <input type="number" name="when" min="1000" max="2999" value="1951"></label>
      <label>Where
        <select name="where">
          <?php foreach (RoomConfig::WHERE as $opt): ?>
            <option value="<?= ttg_h($opt) ?>"<?= $opt === 'desk' ? ' selected' : '' ?>><?= ttg_h($opt) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>With
        <select name="with">
          <?php foreach (RoomConfig::WITH as $opt): ?>
            <option value="<?= ttg_h($opt) ?>"<?= $opt === 'clerk' ? ' selected' : '' ?>><?= ttg_h($opt) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Under
        <select name="under">
          <?php foreach (RoomConfig::UNDER as $opt): ?>
            <option value="<?= ttg_h($opt) ?>"<?= $opt === 'open' ? ' selected' : '' ?>><?= ttg_h($opt) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <button type="submit" name="do" value="place">Place keepsake</button>
      <button type="submit" name="do" value="line">Line the nest</button>
    </form>
  </article>
</main>
<nav id="dock" aria-label="Jack">
  <a href="/now">NOW</a>
  <a href="/jack">JACK</a>
  <a href="/jack/room" aria-current="page">ROOM</a>
  <a href="/jack/room/engine/">ENGINE</a>
  <a href="/jack/body/">BODY</a>
  <a href="/jack/office">OFFICE</a>
  <a href="/jack/ledger">LEDGER</a>
</nav>
</body>
</html>
