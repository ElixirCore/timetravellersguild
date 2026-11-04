<?php
declare(strict_types=1);

/**
 * 9×9 punch-stamp. Empty cells are space (""). Ink is #rrggbb.
 * The array travels on the viewer as `avatar`.
 */
if (!function_exists('ttg_h')) {
    function ttg_h(string $v): string {
        return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (!function_exists('ttg_pixel_default')) {
function ttg_pixel_default(): array
{
    return array_fill(0, 81, '');
}
}

if (!function_exists('ttg_pixel_cell')) {
function ttg_pixel_cell(mixed $raw): string
{
    $hex = strtolower(trim((string) $raw));
    if ($hex === '' || $hex === ' ' || $hex === 'transparent') {
        return '';
    }
    return preg_match('/^#[0-9a-f]{6}$/', $hex) === 1 ? $hex : '';
}
}

if (!function_exists('ttg_pixel_parse')) {
function ttg_pixel_parse(null|string|array $raw): array
{
    $cells = ttg_pixel_default();
    if (is_array($raw)) {
        $data = $raw;
    } else {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return $cells;
        }
        $data = json_decode($raw, true);
    }
    if (!is_array($data) || count($data) !== 81) {
        return $cells;
    }
    $ink = 0;
    for ($i = 0; $i < 81; $i++) {
        $cells[$i] = ttg_pixel_cell($data[$i] ?? '');
        if ($cells[$i] !== '') {
            $ink++;
        }
    }
    if ($ink === 81 && count(array_unique($cells)) === 1 && $cells[0] === '#d9cb9e') {
        return ttg_pixel_default();
    }
    return $cells;
}
}

if (!function_exists('ttg_pixel_encode')) {
function ttg_pixel_encode(null|string|array $cells): string
{
    return (string) json_encode(ttg_pixel_parse($cells), JSON_UNESCAPED_SLASHES);
}
}

if (!function_exists('ttg_pixel_has_ink')) {
function ttg_pixel_has_ink(array $cells): bool
{
    foreach ($cells as $hex) {
        if ($hex !== '') {
            return true;
        }
    }
    return false;
}
}

if (!function_exists('ttg_pixel_html')) {
function ttg_pixel_html(array $cells, string $class = 'px-face'): string
{
    $cells = ttg_pixel_parse($cells);
    $out = '<span class="' . ttg_h($class) . '" aria-hidden="true">';
    foreach ($cells as $hex) {
        $out .= $hex === ''
            ? '<i class="space"></i>'
            : '<i style="background:' . ttg_h($hex) . '"></i>';
    }
    return $out . '</span>';
}
}

if (!function_exists('ttg_you_face')) {
function ttg_you_face(?array $you, string $class = 'you-face'): string
{
    $cells = ttg_pixel_parse($you['avatar'] ?? []);
    if (!ttg_pixel_has_ink($cells)) {
        return '';
    }
    return ttg_pixel_html($cells, $class);
}
}

if (!function_exists('ttg_you_dock')) {
function ttg_you_dock(array $you, string $id = 'navYou'): string
{
    $href = (string) ($you['href'] ?? '/people/auth/');
    $face = ttg_you_face($you);
    return '<a href="' . ttg_h($href) . '" id="' . ttg_h($id) . '" class="you-dock">' . $face . 'YOU</a>';
}
}
