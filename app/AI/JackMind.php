<?php
declare(strict_types=1);

/**
 * Jack's mind, as it can be shown: a ring of his recent thoughts and a live state built from them.
 * Read by /jack/mind.php for the mind display (ffilm.org/mindform).
 *
 * PRIVACY: only Jack's side is recorded. Never what a visitor said, who they are, or what he replied:
 * the mode he was in, which of his own memories surfaced (and their evidence images), which tools he
 * used, which sites he cited, and how long he took. storage/ is denied to the web.
 */
final class JackMind
{
    private const MAX = 40;

    public static function path(): string { return dirname(__DIR__, 2) . '/storage/jack/mind.json'; }

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
        $dir = dirname(self::path());
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $fp = @fopen(self::path(), 'c+');
        if ($fp === false) return;
        try {
            if (!flock($fp, LOCK_EX)) return;
            $raw = stream_get_contents($fp);
            $all = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
            if (!is_array($all)) $all = [];
            $all[] = $t;
            $all = array_slice($all, -self::MAX);
            rewind($fp); ftruncate($fp, 0); fwrite($fp, json_encode($all, JSON_UNESCAPED_SLASHES)); fflush($fp);
            flock($fp, LOCK_UN);
        } finally {
            fclose($fp);
        }
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
