<?php
declare(strict_types=1);

/**
 * CALENDAR — a member's diary laid over the /now tree.
 * Events are private to the signed-in member. On this page only, they hang in
 * the tree as leaves joined to the nodes they concern (now.js in view mode).
 */

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/inc/calendar.php';

ttg_graph_boot_session();
$flash = $_SESSION['cal_flash'] ?? null;
unset($_SESSION['cal_flash']);
$draft = $_SESSION['cal_draft'] ?? null;
unset($_SESSION['cal_draft']);

$viewer = ttg_graph_viewer();
$owner = ttg_cal_owner($viewer);
$tz = ttg_cal_tz();
$today = new DateTimeImmutable('now', $tz);

$m = (string) ($_GET['m'] ?? '');
$month = preg_match('/^\d{4}-\d{2}$/', $m) ? DateTimeImmutable::createFromFormat('!Y-m', $m, $tz) : false;
if (!$month || (int) $month->format('Y') < 1900 || (int) $month->format('Y') > 2200) {
    $month = $today->modify('first day of this month')->setTime(0, 0);
}
$monthEnd = $month->modify('first day of next month');
$d = (string) ($_GET['d'] ?? '');
$day = preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) ? DateTimeImmutable::createFromFormat('!Y-m-d', $d, $tz) : false;
if (!$day || $day < $month || $day >= $monthEnd) {
    $day = ($today >= $month && $today < $monthEnd) ? $today->setTime(0, 0) : $month;
}

$events = $owner ? ttg_cal_between($owner, $month->getTimestamp(), $monthEnd->getTimestamp()) : [];
$upcoming = $owner ? ttg_cal_upcoming($owner, 6) : [];
$editing = null;
if ($owner && isset($_GET['e'])) $editing = ttg_cal_get($owner, (int) $_GET['e']);

$payload = ttg_now_payload();
$linkable = ttg_cal_linkable((array) ($payload['field'] ?? []));
[$payload['field'], $payload['edges']] = ttg_cal_tree((array) $payload['field'], (array) $payload['edges'], $events);
$csrf = (string) ($payload['csrf'] ?? '');

// Day buckets for the grid (an event shows on every day it covers).
$byDay = [];
foreach ($events as $e) {
    $s = (new DateTimeImmutable('@' . $e['starts_at']))->setTimezone($tz)->setTime(0, 0);
    $en = (new DateTimeImmutable('@' . ($e['ends_at'] ?? $e['starts_at'])))->setTimezone($tz)->setTime(0, 0);
    for ($c = max($s, $month); $c <= $en && $c < $monthEnd; $c = $c->modify('+1 day')) {
        $byDay[$c->format('Y-m-d')][] = $e;
    }
}
$dayKey = $day->format('Y-m-d');
$dayEvents = $byDay[$dayKey] ?? [];

$calData = [];
foreach ($events as $e) {
    $calData['cal-' . $e['id']] = [
        'id' => $e['id'],
        'title' => $e['title'],
        'when' => ttg_cal_when($e),
        'place' => $e['place'],
        'note' => $e['note'],
        'links' => $e['links'],
        'href' => ttg_cal_href($e),
    ];
}
$linkTitles = $linkable;
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?: '{"field":[],"edges":[]}';
$calJson = json_encode(['events' => $calData, 'titles' => $linkTitles, 'focus' => $editing ? 'cal-' . $editing['id'] : ''], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?: '{}';

$h = 'ttg_h';
$qs = static fn(DateTimeImmutable $mo, ?DateTimeImmutable $dy = null): string => '/calendar/?m=' . $mo->format('Y-m') . ($dy ? '&d=' . $dy->format('Y-m-d') : '');
$localInput = static fn(?int $ts): string => $ts ? (new DateTimeImmutable('@' . $ts))->setTimezone($tz)->format('Y-m-d\TH:i') : '';

// Form defaults: the event being edited, a draft bounced back by act.php, or a fresh slip on the chosen day.
$f = $draft ?: ($editing ? [
    'id' => $editing['id'], 'title' => $editing['title'], 'all_day' => $editing['all_day'],
    'starts' => $localInput($editing['starts_at']), 'ends' => $editing['all_day'] ? '' : $localInput($editing['ends_at']),
    'date' => (new DateTimeImmutable('@' . $editing['starts_at']))->setTimezone($tz)->format('Y-m-d'),
    'place' => $editing['place'], 'note' => $editing['note'], 'links' => $editing['links'],
    'remind' => $editing['remind_minutes'] === null ? '' : (string) $editing['remind_minutes'],
] : [
    'id' => 0, 'title' => '', 'all_day' => false, 'starts' => $day->setTime(10, 0)->format('Y-m-d\TH:i'), 'ends' => '',
    'date' => $dayKey, 'place' => '', 'note' => '', 'links' => [], 'remind' => '60',
]);
$f['links'] = array_values((array) ($f['links'] ?? []));

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CALENDAR — timetravellersguild.com</title>
<meta name="description" content="A private diary kept beside the tree. Events hang as leaves on the nodes they concern; reminders arrive by email.">
<meta name="theme-color" content="#f1e4c4">
<meta name="robots" content="noindex">
<link rel="canonical" href="https://timetravellersguild.com/calendar/">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon.ico" sizes="32x32">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/now.css?v=260909v">
<link rel="stylesheet" href="/calendar/calendar.css?v=cal1">
</head>
<body class="calendar">
<a class="skip" href="#cal">Calendar</a>
<div id="vignette"></div>
<div id="grain"></div>

<header id="mast">
  <div class="site"><a href="/">TIMETRAVELLERSGUILD.COM</a></div>
  <div class="presents">
    <span>LOCAL PRESENT: <time id="localPresent"><?= $h($today->format('d.m.Y')) ?></time></span>
    <span>NETWORK PRESENT: 17.04.2033</span>
  </div>
</header>

<main id="cal" class="cal-panel" tabindex="-1">
  <header class="cal-head">
    <p class="cal-kicker">CALENDAR · <?= $owner ? 'DIARY OF ' . $h(strtoupper((string) $viewer['first'])) : 'PRIVATE DIARY' ?></p>
    <div class="cal-month">
      <a class="cal-step" href="<?= $h($qs($month->modify('-1 month'))) ?>" aria-label="Previous month">‹</a>
      <h1><?= $h(strtoupper($month->format('F Y'))) ?></h1>
      <a class="cal-step" href="<?= $h($qs($month->modify('+1 month'))) ?>" aria-label="Next month">›</a>
    </div>
    <a class="cal-today" href="/calendar/">TODAY</a>
  </header>

  <?php if ($flash): ?>
    <p class="cal-flash <?= !empty($flash['ok']) ? 'ok' : 'no' ?>" role="status"><?= $h((string) $flash['text']) ?></p>
  <?php endif; ?>

  <?php if (!$owner): ?>
    <section class="cal-slip">
      <p class="cal-slip-k">MEMBERS' DIARY</p>
      <p>Your diary is private: only you see it, and each entry hangs in the tree as a leaf on the things it concerns. Reminders come by email to the address you signed in with.</p>
      <p><a class="cal-btn" href="/people/auth/">SIGN IN TO KEEP A DIARY</a></p>
    </section>
  <?php endif; ?>

  <table class="cal-grid" aria-label="<?= $h($month->format('F Y')) ?>">
    <thead><tr><?php foreach (['M', 'T', 'W', 'T', 'F', 'S', 'S'] as $wd): ?><th scope="col"><?= $wd ?></th><?php endforeach; ?></tr></thead>
    <tbody>
    <?php
    $cursor = $month->modify('-' . ((int) $month->format('N') - 1) . ' days');
    while ($cursor < $monthEnd):
    ?>
      <tr>
      <?php for ($i = 0; $i < 7; $i++, $cursor = $cursor->modify('+1 day')):
          $k = $cursor->format('Y-m-d');
          $in = $cursor >= $month && $cursor < $monthEnd;
          $cls = [$in ? 'in' : 'out'];
          if ($k === $today->format('Y-m-d')) $cls[] = 'today';
          if ($k === $dayKey) $cls[] = 'sel';
          $list = $in ? ($byDay[$k] ?? []) : [];
          if ($list) $cls[] = 'has';
      ?>
        <td class="<?= implode(' ', $cls) ?>">
          <?php if ($in): ?>
            <a href="<?= $h($qs($month, $cursor)) ?>" <?= $k === $dayKey ? 'aria-current="date"' : '' ?>>
              <span class="n"><?= (int) $cursor->format('j') ?></span>
              <?php foreach (array_slice($list, 0, 2) as $e): ?><span class="ev" data-slug="cal-<?= (int) $e['id'] ?>"><?= $h($e['title']) ?></span><?php endforeach; ?>
              <?php if (count($list) > 2): ?><span class="more">+<?= count($list) - 2 ?></span><?php endif; ?>
            </a>
          <?php else: ?><span class="n"><?= (int) $cursor->format('j') ?></span><?php endif; ?>
        </td>
      <?php endfor; ?>
      </tr>
    <?php endwhile; ?>
    </tbody>
  </table>

  <section class="cal-day" aria-labelledby="dayHead">
    <h2 id="dayHead"><?= $h(strtoupper($day->format('l j F'))) ?></h2>
    <?php if (!$dayEvents): ?>
      <p class="cal-empty"><?= $owner ? 'Nothing entered for this day.' : 'Sign in to see your entries.' ?></p>
    <?php endif; ?>
    <ol class="cal-list">
    <?php foreach ($dayEvents as $e): ?>
      <li id="e<?= (int) $e['id'] ?>" data-slug="cal-<?= (int) $e['id'] ?>">
        <p class="t"><?= $h($e['all_day'] ? 'ALL DAY' : (new DateTimeImmutable('@' . $e['starts_at']))->setTimezone($tz)->format('H:i')) ?><?= $e['remind_minutes'] !== null ? ' · <span title="Email reminder">' . ($e['reminded_at'] ? 'REMINDED' : 'REMINDER SET') . '</span>' : '' ?></p>
        <p class="ti"><button type="button" class="cal-focus" data-slug="cal-<?= (int) $e['id'] ?>"><?= $h($e['title']) ?></button></p>
        <?php if ($e['place'] !== ''): ?><p class="pl"><?= $h($e['place']) ?></p><?php endif; ?>
        <?php if ($e['note'] !== ''): ?><p class="no"><?= nl2br($h($e['note'])) ?></p><?php endif; ?>
        <?php if ($e['links']): ?>
          <p class="cn">CONCERNS <?php foreach ($e['links'] as $s): if (!isset($linkable[$s])) continue; ?><a href="/n/<?= $h(rawurlencode($s)) ?>/"><?= $h($linkable[$s]) ?></a><?php endforeach; ?></p>
        <?php endif; ?>
        <div class="acts">
          <a class="cal-btn small" href="<?= $h($qs($month, $day)) ?>&amp;e=<?= (int) $e['id'] ?>#slip">AMEND</a>
          <form method="post" action="/calendar/act.php" onsubmit="return confirm('Strike this entry from your diary?');">
            <input type="hidden" name="csrf" value="<?= $h($csrf) ?>">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= (int) $e['id'] ?>">
            <input type="hidden" name="back" value="<?= $h($qs($month, $day)) ?>">
            <button type="submit" class="cal-btn small ghost">STRIKE</button>
          </form>
        </div>
      </li>
    <?php endforeach; ?>
    </ol>
  </section>

  <?php if ($owner): ?>
  <form id="slip" class="cal-form" method="post" action="/calendar/act.php">
    <h2><?= $f['id'] ? 'AMEND THE ENTRY' : 'ENTER IN THE DIARY' ?></h2>
    <input type="hidden" name="csrf" value="<?= $h($csrf) ?>">
    <input type="hidden" name="action" value="save">
    <input type="hidden" name="id" value="<?= (int) $f['id'] ?>">
    <label>What<input name="title" required maxlength="140" value="<?= $h((string) $f['title']) ?>" placeholder="Meet Mabel at the archive"></label>
    <label class="check"><input type="checkbox" name="all_day" value="1" id="allDay" <?= !empty($f['all_day']) ? 'checked' : '' ?>> All day</label>
    <div class="row when-time">
      <label>Starts<input type="datetime-local" name="starts" value="<?= $h((string) $f['starts']) ?>"></label>
      <label>Ends <small>(optional)</small><input type="datetime-local" name="ends" value="<?= $h((string) $f['ends']) ?>"></label>
    </div>
    <label class="when-date">Date<input type="date" name="date" value="<?= $h((string) $f['date']) ?>"></label>
    <label>Where <small>(optional)</small><input name="place" maxlength="120" value="<?= $h((string) $f['place']) ?>" placeholder="Cardiff"></label>
    <label>Note <small>(optional)</small><textarea name="note" rows="3" maxlength="2000"><?= $h((string) $f['note']) ?></textarea></label>
    <div class="row">
      <label>Concerns <small>(a node in the tree)</small>
        <select name="links[]">
          <option value="">—</option>
          <?php foreach ($linkable as $slug => $title): ?><option value="<?= $h($slug) ?>" <?= ($f['links'][0] ?? '') === $slug ? 'selected' : '' ?>><?= $h($title) ?></option><?php endforeach; ?>
        </select>
      </label>
      <label>And <small>(optional)</small>
        <select name="links[]">
          <option value="">—</option>
          <?php foreach ($linkable as $slug => $title): ?><option value="<?= $h($slug) ?>" <?= ($f['links'][1] ?? '') === $slug ? 'selected' : '' ?>><?= $h($title) ?></option><?php endforeach; ?>
        </select>
      </label>
    </div>
    <p class="hint">Name a place, person or thing from the tree in the title or note and the clerk joins it for you.</p>
    <label>Email reminder
      <select name="remind">
        <option value="" <?= $f['remind'] === '' ? 'selected' : '' ?>>No reminder</option>
        <?php foreach (TTG_CAL_REMIND as $mins => $label): ?><option value="<?= $mins ?>" <?= (string) $f['remind'] === (string) $mins ? 'selected' : '' ?>><?= $h($label) ?></option><?php endforeach; ?>
      </select>
    </label>
    <p class="hint">Sent to <?= $h((string) $owner) ?>.</p>
    <input type="hidden" name="back" value="<?= $h($qs($month, $day)) ?>">
    <div class="acts">
      <button type="submit" class="cal-btn"><?= $f['id'] ? 'AMEND' : 'ENTER' ?></button>
      <?php if ($f['id']): ?><a class="cal-btn ghost" href="<?= $h($qs($month, $day)) ?>">CANCEL</a><?php endif; ?>
    </div>
  </form>
  <?php endif; ?>
</main>

<aside id="calContext" class="cal-context" aria-live="polite">
  <p class="cx-k" id="cxKicker">CONTEXT · THE TREE</p>
  <h2 id="cxTitle"><?= $owner ? 'Coming up' : 'The tree' ?></h2>
  <p class="cx-meta" id="cxMeta"></p>
  <div id="cxBody">
    <?php if ($upcoming): ?>
      <ol class="cx-up">
      <?php foreach ($upcoming as $e): ?>
        <li><a href="<?= $h(ttg_cal_href($e)) ?>"><b><?= $h($e['title']) ?></b><span><?= $h(ttg_cal_when($e)) ?></span></a></li>
      <?php endforeach; ?>
      </ol>
    <?php else: ?>
      <p>Tap a bead in the tree to read its context. <?= $owner ? 'Your entries this month hang as leaves among the nodes they concern.' : '' ?></p>
    <?php endif; ?>
  </div>
</aside>

<div id="projections" role="tablist" aria-label="Projection" hidden>
  <button type="button" role="tab" data-proj="TEMPORAL" aria-selected="true">TEMPORAL</button>
</div>
<aside id="chrono" aria-hidden="true" hidden><ol id="chronoTicks"></ol><div id="chronoHead"></div></aside>
<div id="surf" aria-hidden="true" hidden>
  <button type="button" id="surfPast">PAST</button>
  <p id="surfYear"><strong id="surfYearNum"><?= $h($today->format('Y')) ?></strong><span id="surfYearNote">LOCAL PRESENT</span></p>
  <button type="button" id="surfFuture">FUTURE</button>
</div>
<section id="field-list" aria-hidden="true">
  <ul id="fallbackList"></ul>
</section>

<nav id="dock" aria-label="Calendar">
  <a href="/now">TREE</a>
  <a href="/view">VIEW</a>
  <a href="/calendar/" aria-current="page">CALENDAR</a>
  <a href="/jack">JACK</a>
  <a href="/">HOME</a>
</nav>

<script>window.TTG_MODE='view';window.TTG_GRAPH=<?= $json ?>;window.TTG_CAL=<?= $calJson ?>;</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="/assets/now.js?v=260910b"></script>
<script src="/calendar/calendar.js?v=cal1"></script>
</body>
</html>
