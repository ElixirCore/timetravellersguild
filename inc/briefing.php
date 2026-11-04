<?php
declare(strict_types=1);

/**
 * Front-door briefing. Remembered in a cookie. Filed with a join or register slip.
 * Testimony, not canon.
 */

const TTG_BRIEF_COOKIE = 'ttg_brief';
const TTG_BRIEF_TTL = 60 * 60 * 24 * 30;
const TTG_BRIEF_TOPICS = ['you', 'jack', 'tree', 'guild', 'tarot', 'nav'];

function ttg_briefing_empty(): array {
    return [
        'v' => 1,
        'seen' => [],
        'done' => false,
        'forgotten' => false,
        'card' => null,
        'nodes' => [],
        'asks' => [],
        'started' => null,
        'updated' => null,
    ];
}

function ttg_briefing_clean(mixed $raw): array {
    $out = ttg_briefing_empty();
    if (!is_array($raw)) return $out;
    $seen = [];
    foreach ((array) ($raw['seen'] ?? []) as $id) {
        $id = strtolower(trim((string) $id));
        if (in_array($id, TTG_BRIEF_TOPICS, true) && !in_array($id, $seen, true)) {
            $seen[] = $id;
        }
        if (count($seen) >= 6) break;
    }
    $out['seen'] = $seen;
    $out['done'] = !empty($raw['done']);
    $out['forgotten'] = !empty($raw['forgotten']);
    $card = $raw['card'] ?? null;
    if (is_array($card)) {
        $name = trim((string) ($card['name'] ?? ''));
        $job = trim((string) ($card['job'] ?? ''));
        if ($name !== '') {
            $out['card'] = [
                'name' => function_exists('mb_substr') ? mb_substr($name, 0, 80) : substr($name, 0, 80),
                'job' => function_exists('mb_substr') ? mb_substr($job, 0, 80) : substr($job, 0, 80),
            ];
        }
    }
    $nodes = [];
    foreach ((array) ($raw['nodes'] ?? []) as $title) {
        $title = trim((string) $title);
        if ($title === '') continue;
        $title = function_exists('mb_substr') ? mb_substr($title, 0, 80) : substr($title, 0, 80);
        if (!in_array($title, $nodes, true)) $nodes[] = $title;
        if (count($nodes) >= 4) break;
    }
    $out['nodes'] = $nodes;
    $asks = [];
    foreach ((array) ($raw['asks'] ?? []) as $q) {
        $q = trim((string) $q);
        if ($q === '') continue;
        $q = function_exists('mb_substr') ? mb_substr($q, 0, 160) : substr($q, 0, 160);
        $asks[] = $q;
        if (count($asks) >= 6) break;
    }
    $out['asks'] = $asks;
    foreach (['started', 'updated'] as $key) {
        $v = trim((string) ($raw[$key] ?? ''));
        if ($v !== '' && preg_match('/^\d{4}-\d{2}-\d{2}T/', $v)) {
            $out[$key] = substr($v, 0, 40);
        }
    }
    return $out;
}

function ttg_briefing_held(array $brief): bool {
    return $brief['seen'] !== [] || $brief['done'] || $brief['forgotten'] || $brief['card'] !== null || $brief['nodes'] !== [] || $brief['asks'] !== [];
}

function ttg_briefing_encode(array $brief): string {
    $json = json_encode(ttg_briefing_clean($brief), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || $json === '') return '';
    return rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
}

function ttg_briefing_decode(string $raw): array {
    $raw = trim($raw);
    if ($raw === '') return ttg_briefing_empty();
    $pad = strlen($raw) % 4;
    if ($pad) $raw .= str_repeat('=', 4 - $pad);
    $json = base64_decode(strtr($raw, '-_', '+/'), true);
    if (!is_string($json) || $json === '') return ttg_briefing_empty();
    $data = json_decode($json, true);
    return ttg_briefing_clean(is_array($data) ? $data : []);
}

function ttg_briefing_read(): array {
    return ttg_briefing_decode((string) ($_COOKIE[TTG_BRIEF_COOKIE] ?? ''));
}

function ttg_briefing_write(array $brief): array {
    $brief = ttg_briefing_clean($brief);
    $now = gmdate('c');
    $brief['updated'] = $now;
    if ($brief['started'] === null) $brief['started'] = $now;
    $encoded = ttg_briefing_encode($brief);
    if ($encoded === '') return $brief;
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    setcookie(TTG_BRIEF_COOKIE, $encoded, [
        'expires' => time() + TTG_BRIEF_TTL,
        'path' => '/',
        'secure' => $secure,
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[TTG_BRIEF_COOKIE] = $encoded;
    return $brief;
}

function ttg_briefing_relevant(array $brief): array {
    $brief = ttg_briefing_clean($brief);
    $out = [
        'seen' => $brief['seen'],
        'done' => $brief['done'],
        'forgotten' => $brief['forgotten'],
    ];
    if (is_array($brief['card'])) $out['card'] = $brief['card'];
    if ($brief['nodes'] !== []) $out['nodes'] = $brief['nodes'];
    /* Chat asks are session-local; do not replay them on the front door. */
    if ($brief['started'] !== null) $out['started'] = $brief['started'];
    if ($brief['updated'] !== null) $out['updated'] = $brief['updated'];
    return $out;
}

function ttg_briefing_json(array $brief): string {
    if (!ttg_briefing_held($brief)) return '';
    $json = json_encode(ttg_briefing_relevant($brief), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return is_string($json) ? $json : '';
}

function ttg_briefing_note(array $brief): string {
    $brief = ttg_briefing_clean($brief);
    if (!ttg_briefing_held($brief)) return '';
    $bits = [];
    if ($brief['seen'] !== []) $bits[] = 'Heard: ' . implode(', ', $brief['seen']);
    if ($brief['done']) $bits[] = 'Tutorial over.';
    if ($brief['forgotten']) $bits[] = 'Said they forgot too.';
    if (is_array($brief['card'])) $bits[] = 'Card: ' . $brief['card']['name'] . ' (' . $brief['card']['job'] . ')';
    if ($brief['nodes'] !== []) $bits[] = 'Tree: ' . implode(', ', $brief['nodes']);
    if ($brief['asks'] !== []) $bits[] = 'Asked: ' . implode(' / ', $brief['asks']);
    return implode(' ', $bits);
}
