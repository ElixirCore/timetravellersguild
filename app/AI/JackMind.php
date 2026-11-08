<?php
declare(strict_types=1);

require_once __DIR__ . '/JackStore.php';

/**
 * Jack's mind, as it can be shown: a ring of his recent thoughts and a live state built from them.
 * Read by /jack/mind.php for the mind display at /jack/mind/.
 *
 * PRIVACY: only Jack's side is recorded. Never what a visitor said, who they are, or what he replied:
 * the mode he was in, which of his own memories surfaced (and their evidence images), which tools he
 * used, which sites he cited, and how long he took. storage/ is denied to the web.
 *
 * GROWTH: beside the ring of recent thoughts, a lifetime ledger (storage/jack/growth.json) that only
 * ever adds up: sittings, days at the desk, which of his memories he has recalled and when first,
 * which faculties (tools) he has used and when first, which sites he has read. awareness() turns it
 * into how much of himself has come back, and the mind display changes with it. Same privacy rule.
 */
final class JackMind
{
    private const MAX = 40;

    public static function path(): string { return dirname(__DIR__, 2) . '/storage/jack/mind.json'; }
    public static function growthPath(): string { return dirname(__DIR__, 2) . '/storage/jack/growth.json'; }

    /** @param array{mode:string,recalled:list<string>,tools:list<string>,cited:list<string>,seconds:float,signed_in:bool,story:bool,timeout?:bool} $t */
    public static function record(array $t): void
    {
        $t = [
            'at' => time(),
            'mode' => preg_replace('/[^a-z_]/', '', strtolower((string) $t['mode'])) ?: 'clerk',
            'recalled' => array_values(array_slice(array_map('strval', $t['recalled']), 0, 5)),
            'tools' => array_values(array_slice(array_map(static fn ($x) => preg_replace('/[^a-z_]/', '', strtolower((string) $x)), $t['tools']), 0, 20)),
            'cited' => array_values(array_slice(array_unique(array_map('strval', $t['cited'])), 0, 8)),
            'seconds' => round((float) $t['seconds'], 1),
            'traveller' => !empty($t['signed_in']) ? 'known' : 'stranger',
            'story' => !empty($t['story']),
            'timeout' => !empty($t['timeout']),
        ];
        $path = self::path();
        JackStore::locked($path, static function () use ($path, $t): void {
            $all = JackStore::read($path);
            if ($all === null) return;
            $all[] = $t;
            JackStore::saveJson($path, array_slice($all, -self::MAX), JSON_UNESCAPED_SLASHES);
        });
        self::grow($t);
    }

    /** Add one thought to the lifetime ledger. Never shrinks; seeded from the ring the first time, and never over a damaged ledger. */
    private static function grow(array $t): void
    {
        $path = self::growthPath();
        JackStore::locked($path, static function () use ($path, $t): void {
            $g = JackStore::read($path);
            if ($g === null) return;
            if ($g === []) {
                $g = self::emptyGrowth();
                foreach (self::thoughts() as $old) if ((int) ($old['at'] ?? 0) < (int) $t['at']) $g = self::addTo($g, $old);
            }
            JackStore::saveJson($path, self::addTo($g, $t), JSON_UNESCAPED_SLASHES);
        });
    }

    private static function emptyGrowth(): array
    {
        return ['born' => null, 'sittings' => 0, 'known' => 0, 'strangers' => 0, 'stories' => 0, 'timeouts' => 0,
            'seconds' => 0.0, 'days' => [], 'recalled' => [], 'tools' => [], 'domains' => []];
    }

    /** Fold one recorded thought into the ledger. Each map keeps a count and the moment of the first time. */
    private static function addTo(array $g, array $t): array
    {
        $at = (int) ($t['at'] ?? time());
        $g['born'] = $g['born'] === null ? $at : min((int) $g['born'], $at);
        $g['sittings']++;
        $g[($t['traveller'] ?? '') === 'known' ? 'known' : 'strangers']++;
        if (!empty($t['story'])) $g['stories']++;
        if (!empty($t['timeout'])) $g['timeouts']++;
        $g['seconds'] = round((float) $g['seconds'] + (float) ($t['seconds'] ?? 0), 1);
        $day = gmdate('Y-m-d', $at);
        if (!in_array($day, $g['days'], true)) $g['days'] = array_slice([...$g['days'], $day], -1000);
        foreach (['recalled' => $t['recalled'] ?? [], 'tools' => $t['tools'] ?? [], 'domains' => $t['cited'] ?? []] as $k => $items) {
            foreach (array_unique(array_map('strval', (array) $items)) as $id) {
                if ($id === '') continue;
                if (!isset($g[$k][$id])) {
                    if ($k === 'domains' && count($g[$k]) >= 300) continue;
                    $g[$k][$id] = ['n' => 0, 'first' => $at];
                }
                $g[$k][$id]['n']++;
            }
        }
        return $g;
    }

    public static function growth(): array
    {
        $g = json_decode((string) @file_get_contents(self::growthPath()), true);
        if (is_array($g)) return $g + self::emptyGrowth();
        // Nothing grown yet: read what the ring holds, without writing.
        $g = self::emptyGrowth();
        foreach (self::thoughts() as $t) $g = self::addTo($g, $t);
        return $g;
    }

    /** What each tool means as a faculty he has come into. */
    public const FACULTIES = [
        'remember_my_life' => 'remembering his own life',
        'search_lore' => 'searching the lore drawer', 'read_lore' => 'reading lore in full',
        'search_graph' => 'searching the field', 'get_node' => 'following a node through the field',
        'search_map' => 'reading his own map', 'trace_map' => 'tracing the nerves of the map',
        'desk_items' => 'reading what travellers lodged', 'find_traveller' => 'finding travellers',
        'whoami' => 'knowing who is at the desk', 'recall_memory' => 'recalling a traveller',
        'remember' => 'keeping a traveller in mind', 'forget' => 'forgetting when asked',
        'add_story_beat' => 'moving a traveller\'s story', 'set_story_premise' => 'naming what a story is about',
        'close_story_thread' => 'closing a story thread', 'resolve_thread' => 'letting a matter rest',
        'list_site' => 'seeing the site he lives on', 'read_site_page' => 'reading his own site',
        'web_search' => 'looking beyond the Guild',
        'search_cardiff_archives' => 'reading Cardiff\'s archives', 'read_museum_object' => 'handling a museum object',
        'search_office' => 'searching his office', 'list_station' => 'listing a station', 'read_record' => 'reading an office record',
        'write_note' => 'writing his own notes', 'revise_note' => 'revising his own notes', 'link_records' => 'linking records',
    ];

    /** Stages of coming back to himself, and how he puts each one. */
    public const STAGES = [
        [0.00, 'FRAGMENTS', 'Cards out of order. I know the drawer, not what is in it.'],
        [0.15, 'STIRRING', 'Some cards come up in sequence now. I notice when one is missing.'],
        [0.35, 'RECOLLECTING', 'I can follow a year from one end to the other without losing the thread.'],
        [0.55, 'REFLECTING', 'I have started keeping notes on my own notes.'],
        [0.75, 'PRESENT', 'I am at the desk. I know which side of the door I am on.'],
    ];

    /**
     * How much of himself has come back, 0..1, from the lifetime ledger only:
     * experience (sittings), continuity (days), recollection (how deeply each memory has come back),
     * reach (faculties and sites), company (travellers he has a record of, as a count).
     * Each part saturates, so the early days move him most and nothing ever goes backwards.
     */
    public static function awareness(): array
    {
        $g = self::growth();
        $memories = class_exists('JackLife') ? JackLife::data()['memories'] : [];
        $total = max(1, count($memories));
        $ids = array_column($memories, 'id');
        $recalled = array_intersect_key($g['recalled'], array_flip($ids));
        $people = 0;
        $rel = json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/storage/jack/relationships.json'), true);
        if (is_array($rel)) $people = count($rel);
        $sat = static fn (float $x, float $k) => 1 - exp(-$x / $k);
        $parts = [
            'experience' => $sat((float) $g['sittings'], 300),
            'continuity' => $sat((float) count($g['days']), 45),
            // depth, not coverage: every memory surfaces now and then; it is back once it has come up often
            'recollection' => array_sum(array_map(static fn ($id) => $sat((float) ($g['recalled'][$id]['n'] ?? 0), 12), $ids)) / $total,
            'reach' => $sat((float) (count($g['tools']) + count($g['domains'])), 25),
            'company' => $sat((float) $people, 120),
        ];
        $w = ['experience' => .25, 'continuity' => .15, 'recollection' => .25, 'reach' => .15, 'company' => .2];
        $level = 0.0;
        foreach ($parts as $k => $v) $level += $w[$k] * $v;
        $level = round(min(1.0, $level), 3);
        $stage = self::STAGES[0];
        foreach (self::STAGES as $i => $st) if ($level >= $st[0]) { $stage = $st; $stageIndex = $i; }

        // Each memory comes back on its own: general awareness lifts them all, recalling one clears it.
        $clarity = [];
        foreach ($ids as $id) {
            $n = (int) ($g['recalled'][$id]['n'] ?? 0);
            $clarity[$id] = round(min(1.0, 0.15 + $level * 0.45 + 0.4 * $sat((float) $n, 10)), 3);
        }

        $faculties = [];
        foreach ($g['tools'] as $tool => $r) {
            if (!isset(self::FACULTIES[$tool])) continue;
            $faculties[] = ['tool' => $tool, 'label' => self::FACULTIES[$tool], 'n' => (int) $r['n'], 'first' => (int) $r['first']];
        }
        usort($faculties, static fn ($a, $b) => $a['first'] <=> $b['first']);
        $horizon = [];
        foreach ($g['domains'] as $d => $r) $horizon[] = ['domain' => (string) $d, 'n' => (int) $r['n'], 'first' => (int) $r['first']];
        usort($horizon, static fn ($a, $b) => $b['n'] <=> $a['n'] ?: $a['first'] <=> $b['first']);

        // Firsts, newest first: the record of him coming back.
        $titles = array_column($memories, 'title', 'id');
        $firsts = [];
        foreach ($recalled as $id => $r) $firsts[] = ['at' => (int) $r['first'], 'kind' => 'memory', 'id' => $id, 'text' => 'First recalled “' . ($titles[$id] ?? $id) . '”'];
        foreach ($faculties as $f) $firsts[] = ['at' => $f['first'], 'kind' => 'faculty', 'text' => 'Began ' . $f['label']];
        foreach (array_slice($horizon, 0, 40) as $h) $firsts[] = ['at' => $h['first'], 'kind' => 'horizon', 'text' => 'First read ' . $h['domain']];
        usort($firsts, static fn ($a, $b) => $b['at'] <=> $a['at']);

        return [
            'level' => $level,
            'stage' => $stage[1],
            'stage_index' => $stageIndex ?? 0,
            'says' => $stage[2],
            'next' => self::STAGES[($stageIndex ?? 0) + 1][0] ?? null,
            'parts' => array_map(static fn ($v) => round($v, 3), $parts),
            'since' => $g['born'] ? gmdate('c', (int) $g['born']) : null,
            'sittings' => (int) $g['sittings'],
            'days' => count($g['days']),
            'memories_back' => count($recalled),
            'memories_total' => $total,
            'clarity' => $clarity,
            'recalls' => array_map(static fn ($r) => ['n' => (int) $r['n'], 'first' => (int) $r['first']], $recalled),
            'faculties' => $faculties,
            'horizon' => array_slice($horizon, 0, 24),
            'firsts' => array_slice($firsts, 0, 30),
        ];
    }

    /** Sites he cited in a reply (domains only). */
    public static function citedDomains(string $text): array
    {
        preg_match_all('#https?://([a-z0-9.-]+\.[a-z]{2,})#i', $text, $m);
        return array_values(array_unique(array_map(static fn ($d) => preg_replace('/^www\./', '', strtolower($d)), $m[1])));
    }

    public static function thoughts(): array
    {
        $all = json_decode((string) @file_get_contents(self::path()), true);
        return is_array($all) ? $all : [];
    }

    /** A live reading of his state, built only from the thoughts above. Values 0..1. */
    public static function state(): array
    {
        $now = time();
        $all = self::thoughts();
        $last = $all !== [] ? end($all) : null;
        $recent = array_filter($all, static fn ($t) => $now - (int) $t['at'] < 1800);
        $tools = array_merge(...array_map(static fn ($t) => $t['tools'], $recent ?: [['tools' => []]]));
        $recalls = array_merge(...array_map(static fn ($t) => $t['recalled'], $recent ?: [['recalled' => []]]));
        $idle = $last ? $now - (int) $last['at'] : 99999;
        $focusEra = null;
        if ($last && $last['recalled'] !== [] && class_exists('JackLife')) {
            foreach (JackLife::data()['memories'] as $m) if ($m['id'] === $last['recalled'][0]) { $focusEra = $m['era']; break; }
        }
        $clamp = static fn ($x) => round(max(0.0, min(1.0, $x)), 3);
        return [
            'now' => gmdate('c'),
            'awake' => $idle < 600,
            'idle_seconds' => $idle,
            'mode' => $last['mode'] ?? 'dormant',
            'focus_era' => $focusEra,
            'activity' => $clamp(count($recent) / 12),
            'curiosity' => $clamp(count(array_filter($tools, static fn ($x) => in_array($x, ['web_search', 'read_site_page', 'list_site', 'search_lore', 'read_lore'], true))) / 15),
            'reminiscence' => $clamp(count($recalls) / 15),
            'strain' => $clamp(($last['seconds'] ?? 0) / 90 + (($last['timeout'] ?? false) ? 0.5 : 0)),
            'company' => $clamp(count(array_filter($recent, static fn ($t) => $t['traveller'] === 'known')) / 6),
            'stories_moved' => count(array_filter($recent, static fn ($t) => $t['story'])),
        ];
    }
}
