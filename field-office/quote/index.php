<?php
declare(strict_types=1);
/*
 * /field-office/quote/?t=TOKEN — a location supplier's link for one session.
 * They see what they need to quote (session, date, capacity) and can send a quote and access details.
 * They never see who has booked, their access needs, or any other session.
 */
require_once dirname(__DIR__, 2) . '/inc/fieldoffice.php';
ttg_graph_boot_session();
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
$h = static fn ($x) => ttg_h((string) $x);

$t = preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($_GET['t'] ?? $_POST['t'] ?? '')) ?? '';
$s = null;
if ($t !== '') {
    $q = ttg_fo_db()->prepare('SELECT * FROM sessions WHERE supplier_token = ?');
    $q->execute([$t]);
    $s = $q->fetch() ?: null;
}
$done = false;
$err = '';
if ($s && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $supplier = trim(mb_substr((string) ($_POST['supplier'] ?? ''), 0, 160));
    if (!ttg_graph_csrf_ok($_POST['csrf'] ?? null)) $err = 'The form expired. Reload and try again.';
    elseif ($supplier === '') $err = 'Please give your name or company.';
    else {
        ttg_fo_db()->prepare('INSERT INTO quotes (session_id, at, supplier, amount, details, access_details) VALUES (?, ?, ?, ?, ?, ?)')->execute([
            (int) $s['id'], gmdate('c'), $supplier, trim(mb_substr((string) ($_POST['amount'] ?? ''), 0, 80)),
            trim(mb_substr((string) ($_POST['details'] ?? ''), 0, 3000)), trim(mb_substr((string) ($_POST['access_details'] ?? ''), 0, 3000)),
        ]);
        if ($s['booking'] === 'none') ttg_fo_db()->prepare("UPDATE sessions SET booking = 'quoted', updated_at = ? WHERE id = ?")->execute([gmdate('c'), (int) $s['id']]);
        $done = true;
    }
}
if (!$s) http_response_code(404);
$csrf = ttg_graph_csrf();
?><!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Venue quote · Cardiff Field Office</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b0b0a;color:#ded7c8;font:17px/1.55 Georgia,serif}main{max-width:36rem;margin:0 auto;padding:1.8rem 16px 3rem}
h1{font-weight:400;color:#f4eede;margin:.3rem 0 1rem}.k{font:11px ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#c9a961;margin:0}
label{display:block;margin:.9rem 0 0}label span{display:block;font:11px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#a39b8d;margin-bottom:.25rem}
input,textarea{width:100%;background:#15130f;color:#f4eede;border:1px solid #3d3628;padding:.6rem;font:16px Georgia,serif}
button{margin-top:1rem;background:#c9a961;color:#1b1a17;border:0;font:700 12px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;padding:.75rem 1.1rem;cursor:pointer;min-height:2.75rem}
.ok{border:1px solid #9ccf9c;color:#9ccf9c;padding:.8rem}.no{border:1px solid #e0705c;color:#e0705c;padding:.8rem}
input:focus-visible,textarea:focus-visible,button:focus-visible{outline:2px solid #e4c583;outline-offset:2px}
</style></head><body><main>
<p class="k">Cardiff Field Office · venue quote</p>
<?php if (!$s): ?>
  <h1>This link is not active</h1><p>Ask the producer for a current link.</p>
<?php else: ?>
  <h1>If Thursday Fails · <?= $h($s['title_en']) ?></h1>
  <p><?= $h(ttg_fo_date($s['starts_at'], 'en') ?: 'Date to be agreed') ?><?= $s['capacity'] !== null ? ' · up to ' . (int) $s['capacity'] . ' people reserved, plus drop-ins' : '' ?></p>
  <?php if ($done): ?><p class="ok" role="status">Thank you. Your quote has gone to the producer. You can send another below.</p><?php endif; ?>
  <?php if ($err !== ''): ?><p class="no" role="alert"><?= $h($err) ?></p><?php endif; ?>
  <form method="post">
    <input type="hidden" name="t" value="<?= $h($t) ?>"><input type="hidden" name="csrf" value="<?= $h($csrf) ?>">
    <label><span>Your name or company</span><input name="supplier" required maxlength="160" autocomplete="organization"></label>
    <label><span>Quote (amount, and what it includes)</span><input name="amount" maxlength="80"></label>
    <label><span>Room, hours and terms</span><textarea name="details" rows="4" maxlength="3000"></textarea></label>
    <label><span>Access details (step-free route, toilets, hearing loop, quiet space, how to get in)</span><textarea name="access_details" rows="4" maxlength="3000"></textarea></label>
    <button>Send to the producer</button>
  </form>
<?php endif; ?>
</main></body></html>
