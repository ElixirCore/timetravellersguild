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

function ttg_graph_root(): string {
    return dirname(__DIR__) . '/graph';
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

function ttg_jack_speech_ok(string $text): bool {
    ttg_graph_boot_session();
    $row = $_SESSION['ttg_jack_speech'] ?? null;
    if (!is_array($row)) return false;
    if ((int) ($row['exp'] ?? 0) < time()) return false;
    $held = (string) ($row['text'] ?? '');
    return $held !== '' && hash_equals($held, $text);
}

function ttg_jack_speak_rate_ok(): bool {
    ttg_graph_boot_session();
    $hour = (int) floor(time() / 3600);
    $n = (int) ($_SESSION['ttg_jack_speak_n'] ?? 0);
    $window = (int) ($_SESSION['ttg_jack_speak_h'] ?? 0);
    if ($window !== $hour) {
        $_SESSION['ttg_jack_speak_n'] = 0;
        $_SESSION['ttg_jack_speak_h'] = $hour;
        $n = 0;
    }
    if ($n >= 24) return false;
    $_SESSION['ttg_jack_speak_n'] = $n + 1;
    return true;
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

function ttg_graph_nodes(): array {
    static $nodes;
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

function ttg_graph_edges(): array {
    static $edges;
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
        'href' => '/people/auth/',
        'position' => $position,
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
        return [
            'known' => true,
            'name' => $name,
            'first' => $first,
            'slug' => (string) ($user['slug'] ?? ''),
            'href' => '/people/profile/',
            'position' => $position,
        ];
    } catch (Throwable $e) {
        return $anon;
    }
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
    ];
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
        'why' => [
            'evidence' => $life['evidence'],
            'interpretation' => $life['interpretation'],
            'reasons' => $reasons,
        ],
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
    $ck = ($viewer['known'] ? 'k:' : 'a:') . (string) ($viewer['slug'] ?? '');
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
        if (count($picked) >= TTG_NOW_MAX) break;
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

    $fieldEdges = [];
    foreach (ttg_graph_all_edges() as $edge) {
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
        ],
        'csrf' => ttg_graph_csrf(),
        'capture' => '/now/capture',
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

function ttg_now_fallback_html(): string {
    $field = ttg_now_field();
    $groups = [
        'trunk' => 'TRUNK — ACTIVE PRESENT',
        'root' => 'ROOTS — ESTABLISHED HISTORY',
        'branch' => 'BRANCHES — UNRESOLVED TRAJECTORIES',
        'leaf' => 'LEAVES — OBSERVATIONS',
        'fruit' => 'FRUIT — COMPLETED',
    ];
    $by = [];
    foreach ($field['nodes'] as $node) {
        $z = (string) ($node['zone'] ?? 'trunk');
        $by[$z][] = $node;
    }
    $html = '';
    foreach ($groups as $zone => $label) {
        if (empty($by[$zone])) continue;
        $html .= '<li class="fb-group">' . ttg_h($label) . '</li>';
        foreach ($by[$zone] as $node) {
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
