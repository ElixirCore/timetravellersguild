<?php
declare(strict_types=1);

/** CALENDAR — enter, amend or strike a diary entry. POST, then back to the page. */

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/inc/calendar.php';

ttg_graph_boot_session();

$back = (string) ($_POST['back'] ?? '');
if (!preg_match('#^/calendar/\?m=\d{4}-\d{2}(&d=\d{4}-\d{2}-\d{2})?$#', $back)) $back = '/calendar/';

$done = static function (bool $ok, string $text, string $to, ?array $draft = null): never {
    $_SESSION['cal_flash'] = ['ok' => $ok, 'text' => $text];
    if ($draft !== null) $_SESSION['cal_draft'] = $draft;
    session_write_close();
    header('Location: ' . $to, true, 303);
    exit;
};

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /calendar/', true, 303);
    exit;
}
if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    $done(false, 'The clerk will not accept an unsigned slip. Try again.', $back);
}
$owner = ttg_cal_owner(ttg_graph_viewer());
if (!$owner) {
    $done(false, 'Sign in to keep a diary.', '/people/auth/');
}
if (!ttg_jack_rate_allow('calendar', 60)) {
    $done(false, 'That is a great many entries at once. Give the clerk a moment.', $back);
}

$action = (string) ($_POST['action'] ?? '');
if ($action === 'delete') {
    $ok = ttg_cal_delete($owner, (int) ($_POST['id'] ?? 0));
    $done($ok, $ok ? 'Struck from your diary.' : 'That entry was not in your diary.', $back);
}
if ($action === 'save') {
    $field = ttg_now_field()['nodes'] ?? [];
    $in = [
        'id' => (int) ($_POST['id'] ?? 0),
        'title' => (string) ($_POST['title'] ?? ''),
        'all_day' => !empty($_POST['all_day']),
        'starts' => (string) ($_POST['starts'] ?? ''),
        'ends' => (string) ($_POST['ends'] ?? ''),
        'date' => (string) ($_POST['date'] ?? ''),
        'place' => (string) ($_POST['place'] ?? ''),
        'note' => (string) ($_POST['note'] ?? ''),
        'links' => array_slice(array_filter((array) ($_POST['links'] ?? []), 'is_string'), 0, 2),
        'remind' => (string) ($_POST['remind'] ?? ''),
    ];
    [$ok, $text, $id] = ttg_cal_save($owner, $in, ttg_cal_linkable($field));
    if (!$ok) $done(false, $text, $back . '#slip', $in);
    $e = ttg_cal_get($owner, $id);
    $start = $e ? (new DateTimeImmutable('@' . $e['starts_at']))->setTimezone(ttg_cal_tz()) : null;
    $to = $start ? '/calendar/?m=' . $start->format('Y-m') . '&d=' . $start->format('Y-m-d') . '#e' . $id : $back;
    $done(true, $text . ($e && $e['links'] ? ' Joined to the tree.' : ''), $to);
}
$done(false, 'The clerk does not know that action.', $back);
