<?php
declare(strict_types=1);

/**
 * The Guild's terms: the privacy policy (/privacy/) and the grand narrative agreement.
 *
 * A traveller agrees once, the first time they submit work (a ledger page, a map item,
 * a case filing, a stamp, a trail point, their avatar or profile). Browsing, chat and
 * talking to Jack never ask. The agreement is recorded on the users row with the version
 * agreed to; changing TTG_TERMS_VERSION asks everyone again at their next submission.
 */

require_once __DIR__ . '/db.php';

/** Bump this (a date) when the narrative terms change in a way people must agree to again. */
const TTG_TERMS_VERSION = '2026-11-06';
const TTG_TERMS_CONTACT = 'guild@timetravellersguild.com';

function ttg_terms_agreed(?array $user): bool {
    return $user !== null && (string) ($user['terms_version'] ?? '') === TTG_TERMS_VERSION;
}

function ttg_terms_record(int $userId): void {
    ttg_db()->prepare('UPDATE users SET terms_version = ?, terms_agreed_at = ? WHERE id = ?')
        ->execute([TTG_TERMS_VERSION, gmdate('c'), $userId]);
}

/** Where to return after agreeing: same-site paths only. */
function ttg_terms_next(string $next): string {
    $next = trim($next);
    if ($next === '' || !str_starts_with($next, '/') || str_starts_with($next, '//') || preg_match('/[\r\n\\\\]/', $next)) return '';
    return mb_substr($next, 0, 300);
}

function ttg_terms_agree_url(string $next = ''): string {
    $next = ttg_terms_next($next);
    return '/people/agree/' . ($next !== '' ? '?next=' . rawurlencode($next) : '');
}

/** The return path for a JSON API: the page the request came from. */
function ttg_terms_referer_path(): string {
    $ref = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    $path = (string) (parse_url($ref, PHP_URL_PATH) ?? '');
    $query = (string) (parse_url($ref, PHP_URL_QUERY) ?? '');
    return ttg_terms_next($path . ($query !== '' ? '?' . $query : ''));
}

/**
 * For JSON endpoints that take submitted work: stop here unless the traveller has agreed.
 * The response carries `agree` (a link to the agreement) for the page to show.
 */
function ttg_terms_gate_json(array $user): void {
    if (ttg_terms_agreed($user)) return;
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'ok' => false,
        'error' => 'Before your work joins the Guild, agree to lend it to the grand narrative.',
        'agree' => ttg_terms_agree_url(ttg_terms_referer_path()),
        'terms' => true,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
