<?php
declare(strict_types=1);

/**
 * Shared desk wiring for the body. No keys leave the server.
 * Lodge is testimony. Jack does not write canon.
 */

$ttgRoot = dirname(__DIR__, 2);
require_once $ttgRoot . '/inc/graph.php';
require_once $ttgRoot . '/app/AI/JackPolicy.php';
require_once $ttgRoot . '/app/AI/JackRelationship.php';
$ttgRoomAutoload = $ttgRoot . '/app/JackRoom/autoload.php';
if (is_file($ttgRoomAutoload)) {
    require_once $ttgRoomAutoload;
}

function ttg_body_json(array $row, int $code = 200): never
{
    http_response_code($code);
    header('Cache-Control: no-store');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** @return list<array{slug:string,title:string,type:string,status:string,place:string}> */
function ttg_body_search(string $query, int $limit = 8): array
{
    $q = function_exists('mb_strtolower') ? mb_strtolower(trim($query)) : strtolower(trim($query));
    if ($q === '') {
        return [];
    }
    $hits = [];
    $seen = [];
    $pool = array_merge(ttg_graph_unique_nodes(), ttg_graph_pending());
    foreach ($pool as $n) {
        if (!is_array($n)) {
            continue;
        }
        $slug = (string) ($n['slug'] ?? '');
        if ($slug === '' || isset($seen[$slug])) {
            continue;
        }
        $hay = function_exists('mb_strtolower')
            ? mb_strtolower(
                (string) ($n['title'] ?? '') . ' ' .
                (string) ($n['type'] ?? '') . ' ' .
                (string) ($n['place'] ?? '') . ' ' .
                (function_exists('ttg_graph_meta') ? ttg_graph_meta($n, 'place') : '') . ' ' .
                (string) ($n['body'] ?? '') . ' ' .
                $slug
            )
            : strtolower((string) ($n['title'] ?? '') . ' ' . (string) ($n['body'] ?? '') . ' ' . $slug);
        if (!str_contains($hay, $q)) {
            continue;
        }
        $seen[$slug] = true;
        $hits[] = [
            'slug' => $slug,
            'title' => (string) ($n['title'] ?? ''),
            'type' => (string) ($n['type'] ?? ''),
            'status' => (string) ($n['status'] ?? (!empty($n['pending']) ? 'PENDING' : '')),
            'place' => function_exists('ttg_graph_meta') && ttg_graph_meta($n, 'place') !== ''
                ? ttg_graph_meta($n, 'place')
                : (string) ($n['place'] ?? ''),
        ];
        if (count($hits) >= $limit) {
            break;
        }
    }
    return $hits;
}

/** @return list<array{id:string,box:?int,card:string}> */
function ttg_body_habitat_cards(int $limit = 6): array
{
    if (!class_exists('RoomStore')) {
        return [];
    }
    try {
        $store = new RoomStore();
        $store->boot();
        $slips = [];
        foreach ($store->all(false) as $obj) {
            if ($obj->kind !== 'slip') {
                continue;
            }
            $slips[] = $obj;
        }
        usort($slips, static function ($a, $b): int {
            return strcmp((string) $b->createdAt, (string) $a->createdAt);
        });
        $out = [];
        foreach (array_slice($slips, 0, $limit) as $obj) {
            $out[] = [
                'id' => $obj->id,
                'box' => $obj->box,
                'card' => $obj->card !== '' ? $obj->card : $obj->title,
            ];
        }
        return $out;
    } catch (Throwable $e) {
        return [];
    }
}

function ttg_body_write_ready(): bool
{
    if (!class_exists('RoomStore')) {
        return false;
    }
    try {
        $store = new RoomStore();
        $store->boot();
        return $store->writeReady();
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * @return array{
 *   summary:string,
 *   threads:list<string>,
 *   lastConsequence:?string,
 *   leaves:list<array>,
 *   cards:list<array>,
 *   write_ready:bool
 * }
 */
function ttg_body_meeting(): array
{
    $hits = [];
    foreach (['meeting', 'cube', 'testimony', '5081', 'hollerith'] as $q) {
        foreach (ttg_body_search($q, 6) as $hit) {
            $hits[$hit['slug']] = $hit;
        }
    }
    $cards = ttg_body_habitat_cards(6);
    $viewer = ttg_graph_viewer();
    $rel = JackRelationship::load(JackPolicy::subjectKey($viewer));
    $threads = [];
    foreach ($rel['unresolvedThreads'] ?? [] as $t) {
        if (is_string($t) && trim($t) !== '') {
            $threads[] = trim($t);
        }
    }
    $lines = [];
    $last = isset($rel['lastConsequence']) && is_string($rel['lastConsequence'])
        ? trim($rel['lastConsequence'])
        : '';
    if ($last !== '') {
        $lines[] = $last;
    }
    foreach (array_slice($threads, 0, 4) as $t) {
        $lines[] = $t;
    }
    foreach (array_slice(array_values($hits), 0, 4) as $h) {
        $status = (string) ($h['status'] ?? '');
        $lines[] = $h['title'] . ($status !== '' ? ' · ' . $status : '');
    }
    foreach (array_slice($cards, 0, 3) as $c) {
        $box = $c['box'] !== null ? ('BOX ' . $c['box'] . ': ') : '';
        $lines[] = $box . $c['card'];
    }
    $summary = trim(implode(' ', array_slice($lines, 0, 5)));
    if ($summary === '') {
        $summary = 'No meeting has been lodged from this cube yet. WRITE BACK holds it as testimony. It does not become canon.';
    }
    return [
        'summary' => $summary,
        'threads' => array_slice($threads, 0, 5),
        'lastConsequence' => $last !== '' ? $last : null,
        'leaves' => array_values(array_slice($hits, 0, 8)),
        'cards' => $cards,
        'write_ready' => ttg_body_write_ready(),
    ];
}

function ttg_body_boot(): array
{
    ttg_graph_boot_session();
    $viewer = ttg_graph_viewer();
    $field = function_exists('ttg_now_field') ? ttg_now_field() : ['nodes' => []];
    $greeting = function_exists('ttg_graph_jack_greeting')
        ? ttg_graph_jack_greeting($viewer, $field['nodes'] ?? [])
        : 'The clerk is at the desk.';
    return [
        'ok' => true,
        'connected' => true,
        'csrf' => ttg_graph_csrf(),
        'jack_endpoint' => '/now/jack',
        'jack_speak' => '/jack/speak',
        'opening' => 'You are in my room inside the cube — desk, tap, hopper, and me. Ask what you need, or click a station.',
        'clerk' => [
            'available' => function_exists('ttg_openai_configured') && ttg_openai_configured(),
            'voice' => function_exists('ttg_eleven_configured') && ttg_eleven_configured(),
            'greeting' => $greeting,
        ],
        'you' => [
            'known' => !empty($viewer['known']),
            'first' => (string) ($viewer['first'] ?? ''),
        ],
        'meeting' => ttg_body_meeting(),
        'canon' => false,
    ];
}

function ttg_body_require_ingest(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;
    $root = dirname(__DIR__, 2);
    require_once $root . '/app/AI/AgentRequest.php';
    require_once $root . '/app/AI/AgentTurnResult.php';
    require_once $root . '/app/AI/Providers/AgentModelAdapter.php';
    require_once $root . '/app/AI/Providers/OpenAIResponsesAdapter.php';
    require_once $root . '/app/AI/JackAgent.php';
    require_once $root . '/app/AI/JackCharacter.php';
    require_once $root . '/app/AI/JackTurn.php';
    require_once $root . '/app/AI/JackIngest.php';
}

function ttg_body_punch_card(string $text): array
{
    $empty = ['ok' => false, 'object' => null, 'error' => 'no_habitat'];
    if (!class_exists('RoomDispatcher') || !class_exists('RoomObject')) {
        return $empty;
    }
    $card = RoomObject::cleanCard($text);
    if ($card === '') {
        return ['ok' => false, 'object' => null, 'error' => 'empty_title'];
    }
    try {
        $disp = new RoomDispatcher(new RoomStore());
        $disp->actor = 'JACK';
        $r = $disp->dispatch('write_box', ['card' => $card]);
        if (!empty($r['ok']) && isset($r['object']) && is_array($r['object'])) {
            return ['ok' => true, 'object' => $r['object'], 'error' => ''];
        }
        return ['ok' => false, 'object' => null, 'error' => (string) ($r['error'] ?? 'rejected')];
    } catch (Throwable $e) {
        return ['ok' => false, 'object' => null, 'error' => 'rejected'];
    }
}

function ttg_body_mark_meeting(array $viewer, string $note): void
{
    $rel = JackRelationship::load(JackPolicy::subjectKey($viewer));
    if (($rel['standing'] ?? '') !== 'withdrawn' && ($rel['standing'] ?? '') !== 'keeper') {
        $rel['standing'] = 'contributor';
        $rel['trustStage'] = max(1, (int) ($rel['trustStage'] ?? 0));
    }
    $day = (new DateTimeImmutable('now'))->format('d.m.Y');
    $thread = 'Meeting in the cube · ' . $day;
    $threads = [];
    foreach ($rel['unresolvedThreads'] ?? [] as $t) {
        if (!is_string($t)) {
            continue;
        }
        $t = trim($t);
        if ($t === '' || str_starts_with($t, 'Meeting in the cube')) {
            continue;
        }
        $threads[] = $t;
    }
    array_unshift($threads, $thread);
    $rel['unresolvedThreads'] = array_slice($threads, 0, 5);
    $rel['lastConsequence'] = function_exists('mb_strlen') && mb_strlen($note) > 240
        ? mb_substr($note, 0, 237) . '…'
        : (strlen($note) > 240 ? substr($note, 0, 237) . '…' : $note);
    JackRelationship::save(JackRelationship::touch($viewer, $rel, 'clerk'));
}

/**
 * @return array<string, mixed>
 */
function ttg_body_remember(string $instruction, string $dossier): array
{
    ttg_body_require_ingest();
    $instruction = trim($instruction);
    if ($instruction === '') {
        $instruction = 'Remember this meeting in the cube.';
    }
    $dossier = trim($dossier);
    if ($dossier === '') {
        return [
            'ok' => false,
            'error' => 'There was no slip to hold.',
            'canon' => false,
        ];
    }
    $held = JackIngest::run($instruction, $dossier);
    $viewer = ttg_graph_viewer();
    $note = trim((string) ($held['text'] ?? ''));
    if ($note === '') {
        $note = 'A meeting in the cube was lodged as testimony. Not canon.';
    }
    ttg_body_mark_meeting($viewer, $note);

    $title = '';
    foreach ($held['nodes'] ?? [] as $n) {
        if (is_array($n) && (string) ($n['title'] ?? '') !== '') {
            $title = (string) $n['title'];
            break;
        }
    }
    $stamp = (new DateTimeImmutable('now'))->format('d.m.Y');
    $cardText = trim('MEETING ' . $stamp . ' ' . ($title !== '' ? $title : $instruction));
    $punch = ttg_body_punch_card($cardText);

    if ($note !== '') {
        ttg_jack_queue_speech($note);
    }

    return [
        'ok' => true,
        'ingested' => true,
        'canon' => false,
        'voice' => function_exists('ttg_eleven_configured') && ttg_eleven_configured(),
        'text' => $note,
        'nodes' => $held['nodes'] ?? [],
        'edges' => $held['edges'] ?? [],
        'card' => $punch['object'],
        'punch_error' => $punch['ok'] ? '' : (string) $punch['error'],
        'meeting' => ttg_body_meeting(),
    ];
}
