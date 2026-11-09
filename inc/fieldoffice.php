<?php
declare(strict_types=1);

/**
 * The Cardiff Field Office: "If Thursday Fails", six public sessions.
 *
 * One small SQLite store (storage/fieldoffice/, denied to the web) holds four things, kept apart on purpose:
 *   sessions      the public record (what the page and Jack both read) plus staff-only fields
 *   quotes        what a location supplier sends through their own link; they never see participants
 *   reservations  a place at one session; independent of any Ledger contribution or Guild account
 *   changes       every status change, so "Moved" always says what moved and when
 *
 * Status runs proposed -> confirmed -> (moved | cancelled). "Confirmed" can only be published once funding is
 * recorded as approved, the venue is booked, and the date and venue are set. A move needs the replacement
 * venue and an explicit instruction about the original room, and every live booking is told.
 *
 * Contributed material and permissions (the Ledger) are deliberately not here yet: a booking never depends on them.
 */

require_once __DIR__ . '/network.php';
require_once __DIR__ . '/graph.php';

const TTG_FO_STATUSES = ['proposed', 'confirmed', 'moved', 'cancelled'];
const TTG_FO_MODES = ['both', 'reserve', 'dropin'];
const TTG_FO_KEEP_DAYS = 90; // bookings are deleted this long after their session

function ttg_fo_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $dir = dirname(__DIR__) . '/storage/fieldoffice';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    $pdo = new PDO('sqlite:' . $dir . '/fieldoffice.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_TIMEOUT => 5,
    ]);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, number INTEGER NOT NULL,
  title_en TEXT NOT NULL DEFAULT '', title_cy TEXT NOT NULL DEFAULT '',
  starts_at TEXT, ends_at TEXT, status TEXT NOT NULL DEFAULT 'proposed', mode TEXT NOT NULL DEFAULT 'both', capacity INTEGER,
  venue_name TEXT NOT NULL DEFAULT '', venue_address TEXT NOT NULL DEFAULT '',
  arrival_en TEXT NOT NULL DEFAULT '', arrival_cy TEXT NOT NULL DEFAULT '',
  access_en TEXT NOT NULL DEFAULT '', access_cy TEXT NOT NULL DEFAULT '',
  original_venue TEXT NOT NULL DEFAULT '', original_note_en TEXT NOT NULL DEFAULT '', original_note_cy TEXT NOT NULL DEFAULT '',
  funding TEXT NOT NULL DEFAULT 'awaiting', booking TEXT NOT NULL DEFAULT 'none',
  keyholder TEXT NOT NULL DEFAULT '', fallback TEXT NOT NULL DEFAULT '', staff_notes TEXT NOT NULL DEFAULT '',
  supplier_token TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  at TEXT NOT NULL, supplier TEXT NOT NULL, amount TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', access_details TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL, email TEXT NOT NULL, access_needs TEXT NOT NULL DEFAULT '', lang TEXT NOT NULL DEFAULT 'en',
  token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL, cancelled_at TEXT
);
CREATE TABLE IF NOT EXISTS changes (
  id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  at TEXT NOT NULL, status TEXT NOT NULL, message_en TEXT NOT NULL DEFAULT '', message_cy TEXT NOT NULL DEFAULT '', by_whom TEXT NOT NULL DEFAULT ''
);
SQL);
    // Six Thursdays, proposed, no dates or rooms until staff set them.
    if ((int) $pdo->query('SELECT COUNT(*) FROM sessions')->fetchColumn() === 0) {
        $ins = $pdo->prepare('INSERT INTO sessions (slug, number, title_en, title_cy, updated_at) VALUES (?, ?, ?, ?, ?)');
        for ($i = 1; $i <= 6; $i++) $ins->execute(['thursday-' . $i, $i, 'Thursday ' . $i, 'Dydd Iau ' . $i, gmdate('c')]);
    }
    return $pdo;
}

function ttg_fo_token(): string { return rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '='); }

/* ---------------------------------------------------------------- language */

function ttg_fo_lang(): string
{
    $l = (string) ($_GET['lang'] ?? $_POST['lang'] ?? $_COOKIE['ttg_fo_lang'] ?? 'en');
    $l = $l === 'cy' ? 'cy' : 'en';
    if (isset($_GET['lang']) && !headers_sent()) setcookie('ttg_fo_lang', $l, ['expires' => time() + 31536000, 'path' => '/field-office', 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
    return $l;
}

/** UI strings. The Welsh is a working draft and needs a translator's check before the sessions are promoted. */
function ttg_fo_t(string $key, string $lang): string
{
    static $s = [
        'programme' => ['If Thursday Fails', 'Os Bydd Dydd Iau’n Methu'],
        'office' => ['Cardiff Field Office', 'Swyddfa Maes Caerdydd'],
        'intro' => ['Six Thursday sessions at the Time Travellers Guild’s Cardiff Field Office. Come to one or all six. This page always carries the latest about the room, so keep the link.',
                    'Chwe sesiwn ar ddydd Iau yn Swyddfa Maes Caerdydd Urdd y Teithwyr Amser. Dewch i un neu i’r chwech. Mae’r dudalen hon bob amser yn dangos y newyddion diweddaraf am yr ystafell, felly cadwch y ddolen.'],
        'next' => ['Next session', 'Y sesiwn nesaf'],
        'all' => ['All sessions', 'Pob sesiwn'],
        'proposed' => ['Proposed · venue pending', 'Arfaethedig · lleoliad i’w gadarnhau'],
        'confirmed' => ['Confirmed', 'Wedi’i gadarnhau'],
        'moved' => ['Moved', 'Wedi symud'],
        'cancelled' => ['Cancelled', 'Wedi’i ganslo'],
        'date_tbc' => ['Date to be confirmed', 'Dyddiad i’w gadarnhau'],
        'venue_tbc' => ['The room is not confirmed yet. We will update this page, and email you if you have reserved a place.', 'Nid yw’r ystafell wedi’i chadarnhau eto. Byddwn yn diweddaru’r dudalen hon, ac yn anfon e-bost atoch os ydych wedi cadw lle.'],
        'where' => ['Where', 'Ble'],
        'getting_in' => ['Getting in', 'Mynd i mewn'],
        'access' => ['Access', 'Hygyrchedd'],
        'not_original' => ['Do not go to the original room', 'Peidiwch â mynd i’r ystafell wreiddiol'],
        'reserve_or_drop' => ['Reserve a place or drop in. A reservation is not required.', 'Cadwch le neu galwch heibio. Nid oes rhaid cadw lle.'],
        'reserve_only' => ['Please reserve a place.', 'Cadwch le, os gwelwch yn dda.'],
        'drop_only' => ['Drop in. No reservation needed.', 'Galwch heibio. Nid oes angen cadw lle.'],
        'full' => ['All reserved places are taken.', 'Mae pob lle wedi’i gadw.'],
        'reserve' => ['Reserve a place', 'Cadw lle'],
        'name' => ['Your name', 'Eich enw'],
        'email' => ['Email, for updates about this session', 'E-bost, ar gyfer newyddion am y sesiwn hon'],
        'needs' => ['Anything we should know to make the session work for you (optional, seen only by the host)', 'Unrhyw beth y dylem ei wybod er mwyn i’r sesiwn weithio i chi (dewisol, dim ond y gwesteiwr fydd yn ei weld)'],
        'reserve_note' => ['A place does not ask you to share a story or join the Guild. We use your email only for this session.', 'Nid yw cadw lle yn gofyn i chi rannu stori nac ymuno â’r Urdd. Dim ond ar gyfer y sesiwn hon y byddwn yn defnyddio’ch e-bost.'],
        'reserved' => ['Your place is reserved', 'Mae’ch lle wedi’i gadw'],
        'manage_hint' => ['Keep this link to see your booking, cancel it, or delete your details:', 'Cadwch y ddolen hon i weld eich archeb, ei chanslo, neu ddileu eich manylion:'],
        'your_booking' => ['Your booking', 'Eich archeb'],
        'cancel' => ['Cancel my place', 'Canslo fy lle'],
        'delete' => ['Cancel and delete my details', 'Canslo a dileu fy manylion'],
        'cancelled_place' => ['Your place is cancelled.', 'Mae’ch lle wedi’i ganslo.'],
        'deleted' => ['Your booking and details have been deleted.', 'Mae’ch archeb a’ch manylion wedi’u dileu.'],
        'not_found' => ['That booking link is not valid.', 'Nid yw’r ddolen archebu honno’n ddilys.'],
        'updates' => ['Updates', 'Newyddion'],
        'error' => ['Something went wrong. Please try again.', 'Aeth rhywbeth o’i le. Rhowch gynnig arall arni.'],
        'need_name_email' => ['Please give a name and a valid email.', 'Rhowch enw a chyfeiriad e-bost dilys.'],
        'already' => ['That email already has a place at this session.', 'Mae gan y cyfeiriad e-bost hwnnw le yn y sesiwn hon yn barod.'],
        'cannot_reserve' => ['Places cannot be reserved for this session.', 'Ni ellir cadw lle yn y sesiwn hon.'],
        'privacy' => ['How we handle your details', 'Sut rydym yn trin eich manylion'],
        'welsh_draft' => ['', 'Drafft yw’r Gymraeg ar y dudalen hon, i’w gwirio gan gyfieithydd.'],
        'film' => ['The Film', 'Y Ffilm'],
        'ask_jack' => ['Ask Jack', 'Gofyn i Jack'],
        'switch' => ['Cymraeg', 'English'],
    ];
    $pair = $s[$key] ?? [$key, $key];
    return $lang === 'cy' ? $pair[1] : $pair[0];
}

function ttg_fo_date(?string $iso, string $lang, bool $withTime = true): string
{
    if (!$iso || !preg_match('/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/', $iso, $m)) return '';
    $months = $lang === 'cy'
        ? ['Ionawr', 'Chwefror', 'Mawrth', 'Ebrill', 'Mai', 'Mehefin', 'Gorffennaf', 'Awst', 'Medi', 'Hydref', 'Tachwedd', 'Rhagfyr']
        : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    $days = $lang === 'cy' ? ['Dydd Llun', 'Dydd Mawrth', 'Dydd Mercher', 'Dydd Iau', 'Dydd Gwener', 'Dydd Sadwrn', 'Dydd Sul'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    $dow = (int) (new DateTimeImmutable(sprintf('%s-%s-%s', $m[1], $m[2], $m[3])))->format('N') - 1;
    $out = $days[$dow] . ' ' . (int) $m[3] . ' ' . $months[(int) $m[2] - 1] . ' ' . $m[1];
    if ($withTime && isset($m[4]) && $m[4] !== '') $out .= ', ' . $m[4] . ':' . $m[5];
    return $out;
}

/* ---------------------------------------------------------------- sessions */

function ttg_fo_sessions(): array
{
    return ttg_fo_db()->query('SELECT * FROM sessions ORDER BY number')->fetchAll();
}

function ttg_fo_session(string $slug): ?array
{
    $q = ttg_fo_db()->prepare('SELECT * FROM sessions WHERE slug = ?');
    $q->execute([$slug]);
    return $q->fetch() ?: null;
}

function ttg_fo_reserved_count(int $sessionId): int
{
    $q = ttg_fo_db()->prepare('SELECT COUNT(*) FROM reservations WHERE session_id = ? AND cancelled_at IS NULL');
    $q->execute([$sessionId]);
    return (int) $q->fetchColumn();
}

/** The next session that has not finished and is not cancelled; otherwise the first not cancelled. */
function ttg_fo_next(array $sessions): ?array
{
    $now = (new DateTimeImmutable('now', new DateTimeZone('Europe/London')))->format('Y-m-d\TH:i');
    foreach ($sessions as $s) {
        if ($s['status'] === 'cancelled') continue;
        $end = $s['ends_at'] ?: $s['starts_at'];
        if ($end === null || $end === '' || $end >= $now) return $s;
    }
    return null;
}

/**
 * The public face of a session: exactly what the page shows and what Jack may say. Never staff fields,
 * never reservations, only a count of places left.
 */
function ttg_fo_public(array $s, string $lang = 'en'): array
{
    $cy = $lang === 'cy';
    $left = null;
    if ($s['capacity'] !== null && $s['capacity'] !== '' && $s['mode'] !== 'dropin') $left = max(0, (int) $s['capacity'] - ttg_fo_reserved_count((int) $s['id']));
    $q = ttg_fo_db()->prepare('SELECT at, status, message_en, message_cy FROM changes WHERE session_id = ? ORDER BY at DESC LIMIT 5');
    $q->execute([(int) $s['id']]);
    return array_filter([
        'slug' => $s['slug'],
        'number' => (int) $s['number'],
        'title' => $cy && $s['title_cy'] !== '' ? $s['title_cy'] : $s['title_en'],
        'link' => 'https://timetravellersguild.com/field-office/' . $s['slug'] . '/',
        'status' => $s['status'],
        'status_label' => ttg_fo_t($s['status'], $lang),
        'starts_at' => $s['starts_at'] ?: null,
        'ends_at' => $s['ends_at'] ?: null,
        'when' => ttg_fo_date($s['starts_at'], $lang) ?: ttg_fo_t('date_tbc', $lang),
        'venue' => $s['status'] === 'proposed' ? null : ($s['venue_name'] ?: null),
        'address' => $s['status'] === 'proposed' ? null : ($s['venue_address'] ?: null),
        'getting_in' => $s['status'] === 'proposed' ? null : (($cy && $s['arrival_cy'] !== '' ? $s['arrival_cy'] : $s['arrival_en']) ?: null),
        'access' => ($cy && $s['access_cy'] !== '' ? $s['access_cy'] : $s['access_en']) ?: null,
        'original_venue' => $s['status'] === 'moved' ? ($s['original_venue'] ?: null) : null,
        'original_instruction' => $s['status'] === 'moved' ? (($cy && $s['original_note_cy'] !== '' ? $s['original_note_cy'] : $s['original_note_en']) ?: null) : null,
        'how_to_come' => ttg_fo_t(['both' => 'reserve_or_drop', 'reserve' => 'reserve_only', 'dropin' => 'drop_only'][$s['mode']] ?? 'reserve_or_drop', $lang),
        'places_left' => $left,
        'updates' => array_map(static fn ($c) => ['at' => $c['at'], 'status' => $c['status'], 'note' => ($cy && $c['message_cy'] !== '' ? $c['message_cy'] : $c['message_en'])], $q->fetchAll()),
        'updated_at' => $s['updated_at'],
    ], static fn ($v) => $v !== null && $v !== []);
}

/* ---------------------------------------------------------------- staff */

/** Staff: Guild keepers, plus the producer and host named in FIELD_OFFICE_STAFF_EMAILS (comma separated). */
function ttg_fo_is_staff(?array $viewer = null): bool
{
    // Test hook for the command line only (tests/field-office.php); never reachable from the web.
    if (PHP_SAPI === 'cli' && getenv('TTG_FO_TEST_STAFF') === '1') return true;
    $viewer ??= ttg_graph_viewer();
    if (ttg_guild_keeper($viewer)) return true;
    $email = strtolower(trim((string) ($viewer['email'] ?? '')));
    if ($email === '' || empty($viewer['known'])) return false;
    $allow = preg_split('/[,\s]+/', strtolower(trim(ttg_env('FIELD_OFFICE_STAFF_EMAILS', '')))) ?: [];
    return in_array($email, $allow, true);
}

const TTG_FO_EDITABLE = ['title_en', 'title_cy', 'starts_at', 'ends_at', 'mode', 'capacity', 'venue_name', 'venue_address', 'arrival_en', 'arrival_cy',
    'access_en', 'access_cy', 'funding', 'booking', 'keyholder', 'fallback', 'staff_notes'];

function ttg_fo_save(array $s, array $in): array
{
    $set = [];
    foreach (TTG_FO_EDITABLE as $f) {
        if (!array_key_exists($f, $in)) continue;
        $v = trim((string) $in[$f]);
        if ($f === 'capacity') $v = $v === '' ? null : (string) max(0, (int) $v);
        if (in_array($f, ['starts_at', 'ends_at'], true)) $v = preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $v) ? $v : null;
        if ($f === 'mode' && !in_array($v, TTG_FO_MODES, true)) $v = 'both';
        if ($f === 'funding' && !in_array($v, ['awaiting', 'approved'], true)) $v = 'awaiting';
        if ($f === 'booking' && !in_array($v, ['none', 'quoted', 'booked'], true)) $v = 'none';
        $set[$f] = $v;
    }
    if ($set === []) return $s;
    $set['updated_at'] = gmdate('c');
    $sql = 'UPDATE sessions SET ' . implode(', ', array_map(static fn ($k) => "$k = :$k", array_keys($set))) . ' WHERE id = :id';
    ttg_fo_db()->prepare($sql)->execute($set + ['id' => (int) $s['id']]);
    return ttg_fo_session($s['slug']) ?? $s;
}

/** Why a session cannot be published as Confirmed yet; empty when it can. */
function ttg_fo_confirm_blockers(array $s): array
{
    $why = [];
    if ($s['funding'] !== 'approved') $why[] = 'Written funding approval is not recorded.';
    if ($s['booking'] !== 'booked') $why[] = 'The venue booking is not recorded.';
    if (!$s['starts_at']) $why[] = 'No date and time.';
    if ($s['venue_name'] === '' || $s['venue_address'] === '') $why[] = 'No venue name and address.';
    if ($s['arrival_en'] === '') $why[] = 'No arrival details (how to get in).';
    return $why;
}

function ttg_fo_log(array $s, string $status, string $en, string $cy, string $by): void
{
    ttg_fo_db()->prepare('INSERT INTO changes (session_id, at, status, message_en, message_cy, by_whom) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([(int) $s['id'], gmdate('c'), $status, $en, $cy, $by]);
}

function ttg_fo_set_status(array $s, string $status): array
{
    ttg_fo_db()->prepare('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?')->execute([$status, gmdate('c'), (int) $s['id']]);
    return ttg_fo_session($s['slug']) ?? $s;
}

/** Move a session: the replacement venue replaces the old one, which is kept with an explicit instruction. */
function ttg_fo_move(array $s, array $in): array
{
    $orig = $s['venue_name'] !== '' ? $s['venue_name'] . ($s['venue_address'] !== '' ? ', ' . $s['venue_address'] : '') : 'the original room';
    ttg_fo_db()->prepare('UPDATE sessions SET status = ?, original_venue = ?, original_note_en = ?, original_note_cy = ?, venue_name = ?, venue_address = ?,
        arrival_en = ?, arrival_cy = ?, updated_at = ? WHERE id = ?')->execute([
        'moved', $orig, trim((string) ($in['original_note_en'] ?? '')), trim((string) ($in['original_note_cy'] ?? '')),
        trim((string) ($in['venue_name'] ?? '')), trim((string) ($in['venue_address'] ?? '')),
        trim((string) ($in['arrival_en'] ?? '')), trim((string) ($in['arrival_cy'] ?? '')), gmdate('c'), (int) $s['id'],
    ]);
    return ttg_fo_session($s['slug']) ?? $s;
}

/** Tell everyone with a live place at this session; returns how many messages were accepted for delivery. */
function ttg_fo_notify(array $s, string $subjectEn, string $subjectCy, callable $bodyFor): int
{
    $mailer = dirname(__DIR__) . '/people/inc/mail.php';
    if (!is_file($mailer)) return 0;
    require_once $mailer;
    $q = ttg_fo_db()->prepare('SELECT * FROM reservations WHERE session_id = ? AND cancelled_at IS NULL');
    $q->execute([(int) $s['id']]);
    $sent = 0;
    foreach ($q->fetchAll() as $r) {
        $cy = $r['lang'] === 'cy';
        if (ttg_send_mail($r['email'], $cy ? $subjectCy : $subjectEn, $bodyFor($r, $cy ? 'cy' : 'en'))) $sent++;
    }
    return $sent;
}

/** Plain-text message describing the session as it now stands, in one language, with the person's manage link. */
function ttg_fo_mail_body(array $s, array $r, string $lang, string $lead): string
{
    $p = ttg_fo_public($s, $lang);
    $lines = [$lead, '', $p['title'] . ' · ' . $p['status_label'], $p['when']];
    if (!empty($p['venue'])) $lines[] = $p['venue'] . (!empty($p['address']) ? ', ' . $p['address'] : '');
    if (!empty($p['original_instruction'])) $lines[] = ttg_fo_t('not_original', $lang) . ': ' . ($p['original_venue'] ?? '') . '. ' . $p['original_instruction'];
    if (!empty($p['getting_in'])) $lines[] = ttg_fo_t('getting_in', $lang) . ': ' . $p['getting_in'];
    $lines[] = '';
    $lines[] = $p['link'] . ($lang === 'cy' ? '?lang=cy' : '');
    $lines[] = '';
    $lines[] = ttg_fo_t('manage_hint', $lang);
    $lines[] = 'https://timetravellersguild.com/field-office/?manage=' . $r['token'] . ($lang === 'cy' ? '&lang=cy' : '');
    return implode("\n", $lines) . "\n";
}

/** Bookings for sessions that ended more than TTG_FO_KEEP_DAYS ago are deleted. Cancelled ones go after 30 days. */
function ttg_fo_purge(): void
{
    $cut = (new DateTimeImmutable('-' . TTG_FO_KEEP_DAYS . ' days', new DateTimeZone('Europe/London')))->format('Y-m-d\TH:i');
    $db = ttg_fo_db();
    $db->prepare('DELETE FROM reservations WHERE session_id IN (SELECT id FROM sessions WHERE COALESCE(ends_at, starts_at) IS NOT NULL AND COALESCE(ends_at, starts_at) < ?)')->execute([$cut]);
    $db->prepare('DELETE FROM reservations WHERE cancelled_at IS NOT NULL AND cancelled_at < ?')->execute([gmdate('c', time() - 30 * 86400)]);
}
