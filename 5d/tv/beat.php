<?php
declare(strict_types=1);

/**
 * /5d/tv/beat.php — one beat of the Keeper's show.
 *
 * Private: the keeper only (the same OfficeAuth/JackPolicy check that guards
 * /jack/office). Nothing is shared or cached across visitors: each beat is
 * made for his own session and never written to any public-readable store.
 *
 * The beat is spoken by the real /jack agentic mode: this endpoint walks the
 * Trailhead Register (lore/trailhead-register-13.json), gathers the artefacts
 * his life-recall offers (the /jack/mind mechanism), then hands the slip to
 * /now/jack with site=tv over an internal call on the Keeper's own session.
 * Jack answers through his full pipeline — character, policy, mode, life and
 * relationship — in one bounded round (tools off, output capped server-side).
 * The scene is a fixed vocabulary, validated here. The client never executes
 * returned text.
 *
 * ONE APPROVED SITTING, then dark again (the Keeper's word, 7 Nov 2026):
 * "I will pay up to £1 for a screen capable mix" — "Including your testing":
 * one sitting of five beats, no test dispatches, then the line closes itself.
 *   - no .show/enabled file          -> static preview, no model call at all
 *   - the sitting starts at his first beat (not at deploy time): TV_SITTING_SEC
 *   - at most TV_BEAT_MAX beats, TV_BEAT_GAP s apart
 *   - each beat mints a single-use permit; /now/jack consumes it under lock at
 *     the dispatch itself and charges the sitting book there, so no call to the
 *     model can go uncounted, however it is reached
 *   - a model failure (no credit, timeout, error) CLOSES the sitting: the
 *     enabled file is removed, the line stays dark until a fresh approval
 *
 * Cost proof: /now/jack refuses a tv dispatch whose whole request exceeds
 * 40,000 bytes (+512 envelope). BPE tokens never exceed UTF-8 bytes, so input
 * is at most 40,512 tokens; output+reasoning is capped at 2,500 by
 * max_output_tokens. At the official gpt-5.6 rate ($4 / $20 per 1M — the
 * gpt-5.6 alias routes to GPT-5.6 Sol; developers.openai.com/api/docs/pricing
 * and /api/docs/models/gpt-5.6-sol, 7 Nov 2026) one beat costs at most
 * 40,512 x $4/1M + 2,500 x $20/1M = $0.212, plus embeddings: recall embeds the
 * query only, text-embedding-3-small at $0.02/1M, at most 2 calls of ~500
 * tokens per beat (~$0.00002) — TV_BEAT_USD allows $0.001 for them.
 * Jack's voice is OpenAI speech, not ElevenLabs (the Keeper's word): after
 * each answered beat the line is spoken by tts-1 on the Speech endpoint
 * (deprecated but live until 6 Jan 2027; developers.openai.com/api/docs/
 * models/tts-1 and /guides/text-to-speech, 7 Nov 2026). tts-1 is priced
 * FLAT PER CHARACTER: $15.00 per 1M characters of input (OpenAI pricing,
 * via models.litellm.ai/models/tts-1, current 6 Nov 2026). The input below
 * is hard-capped at 600 characters in code, so one call can never cost more
 * than 600 x $15/1M = $0.009 — an exact bound, no duration assumption.
 * TV_VOICE_USD = $0.009 per beat, reserved in the book BEFORE the speech
 * call and held whether it answers or not. (The steerable style instruction
 * is a gpt-4o-mini-tts feature with no documented output maximum, so that
 * model is not used; tts-1 takes no instruction, voice only.)
 * (TV_BEAT_USD + TV_VOICE_USD) x TV_BEAT_MAX = 5 x $0.222 = $1.110
 * = TV_SITTING_USD, failures included: about £0.83 at 1.3357 USD/GBP
 * (7 Nov 2026), inside the approved £1 for the whole run including any
 * testing. The book's spent aggregates model AND voice charges against the
 * one ceiling. TV_SITTING_SEC is a backstop for slow rounds; the spend is
 * bounded by beats and book, not time.
 */

require_once dirname(__DIR__, 2) . '/inc/env.php';
require_once dirname(__DIR__, 2) . '/inc/graph.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackPolicy.php';
require_once dirname(__DIR__, 2) . '/app/JackOffice/OfficeAuth.php';
require_once dirname(__DIR__, 2) . '/app/AI/JackLife.php';

const TV_BEAT_GAP    = 30;    /* seconds between beats in one sitting */
const TV_BEAT_MAX    = 5;     /* beats one sitting may ask for (the approved £1 mix) */
const TV_SITTING_SEC = 1200;  /* backstop from his first beat; the mix itself runs ~10 min */
const TV_SITTING_USD = 1.110; /* the approved estimate ceiling for the sitting (£1 incl. testing and voice) */
const TV_VOICE_USD   = 0.009; /* exact maximum per spoken beat: 600 chars x $15/1M, reserved before the call */
const TV_VOICE       = 'fable'; /* documented built-in speech voice; steerable via instructions */
/* tts-1 takes no style instruction; the voice id alone carries the sound. */
const TV_BEAT_USD    = 0.213; /* worst case per attempted beat (see proof above) */
const TV_ENABLED  = __DIR__ . '/.show/enabled';   /* the Keeper's word: no file, no model calls, no spend */
const TV_BOOK     = __DIR__ . '/.show/state.json';

function tv_book_load(): ?array {
    $d = json_decode((string) @file_get_contents(TV_BOOK), true);
    return (is_array($d) && isset($d['expires'], $d['beats'], $d['spent'])) ? $d : null;
}
function tv_book_save(array $st): bool {
    return @file_put_contents(TV_BOOK, json_encode($st), LOCK_EX) !== false;
}
/* The sitting is over: the line closes and the show goes dark until a fresh approval. */
function tv_sitting_close(): void {
    @unlink(TV_BOOK);
    @unlink(TV_ENABLED);
}

@set_time_limit(240);  /* a slow model round plus one speech call */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function tv_fail(int $status, string $error): never {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $error]);
    exit;
}
function tv_away(string $note = ''): never {
    echo json_encode(['ok' => false, 'unavailable' => true,
        'text' => 'The clerk is away from the desk. The field remains.' . $note],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

ttg_graph_boot_session();

/* The show is the Keeper's own screen. */
$viewer = ttg_graph_viewer();
if (!OfficeAuth::isKeeper($viewer)) {
    tv_fail(403, 'The show is the Keeper’s own.');
}

/* A spoken beat, kept inside the web-denied .show drawer and served only to
   the Keeper's own session it was made for. Read-only: no book, no spend. */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['voice'])) {
    $vn = (int) $_GET['voice'];
    $vf = __DIR__ . '/.show/voice-' . substr(hash('sha256', (string) session_id()), 0, 12) . '-' . $vn . '.mp3';
    if ($vn < 1 || $vn > TV_BEAT_MAX || !is_file($vf)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'That beat was never spoken.';
        exit;
    }
    header('Content-Type: audio/mpeg');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . (string) filesize($vf));
    readfile($vf);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    tv_fail(405, 'POST only.');
}
if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    tv_fail(400, 'The clerk will not accept an unsigned slip.');
}

/* Disabled until the Keeper opens the line: static preview, no model call. */
if (!is_file(TV_ENABLED)) {
    echo json_encode(['ok' => true, 'fresh' => false, 'preview' => true, 'scene' => [
        'palette' => ['#6bf27a', '#e6dfcc'], 'speed' => 0.6, 'pulse' => 0.25,
        'turn' => 'xw', 'mark' => '', 'caption' => 'THE FIELD REMAINS',
    ], 'voice' => false], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/* ---------- the one sitting ---------- */
$now = time();
$st = tv_book_load();
if ($st === null) {
    /* His first beat opens the sitting: the ten minutes run from here. */
    $st = ['started' => $now, 'expires' => $now + TV_SITTING_SEC, 'beats' => 0, 'spent' => 0.0];
}
if ($now > (int) $st['expires'] || (int) $st['beats'] >= TV_BEAT_MAX || (float) $st['spent'] >= TV_SITTING_USD - TV_BEAT_USD + 0.0001) {
    error_log('tv sitting exhausted: beats ' . (int) $st['beats'] . ' spent est $' . (float) $st['spent'] . ' - closing');
    tv_sitting_close();
    tv_fail(429, 'The sitting has spent its approved beats. The show is dark until you open it again.');
}

$last = (int) ($_SESSION['tv_last_at'] ?? 0);
if ($last > 0 && $now - $last < TV_BEAT_GAP) {
    tv_fail(429, 'One beat at a time. The cube is still turning.');
}
/* A minted-but-unconsumed permit means a beat is still on the wire (the model
   may run a minute or more): do not stack another behind it. Ages out in 120s. */
if (!empty($st['minted_at']) && empty($st['used']) && $now - (int) $st['minted_at'] < 120) {
    tv_fail(429, 'A beat is already on the wire. The cube is still turning.');
}

/* ---------- the card and the artefacts on offer ---------- */
$register = json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/lore/trailhead-register-13.json'), true);
if (!is_array($register) || $register === []) {
    tv_fail(503, 'The register is not on its shelf.');
}
$cardIx = (int) ($_SESSION['tv_card_ix'] ?? 0);
if ($cardIx < 0 || $cardIx >= count($register)) $cardIx = 0;
$card = $register[$cardIx];

$prevSay = (string) ($_SESSION['tv_last_say'] ?? '');
$beatNo  = (int) $st['beats'] + 1;

$candidates = [];
try {
    foreach (JackLife::recall((string) $card['title'] . ' ' . mb_substr((string) $card['body'], 0, 300), 3) as $hit) {
        foreach ((array) ($hit['memory']['evidence'] ?? []) as $evId) {
            $ev = JackLife::evidence((string) $evId);
            if ($ev && !empty($ev['image'])) $candidates[(string) $ev['id']] = $ev;
        }
    }
} catch (Throwable $e) { error_log('tv recall: ' . $e->getMessage()); }
$offer = '';
foreach (array_slice($candidates, 0, 4) as $ev) {
    $offer .= '- ' . $ev['id'] . ' — ' . mb_substr((string) ($ev['caption'] ?? ''), 0, 140)
        . ' (' . ($ev['year'] ?? '') . ', ' . ($ev['licence'] ?? '') . ")\n";
}

$slip = "BEAT {$beatNo} — REGISTER CARD {$card['id']}/" . count($register) . " · {$card['title']} ({$card['kind']})\n"
    . $card['stamp'] . "\n" . $card['body'] . "\n" . $card['footer']
    . "\n\nYOUR PREVIOUS LINE: " . ($prevSay !== '' ? mb_substr($prevSay, 0, 400) : '(this card has just opened)')
    . "\n\nARTEFACTS YOUR MEMORY OFFERS:\n" . ($offer !== '' ? $offer : '(none recalled)');
if (mb_strlen($slip) > 1900) $slip = mb_substr($slip, 0, 1900);  /* actual bound: TALK_CHARS is 2000 */

/* ---------- mint this beat's single-use permit ---------- */
$permit = bin2hex(random_bytes(16));
$st['permit'] = hash('sha256', $permit);
$st['used'] = false;
$st['minted_at'] = $now;
if (!tv_book_save($st)) {
    error_log('tv sitting book unwritable - closing');
    tv_sitting_close();
    tv_fail(503, 'The sitting book cannot be kept; the show has gone dark.');
}
if ((int) $st['beats'] === 0 && empty($st['started_logged'])) {
    $st['started_logged'] = true;
    tv_book_save($st);
    foreach (glob(__DIR__ . '/.show/voice-*.mp3') ?: [] as $oldVoice) @unlink($oldVoice);
    error_log('tv sitting opened (first beat minted)');
}

/* ---------- hand the beat to the real Jack ---------- */
$csrf   = ttg_graph_csrf();
/* Identity travels in TWO cookies: the PHP session (CSRF, sitting) and the
   people cookie (who he is). /now/jack sees the Keeper only if BOTH arrive. */
$cookie = session_name() . '=' . session_id();
$people = (string) ($_COOKIE['ttg_people_session'] ?? '');
if ($people !== '') $cookie .= '; ttg_people_session=' . rawurlencode($people);
session_write_close();  /* release the lock so /now/jack can open this same session */

$ctx = stream_context_create(['http' => [
    'method'        => 'POST',
    'header'        => "Content-Type: application/x-www-form-urlencoded\r\nCookie: " . $cookie,
    'content'       => http_build_query(['csrf' => $csrf, 'intent' => 'ask', 'site' => 'tv', 'permit' => $permit, 'q' => $slip]),
    'timeout'       => 150,
    'ignore_errors' => true,
]]);
$raw = @file_get_contents('https://timetravellersguild.com/now/jack', false, $ctx);
$statusLine = (string) ($http_response_header[0] ?? '');
$httpStatus = preg_match('/\s(\d{3})\s/', $statusLine, $sm) ? (int) $sm[1] : 0;

session_start();
$_SESSION['tv_last_at'] = $now;

$resp = is_string($raw) ? json_decode($raw, true) : null;

/* The dispatch itself keeps the book. Here only the consequences:
   - too heavy: no call was made, nothing was charged, the beat is unspent
   - refused (403): nothing was spent; close ONLY when the book itself proves
     the sitting is over - a lost race or a gate fault keeps the line
   - unavailable with HTTP 200: the model itself failed (credit, timeout,
     error) - the approved stop: close the line
   - anything else is a relay/config fault: no dispatch, no spend, stay open */
if ($httpStatus === 413) {
    error_log('tv beat too heavy (413), nothing spent');
    tv_fail(413, 'The slip grew too heavy for one sitting. Nothing was spent.');
}
if ($httpStatus === 403) {
    $book = tv_book_load();
    $over = $book === null || time() > (int) $book['expires']
        || (int) $book['beats'] >= TV_BEAT_MAX
        || (float) $book['spent'] >= TV_SITTING_USD - TV_BEAT_USD + 0.0001;
    error_log('tv beat refused (403): ' . mb_substr((string) $raw, 0, 160) . ($over ? ' — sitting over, closing' : ' — soft, line kept'));
    if ($over) {
        tv_sitting_close();
        tv_fail(429, 'The sitting has spent its approved beats. The show is dark until you open it again.');
    }
    tv_fail(429, 'One beat at a time. The cube is still turning.');
}
if (!is_array($resp) || empty($resp['ok']) || trim((string) ($resp['text'] ?? '')) === '') {
    if ($httpStatus === 200) {
        error_log('tv beat unavailable, model failure — closing the line: ' . mb_substr((string) $raw, 0, 160));
        tv_sitting_close();
        tv_away(' The line has closed; opening it again is a fresh decision.');
    }
    error_log('tv beat relay fault (HTTP ' . $httpStatus . '): ' . mb_substr((string) $raw, 0, 160));
    tv_away('');
}
error_log('tv beat ' . $beatNo . ' answered; book spent est $' . (string) (tv_book_load()['spent'] ?? -1));

/* ---------- Jack's voice: one bounded speech call per answered beat.
   One attempt, no retry; the allowance was already reserved by the caller. ---------- */
function tv_speak(string $line, int $beatNo): ?string {
    $key = ttg_env('OPENAI_API_KEY');
    if ($key === '' || str_contains($key, 'YOUR_KEY')) return null;
    $payload = json_encode([
        'model' => 'tts-1',
        'voice' => TV_VOICE,
        'input' => mb_substr($line, 0, 600),  /* the wallet bound: <=600 chars x $15/1M = $0.009 max */
        'response_format' => 'mp3',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $ch = curl_init('https://api.openai.com/v1/audio/speech');
    if ($ch === false || $payload === false) return null;
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $audio = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (!is_string($audio) || $audio === '' || $code !== 200) {
        error_log('tv voice: speech call failed (HTTP ' . $code . ') - the beat stays silent, allowance held');
        return null;
    }
    $name = 'voice-' . substr(hash('sha256', (string) session_id()), 0, 12) . '-' . $beatNo . '.mp3';
    if (@file_put_contents(__DIR__ . '/.show/' . $name, $audio, LOCK_EX) === false) {
        error_log('tv voice: could not keep the spoken beat');
        return null;
    }
    return '/5d/tv/beat.php?voice=' . $beatNo;
}

/* ---------- read the beat strictly ---------- */
function tv_scene($raw): ?array {
    if (!is_array($raw)) return null;
    $pal = $raw['palette'] ?? null;
    if (!is_array($pal) || count($pal) < 2 || count($pal) > 4) return null;
    $pal = array_values(array_filter(array_map(
        static fn ($c) => is_string($c) && preg_match('/^#[0-9a-fA-F]{6}$/', $c) ? strtolower($c) : null, $pal)));
    if (count($pal) < 2) return null;
    $speed = is_numeric($raw['speed'] ?? null) ? max(0.2, min(3.0, (float) $raw['speed'])) : 1.0;
    $pulse = is_numeric($raw['pulse'] ?? null) ? max(0.0, min(1.0, (float) $raw['pulse'])) : 0.4;
    $turn  = in_array($raw['turn'] ?? '', ['xy','xz','xw','xv','yz','yw','yv','zw','zv','wv'], true) ? $raw['turn'] : 'xw';
    $mark  = mb_substr(preg_replace('/[^A-Za-z0-9]/', '', (string) ($raw['mark'] ?? '')), 0, 3);
    $capt  = mb_substr(trim(preg_replace('/[^A-Za-z0-9 \'’\-]/', '', (string) ($raw['caption'] ?? ''))), 0, 24);
    return ['palette' => $pal, 'speed' => $speed, 'pulse' => $pulse, 'turn' => $turn, 'mark' => $mark, 'caption' => $capt !== '' ? $capt : 'A BEAT'];
}

$show  = is_array($resp['show'] ?? null) ? $resp['show'] : [];
$scene = tv_scene($show['scene'] ?? null) ?? [
    'palette' => ['#6bf27a', '#e6dfcc'], 'speed' => 0.8, 'pulse' => 0.4, 'turn' => 'xw', 'mark' => '', 'caption' => 'A BEAT',
];
$evId = preg_replace('/[^a-z0-9.\-]/', '', strtolower((string) ($show['artefact'] ?? '')));
$art  = ($evId !== '' && isset($candidates[$evId])) ? $candidates[$evId] : null;

$st2 = tv_book_load() ?? $st;
$_SESSION['tv_beat_no']  = $beatNo;
$_SESSION['tv_last_say'] = mb_substr(trim((string) $resp['text']), 0, 600);
if (($show['advance'] ?? false) === true) $_SESSION['tv_card_ix'] = ($cardIx + 1) % count($register);

/* Jack speaks the line (OpenAI voice, the approved route). Same doctrine as
   the model dispatch: the allowance is reserved in the book BEFORE the call
   and stays spent whether or not the call answers — failures included, no
   unmetered retries. A silent beat never closes the line. */
$voiceUrl = null;
if ((float) $st2['spent'] + TV_VOICE_USD <= TV_SITTING_USD + 0.0001) {
    $st2['spent'] = round((float) $st2['spent'] + TV_VOICE_USD, 4);
    tv_book_save($st2);
    $voiceUrl = tv_speak($_SESSION['tv_last_say'], $beatNo);
    if ($voiceUrl !== null) {
        error_log('tv beat ' . $beatNo . ' spoken; book spent est $' . (float) $st2['spent']);
    } else {
        error_log('tv beat ' . $beatNo . ': speech call failed, allowance held; book spent est $' . (float) $st2['spent']);
    }
} else {
    error_log('tv beat ' . $beatNo . ': no voice budget left - silent beat');
}

$st3 = tv_book_load() ?? $st2;
if ((int) ($st3['beats'] ?? 0) >= TV_BEAT_MAX) {
    error_log('tv sitting complete: beats ' . (int) $st3['beats'] . ' spent est $' . (float) $st3['spent'] . ' - closing');
    tv_sitting_close();
}

echo json_encode([
    'ok' => true, 'fresh' => true,
    'say'   => $_SESSION['tv_last_say'],
    'scene' => $scene,
    'artefact' => $art ? [
        'image'   => str_replace('/960px-', '/500px-', (string) $art['image']),
        'caption' => (string) ($art['caption'] ?? ''),
        'credit'  => (string) ($art['credit'] ?? ''),
        'licence' => (string) ($art['licence'] ?? ''),
        'source'  => (string) ($art['source'] ?? ''),
    ] : null,
    'card' => ['id' => $card['id'], 'title' => $card['title'], 'kind' => $card['kind'], 'of' => count($register)],
    'sitting' => ['beats' => (int) ($st3['beats'] ?? $beatNo), 'of' => TV_BEAT_MAX, 'expires' => (int) ($st3['expires'] ?? 0)],
    'voice' => $voiceUrl !== null,
    'voice_url' => $voiceUrl,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
