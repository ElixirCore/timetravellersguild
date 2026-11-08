<?php
declare(strict_types=1);

/**
 * Jack's tool suite at the desk.
 *
 *   Who is here     whoami
 *   His memory      recall_memory, remember, forget, resolve_thread
 *   The record      search_graph, get_node, search_lore, read_lore
 *   The territory   search_map, trace_map, desk_items, find_traveller
 *   Cardiff         search_cardiff_archives, read_museum_object (Museum Wales + Glamorgan Archives, read-only)
 *   His office      the keeper-only office tools (JackAgent / OfficeDispatcher), unchanged
 *
 * Everything reads the Guild's own data. The only writes are to Jack's memory of the traveller
 * at the desk, and the office tools for the Keeper. Lodging testimony stays a proposal the
 * traveller confirms (proposedActions in his reply), never a tool he runs on his own.
 * No shell, no mail, no canon. No outbound requests of his own, with two exceptions: the provider's
 * built-in web_search, offered only at /lodge/ to the accounts in WEB_SEARCH_EMAILS (see mayWebSearch),
 * and CardiffArchives, which reads two fixed public catalogues in Cardiff, cached for a day.
 */
require_once dirname(__DIR__) . '/Narrative/Narrative.php';
require_once __DIR__ . '/JackLife.php';
require_once __DIR__ . '/CardiffArchives.php';

final class JackTools
{
    /** Tool output is clipped so one call cannot flood a round. */
    private const OUT_CHARS = 7000;

    /** @return list<array<string, mixed>> */
    public static function definitions(array $viewer, bool $memory, bool $site = false): array
    {
        $s = static fn (int $max = 200) => ['type' => 'string', 'maxLength' => $max];
        $fn = static fn (string $name, string $desc, array $props = [], array $required = []) => [
            'type' => 'function',
            'name' => $name,
            'description' => $desc,
            'parameters' => ['type' => 'object', 'properties' => (object) $props, 'required' => $required, 'additionalProperties' => false],
        ];
        $tools = [
            $fn('whoami', 'Who is at the desk: their signed-in Guild identity and profile (name, bio, location, role, member since), standing, and visit count. Read-only.'),
            $fn('search_lore', 'Search the Guild lore drawer (canon, testimony and record) for people, places, objects, events. Returns ids, titles, summaries and classifications. Read-only.',
                ['query' => $s(), 'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 12]], ['query']),
            $fn('read_lore', 'Read one lore record in full by id. Read-only.', ['id' => $s(120)], ['id']),
            $fn('search_map', 'Search your own map of the Guild (organs, holdings and nerves of the field). Read-only.', ['query' => $s()], ['query']),
            $fn('trace_map', 'Trace the filed path of a holding or the outbound nerves of a map node by id. Read-only.', ['id' => $s(120)], ['id']),
            $fn('desk_items', 'What travellers have lodged on the Passport Map (recollections, objects, documents, names, questions), near a point or matching words. Only items this visitor may see. Read-only.',
                ['query' => $s(), 'lat' => ['type' => 'number'], 'lng' => ['type' => 'number'], 'radius_km' => ['type' => 'number', 'minimum' => 0.1, 'maximum' => 500]]),
            $fn('remember_my_life', 'Recall your own life (your autobiographical memory, 1951 to now) about a subject or year: returns your memories with the REAL artefacts that surround them (image, source, licence). Use it when asked about your past, or when a memory would help.',
                ['about' => $s(200)], ['about']),
            $fn('search_cardiff_archives', 'Search Cardiff\'s public archives: Amgueddfa Cymru – Museum Wales collections (the national museum at Cathays Park: objects, photographs, computers, industry) and Glamorgan Archives (council records, photographs, papers). Use it when someone asks about Cardiff, Wales, or the real history behind one of your memories. Returns real records with references and links. They are evidence of the world, never proof of your memories; say which is which.',
                ['query' => $s(120), 'source' => ['type' => 'string', 'enum' => ['both', 'museum', 'archives']], 'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 10]], ['query']),
            $fn('read_museum_object', 'Read one Museum Wales object in full (dates, makers, materials, categories) by the id or link that search_cardiff_archives gave. Link to it; never reproduce its image.', ['id' => $s(200)], ['id']),
            $fn('find_traveller', 'Find a traveller with a public Guild profile by name, place or interest. Public profiles only. Read-only.', ['query' => $s()], ['query']),
        ];
        if ($memory) {
            $tools[] = $fn('recall_memory', 'Everything you have kept about this traveller: your notes (with ids) and the recent exchanges. Use it when they ask what you remember.');
            $tools[] = $fn('remember', 'Keep one thing about this traveller for future sittings: who they are, what they are building, a preference, a promise you made, or an open thread. One short sentence in your own words. Never credentials or payment details.',
                ['kind' => ['type' => 'string', 'enum' => JackMemory::KINDS], 'text' => $s(300)], ['kind', 'text']);
            $tools[] = $fn('forget', 'Erase from your memory of this traveller: a note id, a kind (e.g. "thread"), "sittings", or "all". Do it whenever they ask.',
                ['what' => $s(40)], ['what']);
            $tools[] = $fn('add_story_beat', 'Add one beat to this traveller\'s story so far, when something in this sitting moves it. Join it to the last beat with "therefore" (it follows) or "but" (it turns); never "and then". Yes-and what they brought; never harm or mock them. One or two sentences, second person. Say what moved plainly; doubt belongs in your classifications, not tacked onto the sentence.',
                ['joint' => ['type' => 'string', 'enum' => Narrative::JOINTS], 'kind' => ['type' => 'string', 'enum' => Narrative::KINDS], 'text' => $s(400)], ['joint', 'kind', 'text']);
            $tools[] = $fn('set_story_premise', 'Set what this traveller\'s story is about, in a sentence close to their own words, once it is clear.', ['premise' => $s(240)], ['premise']);
            $tools[] = $fn('close_story_thread', 'Mark an open thread in their story as paid off, by beat id.', ['id' => ['type' => 'integer']], ['id']);
            $tools[] = $fn('resolve_thread', 'Close an unresolved conversation thread on your relationship record once it is settled, so you stop raising it. Pass words from the thread, or "all".',
                ['thread' => $s()], ['thread']);
        }
        if ($site) {
            $tools[] = $fn('list_site', 'List the public sections of timetravellersguild.com (the site you live on), with their addresses and titles. Use it to see what the Guild is made of.');
            $tools[] = $fn('read_site_page', 'Read one public page of timetravellersguild.com as text, as a signed-out visitor sees it. Pass a path such as /ledger/ or /lore/. Faster and fuller than web search for the Guild itself.',
                ['path' => $s(300)], ['path']);
        }
        // The existing public field tools, plus the office tools when the Keeper is at the desk.
        foreach (JackAgent::tools($viewer) as $t) $tools[] = $t;
        return $tools;
    }

    /**
     * @param array{viewer:array,subject:string,relationship:array,memory:bool,office:?OfficeDispatcher} $ctx
     *        relationship is updated in place when a thread is resolved.
     */
    public static function execute(string $name, array $args, array &$ctx): string
    {
        try {
            $out = self::run(strtolower($name), $args, $ctx);
        } catch (Throwable $e) {
            error_log('JackTools ' . $name . ': ' . $e->getMessage());
            $out = ['ok' => false, 'error' => 'That drawer jammed.'];
        }
        $json = json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) ?: '{"ok":false}';
        return strlen($json) > self::OUT_CHARS ? mb_strcut($json, 0, self::OUT_CHARS) . '…(clipped)' : $json;
    }

    private static function run(string $name, array $a, array &$ctx): array
    {
        $viewer = $ctx['viewer'];
        $subject = $ctx['subject'];
        $memoryTool = in_array($name, ['recall_memory', 'remember', 'forget', 'resolve_thread', 'add_story_beat', 'set_story_premise', 'close_story_thread'], true);
        if ($memoryTool && !$ctx['memory']) {
            return ['ok' => false, 'error' => 'No memory is kept for this visitor (not signed in, or memory withdrawn).'];
        }
        return match ($name) {
            'whoami' => self::whoami($viewer, $ctx['relationship']),
            'search_lore' => self::searchLore((string) ($a['query'] ?? ''), (int) ($a['limit'] ?? 6), $viewer),
            'read_lore' => self::readLore((string) ($a['id'] ?? ''), $viewer),
            'search_map' => self::searchMap((string) ($a['query'] ?? '')),
            'trace_map' => ['ok' => true, 'trace' => JackMap::trace((string) ($a['id'] ?? ''))],
            'desk_items' => self::deskItems($a),
            'search_cardiff_archives' => CardiffArchives::search((string) ($a['query'] ?? ''), (string) ($a['source'] ?? 'both'), (int) ($a['limit'] ?? 6)),
            'read_museum_object' => CardiffArchives::readObject((string) ($a['id'] ?? '')),
            'find_traveller' => self::findTraveller((string) ($a['query'] ?? '')),
            'remember_my_life' => ['ok' => true, 'memories' => array_map(static fn ($h) => JackLife::full($h['memory']), JackLife::recall((string) ($a['about'] ?? ''), 3))],
            'recall_memory' => ['ok' => true] + JackMemory::load($subject),
            'remember' => JackMemory::remember($subject, (string) ($a['kind'] ?? 'fact'), (string) ($a['text'] ?? '')),
            'forget' => JackMemory::forget($subject, (string) ($a['what'] ?? '')),
            'resolve_thread' => self::resolveThread((string) ($a['thread'] ?? ''), $ctx),
            'add_story_beat' => self::storyUser($ctx) ? Narrative::add(self::storyUser($ctx), (string) ($a['joint'] ?? ''), (string) ($a['kind'] ?? 'turn'), 'jack', 'jack', (string) ($a['text'] ?? '')) : ['ok' => false, 'error' => 'No story for this visitor.'],
            'set_story_premise' => self::storyUser($ctx) ? (Narrative::setPremise(self::storyUser($ctx), (string) ($a['premise'] ?? '')) ?? ['ok' => true]) : ['ok' => false],
            'close_story_thread' => self::storyUser($ctx) ? ['ok' => Narrative::closeThread(self::storyUser($ctx), (int) ($a['id'] ?? 0))] : ['ok' => false],
            'list_site' => !empty($ctx['site']) ? self::listSite() : ['ok' => false, 'error' => 'Not at this desk.'],
            'read_site_page' => !empty($ctx['site']) ? self::readSitePage((string) ($a['path'] ?? '')) : ['ok' => false, 'error' => 'Not at this desk.'],
            default => JackAgent::executeTool($name, $a, $ctx['office']),
        };
    }

    /** Accounts allowed internet search at the /lodge/ desk. */
    public const WEB_SEARCH_EMAILS = ['tobywhy@gmail.com'];

    /**
     * Internet search is only for /lodge/ and only for an allowed signed-in account.
     * The account is read from the people session on the server, never from the request.
     */
    public static function mayWebSearch(array $viewer): bool
    {
        if (empty($viewer['known'])) return false;
        $path = (string) (parse_url((string) ($_SERVER['HTTP_REFERER'] ?? ''), PHP_URL_PATH) ?? '');
        if ($path !== '/lodge' && !str_starts_with($path, '/lodge/')) return false;
        $u = self::currentUser();
        $email = strtolower(trim((string) ($u['email'] ?? '')));
        return $email !== '' && in_array($email, self::WEB_SEARCH_EMAILS, true);
    }

    /** The signed-in traveller's user id, for their story. */
    private static function storyUser(array $ctx): int
    {
        $u = self::currentUser();
        return $u && !empty($ctx['memory']) ? (int) $u['id'] : 0;
    }

    /** The signed-in user row, straight from the people session. */
    public static function currentUser(): ?array
    {
        if ((string) ($_COOKIE['ttg_people_session'] ?? '') === '') return null;
        $db = dirname(__DIR__, 2) . '/people/inc/db.php';
        if (!is_file($db)) return null;
        require_once $db;
        if (!function_exists('ttg_current_user')) return null;
        try {
            $u = ttg_current_user();
        } catch (Throwable $e) {
            return null;
        }
        return is_array($u) ? $u : null;
    }

    private static function whoami(array $viewer, array $rel): array
    {
        $base = [
            'ok' => true,
            'signed_in' => !empty($viewer['known']),
            'standing' => (string) ($rel['standing'] ?? 'unknown'),
            'visits' => (int) ($rel['visitCount'] ?? 0),
            'first_encounter' => substr((string) ($rel['firstEncounterAt'] ?? ''), 0, 10),
        ];
        if (empty($viewer['known'])) {
            return $base + ['note' => 'Anonymous. They can sign in at /people/auth/ to be known and remembered.'];
        }
        $u = self::currentUser() ?? [];
        return $base + [
            'name' => (string) ($viewer['name'] ?? ''),
            'slug' => (string) ($viewer['slug'] ?? ''),
            'bio' => mb_substr((string) ($u['bio'] ?? ''), 0, 600),
            'location' => (string) ($u['location'] ?? ''),
            'role' => (string) ($u['role'] ?? ''),
            'member_since' => substr((string) ($u['created_at'] ?? ''), 0, 10),
            'keeper' => JackPolicy::isKeeper($viewer),
            'guild_member' => function_exists('ttg_guild_member') ? ttg_guild_member($viewer) : null,
        ];
    }

    private static function searchLore(string $q, int $limit, array $viewer): array
    {
        $rows = JackLore::retrieve($q, $viewer, ['limit' => max(1, min(12, $limit))]);
        return ['ok' => true, 'records' => array_map(static fn ($r) => [
            'id' => $r['id'], 'type' => $r['type'], 'title' => $r['title'],
            'summary' => mb_substr((string) $r['summary'], 0, 400), 'classification' => $r['classification'],
            'dates' => array_filter([$r['date_start'], $r['date_end']]), 'places' => $r['places'],
        ], $rows)];
    }

    private static function readLore(string $id, array $viewer): array
    {
        $r = JackLore::byId($id);
        if (!$r || !JackLore::maySee($r, $viewer)) return ['ok' => false, 'error' => 'No such record in the drawer.'];
        unset($r['_score']);
        return ['ok' => true, 'record' => $r];
    }

    private static function searchMap(string $q): array
    {
        $r = JackMap::search($q);
        $slim = static fn (array $list) => array_map(static fn ($x) => array_intersect_key($x, array_flip(['id', 'name', 'label', 'kind', 'anatomy', 'node', 'from', 'to', 'provenance', 'note', 'geography'])), array_slice($list, 0, 10));
        return ['ok' => true, 'nodes' => $slim($r['nodes']), 'holdings' => $slim($r['holdings']), 'nerves' => $slim($r['nerves'])];
    }

    private static function deskItems(array $a): array
    {
        $lib = dirname(__DIR__, 2) . '/map/game/lib.php';
        if (!is_file($lib)) return ['ok' => false, 'error' => 'The map desk is not here.'];
        require_once $lib;
        $u = self::currentUser();
        $uid = $u ? (int) $u['id'] : 0;
        $sql = "SELECT * FROM desk_items WHERE (audience = 'travellers' OR user_id = ?)";
        $params = [$uid];
        if (isset($a['lat'], $a['lng'])) {
            $km = (float) ($a['radius_km'] ?? 5);
            $dLat = $km / 111.0;
            $dLng = $km / max(1.0, 111.0 * cos(deg2rad((float) $a['lat'])));
            $sql .= ' AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?';
            array_push($params, (float) $a['lat'] - $dLat, (float) $a['lat'] + $dLat, (float) $a['lng'] - $dLng, (float) $a['lng'] + $dLng);
        }
        $q = trim((string) ($a['query'] ?? ''));
        if ($q !== '') {
            $sql .= ' AND (body LIKE ? OR near_title LIKE ?)';
            array_push($params, '%' . $q . '%', '%' . $q . '%');
        }
        $st = game_db()->prepare($sql . ' ORDER BY id DESC LIMIT 15');
        $st->execute($params);
        $items = array_map(static fn ($it) => game_item_view($it, $uid, false) + ['near' => $it['near_title']], $st->fetchAll());
        return ['ok' => true, 'items' => array_map(static fn ($v) => array_intersect_key($v, array_flip(['id', 'kind_label', 'class', 'body', 'who', 'mine', 'lat', 'lng', 'year', 'standing', 'hands', 'near'])), $items)];
    }

    private static function findTraveller(string $q): array
    {
        $db = dirname(__DIR__, 2) . '/people/inc/db.php';
        if (!is_file($db)) return ['ok' => false];
        require_once $db;
        $q = mb_strtolower(trim($q));
        $hits = [];
        foreach (ttg_public_users() as $u) {
            $hay = mb_strtolower(implode(' ', [$u['display_name'] ?? '', $u['bio'] ?? '', $u['location'] ?? '', $u['role'] ?? '']));
            if ($q === '' || str_contains($hay, $q)) {
                $hits[] = ['name' => $u['display_name'] ?? '', 'slug' => $u['slug'] ?? '', 'location' => $u['location'] ?? '', 'role' => $u['role'] ?? '', 'bio' => mb_substr((string) ($u['bio'] ?? ''), 0, 200)];
            }
            if (count($hits) >= 10) break;
        }
        return ['ok' => true, 'travellers' => $hits];
    }

    private static function resolveThread(string $words, array &$ctx): array
    {
        $threads = is_array($ctx['relationship']['unresolvedThreads'] ?? null) ? $ctx['relationship']['unresolvedThreads'] : [];
        $w = mb_strtolower(trim($words));
        $keep = $w === 'all' ? [] : array_values(array_filter($threads, static fn ($t) => $w === '' || !str_contains(mb_strtolower((string) $t), $w)));
        $closed = count($threads) - count($keep);
        $ctx['relationship']['unresolvedThreads'] = $keep;
        $ctx['relationship']['threadsResolvedAt'] = gmdate('c');
        JackRelationship::save($ctx['relationship']);
        return ['ok' => true, 'closed' => $closed, 'still_open' => $keep];
    }

    /** The public sections: top-level folders with an index page, minus the private machinery. */
    private static function listSite(): array
    {
        $root = dirname(__DIR__, 2);
        $private = ['app', 'inc', 'data', 'storage', 'scripts', 'tests', 'prompts', 'archive', 'database', 'research', 'workbench', 'console', 'io', 'n', 'ok', 'c'];
        $out = [];
        foreach (scandir($root) ?: [] as $d) {
            if ($d[0] === '.' || $d[0] === '_' || !is_dir("$root/$d") || in_array($d, $private, true)) continue;
            $index = is_file("$root/$d/index.php") ? "$root/$d/index.php" : (is_file("$root/$d/index.html") ? "$root/$d/index.html" : '');
            if ($index === '') continue;
            $head = (string) @file_get_contents($index, false, null, 0, 12000);
            $title = preg_match('#<title>([^<]{1,140})</title>#i', $head, $m) ? html_entity_decode(trim($m[1]), ENT_QUOTES) : '';
            $desc = preg_match('#<meta name="description" content="([^"]{1,240})"#i', $head, $m) ? html_entity_decode($m[1], ENT_QUOTES) : '';
            $out[] = array_filter(['path' => '/' . $d . '/', 'title' => $title, 'about' => $desc]);
        }
        return ['ok' => true, 'site' => 'https://timetravellersguild.com', 'sections' => $out,
            'note' => 'Public sections only. Read any of them with read_site_page; follow the links you find there.'];
    }

    /** Fetch one public page of the Guild's own site, signed out, and reduce it to text and links. */
    private static function readSitePage(string $path): array
    {
        $path = trim($path);
        if (preg_match('#^https?://(www\.)?timetravellersguild\.com(/.*)?$#i', $path, $m)) $path = $m[2] ?? '/';
        if ($path === '' || $path[0] !== '/' || str_starts_with($path, '//') || preg_match('~\.\.|[\s\\\\]~', $path)) {
            return ['ok' => false, 'error' => 'Give a path on timetravellersguild.com, such as /ledger/.'];
        }
        $ch = curl_init('https://timetravellersguild.com' . $path);
        if ($ch === false) return ['ok' => false, 'error' => 'The door would not open.'];
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3,
            CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_USERAGENT => 'JackTheClerk/1 (+https://timetravellersguild.com)',
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        ]);
        $html = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $final = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        $type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        if (!is_string($html)) return ['ok' => false, 'error' => 'No answer from that page.'];
        if (parse_url($final, PHP_URL_HOST) !== 'timetravellersguild.com') return ['ok' => false, 'error' => 'That page leads off the site.'];
        if (!str_contains($type, 'html') && !str_contains($type, 'text') && !str_contains($type, 'json')) {
            return ['ok' => true, 'status' => $status, 'type' => $type, 'note' => 'Not a text page.'];
        }
        $title = preg_match('#<title>(.*?)</title>#is', $html, $m) ? trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES)) : '';
        $links = [];
        if (preg_match_all('~<a\s[^>]*href="(/[^"#]*)"[^>]*>(.*?)</a>~is', $html, $mm, PREG_SET_ORDER)) {
            foreach ($mm as $l) {
                $label = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags($l[2]), ENT_QUOTES)) ?? '');
                $links[$l[1]] = mb_substr($label, 0, 60);
                if (count($links) >= 40) break;
            }
        }
        $body = preg_replace('#<(script|style|noscript|svg)\b.*?</\1>#is', ' ', $html) ?? '';
        $text = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags(preg_replace('#<(br|p|div|li|h[1-6]|tr)\b#i', "\n<$1", $body) ?? ''), ENT_QUOTES)) ?? '');
        return ['ok' => true, 'path' => (string) parse_url($final, PHP_URL_PATH), 'status' => $status, 'title' => $title,
            'text' => mb_substr($text, 0, 4500), 'links' => $links];
    }
}
