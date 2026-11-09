<?php
declare(strict_types=1);

/**
 * The Guild calendar: a member's own diary, kept beside the tree.
 *
 * Each event belongs to one signed-in member (keyed by their people email) and
 * is never shown to anyone else. Events may concern canon nodes; on the page
 * they hang in the /now tree as private leaves joined to those nodes.
 *
 * Store: SQLite outside the web root (TTG_CALENDAR_DB, default
 * ~/ttg-private/calendar/calendar.sqlite). Times are UTC seconds; the page and
 * the reminder mail speak Europe/London.
 */

require_once __DIR__ . '/env.php';

const TTG_CAL_TZ = 'Europe/London';
const TTG_CAL_MAX_EVENTS = 600;
const TTG_CAL_MAX_LINKS = 4;
const TTG_CAL_REMIND = [0 => 'At the time', 15 => '15 minutes before', 60 => '1 hour before', 1440 => '1 day before', 10080 => '1 week before'];

function ttg_cal_db(): PDO {
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    $path = ttg_env('TTG_CALENDAR_DB', dirname(__DIR__, 3) . '/ttg-private/calendar/calendar.sqlite');
    $dir = dirname($path);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA busy_timeout = 4000');
    $pdo->exec('CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT NOT NULL,
        title TEXT NOT NULL,
        starts_at INTEGER NOT NULL,
        ends_at INTEGER,
        all_day INTEGER NOT NULL DEFAULT 0,
        place TEXT NOT NULL DEFAULT \'\',
        note TEXT NOT NULL DEFAULT \'\',
        links TEXT NOT NULL DEFAULT \'[]\',
        remind_minutes INTEGER,
        remind_at INTEGER,
        reminded_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS events_owner_start ON events(owner, starts_at)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS events_due ON events(remind_at) WHERE reminded_at IS NULL');
    @chmod($path, 0600);
    return $pdo;
}

function ttg_cal_tz(): DateTimeZone {
    return new DateTimeZone(TTG_CAL_TZ);
}

/** The owner key for a viewer: their people email, or null when not signed in. */
function ttg_cal_owner(array $viewer): ?string {
    $email = strtolower(trim((string) ($viewer['email'] ?? '')));
    return !empty($viewer['known']) && filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
}

function ttg_cal_clip(string $s, int $max, bool $multiline = false): string {
    $s = str_replace("\r\n", "\n", $s);
    $s = preg_replace($multiline ? '/[^\P{C}\n]/u' : '/\p{C}/u', '', $s) ?? '';
    $s = trim($s);
    return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}

function ttg_cal_row(array $r): array {
    $r['id'] = (int) $r['id'];
    $r['starts_at'] = (int) $r['starts_at'];
    $r['ends_at'] = $r['ends_at'] !== null ? (int) $r['ends_at'] : null;
    $r['all_day'] = (bool) $r['all_day'];
    $r['remind_minutes'] = $r['remind_minutes'] !== null ? (int) $r['remind_minutes'] : null;
    $r['links'] = array_values(array_filter((array) json_decode((string) $r['links'], true), 'is_string'));
    return $r;
}

function ttg_cal_get(string $owner, int $id): ?array {
    $st = ttg_cal_db()->prepare('SELECT * FROM events WHERE id = ? AND owner = ?');
    $st->execute([$id, $owner]);
    $r = $st->fetch();
    return $r ? ttg_cal_row($r) : null;
}

/** Events overlapping [from, to). */
function ttg_cal_between(string $owner, int $from, int $to): array {
    $st = ttg_cal_db()->prepare('SELECT * FROM events WHERE owner = ? AND starts_at < CAST(? AS INTEGER) AND COALESCE(ends_at, starts_at) >= CAST(? AS INTEGER) ORDER BY starts_at, id');
    $st->execute([$owner, $to, $from]);
    return array_map('ttg_cal_row', $st->fetchAll());
}

function ttg_cal_upcoming(string $owner, int $limit = 6): array {
    $st = ttg_cal_db()->prepare('SELECT * FROM events WHERE owner = ? AND COALESCE(ends_at, starts_at) >= CAST(? AS INTEGER) ORDER BY starts_at, id LIMIT ' . max(1, $limit));
    $st->execute([$owner, time() - 3600]);
    return array_map('ttg_cal_row', $st->fetchAll());
}

/** Public canon and field nodes an event may concern: slug => title. */
function ttg_cal_linkable(array $field): array {
    $out = [];
    foreach ($field as $n) {
        if (!is_array($n) || empty($n['slug']) || !empty($n['play'])) continue;
        $out[(string) $n['slug']] = (string) ($n['title'] ?? $n['slug']);
    }
    asort($out, SORT_NATURAL | SORT_FLAG_CASE);
    return $out;
}

/** Nodes whose title is named in the text (whole words, titles of 4+ letters). */
function ttg_cal_mentions(string $text, array $linkable): array {
    $hay = ' ' . strtolower(preg_replace('/[^\p{L}\p{N}]+/u', ' ', $text) ?? '') . ' ';
    $hits = [];
    foreach ($linkable as $slug => $title) {
        $needle = trim(strtolower(preg_replace('/[^\p{L}\p{N}]+/u', ' ', $title) ?? ''));
        if (strlen($needle) < 4) continue;
        if (str_contains($hay, ' ' . $needle . ' ')) $hits[] = $slug;
    }
    return $hits;
}

/** Parse "YYYY-MM-DDTHH:MM" (or a date alone) in London time. */
function ttg_cal_parse_local(string $value, bool $dateOnly = false): ?int {
    $value = trim($value);
    $fmt = $dateOnly ? '!Y-m-d' : '!Y-m-d\TH:i';
    $d = DateTimeImmutable::createFromFormat($fmt, $dateOnly ? substr($value, 0, 10) : substr($value, 0, 16), ttg_cal_tz());
    if (!$d) return null;
    $y = (int) $d->format('Y');
    return $y >= 1900 && $y <= 2200 ? $d->getTimestamp() : null;
}

/**
 * Create or update an event from form input. Returns [ok, message, id].
 * Links are kept only if they name a linkable node; title mentions are added.
 */
function ttg_cal_save(string $owner, array $in, array $linkable): array {
    $id = (int) ($in['id'] ?? 0);
    $title = ttg_cal_clip((string) ($in['title'] ?? ''), 140);
    if ($title === '') return [false, 'An event needs a title.', 0];
    $allDay = !empty($in['all_day']);
    $starts = ttg_cal_parse_local((string) ($allDay ? ($in['date'] ?? $in['starts'] ?? '') : ($in['starts'] ?? '')), $allDay);
    if ($starts === null) return [false, 'That start time is not one the clerk can read.', 0];
    $ends = null;
    if (!$allDay && trim((string) ($in['ends'] ?? '')) !== '') {
        $ends = ttg_cal_parse_local((string) $in['ends']);
        if ($ends === null || $ends < $starts) return [false, 'The end must come after the start.', 0];
        if ($ends - $starts > 86400 * 60) return [false, 'Events can run for sixty days at most.', 0];
    }
    if ($allDay) $ends = $starts + 86399;
    $place = ttg_cal_clip((string) ($in['place'] ?? ''), 120);
    $note = ttg_cal_clip((string) ($in['note'] ?? ''), 2000, true);

    $links = [];
    foreach ((array) ($in['links'] ?? []) as $slug) {
        $slug = (string) $slug;
        if (isset($linkable[$slug]) && !in_array($slug, $links, true)) $links[] = $slug;
    }
    foreach (ttg_cal_mentions($title . ' ' . $place . ' ' . $note, $linkable) as $slug) {
        if (!in_array($slug, $links, true)) $links[] = $slug;
    }
    $links = array_slice($links, 0, TTG_CAL_MAX_LINKS);

    $remind = (string) ($in['remind'] ?? '');
    $remindMinutes = $remind !== '' && array_key_exists((int) $remind, TTG_CAL_REMIND) ? (int) $remind : null;
    $remindAt = $remindMinutes !== null ? $starts - $remindMinutes * 60 : null;
    // A reminder already in the past is not sent late.
    $reminded = $remindAt !== null && $remindAt < time() - 300 ? time() : null;

    $db = ttg_cal_db();
    $now = time();
    if ($id > 0) {
        if (!ttg_cal_get($owner, $id)) return [false, 'That event is not in your diary.', 0];
        $db->prepare('UPDATE events SET title=?, starts_at=?, ends_at=?, all_day=?, place=?, note=?, links=?, remind_minutes=?, remind_at=?, reminded_at=?, updated_at=? WHERE id=? AND owner=?')
            ->execute([$title, $starts, $ends, $allDay ? 1 : 0, $place, $note, json_encode($links), $remindMinutes, $remindAt, $reminded, $now, $id, $owner]);
        return [true, 'Amended.', $id];
    }
    $count = $db->prepare('SELECT COUNT(*) FROM events WHERE owner = ?');
    $count->execute([$owner]);
    if ((int) $count->fetchColumn() >= TTG_CAL_MAX_EVENTS) return [false, 'Your diary is full. Strike some old events first.', 0];
    $db->prepare('INSERT INTO events(owner, title, starts_at, ends_at, all_day, place, note, links, remind_minutes, remind_at, reminded_at, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([$owner, $title, $starts, $ends, $allDay ? 1 : 0, $place, $note, json_encode($links), $remindMinutes, $remindAt, $reminded, $now, $now]);
    return [true, 'Entered in your diary.', (int) $db->lastInsertId()];
}

function ttg_cal_delete(string $owner, int $id): bool {
    $st = ttg_cal_db()->prepare('DELETE FROM events WHERE id = ? AND owner = ?');
    $st->execute([$id, $owner]);
    return $st->rowCount() > 0;
}

/** Reminders now due, oldest first. */
function ttg_cal_due(int $now, int $limit = 200): array {
    $st = ttg_cal_db()->prepare('SELECT * FROM events WHERE reminded_at IS NULL AND remind_at IS NOT NULL AND remind_at <= CAST(? AS INTEGER) ORDER BY remind_at LIMIT ' . max(1, $limit));
    $st->execute([$now]);
    return array_map('ttg_cal_row', $st->fetchAll());
}

/** Claim a reminder before sending, so two runs never send it twice. */
function ttg_cal_claim(int $id, int $now): bool {
    $st = ttg_cal_db()->prepare('UPDATE events SET reminded_at = ? WHERE id = ? AND reminded_at IS NULL');
    $st->execute([$now, $id]);
    return $st->rowCount() === 1;
}

function ttg_cal_when(array $e): string {
    $tz = ttg_cal_tz();
    $s = (new DateTimeImmutable('@' . $e['starts_at']))->setTimezone($tz);
    if ($e['all_day']) return $s->format('l j F Y') . ' · all day';
    $out = $s->format('l j F Y · H:i');
    if ($e['ends_at']) {
        $en = (new DateTimeImmutable('@' . $e['ends_at']))->setTimezone($tz);
        $out .= '–' . ($en->format('Y-m-d') === $s->format('Y-m-d') ? $en->format('H:i') : $en->format('j M H:i'));
    }
    return $out;
}

function ttg_cal_href(array $e): string {
    $m = (new DateTimeImmutable('@' . $e['starts_at']))->setTimezone(ttg_cal_tz())->format('Y-m');
    return '/calendar/?m=' . $m . '#e' . $e['id'];
}

/**
 * Hang the member's events in the /now field as private leaves.
 * Each event joins the nodes it concerns; consecutive events are threaded.
 */
function ttg_cal_tree(array $field, array $edges, array $events): array {
    $known = [];
    foreach ($field as $n) if (is_array($n) && !empty($n['slug'])) $known[(string) $n['slug']] = true;
    $prev = null;
    foreach ($events as $e) {
        $slug = 'cal-' . $e['id'];
        $start = (new DateTimeImmutable('@' . $e['starts_at']))->setTimezone(ttg_cal_tz());
        $evidence = [];
        foreach ($e['links'] as $to) {
            if (!isset($known[$to])) continue;
            $edges[] = ['source' => $slug, 'target' => $to, 'relationship' => 'CONCERNS', 'confidence' => 1];
            $evidence[] = ['label' => $to, 'via' => 'CONCERNS', 'slug' => $to, 'type' => '', 'direction' => 'out'];
        }
        if ($prev) $edges[] = ['source' => $prev, 'target' => $slug, 'relationship' => 'FOLLOWED_BY', 'confidence' => 1];
        $field[] = [
            'id' => 'CAL' . $e['id'],
            'slug' => $slug,
            'title' => $e['title'],
            'type' => 'MOMENT',
            'status' => 'DIARY',
            'zone' => 'leaf',
            'importance' => 0.7,
            'observed_at' => $start->format('c'),
            'year' => (int) $start->format('Y'),
            'href' => ttg_cal_href($e),
            'open' => ttg_cal_href($e),
            'place' => $e['place'] !== '' ? $e['place'] : 'unplaced',
            'custodian' => 'you',
            'opening' => '',
            'body' => $e['note'] !== '' ? $e['note'] : ttg_cal_when($e),
            'moments' => 0,
            'unresolved' => 0,
            'remembered_by' => 0,
            'near_you' => true,
            'pending' => false,
            'diary' => true,
            'punch' => ['hash' => '', 'prev' => '', 'body_hash' => '', 'irreversible' => false],
            'why' => ['evidence' => $evidence],
            'links' => array_map(static fn(string $s): array => ['slug' => $s, 'via' => 'CONCERNS'], array_values(array_filter($e['links'], static fn($s) => isset($known[$s])))),
        ];
        $known[$slug] = true;
        $prev = $slug;
    }
    return [$field, $edges];
}
