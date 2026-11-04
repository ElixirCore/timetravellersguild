<?php
declare(strict_types=1);

require_once __DIR__ . '/track.php';

if (!function_exists('ttg_h')) {
    function ttg_h(string $v): string {
        return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

function ttg_network(): array {
    static $net;
    if ($net !== null) return $net;
    $path = dirname(__DIR__) . '/data/rooms.json';
    $raw = @file_get_contents($path);
    $net = $raw === false ? [] : (json_decode($raw, true) ?: []);
    return $net;
}

function ttg_rooms(): array {
    return ttg_network()['rooms'] ?? [];
}

function ttg_room(string $slug): ?array {
    foreach (ttg_rooms() as $room) {
        if (($room['slug'] ?? '') === $slug) return $room;
    }
    return null;
}

function ttg_nav_here(): string {
    $path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    $path = rtrim($path, '/') ?: '/';
    return $path;
}

function ttg_href_here(string $href): bool {
    if (str_starts_with($href, 'http') && !str_contains($href, 'timetravellersguild.com')) {
        return false;
    }
    $here = ttg_nav_here();
    $target = (string) (parse_url($href, PHP_URL_PATH) ?: $href);
    $target = rtrim($target, '/') ?: '/';
    if ($here === $target) return true;
    if ($target === '/') return false;
    return str_starts_with($here, $target . '/');
}

function ttg_network_bar(string $variant = ''): string {
    $nav = ttg_network()['nav'] ?? [];
    $class = 'ttg-net' . ($variant !== '' ? ' ' . $variant : '');
    $on = str_contains($variant, 'paper') ? ' paper' : '';
    $html = '<nav class="' . ttg_h(trim($class)) . '" aria-label="Guild network"'
        . (str_contains($variant, 'paper') ? ' data-on="paper"' : '')
        . ' data-built="1">';
    foreach ($nav as $item) {
        $href = (string) ($item['href'] ?? '/');
        $label = (string) ($item['label'] ?? '');
        $current = ttg_href_here($href) ? ' aria-current="page"' : '';
        $cls = $label === 'tree' ? ' class="sigil"' : '';
        $text = $label === 'tree' ? '.;. tree' : $label;
        $html .= '<a' . $cls . ' href="' . ttg_h($href) . '"' . $current . '>' . ttg_h($text) . '</a>';
    }
    $html .= '</nav>';
    return $html;
}

function ttg_limbs(?string $current = null, string $variant = ''): string {
    $rooms = ttg_rooms();
    $html = '<nav class="ttg-limbs"'
        . (str_contains($variant, 'paper') ? ' data-on="paper"' : '')
        . ' aria-label="All Guild rooms">';
    foreach ($rooms as $room) {
        if (($room['nav'] ?? true) === false) continue;
        $href = (string) ($room['href'] ?? '/');
        $slug = (string) ($room['slug'] ?? '');
        $currentAttr = ($current !== null && $slug === $current) || ttg_href_here($href)
            ? ' aria-current="page"' : '';
        $html .= '<a href="' . ttg_h($href) . '"' . $currentAttr . '>' . ttg_h($slug) . '</a>';
    }
    $html .= '</nav>';
    return $html;
}
