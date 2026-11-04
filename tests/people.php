<?php
declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/people/inc/functions.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$blank = ttg_pixel_parse('');
expect(count($blank) === 81 && $blank[0] === '#d9cb9e', 'empty stamp is a manila 9×9');
$raw = json_encode(array_fill(0, 81, '#1e3a5f'));
$navy = ttg_pixel_parse($raw);
expect($navy[40] === '#1e3a5f', 'valid pixels are kept');
expect(ttg_pixel_parse('["not-a-colour"]')[0] === '#d9cb9e', 'short or dirty JSON falls back to paper');
$dirty = array_fill(0, 81, '#c41e3a');
$dirty[3] = 'red';
$clean = ttg_pixel_parse(json_encode($dirty));
expect($clean[3] === '#d9cb9e' && $clean[4] === '#c41e3a', 'only hex cells are accepted');
$html = ttg_pixel_html($navy);
expect(str_contains($html, 'px-face') && substr_count($html, '<i ') === 81, 'stamp html is eighty-one pixels');

$page = (string) file_get_contents($root . '/people/profile/index.php');
$js = (string) file_get_contents($root . '/people/assets/js/people.js');
$css = (string) file_get_contents($root . '/people/assets/css/people.css');
$save = (string) file_get_contents($root . '/people/profile/save.php');
$reg = (string) file_get_contents($root . '/people/index.php');

expect(str_contains($page, 'pxGrid') && str_contains($page, 'PUNCH THE SLIP'), 'profile is a punch slip with a 9×9 grid');
expect(str_contains($page, 'HOLLERITH') && str_contains($js, 'HOLLERITH'), 'the name punches live Hollerith holes');
expect(str_contains($js, 'TTG_PIXELS') && str_contains($js, 'pointerdown'), 'the stamp is painted on the page for shared rooms');
expect(str_contains($css, '#d9cb9e') && str_contains($css, 'Courier'), 'people stock is manila Courier');
expect(str_contains($save, 'avatar_pixels') && !str_contains($save, 'avatar_url'), 'save stores the stamp, not a remote image URL');
expect(str_contains($reg, 'ttg_pixel_html') && str_contains($reg, '9×9'), 'the public register shows punched stamps');

if ($fail > 0) {
    echo "FAILED $fail / " . ($pass + $fail) . "\n";
    exit(1);
}
echo "OK $pass\n";
