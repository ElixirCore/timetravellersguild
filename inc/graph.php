<?php
declare(strict_types=1);

/**
 * Canonical graph helpers for timetravellersguild.com.
 *
 * Schema (technical spec §4–7, ontology v0.1):
 *   nodes: public_id, type, slug, title, body, visibility, status,
 *          observed_at, importance, href, metadata, tree, events
 *   edges: public_id, source, target, relationship, confidence, visibility
 *   time is a coordinate (observed_at / tree.year / tree.layer), not a feed sort.
 *   visibility: PUBLIC | GUILD | CIRCLE | PRIVATE | SEALED | DEPARTMENTAL | LOST
 *   Unknown is a valid state. Interpretation never silently becomes evidence.
 *
 * Node types (spec §5 + ontology): PERSON OBJECT PLACE EVENT MOMENT MEDIA
 * INSTITUTION MISSION SIGNAL DOCUMENT QUANTUM_TIN FILM_FRAGMENT MOONLY
 * DAILY_BREAD UNKNOWN
 *
 * The JSON files are the store on this PHP host. WebGL is a projection.
 * NOW is a bounded field (20–40), never an infinite chronological feed.
 *
 * Network present (canonical): 17 April 2033.
 * Local present: the visitor's clock.
 */

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/avatar.php';
require_once __DIR__ . '/briefing.php';
require_once __DIR__ . '/play.php';
require_once __DIR__ . '/feed-field.php';
require_once __DIR__ . '/track.php';

if (!function_exists('ttg_h')) {
    function ttg_h(string $v): string {
        return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

const TTG_NETWORK_PRESENT = '2033-04-17';
const TTG_NETWORK_PRESENT_LABEL = '17.04.2033';
const TTG_NOW_MIN = 20;
const TTG_NOW_MAX = 36;
const TTG_PERSON_CAP = 4;
const TTG_PENDING_IN_FIELD = 16;
const TTG_PENDING_MAX = 200;

function ttg_graph_root(?string $override = null): string {
    static $root = null;
    if ($override !== null) {
        $root = rtrim($override, '/');
        ttg_graph_nodes(true);
        ttg_graph_edges(true);
    }
    return $root ?? dirname(__DIR__) . '/graph';
}

function ttg_graph_boot_session(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['ttg_graph_csrf'])) {
        $_SESSION['ttg_graph_csrf'] = bin2hex(random_bytes(16));
    }
}

function ttg_graph_csrf(): string {
    ttg_graph_boot_session();
    return (string) $_SESSION['ttg_graph_csrf'];
}

function ttg_graph_csrf_ok(?string $given): bool {
    ttg_graph_boot_session();
    $stored = (string) ($_SESSION['ttg_graph_csrf'] ?? '');
    return $stored !== '' && is_string($given) && hash_equals($stored, $given);
}

function ttg_jack_queue_speech(string $text): void {
    ttg_graph_boot_session();
    $text = trim($text);
    if ($text === '') return;
    if (function_exists('mb_strlen') && mb_strlen($text) > 2000) {
        $text = mb_substr($text, 0, 2000);
    } elseif (strlen($text) > 2000) {
        $text = substr($text, 0, 2000);
    }
    $_SESSION['ttg_jack_speech'] = [
        'text' => $text,
        'exp' => time() + 600,
    ];
}

function ttg_jack_queued_speech(): string {
    ttg_graph_boot_session();
    $row = $_SESSION['ttg_jack_speech'] ?? null;
    if (!is_array($row)) return '';
    if ((int) ($row['exp'] ?? 0) < time()) return '';
    return trim((string) ($row['text'] ?? ''));
}

function ttg_jack_speech_ok(string $text): bool {
    $held = ttg_jack_queued_speech();
    return $held !== '' && hash_equals($held, $text);
}

function ttg_jack_rate_allow(string $bucket, int $limit, bool $consume = true): bool {
    ttg_graph_boot_session();
    if (!preg_match('/^[a-z]{1,16}$/', $bucket) || $limit < 1) {
        return false;
    }
    $hour = (int) floor(time() / 3600);
    $nKey = 'ttg_jack_' . $bucket . '_n';
    $hKey = 'ttg_jack_' . $bucket . '_h';
    $n = (int) ($_SESSION[$nKey] ?? 0);
    $window = (int) ($_SESSION[$hKey] ?? 0);
    if ($window !== $hour) {
        $_SESSION[$nKey] = 0;
        $_SESSION[$hKey] = $hour;
        $n = 0;
    }
    if ($n >= $limit) return false;
    if ($consume) {
        $_SESSION[$nKey] = $n + 1;
    }
    return true;
}

function ttg_jack_speak_rate_ok(): bool {
    return ttg_jack_rate_allow('speak', 24, true);
}

function ttg_graph_load(string $file): array {
    $path = ttg_graph_root() . '/' . $file;
    $raw = @file_get_contents($path);
    if ($raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function ttg_graph_save_locked(string $file, callable $mutator): bool {
    $path = ttg_graph_root() . '/' . $file;
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) return false;
    $fp = @fopen($path, 'c+');
    if ($fp === false) return false;
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return false;
    }
    rewind($fp);
    $raw = stream_get_contents($fp);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
    if (!is_array($data)) $data = [];
    $next = $mutator($data);
    if (!is_array($next)) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return false;
    }
    $json = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return false;
    }
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, $json . "\n");
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return true;
}

function ttg_graph_public_id(string $prefix = '01TTG'): string {
    return $prefix . strtoupper(bin2hex(random_bytes(11)));
}

function ttg_graph_nodes(bool $reload = false): array {
    static $nodes;
    if ($reload) $nodes = null;
    if ($nodes !== null) return $nodes;
    $nodes = [];
    foreach (ttg_graph_load('nodes.json') as $node) {
        if (!is_array($node)) continue;
        $slug = (string) ($node['slug'] ?? '');
        $pid = (string) ($node['public_id'] ?? '');
        if ($slug === '' && $pid === '') continue;
        if ($slug !== '') $nodes[$slug] = $node;
        if ($pid !== '' && $pid !== $slug) $nodes[$pid] = $node;
    }
    return $nodes;
}

function ttg_graph_edges(bool $reload = false): array {
    static $edges;
    if ($reload) $edges = null;
    if ($edges !== null) return $edges;
    $edges = [];
    foreach (ttg_graph_load('edges.json') as $edge) {
        if (is_array($edge)) $edges[] = $edge;
    }
    return $edges;
}

function ttg_graph_pending(): array {
    $out = [];
    foreach (ttg_graph_load('pending.json') as $node) {
        if (is_array($node)) $out[] = $node;
    }
    return $out;
}

function ttg_graph_unique_nodes(): array {
    $seen = [];
    $out = [];
    foreach (ttg_graph_nodes() as $node) {
        $key = (string) ($node['public_id'] ?? $node['slug'] ?? '');
        if ($key === '' || isset($seen[$key])) continue;
        $seen[$key] = true;
        $out[] = $node;
    }
    return $out;
}

function ttg_graph_node(string $id): ?array {
    $id = trim($id);
    if ($id === '') return null;
    $nodes = ttg_graph_nodes();
    if (isset($nodes[$id])) return $nodes[$id];
    foreach (ttg_graph_pending() as $node) {
        $slug = (string) ($node['slug'] ?? '');
        $pid = (string) ($node['public_id'] ?? '');
        if ($slug === $id || $pid === $id) return $node;
    }
    return null;
}

function ttg_graph_public(?array $node): bool {
    if (!$node) return false;
    $vis = strtoupper((string) ($node['visibility'] ?? 'PUBLIC'));
    return $vis === 'PUBLIC' || $vis === '';
}

function ttg_graph_year(array $node): int {
    if (isset($node['tree']['year'])) return (int) $node['tree']['year'];
    if (isset($node['light']['year'])) return (int) $node['light']['year'];
    $obs = (string) ($node['observed_at'] ?? '');
    if ($obs !== '' && ctype_digit(substr($obs, 0, 4))) return (int) substr($obs, 0, 4);
    return 0;
}

function ttg_graph_layer(array $node): string {
    $given = strtolower((string) ($node['tree']['layer'] ?? ''));
    if (in_array($given, ['root', 'trunk', 'branch', 'leaf', 'fruit'], true)) return $given;
    $status = strtoupper((string) ($node['status'] ?? ''));
    $type = strtoupper((string) ($node['type'] ?? ''));
    $year = ttg_graph_year($node);
    $nowY = (int) date('Y');
    if ($type === 'MISSION' && $status === 'COMPLETED') return 'fruit';
    if (in_array($type, ['MOMENT', 'MEDIA', 'SIGNAL', 'FILM_FRAGMENT'], true) && $year >= $nowY) return 'leaf';
    if ($status === 'INTENDS' || $year > $nowY) return 'branch';
    if ($year > 0 && $year <= 2014) return 'root';
    if ($year > 0 && $year < $nowY - 5) return 'root';
    if ($type === 'MISSION') return 'branch';
    return 'trunk';
}

function ttg_graph_canonical(array $node): string {
    $slug = (string) ($node['slug'] ?? $node['public_id'] ?? '');
    return $slug !== '' ? '/n/' . rawurlencode($slug) . '/' : '/n/';
}

function ttg_graph_href(array $node): string {
    $href = (string) ($node['href'] ?? '');
    return $href !== '' ? $href : ttg_graph_canonical($node);
}

function ttg_graph_meta(array $node, string $key, string $fallback = ''): string {
    $meta = $node['metadata'] ?? [];
    if (!is_array($meta)) return $fallback;
    $v = $meta[$key] ?? $fallback;
    return is_scalar($v) ? (string) $v : $fallback;
}

function ttg_graph_viewer(): array {
    $position = 'PRE-TRAVEL CIVILISATION';
    $anon = [
        'known' => false,
        'name' => null,
        'first' => null,
        'slug' => null,
        'email' => null,
        'href' => '/people/auth/',
        'position' => $position,
        'avatar' => ttg_pixel_default(),
    ];
    $cookie = (string) ($_COOKIE['ttg_people_session'] ?? '');
    if ($cookie === '') return $anon;
    $db = dirname(__DIR__) . '/people/inc/db.php';
    if (!is_file($db)) return $anon;
    try {
        require_once $db;
        if (!function_exists('ttg_current_user')) return $anon;
        $user = ttg_current_user();
        if (!$user || !is_array($user)) return $anon;
        $name = trim((string) ($user['display_name'] ?? ''));
        if ($name === '') return $anon;
        $first = preg_split('/\s+/', $name)[0] ?? $name;
        $avatar = ttg_pixel_parse($user['avatar'] ?? ($user['avatar_pixels'] ?? ''));
        return [
            'known' => true,
            'name' => $name,
            'first' => $first,
            'slug' => (string) ($user['slug'] ?? ''),
            'email' => strtolower(trim((string) ($user['email'] ?? ''))),
            'href' => '/people/profile/',
            'position' => $position,
            'avatar' => $avatar,
        ];
    } catch (Throwable $e) {
        return $anon;
    }
}

function ttg_guild_member(?array $viewer = null): bool {
    $viewer ??= ttg_graph_viewer();
    return !empty($viewer['known']);
}

function ttg_guild_keeper(?array $viewer = null): bool {
    $viewer ??= ttg_graph_viewer();
    if (empty($viewer['known'])) return false;
    $slugs = preg_split('/[,\s]+/', strtolower(trim((string) ttg_env('JACK_KEEPER_SLUGS', 'tobywhy')))) ?: [];
    $emails = preg_split('/[,\s]+/', strtolower(trim((string) ttg_env('JACK_KEEPER_EMAILS', '')))) ?: [];
    $slug = strtolower(trim((string) ($viewer['slug'] ?? '')));
    $email = strtolower(trim((string) ($viewer['email'] ?? '')));
    return ($slug !== '' && in_array($slug, $slugs, true)) || ($email !== '' && in_array($email, $emails, true));
}

function ttg_html_navigator_dock(?array $viewer = null): string {
    if (!ttg_guild_keeper($viewer)) return '';
    $path = rtrim((string) (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: ''), '/') ?: '';
    $cur = $path === '/navigator' ? ' aria-current="page"' : '';
    return '<a href="/navigator"' . $cur . '>NAVIGATOR</a>';
}

/** Guild wordmark linking home. Optional place stamp after the mark. */
function ttg_html_site_mark(string $place = '', string $tag = 'p', string $class = 'site-mark'): string {
    $tag = preg_match('/^[a-z][a-z0-9]*$/i', $tag) ? strtolower($tag) : 'p';
    $class = preg_match('/^[a-z][a-z0-9_-]*$/i', $class) ? $class : 'site-mark';
    $home = '<a href="/">TIMETRAVELLERSGUILD.COM</a>';
    $place = trim($place);
    $inner = $place === '' ? $home : $home . ' · ' . ttg_h($place);
    return '<' . $tag . ' class="' . $class . '">' . $inner . '</' . $tag . '>';
}

function ttg_html_navigator_door(?array $viewer = null, string $verb = 'DOOR'): string {
    if (!ttg_guild_keeper($viewer)) return '';
    return '<a class="door" href="/navigator"><b>' . ttg_h($verb) . '</b> THE NAVIGATOR</a>';
}

function ttg_graph_pending_edges(): array {
    $out = [];
    foreach (ttg_graph_load('pending-edges.json') as $edge) {
        if (is_array($edge)) $out[] = $edge;
    }
    return $out;
}

function ttg_graph_all_edges(): array {
    return array_merge(ttg_graph_edges(), ttg_graph_pending_edges());
}

/*
 * JACK'S INFERENCE. His own links between existing records, and context he appends to them, kept in
 * storage/jack/inferences.json and written only by JackThought. Nothing here is canon and nothing here
 * ever reaches graph/*.json: the functions above stay pure, so accepting, rejecting and saving canon can
 * never pick it up. Added only where the graph is displayed, always marked. If this file is missing or
 * unreadable the site simply shows canon. Delete it and the graph is exactly what the keepers made.
 */
const TTG_JACK_INFERS = 'JACK_INFERS';
const TTG_JACK_INFERENCE_LABEL = "JACK'S INFERENCE";

function ttg_graph_inference_items(): array {
    static $items = null;
    if ($items !== null) return $items;
    $items = [];
    $book = json_decode((string) @file_get_contents(dirname(__DIR__) . '/storage/jack/inferences.json'), true);
    if (!is_array($book) || !is_array($book['items'] ?? null)) return $items;
    $pending = [];
    foreach (ttg_graph_pending() as $p) $pending[(string) ($p['slug'] ?? '')] = true;
    $public = [];
    foreach (ttg_graph_unique_nodes() as $n) {
        $slug = (string) ($n['slug'] ?? '');
        if ($slug !== '' && !isset($pending[$slug]) && ttg_graph_public($n) && empty($n['pending'])) $public[$slug] = true;
    }
    foreach ($book['items'] as $i) {
        if (!is_array($i)) continue;
        // A record that has gone or turned private takes his inferences about it out of view.
        if (($i['kind'] ?? '') === 'link' && isset($public[(string) ($i['a'] ?? '')], $public[(string) ($i['b'] ?? '')])) $items[] = $i;
        if (($i['kind'] ?? '') === 'context' && isset($public[(string) ($i['on'] ?? '')])) $items[] = $i;
    }
    return $items;
}

function ttg_graph_inferred_edges(): array {
    $out = [];
    foreach (ttg_graph_inference_items() as $i) {
        if ($i['kind'] !== 'link') continue;
        $out[] = ['source' => (string) $i['a'], 'target' => (string) $i['b'], 'relationship' => TTG_JACK_INFERS, 'confidence' => null,
            'visibility' => 'PUBLIC', 'note' => (string) $i['note'], 'noted_by' => TTG_JACK_INFERENCE_LABEL, 'inferred' => true];
    }
    return $out;
}

/** Canon, proposals and his marked inferences: for drawing the graph only. Never for saving it. */
function ttg_graph_shown_edges(): array {
    return array_merge(ttg_graph_all_edges(), ttg_graph_inferred_edges());
}

/** A neighbour list with his marked links added, for display. */
function ttg_graph_add_inferences(string $slug, array $nb): array {
    foreach (ttg_graph_inferred_edges() as $e) {
        foreach ([['out', 'outgoing', 'source', 'target'], ['in', 'incoming', 'target', 'source']] as [$dir, $key, $me, $them]) {
            if ($e[$me] !== $slug) continue;
            $other = ttg_graph_node($e[$them]);
            if ($other && ttg_graph_public($other)) $nb[$key][] = ['edge' => $e, 'relationship' => TTG_JACK_INFERS, 'confidence' => null, 'node' => $other, 'direction' => $dir];
        }
    }
    return $nb;
}

/** Context he has appended to one record. */
function ttg_graph_inferred_context(string $slug): array {
    return array_values(array_filter(ttg_graph_inference_items(), static fn (array $i): bool => $i['kind'] === 'context' && $i['on'] === $slug));
}

function ttg_graph_neighbors(string $slug): array {
    $out = ['outgoing' => [], 'incoming' => []];
    foreach (ttg_graph_all_edges() as $edge) {
        $source = (string) ($edge['source'] ?? '');
        $target = (string) ($edge['target'] ?? '');
        $rel = (string) ($edge['relationship'] ?? 'POSSIBLY_RELATED_TO');
        $conf = $edge['confidence'] ?? null;
        if ($source === $slug) {
            $other = ttg_graph_node($target);
            if ($other && ttg_graph_public($other)) {
                $out['outgoing'][] = [
                    'edge' => $edge,
                    'relationship' => $rel,
                    'confidence' => $conf,
                    'node' => $other,
                    'direction' => 'out',
                ];
            }
        }
        if ($target === $slug) {
            $other = ttg_graph_node($source);
            if ($other && ttg_graph_public($other)) {
                $out['incoming'][] = [
                    'edge' => $edge,
                    'relationship' => $rel,
                    'confidence' => $conf,
                    'node' => $other,
                    'direction' => 'in',
                ];
            }
        }
    }
    return $out;
}

function ttg_graph_label_type(string $type): string {
    $type = str_replace('_', ' ', strtoupper($type));
    return $type !== '' ? $type : 'UNKNOWN';
}

function ttg_graph_observed_ts(array $node): int {
    $obs = (string) ($node['observed_at'] ?? '');
    if ($obs === '') return 0;
    $t = strtotime($obs);
    return $t === false ? 0 : $t;
}

function ttg_graph_is_unresolved(array $node): bool {
    $st = strtoupper((string) ($node['status'] ?? ''));
    return in_array($st, ['UNRESOLVED', 'PENDING', 'INTENDS', 'SEALED', 'SCHEDULED'], true)
        || strtoupper((string) ($node['type'] ?? '')) === 'UNKNOWN';
}

function ttg_graph_life(array $node): array {
    $slug = (string) ($node['slug'] ?? '');
    $nb = $slug !== '' ? ttg_graph_neighbors($slug) : ['outgoing' => [], 'incoming' => []];
    $moments = 0;
    $unresolved = 0;
    $remembered = 0;
    $evidence = [];
    $interpretation = ttg_graph_meta($node, 'interpretation');
    foreach (array_merge($nb['outgoing'], $nb['incoming']) as $row) {
        $other = $row['node'];
        $rel = (string) $row['relationship'];
        $otype = strtoupper((string) ($other['type'] ?? ''));
        if ($otype === 'MOMENT' || $rel === 'STAMPED' || $rel === 'OBSERVED_AT') $moments++;
        if (ttg_graph_is_unresolved($other) || $rel === 'POSSIBLY_RELATED_TO') $unresolved++;
        if ($rel === 'REMEMBERS') $remembered++;
        if ($rel === 'SUGGESTS') {
            $interp = ttg_graph_meta($other, 'interpretation');
            if ($interp !== '') $interpretation = $interp;
            elseif ($interpretation === '') $interpretation = (string) ($other['body'] ?? '');
        }
        if (!in_array($rel, ['SUGGESTS'], true)) {
            $evidence[] = [
                'label' => (string) ($other['title'] ?? ''),
                'via' => $rel,
                'slug' => (string) ($other['slug'] ?? ''),
                'type' => $otype,
                'direction' => (string) $row['direction'],
            ];
        }
    }
    $place = ttg_graph_meta($node, 'place');
    if ($place === '') {
        foreach ($nb['outgoing'] as $row) {
            if (in_array($row['relationship'], ['OBSERVED_AT', 'LOCATED_AT'], true)) {
                $place = (string) ($row['node']['title'] ?? '');
                break;
            }
        }
    }
    return [
        'place' => $place !== '' ? $place : 'unplaced',
        'custodian' => ttg_graph_meta($node, 'custodian', 'undisclosed'),
        'opening' => ttg_graph_meta($node, 'opening_condition'),
        'moments' => $moments,
        'unresolved' => $unresolved,
        'remembered_by' => $remembered,
        'evidence' => $evidence,
        'interpretation' => $interpretation !== '' ? $interpretation : null,
        'neighbors' => $nb,
        'links' => ttg_graph_links_from_neighbors($slug !== '' ? ttg_graph_add_inferences($slug, $nb) : $nb),
    ];
}

function ttg_graph_links_from_neighbors(array $nb): array {
    $out = [];
    $seen = [];
    foreach (array_merge($nb['outgoing'] ?? [], $nb['incoming'] ?? []) as $row) {
        $other = is_array($row['node'] ?? null) ? $row['node'] : [];
        $slug = (string) ($other['slug'] ?? '');
        $via = (string) ($row['relationship'] ?? '');
        $dir = (string) ($row['direction'] ?? '');
        $key = $slug;
        if ($slug === '' || isset($seen[$key])) continue;
        $seen[$key] = true;
        $out[] = [
            'slug' => $slug,
            'title' => (string) ($other['title'] ?? $slug),
            'type' => strtoupper((string) ($other['type'] ?? 'UNKNOWN')),
            'via' => $via !== '' ? $via : 'POSSIBLY_RELATED_TO',
            'direction' => $dir !== '' ? $dir : 'out',
            'year' => ttg_graph_year($other),
            'observed_at' => (string) ($other['observed_at'] ?? ''),
        ];
        if (count($out) >= 24) break;
    }
    return $out;
}

function ttg_graph_score(array $node, array $viewer, array $personEdges, int $now): float {
    $score = (float) ($node['importance'] ?? 0.3);
    $ts = ttg_graph_observed_ts($node);
    if ($ts > 0) {
        $ageDays = abs($now - $ts) / 86400;
        if ($ageDays < 14) $score += 0.18;
        elseif ($ageDays < 90) $score += 0.08;
    }
    $layer = ttg_graph_layer($node);
    if ($layer === 'trunk') $score += 0.06;
    if ($layer === 'leaf') $score += 0.05;
    $slug = (string) ($node['slug'] ?? '');
    if ($viewer['known'] && $slug !== '') {
        if (isset($personEdges[$slug])) $score += 0.16;
        $vslug = (string) ($viewer['slug'] ?? '');
        if ($vslug !== '' && ($slug === $vslug || strcasecmp((string) ($viewer['name'] ?? ''), (string) ($node['title'] ?? '')) === 0)) {
            $score += 0.22;
        }
        $place = strtolower(ttg_graph_meta($node, 'place') . ' ' . (string) ($node['title'] ?? ''));
        if (str_contains($place, 'wales') || str_contains($place, 'cardiff') || str_contains($place, 'swansea') || str_contains($place, 'abercrave')) {
            $score += 0.05;
        }
    }
    if (!empty($node['pending'])) $score += 0.12;
    return $score;
}

function ttg_graph_person_edge_set(array $viewer): array {
    $out = [];
    $slug = (string) ($viewer['slug'] ?? '');
    $name = strtolower((string) ($viewer['name'] ?? ''));
    $person = null;
    if ($slug !== '') $person = ttg_graph_node($slug);
    if (!$person && $name !== '') {
        foreach (ttg_graph_unique_nodes() as $node) {
            if (strtoupper((string) ($node['type'] ?? '')) !== 'PERSON') continue;
            if (strtolower((string) ($node['title'] ?? '')) === $name || strtolower((string) ($node['slug'] ?? '')) === $slug) {
                $person = $node;
                break;
            }
        }
    }
    if (!$person) {
        // Named founder record is the only person seed; match loosely on first name.
        $first = strtolower((string) ($viewer['first'] ?? ''));
        if ($first === 'toby' || $first === 'tobywhy') $person = ttg_graph_node('tobywhy');
    }
    if (!$person) return $out;
    $pslug = (string) ($person['slug'] ?? '');
    foreach (ttg_graph_edges() as $edge) {
        $s = (string) ($edge['source'] ?? '');
        $t = (string) ($edge['target'] ?? '');
        if ($s === $pslug) $out[$t] = true;
        if ($t === $pslug) $out[$s] = true;
    }
    $out[$pslug] = true;
    return $out;
}

function ttg_graph_project_node(array $node, array $viewer, array $personEdges): array {
    $life = ttg_graph_life($node);
    $slug = (string) ($node['slug'] ?? '');
    $near = $viewer['known'] && $slug !== '' && isset($personEdges[$slug]);
    $reasons = [];
    if ($near) $reasons[] = 'A direct relationship from your position.';
    if (!empty($node['pending'])) $reasons[] = 'Entered the field as a proposal. Not yet canon.';
    $layer = ttg_graph_layer($node);
    $reasons[] = match ($layer) {
        'root' => 'Established history. Below the trunk.',
        'branch' => 'An unresolved trajectory. Above the present.',
        'leaf' => 'An observation on the present.',
        'fruit' => 'A completed mission.',
        default => 'In the active present.',
    };
    if (!$viewer['known'] && $life['remembered_by'] > 0) {
        $reasons[] = $life['remembered_by'] === 1 ? '1 person remembers this.' : $life['remembered_by'] . ' people remember this.';
    }
    $punchHash = ttg_graph_meta($node, 'punch_hash');
    if ($punchHash !== '') {
        $reasons[] = 'Punched into canon. Irreversible.';
    }
    $body = trim((string) ($node['body'] ?? ''));
    if (strlen($body) > 220) $body = substr($body, 0, 217) . '…';
    return [
        'id' => (string) ($node['public_id'] ?? $slug),
        'slug' => $slug,
        'title' => (string) ($node['title'] ?? ''),
        'type' => (string) ($node['type'] ?? 'UNKNOWN'),
        'status' => (string) ($node['status'] ?? ''),
        'zone' => $layer,
        'importance' => (float) ($node['importance'] ?? 0),
        'observed_at' => (string) ($node['observed_at'] ?? ''),
        'year' => ttg_graph_year($node),
        'href' => ttg_graph_canonical($node),
        'open' => ttg_graph_href($node),
        'place' => $life['place'],
        'custodian' => $life['custodian'],
        'opening' => $life['opening'],
        'body' => $body,
        'moments' => $life['moments'],
        'unresolved' => $life['unresolved'],
        'remembered_by' => $life['remembered_by'],
        'near_you' => $near,
        'pending' => !empty($node['pending']),
        'punch' => [
            'hash' => $punchHash,
            'prev' => ttg_graph_meta($node, 'punch_prev'),
            'body_hash' => ttg_graph_meta($node, 'body_hash'),
            'irreversible' => $punchHash !== '',
        ],
        'why' => [
            'evidence' => $life['evidence'],
            'interpretation' => $life['interpretation'],
            'reasons' => $reasons,
        ],
        'links' => $life['links'],
    ];
}

function ttg_graph_now_nodes(): array {
    return array_map(static function (array $row): array {
        $n = ttg_graph_node((string) ($row['slug'] ?? ''));
        return is_array($n) ? $n : $row;
    }, ttg_now_field()['nodes'] ?? []);
}

function ttg_now_field(?array $viewer = null): array {
    static $cache = [];
    $viewer ??= ttg_graph_viewer();
    $ck = ($viewer['known'] ? 'k:' : 'a:') . (string) ($viewer['slug'] ?? '') . ':p' . ttg_play_bead_count() . ':f' . ttg_feed_relevant_count();
    if (isset($cache[$ck])) return $cache[$ck];
    $now = time();
    $personEdges = ttg_graph_person_edge_set($viewer);
    $candidates = [];
    foreach (ttg_graph_unique_nodes() as $node) {
        if (!ttg_graph_public($node)) continue;
        $candidates[] = $node;
    }
    $pending = ttg_graph_pending();
    usort($pending, static function (array $a, array $b): int {
        return ttg_graph_observed_ts($b) <=> ttg_graph_observed_ts($a);
    });
    foreach (array_slice($pending, 0, TTG_PENDING_IN_FIELD) as $node) {
        if (!ttg_graph_public($node)) continue;
        $node['pending'] = true;
        $candidates[] = $node;
    }

    $scored = [];
    foreach ($candidates as $i => $node) {
        $scored[] = [
            'i' => $i,
            'node' => $node,
            'score' => ttg_graph_score($node, $viewer, $personEdges, $now),
            'type' => strtoupper((string) ($node['type'] ?? 'UNKNOWN')),
        ];
    }
    usort($scored, static function (array $a, array $b): int {
        return $b['score'] <=> $a['score'];
    });

    $picked = [];
    $types = [];
    $people = 0;
    foreach ($scored as $row) {
        if (count($picked) >= ttg_play_field_max()) break;
        $type = $row['type'];
        if ($type === 'PERSON') {
            if ($people >= TTG_PERSON_CAP) continue;
            $people++;
        }
        $nType = $types[$type] ?? 0;
        if ($nType >= 8 && count($picked) >= TTG_NOW_MIN) continue;
        $types[$type] = $nType + 1;
        $picked[] = $row['node'];
    }

    $projected = [];
    $slugs = [];
    foreach ($picked as $node) {
        $p = ttg_graph_project_node($node, $viewer, $personEdges);
        $projected[] = $p;
        if ($p['slug'] !== '') $slugs[$p['slug']] = true;
    }
    foreach (ttg_play_field_nodes() as $bead) {
        $projected[] = $bead;
    }
    $feedPlates = ttg_feed_relevant_nodes();
    foreach ($feedPlates as $plate) {
        $projected[] = $plate;
        if ($plate['slug'] !== '') {
            $slugs[$plate['slug']] = true;
        }
    }

    $fieldEdges = [];
    foreach (ttg_graph_shown_edges() as $edge) {
        $s = (string) ($edge['source'] ?? '');
        $t = (string) ($edge['target'] ?? '');
        if ($s === '' || $t === '' || !isset($slugs[$s]) || !isset($slugs[$t])) continue;
        $fieldEdges[] = [
            'source' => $s,
            'target' => $t,
            'relationship' => (string) ($edge['relationship'] ?? 'POSSIBLY_RELATED_TO'),
            'confidence' => isset($edge['confidence']) ? (float) $edge['confidence'] : null,
        ];
    }
    foreach ($feedPlates as $plate) {
        foreach ($plate['links'] ?? [] as $link) {
            $ts = (string) ($link['slug'] ?? '');
            if ($ts === '' || !isset($slugs[$ts])) {
                continue;
            }
            $fieldEdges[] = [
                'source' => (string) $plate['slug'],
                'target' => $ts,
                'relationship' => 'CORROBORATES',
                'confidence' => 0.4,
            ];
        }
    }

    $out = [
        'nodes' => $projected,
        'edges' => $fieldEdges,
        'viewer' => $viewer,
    ];
    $cache[$ck] = $out;
    return $out;
}

function ttg_graph_doors(): array {
    $doors = [];
    foreach (ttg_graph_unique_nodes() as $node) {
        if (!ttg_graph_public($node)) continue;
        $tree = $node['tree'] ?? null;
        if (!is_array($tree) || ($tree['kind'] ?? '') !== 'door') continue;
        $doors[] = [
            'slug' => (string) ($node['slug'] ?? ''),
            'name' => (string) ($node['title'] ?? ''),
            'year' => (int) ($tree['year'] ?? ttg_graph_year($node)),
            'u' => (float) ($tree['u'] ?? 0.5),
            'href' => ttg_graph_href($node),
            'note' => (string) ($tree['note'] ?? $node['body'] ?? ''),
            'confirmed' => true,
            'type' => (string) ($node['type'] ?? ''),
            'node' => ttg_graph_canonical($node),
        ];
    }
    usort($doors, static function (array $a, array $b): int {
        if ($a['year'] !== $b['year']) return $a['year'] <=> $b['year'];
        return $a['u'] <=> $b['u'];
    });
    return $doors;
}

function ttg_graph_lights(): array {
    $lights = [];
    foreach (ttg_graph_unique_nodes() as $node) {
        if (!ttg_graph_public($node)) continue;
        $light = $node['light'] ?? null;
        if (!is_array($light)) continue;
        $lights[] = [
            'name' => (string) ($node['title'] ?? ''),
            'year' => (int) ($light['year'] ?? ttg_graph_year($node)),
            'state' => (string) ($light['state'] ?? 'stood'),
            'href' => (string) ($light['href'] ?? ttg_graph_href($node)),
            'note' => (string) ($light['note'] ?? $node['body'] ?? ''),
            'type' => (string) ($node['type'] ?? ''),
            'slug' => (string) ($node['slug'] ?? ''),
            'node' => ttg_graph_canonical($node),
        ];
    }
    usort($lights, static function (array $a, array $b): int {
        return $a['year'] <=> $b['year'];
    });
    return $lights;
}

function ttg_graph_now_index(): array {
    $out = [];
    foreach (ttg_now_field()['nodes'] as $node) {
        $out[] = [
            'slug' => (string) ($node['slug'] ?? ''),
            'title' => (string) ($node['title'] ?? ''),
            'type' => (string) ($node['type'] ?? ''),
            'year' => (int) ($node['year'] ?? 0),
            'href' => (string) ($node['href'] ?? ''),
            'open' => (string) ($node['open'] ?? ''),
            'status' => (string) ($node['status'] ?? ''),
        ];
    }
    return $out;
}

function ttg_graph_public_index(): array {
    $out = [];
    foreach (ttg_graph_unique_nodes() as $node) {
        if (!ttg_graph_public($node)) continue;
        $out[] = [
            'slug' => (string) ($node['slug'] ?? ''),
            'title' => (string) ($node['title'] ?? ''),
            'type' => (string) ($node['type'] ?? ''),
            'year' => ttg_graph_year($node),
            'href' => ttg_graph_canonical($node),
            'open' => ttg_graph_href($node),
            'status' => (string) ($node['status'] ?? ''),
        ];
    }
    usort($out, static function (array $a, array $b): int {
        return strcasecmp((string) $a['title'], (string) $b['title']);
    });
    return $out;
}

function ttg_graph_tod(int $hour): string {
    if ($hour < 5) return 'Night';
    if ($hour < 12) return 'Morning';
    if ($hour < 17) return 'Afternoon';
    return 'Evening';
}

function ttg_graph_jack_greeting(array $viewer, array $field): string {
    $tod = ttg_graph_tod((int) date('G'));
    $name = $viewer['known'] ? (string) $viewer['first'] : '';
    $addr = $name !== '' ? $tod . ', ' . $name . '.' : $tod . '.';
    $entered = 0;
    $unclassified = 0;
    $dept = false;
    $cut = time() - 86400 * 10;
    foreach ($field as $n) {
        $ts = strtotime((string) ($n['observed_at'] ?? '')) ?: 0;
        if ($ts >= $cut || !empty($n['pending'])) $entered++;
        if (strtoupper((string) ($n['type'] ?? '')) === 'UNKNOWN' || strtoupper((string) ($n['status'] ?? '')) === 'PENDING') {
            $unclassified++;
        }
        if (($n['slug'] ?? '') === 'det-01' || ($n['slug'] ?? '') === 'det-response') $dept = true;
    }
    $bits = [];
    if ($entered > 0) {
        $bits[] = $entered === 1
            ? 'One thing has entered the field since the last observation window.'
            : $entered . ' things have entered the field since the last observation window.';
    } else {
        $bits[] = 'The field is holding ' . count($field) . ' things that matter from here.';
    }
    if ($unclassified > 0) {
        $bits[] = $unclassified === 1 ? 'One remains unclassified.' : $unclassified . ' remain unclassified.';
    }
    if ($dept) $bits[] = 'The Department has a notice in the field.';
    $bits[] = 'Shall I show you?';
    return $addr . ' ' . implode(' ', $bits);
}

function ttg_now_payload(): array {
    ttg_graph_boot_session();
    $field = ttg_now_field();
    $viewer = $field['viewer'];
    $local = new DateTimeImmutable('now');
    $payload = [
        'generated_at' => gmdate('c'),
        'local_present' => $local->format('d.m.Y'),
        'network_present' => TTG_NETWORK_PRESENT_LABEL,
        'network_present_iso' => TTG_NETWORK_PRESENT,
        'position' => (string) $viewer['position'],
        'you' => [
            'known' => (bool) $viewer['known'],
            'name' => $viewer['name'],
            'first' => $viewer['first'],
            'href' => (string) $viewer['href'],
            'avatar' => ttg_pixel_parse($viewer['avatar'] ?? []),
        ],
        'csrf' => ttg_graph_csrf(),
        'play' => ttg_play_public(ttg_play_read()),
        'capture' => '/now/capture',
        'around' => '/now/around',
        'jack_endpoint' => '/now/jack',
        'jack_speak' => '/jack/speak',
        'jack' => [
            'greeting' => ttg_graph_jack_greeting($viewer, $field['nodes']),
            'voice' => function_exists('ttg_eleven_configured') && ttg_eleven_configured(),
        ],
        'projections' => ['TEMPORAL', 'SOCIAL', 'SPATIAL', 'INSTITUTIONAL', 'SYMBOLIC'],
        'field' => $field['nodes'],
        'edges' => $field['edges'],
        'doors' => ttg_graph_doors(),
        'lights' => ttg_graph_lights(),
        'now' => ttg_graph_now_index(),
    ];
    session_write_close();
    return $payload;
}

function ttg_now_around(string $slug): ?array {
    $slug = trim($slug);
    if ($slug === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $slug)) return null;
    $node = ttg_graph_node($slug);
    if (!$node || !ttg_graph_public($node)) return null;
    $viewer = ttg_graph_viewer();
    $personEdges = ttg_graph_person_edge_set($viewer);
    $life = ttg_graph_life($node);
    $picked = [$node];
    $seen = [$slug => true];
    foreach (array_merge($life['neighbors']['outgoing'] ?? [], $life['neighbors']['incoming'] ?? []) as $row) {
        if (count($picked) >= 18) break;
        $other = is_array($row['node'] ?? null) ? $row['node'] : null;
        if (!$other || !ttg_graph_public($other)) continue;
        $os = (string) ($other['slug'] ?? '');
        if ($os === '' || isset($seen[$os])) continue;
        $seen[$os] = true;
        $picked[] = $other;
    }
    $projected = [];
    foreach ($picked as $n) {
        $projected[] = ttg_graph_project_node($n, $viewer, $personEdges);
    }
    $fieldEdges = [];
    foreach (ttg_graph_shown_edges() as $edge) {
        $s = (string) ($edge['source'] ?? '');
        $t = (string) ($edge['target'] ?? '');
        if ($s === '' || $t === '' || !isset($seen[$s]) || !isset($seen[$t])) continue;
        $fieldEdges[] = [
            'source' => $s,
            'target' => $t,
            'relationship' => (string) ($edge['relationship'] ?? 'POSSIBLY_RELATED_TO'),
            'confidence' => isset($edge['confidence']) ? (float) $edge['confidence'] : null,
        ];
    }
    return [
        'ok' => true,
        'node' => $projected[0],
        'nodes' => $projected,
        'edges' => $fieldEdges,
    ];
}

function ttg_now_fallback_html(): string {
    $field = ttg_now_field();
    $nodes = $field['nodes'];
    usort($nodes, static function (array $a, array $b): int {
        $ay = (int) ($a['year'] ?? 0);
        $by = (int) ($b['year'] ?? 0);
        if ($ay !== $by) return $ay <=> $by;
        $at = (string) ($a['observed_at'] ?? '');
        $bt = (string) ($b['observed_at'] ?? '');
        if ($at !== $bt) return $at <=> $bt;
        return strcmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''));
    });
    $html = '';
    $last = null;
    foreach ($nodes as $node) {
        $year = (int) ($node['year'] ?? 0);
        $label = $year > 0 ? (string) $year : 'UNDATED';
        if ($label !== $last) {
            $html .= '<li class="fb-group">' . ttg_h($label) . '</li>';
            $last = $label;
        }
        $title = (string) ($node['title'] ?? '');
        $type = ttg_graph_label_type((string) ($node['type'] ?? 'UNKNOWN'));
        $status = (string) ($node['status'] ?? '');
        $place = (string) ($node['place'] ?? '');
        $canon = (string) ($node['href'] ?? '');
        $open = (string) ($node['open'] ?? '');
        $html .= '<li>';
        $html .= '<a href="' . ttg_h($canon) . '">' . ttg_h($title) . '</a>';
        $html .= ' — ' . ttg_h($type);
        if ($status !== '') $html .= ' · ' . ttg_h($status);
        if ($place !== '' && $place !== 'unplaced') $html .= '. Last observed: ' . ttg_h($place);
        if (!empty($node['pending'])) $html .= ' · PENDING';
        if ($open !== $canon && $open !== '') {
            $html .= ' <a href="' . ttg_h($open) . '">cross</a>';
        }
        $html .= '</li>';
    }
    return $html;
}

function ttg_graph_capture_types(): array {
    return ['PERSON', 'OBJECT', 'PLACE', 'MOMENT', 'MEDIA', 'SIGNAL', 'UNKNOWN'];
}

function ttg_graph_slugify(string $value): string {
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    $value = trim($value, '-');
    return $value !== '' ? $value : 'unclassified';
}

function ttg_graph_ip_hash(): string {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return hash('sha256', $ip . '|ttg-now-capture');
}

function ttg_graph_capture(array $input, ?array $file = null): array {
    $type = strtoupper(trim((string) ($input['type'] ?? 'UNKNOWN')));
    if (!in_array($type, ttg_graph_capture_types(), true)) $type = 'UNKNOWN';
    $title = trim((string) ($input['title'] ?? ''));
    $body = trim((string) ($input['body'] ?? ''));
    $place = trim((string) ($input['place'] ?? ''));
    if ($title === '') {
        return ['ok' => false, 'error' => 'A name is required.'];
    }
    if (strlen($title) > 120) $title = substr($title, 0, 120);
    if (strlen($body) > 2000) $body = substr($body, 0, 2000);
    if (strlen($place) > 120) $place = substr($place, 0, 120);

    $pending = ttg_graph_pending();
    $hash = ttg_graph_ip_hash();
    $dayAgo = time() - 86400;
    $recent = 0;
    foreach ($pending as $n) {
        $when = strtotime((string) ($n['created_at'] ?? '')) ?: 0;
        if (($n['ip_hash'] ?? '') === $hash && $when >= $dayAgo) $recent++;
    }
    if ($recent >= 8) {
        return ['ok' => false, 'error' => 'The field will not take more from this position today.'];
    }
    if (count($pending) >= TTG_PENDING_MAX) {
        return ['ok' => false, 'error' => 'The inbox is full. A keeper must accept proposals first.'];
    }

    $id = ttg_graph_public_id();
    $slug = 'pending-' . ttg_graph_slugify($title) . '-' . strtolower(substr($id, -6));
    $photoHeld = false;
    if (is_array($file) && (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
        $tmp = (string) ($file['tmp_name'] ?? '');
        $size = (int) ($file['size'] ?? 0);
        if ($tmp !== '' && is_uploaded_file($tmp) && $size > 0 && $size <= 2_000_000) {
            $info = @getimagesize($tmp);
            $ok = is_array($info) && in_array((int) $info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true);
            if ($ok) {
                $ext = match ((int) $info[2]) {
                    IMAGETYPE_PNG => 'png',
                    IMAGETYPE_WEBP => 'webp',
                    IMAGETYPE_GIF => 'gif',
                    default => 'jpg',
                };
                $destDir = ttg_graph_root() . '/inbox';
                if (!is_dir($destDir)) @mkdir($destDir, 0775, true);
                $dest = $destDir . '/' . $id . '.' . $ext;
                if (@move_uploaded_file($tmp, $dest)) $photoHeld = true;
            }
        }
    }

    $now = (new DateTimeImmutable('now'))->format('c');
    $node = [
        'public_id' => $id,
        'type' => $type,
        'slug' => $slug,
        'title' => $title,
        'body' => $body !== '' ? $body : 'Entered the field. Enrichment later.',
        'visibility' => 'PUBLIC',
        'status' => 'PENDING',
        'observed_at' => $now,
        'created_at' => $now,
        'importance' => 0.28,
        'pending' => true,
        'href' => '/n/' . $slug . '/',
        'metadata' => [
            'place' => $place !== '' ? $place : 'unplaced',
            'custodian' => 'proposer',
            'photo_held' => $photoHeld,
        ],
        'tree' => ['layer' => 'leaf', 'year' => (int) date('Y')],
        'ip_hash' => $hash,
    ];

    $ok = ttg_graph_save_locked('pending.json', static function (array $list) use ($node): array {
        $list[] = $node;
        return $list;
    });
    if (!$ok) return ['ok' => false, 'error' => 'The field could not be written.'];

    $public = $node;
    unset($public['ip_hash']);
    $viewer = ttg_graph_viewer();
    $projected = ttg_graph_project_node($public, $viewer, []);
    return ['ok' => true, 'node' => $projected];
}

function ttg_graph_propose_types(): array {
    return array_merge(ttg_graph_capture_types(), [
        'DOCUMENT', 'EVENT', 'INSTITUTION', 'MISSION', 'FILM_FRAGMENT',
    ]);
}

function ttg_graph_edge_relationships(): array {
    return [
        'POSSIBLY_RELATED_TO', 'OBSERVED_AT', 'VISITED', 'HOSTED', 'REMEMBERS',
        'APPEARED_IN', 'CLASSIFIED', 'USES', 'RELATED_TO', 'DERIVED_FROM',
        'EXTRACTED_FROM', 'MENTIONS', 'LOCATED_AT', 'STAMPED',
    ];
}

function ttg_graph_redact_secrets(string $text): string {
    $text = preg_replace('/sk-[A-Za-z0-9_\-]{10,}/', '[redacted]', $text) ?? $text;
    $text = preg_replace('/Bearer\s+[A-Za-z0-9._\-]+/i', 'Bearer [redacted]', $text) ?? $text;
    $text = preg_replace('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', '[email]', $text) ?? $text;
    $text = str_replace("\0", '', $text);
    return $text;
}

/** Accidental pastes that must not become public leaves. */
function ttg_graph_is_junk_slip(string $title, string $body = ''): bool
{
    $blob = $title . "\n" . $body;
    if (preg_match('#(?:https?://)?(?:[\w.-]+\.)?facebook\.com/dating\b#i', $blob)) {
        return true;
    }
    if (preg_match('#\bfacebook dating\b#i', $blob)) {
        return true;
    }
    if (preg_match('#l\.facebook\.com/l\.php#i', $blob)) {
        return true;
    }
    if (preg_match('#al_applink_data#i', $blob) && preg_match('#facebook#i', $blob)) {
        return true;
    }
    $alone = trim($body !== '' ? $body : $title);
    if (preg_match('#^https?://\S+$#', $alone)) {
        if (preg_match('#(?:facebook|instagram|tinder|tiktok)\.com#i', $alone)) {
            return true;
        }
        if (preg_match('#[?&](?:fbclid|gclid|al_applink)#i', $alone)) {
            return true;
        }
    }
    if (preg_match('#\bPRIVATE KEY\b#i', $title) || preg_match('#\b(?:seed phrase|mnemonic wallet)\b#i', $blob)) {
        return true;
    }
    $line = trim($title);
    if ($line !== '' && !str_contains($line, ' ') && preg_match('/^[A-Za-z0-9._-]{2,40}:[A-Za-z0-9!._-]{6,80}$/', $line)) {
        return true;
    }
    return false;
}

function ttg_graph_hold_text(string $id, string $text): bool {
    $dir = ttg_graph_root() . '/inbox';
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) return false;
    return @file_put_contents($dir . '/' . $id . '.txt', $text) !== false;
}

function ttg_graph_find_existing(string $title, string $slugHint = ''): ?array {
    $slugHint = ttg_graph_slugify($slugHint);
    $want = mb_strtolower(trim($title));
    if ($slugHint !== '' && $slugHint !== 'unclassified') {
        $hit = ttg_graph_node($slugHint);
        if ($hit && ttg_graph_public($hit)) return $hit;
    }
    if ($want === '') return null;
    $pool = ttg_graph_unique_nodes();
    foreach (ttg_graph_pending() as $n) {
        if (is_array($n)) $pool[] = $n;
    }
    foreach ($pool as $n) {
        if (!is_array($n) || !ttg_graph_public($n)) continue;
        $slug = (string) ($n['slug'] ?? '');
        $have = mb_strtolower((string) ($n['title'] ?? ''));
        if ($have === $want || $slug === $slugHint || $slug === ttg_graph_slugify($title)) {
            return $n;
        }
    }
    return null;
}

function ttg_graph_catalogue(int $limit = 80): array {
    $out = [];
    $seen = [];
    foreach (array_merge(ttg_graph_unique_nodes(), ttg_graph_pending()) as $n) {
        if (!is_array($n) || !ttg_graph_public($n)) continue;
        $slug = (string) ($n['slug'] ?? '');
        if ($slug === '' || isset($seen[$slug])) continue;
        $seen[$slug] = true;
        $out[] = [
            'slug' => $slug,
            'title' => (string) ($n['title'] ?? ''),
            'type' => (string) ($n['type'] ?? ''),
        ];
        if (count($out) >= $limit) break;
    }
    return $out;
}

function ttg_graph_ingest_count_today(string $hash): int {
    $dayAgo = time() - 86400;
    $n = 0;
    foreach (ttg_graph_pending() as $node) {
        $when = strtotime((string) ($node['created_at'] ?? '')) ?: 0;
        if ($when < $dayAgo) continue;
        if (($node['ip_hash'] ?? '') !== $hash) continue;
        if (($node['metadata']['jack_ingest'] ?? false) === true && strtoupper((string) ($node['type'] ?? '')) === 'DOCUMENT') {
            $n++;
        }
    }
    return $n;
}

/**
 * @param array{title:string,type?:string,body?:string,place?:string,year?:int,custodian?:string,jack_ingest?:bool,source_held?:bool,source_id?:string} $spec
 * @return array{ok:bool,node?:array,error?:string,existing?:bool}
 */
function ttg_graph_propose_node(array $spec): array {
    $title = trim((string) ($spec['title'] ?? ''));
    if ($title === '') return ['ok' => false, 'error' => 'A name is required.'];
    if (ttg_graph_is_junk_slip($title, (string) ($spec['body'] ?? ''))) {
        return ['ok' => false, 'error' => 'That slip is not a record.'];
    }
    if (strlen($title) > 120) $title = substr($title, 0, 120);
    $existing = ttg_graph_find_existing($title, (string) ($spec['slug'] ?? ''));
    if ($existing) {
        $viewer = ttg_graph_viewer();
        $public = $existing;
        unset($public['ip_hash']);
        return [
            'ok' => true,
            'existing' => true,
            'node' => ttg_graph_project_node($public, $viewer, []),
        ];
    }

    $type = strtoupper(trim((string) ($spec['type'] ?? 'UNKNOWN')));
    if (!in_array($type, ttg_graph_propose_types(), true)) $type = 'UNKNOWN';
    $body = ttg_graph_redact_secrets(trim((string) ($spec['body'] ?? '')));
    if (strlen($body) > 4000) $body = substr($body, 0, 3997) . '…';
    $place = trim((string) ($spec['place'] ?? ''));
    if (strlen($place) > 120) $place = substr($place, 0, 120);
    $year = (int) ($spec['year'] ?? (int) date('Y'));
    if ($year < 1 || $year > 2200) $year = (int) date('Y');

    $pending = ttg_graph_pending();
    if (count($pending) >= TTG_PENDING_MAX) {
        return ['ok' => false, 'error' => 'The inbox is full. A keeper must accept proposals first.'];
    }

    $id = ttg_graph_public_id();
    $slug = 'pending-' . ttg_graph_slugify($title) . '-' . strtolower(substr($id, -6));
    $now = (new DateTimeImmutable('now'))->format('c');
    $node = [
        'public_id' => $id,
        'type' => $type,
        'slug' => $slug,
        'title' => $title,
        'body' => $body !== '' ? $body : 'Entered the field from a lodged dossier. Not yet canon.',
        'visibility' => 'PUBLIC',
        'status' => 'PENDING',
        'observed_at' => $now,
        'created_at' => $now,
        'importance' => 0.34,
        'pending' => true,
        'href' => '/n/' . $slug . '/',
        'metadata' => [
            'place' => $place !== '' ? $place : 'unplaced',
            'custodian' => (string) ($spec['custodian'] ?? 'jack'),
            'jack_ingest' => !empty($spec['jack_ingest']),
            'source_held' => !empty($spec['source_held']),
            'source_id' => (string) ($spec['source_id'] ?? ''),
        ],
        'tree' => ['layer' => 'leaf', 'year' => $year],
        'ip_hash' => ttg_graph_ip_hash(),
    ];

    $ok = ttg_graph_save_locked('pending.json', static function (array $list) use ($node): array {
        $list[] = $node;
        return $list;
    });
    if (!$ok) return ['ok' => false, 'error' => 'The field could not be written.'];

    $public = $node;
    unset($public['ip_hash']);
    $viewer = ttg_graph_viewer();
    return ['ok' => true, 'existing' => false, 'node' => ttg_graph_project_node($public, $viewer, [])];
}

function ttg_graph_propose_edge(string $source, string $target, string $relationship, float $confidence = 0.35): ?array {
    $source = trim($source);
    $target = trim($target);
    if ($source === '' || $target === '' || $source === $target) return null;
    $relationship = strtoupper(trim($relationship));
    if (!in_array($relationship, ttg_graph_edge_relationships(), true)) {
        $relationship = 'POSSIBLY_RELATED_TO';
    }
    $confidence = max(0.1, min(0.7, $confidence));

    foreach (ttg_graph_all_edges() as $e) {
        if ((string) ($e['source'] ?? '') === $source
            && (string) ($e['target'] ?? '') === $target
            && (string) ($e['relationship'] ?? '') === $relationship) {
            return $e;
        }
    }

    $edge = [
        'public_id' => ttg_graph_public_id('01TTGE'),
        'source' => $source,
        'target' => $target,
        'relationship' => $relationship,
        'confidence' => $confidence,
        'pending' => true,
        'visibility' => 'PUBLIC',
    ];
    $ok = ttg_graph_save_locked('pending-edges.json', static function (array $list) use ($edge): array {
        $list[] = $edge;
        return $list;
    });
    return $ok ? $edge : null;
}

function ttg_graph_is_keeper(?array $viewer = null): bool {
    $viewer ??= ttg_graph_viewer();
    $auth = dirname(__DIR__) . '/app/JackOffice/autoload.php';
    if (is_file($auth)) {
        require_once $auth;
        if (class_exists('OfficeAuth')) {
            return OfficeAuth::mayUseOffice($viewer);
        }
    }
    return false;
}

/**
 * Jack’s hole-deck standing for a node. Type and known slugs, not invention.
 * @return array{glyph:string,roman:string,title:string,inherited:string}
 */
function ttg_graph_standing(array $node): array {
    $slug = strtolower((string) ($node['slug'] ?? ''));
    $title = strtolower((string) ($node['title'] ?? ''));
    $blob = $slug . ' ' . $title;
    $type = strtoupper((string) ($node['type'] ?? 'UNKNOWN'));

    $hit = static function (string $needle) use ($blob): bool {
        return $needle !== '' && str_contains($blob, $needle);
    };

    if ($hit('mabel')) {
        return ['glyph' => 'glyph-02-mabel', 'roman' => 'II', 'title' => 'MABEL', 'inherited' => 'The High Priestess'];
    }
    if ($hit('jack')) {
        return ['glyph' => 'glyph-09-jack', 'roman' => 'IX', 'title' => 'JACK AT THE DESK', 'inherited' => 'The Hermit'];
    }
    if ($hit('station-xiii') || $hit('station xiii') || $hit('station 13')) {
        return ['glyph' => 'glyph-13-station13', 'roman' => 'XIII', 'title' => 'STATION 13', 'inherited' => 'Death'];
    }
    if ($hit('chronometer')) {
        return ['glyph' => 'glyph-14-chronometer', 'roman' => 'XIV', 'title' => 'THE CHRONOMETER', 'inherited' => 'Temperance'];
    }
    if ($hit('abercrave') || $hit('house at')) {
        return ['glyph' => 'glyph-16-house', 'roman' => 'XVI', 'title' => 'THE HOUSE AT ABERCRAVE', 'inherited' => 'The Tower'];
    }
    if ($hit('elixir')) {
        return ['glyph' => 'glyph-15-elixircorp', 'roman' => 'XV', 'title' => 'ELIXIRCORP', 'inherited' => 'The Devil'];
    }
    if ($hit('moonly')) {
        return ['glyph' => 'glyph-07-moonly', 'roman' => 'VII', 'title' => 'MOONLY', 'inherited' => 'The Chariot'];
    }
    if ($hit('anamnesia')) {
        return ['glyph' => 'glyph-18-anamnesia', 'roman' => 'XVIII', 'title' => 'ANAMNESIA', 'inherited' => 'The Moon'];
    }
    if ($slug === 'guild' || $hit('canonical graph')) {
        return ['glyph' => 'glyph-21-graph', 'roman' => 'XXI', 'title' => 'THE CANONICAL GRAPH', 'inherited' => 'The World'];
    }
    if ($slug === 'department' || $hit('department of excess') || $hit('det-01') || $hit('det-response')) {
        return ['glyph' => 'glyph-05-department', 'roman' => 'V', 'title' => 'THE DEPARTMENT', 'inherited' => 'The Hierophant'];
    }
    if ($hit('consent')) {
        return ['glyph' => 'glyph-11-consent', 'roman' => 'XI', 'title' => 'CONSENT', 'inherited' => 'Strength'];
    }
    if ($hit('provenance') || $hit('founding record')) {
        return ['glyph' => 'glyph-08-provenance', 'roman' => 'VIII', 'title' => 'PROVENANCE', 'inherited' => 'Justice'];
    }
    if ($hit('arianrhod') || $hit('wheel')) {
        return ['glyph' => 'glyph-10-wheel', 'roman' => 'X', 'title' => "ARIANRHOD'S REEL", 'inherited' => 'Wheel of Fortune'];
    }

    $byType = [
        'UNKNOWN' => ['glyph' => 'glyph-00-unclassified', 'roman' => '0', 'title' => 'THE UNCLASSIFIED NODE', 'inherited' => 'The Fool'],
        'PERSON' => ['glyph' => 'glyph-01-operator', 'roman' => 'I', 'title' => 'THE OPERATOR', 'inherited' => 'The Magician'],
        'PLACE' => ['glyph' => 'glyph-03-territory', 'roman' => 'III', 'title' => 'THE TERRITORY', 'inherited' => 'The Empress'],
        'DOCUMENT' => ['glyph' => 'glyph-04-ledger', 'roman' => 'IV', 'title' => 'THE CONSTITUTIONAL LEDGER', 'inherited' => 'The Emperor'],
        'INSTITUTION' => ['glyph' => 'glyph-05-department', 'roman' => 'V', 'title' => 'THE DEPARTMENT', 'inherited' => 'The Hierophant'],
        'EVENT' => ['glyph' => 'glyph-06-edge', 'roman' => 'VI', 'title' => 'THE EDGE', 'inherited' => 'The Lovers'],
        'MOONLY' => ['glyph' => 'glyph-07-moonly', 'roman' => 'VII', 'title' => 'MOONLY', 'inherited' => 'The Chariot'],
        'QUANTUM_TIN' => ['glyph' => 'glyph-08-provenance', 'roman' => 'VIII', 'title' => 'PROVENANCE', 'inherited' => 'Justice'],
        'OBJECT' => ['glyph' => 'glyph-suit-record', 'roman' => '', 'title' => 'RECORD', 'inherited' => 'Pentacles'],
        'MISSION' => ['glyph' => 'glyph-suit-programme', 'roman' => '', 'title' => 'PROGRAMME', 'inherited' => 'Wands'],
        'SIGNAL' => ['glyph' => 'glyph-17-signal', 'roman' => 'XVII', 'title' => 'THE SIGNAL', 'inherited' => 'The Star'],
        'FILM_FRAGMENT' => ['glyph' => 'glyph-18-anamnesia', 'roman' => 'XVIII', 'title' => 'ANAMNESIA', 'inherited' => 'The Moon'],
        'MEDIA' => ['glyph' => 'glyph-19-recollection', 'roman' => 'XIX', 'title' => 'SIMULTANEOUS RECOLLECTION', 'inherited' => 'The Sun'],
        'MOMENT' => ['glyph' => 'glyph-14-chronometer', 'roman' => 'XIV', 'title' => 'THE CHRONOMETER', 'inherited' => 'Temperance'],
        'DAILY_BREAD' => ['glyph' => 'glyph-suit-recollection', 'roman' => '', 'title' => 'RECOLLECTION', 'inherited' => 'Cups'],
    ];
    if (isset($byType[$type])) return $byType[$type];
    if (!empty($node['pending'])) {
        return $byType['UNKNOWN'];
    }
    return $byType['UNKNOWN'];
}

/**
 * @param list<array<string,mixed>> $pending
 * @param list<array<string,mixed>> $canon
 * @param list<array<string,mixed>> $pendingEdges
 * @param list<array<string,mixed>> $canonEdges
 * @param array{at?:string,by?:string} $stamp
 * @return array{ok:bool,error?:string,node?:array,pending:list,canon:list,pending_edges:list,canon_edges:list,promoted_edges:list}
 */
function ttg_graph_confirm_apply(
    array $pending,
    array $canon,
    array $pendingEdges,
    array $canonEdges,
    string $id,
    array $stamp = []
): array {
    $id = trim($id);
    $empty = [
        'ok' => false,
        'pending' => $pending,
        'canon' => $canon,
        'pending_edges' => $pendingEdges,
        'canon_edges' => $canonEdges,
        'promoted_edges' => [],
    ];
    if ($id === '') {
        $empty['error'] = 'A slip is required.';
        return $empty;
    }

    $found = null;
    $rest = [];
    foreach ($pending as $node) {
        if (!is_array($node)) continue;
        $slug = (string) ($node['slug'] ?? '');
        $pid = (string) ($node['public_id'] ?? '');
        if ($found === null && ($slug === $id || $pid === $id)) {
            $found = $node;
            continue;
        }
        $rest[] = $node;
    }
    if (!$found) {
        $empty['error'] = 'That slip is not in the hopper.';
        $empty['pending'] = $rest;
        return $empty;
    }

    foreach ($canon as $node) {
        if (!is_array($node)) continue;
        if ((string) ($node['slug'] ?? '') === (string) ($found['slug'] ?? '')
            || (string) ($node['public_id'] ?? '') === (string) ($found['public_id'] ?? '')) {
            $empty['error'] = 'That record is already canon.';
            $empty['pending'] = $rest;
            return $empty;
        }
    }

    $body = (string) ($found['body'] ?? '');
    $meta = is_array($found['metadata'] ?? null) ? $found['metadata'] : [];
    $meta['classification'] = 'canon';
    $meta['confirmed_at'] = (string) ($stamp['at'] ?? (new DateTimeImmutable('now'))->format('c'));
    $meta['confirmed_by'] = (string) ($stamp['by'] ?? 'keeper');
    $meta['irreversible'] = true;
    if (!empty($stamp['punch_hash'])) $meta['punch_hash'] = (string) $stamp['punch_hash'];
    if (!empty($stamp['punch_prev'])) $meta['punch_prev'] = (string) $stamp['punch_prev'];
    if (!empty($stamp['body_hash'])) $meta['body_hash'] = (string) $stamp['body_hash'];
    unset($found['ip_hash']);
    $found['pending'] = false;
    if (strtoupper((string) ($found['status'] ?? '')) === 'PENDING') {
        $found['status'] = 'ACTIVE';
    }
    $found['metadata'] = $meta;
    $found['body'] = $body;
    $slug = (string) ($found['slug'] ?? '');
    if ($slug !== '') {
        $found['href'] = '/n/' . $slug . '/';
    }

    $canon[] = $found;
    $canonSlugs = [];
    foreach ($canon as $node) {
        $s = (string) ($node['slug'] ?? '');
        if ($s !== '') $canonSlugs[$s] = true;
    }

    $stillPending = [];
    $promoted = [];
    foreach ($pendingEdges as $edge) {
        if (!is_array($edge)) continue;
        $s = (string) ($edge['source'] ?? '');
        $t = (string) ($edge['target'] ?? '');
        if ($s !== '' && $t !== '' && isset($canonSlugs[$s], $canonSlugs[$t])) {
            $edge['pending'] = false;
            $dup = false;
            foreach ($canonEdges as $e) {
                if ((string) ($e['source'] ?? '') === $s
                    && (string) ($e['target'] ?? '') === $t
                    && (string) ($e['relationship'] ?? '') === (string) ($edge['relationship'] ?? '')) {
                    $dup = true;
                    break;
                }
            }
            if (!$dup) {
                $canonEdges[] = $edge;
                $promoted[] = $edge;
            }
            continue;
        }
        $stillPending[] = $edge;
    }

    return [
        'ok' => true,
        'node' => $found,
        'pending' => $rest,
        'canon' => $canon,
        'pending_edges' => $stillPending,
        'canon_edges' => $canonEdges,
        'promoted_edges' => $promoted,
    ];
}

/**
 * @param list<array<string,mixed>> $pending
 * @param list<array<string,mixed>> $pendingEdges
 * @return array{ok:bool,error?:string,pending:list,pending_edges:list}
 */
function ttg_graph_reject_apply(array $pending, array $pendingEdges, string $id): array {
    $id = trim($id);
    $rest = [];
    $found = null;
    foreach ($pending as $node) {
        if (!is_array($node)) continue;
        $slug = (string) ($node['slug'] ?? '');
        $pid = (string) ($node['public_id'] ?? '');
        if ($found === null && ($slug === $id || $pid === $id)) {
            $found = $node;
            continue;
        }
        $rest[] = $node;
    }
    if (!$found) {
        return ['ok' => false, 'error' => 'That slip is not in the hopper.', 'pending' => $pending, 'pending_edges' => $pendingEdges];
    }
    $gone = (string) ($found['slug'] ?? '');
    $edges = [];
    foreach ($pendingEdges as $edge) {
        if (!is_array($edge)) continue;
        if ($gone !== '' && ((string) ($edge['source'] ?? '') === $gone || (string) ($edge['target'] ?? '') === $gone)) {
            continue;
        }
        $edges[] = $edge;
    }
    return ['ok' => true, 'pending' => $rest, 'pending_edges' => $edges];
}

function ttg_graph_confirm_pending(string $id, array $viewer): array {
    if (!ttg_graph_is_keeper($viewer)) {
        return ['ok' => false, 'error' => 'A keeper writes canon. This visitor may not.'];
    }
    $applied = ttg_graph_confirm_apply(
        ttg_graph_load('pending.json'),
        ttg_graph_load('nodes.json'),
        ttg_graph_load('pending-edges.json'),
        ttg_graph_load('edges.json'),
        $id,
        [
            'at' => (new DateTimeImmutable('now'))->format('c'),
            'by' => (string) ($viewer['slug'] ?? $viewer['name'] ?? 'keeper'),
        ]
    );
    if (empty($applied['ok'])) {
        return ['ok' => false, 'error' => (string) ($applied['error'] ?? 'The slip could not be written.')];
    }
    $ok = ttg_graph_save_locked('nodes.json', static fn (array $_) => $applied['canon']);
    $ok = $ok && ttg_graph_save_locked('pending.json', static fn (array $_) => $applied['pending']);
    $ok = $ok && ttg_graph_save_locked('edges.json', static fn (array $_) => $applied['canon_edges']);
    $ok = $ok && ttg_graph_save_locked('pending-edges.json', static fn (array $_) => $applied['pending_edges']);
    if (!$ok) {
        return ['ok' => false, 'error' => 'The field could not be written.'];
    }
    ttg_graph_nodes(true);
    ttg_graph_edges(true);
    $public = $applied['node'];
    $standing = ttg_graph_standing($public);
    $punch = ttg_graph_punch_append([
        'action' => 'WRITE_CANON',
        'actor' => ttg_graph_punch_actor($viewer),
        'who' => ttg_graph_punch_who($viewer),
        'slug' => (string) ($public['slug'] ?? $id),
        'public_id' => (string) ($public['public_id'] ?? ''),
        'type' => (string) ($public['type'] ?? ''),
        'title' => (string) ($public['title'] ?? ''),
        'body' => (string) ($public['body'] ?? ''),
        'standing' => (string) ($standing['title'] ?? ''),
        'detail' => 'irreversible',
        'at' => (string) ($public['metadata']['confirmed_at'] ?? ''),
    ]);
    if ($punch) {
        $slug = (string) ($public['slug'] ?? '');
        $pid = (string) ($public['public_id'] ?? '');
        ttg_graph_save_locked('nodes.json', static function (array $list) use ($slug, $pid, $punch): array {
            foreach ($list as $i => $node) {
                if (!is_array($node)) continue;
                if ((string) ($node['slug'] ?? '') !== $slug && (string) ($node['public_id'] ?? '') !== $pid) continue;
                $meta = is_array($node['metadata'] ?? null) ? $node['metadata'] : [];
                $meta['punch_hash'] = (string) $punch['hash'];
                $meta['punch_prev'] = (string) $punch['prev'];
                $meta['body_hash'] = (string) ($punch['body_hash'] ?? '');
                $meta['irreversible'] = true;
                $list[$i]['metadata'] = $meta;
            }
            return $list;
        });
        $public['metadata'] = array_merge(is_array($public['metadata'] ?? null) ? $public['metadata'] : [], [
            'punch_hash' => (string) $punch['hash'],
            'punch_prev' => (string) $punch['prev'],
            'body_hash' => (string) ($punch['body_hash'] ?? ''),
            'irreversible' => true,
        ]);
        ttg_graph_nodes(true);
    }
    ttg_graph_navigator_ledger('WRITE_CANON', $viewer, (string) ($public['slug'] ?? $id), 'Punched into canon. Irreversible. Observation was not rewritten.');
    unset($public['ip_hash']);
    return [
        'ok' => true,
        'irreversible' => true,
        'node' => ttg_graph_project_node($public, $viewer, ttg_graph_person_edge_set($viewer)),
        'standing' => $standing,
        'promoted_edges' => count($applied['promoted_edges']),
        'punch' => $punch,
    ];
}

function ttg_graph_reject_pending(string $id, array $viewer): array {
    if (!ttg_graph_is_keeper($viewer)) {
        return ['ok' => false, 'error' => 'A keeper returns slips. This visitor may not.'];
    }
    $applied = ttg_graph_reject_apply(
        ttg_graph_load('pending.json'),
        ttg_graph_load('pending-edges.json'),
        $id
    );
    if (empty($applied['ok'])) {
        return ['ok' => false, 'error' => (string) ($applied['error'] ?? 'The slip could not be returned.')];
    }
    $ok = ttg_graph_save_locked('pending.json', static fn (array $_) => $applied['pending']);
    $ok = $ok && ttg_graph_save_locked('pending-edges.json', static fn (array $_) => $applied['pending_edges']);
    if (!$ok) {
        return ['ok' => false, 'error' => 'The hopper could not be written.'];
    }
    ttg_graph_nodes(true);
    $punch = ttg_graph_punch_append([
        'action' => 'RETURN_SLIP',
        'actor' => ttg_graph_punch_actor($viewer),
        'who' => ttg_graph_punch_who($viewer),
        'slug' => $id,
        'title' => $id,
        'detail' => 'returned, not canon',
    ]);
    ttg_graph_navigator_ledger('RETURN_SLIP', $viewer, $id, 'A pending slip was returned. Nothing was written as canon.');
    return ['ok' => true, 'punch' => $punch];
}

function ttg_graph_delete_canon(string $id, array $viewer): array {
    if (!ttg_graph_is_keeper($viewer)) {
        return ['ok' => false, 'error' => 'A keeper deletes records. This visitor may not.'];
    }
    if ($id === '') {
        return ['ok' => false, 'error' => 'No record identified.'];
    }
    $node = ttg_graph_node($id);
    if (!$node) {
        return ['ok' => false, 'error' => 'The record was not found.'];
    }
    if (!empty($node['pending'])) {
        return ['ok' => false, 'error' => 'Return pending slips via RETURN SLIP, not delete.'];
    }
    $ok = ttg_graph_save_locked('nodes.json', static function (array $list) use ($id): array {
        return array_values(array_filter($list, static fn (array $n) => ($n['slug'] ?? $n['id'] ?? '') !== $id));
    });
    if (!$ok) {
        return ['ok' => false, 'error' => 'The timetree could not be written.'];
    }
    ttg_graph_save_locked('edges.json', static function (array $list) use ($id): array {
        return array_values(array_filter($list, static fn (array $e) =>
            ($e['source'] ?? '') !== $id && ($e['target'] ?? '') !== $id
        ));
    });
    ttg_graph_nodes(true);
    $title = (string) ($node['title'] ?? $id);
    $punch = ttg_graph_punch_append([
        'action' => 'DELETE_RECORD',
        'actor' => ttg_graph_punch_actor($viewer),
        'who' => ttg_graph_punch_who($viewer),
        'slug' => $id,
        'title' => $title,
        'detail' => 'canon record deleted by keeper',
    ]);
    ttg_graph_navigator_ledger('DELETE_RECORD', $viewer, $id, 'Canon record deleted by keeper.');
    return ['ok' => true, 'punch' => $punch];
}

function ttg_graph_navigator_ledger(string $action, array $viewer, string $target, string $result): void {
    $boot = dirname(__DIR__) . '/app/JackOffice/autoload.php';
    if (!is_file($boot)) return;
    try {
        require_once $boot;
        if (!class_exists('OfficeStore') || !class_exists('OfficeLedger')) return;
        $store = new OfficeStore();
        $store->boot();
        OfficeLedger::append($store->root(), [
            'actor' => (string) ($viewer['slug'] ?? 'keeper'),
            'action' => $action,
            'target_record_ids' => [$target],
            'request_summary' => $target,
            'validation_result' => 'keeper',
            'approval_state' => 'approved',
            'result' => $result,
        ]);
    } catch (Throwable $e) {
        // The tree write already succeeded. The ledger is a witness, not a lock.
    }
}

function ttg_graph_navigator_field(?array $viewer = null): array {
    $viewer ??= ttg_graph_viewer();
    $personEdges = ttg_graph_person_edge_set($viewer);
    $nodes = [];
    $slugs = [];
    foreach (ttg_graph_unique_nodes() as $node) {
        if (!ttg_graph_public($node)) continue;
        $p = ttg_graph_project_node($node, $viewer, $personEdges);
        $p['standing'] = ttg_graph_standing($node);
        $p['origin'] = ttg_graph_meta($node, 'source_id') !== '' || strlen(trim((string) ($node['body'] ?? ''))) > 220;
        $nodes[] = $p;
        if ($p['slug'] !== '') $slugs[$p['slug']] = true;
    }
    foreach (ttg_graph_pending() as $node) {
        if (!ttg_graph_public($node)) continue;
        $node['pending'] = true;
        $p = ttg_graph_project_node($node, $viewer, $personEdges);
        $p['pending'] = true;
        $p['standing'] = ttg_graph_standing($node);
        $p['origin'] = ttg_graph_meta($node, 'source_id') !== '' || strlen(trim((string) ($node['body'] ?? ''))) > 220;
        $nodes[] = $p;
        if ($p['slug'] !== '') $slugs[$p['slug']] = true;
    }

    $edges = [];
    foreach (ttg_graph_shown_edges() as $edge) {
        $s = (string) ($edge['source'] ?? '');
        $t = (string) ($edge['target'] ?? '');
        if ($s === '' || $t === '' || !isset($slugs[$s], $slugs[$t])) continue;
        $edges[] = [
            'source' => $s,
            'target' => $t,
            'relationship' => (string) ($edge['relationship'] ?? 'POSSIBLY_RELATED_TO'),
            'confidence' => isset($edge['confidence']) ? (float) $edge['confidence'] : null,
            'pending' => !empty($edge['pending']),
        ];
    }

    return [
        'nodes' => $nodes,
        'edges' => $edges,
        'viewer' => [
            'known' => !empty($viewer['known']),
            'name' => $viewer['name'] ?? null,
            'first' => $viewer['first'] ?? null,
            'slug' => $viewer['slug'] ?? null,
            'href' => (string) ($viewer['href'] ?? '/people/auth/'),
            'keeper' => ttg_graph_is_keeper($viewer),
            'avatar' => ttg_pixel_parse($viewer['avatar'] ?? []),
        ],
        'present' => [
            'network' => TTG_NETWORK_PRESENT,
            'network_label' => TTG_NETWORK_PRESENT_LABEL,
            'local' => (new DateTimeImmutable('now'))->format('Y-m-d'),
        ],
        'csrf' => ttg_graph_csrf(),
        'punches' => ttg_graph_punch_recent(48),
        'punch_tip' => ttg_graph_punch_tip(),
        'on_tape' => ttg_graph_punch_present(),
    ];
}

const TTG_PUNCH_GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';

function ttg_graph_punch_file(): string {
    return ttg_graph_root() . '/punches.jsonl';
}

/**
 * Canonical punch payload. The hash field is not included.
 * @param array<string,mixed> $card
 */
function ttg_graph_punch_payload(array $card): string {
    return implode("\n", [
        'ttg-punch-v1',
        (string) ($card['prev'] ?? ''),
        (string) ($card['seq'] ?? ''),
        (string) ($card['action'] ?? ''),
        (string) ($card['at'] ?? ''),
        (string) ($card['actor'] ?? ''),
        (string) ($card['slug'] ?? ''),
        (string) ($card['public_id'] ?? ''),
        (string) ($card['type'] ?? ''),
        (string) ($card['title'] ?? ''),
        (string) ($card['body_hash'] ?? ''),
        (string) ($card['standing'] ?? ''),
        (string) ($card['detail'] ?? ''),
    ]);
}

/** @param array<string,mixed> $card */
function ttg_graph_punch_hash(array $card): string {
    return hash('sha256', ttg_graph_punch_payload($card));
}

/**
 * @param list<array<string,mixed>> $cards
 */
function ttg_graph_punch_verify(array $cards): bool {
    $prev = TTG_PUNCH_GENESIS;
    $seq = 0;
    foreach ($cards as $card) {
        if (!is_array($card)) return false;
        $wantSeq = $seq + 1;
        if ((string) ($card['prev'] ?? '') !== $prev) return false;
        if ((int) ($card['seq'] ?? 0) !== $wantSeq) return false;
        $copy = $card;
        unset($copy['hash']);
        if (!hash_equals((string) ($card['hash'] ?? ''), ttg_graph_punch_hash($copy))) return false;
        $prev = (string) $card['hash'];
        $seq = $wantSeq;
    }
    return true;
}

/** @return array{prev:string,seq:int} */
function ttg_graph_punch_tip_from_lines(array $lines): array {
    $prev = TTG_PUNCH_GENESIS;
    $seq = 0;
    for ($i = count($lines) - 1; $i >= 0; $i--) {
        $line = trim((string) $lines[$i]);
        if ($line === '') continue;
        $row = json_decode($line, true);
        if (!is_array($row)) continue;
        $h = (string) ($row['hash'] ?? '');
        if ($h === '') continue;
        return ['prev' => $h, 'seq' => (int) ($row['seq'] ?? 0)];
    }
    return ['prev' => $prev, 'seq' => $seq];
}

function ttg_graph_punch_tip(): string {
    $path = ttg_graph_punch_file();
    if (!is_file($path)) return TTG_PUNCH_GENESIS;
    $raw = @file($path, FILE_IGNORE_NEW_LINES);
    if (!is_array($raw)) return TTG_PUNCH_GENESIS;
    return ttg_graph_punch_tip_from_lines($raw)['prev'];
}

/** @return list<array<string,mixed>> */
function ttg_graph_punch_recent(int $limit = 48): array {
    $path = ttg_graph_punch_file();
    if (!is_file($path)) return [];
    $raw = @file($path, FILE_IGNORE_NEW_LINES);
    if (!is_array($raw)) return [];
    $out = [];
    for ($i = count($raw) - 1; $i >= 0 && count($out) < $limit; $i--) {
        $line = trim((string) $raw[$i]);
        if ($line === '') continue;
        $row = json_decode($line, true);
        if (!is_array($row) || ($row['hash'] ?? '') === '') continue;
        $out[] = $row;
    }
    return array_reverse($out);
}

/**
 * @param array{action:string,actor?:string,slug?:string,public_id?:string,type?:string,title?:string,body?:string,standing?:string,detail?:string,at?:string} $spec
 * @return array<string,mixed>|null
 */
function ttg_graph_punch_append(array $spec): ?array {
    $action = strtoupper(trim((string) ($spec['action'] ?? '')));
    if ($action === '') return null;
    $path = ttg_graph_punch_file();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) return null;
    $fp = @fopen($path, 'c+');
    if ($fp === false) return null;
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return null;
    }
    rewind($fp);
    $raw = stream_get_contents($fp);
    $lines = ($raw === false || $raw === '') ? [] : explode("\n", $raw);
    $tip = ttg_graph_punch_tip_from_lines($lines);
    $body = (string) ($spec['body'] ?? '');
    $card = [
        'prev' => $tip['prev'],
        'seq' => $tip['seq'] + 1,
        'action' => $action,
        'at' => (string) ($spec['at'] ?? (new DateTimeImmutable('now'))->format('c')),
        'actor' => (string) ($spec['actor'] ?? 'visitor'),
        'slug' => (string) ($spec['slug'] ?? ''),
        'public_id' => (string) ($spec['public_id'] ?? ''),
        'type' => (string) ($spec['type'] ?? ''),
        'title' => (string) ($spec['title'] ?? ''),
        'body_hash' => $body !== '' ? hash('sha256', $body) : (string) ($spec['body_hash'] ?? ''),
        'standing' => (string) ($spec['standing'] ?? ''),
        'detail' => (string) ($spec['detail'] ?? ''),
    ];
    $card['hash'] = ttg_graph_punch_hash($card);
    $who = is_array($spec['who'] ?? null) ? $spec['who'] : null;
    if (is_array($who)) {
        $card['who'] = [
            'known' => !empty($who['known']),
            'keeper' => !empty($who['keeper']),
            'slug' => (string) ($who['slug'] ?? ''),
            'name' => (string) ($who['name'] ?? $card['actor']),
            'actor' => (string) ($who['actor'] ?? $card['actor']),
            'href' => (string) ($who['href'] ?? ''),
        ];
    }
    $line = json_encode($card, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($line === false) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return null;
    }
    fseek($fp, 0, SEEK_END);
    fwrite($fp, $line . "\n");
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $card;
}

function ttg_graph_punch_actor(array $viewer): string {
    $slug = trim((string) ($viewer['slug'] ?? ''));
    if ($slug !== '') return $slug;
    $name = trim((string) ($viewer['name'] ?? ''));
    if ($name !== '') return $name;
    ttg_graph_boot_session();
    $sid = session_id();
    $token = $sid !== '' ? substr(hash('sha256', 'ttg-punch-session|' . $sid), 0, 8) : 'anon';
    return 'unsigned:' . $token;
}

/** @return array{known:bool,keeper:bool,slug:string,name:string,actor:string,href:string} */
function ttg_graph_punch_who(array $viewer): array {
    $actor = ttg_graph_punch_actor($viewer);
    $known = !empty($viewer['known']);
    $name = trim((string) ($viewer['name'] ?? $viewer['first'] ?? ''));
    if ($name === '') $name = $known ? $actor : 'Unsigned';
    return [
        'known' => $known,
        'keeper' => ttg_graph_is_keeper($viewer),
        'slug' => trim((string) ($viewer['slug'] ?? '')),
        'name' => $name,
        'actor' => $actor,
        'href' => $known ? (string) ($viewer['href'] ?? '/people/profile/') : '/people/auth/',
    ];
}

/**
 * What this viewer has just been doing on the tape: their own recent cards,
 * oldest first. Ambient LOOK/FILTER/ENTER noise is collapsed so each record
 * appears once with its most decisive action.
 *
 * @return list<array{action:string,slug:string,title:string,at:string,hash:string,detail:string}>
 */
function ttg_graph_viewer_trail(array $viewer, int $within = 3600, int $limit = 12): array {
    if (empty($viewer['known'])) return [];
    $actor = ttg_graph_punch_actor($viewer);
    if ($actor === '' || str_starts_with($actor, 'unsigned:')) return [];
    $cut = time() - max(60, $within);
    $weight = ['WRITE_CANON' => 5, 'DELETE_RECORD' => 4, 'RETURN_SLIP' => 3, 'EDIT_PENDING' => 2, 'LOOK' => 1];
    $bySlug = [];
    foreach (ttg_graph_punch_recent(240) as $card) {
        if ((string) ($card['actor'] ?? '') !== $actor) continue;
        $action = (string) ($card['action'] ?? '');
        if (!isset($weight[$action])) continue;
        $at = strtotime((string) ($card['at'] ?? '')) ?: 0;
        if ($at < $cut) continue;
        $slug = (string) ($card['slug'] ?? '');
        if ($slug === '') continue;
        $title = trim((string) ($card['title'] ?? ''));
        if ($title === '' || $title === $slug) {
            $title = $bySlug[$slug]['title'] ?? $title;
        }
        $row = [
            'action' => $action,
            'slug' => $slug,
            'title' => $title !== '' ? $title : $slug,
            'at' => (string) ($card['at'] ?? ''),
            'hash' => (string) ($card['hash'] ?? ''),
            'detail' => (string) ($card['detail'] ?? ''),
        ];
        $prev = $bySlug[$slug] ?? null;
        if ($prev && $weight[$prev['action']] > $weight[$action]) {
            continue;
        }
        unset($bySlug[$slug]);
        $bySlug[$slug] = $row;
    }
    return array_slice(array_values($bySlug), -max(1, $limit));
}

/** @return list<array{actor:string,name:string,known:bool,keeper:bool,href:string,at:string,hash:string}> */
function ttg_graph_punch_present(int $within = 1200): array {
    $out = [];
    $seen = [];
    foreach (array_reverse(ttg_graph_punch_recent(80)) as $card) {
        $actor = (string) ($card['actor'] ?? '');
        if ($actor === '' || isset($seen[$actor])) continue;
        $at = strtotime((string) ($card['at'] ?? '')) ?: 0;
        if ($at > 0 && $at < time() - $within) continue;
        $seen[$actor] = true;
        $who = is_array($card['who'] ?? null) ? $card['who'] : [];
        $out[] = [
            'actor' => $actor,
            'name' => (string) ($who['name'] ?? $card['title'] ?? $actor),
            'known' => !empty($who['known']),
            'keeper' => !empty($who['keeper']),
            'href' => (string) ($who['href'] ?? ''),
            'at' => (string) ($card['at'] ?? ''),
            'hash' => (string) ($card['hash'] ?? ''),
        ];
    }
    return $out;
}

function ttg_graph_punch_enter(array $viewer): ?array {
    ttg_graph_boot_session();
    $last = (int) ($_SESSION['ttg_punch_enter'] ?? 0);
    if ($last > 0 && (time() - $last) < 300) return null;
    $_SESSION['ttg_punch_enter'] = time();
    $who = ttg_graph_punch_who($viewer);
    return ttg_graph_punch_append([
        'action' => 'ENTER',
        'actor' => $who['actor'],
        'who' => $who,
        'slug' => $who['slug'],
        'title' => $who['known'] ? $who['name'] : 'Unsigned visitor',
        'detail' => $who['keeper'] ? 'keeper present' : ($who['known'] ? 'signed in' : 'unsigned'),
    ]);
}

function ttg_graph_save_pending(string $id, array $viewer, array $data): array {
    if (!ttg_graph_is_keeper($viewer)) {
        return ['ok' => false, 'error' => 'A keeper edits pending slips. This visitor may not.'];
    }
    $pending = ttg_graph_load('pending.json');
    $found = null;
    foreach ($pending as $node) {
        if (!is_array($node)) continue;
        if ((string) ($node['slug'] ?? '') === $id || (string) ($node['public_id'] ?? '') === $id) {
            $found = $node;
            break;
        }
    }
    if ($found === null) {
        return ['ok' => false, 'error' => 'That slip is not in the hopper.'];
    }
    if (!empty($found['punch']['hash'])) {
        return ['ok' => false, 'error' => 'A punched slip cannot be edited.'];
    }

    $title = isset($data['title']) ? trim((string) $data['title']) : null;
    $body = isset($data['body']) ? trim((string) $data['body']) : null;
    $type = isset($data['type']) ? strtoupper(trim((string) $data['type'])) : null;
    $layer = isset($data['zone']) ? strtolower(trim((string) $data['zone'])) : null;
    $year = isset($data['year']) && $data['year'] !== '' ? (int) $data['year'] : null;
    $place = isset($data['place']) ? trim((string) $data['place']) : null;

    $allowedLayers = ['root', 'trunk', 'branch', 'leaf', 'fruit'];
    if ($layer !== null && $layer !== '' && !in_array($layer, $allowedLayers, true)) {
        return ['ok' => false, 'error' => 'Unknown zone.'];
    }
    if ($year !== null && ($year < 1900 || $year > 2100)) {
        return ['ok' => false, 'error' => 'Year out of range.'];
    }

    $slug = (string) ($found['slug'] ?? $id);
    $ok = ttg_graph_save_locked('pending.json', static function (array $list) use ($slug, $title, $body, $type, $layer, $year, $place): array {
        foreach ($list as $i => $node) {
            if (!is_array($node)) continue;
            if ((string) ($node['slug'] ?? '') !== $slug) continue;
            if ($title !== null && $title !== '') $list[$i]['title'] = $title;
            if ($body !== null && $body !== '') $list[$i]['body'] = $body;
            if ($type !== null && $type !== '') $list[$i]['type'] = $type;
            if ($layer !== null && $layer !== '') {
                $tree = is_array($list[$i]['tree'] ?? null) ? $list[$i]['tree'] : [];
                $tree['layer'] = $layer;
                $list[$i]['tree'] = $tree;
            }
            if ($year !== null) {
                $tree = is_array($list[$i]['tree'] ?? null) ? $list[$i]['tree'] : [];
                $tree['year'] = $year;
                $list[$i]['tree'] = $tree;
            }
            if ($place !== null && $place !== '') {
                $meta = is_array($list[$i]['metadata'] ?? null) ? $list[$i]['metadata'] : [];
                $meta['place'] = $place;
                $list[$i]['metadata'] = $meta;
            }
            break;
        }
        return $list;
    });
    if (!$ok) return ['ok' => false, 'error' => 'The field could not be written.'];

    $updated = null;
    foreach (ttg_graph_load('pending.json') as $node) {
        if (!is_array($node)) continue;
        if ((string) ($node['slug'] ?? '') === $slug) { $updated = $node; break; }
    }
    $standing = $updated ? ttg_graph_standing($updated) : [];
    $who = ttg_graph_punch_who($viewer);
    $punch = ttg_graph_punch_append([
        'action' => 'EDIT_PENDING',
        'actor' => $who['actor'],
        'who' => $who,
        'slug' => $slug,
        'public_id' => (string) ($updated['public_id'] ?? ''),
        'type' => (string) ($updated['type'] ?? ''),
        'title' => (string) ($updated['title'] ?? ''),
        'body' => (string) ($updated['body'] ?? ''),
        'standing' => (string) ($standing['title'] ?? ''),
        'detail' => 'edited pending slip',
    ]);
    $projected = $updated ? ttg_graph_project_node($updated, $viewer, ttg_graph_person_edge_set($viewer)) : [];
    return ['ok' => true, 'node' => $projected, 'punch' => $punch];
}

function ttg_graph_punch_action(string $action, string $id, array $viewer, array $extra = []): array {
    $action = strtolower(trim($action));
    $id = trim($id);
    $allowed = ['look', 'filter', 'confirm', 'reject', 'return', 'enter', 'delete', 'save_pending'];
    if (!in_array($action, $allowed, true)) {
        return ['ok' => false, 'error' => 'Unknown punch.'];
    }
    if (in_array($action, ['look', 'filter', 'enter'], true) && !ttg_jack_rate_allow('punch', 80, true)) {
        return ['ok' => false, 'error' => 'The hopper is already punching.', 'rate' => true];
    }

    if ($action === 'save_pending') {
        return ttg_graph_save_pending($id, $viewer, is_array($extra['data'] ?? null) ? $extra['data'] : []);
    }
    if ($action === 'confirm') {
        return ttg_graph_confirm_pending($id, $viewer);
    }
    if ($action === 'reject' || $action === 'return') {
        return ttg_graph_reject_pending($id, $viewer);
    }
    if ($action === 'delete') {
        return ttg_graph_delete_canon($id, $viewer);
    }
    if ($action === 'enter') {
        $punch = ttg_graph_punch_enter($viewer);
        return $punch ? ['ok' => true, 'punch' => $punch] : ['ok' => true, 'punch' => null];
    }

    $node = $id !== '' ? ttg_graph_node($id) : null;
    $standing = $node ? ttg_graph_standing($node) : [];
    $who = ttg_graph_punch_who($viewer);
    $punch = ttg_graph_punch_append([
        'action' => $action === 'filter' ? 'FILTER' : 'LOOK',
        'actor' => $who['actor'],
        'who' => $who,
        'slug' => $node ? (string) ($node['slug'] ?? $id) : $id,
        'public_id' => $node ? (string) ($node['public_id'] ?? '') : '',
        'type' => $node ? (string) ($node['type'] ?? '') : '',
        'title' => $node ? (string) ($node['title'] ?? '') : $id,
        'standing' => (string) ($standing['title'] ?? ''),
        'detail' => (string) ($extra['detail'] ?? $action),
        'body' => '',
    ]);
    if (!$punch) return ['ok' => false, 'error' => 'The tape could not be punched.'];
    return ['ok' => true, 'punch' => $punch];
}
