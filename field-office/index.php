<?php
declare(strict_types=1);
/*
 * /field-office/            If Thursday Fails: the programme, with the next session first
 * /field-office/<slug>/     one session's stable link; the same link carries every change (Proposed, Confirmed, Moved)
 * /field-office/?manage=T   a participant's own booking: see it, cancel it, delete it
 * /field-office/?json       the public session records, as Jack reads them
 * Data and rules: inc/fieldoffice.php. Staff: /field-office/desk/.
 */
require_once dirname(__DIR__) . '/inc/fieldoffice.php';
ttg_graph_boot_session();
header('Cache-Control: no-store');

$lang = ttg_fo_lang();
$T = static fn (string $k) => ttg_fo_t($k, $lang);
$sessions = ttg_fo_sessions();

if (isset($_GET['json'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['programme' => $T('programme'), 'link' => 'https://timetravellersguild.com/field-office/',
        'sessions' => array_map(static fn ($s) => ttg_fo_public($s, $lang), $sessions)], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$slug = preg_replace('/[^a-z0-9-]/', '', (string) ($_GET['s'] ?? '')) ?? '';
$session = $slug !== '' ? ttg_fo_session($slug) : null;
if ($slug !== '' && !$session) http_response_code(404);

$flash = '';
$flashKind = '';
$manageLink = '';

/* ---- reserve ---- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'reserve' && $session) {
    $name = trim(mb_substr((string) ($_POST['name'] ?? ''), 0, 120));
    $email = strtolower(trim(mb_substr((string) ($_POST['email'] ?? ''), 0, 200)));
    $needs = trim(mb_substr((string) ($_POST['needs'] ?? ''), 0, 1000));
    $left = ttg_fo_public($session, $lang)['places_left'] ?? null;
    if (!ttg_graph_csrf_ok($_POST['csrf'] ?? null) || ($_POST['website'] ?? '') !== '') {
        [$flash, $flashKind] = [$T('error'), 'bad'];
    } elseif ($session['mode'] === 'dropin' || $session['status'] === 'cancelled') {
        [$flash, $flashKind] = [$T('cannot_reserve'), 'bad'];
    } elseif ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        [$flash, $flashKind] = [$T('need_name_email'), 'bad'];
    } elseif ($left !== null && $left <= 0) {
        [$flash, $flashKind] = [$T('full'), 'bad'];
    } else {
        $dup = ttg_fo_db()->prepare('SELECT COUNT(*) FROM reservations WHERE session_id = ? AND email = ? AND cancelled_at IS NULL');
        $dup->execute([(int) $session['id'], $email]);
        if ((int) $dup->fetchColumn() > 0) {
            [$flash, $flashKind] = [$T('already'), 'bad'];
        } else {
            $token = ttg_fo_token();
            ttg_fo_db()->prepare('INSERT INTO reservations (session_id, name, email, access_needs, lang, token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                ->execute([(int) $session['id'], $name, $email, $needs, $lang, $token, gmdate('c')]);
            $r = ['token' => $token, 'lang' => $lang, 'email' => $email];
            $mailer = dirname(__DIR__) . '/people/inc/mail.php';
            if (is_file($mailer)) {
                require_once $mailer;
                @ttg_send_mail($email, $T('reserved') . ' · ' . $T('programme'), ttg_fo_mail_body($session, $r, $lang, $T('reserved') . '.'));
            }
            $manageLink = '/field-office/?manage=' . $token . ($lang === 'cy' ? '&lang=cy' : '');
            [$flash, $flashKind] = [$T('reserved'), 'good'];
        }
    }
}

/* ---- manage ---- */
$booking = null;
$manageToken = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($_GET['manage'] ?? $_POST['manage'] ?? '')) ?? '';
if ($manageToken !== '') {
    $q = ttg_fo_db()->prepare('SELECT r.*, s.slug FROM reservations r JOIN sessions s ON s.id = r.session_id WHERE r.token = ?');
    $q->execute([$manageToken]);
    $booking = $q->fetch() ?: null;
    if ($booking && $_SERVER['REQUEST_METHOD'] === 'POST' && ttg_graph_csrf_ok($_POST['csrf'] ?? null)) {
        if (($_POST['do'] ?? '') === 'cancel') {
            ttg_fo_db()->prepare('UPDATE reservations SET cancelled_at = ? WHERE id = ? AND cancelled_at IS NULL')->execute([gmdate('c'), (int) $booking['id']]);
            [$flash, $flashKind] = [$T('cancelled_place'), 'good'];
            $booking['cancelled_at'] = gmdate('c');
        } elseif (($_POST['do'] ?? '') === 'delete') {
            ttg_fo_db()->prepare('DELETE FROM reservations WHERE id = ?')->execute([(int) $booking['id']]);
            [$flash, $flashKind] = [$T('deleted'), 'good'];
            $booking = null;
            $manageToken = 'deleted';
        }
    }
    if ($booking) $session = ttg_fo_session($booking['slug']);
    elseif ($manageToken !== 'deleted') { http_response_code(404); [$flash, $flashKind] = [$T('not_found'), 'bad']; }
}

$next = ttg_fo_next($sessions);
$csrf = ttg_graph_csrf();
$here = $session ? '/field-office/' . $session['slug'] . '/' : '/field-office/';
$switch = $here . '?lang=' . ($lang === 'cy' ? 'en' : 'cy') . ($manageToken !== '' && $booking ? '&manage=' . rawurlencode($manageToken) : '');
$title = ($session ? ($lang === 'cy' && $session['title_cy'] !== '' ? $session['title_cy'] : $session['title_en']) . ' · ' : '') . $T('programme');
$description = $T('intro');

/** One session card. $full adds the arrival and access details and the booking form. */
$card = static function (array $s, bool $full) use ($lang, $T, $csrf, $manageLink, $booking): string {
    $p = ttg_fo_public($s, $lang);
    $h = static fn ($x) => ttg_h((string) $x);
    $o = '<article class="session ' . $h($p['status']) . '" aria-labelledby="t-' . $h($p['slug']) . '">';
    $o .= '<p class="badge"><span class="st">' . $h($p['status_label']) . '</span></p>';
    $o .= '<h2 id="t-' . $h($p['slug']) . '">' . ($full ? $h($p['title']) : '<a href="/field-office/' . $h($p['slug']) . '/' . ($lang === 'cy' ? '?lang=cy' : '') . '">' . $h($p['title']) . '</a>') . '</h2>';
    $o .= '<p class="when">' . $h($p['when']) . '</p>';
    if (!empty($p['original_instruction']) || !empty($p['original_venue'])) {
        $o .= '<div class="moved" role="alert"><b>' . $h($T('not_original')) . (!empty($p['original_venue']) ? ': ' . $h($p['original_venue']) : '') . '.</b>'
            . (!empty($p['original_instruction']) ? ' ' . $h($p['original_instruction']) : '') . '</div>';
    }
    if ($p['status'] === 'proposed') {
        $o .= '<p class="pending">' . $h($T('venue_tbc')) . '</p>';
    } elseif (!empty($p['venue'])) {
        $o .= '<dl><div><dt>' . $h($T('where')) . '</dt><dd>' . $h($p['venue']) . (!empty($p['address']) ? '<br>' . nl2br($h($p['address'])) : '') . '</dd></div>';
        if ($full && !empty($p['getting_in'])) $o .= '<div><dt>' . $h($T('getting_in')) . '</dt><dd>' . nl2br($h($p['getting_in'])) . '</dd></div>';
        $o .= '</dl>';
    }
    if ($full && !empty($p['access'])) $o .= '<dl><div><dt>' . $h($T('access')) . '</dt><dd>' . nl2br($h($p['access'])) . '</dd></div></dl>';
    if ($p['status'] !== 'cancelled') {
        $o .= '<p class="how">' . $h($p['how_to_come']) . (isset($p['places_left']) && $p['places_left'] <= 0 ? ' ' . $h($T('full')) : '') . '</p>';
    }
    if ($full && !empty($p['updates'])) {
        $o .= '<section class="updates"><h3>' . $h($T('updates')) . '</h3><ol>';
        foreach ($p['updates'] as $u) $o .= '<li><time datetime="' . $h($u['at']) . '">' . $h(ttg_fo_date(substr((string) $u['at'], 0, 16), $lang)) . '</time> ' . $h($u['note'] !== '' ? $u['note'] : ttg_fo_t($u['status'], $lang)) . '</li>';
        $o .= '</ol></section>';
    }
    $open = $s['mode'] !== 'dropin' && $p['status'] !== 'cancelled' && (!isset($p['places_left']) || $p['places_left'] > 0);
    if ($full && $open && !$booking && $manageLink === '') {
        $o .= '<form class="reserve" method="post" action="/field-office/' . $h($p['slug']) . '/"><h3>' . $h($T('reserve')) . '</h3>'
            . '<input type="hidden" name="do" value="reserve"><input type="hidden" name="csrf" value="' . $h($csrf) . '"><input type="hidden" name="lang" value="' . $h($lang) . '">'
            . '<label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off"></label>'
            . '<label>' . $h($T('name')) . '<input name="name" required maxlength="120" autocomplete="name"></label>'
            . '<label>' . $h($T('email')) . '<input name="email" type="email" required maxlength="200" autocomplete="email"></label>'
            . '<label>' . $h($T('needs')) . '<textarea name="needs" rows="3" maxlength="1000"></textarea></label>'
            . '<p class="note">' . $h($T('reserve_note')) . ' <a href="/privacy/#fieldoffice">' . $h($T('privacy')) . '</a>.</p>'
            . '<button type="submit">' . $h($T('reserve')) . '</button></form>';
    }
    return $o . '</article>';
};
?><!doctype html>
<html lang="<?= $lang === 'cy' ? 'cy' : 'en-GB' ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title><?= ttg_h($title) ?> — <?= ttg_h($T('office')) ?></title>
<meta name="description" content="<?= ttg_h($description) ?>">
<?php if ($manageToken !== ''): ?><meta name="robots" content="noindex"><?php endif; ?>
<link rel="canonical" href="https://timetravellersguild.com<?= ttg_h($here) ?>">
<link rel="alternate" hreflang="en" href="https://timetravellersguild.com<?= ttg_h($here) ?>?lang=en">
<link rel="alternate" hreflang="cy" href="https://timetravellersguild.com<?= ttg_h($here) ?>?lang=cy">
<?= ttg_og_head(['title' => $title, 'description' => $description, 'url' => 'https://timetravellersguild.com' . $here]) ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/network.css">
<style>
:root{--ink:#070706;--rule:#2a251d;--brass:#c9a961;--brass-dim:#7d6838;--brass-faint:#3d3320;--bright:#e4c583;--parch:#ded7c8;--dim:#a39b8d;--white:#f4eede;--red:#e0705c;--green:#9ccf9c}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--parch);font-family:"EB Garamond",Georgia,serif;font-size:18px;line-height:1.6}
a{color:var(--bright)}
main{max-width:40rem;margin:0 auto;padding:2rem 16px 4rem}
.mono,.kicker,.badge,dt,.how,.lang,.note,.updates time,button{font-family:"Courier Prime",monospace}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap}
.kicker{font-size:.66rem;letter-spacing:.2em;text-transform:uppercase;color:var(--brass);margin:0}
.lang{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--brass-faint);padding:.45rem .7rem;text-decoration:none;min-height:2.4rem;display:inline-flex;align-items:center}
h1{font-weight:400;font-size:clamp(2.2rem,8vw,3.6rem);line-height:1;color:var(--white);margin:.8rem 0 1rem}
.intro{font-size:1.08rem;margin:0 0 2rem;max-width:34em}
.flash{border:1px solid;padding:.8rem 1rem;margin:0 0 1.5rem}
.flash.good{border-color:var(--green);color:var(--green)}.flash.bad{border-color:var(--red);color:var(--red)}
.flash code{word-break:break-all;color:var(--white)}
h2.sec{font-family:"Courier Prime",monospace;font-weight:400;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:var(--brass-dim);margin:2.4rem 0 .8rem}
.session{border:1px solid var(--rule);padding:1.1rem 1.1rem 1.2rem;margin:0 0 .9rem;background:#0d0c0a}
.session h2{font-weight:400;font-size:1.6rem;line-height:1.15;color:var(--white);margin:.2rem 0 .1rem}
.session h2 a{color:inherit;text-decoration:none}.session h2 a:hover,.session h2 a:focus-visible{text-decoration:underline}
.badge{margin:0}.st{display:inline-block;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;padding:.3rem .55rem;border:1px solid var(--brass-dim);color:var(--bright)}
.session.confirmed .st{border-color:var(--green);color:var(--green)}
.session.moved .st,.session.cancelled .st{border-color:var(--red);color:var(--red)}
.session.moved{border-color:#5a2a22}
.when{margin:.1rem 0 .7rem;color:var(--parch)}
.pending{color:var(--dim);margin:.4rem 0}
.moved{border-left:3px solid var(--red);padding:.5rem .8rem;margin:.6rem 0;background:#1d0f0c;color:var(--white)}
dl{margin:.6rem 0;display:grid;gap:.6rem}dt{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--brass-dim)}dd{margin:.15rem 0 0}
.how{font-size:.78rem;color:var(--bright);margin:.8rem 0 0}
.updates h3,.reserve h3{font-family:"Courier Prime",monospace;font-weight:400;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:var(--brass-dim);margin:1.4rem 0 .5rem}
.updates ol{list-style:none;margin:0;padding:0}.updates li{padding:.35rem 0;border-top:1px solid var(--rule)}
.updates time{font-size:.7rem;color:var(--dim);display:block}
.reserve{margin-top:1rem;border-top:1px solid var(--rule)}
.reserve label{display:block;margin:.8rem 0 0;font-size:.95rem}
.reserve input,.reserve textarea{display:block;width:100%;margin-top:.3rem;background:#14120f;color:var(--white);border:1px solid #3d3628;padding:.65rem .7rem;font:1rem "EB Garamond",Georgia,serif}
.reserve input:focus-visible,.reserve textarea:focus-visible,button:focus-visible,.lang:focus-visible{outline:2px solid var(--bright);outline-offset:2px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.note{font-size:.72rem;color:var(--dim);line-height:1.5;margin:.8rem 0}
button{background:var(--bright);color:#1b1a17;border:0;font-weight:700;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;padding:.75rem 1.1rem;cursor:pointer;min-height:2.75rem}
button.quiet{background:none;color:var(--bright);border:1px solid var(--brass-dim)}
.manage form{display:inline-block;margin:.4rem .5rem .4rem 0}
.foot{margin-top:2.6rem;display:flex;flex-wrap:wrap;gap:.5rem}
.foot a{font-family:"Courier Prime",monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;border:1px solid var(--brass-faint);padding:.5rem .8rem}
.draft{font-size:.72rem;color:var(--dim);margin-top:1.4rem}
</style>
</head>
<body>
<?= ttg_network_bar() ?>
<main>
  <div class="top">
    <p class="kicker"><?= ttg_h($T('office')) ?></p>
    <a class="lang" href="<?= ttg_h($switch) ?>" hreflang="<?= $lang === 'cy' ? 'en' : 'cy' ?>" lang="<?= $lang === 'cy' ? 'en' : 'cy' ?>"><?= ttg_h($T('switch')) ?></a>
  </div>
  <h1><?= ttg_h($T('programme')) ?></h1>

  <?php if ($flash !== ''): ?>
    <div class="flash <?= ttg_h($flashKind) ?>" role="status">
      <?= ttg_h($flash) ?>
      <?php if ($manageLink !== ''): ?><p style="margin:.5rem 0 0"><?= ttg_h($T('manage_hint')) ?><br><a href="<?= ttg_h($manageLink) ?>"><code>https://timetravellersguild.com<?= ttg_h($manageLink) ?></code></a></p><?php endif; ?>
    </div>
  <?php endif; ?>

  <?php if ($booking && $session): ?>
    <section class="manage" aria-label="<?= ttg_h($T('your_booking')) ?>">
      <h2 class="sec"><?= ttg_h($T('your_booking')) ?></h2>
      <p><?= ttg_h($booking['name']) ?> · <?= ttg_h($booking['email']) ?><?= $booking['cancelled_at'] ? ' · ' . ttg_h($T('cancelled')) : '' ?></p>
      <?= $card($session, true) ?>
      <?php if (!$booking['cancelled_at']): ?>
        <form method="post"><input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>"><input type="hidden" name="manage" value="<?= ttg_h($manageToken) ?>"><input type="hidden" name="lang" value="<?= ttg_h($lang) ?>"><button class="quiet" name="do" value="cancel"><?= ttg_h($T('cancel')) ?></button></form>
      <?php endif; ?>
      <form method="post"><input type="hidden" name="csrf" value="<?= ttg_h($csrf) ?>"><input type="hidden" name="manage" value="<?= ttg_h($manageToken) ?>"><input type="hidden" name="lang" value="<?= ttg_h($lang) ?>"><button class="quiet" name="do" value="delete"><?= ttg_h($T('delete')) ?></button></form>
    </section>
  <?php elseif ($session): ?>
    <?= $card($session, true) ?>
    <h2 class="sec"><?= ttg_h($T('all')) ?></h2>
    <?php foreach ($sessions as $s) if ($s['slug'] !== $session['slug']) echo $card($s, false); ?>
  <?php elseif ($manageToken === ''): ?>
    <p class="intro"><?= ttg_h($T('intro')) ?></p>
    <?php if ($next): ?>
      <h2 class="sec"><?= ttg_h($T('next')) ?></h2>
      <?= $card($next, true) ?>
    <?php endif; ?>
    <h2 class="sec"><?= ttg_h($T('all')) ?></h2>
    <?php foreach ($sessions as $s) if (!$next || $s['slug'] !== $next['slug']) echo $card($s, false); ?>
  <?php endif; ?>

  <nav class="foot" aria-label="Guild">
    <a href="/film/"><?= ttg_h($T('film')) ?></a>
    <a href="/lodge/"><?= ttg_h($T('ask_jack')) ?></a>
    <a href="/privacy/#fieldoffice"><?= ttg_h($T('privacy')) ?></a>
  </nav>
  <?php if ($lang === 'cy'): ?><p class="draft"><?= ttg_h($T('welsh_draft')) ?></p><?php endif; ?>
</main>
<?= ttg_html_visit_tracker() ?>
</body>
</html>
