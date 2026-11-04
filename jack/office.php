<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/JackOffice/autoload.php';
require_once dirname(__DIR__) . '/app/JackSoul/autoload.php';
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__) . '/app/AI/JackRelationship.php';

$viewer = OfficeAuth::requireOffice();
$store = new OfficeStore();
$store->boot();
$csrf = ttg_graph_csrf();
$stationQ = trim((string) ($_GET['station'] ?? ''));
$recordQ = trim((string) ($_GET['record'] ?? ''));

$stationId = $stationQ !== '' ? OfficePath::recordId($stationQ) : '';
if ($stationId === '' && $stationQ !== '') {
    $try = OfficeConfig::stationId(str_replace('_', '-', strtoupper($stationQ)));
    $stationId = OfficeConfig::isStationId($try) ? $try : '';
}

$focus = $recordQ !== '' ? $store->get(OfficePath::recordId($recordQ) ?: $recordQ) : null;
if ($stationId === '' && $focus) {
    $stationId = (string) ($focus['station_id'] ?? $focus['parent_id'] ?? '');
}
if ($stationId === '') {
    $stationId = OfficeConfig::stationId('IN-TRAY');
}

$station = $store->get($stationId);
$children = $station ? $store->children($stationId, 40, 0) : [];
$events = OfficeLedger::recent($store->root(), 8);
$status = 'QUIET';
$last = $events[0] ?? null;
if ($last) {
    $act = (string) ($last['action'] ?? '');
    $status = match (true) {
        str_contains($act, 'dream') => 'DREAMING',
        str_contains($act, 'enable') || ($last['approval_state'] ?? '') === 'awaiting_authority' => 'AWAITING AUTHORITY',
        in_array($act, ['create_folder', 'write_note', 'revise_note', 'move_record', 'link_records'], true) => 'FILING',
        default => 'OBSERVING',
    };
}

$pending = [];
foreach ($store->children(OfficeConfig::stationId('PROGRAMMES'), 20, 0) as $p) {
    if (($p['kind'] ?? '') === 'programme' && empty($p['enabled'])) $pending[] = $p;
}

$roomStore = null;
$soul = null;
try {
    $roomStore = new RoomStore();
    $habitat = new JackRoom($roomStore);
    $roomStore->touchKeeper();
    $rel = JackRelationship::load(JackPolicy::subjectKey($viewer));
    $soul = JackSoul::observe($habitat, $store, $rel, 'clerk');
} catch (Throwable $e) {
    $soul = null;
}

$soul = ['stamp' => '', 'plumage' => '', 'runtime' => []];
try {
    $roomStore = new RoomStore();
    $habitat = new JackRoom($roomStore);
    $roomStore->touchKeeper();
    $rel = JackRelationship::load(JackPolicy::subjectKey($viewer));
    $soul = JackSoul::observe($habitat, $store, $rel, 'clerk');
} catch (Throwable $e) {
    $soul = ['stamp' => '', 'plumage' => '', 'runtime' => []];
}

$clerk = 'The office is quiet. Nothing has been promoted to canon.';
if ($last) {
    $act = (string) ($last['action'] ?? '');
    $clerk = match ($act) {
        'create_folder' => 'I have opened a folder because the same matter continues to arrive. Nothing has been promoted to canon.',
        'write_note', 'revise_note' => 'I have filed a note. Inference remains inference.',
        'link_records' => 'I have made a correspondence. The records remain distinct.',
        'retire_record', 'forget_dream' => 'I have retired a slip. It remains recoverable.',
        'propose_programme' => 'I have proposed a Programme. I cannot enable it.',
        'run_programme' => 'I have run a Programme that was already enabled. Nothing has been promoted to canon.',
        'run_programme_preview' => 'I have previewed a Programme. Nothing was filed.',
        'enable_programme' => 'A Programme was enabled by the Keeper.',
        'request_dream_window' => 'A dream window was requested. It is not evidence.',
        default => 'I have acted in the office. I have not decided what it means.',
    };
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>JACK / OFFICE — timetravellersguild.com</title>
<meta name="theme-color" content="#f1e4c4">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909a">
<link rel="stylesheet" href="/assets/jack.css?v=1951o">
<style>
.office-grid{display:grid;grid-template-columns:11rem 1fr;gap:1rem;max-width:52rem;margin:0 auto;padding:.6rem 1rem 7rem}
.office-nav a{display:block;font-family:var(--label);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:var(--navy);padding:.28rem 0}
.office-nav a[aria-current="page"]{color:var(--scarlet)}
.office-list{list-style:none;margin:0;padding:0}
.office-list li{margin:0 0 .55rem}
.office-list a{color:var(--scarlet);text-decoration:none;border-bottom:1px solid var(--scarlet)}
.office-meta{font-family:var(--label);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--navy)}
.dream-card{border:2px dashed var(--gold);padding:.8rem;background:rgba(201,162,39,.08)}
.programme-card{border:1px solid var(--navy);padding:.7rem .8rem;margin:.6rem 0}
.office-actions button{margin-right:.35rem}
@media(max-width:700px){.office-grid{grid-template-columns:1fr}}
</style>
</head>
<body class="jack-room">
<div id="vignette"></div><div id="grain"></div>
<header id="mast">
  <?= ttg_html_site_mark('', 'div', 'site') ?>
  <div class="presents"><span>JACK / OFFICE</span><span>NETWORK PRESENT: 17.04.2033</span></div>
</header>
<section id="here">
  <p id="clockLine">JACK / CLERK</p>
  <p id="position"><?= ttg_h($status) ?></p>
</section>
<main class="office-grid">
  <nav class="office-nav" aria-label="Stations">
    <?php foreach (OfficeConfig::STATIONS as $name):
      $sid = OfficeConfig::stationId($name); ?>
      <a href="/jack/office?station=<?= ttg_h($sid) ?>"<?= $sid === $stationId ? ' aria-current="page"' : '' ?>><?= ttg_h($name) ?></a>
    <?php endforeach; ?>
    <a href="/jack/room">ROOM</a>
    <a href="/jack/room/engine/">ENGINE</a>
    <a href="/jack/ledger">LEDGER</a>
    <a href="/jack">DESK</a>
  </nav>
  <article class="ibm-card punch-sheet" id="jack">
    <header class="ibm-band">
      <span>IBM 5081 · OFFICE</span>
      <span><?= ttg_h($station['display_name'] ?? 'STATION') ?></span>
      <span><?= ttg_h($status) ?></span>
    </header>
    <?php if (is_array($soul)): ?>
      <p class="jack-stamp <?= ttg_h(($soul['plumage'] ?? '') === 'well_feathered' ? 'feathered' : (string) ($soul['plumage'] ?? '')) ?>"><?= ttg_h((string) ($soul['stamp'] ?? '')) ?></p>
    <?php endif; ?>
    <?php if (($soul['stamp'] ?? '') !== ''): ?>
      <p class="jack-stamp <?= ttg_h(($soul['plumage'] ?? '') === 'well_feathered' ? 'feathered' : (string) ($soul['plumage'] ?? '')) ?>"><?= ttg_h((string) $soul['stamp']) ?></p>
    <?php endif; ?>
    <?php if (!empty($soul['runtime'][0])): ?><p class="office-meta"><?= ttg_h((string) $soul['runtime'][0]) ?></p><?php endif; ?>
    <p><?= ttg_h($clerk) ?></p>
    <?php if ($last): ?>
      <p class="office-meta">Last: <?= ttg_h((string) ($last['action'] ?? '')) ?> · <?= ttg_h((string) ($last['result'] ?? '')) ?></p>
    <?php endif; ?>

    <?php if ($focus): ?>
      <p class="life-type"><?= ttg_h(strtoupper((string) $focus['kind'])) ?> · <?= ttg_h((string) $focus['epistemic_status']) ?></p>
      <h2><?= ttg_h((string) $focus['display_name']) ?></h2>
      <div class="<?= ($focus['kind'] ?? '') === 'dream' ? 'dream-card' : '' ?>">
        <?php if (!empty($focus['warning'])): ?><p class="office-meta"><?= ttg_h((string) $focus['warning']) ?></p><?php endif; ?>
        <p><?= nl2br(ttg_h((string) ($focus['body'] ?? ''))) ?></p>
      </div>
        <?php if (($focus['kind'] ?? '') === 'programme' && is_array($focus['manifest'] ?? null)):
        $man = $focus['manifest'];
        $next = ProgrammeInterpreter::nextEligible($focus, $man);
        $hist = is_array($focus['run_history'] ?? null) ? $focus['run_history'] : [];
        ?>
        <div class="programme-card">
          <p class="office-meta">Programme · <?= !empty($focus['enabled']) ? 'ENABLED' : 'AWAITING AUTHORITY' ?> · v<?= (int) ($focus['programme_version'] ?? 1) ?></p>
          <p><?= ttg_h((string) ($man['purpose'] ?? $focus['body'])) ?></p>
          <p class="office-meta">Trigger: <?= ttg_h((string) ($man['trigger']['type'] ?? 'manual')) ?> · Interval: <?= (int) ($man['trigger']['minimum_interval_hours'] ?? 0) ?>h · Authority: interpret only</p>
          <p class="office-meta">Reads: <?= ttg_h(implode(', ', is_array($man['scope']['read_stations'] ?? null) ? $man['scope']['read_stations'] : [])) ?></p>
          <p class="office-meta">Actions: <?= ttg_h(implode(', ', array_map(static fn ($a) => (string) ($a['type'] ?? ''), is_array($man['actions'] ?? null) ? $man['actions'] : []))) ?></p>
          <p class="office-meta">Last run: <?= ttg_h((string) ($focus['last_run_at'] ?? 'never')) ?><?= $next ? ' · Next eligible: ' . ttg_h($next) : '' ?></p>
          <?php if ($hist !== []): ?>
            <p class="office-meta">History: <?= ttg_h((string) ($hist[0]['mode'] ?? '') . ' · ' . (string) ($hist[0]['result'] ?? '') . ' · matched ' . (string) ($hist[0]['matched'] ?? '0')) ?></p>
          <?php endif; ?>
        </div>
      <?php endif; ?>
      <p class="office-meta">Revision <?= (int) ($focus['revision'] ?? 1) ?><?= !empty($focus['retired']) ? ' · RETIRED' : '' ?><?= !empty($focus['previous_parent_id']) ? ' · was ' . ttg_h((string) $focus['previous_parent_id']) : '' ?></p>
      <form class="office-actions" method="post" action="/jack/office-action">
        <input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>">
        <input type="hidden" name="record_id" value="<?= ttg_h((string) $focus['id']) ?>">
        <?php if (!empty($focus['retired'])): ?>
          <button type="submit" name="do" value="recover">Recover</button>
        <?php elseif (($focus['kind'] ?? '') === 'programme'): ?>
          <button type="submit" name="do" value="preview">Preview</button>
          <?php if (empty($focus['enabled'])): ?>
            <button type="submit" name="do" value="enable">Enable (Toby)</button>
            <button type="submit" name="do" value="reject">Reject</button>
          <?php else: ?>
            <button type="submit" name="do" value="run">Run</button>
            <button type="submit" name="do" value="disable">Disable</button>
            <button type="submit" name="do" value="retire">Retire</button>
          <?php endif; ?>
        <?php elseif (($focus['kind'] ?? '') === 'dream'): ?>
          <button type="submit" name="do" value="keep">Keep</button>
          <button type="submit" name="do" value="interpret">Interpret</button>
          <button type="submit" name="do" value="wake">Wake me</button>
          <button type="submit" name="do" value="forget">Forget</button>
        <?php elseif (empty($focus['protected'])): ?>
          <button type="submit" name="do" value="retire">Retire</button>
        <?php endif; ?>
      </form>
    <?php else: ?>
      <p class="life-type"><?= ttg_h($station['display_name'] ?? '') ?></p>
      <ul class="office-list">
        <?php if ($children === []): ?>
          <li>Nothing filed here yet. Absence is a valid observation.</li>
        <?php endif; ?>
        <?php foreach ($children as $row): ?>
          <li>
            <a href="/jack/office?record=<?= ttg_h((string) $row['id']) ?>"><?= ttg_h((string) $row['display_name']) ?></a>
            <span class="office-meta"> · <?= ttg_h((string) $row['kind']) ?> · <?= ttg_h((string) $row['epistemic_status']) ?></span>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>

    <?php if ($pending !== [] && !$focus): ?>
      <h3 class="office-meta">Awaiting authority</h3>
      <ul class="office-list">
        <?php foreach ($pending as $p): ?>
          <li>
            <a href="/jack/office?record=<?= ttg_h((string) $p['id']) ?>"><?= ttg_h((string) $p['display_name']) ?></a>
            <span class="office-meta"> — <?= ttg_h((string) $p['body']) ?></span>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endif; ?>
  </article>
</main>
<nav id="dock" aria-label="Jack">
  <a href="/now">NOW</a>
  <a href="/jack">JACK</a>
  <a href="/jack/room">ROOM</a>
  <a href="/jack/room/engine/">ENGINE</a>
  <a href="/jack/office" aria-current="page">OFFICE</a>
  <a href="/jack/ledger">LEDGER</a>
  <a href="/people/profile/">YOU</a>
</nav>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
