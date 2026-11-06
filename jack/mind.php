<?php
declare(strict_types=1);

/**
 * /jack/mind.php — Jack's mind, as public JSON, for the mind display at /jack/mind/.
 * Live state, his recent thoughts (his side only: no visitor words, names or replies),
 * and the whole of his remembered life with its evidence for the idle collage.
 * awareness: how much of himself has come back, from his lifetime ledger (aggregates, his side only).
 */
require_once dirname(__DIR__) . '/app/AI/JackLife.php';
require_once dirname(__DIR__) . '/app/AI/JackMind.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$life = JackLife::data();
$byId = [];
foreach ($life['memories'] as $m) $byId[$m['id']] = $m;

$thoughts = array_map(static function (array $t) use ($byId): array {
    $t['recalled'] = array_values(array_filter(array_map(static fn ($id) => isset($byId[$id]) ? JackLife::full($byId[$id]) : null, $t['recalled'])));
    return $t;
}, array_reverse(JackMind::thoughts()));

echo json_encode([
    'ok' => true,
    'state' => JackMind::state(),
    'awareness' => JackMind::awareness(),
    'thoughts' => array_slice($thoughts, 0, 20),
    'life' => [
        'about' => $life['about'] ?? '',
        'eras' => $life['eras'],
        'memories' => array_map(static fn ($m) => ['id' => $m['id'], 'era' => $m['era'], 'year' => $m['year'], 'title' => $m['title'], 'text' => $m['text'], 'evidence' => $m['evidence']], $life['memories']),
        'evidence' => $life['evidence'],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
