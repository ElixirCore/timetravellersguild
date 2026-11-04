<?php
declare(strict_types=1);

/**
 * Personal limb — a private working branch opened by a sitting.
 * Held off the public tree until the person consents AND Jack finds it relevant.
 * Then it may be proposed as pending (still not canon until a keeper punches).
 */

const TTG_LIMB_DIR = 'play/limbs';

function ttg_limb_root(): string
{
    $base = dirname(__DIR__) . '/storage/' . TTG_LIMB_DIR;
    if (!is_dir($base)) {
        @mkdir($base, 0770, true);
    }
    return $base;
}

function ttg_limb_empty(string $id = ''): array
{
    $now = gmdate('c');
    return [
        'v' => 1,
        'id' => $id !== '' ? $id : ('limb-' . bin2hex(random_bytes(6))),
        'owner_key' => '',
        'people_slug' => '',
        'consent' => false,
        'jack_relevant' => null,
        'status' => 'holding',
        'proposed_ids' => [],
        'person' => [
            'name' => '',
            'place' => '',
            'note' => '',
        ],
        'nodes' => [],
        'edges' => [],
        'questions' => [],
        'thread' => [],
        'started' => $now,
        'updated' => $now,
    ];
}

function ttg_limb_id_ok(string $id): bool
{
    return (bool) preg_match('/^limb-[a-f0-9]{8,32}$/', $id);
}

function ttg_limb_path(string $id): string
{
    return ttg_limb_root() . '/' . $id . '.json';
}

function ttg_limb_clip(string $s, int $max): string
{
    $s = trim($s);
    if ($s === '') return '';
    if (function_exists('mb_substr')) return mb_substr($s, 0, $max);
    return substr($s, 0, $max);
}

function ttg_limb_node_id(string $prefix, string $title): string
{
    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $title) ?? '');
    $slug = trim($slug, '-');
    if ($slug === '') $slug = 'x';
    if (strlen($slug) > 40) $slug = substr($slug, 0, 40);
    return $prefix . '-' . $slug;
}

function ttg_limb_clean(mixed $raw): array
{
    $out = ttg_limb_empty();
    if (!is_array($raw)) return $out;
    $id = trim((string) ($raw['id'] ?? ''));
    if (ttg_limb_id_ok($id)) $out['id'] = $id;
    $out['owner_key'] = ttg_limb_clip((string) ($raw['owner_key'] ?? ''), 120);
    $out['people_slug'] = ttg_limb_clip((string) ($raw['people_slug'] ?? ''), 80);
    $out['consent'] = !empty($raw['consent']);
    if (array_key_exists('jack_relevant', $raw)) {
        $jr = $raw['jack_relevant'];
        $out['jack_relevant'] = $jr === null ? null : !empty($jr);
    }
    $status = strtolower(trim((string) ($raw['status'] ?? 'holding')));
    if (!in_array($status, ['holding', 'ready', 'proposed', 'canon'], true)) $status = 'holding';
    $out['status'] = $status;
    $person = is_array($raw['person'] ?? null) ? $raw['person'] : [];
    $out['person'] = [
        'name' => ttg_limb_clip((string) ($person['name'] ?? ''), 80),
        'place' => ttg_limb_clip((string) ($person['place'] ?? ''), 80),
        'note' => ttg_limb_clip((string) ($person['note'] ?? ''), 280),
    ];
    $nodes = [];
    foreach ((array) ($raw['nodes'] ?? []) as $n) {
        if (!is_array($n)) continue;
        $nid = preg_replace('/[^a-z0-9\-]/', '', strtolower((string) ($n['id'] ?? '')));
        $title = ttg_limb_clip((string) ($n['title'] ?? ''), 120);
        if ($nid === '' || $title === '') continue;
        $type = strtoupper(ttg_limb_clip((string) ($n['type'] ?? 'UNKNOWN'), 40));
        $layer = strtolower(ttg_limb_clip((string) ($n['layer'] ?? 'leaf'), 20));
        if (!in_array($layer, ['root', 'trunk', 'branch', 'leaf', 'fruit'], true)) $layer = 'leaf';
        $year = (int) ($n['year'] ?? (int) date('Y'));
        if ($year < 1 || $year > 2200) $year = (int) date('Y');
        $nodes[] = [
            'id' => $nid,
            'title' => $title,
            'type' => $type,
            'body' => ttg_limb_clip((string) ($n['body'] ?? ''), 800),
            'place' => ttg_limb_clip((string) ($n['place'] ?? ''), 120),
            'layer' => $layer,
            'year' => $year,
        ];
        if (count($nodes) >= 24) break;
    }
    $out['nodes'] = $nodes;
    $edges = [];
    $seenE = [];
    foreach ((array) ($raw['edges'] ?? []) as $e) {
        if (!is_array($e)) continue;
        $s = preg_replace('/[^a-z0-9\-]/', '', strtolower((string) ($e['source'] ?? '')));
        $t = preg_replace('/[^a-z0-9\-]/', '', strtolower((string) ($e['target'] ?? '')));
        $rel = strtoupper(ttg_limb_clip((string) ($e['relationship'] ?? 'RELATED_TO'), 40));
        if ($s === '' || $t === '' || $s === $t) continue;
        $key = $s . '>' . $rel . '>' . $t;
        if (isset($seenE[$key])) continue;
        $seenE[$key] = true;
        $edges[] = [
            'source' => $s,
            'target' => $t,
            'relationship' => $rel,
            'why' => ttg_limb_clip((string) ($e['why'] ?? ''), 200),
        ];
        if (count($edges) >= 40) break;
    }
    $out['edges'] = $edges;
    $qs = [];
    foreach ((array) ($raw['questions'] ?? []) as $q) {
        $q = ttg_limb_clip((string) $q, 200);
        if ($q === '' || in_array($q, $qs, true)) continue;
        $qs[] = $q;
        if (count($qs) >= 8) break;
    }
    $out['questions'] = $qs;
    $thread = [];
    foreach ((array) ($raw['thread'] ?? []) as $line) {
        $line = ttg_limb_clip((string) $line, 400);
        if ($line === '') continue;
        $thread[] = $line;
        if (count($thread) >= 24) break;
    }
    $out['thread'] = $thread;
    $pids = [];
    foreach ((array) ($raw['proposed_ids'] ?? []) as $pid) {
        $pid = ttg_limb_clip((string) $pid, 40);
        if ($pid === '') continue;
        $pids[] = $pid;
        if (count($pids) >= 12) break;
    }
    $out['proposed_ids'] = $pids;
    foreach (['started', 'updated'] as $key) {
        $v = trim((string) ($raw[$key] ?? ''));
        if ($v !== '' && preg_match('/^\d{4}-\d{2}-\d{2}T/', $v)) {
            $out[$key] = substr($v, 0, 40);
        }
    }
    return $out;
}

function ttg_limb_read(string $id): ?array
{
    if (!ttg_limb_id_ok($id)) return null;
    $path = ttg_limb_path($id);
    if (!is_file($path)) return null;
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? ttg_limb_clean($data) : null;
}

function ttg_limb_write(array $limb): array
{
    $limb = ttg_limb_clean($limb);
    $limb['updated'] = gmdate('c');
    if (($limb['started'] ?? '') === '') $limb['started'] = $limb['updated'];
    $path = ttg_limb_path($limb['id']);
    $json = json_encode($limb, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (!is_string($json) || $json === '') return $limb;
    $tmp = $path . '.tmp';
    if (@file_put_contents($tmp, $json . "\n", LOCK_EX) === false) return $limb;
    @rename($tmp, $path);
    return $limb;
}

function ttg_limb_owner_key(?array $viewer = null): string
{
    if (class_exists('JackPolicy') && is_callable(['JackPolicy', 'subjectKey'])) {
        $viewer ??= function_exists('ttg_graph_viewer') ? ttg_graph_viewer() : [];
        return (string) JackPolicy::subjectKey($viewer);
    }
    if (session_status() === PHP_SESSION_ACTIVE && session_id() !== '') {
        return 'session:' . substr(hash('sha256', session_id()), 0, 16);
    }
    return 'anon:' . substr(hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? 'x')), 0, 16);
}

function ttg_limb_upsert_node(array $limb, array $node): array
{
    $limb = ttg_limb_clean($limb);
    $id = (string) ($node['id'] ?? '');
    $found = false;
    foreach ($limb['nodes'] as $i => $n) {
        if (($n['id'] ?? '') === $id) {
            $limb['nodes'][$i] = array_merge($n, $node, ['id' => $id]);
            $found = true;
            break;
        }
    }
    if (!$found) $limb['nodes'][] = $node;
    return ttg_limb_clean($limb);
}

function ttg_limb_upsert_edge(array $limb, string $source, string $target, string $rel, string $why = ''): array
{
    $limb = ttg_limb_clean($limb);
    foreach ($limb['edges'] as $e) {
        if (($e['source'] ?? '') === $source && ($e['target'] ?? '') === $target && ($e['relationship'] ?? '') === $rel) {
            return $limb;
        }
    }
    $limb['edges'][] = [
        'source' => $source,
        'target' => $target,
        'relationship' => $rel,
        'why' => $why,
    ];
    return ttg_limb_clean($limb);
}

/**
 * Open or refresh a personal limb from a sitting (name + optional place/note).
 */
function ttg_limb_open_from_play(array $play, ?array $viewer = null): array
{
    $name = trim((string) ($play['name'] ?? ''));
    if ($name === '') return ttg_limb_empty();

    $limbId = trim((string) ($play['limb_id'] ?? ''));
    $limb = ttg_limb_id_ok($limbId) ? ttg_limb_read($limbId) : null;
    if (!$limb) {
        $limb = ttg_limb_empty('limb-' . bin2hex(random_bytes(6)));
        $limb['owner_key'] = ttg_limb_owner_key($viewer);
    }

    $place = trim((string) ($play['place'] ?? ''));
    $note = trim((string) ($play['note'] ?? ''));
    $year = (int) date('Y');
    $limb['person'] = ['name' => $name, 'place' => $place, 'note' => $note];

    $personId = ttg_limb_node_id('person', $name);
    $limb = ttg_limb_upsert_node($limb, [
        'id' => $personId,
        'title' => $name,
        'type' => 'PERSON',
        'body' => 'A traveller who sat with Jack. Personal limb. Not on the public tree.',
        'place' => $place !== '' ? $place : 'unplaced',
        'layer' => 'trunk',
        'year' => $year,
    ]);

    if ($place !== '') {
        $placeId = ttg_limb_node_id('place', $place);
        $limb = ttg_limb_upsert_node($limb, [
            'id' => $placeId,
            'title' => $place,
            'type' => 'PLACE',
            'body' => 'Where ' . $name . ' spoke from at the sitting.',
            'place' => $place,
            'layer' => 'trunk',
            'year' => $year,
        ]);
        $limb = ttg_limb_upsert_edge($limb, $personId, $placeId, 'LOCATED_AT', 'Spoken from at the sitting.');
    }

    if ($note !== '') {
        $noteId = ttg_limb_node_id('note', substr($note, 0, 40));
        $limb = ttg_limb_upsert_node($limb, [
            'id' => $noteId,
            'title' => 'What they carry',
            'type' => 'RECOLLECTION',
            'body' => $note,
            'place' => $place !== '' ? $place : 'the blotter',
            'layer' => 'leaf',
            'year' => $year,
        ]);
        $limb = ttg_limb_upsert_edge($limb, $personId, $noteId, 'REMEMBERS', 'Filed at the sitting.');
        if ($place !== '') {
            $placeId = ttg_limb_node_id('place', $place);
            $limb = ttg_limb_upsert_edge($limb, $noteId, $placeId, 'OBSERVED_AT', 'Carried into this place.');
        }
    }

    $limb['questions'] = ttg_limb_seed_questions($limb);
    return ttg_limb_write($limb);
}

function ttg_limb_seed_questions(array $limb): array
{
    $qs = [];
    $person = $limb['person'] ?? [];
    if (trim((string) ($person['note'] ?? '')) === '') {
        $qs[] = 'What entered the field with you — an image, object, memory, question or discrepancy?';
    }
    if (trim((string) ($person['place'] ?? '')) === '') {
        $qs[] = 'Where does this begin for you?';
    }
    $qs[] = 'What came immediately before this, that a later witness would need?';
    if (count($limb['nodes'] ?? []) < 4) {
        $qs[] = 'Who else touches this record, with their consent?';
    }
    return array_slice(array_values(array_unique($qs)), 0, 5);
}

/**
 * After Jack answers: chain the reply onto the limb and refresh open questions.
 *
 * @param list<string> $unresolved
 */
function ttg_limb_jack_chain(array $limb, string $visitorLine, string $jackReply, array $unresolved = []): array
{
    $limb = ttg_limb_clean($limb);
    $visitorLine = ttg_limb_clip($visitorLine, 400);
    $jackReply = ttg_limb_clip($jackReply, 800);
    if ($visitorLine !== '') $limb['thread'][] = 'Visitor: ' . $visitorLine;
    if ($jackReply !== '') $limb['thread'][] = 'Clerk: ' . $jackReply;
    if (count($limb['thread']) > 24) $limb['thread'] = array_slice($limb['thread'], -24);

    $personName = (string) ($limb['person']['name'] ?? 'traveller');
    $personId = ttg_limb_node_id('person', $personName);
    $year = (int) date('Y');

    if ($visitorLine !== '') {
        $beadId = 'bead-' . substr(hash('sha256', $visitorLine . microtime(true)), 0, 10);
        $limb = ttg_limb_upsert_node($limb, [
            'id' => $beadId,
            'title' => ttg_limb_clip($visitorLine, 80),
            'type' => 'TESTIMONY',
            'body' => $visitorLine,
            'place' => (string) ($limb['person']['place'] ?? 'the blotter'),
            'layer' => 'branch',
            'year' => $year,
        ]);
        $limb = ttg_limb_upsert_edge($limb, $personId, $beadId, 'REMEMBERS', 'Spoken to the clerk.');

        // Causal chain: link to the previous testimony bead if any.
        $prev = null;
        foreach ($limb['nodes'] as $n) {
            if (($n['type'] ?? '') === 'TESTIMONY' && ($n['id'] ?? '') !== $beadId) {
                $prev = $n;
            }
        }
        if ($prev) {
            $limb = ttg_limb_upsert_edge(
                $limb,
                (string) $prev['id'],
                $beadId,
                'RELATED_TO',
                'Chained on the personal limb in the order spoken.'
            );
        }
    }

    $qs = [];
    foreach ($unresolved as $q) {
        $q = ttg_limb_clip((string) $q, 200);
        if ($q === '') continue;
        $qs[] = $q;
    }
    if ($qs === []) {
        $qs = ttg_limb_seed_questions($limb);
        // Drop questions already answered by having enough beads.
        if (count(array_filter($limb['nodes'], static fn ($n) => ($n['type'] ?? '') === 'TESTIMONY')) >= 2) {
            $qs = array_values(array_filter($qs, static function ($q) {
                return !str_contains(strtolower($q), 'entered the field');
            }));
        }
    }
    $limb['questions'] = array_slice($qs, 0, 5);

    // Jack relevance: a usable causal holding (person + place + at least one linked testimony).
    $hasPlace = trim((string) ($limb['person']['place'] ?? '')) !== '';
    $testimonies = count(array_filter($limb['nodes'], static fn ($n) => ($n['type'] ?? '') === 'TESTIMONY'));
    $edgeCount = count($limb['edges']);
    if ($hasPlace && $testimonies >= 1 && $edgeCount >= 2) {
        $limb['jack_relevant'] = true;
        if ($limb['consent'] && $limb['status'] === 'holding') {
            $limb['status'] = 'ready';
        }
    } elseif ($limb['jack_relevant'] !== true) {
        $limb['jack_relevant'] = false;
    }

    return ttg_limb_write($limb);
}

function ttg_limb_set_consent(array $limb, bool $consent): array
{
    $limb = ttg_limb_clean($limb);
    $limb['consent'] = $consent;
    if ($consent && $limb['jack_relevant'] === true && $limb['status'] === 'holding') {
        $limb['status'] = 'ready';
    }
    if (!$consent && $limb['status'] === 'ready') {
        $limb['status'] = 'holding';
    }
    $limb = ttg_limb_write($limb);
    if ($consent && $limb['jack_relevant'] === true) {
        $limb = ttg_limb_propose_public($limb);
    }
    return $limb;
}

function ttg_limb_attach_people(array $limb, string $slug, string $displayName = ''): array
{
    $limb = ttg_limb_clean($limb);
    $limb['people_slug'] = ttg_limb_clip($slug, 80);
    if ($displayName !== '' && ($limb['person']['name'] ?? '') === '') {
        $limb['person']['name'] = ttg_limb_clip($displayName, 80);
    }
    $limb['owner_key'] = 'user:' . $limb['people_slug'];
    return ttg_limb_write($limb);
}

/**
 * Propose the personal limb onto the public pending inbox.
 * Requires consent AND jack_relevant. Still not canon.
 */
function ttg_limb_propose_public(array $limb): array
{
    $limb = ttg_limb_clean($limb);
    if (!$limb['consent'] || $limb['jack_relevant'] !== true) {
        return $limb;
    }
    if ($limb['status'] === 'proposed' || $limb['status'] === 'canon') {
        return $limb;
    }
    if (!function_exists('ttg_graph_propose_node')) {
        return $limb;
    }

    $name = (string) ($limb['person']['name'] ?? '');
    if ($name === '') return $limb;

    $proposed = [];
    $person = ttg_graph_propose_node([
        'title' => $name,
        'type' => 'PERSON',
        'body' => 'Personal limb proposed with consent. Jack found it relevant. Not yet canon.'
            . (($limb['person']['note'] ?? '') !== '' ? "\n\n" . $limb['person']['note'] : ''),
        'place' => (string) ($limb['person']['place'] ?? ''),
        'custodian' => 'jack',
        'jack_ingest' => true,
        'source_held' => true,
        'source_id' => $limb['id'],
    ]);
    if (!empty($person['ok']) && !empty($person['node']['slug'])) {
        $proposed[] = (string) $person['node']['slug'];
        $personSlug = (string) $person['node']['slug'];
    } else {
        return $limb;
    }

    $placeTitle = trim((string) ($limb['person']['place'] ?? ''));
    if ($placeTitle !== '') {
        $place = ttg_graph_propose_node([
            'title' => $placeTitle,
            'type' => 'PLACE',
            'body' => 'Place on a consented personal limb. Not yet canon.',
            'place' => $placeTitle,
            'custodian' => 'jack',
            'source_id' => $limb['id'],
        ]);
        if (!empty($place['ok']) && !empty($place['node']['slug'])) {
            $proposed[] = (string) $place['node']['slug'];
            if (function_exists('ttg_graph_propose_edge')) {
                ttg_graph_propose_edge($personSlug, (string) $place['node']['slug'], 'LOCATED_AT', 0.45);
            }
        }
    }

    // Chain up to two testimony beads as pending DOCUMENT leaves.
    $linked = 0;
    foreach ($limb['nodes'] as $n) {
        if (($n['type'] ?? '') !== 'TESTIMONY') continue;
        $doc = ttg_graph_propose_node([
            'title' => (string) ($n['title'] ?? 'Testimony'),
            'type' => 'DOCUMENT',
            'body' => (string) ($n['body'] ?? ''),
            'place' => (string) ($n['place'] ?? $placeTitle),
            'year' => (int) ($n['year'] ?? date('Y')),
            'custodian' => 'jack',
            'source_id' => $limb['id'],
        ]);
        if (!empty($doc['ok']) && !empty($doc['node']['slug'])) {
            $proposed[] = (string) $doc['node']['slug'];
            if (function_exists('ttg_graph_propose_edge')) {
                ttg_graph_propose_edge($personSlug, (string) $doc['node']['slug'], 'REMEMBERS', 0.4);
            }
            $linked++;
        }
        if ($linked >= 2) break;
    }

    $limb['proposed_ids'] = array_values(array_unique(array_merge($limb['proposed_ids'], $proposed)));
    $limb['status'] = 'proposed';
    return ttg_limb_write($limb);
}

function ttg_limb_public(?array $limb): ?array
{
    if (!$limb) return null;
    $limb = ttg_limb_clean($limb);
    return [
        'id' => $limb['id'],
        'consent' => $limb['consent'],
        'jack_relevant' => $limb['jack_relevant'],
        'status' => $limb['status'],
        'people_slug' => $limb['people_slug'],
        'person' => $limb['person'],
        'nodes' => $limb['nodes'],
        'edges' => $limb['edges'],
        'questions' => $limb['questions'],
        'proposed_ids' => $limb['proposed_ids'],
        'started' => $limb['started'],
        'updated' => $limb['updated'],
    ];
}

function ttg_limb_for_play(?array $play = null): ?array
{
    $play ??= function_exists('ttg_play_read') ? ttg_play_read() : null;
    if (!is_array($play)) return null;
    $id = trim((string) ($play['limb_id'] ?? ''));
    if (!ttg_limb_id_ok($id)) return null;
    return ttg_limb_read($id);
}
