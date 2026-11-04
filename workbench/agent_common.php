<?php
/** agent_common.php: shared guard for agent.php and live.php (JSON errors, same-origin, login hook, secrets, rate limit). Not a public endpoint. */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['error' => ['message' => $msg]]); exit; }

if (PHP_SAPI !== 'cli' && basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'agent_common.php') { http_response_code(404); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'POST only.');

// same-origin only: a browser sends Origin on POST
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $oh = parse_url($origin, PHP_URL_HOST);
    $hh = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
    if (!$oh || strcasecmp($oh, $hh) !== 0) fail(403, 'Cross-origin requests are refused.');
}

// who is asking
$authFile = __DIR__ . '/agent_auth.php';
$allowed = false;
if (is_file($authFile)) { $allowed = (bool) (require $authFile); }
elseif (getenv('AGENT_ALLOW_ANON') === '1') { $allowed = true; }
if (!$allowed) fail(403, 'Sign-in required. Add agent_auth.php, or set AGENT_ALLOW_ANON=1 for testing only.');

// Secrets come from your existing secrets.php. ASSUMPTION: I have not seen that file. This reads it if it is found beside
// this script or one level up, and accepts either a returned array or defined constants. If yours is shaped differently,
// change only secret() below. The key is never echoed, logged or sent to the browser.
function secret(string $name): ?string {
    static $loaded = null;
    if ($loaded === null) {
        $loaded = [];
        foreach ([__DIR__ . '/secret_agent.php', __DIR__ . '/secrets.php', dirname(__DIR__) . '/secrets.php'] as $f) {
            if (is_file($f)) { $r = require $f; if (is_array($r)) $loaded = $r; break; }
        }
    }
    foreach ([$name, strtolower($name)] as $k) { if (isset($loaded[$k]) && is_string($loaded[$k]) && $loaded[$k] !== '') return $loaded[$k]; }
    if (defined($name) && is_string(constant($name)) && constant($name) !== '') return constant($name);
    $e = getenv($name); return ($e !== false && $e !== '') ? $e : null;
}
$key = secret('OPENAI_API_KEY');
if (!$key) fail(500, 'No OPENAI_API_KEY found in secret_agent.php, secrets.php or the environment.');
$base = rtrim(secret('OPENAI_BASE_URL') ?: 'https://api.openai.com', '/');

// crude rate limit: 40 requests per hour per client address (file based; replace with something sturdier if needed)
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x'; $rl = sys_get_temp_dir() . '/unikin_agent_' . md5($ip) . '.json';
$now = time(); $hist = is_file($rl) ? (json_decode((string) file_get_contents($rl), true) ?: []) : [];
$hist = array_values(array_filter($hist, fn($t) => $t > $now - 3600));
if (count($hist) >= 40) fail(429, 'Too many requests this hour.');
$hist[] = $now; @file_put_contents($rl, json_encode($hist), LOCK_EX);


/** Builds the Guild knowledge block from tree.json (beside this file). Public tree data only: no holder fields. */
function guild_digest(): string {
    $f = __DIR__ . '/tree.json';
    if (!is_file($f)) return '';
    $j = json_decode((string) file_get_contents($f), true);
    if (!is_array($j)) return '';
    $o = "GUILD KNOWLEDGE, from " . ($j['source'] ?? 'the public tree') . ", collected " . ($j['collected'] ?? 'unknown') . ".\n"
       . "The Guild's public site is timetravellersguild.com (British spelling, no \"the\"). Similarly named sites are other organisations; do not use them as the Guild. "
       . "Answer from this knowledge and from what the person tells you. If something is not here, say you do not know. Do not invent history.\n\n"
       . ($j['narrative'] ?? '') . "\n\nTimeline (year, title, type, status, where: gist):\n";
    foreach (($j['entries'] ?? []) as $e) {
        if (!is_array($e) || empty($e['title'])) continue;
        $o .= '- ' . ($e['year'] ?? '') . ' ' . $e['title'] . ' (' . ($e['type'] ?? '') . ', ' . ($e['status'] ?? '') . (!empty($e['observed']) ? ', ' . $e['observed'] : '') . '): ' . ($e['gist'] ?? '') . "\n";
    }
    if (!empty($j['canon']) && is_array($j['canon'])) $o .= "\nCanon (fixed, never contradict):\n- " . implode("\n- ", array_map('strval', $j['canon'])) . "\n";
    if (!empty($j['entries_not_in_digest']) && is_array($j['entries_not_in_digest'])) {
        $o .= "\nOther public nodes (title, type, status, place, date, importance; no summary collected):\n";
        foreach ($j['entries_not_in_digest'] as $e) $o .= '- ' . ($e['title'] ?? '') . ' (' . ($e['type'] ?? '') . ', ' . ($e['status'] ?? '') . ', ' . ($e['place'] ?? '') . ', ' . ($e['date'] ?? '') . ', ' . ($e['importance'] ?? '') . ")\n";
    }
    if (!empty($j['machine']) && is_array($j['machine'])) {
        $m = $j['machine'];
        $o .= "\nTIME MACHINE №13: " . ($m['about'] ?? '') . "\nEquation: " . ($m['equation'] ?? '') . "\n";
        foreach (($m['params'] ?? []) as $k => $v) $o .= "- $k: $v\n";
        $o .= 'Emergy words: ' . ($m['emergy_words'] ?? '') . "\n";
        if (!empty($m['beyond_now'])) $o .= 'Cards beyond the present (future-dated): ' . implode('; ', $m['beyond_now']) . "\n";
    }
    return mb_substr($o, 0, 16000);
}
