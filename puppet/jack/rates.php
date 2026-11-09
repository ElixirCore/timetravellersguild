<?php
/**
 * Limits on the field puppet's model calls. Conversation and his own idle decisions
 * draw on separate allowances, so a field full of idle tabs cannot silence a visitor.
 * One talk request can be several model calls (tools), hence the lower daily figure.
 * Daily counts reset at 00:00 UTC. Change the numbers here.
 */
declare(strict_types=1);

const PUPPET_LIMITS = [
    'talk'     => ['minute' => 30, 'client' => 10, 'day' => 500],
    'decision' => ['minute' => 15, 'client' => 3,  'day' => 1000],
];

/** Pure: returns [book, ok, error, retryAfterSeconds]. Counts the call only when it is allowed. */
function puppet_rate_take(array $book, string $mode, string $client, int $now): array {
    $mode = $mode === 'decision' ? 'decision' : 'talk';
    $limit = PUPPET_LIMITS[$mode];
    // An older or damaged book is replaced, never trusted.
    if ((int) ($book['v'] ?? 0) !== 2) $book = ['v' => 2];
    $today = gmdate('Y-m-d', $now);
    $minute = (int) floor($now / 60);
    if (($book['day'] ?? '') !== $today) {
        $book['day'] = $today;
        $book['today'] = ['talk' => 0, 'decision' => 0];
    }
    if ((int) ($book['minute'] ?? 0) !== $minute) {
        $book['minute'] = $minute;
        $book['now'] = ['talk' => 0, 'decision' => 0];
        $book['clients'] = [];
    }
    if ((int) ($book['today'][$mode] ?? 0) >= $limit['day']) {
        $midnight = (int) floor($now / 86400 + 1) * 86400;
        return [$book, false, 'daily_cap', max(60, $midnight - $now)];
    }
    if ((int) ($book['now'][$mode] ?? 0) >= $limit['minute']
        || (int) ($book['clients'][$client][$mode] ?? 0) >= $limit['client']) {
        return [$book, false, 'rate_limited', 60];
    }
    $book['today'][$mode] = (int) ($book['today'][$mode] ?? 0) + 1;
    $book['now'][$mode] = (int) ($book['now'][$mode] ?? 0) + 1;
    $book['clients'][$client][$mode] = (int) ($book['clients'][$client][$mode] ?? 0) + 1;
    return [$book, true, '', 0];
}
