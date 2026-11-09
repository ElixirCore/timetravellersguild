<?php
/**
 * agent.php: server-side proxy between the UNIKIN Workbench and the OpenAI Responses API.
 *
 * The browser never sees the API key. Put these in secret_agent.php beside this file (or your existing secrets.php, see secret() below), or in the server environment:
 *   OPENAI_API_KEY   required
 *   OPENAI_MODEL     required. The model id is yours to choose; nothing is assumed here.
 * Optional:
 *   OPENAI_BASE_URL  default https://api.openai.com
 *   AGENT_ALLOW_ANON set to 1 ONLY while testing. Without a login check this endpoint spends your money for anyone.
 *
 * Login hook: create agent_auth.php beside this file that returns true when the request comes from a signed-in
 * citizen, e.g.   <?php return !empty($_SESSION['citizen_id']);
 * Until that file exists, and unless AGENT_ALLOW_ANON=1, every request is refused with 403.
 *
 * Requests are stateless: store=false, so OpenAI is asked not to keep the response, and reasoning items travel
 * back and forth encrypted. Whatever the workbench sends (including holder fields the person ticked) goes to OpenAI.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['error' => ['message' => $msg]]); exit; }

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
$key = secret('OPENAI_API_KEY'); $model = secret('OPENAI_MODEL');
if (!$key || !$model) fail(500, 'No OPENAI_API_KEY or OPENAI_MODEL found in secret_agent.php, secrets.php or the environment.');
$base = rtrim(secret('OPENAI_BASE_URL') ?: 'https://api.openai.com', '/');

// crude rate limit: 40 requests per hour per client address (file based; replace with something sturdier if needed)
$ip = $_SERVER['REMOTE_ADDR'] ?? 'x'; $rl = sys_get_temp_dir() . '/unikin_agent_' . md5($ip) . '.json';
$now = time(); $hist = is_file($rl) ? (json_decode((string) file_get_contents($rl), true) ?: []) : [];
$hist = array_values(array_filter($hist, fn($t) => $t > $now - 3600));
if (count($hist) >= 40) fail(429, 'Too many requests this hour.');
$hist[] = $now; @file_put_contents($rl, json_encode($hist), LOCK_EX);

$raw = file_get_contents('php://input', false, null, 0, 262145);
if ($raw === false || strlen($raw) > 262144) fail(413, 'Request too large.');
$in = json_decode($raw, true);
if (!is_array($in)) fail(400, 'Body must be JSON.');

$instructions = isset($in['instructions']) && is_string($in['instructions']) ? mb_substr($in['instructions'], 0, 20000) : '';
$input = $in['input'] ?? null;
if (!is_array($input) || count($input) > 200) fail(400, 'input must be a list of at most 200 items.');
$okTypes = ['message', 'reasoning', 'function_call', 'function_call_output'];
foreach ($input as $it) {
    if (!is_array($it)) fail(400, 'Bad input item.');
    $type = $it['type'] ?? 'message';
    if (!in_array($type, $okTypes, true)) fail(400, 'Input item type not allowed: ' . (string) $type);
    if ($type === 'message' && !in_array($it['role'] ?? '', ['user', 'assistant'], true)) fail(400, 'Only user and assistant messages are allowed.');
}
$tools = [];
foreach (($in['tools'] ?? []) as $t) {
    if (!is_array($t) || !preg_match('/^[A-Za-z0-9_-]{1,64}$/', (string) ($t['name'] ?? ''))) fail(400, 'Bad tool definition.');
    $tools[] = ['type' => 'function', 'name' => $t['name'], 'description' => mb_substr((string) ($t['description'] ?? ''), 0, 1200), 'parameters' => $t['parameters'] ?? ['type' => 'object', 'properties' => new stdClass()]];
}
if (count($tools) > 24) fail(400, 'Too many tools.');

$body = ['model' => $model, 'input' => $input, 'store' => false, 'include' => ['reasoning.encrypted_content'], 'max_output_tokens' => 4000];
if ($instructions !== '') $body['instructions'] = $instructions;
if ($tools && empty($in['last'])) { $body['tools'] = $tools; }   // 'last' round: no tools, forces a written answer

$ch = curl_init($base . '/v1/responses');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
$res = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
if ($res === false) fail(502, 'Could not reach the model provider: ' . $err);
$j = json_decode((string) $res, true);
if ($status >= 400 || !is_array($j)) {
    // pass only the provider's message, never headers or the key
    $msg = is_array($j) && isset($j['error']['message']) ? (string) $j['error']['message'] : 'The provider answered ' . $status . '.';
    fail($status >= 400 && $status < 600 ? $status : 502, $msg);
}
echo json_encode(['status' => $j['status'] ?? 'completed', 'output' => $j['output'] ?? []], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
