<?php
declare(strict_types=1);

/**
 * Jack's own life: his autobiographical memory, retrieved as he speaks.
 *
 *   lore/jack_life.json          eras, memories (JACK_REMEMBERS) and evidence (REAL artefacts with sources)
 *   lore/jack_life.vectors.json  an embedding per memory, built by: php app/AI/JackLife.php --build
 *
 * Every turn: the visitor's words are embedded and the nearest memories are recalled into Jack's
 * context, beneath a short spine of his whole life so he always knows who he is. If embeddings are
 * unavailable, recall falls back to word overlap. lore/ is denied to the web.
 */
final class JackLife
{
    private const MODEL = 'text-embedding-3-small';
    private static ?array $data = null;
    private static ?array $vectors = null;

    public static function path(): string { return dirname(__DIR__, 2) . '/lore/jack_life.json'; }
    public static function vectorsPath(): string { return dirname(__DIR__, 2) . '/lore/jack_life.vectors.json'; }

    public static function data(): array
    {
        if (self::$data === null) {
            $d = json_decode((string) @file_get_contents(self::path()), true);
            self::$data = is_array($d) ? $d : ['eras' => [], 'memories' => [], 'evidence' => []];
        }
        return self::$data;
    }

    public static function evidence(string $id): ?array
    {
        foreach (self::data()['evidence'] as $e) if ($e['id'] === $id) return $e;
        return null;
    }

    public static function era(string $id): ?array
    {
        foreach (self::data()['eras'] as $e) if ($e['id'] === $id) return $e;
        return null;
    }

    /** One line per era: always in his context, so he knows the whole shape of his life. */
    public static function spine(): string
    {
        $lines = [];
        foreach (self::data()['eras'] as $e) $lines[] = '- ' . $e['years'] . ' · ' . $e['title'] . ': ' . $e['line'];
        return implode("\n", $lines);
    }

    private static function memoryText(array $m): string
    {
        return $m['year'] . ' ' . $m['title'] . '. ' . $m['text'] . ' ' . implode(', ', $m['tags']);
    }

    /** @return list<float>|null */
    private static function embed(string $text, int $timeout = 8): ?array
    {
        static $memo = [];
        $key = md5($text);
        if (array_key_exists($key, $memo)) return $memo[$key];
        return $memo[$key] = self::embedNow($text, $timeout);
    }

    /** @return list<float>|null */
    private static function embedNow(string $text, int $timeout): ?array
    {
        if (!function_exists('ttg_env')) require_once dirname(__DIR__, 2) . '/inc/env.php';
        $key = ttg_env('OPENAI_API_KEY');
        if ($key === '') return null;
        $ch = curl_init('https://api.openai.com/v1/embeddings');
        if ($ch === false) return null;
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
            CURLOPT_POSTFIELDS => json_encode(['model' => self::MODEL, 'input' => mb_substr($text, 0, 6000)]),
        ]);
        $raw = curl_exec($ch);
        $data = is_string($raw) ? json_decode($raw, true) : null;
        $v = $data['data'][0]['embedding'] ?? null;
        return is_array($v) ? array_map('floatval', $v) : null;
    }

    private static function vectors(): array
    {
        if (self::$vectors === null) {
            $v = json_decode((string) @file_get_contents(self::vectorsPath()), true);
            self::$vectors = is_array($v['vectors'] ?? null) && ($v['model'] ?? '') === self::MODEL ? $v['vectors'] : [];
        }
        return self::$vectors;
    }

    private static function cosine(array $a, array $b): float
    {
        $dot = 0.0; $na = 0.0; $nb = 0.0;
        $n = min(count($a), count($b));
        for ($i = 0; $i < $n; $i++) { $dot += $a[$i] * $b[$i]; $na += $a[$i] * $a[$i]; $nb += $b[$i] * $b[$i]; }
        return $na > 0 && $nb > 0 ? $dot / (sqrt($na) * sqrt($nb)) : 0.0;
    }

    /**
     * How close $text comes in meaning to the nearest of $against, 0..1.
     * @param list<string> $against
     * @return float|null null when embeddings are unavailable
     */
    public static function closestMeaning(string $text, array $against): ?float
    {
        $v = self::embed($text);
        if ($v === null) return null;
        $best = 0.0;
        foreach ($against as $a) {
            $w = self::embed($a);
            if ($w === null) return null;
            $best = max($best, self::cosine($v, $w));
        }
        return $best;
    }

    private static function words(string $s): array
    {
        $w = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($s)) ?: [];
        return array_values(array_filter($w, static fn ($x) => mb_strlen($x) > 2));
    }

    /**
     * The memories nearest to what is being said.
     * @return list<array{memory:array,score:float,via:string}>
     */
    public static function recall(string $query, int $k = 3): array
    {
        $memories = self::data()['memories'];
        if ($memories === [] || trim($query) === '') return [];
        $scored = [];
        $vecs = self::vectors();
        $qv = $vecs !== [] ? self::embed($query) : null;
        if ($qv !== null) {
            foreach ($memories as $m) {
                if (isset($vecs[$m['id']])) $scored[] = ['memory' => $m, 'score' => self::cosine($qv, $vecs[$m['id']]), 'via' => 'meaning'];
            }
        }
        if ($scored === []) {
            $q = array_flip(self::words($query));
            preg_match_all('/\b(1[89]\d\d|20\d\d)\b/', $query, $years);
            foreach ($memories as $m) {
                $hay = self::words(self::memoryText($m));
                $hit = 0;
                foreach (array_unique($hay) as $w) if (isset($q[$w])) $hit++;
                foreach ($years[1] as $y) if (str_contains($m['year'], $y)) $hit += 3;
                if ($hit > 0) $scored[] = ['memory' => $m, 'score' => $hit / (3 + count($q)), 'via' => 'words'];
            }
        }
        usort($scored, static fn ($a, $b) => $b['score'] <=> $a['score']);
        return array_slice($scored, 0, $k);
    }

    /** A memory with its era and evidence, as the tool and the mind display see it. */
    public static function full(array $m): array
    {
        $era = self::era($m['era']);
        return [
            'id' => $m['id'], 'year' => $m['year'], 'title' => $m['title'], 'standing' => $m['standing'], 'text' => $m['text'],
            'era_id' => $m['era'],
            'era' => $era ? $era['years'] . ' · ' . $era['title'] : '',
            'evidence' => array_values(array_filter(array_map([self::class, 'evidence'], $m['evidence']))),
        ];
    }

    /** What Jack carries into every turn: the spine of his life and the memories this moment brings back. */
    public static function runtimeText(string $query): string
    {
        $lines = ['=== YOUR OWN LIFE (your autobiographical memory; JACK_REMEMBERS, not public fact) ==='];
        $lines[] = 'This is your life as you remember it. Speak of it as yours, in the first person, when it is relevant; 1951 may come in the present tense. Never recite it unprompted. Never present a memory as public historical fact: the artefacts beside them are REAL and sourced, the memories are yours. Use remember_my_life to recall more, with its evidence.';
        $lines[] = self::spine();
        $hits = self::recall($query, 3);
        if ($hits !== []) {
            $lines[] = 'Brought back by this moment:';
            foreach ($hits as $h) {
                $m = $h['memory'];
                $lines[] = '- [' . $m['id'] . '] ' . $m['year'] . ', "' . $m['title'] . '": ' . $m['text'];
            }
        }
        return implode("\n", $lines);
    }

    /** CLI: build the vectors file. */
    public static function build(): int
    {
        $out = ['model' => self::MODEL, 'built' => gmdate('c'), 'vectors' => []];
        foreach (self::data()['memories'] as $m) {
            $v = self::embed(self::memoryText($m), 30);
            if ($v === null) { fwrite(STDERR, "could not embed {$m['id']}\n"); return 1; }
            $out['vectors'][$m['id']] = array_map(static fn ($x) => round($x, 6), $v);
            echo "embedded {$m['id']}\n";
        }
        file_put_contents(self::vectorsPath(), json_encode($out));
        echo count($out['vectors']) . " vectors written\n";
        return 0;
    }
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__ && in_array('--build', $argv ?? [], true)) {
    require_once dirname(__DIR__, 2) . '/inc/env.php';
    exit(JackLife::build());
}
