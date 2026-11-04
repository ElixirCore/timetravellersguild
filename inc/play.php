<?php
declare(strict_types=1);

/**
 * Play state for a sitting. Cookie + session. Testimony, not canon.
 * Cube restorations and the front-door interview live here so NOW can show beads.
 */

const TTG_PLAY_COOKIE = 'ttg_play';
const TTG_PLAY_TTL = 60 * 60 * 24 * 30;

function ttg_play_empty(): array
{
    return [
        'v' => 1,
        'name' => '',
        'email' => '',
        'place' => '',
        'note' => '',
        'interviewed' => false,
        'cube' => [
            'lesson' => 1,
            'best' => 0,
            'restores' => 0,
            'lastMoves' => 0,
            'lastPar' => 0,
        ],
        'beads' => [],
        'started' => null,
        'updated' => null,
    ];
}

function ttg_play_clip(string $s, int $max): string
{
    $s = trim($s);
    if ($s === '') return '';
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $max);
    }
    return substr($s, 0, $max);
}

function ttg_play_clean(mixed $raw): array
{
    $out = ttg_play_empty();
    if (!is_array($raw)) return $out;
    $out['name'] = ttg_play_clip((string) ($raw['name'] ?? ''), 80);
    $out['email'] = ttg_play_clip((string) ($raw['email'] ?? ''), 160);
    $out['place'] = ttg_play_clip((string) ($raw['place'] ?? ''), 80);
    $out['note'] = ttg_play_clip((string) ($raw['note'] ?? ''), 280);
    $out['interviewed'] = !empty($raw['interviewed']) && $out['name'] !== '';
    $cube = is_array($raw['cube'] ?? null) ? $raw['cube'] : [];
    $lesson = (int) ($cube['lesson'] ?? 1);
    $best = (int) ($cube['best'] ?? 0);
    $out['cube'] = [
        'lesson' => max(1, min(12, $lesson)),
        'best' => max(0, min(12, $best)),
        'restores' => max(0, min(99, (int) ($cube['restores'] ?? 0))),
        'lastMoves' => max(0, min(999, (int) ($cube['lastMoves'] ?? 0))),
        'lastPar' => max(0, min(12, (int) ($cube['lastPar'] ?? 0))),
    ];
    if ($out['cube']['best'] >= 12) {
        $out['cube']['lesson'] = 12;
    } elseif ($out['cube']['best'] > 0) {
        $out['cube']['lesson'] = max($out['cube']['lesson'], $out['cube']['best'] + 1);
    }
    foreach (['started', 'updated'] as $key) {
        $v = trim((string) ($raw[$key] ?? ''));
        if ($v !== '' && preg_match('/^\d{4}-\d{2}-\d{2}T/', $v)) {
            $out[$key] = substr($v, 0, 40);
        }
    }
    $out['beads'] = ttg_play_rebuild_beads($out);
    return $out;
}

function ttg_play_rebuild_beads(array $play): array
{
    $beads = [];
    $now = gmdate('c');
    if (!empty($play['interviewed']) && ($play['name'] ?? '') !== '') {
        $beads[] = [
            'id' => 'you',
            'kind' => 'interview',
            'title' => (string) $play['name'],
            'at' => (string) ($play['started'] ?? $now),
        ];
    }
    $best = (int) ($play['cube']['best'] ?? 0);
    for ($i = 1; $i <= $best; $i++) {
        $beads[] = [
            'id' => 'cube-' . str_pad((string) $i, 2, '0', STR_PAD_LEFT),
            'kind' => 'cube',
            'title' => 'Lesson ' . str_pad((string) $i, 2, '0', STR_PAD_LEFT),
            'at' => (string) ($play['updated'] ?? $now),
        ];
    }
    return $beads;
}

function ttg_play_merge(array $cur, array $patch): array
{
    $cur = ttg_play_clean($cur);
    if (array_key_exists('name', $patch)) {
        $name = ttg_play_clip((string) $patch['name'], 80);
        if ($name !== '') $cur['name'] = $name;
    }
    if (array_key_exists('email', $patch)) {
        $cur['email'] = ttg_play_clip((string) $patch['email'], 160);
    }
    if (array_key_exists('place', $patch)) {
        $cur['place'] = ttg_play_clip((string) $patch['place'], 80);
    }
    if (array_key_exists('note', $patch)) {
        $cur['note'] = ttg_play_clip((string) $patch['note'], 280);
    }
    if (!empty($patch['interviewed']) && $cur['name'] !== '') {
        $cur['interviewed'] = true;
    }
    if (is_array($patch['cube'] ?? null)) {
        $c = $patch['cube'];
        $best = max($cur['cube']['best'], (int) ($c['best'] ?? 0));
        $lesson = max($cur['cube']['lesson'], (int) ($c['lesson'] ?? 1));
        $cur['cube']['best'] = max(0, min(12, $best));
        $cur['cube']['lesson'] = max(1, min(12, $lesson));
        if (isset($c['restores'])) {
            $cur['cube']['restores'] = max($cur['cube']['restores'], min(99, (int) $c['restores']));
        }
        if (isset($c['lastMoves'])) {
            $cur['cube']['lastMoves'] = max(0, min(999, (int) $c['lastMoves']));
        }
        if (isset($c['lastPar'])) {
            $cur['cube']['lastPar'] = max(0, min(12, (int) $c['lastPar']));
        }
    }
    return ttg_play_clean($cur);
}

function ttg_play_encode(array $play): string
{
    $json = json_encode(ttg_play_clean($play), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || $json === '') return '';
    return rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
}

function ttg_play_decode(string $raw): array
{
    $raw = trim($raw);
    if ($raw === '') return ttg_play_empty();
    $pad = strlen($raw) % 4;
    if ($pad) $raw .= str_repeat('=', 4 - $pad);
    $json = base64_decode(strtr($raw, '-_', '+/'), true);
    if (!is_string($json) || $json === '') return ttg_play_empty();
    $data = json_decode($json, true);
    return ttg_play_clean(is_array($data) ? $data : []);
}

function ttg_play_read(): array
{
    if (function_exists('ttg_graph_boot_session') && !headers_sent()) {
        ttg_graph_boot_session();
    }
    $fromSession = (session_status() === PHP_SESSION_ACTIVE) ? ($_SESSION['ttg_play'] ?? null) : null;
    $fromCookie = ttg_play_decode((string) ($_COOKIE[TTG_PLAY_COOKIE] ?? ''));
    if (is_array($fromSession)) {
        return ttg_play_merge($fromCookie, $fromSession);
    }
    return $fromCookie;
}

function ttg_play_write(array $patch): array
{
    $play = ttg_play_merge(ttg_play_read(), $patch);
    $now = gmdate('c');
    $play['updated'] = $now;
    if ($play['started'] === null) $play['started'] = $now;
    $play['beads'] = ttg_play_rebuild_beads($play);
    if (function_exists('ttg_graph_boot_session') && !headers_sent()) {
        ttg_graph_boot_session();
    }
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION['ttg_play'] = $play;
    }
    $encoded = ttg_play_encode($play);
    if ($encoded === '') return $play;
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    setcookie(TTG_PLAY_COOKIE, $encoded, [
        'expires' => time() + TTG_PLAY_TTL,
        'path' => '/',
        'secure' => $secure,
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[TTG_PLAY_COOKIE] = $encoded;
    return $play;
}

function ttg_play_public(array $play): array
{
    $play = ttg_play_clean($play);
    $out = [
        'interviewed' => $play['interviewed'],
        'cube' => $play['cube'],
        'beads' => $play['beads'],
    ];
    if ($play['name'] !== '') $out['name'] = $play['name'];
    if ($play['place'] !== '') $out['place'] = $play['place'];
    if ($play['note'] !== '') $out['note'] = $play['note'];
    if ($play['started'] !== null) $out['started'] = $play['started'];
    if ($play['updated'] !== null) $out['updated'] = $play['updated'];
    return $out;
}

function ttg_play_bead_count(?array $play = null): int
{
    $play ??= ttg_play_read();
    return count($play['beads'] ?? []);
}

function ttg_play_field_max(): int
{
    $base = defined('TTG_NOW_MAX') ? TTG_NOW_MAX : 36;
    return min(48, $base + ttg_play_bead_count());
}

function ttg_play_field_nodes(): array
{
    $play = ttg_play_read();
    $year = (int) (new DateTimeImmutable('now'))->format('Y');
    $out = [];
    foreach ($play['beads'] as $b) {
        if (!is_array($b)) continue;
        $id = preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($b['id'] ?? '')));
        if ($id === '') continue;
        $kind = (string) ($b['kind'] ?? '');
        $slug = 'play-' . $id;
        $cube = $kind === 'cube';
        $out[] = [
            'id' => $slug,
            'slug' => $slug,
            'title' => (string) ($b['title'] ?? 'Sitting'),
            'type' => 'PLAY',
            'status' => 'WORKING SLIP',
            'zone' => 'leaf',
            'year' => $year,
            'href' => $cube ? '/cube' : '/',
            'open' => $cube ? '/cube' : '/',
            'place' => $play['place'] !== '' ? $play['place'] : 'the blotter',
            'custodian' => 'Jack',
            'opening' => 'A mark from this sitting. Not canon.',
            'body' => $cube
                ? 'A cube restoration. Filed as a working slip. Progress on the wood, not a change to the record.'
                : 'The clerk took a name for the blotter. A sitting, not an account.',
            'moments' => 0,
            'unresolved' => 0,
            'remembered_by' => 0,
            'near_you' => false,
            'pending' => true,
            'play' => true,
            'punch' => ['hash' => '', 'prev' => '', 'body_hash' => '', 'irreversible' => false],
            'why' => [
                'evidence' => [],
                'interpretation' => 'Working slip.',
                'reasons' => ['Earned by this sitting. Not punched.'],
            ],
            'links' => [],
        ];
    }
    return $out;
}
