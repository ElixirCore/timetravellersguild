<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$page = (string) file_get_contents($root . '/join/index.php');
$css = (string) file_get_contents($root . '/assets/join.css');
$act = (string) file_get_contents($root . '/join/act.php');
$old = (string) file_get_contents($root . '/join/index.html');

expect(str_contains($page, 'join.css') && !str_contains($page, 'Fraunces'), 'join page is punch-slip, not Fraunces');
expect(str_contains($page, '/people/auth/request.php') && str_contains($page, 'name="next" value="/join/?welcome=1"'), 'join signs up by magic link and returns to /join');
expect(str_contains($page, "'CHAT'") && str_contains($page, "'MAP'") && str_contains($page, "'PASSPORT'"), 'join explains chat, map and passport before entry');
expect(str_contains($page, 'ttg_og_head') && str_contains($page, 'rel="canonical"'), 'join has explicit OG meta and a canonical URL');
$fns = (string) file_get_contents($root . '/people/inc/functions.php');
expect(str_contains($fns, 'function ttg_auth_next') && !preg_match('#ttg_auth_next[^}]*https?:#', $fns), 'sign-in next is an allow-list of site paths');
expect(str_contains($page, '/field/') && str_contains($page, '/now') && str_contains($page, '/jack'), 'join opens doors into the rest of the field');
expect(str_contains($page, 'href="/now">TREE') && str_contains($page, 'ttg_html_navigator_dock'), 'TREE is NOW; the navigator is for Guild folk');
expect(str_contains($css, '#d9cb9e') && str_contains($css, 'Courier'), 'join stock is manila Courier');
expect(str_contains($act, 'storage/join') && str_contains($act, 'ttg_graph_csrf_ok'), 'applications are private and signed');
expect(str_contains($act, 'ttg_briefing_read') && str_contains($act, 'briefing'), 'join files the front-door briefing with the slip');
expect(!str_contains($act, 'pending.json'), 'join does not write email onto the public tree');
expect(str_contains($old, 'url=/join/') && !str_contains($old, 'Fraunces'), 'old join html only redirects');
expect(is_file($root . '/storage/join/.htaccess'), 'join hopper directory is denied');

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
