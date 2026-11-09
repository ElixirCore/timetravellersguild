<?php
declare(strict_types=1);
/*
 * /field-office/desk/               staff desk: every session with its staff fields
 * /field-office/desk/?s=<slug>      one session: edit, publish Confirmed, Move, Cancel, supplier link, quotes, log
 * /field-office/desk/?sheet=<slug>  the host's printable sheet (works when the Wi-Fi does not)
 * Staff only: Guild keepers and FIELD_OFFICE_STAFF_EMAILS, signed in through /people/auth/.
 */
require_once dirname(__DIR__, 2) . '/inc/fieldoffice.php';
ttg_graph_boot_session();
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$viewer = ttg_graph_viewer();
$h = static fn ($x) => ttg_h((string) $x);
if (!ttg_fo_is_staff($viewer)) {
    http_response_code(empty($viewer['known']) ? 401 : 403);
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Field Office desk</title>'
        . '<body style="background:#070706;color:#ded7c8;font:18px Georgia,serif;padding:2rem 16px;max-width:36rem;margin:auto">'
        . '<h1 style="font-weight:400">Field Office desk</h1><p>' . (empty($viewer['known'])
            ? 'Staff only. <a style="color:#e4c583" href="/people/auth/?next=' . rawurlencode('/field-office/desk/') . '">Sign in</a> with the email the Guild has on its staff list.'
            : 'This account is not on the Field Office staff list. Ask a keeper to add your email to FIELD_OFFICE_STAFF_EMAILS.') . '</p>';
    exit;
}
$by = (string) ($viewer['name'] ?? $viewer['email'] ?? 'staff');
ttg_fo_purge();

$slug = preg_replace('/[^a-z0-9-]/', '', (string) ($_GET['s'] ?? $_POST['s'] ?? $_GET['sheet'] ?? '')) ?? '';
$s = $slug !== '' ? ttg_fo_session($slug) : null;
$msg = [];
$err = [];

/* ---------------- printable sheet ---------------- */
if (isset($_GET['sheet']) && $s) {
    $r = ttg_fo_db()->prepare('SELECT name, access_needs, created_at FROM reservations WHERE session_id = ? AND cancelled_at IS NULL ORDER BY name COLLATE NOCASE');
    $r->execute([(int) $s['id']]);
    $rows = $r->fetchAll();
    $p = ttg_fo_public($s);
    ?><!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sheet · <?= $h($s['title_en']) ?></title>
<style>body{font:15px/1.45 Georgia,serif;color:#000;background:#fff;max-width:46rem;margin:1.5rem auto;padding:0 16px}h1{font-weight:400;margin:.2rem 0}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #888;padding:.45rem .5rem;text-align:left;vertical-align:top}th{font:11px/1 monospace;letter-spacing:.1em;text-transform:uppercase}.k{font:11px monospace;letter-spacing:.14em;text-transform:uppercase;color:#555}.blank td{height:2rem}@media print{.noprint{display:none}}</style></head><body>
<p class="noprint"><a href="/field-office/desk/?s=<?= $h($s['slug']) ?>">← back to desk</a> · <button onclick="print()">Print</button></p>
<p class="k">If Thursday Fails · host's sheet · printed <?= $h(gmdate('j M Y H:i')) ?> UTC</p>
<h1><?= $h($s['title_en']) ?> · <?= $h($p['status_label']) ?></h1>
<p><?= $h($p['when']) ?><br><?= $h($s['venue_name']) ?><?= $s['venue_address'] !== '' ? ', ' . $h($s['venue_address']) : '' ?></p>
<?php if ($s['status'] === 'moved'): ?><p><b>Moved from:</b> <?= $h($s['original_venue']) ?>. <?= $h($s['original_note_en']) ?></p><?php endif; ?>
<p><b>Keyholder:</b> <?= $h($s['keyholder'] ?: '—') ?> · <b>Fallback:</b> <?= $h($s['fallback'] ?: '—') ?><br><b>Getting in:</b> <?= $h($s['arrival_en'] ?: '—') ?></p>
<table><thead><tr><th style="width:2.4rem">✓</th><th>Name</th><th>Told us (access, needs)</th></tr></thead><tbody>
<?php foreach ($rows as $row): ?><tr><td></td><td><?= $h($row['name']) ?></td><td><?= nl2br($h($row['access_needs'])) ?></td></tr><?php endforeach; ?>
<tr><th colspan="3">Walk-ins (no account needed; first name is enough)</th></tr>
<?php for ($i = 0; $i < 12; $i++): ?><tr class="blank"><td></td><td></td><td></td></tr><?php endfor; ?>
</tbody></table>
<p class="k"><?= count($rows) ?> reserved<?= $s['capacity'] !== null ? ' of ' . (int) $s['capacity'] : '' ?> · contains personal details: keep with the host, shred after the session</p>
</body></html><?php
    exit;
}

/* ---------------- actions ---------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $s) {
    if (!ttg_graph_csrf_ok($_POST['csrf'] ?? null)) {
        $err[] = 'The form expired. Reload and try again.';
    } else {
        $do = (string) ($_POST['do'] ?? '');
        if ($do === 'save') {
            $s = ttg_fo_save($s, $_POST);
            $msg[] = 'Saved. Staff fields never appear on the public page.';
        } elseif ($do === 'confirm') {
            $s = ttg_fo_save($s, $_POST);
            $why = ttg_fo_confirm_blockers($s);
            if ($why) {
                $err = array_merge(['Not published. Before Confirmed:'], $why);
            } else {
                $s = ttg_fo_set_status($s, 'confirmed');
                ttg_fo_log($s, 'confirmed', 'Confirmed: ' . $s['venue_name'] . '.', 'Wedi’i gadarnhau: ' . $s['venue_name'] . '.', $by);
                $n = ttg_fo_notify($s, 'Confirmed · ' . $s['title_en'] . ' · If Thursday Fails', 'Wedi’i gadarnhau · ' . ($s['title_cy'] ?: $s['title_en']),
                    static fn ($r, $l) => ttg_fo_mail_body($s, $r, $l, $l === 'cy' ? 'Mae’r sesiwn wedi’i chadarnhau.' : 'Your session is confirmed.'));
                $msg[] = "Published as Confirmed. $n booking email(s) sent.";
            }
        } elseif ($do === 'move') {
            $need = ['venue_name' => 'replacement venue', 'venue_address' => 'replacement address', 'original_note_en' => 'instruction about the original room'];
            $missing = array_values(array_filter($need, static fn ($k) => trim((string) ($_POST[$k] ?? '')) === '', ARRAY_FILTER_USE_KEY));
            if ($missing) {
                $err[] = 'Not moved. Still needed: ' . implode(', ', $missing) . '.';
            } else {
                $s = ttg_fo_move($s, $_POST);
                $en = trim((string) ($_POST['message_en'] ?? '')) ?: 'Moved to ' . $s['venue_name'] . '.';
                $cy = trim((string) ($_POST['message_cy'] ?? '')) ?: 'Wedi symud i ' . $s['venue_name'] . '.';
                ttg_fo_log($s, 'moved', $en, $cy, $by);
                $n = ttg_fo_notify($s, 'Moved · ' . $s['title_en'] . ' · If Thursday Fails', 'Wedi symud · ' . ($s['title_cy'] ?: $s['title_en']),
                    static fn ($r, $l) => ttg_fo_mail_body($s, $r, $l, $l === 'cy' ? $cy : $en));
                $msg[] = "Moved. The public page now shows Moved, the new room and the instruction about the old one. $n booking email(s) sent.";
            }
        } elseif ($do === 'cancel_session') {
            $en = trim((string) ($_POST['message_en'] ?? '')) ?: 'This session is cancelled.';
            $cy = trim((string) ($_POST['message_cy'] ?? '')) ?: 'Mae’r sesiwn hon wedi’i chanslo.';
            $s = ttg_fo_set_status($s, 'cancelled');
            ttg_fo_log($s, 'cancelled', $en, $cy, $by);
            $n = ttg_fo_notify($s, 'Cancelled · ' . $s['title_en'] . ' · If Thursday Fails', 'Wedi’i ganslo · ' . ($s['title_cy'] ?: $s['title_en']),
                static fn ($r, $l) => ttg_fo_mail_body($s, $r, $l, $l === 'cy' ? $cy : $en));
            $msg[] = "Cancelled. $n booking email(s) sent.";
        } elseif ($do === 'reopen') {
            $s = ttg_fo_set_status($s, 'proposed');
            ttg_fo_log($s, 'proposed', 'Back to proposed: venue pending.', 'Yn ôl i arfaethedig: lleoliad i’w gadarnhau.', $by);
            $msg[] = 'Set back to Proposed · venue pending. Nobody was emailed.';
        } elseif ($do === 'supplier_link') {
            ttg_fo_db()->prepare('UPDATE sessions SET supplier_token = ? WHERE id = ?')->execute([ttg_fo_token(), (int) $s['id']]);
            $s = ttg_fo_session($s['slug']);
            $msg[] = 'New supplier link made. Any earlier link for this session no longer works.';
        } elseif ($do === 'supplier_revoke') {
            ttg_fo_db()->prepare('UPDATE sessions SET supplier_token = NULL WHERE id = ?')->execute([(int) $s['id']]);
            $s = ttg_fo_session($s['slug']);
            $msg[] = 'Supplier link withdrawn.';
        }
    }
}

$csrf = ttg_graph_csrf();
$sessions = ttg_fo_sessions();
$count = static fn (array $x) => ttg_fo_reserved_count((int) $x['id']);
$field = static function (string $name, string $label, $value, string $type = 'text', string $hint = '') use ($h): string {
    $v = $h($value ?? '');
    $in = $type === 'area' ? "<textarea name=\"$name\" rows=\"3\">$v</textarea>" : "<input name=\"$name\" type=\"$type\" value=\"$v\">";
    return "<label><span>$label</span>$in" . ($hint !== '' ? "<small>$hint</small>" : '') . '</label>';
};
$select = static function (string $name, string $label, string $value, array $opts) use ($h): string {
    $o = '';
    foreach ($opts as $k => $l) $o .= '<option value="' . $h($k) . '"' . ($k === $value ? ' selected' : '') . '>' . $h($l) . '</option>';
    return "<label><span>$label</span><select name=\"$name\">$o</select></label>";
};
?><!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title><?= $s ? $h($s['title_en']) . ' · ' : '' ?>Field Office desk — The Time Travellers Guild</title>
<style>
:root{--ink:#0b0b0a;--rule:#2b2720;--b:#c9a961;--bd:#7d6838;--p:#ded7c8;--dim:#a39b8d;--w:#f4eede;--red:#e0705c;--green:#9ccf9c}
*{box-sizing:border-box}html,body{margin:0;background:var(--ink);color:var(--p);font:16px/1.5 Georgia,serif}
main{max-width:64rem;margin:0 auto;padding:1.5rem 16px 4rem}a{color:var(--b)}
h1{font-weight:400;font-size:1.9rem;margin:.2rem 0 1rem;color:var(--w)}h2{font:600 .72rem/1 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--bd);margin:2rem 0 .7rem}
.k{font:11px ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--b);margin:0}
.ok,.no{border:1px solid;padding:.7rem .9rem;margin:.8rem 0}.ok{border-color:var(--green);color:var(--green)}.no{border-color:var(--red);color:var(--red)}.no p,.ok p{margin:.15rem 0}
.wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:48rem}th,td{text-align:left;padding:.5rem .55rem;border-bottom:1px solid var(--rule);vertical-align:top}
th{font:600 10px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--bd)}
.st{font:11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}.st.confirmed{color:var(--green)}.st.moved,.st.cancelled{color:var(--red)}
form.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.8rem 1rem;border:1px solid var(--rule);padding:1rem}
label{display:block}label span{display:block;font:11px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:.25rem}
label small{display:block;color:var(--dim);font-size:.8rem;margin-top:.2rem}
input,textarea,select{width:100%;background:#15130f;color:var(--w);border:1px solid #3d3628;padding:.5rem .55rem;font:15px Georgia,serif}
.full{grid-column:1/-1}.staff{border-left:3px solid var(--bd);padding-left:.8rem}
button{background:var(--b);color:#1b1a17;border:0;font:700 12px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;padding:.65rem 1rem;cursor:pointer;min-height:2.5rem}
button.quiet{background:none;color:var(--b);border:1px solid var(--bd)}button.warn{background:var(--red)}
.row{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}
code{word-break:break-all;color:var(--w)}ol.log{list-style:none;padding:0;margin:0}ol.log li{border-bottom:1px solid var(--rule);padding:.4rem 0}
input:focus-visible,textarea:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--b);outline-offset:2px}
</style>
</head>
<body>
<main>
<p class="k">Cardiff Field Office · staff desk · signed in as <?= $h($by) ?></p>
<?php foreach ([['ok', $msg], ['no', $err]] as [$cls, $list]) if ($list) echo '<div class="' . $cls . '" role="status">' . implode('', array_map(static fn ($m) => '<p>' . $h($m) . '</p>', $list)) . '</div>'; ?>

<?php if (!$s): ?>
  <h1>If Thursday Fails</h1>
  <p>Public page: <a href="/field-office/">/field-office/</a> · what Jack reads: <a href="/field-office/?json">/field-office/?json</a></p>
  <div class="wrap"><table>
    <thead><tr><th>#</th><th>When</th><th>Public status</th><th>Venue</th><th>Funding</th><th>Booking</th><th>Places</th><th>Keyholder</th><th>Fallback</th></tr></thead>
    <tbody>
    <?php foreach ($sessions as $x): ?>
      <tr>
        <td><a href="?s=<?= $h($x['slug']) ?>"><?= $h($x['title_en']) ?></a></td>
        <td><?= $h(ttg_fo_date($x['starts_at'], 'en') ?: 'not set') ?></td>
        <td class="st <?= $h($x['status']) ?>"><?= $h(ttg_fo_t($x['status'], 'en')) ?></td>
        <td><?= $h($x['venue_name'] ?: '—') ?></td>
        <td><?= $h($x['funding']) ?></td>
        <td><?= $h($x['booking']) ?></td>
        <td><?= $count($x) ?><?= $x['capacity'] !== null ? ' / ' . (int) $x['capacity'] : '' ?></td>
        <td><?= $h($x['keyholder'] ?: '—') ?></td>
        <td><?= $h($x['fallback'] ?: '—') ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <p style="color:var(--dim);font-size:.9rem">Bookings are deleted <?= TTG_FO_KEEP_DAYS ?> days after their session; cancelled ones after 30 days.</p>
<?php else:
  $p = ttg_fo_public($s);
  $why = ttg_fo_confirm_blockers($s);
  $quotes = ttg_fo_db()->prepare('SELECT * FROM quotes WHERE session_id = ? ORDER BY at DESC');
  $quotes->execute([(int) $s['id']]);
  $log = ttg_fo_db()->prepare('SELECT * FROM changes WHERE session_id = ? ORDER BY at DESC');
  $log->execute([(int) $s['id']]);
  $hidden = '<input type="hidden" name="csrf" value="' . $h($csrf) . '"><input type="hidden" name="s" value="' . $h($s['slug']) . '">';
?>
  <p><a href="./">← all sessions</a> · <a href="/field-office/<?= $h($s['slug']) ?>/">public page</a> · <a href="?sheet=<?= $h($s['slug']) ?>">printable sheet (<?= $count($s) ?> booked)</a></p>
  <h1><?= $h($s['title_en']) ?> <span class="st <?= $h($s['status']) ?>" style="font-size:.9rem"><?= $h($p['status_label']) ?></span></h1>

  <h2>Session record</h2>
  <form class="grid" method="post"><?= $hidden ?>
    <?= $field('title_en', 'Title (English)', $s['title_en']) ?>
    <?= $field('title_cy', 'Title (Welsh)', $s['title_cy']) ?>
    <?= $field('starts_at', 'Starts', $s['starts_at'], 'datetime-local', 'UK time') ?>
    <?= $field('ends_at', 'Ends', $s['ends_at'], 'datetime-local') ?>
    <?= $select('mode', 'How people come', $s['mode'], ['both' => 'Reserve or drop in', 'reserve' => 'Reserve only', 'dropin' => 'Drop in only']) ?>
    <?= $field('capacity', 'Reserved places (blank = no limit)', $s['capacity'], 'number') ?>
    <?= $field('venue_name', 'Venue', $s['venue_name'], 'text', $s['status'] === 'proposed' ? 'Hidden from the public until Confirmed.' : '') ?>
    <?= $field('venue_address', 'Address', $s['venue_address'], 'area') ?>
    <?= $field('arrival_en', 'Getting in (English)', $s['arrival_en'], 'area') ?>
    <?= $field('arrival_cy', 'Getting in (Welsh)', $s['arrival_cy'], 'area') ?>
    <?= $field('access_en', 'Access information (English)', $s['access_en'], 'area', 'Shown publicly at every stage.') ?>
    <?= $field('access_cy', 'Access information (Welsh)', $s['access_cy'], 'area') ?>
    <div class="full staff"><p class="k" style="color:var(--bd)">Staff only · never public</p></div>
    <?= $select('funding', 'Funding', $s['funding'], ['awaiting' => 'Awaiting written approval', 'approved' => 'Written approval received']) ?>
    <?= $select('booking', 'Venue booking', $s['booking'], ['none' => 'Not booked', 'quoted' => 'Quote received', 'booked' => 'Booked']) ?>
    <?= $field('keyholder', 'Named keyholder', $s['keyholder']) ?>
    <?= $field('fallback', 'Fallback room', $s['fallback'], 'area') ?>
    <?= $field('staff_notes', 'Notes', $s['staff_notes'], 'area') ?>
    <div class="full row">
      <button name="do" value="save">Save</button>
      <?php if (in_array($s['status'], ['proposed', 'confirmed'], true)): ?><button class="quiet" name="do" value="confirm" title="<?= $h($why ? implode(' ', $why) : 'Ready') ?>">Save and publish Confirmed</button><?php endif; ?>
      <?php if ($s['status'] === 'proposed' && $why): ?><small style="color:var(--dim)">Confirmed needs: <?= $h(implode(' ', $why)) ?></small><?php endif; ?>
    </div>
  </form>

  <?php if ($s['status'] !== 'cancelled'): ?>
  <h2>If Thursday fails: move this session</h2>
  <form class="grid" method="post"><?= $hidden ?><input type="hidden" name="do" value="move">
    <p class="full" style="margin:0;color:var(--dim)">The public page switches to <b>Moved</b>, shows the new room and your instruction about <?= $h($s['venue_name'] ?: 'the original room') ?>, and every booking is emailed. Jack reads the same record.</p>
    <?= $field('venue_name', 'Replacement venue', $s['fallback'] !== '' && $s['status'] !== 'moved' ? strtok($s['fallback'], "\n") : '') ?>
    <?= $field('venue_address', 'Replacement address', '', 'area') ?>
    <?= $field('arrival_en', 'Getting in (English)', '', 'area') ?>
    <?= $field('arrival_cy', 'Getting in (Welsh)', '', 'area') ?>
    <?= $field('original_note_en', 'About the original room (English)', '', 'area', 'For example: the building is locked; nobody will be there.') ?>
    <?= $field('original_note_cy', 'About the original room (Welsh)', '', 'area') ?>
    <?= $field('message_en', 'Update line (English, optional)', '', 'text') ?>
    <?= $field('message_cy', 'Update line (Welsh, optional)', '', 'text') ?>
    <div class="full"><button class="warn">Move and tell everyone</button></div>
  </form>
  <?php endif; ?>

  <h2>Location supplier</h2>
  <form method="post" class="row"><?= $hidden ?>
    <?php if ($s['supplier_token']): ?>
      <span>Send this link to the supplier. They can add quotes and access details, and never see who booked:<br><code>https://timetravellersguild.com/field-office/quote/?t=<?= $h($s['supplier_token']) ?></code></span>
      <button class="quiet" name="do" value="supplier_link">Replace link</button><button class="quiet" name="do" value="supplier_revoke">Withdraw link</button>
    <?php else: ?>
      <button class="quiet" name="do" value="supplier_link">Make a supplier link</button>
    <?php endif; ?>
  </form>
  <?php $qs = $quotes->fetchAll(); if ($qs): ?>
    <div class="wrap"><table><thead><tr><th>Received</th><th>Supplier</th><th>Quote</th><th>Details</th><th>Access details</th></tr></thead><tbody>
    <?php foreach ($qs as $q): ?><tr><td><?= $h(substr($q['at'], 0, 16)) ?></td><td><?= $h($q['supplier']) ?></td><td><?= $h($q['amount']) ?></td><td><?= nl2br($h($q['details'])) ?></td><td><?= nl2br($h($q['access_details'])) ?></td></tr><?php endforeach; ?>
    </tbody></table></div>
  <?php else: ?><p style="color:var(--dim)">No quotes yet.</p><?php endif; ?>

  <h2>Status</h2>
  <form method="post" class="row"><?= $hidden ?>
    <?php if ($s['status'] !== 'cancelled'): ?>
      <input name="message_en" placeholder="Cancellation note (English)" style="max-width:20rem"><input name="message_cy" placeholder="Cancellation note (Welsh)" style="max-width:20rem">
      <button class="warn" name="do" value="cancel_session" onclick="return confirm('Cancel this session and email everyone booked?')">Cancel session</button>
    <?php endif; ?>
    <?php if ($s['status'] !== 'proposed'): ?><button class="quiet" name="do" value="reopen">Set back to Proposed</button><?php endif; ?>
  </form>

  <h2>Change log</h2>
  <?php $lg = $log->fetchAll(); if ($lg): ?><ol class="log"><?php foreach ($lg as $c): ?><li><span class="st <?= $h($c['status']) ?>"><?= $h($c['status']) ?></span> · <?= $h(substr($c['at'], 0, 16)) ?> UTC · <?= $h($c['by_whom']) ?> · <?= $h($c['message_en']) ?></li><?php endforeach; ?></ol>
  <?php else: ?><p style="color:var(--dim)">No changes published yet.</p><?php endif; ?>
<?php endif; ?>
</main>
</body>
</html>
