<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$base = getenv('TTG_CHECK_BASE') ?: 'http://127.0.0.1:8765';
$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$seeds = [
    '/', '/now', '/jack', '/jack/tarot/', '/deck/', '/deck/major-00', '/join/', '/field/',
    '/square/', '/n/', '/signals/', '/hub/', '/cardiff/', '/people/', '/department/',
    '/watch/', '/feed/', '/triangla/', '/film/', '/archive/', '/missions/', '/stations/',
    '/research/', '/commons/', '/calendar/', '/elsewhen/', '/door.html', '/now/around?slug=guild',
];

function ttg_check_url(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_USERAGENT => 'ttg-linkcheck',
        CURLOPT_NOBODY => false,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = (string) curl_error($ch);
    return ['code' => $code, 'body' => is_string($body) ? $body : '', 'err' => $err];
}

$seen = [];
$broken = [];
$queue = $seeds;
while ($queue) {
    $path = array_shift($queue);
    if (isset($seen[$path])) continue;
    $seen[$path] = true;
    $res = ttg_check_url(rtrim($base, '/') . $path);
    $ok = $res['code'] >= 200 && $res['code'] < 400;
    if (!$ok) {
        $broken[] = $path . ' → ' . ($res['code'] ?: $res['err']);
        continue;
    }
    if (count($seen) > 80) continue;
    if (!preg_match_all('/href="(\\/[A-Za-z0-9_\\/.?#=-]*)"/', $res['body'], $m)) continue;
    foreach ($m[1] as $href) {
        $p = (string) (parse_url($href, PHP_URL_PATH) ?: $href);
        if ($p === '' || str_contains($p, '.')) {
            if (preg_match('/\\.(html|php)$/', $p) !== 1 && str_contains($p, '.')) continue;
        }
        if (!isset($seen[$p]) && count($queue) < 60) $queue[] = $p;
    }
}

expect($broken === [], $broken ? ('live paths hold: ' . implode('; ', array_slice($broken, 0, 12))) : 'seeded public paths return');
expect(isset($seen['/now']) && isset($seen['/jack']), 'NOW and the desk are on the walk');

$intro = (string) file_get_contents($root . '/intro.php');
expect(str_contains($intro, 'always-on') && str_contains($intro, 'href="/now"'), 'the front door shows NOW before the briefing');

$stale = [];
foreach (['ok/index.html', 'cardiff/index.html', 'triangla/index.html', 'door.html', 'watch/index.php'] as $f) {
    $txt = (string) file_get_contents($root . '/' . $f);
    if (preg_match('/href="\\/"[^>]*>[^<]*(tree|the tree)/i', $txt)) $stale[] = $f;
}
expect($stale === [], $stale ? ('stale tree→/ in ' . implode(', ', $stale)) : 'old tree sigils point at /now');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
