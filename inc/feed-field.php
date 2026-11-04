<?php
declare(strict_types=1);

/**
 * Jack-graduated FEED∞ plates as working slips on NOW.
 * Not canon. The photograph is seen through the lens port.
 */

function ttg_feed_sqlite_path(): string
{
    return dirname(__DIR__) . '/feed/feed-data/feed.sqlite';
}

function ttg_feed_db(): ?PDO
{
    static $pdo = false;
    if ($pdo !== false) {
        return $pdo;
    }
    $file = ttg_feed_sqlite_path();
    if (!is_file($file)) {
        $pdo = null;
        return null;
    }
    try {
        $pdo = new PDO(
            'sqlite:' . $file,
            null,
            null,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
        return $pdo;
    } catch (Throwable $e) {
        $pdo = null;
        return null;
    }
}

function ttg_feed_analysis(array $row): array
{
    $a = json_decode((string) ($row['analysis_json'] ?? ''), true);
    return is_array($a) ? $a : [];
}

function ttg_feed_standing(array $analysis): string
{
    $s = strtolower(trim((string) ($analysis['standing'] ?? '')));
    return in_array($s, ['noise', 'held', 'relevant'], true) ? $s : 'held';
}

function ttg_feed_year(array $row, array $analysis): int
{
    foreach ((array) ($analysis['dates'] ?? []) as $d) {
        if (is_string($d) && preg_match('/((?:19|20|21)\d{2})/', $d, $m)) {
            return (int) $m[1];
        }
    }
    $created = (string) ($row['created_at'] ?? '');
    if ($created !== '' && preg_match('/((?:19|20|21)\d{2})/', $created, $m)) {
        return (int) $m[1];
    }
    return (int) (new DateTimeImmutable('now'))->format('Y');
}

function ttg_feed_href_slug(string $href): string
{
    $href = trim($href);
    if (preg_match('#^/n/([A-Za-z0-9_-]+)/?#', $href, $m)) {
        return $m[1];
    }
    if (!function_exists('ttg_graph_unique_nodes')) {
        return '';
    }
    foreach (ttg_graph_unique_nodes() as $node) {
        if (!is_array($node)) {
            continue;
        }
        $nh = (string) ($node['href'] ?? '');
        $slug = (string) ($node['slug'] ?? '');
        if ($slug !== '' && $nh !== '' && rtrim($nh, '/') === rtrim($href, '/')) {
            return $slug;
        }
    }
    return '';
}

/** @return list<array<string, mixed>> */
function ttg_feed_relevant_nodes(): array
{
    static $cached = null;
    if (is_array($cached)) {
        return $cached;
    }

    $pdo = ttg_feed_db();
    if (!$pdo) {
        $cached = [];
        return $cached;
    }
    try {
        $rows = $pdo->query('
            SELECT id, filename, created_at, analysed_at, analysis_json
            FROM images
            WHERE analysed_at IS NOT NULL
            ORDER BY id DESC
            LIMIT 80
        ')->fetchAll();
    } catch (Throwable $e) {
        $cached = [];
        return $cached;
    }
    if (!is_array($rows)) {
        $cached = [];
        return $cached;
    }
    $cached = [];
    foreach ($rows as $row) {
        $a = ttg_feed_analysis($row);
        if (ttg_feed_standing($a) !== 'relevant') {
            continue;
        }
        $id = (int) ($row['id'] ?? 0);
        if ($id < 1) {
            continue;
        }
        $filename = (string) ($row['filename'] ?? '');
        if ($filename === '') {
            continue;
        }
        $slug = 'feed-' . $id;
        $title = trim((string) ($a['caption'] ?? ''));
        if ($title === '') {
            $title = 'Plate #' . str_pad((string) $id, 6, '0', STR_PAD_LEFT);
        }
        $jack = trim((string) ($a['jack'] ?? ''));
        $places = $a['places'] ?? [];
        $place = is_array($places) && isset($places[0]) ? (string) $places[0] : 'the field';
        $links = [];
        foreach (array_merge($a['hrefs'] ?? [], $a['tickets'] ?? []) as $ref) {
            if (!is_array($ref)) {
                continue;
            }
            $href = (string) ($ref['href'] ?? '');
            $other = ttg_feed_href_slug($href);
            if ($other === '' || $other === $slug) {
                continue;
            }
            $links[] = [
                'slug' => $other,
                'title' => (string) ($ref['label'] ?? $ref['title'] ?? $other),
                'via' => 'CORROBORATES',
            ];
        }
        $cached[] = [
            'id' => $slug,
            'slug' => $slug,
            'title' => $title,
            'type' => 'MEDIA',
            'status' => 'RELEVANT',
            'zone' => 'leaf',
            'year' => ttg_feed_year($row, $a),
            'observed_at' => (string) ($row['analysed_at'] ?? $row['created_at'] ?? ''),
            'href' => '/feed/',
            'open' => '/now?lens=' . rawurlencode($slug),
            'place' => $place !== '' ? $place : 'the field',
            'custodian' => 'Jack',
            'opening' => 'Jack graduated this plate as relevant. Seen through the lens. Not canon.',
            'body' => $jack !== '' ? $jack : 'A plate Jack filed onto the tree.',
            'moments' => 0,
            'unresolved' => 0,
            'remembered_by' => 0,
            'near_you' => false,
            'pending' => true,
            'lens' => true,
            'src' => '/feed/images/' . rawurlencode($filename),
            'feed_id' => $id,
            'punch' => ['hash' => '', 'prev' => '', 'body_hash' => '', 'irreversible' => false],
            'why' => [
                'evidence' => $links,
                'interpretation' => 'Working slip from FEED∞. Jack’s graduation, not a punch.',
                'reasons' => ['Graduated by Jack as relevant. Visible through the HUD lens.'],
            ],
            'links' => $links,
        ];
    }
    return $cached;
}

function ttg_feed_relevant_count(): int
{
    return count(ttg_feed_relevant_nodes());
}
