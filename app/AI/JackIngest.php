<?php
declare(strict_types=1);

/**
 * Jack lodges a dossier as pending leaves. He does not write canon.
 */
final class JackIngest
{
    public const MAX_CHARS = 100000;
    public const EXTRACT_CHARS = 24000;
    public const MAX_NODES = 20;
    public const MAX_EDGES = 30;
    public const INGEST_PER_DAY = 6;
    public const TALK_CHARS = 2000;

    public static function wantsLodge(string $intent, string $fileText): bool
    {
        return $intent === 'lodge' || $fileText !== '';
    }

    public static function fileText(?array $file): string
    {
        if (!is_array($file) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return '';
        }
        $tmp = (string) ($file['tmp_name'] ?? '');
        $size = (int) ($file['size'] ?? 0);
        $name = strtolower((string) ($file['name'] ?? ''));
        if ($tmp === '' || $size <= 0 || $size > 400_000 || !is_uploaded_file($tmp)) {
            return '';
        }
        if (!preg_match('/\.(txt|md|csv|text)$/', $name) && !str_starts_with((string) ($file['type'] ?? ''), 'text/')) {
            return '';
        }
        $raw = @file_get_contents($tmp);
        if (!is_string($raw) || str_contains($raw, "\0")) return '';
        return ttg_graph_redact_secrets($raw);
    }

    /**
     * @return array{text:string,nodes:list<array>,edges:list<array>,ops:list<array>}
     */
    public static function run(string $instruction, string $dossier): array
    {
        $instruction = trim($instruction);
        $dossier = ttg_graph_redact_secrets(trim($dossier));
        if (mb_strlen($dossier) > self::MAX_CHARS) {
            $dossier = mb_substr($dossier, 0, self::MAX_CHARS);
        }
        if ($dossier === '') {
            return [
                'text' => 'There was no dossier to hold.',
                'nodes' => [],
                'edges' => [],
                'ops' => [],
            ];
        }
        $titleGuess = self::sourceTitle($instruction, $dossier);
        if (ttg_graph_is_junk_slip($titleGuess, $dossier) || ttg_graph_is_junk_slip($instruction, $dossier)) {
            return [
                'text' => 'That slip is not a record. I have not filed it.',
                'nodes' => [],
                'edges' => [],
                'ops' => [],
            ];
        }

        $hash = ttg_graph_ip_hash();
        if (ttg_graph_ingest_count_today($hash) >= self::INGEST_PER_DAY) {
            return [
                'text' => 'The desk will not take another dossier from this position today. The field remains.',
                'nodes' => [],
                'edges' => [],
                'ops' => [],
            ];
        }

        $title = self::sourceTitle($instruction, $dossier);
        $id = ttg_graph_public_id();
        ttg_graph_hold_text($id, $dossier);

        $source = ttg_graph_propose_node([
            'title' => $title,
            'type' => 'DOCUMENT',
            'body' => 'A dossier was lodged with the clerk. Extracted matters sit as leaves until a keeper writes them. This is not canon.',
            'place' => 'unplaced',
            'year' => (int) date('Y'),
            'custodian' => 'jack',
            'jack_ingest' => true,
            'source_held' => true,
            'source_id' => $id,
        ]);
        if (empty($source['ok']) || empty($source['node']['slug'])) {
            return [
                'text' => (string) ($source['error'] ?? 'The field would not hold the dossier.'),
                'nodes' => [],
                'edges' => [],
                'ops' => [],
            ];
        }

        $sourceNode = $source['node'];
        $nodes = [$sourceNode];
        $edges = [];
        $slugs = [$sourceNode['slug']];

        $extracted = self::extract($instruction, $dossier);
        $created = 0;
        foreach (array_slice($extracted['nodes'], 0, self::MAX_NODES) as $row) {
            if (!is_array($row)) continue;
            $got = ttg_graph_propose_node([
                'title' => (string) ($row['title'] ?? ''),
                'type' => (string) ($row['type'] ?? 'UNKNOWN'),
                'body' => (string) ($row['body'] ?? ''),
                'place' => (string) ($row['place'] ?? ''),
                'year' => (int) ($row['year'] ?? date('Y')),
                'slug' => (string) ($row['match_slug'] ?? ''),
                'custodian' => 'jack',
                'jack_ingest' => true,
                'source_id' => $id,
            ]);
            if (empty($got['ok']) || empty($got['node']['slug'])) continue;
            $n = $got['node'];
            if (empty($got['existing'])) {
                $nodes[] = $n;
                $created++;
            }
            $slug = (string) $n['slug'];
            $slugs[] = $slug;
            $edge = ttg_graph_propose_edge($slug, $sourceNode['slug'], 'EXTRACTED_FROM', 0.4);
            if ($edge) $edges[] = self::publicEdge($edge);
        }

        foreach (array_slice($extracted['edges'], 0, self::MAX_EDGES) as $row) {
            if (!is_array($row)) continue;
            $a = self::resolveEnd((string) ($row['source'] ?? ''), $slugs);
            $b = self::resolveEnd((string) ($row['target'] ?? ''), $slugs);
            if ($a === '' || $b === '') continue;
            $edge = ttg_graph_propose_edge($a, $b, (string) ($row['relationship'] ?? 'POSSIBLY_RELATED_TO'), 0.35);
            if ($edge) $edges[] = self::publicEdge($edge);
        }

        $note = trim($extracted['clerk_note']);
        if ($note === '') {
            $note = $created > 0
                ? ('I have held the dossier and proposed ' . $created . ' further leaves. None of this is canon until a keeper writes it.')
                : 'I have held the dossier as one leaf. I could not yet classify its parts. It remains a proposal.';
        }

        $ops = [];
        foreach ($nodes as $n) {
            $ops[] = [
                'kind' => 'FOCUS',
                'slug' => (string) ($n['slug'] ?? ''),
                'label' => 'Show ' . (string) ($n['title'] ?? 'record'),
                'context' => JackTurn::focusContext($n + ['pending' => true]),
            ];
        }

        return [
            'text' => $note,
            'nodes' => $nodes,
            'edges' => $edges,
            'ops' => array_slice($ops, 0, 8),
        ];
    }

    private static function sourceTitle(string $instruction, string $dossier): string
    {
        if ($instruction !== '' && mb_strlen($instruction) <= 80 && mb_strlen($dossier) > mb_strlen($instruction) + 40) {
            return $instruction;
        }
        foreach (preg_split('/\R/', $dossier) ?: [] as $line) {
            $line = trim($line);
            if ($line !== '' && !str_starts_with($line, '#')) {
                return mb_strlen($line) > 80 ? mb_substr($line, 0, 77) . '…' : $line;
            }
        }
        return 'Lodged context · ' . (new DateTimeImmutable('now'))->format('d.m.Y');
    }

    /** @param list<string> $known */
    private static function resolveEnd(string $given, array $known): string
    {
        $given = trim($given);
        if ($given === '') return '';
        if (in_array($given, $known, true)) return $given;
        $hit = ttg_graph_find_existing($given, $given);
        return $hit ? (string) ($hit['slug'] ?? '') : '';
    }

    /** @param array<string, mixed> $edge */
    private static function publicEdge(array $edge): array
    {
        return [
            'source' => (string) ($edge['source'] ?? ''),
            'target' => (string) ($edge['target'] ?? ''),
            'relationship' => (string) ($edge['relationship'] ?? 'POSSIBLY_RELATED_TO'),
            'confidence' => isset($edge['confidence']) ? (float) $edge['confidence'] : 0.35,
            'pending' => true,
        ];
    }

    /**
     * @return array{clerk_note:string,nodes:list<array>,edges:list<array>}
     */
    private static function extract(string $instruction, string $dossier): array
    {
        $empty = ['clerk_note' => '', 'nodes' => [], 'edges' => []];
        if (!ttg_openai_configured()) return $empty;

        $window = mb_strlen($dossier) > self::EXTRACT_CHARS
            ? mb_substr($dossier, 0, self::EXTRACT_CHARS)
            : $dossier;

        $catalogue = [];
        foreach (ttg_graph_catalogue(64) as $n) {
            $catalogue[] = $n['slug'] . ' [' . $n['type'] . '] ' . $n['title'];
        }

        $req = new AgentRequest();
        $req->agent = 'jack';
        $req->model = ttg_openai_model();
        $req->timeoutSeconds = 70;
        $req->tools = [];
        $req->instructions = JackAgent::documentaryBrief() . <<<'TXT'

You are lodging a dossier into the graph as PROPOSALS only.
Return a single JSON object, no markdown, no commentary.
Shape:
{"clerk_note":"short clerkly English, no markdown","nodes":[{"title":"","type":"PERSON|OBJECT|PLACE|EVENT|MOMENT|MEDIA|SIGNAL|DOCUMENT|INSTITUTION|MISSION|UNKNOWN","body":"one or two sentences from the dossier, not invented","place":"","year":2026,"match_slug":""}],"edges":[{"source":"slug or title","target":"slug or title","relationship":"MENTIONS|OBSERVED_AT|VISITED|HOSTED|REMEMBERS|APPEARED_IN|POSSIBLY_RELATED_TO|EXTRACTED_FROM"}]}
Rules:
- Extract observed entities and relations. Do not invent.
- If a matter already exists in the catalogue, set match_slug to that slug and do not duplicate it.
- Unknown is valid. Inference is not observation.
- At most 20 nodes and 30 edges.
- clerk_note: tell the visitor what you held, that it is pending, that you do not write canon.
TXT;
        $req->contextText = "Existing public records (match these rather than duplicating):\n" . implode("\n", $catalogue);
        $req->userMessage = ($instruction !== '' ? "Instruction: {$instruction}\n\n" : '')
            . "Dossier:\n" . $window;
        $req->requestId = 'ingest-' . bin2hex(random_bytes(6));

        $adapter = new OpenAIResponsesAdapter();
        $result = $adapter->run($req);
        if (!$result->ok) return $empty;

        $raw = trim($result->text);
        if (str_starts_with($raw, '```')) {
            $raw = preg_replace('/^```(?:json)?\s*/i', '', $raw) ?? $raw;
            $raw = preg_replace('/\s*```$/', '', $raw) ?? $raw;
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            $start = strpos($raw, '{');
            $end = strrpos($raw, '}');
            if ($start !== false && $end !== false && $end > $start) {
                $data = json_decode(substr($raw, $start, $end - $start + 1), true);
            }
        }
        if (!is_array($data)) return $empty;

        $nodes = $data['nodes'] ?? [];
        $edges = $data['edges'] ?? [];
        return [
            'clerk_note' => is_string($data['clerk_note'] ?? null) ? $data['clerk_note'] : '',
            'nodes' => is_array($nodes) ? $nodes : [],
            'edges' => is_array($edges) ? $edges : [],
        ];
    }
}
