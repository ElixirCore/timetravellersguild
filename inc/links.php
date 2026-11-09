<?php
declare(strict_types=1);

/**
 * The wire: links transmitted by visitors, held until a keeper clears them.
 *
 *   pending.json   transmitted, not public. Carries ip_hash for rate limits.
 *   cleared.json   public. A keeper cleared it. No ip_hash.
 *   rejected.json  url hashes only, so a refused link cannot be resent.
 *
 * The store is outside the public surface (links/data/.htaccess denies all,
 * or TTG_LINKS_DIR points somewhere private). The server never fetches a
 * transmitted URL. Keepers are ttg_guild_keeper(): a signed-in Guild member
 * whose slug or email is listed in JACK_KEEPER_SLUGS / JACK_KEEPER_EMAILS.
 */

require_once __DIR__ . '/graph.php';

const TTG_WIRE_PENDING_MAX = 120;
const TTG_WIRE_PER_POSITION_DAY = 5;
const TTG_WIRE_PER_SESSION_HOUR = 6;
const TTG_WIRE_PER_HOST_PENDING = 3;
const TTG_WIRE_MIN_SECONDS = 4;
const TTG_WIRE_REJECTED_KEEP = 500;

function ttg_wire_root(): string {
    $dir = ttg_env('TTG_LINKS_DIR');
    return $dir !== '' ? rtrim($dir, '/') : dirname(__DIR__) . '/links/data';
}

function ttg_wire_load(string $file): array {
    $raw = @file_get_contents(ttg_wire_root() . '/' . $file);
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? array_values(array_filter($data, 'is_array')) : [];
}

/** Lock every store file in a fixed order, then let the mutator rewrite them together. */
function ttg_wire_transact(callable $mutator): bool {
    $root = ttg_wire_root();
    if (!is_dir($root) && !@mkdir($root, 0770, true)) return false;
    $files = ['pending.json', 'cleared.json', 'rejected.json'];
    $handles = [];
    $data = [];
    foreach ($files as $f) {
        $fp = @fopen($root . '/' . $f, 'c+');
        if ($fp === false || !flock($fp, LOCK_EX)) {
            if ($fp !== false) fclose($fp);
            foreach ($handles as $h) { flock($h, LOCK_UN); fclose($h); }
            return false;
        }
        $handles[$f] = $fp;
        $raw = stream_get_contents($fp);
        $list = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
        $data[$f] = is_array($list) ? array_values(array_filter($list, 'is_array')) : [];
    }
    $next = $mutator($data);
    $ok = is_array($next);
    if ($ok) {
        foreach ($files as $f) {
            if (!array_key_exists($f, $next) || $next[$f] === $data[$f]) continue;
            $json = json_encode(array_values($next[$f]), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false) { $ok = false; break; }
            rewind($handles[$f]);
            ftruncate($handles[$f], 0);
            fwrite($handles[$f], $json . "\n");
            fflush($handles[$f]);
        }
    }
    foreach ($handles as $h) { flock($h, LOCK_UN); fclose($h); }
    return $ok;
}

function ttg_wire_pending(): array { return ttg_wire_load('pending.json'); }

function ttg_wire_cleared(): array {
    $list = ttg_wire_load('cleared.json');
    usort($list, static fn(array $a, array $b): int => strcmp((string) ($b['cleared_at'] ?? ''), (string) ($a['cleared_at'] ?? '')));
    return $list;
}

function ttg_wire_clean_text(string $v, int $max): string {
    $v = preg_replace('/[\x00-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]+/u', ' ', $v) ?? '';
    $v = trim(preg_replace('/\s+/u', ' ', $v) ?? '');
    return mb_substr($v, 0, $max);
}

/**
 * Validate and normalise a transmitted URL.
 * @return array{ok:bool,url?:string,host?:string,error?:string}
 */
function ttg_wire_normalise_url(string $raw): array {
    $raw = trim($raw);
    if ($raw === '') return ['ok' => false, 'error' => 'The wire needs an address.'];
    if (strlen($raw) > 2048 || preg_match('/[\s\x00-\x1F\x7F<>"\'`\\\\]/', $raw)) {
        return ['ok' => false, 'error' => 'That address will not go down the wire.'];
    }
    if (!preg_match('#^[a-z][a-z0-9+.-]*://#i', $raw)) $raw = 'https://' . $raw;
    $p = parse_url($raw);
    if (!is_array($p) || empty($p['host'])) return ['ok' => false, 'error' => 'The clerk cannot read that address.'];
    $scheme = strtolower((string) ($p['scheme'] ?? ''));
    if ($scheme !== 'http' && $scheme !== 'https') return ['ok' => false, 'error' => 'Only web addresses (http or https) go down the wire.'];
    if (isset($p['user']) || isset($p['pass'])) return ['ok' => false, 'error' => 'Addresses carrying sign-in details are refused.'];

    $host = strtolower(rtrim((string) $p['host'], '.'));
    if (preg_match('/[^\x20-\x7E]/', $host)) {
        $ascii = function_exists('idn_to_ascii') ? idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46) : false;
        if (!is_string($ascii) || $ascii === '') return ['ok' => false, 'error' => 'The clerk cannot read that address.'];
        $host = $ascii;
    }
    if (filter_var(trim($host, '[]'), FILTER_VALIDATE_IP)) {
        return ['ok' => false, 'error' => 'Bare machine numbers are refused. Send a named address.'];
    }
    $labels = explode('.', $host);
    $tld = end($labels);
    if (count($labels) < 2 || strlen($host) > 253 || !preg_match('/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/', (string) $tld)) {
        return ['ok' => false, 'error' => 'That address has no public place on the map.'];
    }
    foreach ($labels as $label) {
        if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $label)) {
            return ['ok' => false, 'error' => 'The clerk cannot read that address.'];
        }
    }
    if (in_array($tld, ['localhost', 'local', 'internal', 'test', 'example', 'invalid', 'lan', 'home', 'corp', 'onion'], true)) {
        return ['ok' => false, 'error' => 'That address has no public place on the map.'];
    }
    $port = isset($p['port']) ? (int) $p['port'] : null;
    if ($port !== null && !in_array($port, [80, 443], true)) {
        return ['ok' => false, 'error' => 'Unusual ports are refused.'];
    }

    // Drop tracking residue; keep everything else as sent.
    $query = '';
    if (isset($p['query']) && $p['query'] !== '') {
        $keep = [];
        foreach (explode('&', (string) $p['query']) as $pair) {
            $k = strtolower(urldecode(explode('=', $pair, 2)[0]));
            if ($k === '' || preg_match('/^(utm_[a-z_]*|fbclid|gclid|dclid|msclkid|mc_[a-z]+|igshid|si|_hs[a-z]+)$/', $k)) continue;
            $keep[] = $pair;
        }
        if ($keep) $query = '?' . implode('&', $keep);
    }
    $path = (string) ($p['path'] ?? '');
    if ($path === '') $path = '/';
    $frag = isset($p['fragment']) && $p['fragment'] !== '' ? '#' . $p['fragment'] : '';
    $url = $scheme . '://' . $host . ($port !== null && $port !== ($scheme === 'https' ? 443 : 80) ? ':' . $port : '') . $path . $query . $frag;

    if (ttg_graph_is_junk_slip($url)) return ['ok' => false, 'error' => 'That slip is not a record.'];
    return ['ok' => true, 'url' => $url, 'host' => preg_replace('/^www\./', '', $host) ?? $host];
}

function ttg_wire_url_hash(string $url): string {
    // Compare without scheme, www or a trailing slash so near-duplicates meet.
    $k = preg_replace('#^https?://(www\.)?#', '', strtolower($url)) ?? $url;
    return hash('sha256', rtrim($k, '/'));
}

function ttg_wire_form_stamp(): string {
    ttg_graph_boot_session();
    $_SESSION['ttg_wire_form_at'] = time();
    return (string) $_SESSION['ttg_wire_form_at'];
}

function ttg_wire_flash(?string $set = null, string $kind = 'ok'): ?array {
    ttg_graph_boot_session();
    if ($set !== null) {
        $_SESSION['ttg_wire_flash'] = ['text' => $set, 'kind' => $kind];
        return null;
    }
    $f = $_SESSION['ttg_wire_flash'] ?? null;
    unset($_SESSION['ttg_wire_flash']);
    return is_array($f) ? $f : null;
}

/**
 * @return array{ok:bool,error?:string}
 */
function ttg_wire_transmit(array $input): array {
    ttg_graph_boot_session();
    // A filled honeypot gets the same answer as success and is dropped.
    if (trim((string) ($input['website'] ?? '')) !== '') return ['ok' => true];
    $shown = (int) ($_SESSION['ttg_wire_form_at'] ?? 0);
    if ($shown === 0 || time() - $shown < TTG_WIRE_MIN_SECONDS) {
        return ['ok' => false, 'error' => 'Too quick. Read the slip, then transmit.'];
    }
    if (!ttg_jack_rate_allow('wire', TTG_WIRE_PER_SESSION_HOUR, false)) {
        return ['ok' => false, 'error' => 'The wire is resting for this hour. Try later.'];
    }

    $norm = ttg_wire_normalise_url((string) ($input['url'] ?? ''));
    if (!$norm['ok']) return $norm;
    $title = ttg_wire_clean_text((string) ($input['title'] ?? ''), 100);
    $note = ttg_wire_clean_text((string) ($input['note'] ?? ''), 280);
    $from = ttg_wire_clean_text((string) ($input['from'] ?? ''), 60);
    foreach ([$title, $note, $from] as $field) {
        if (preg_match('#https?://|www\.#i', $field)) {
            return ['ok' => false, 'error' => 'One address per transmission. Put no others in the note.'];
        }
    }
    $note = ttg_graph_redact_secrets($note);
    $from = ttg_graph_redact_secrets($from);

    $viewer = ttg_graph_viewer();
    $ipHash = ttg_graph_ip_hash();
    $urlHash = ttg_wire_url_hash($norm['url']);
    $err = null;
    $ok = ttg_wire_transact(static function (array $d) use ($norm, $title, $note, $from, $viewer, $ipHash, $urlHash, &$err) {
        $dayAgo = time() - 86400;
        $mine = 0;
        $sameHost = 0;
        foreach ($d['pending.json'] as $row) {
            if (($row['url_hash'] ?? '') === $urlHash) { $err = 'That address is already on the wire, waiting for a keeper.'; return null; }
            if (($row['ip_hash'] ?? '') === $ipHash && (int) ($row['at'] ?? 0) >= $dayAgo) $mine++;
            if (($row['host'] ?? '') === $norm['host']) $sameHost++;
        }
        foreach ($d['cleared.json'] as $row) {
            if (($row['url_hash'] ?? '') === $urlHash) { $err = 'That address has already been cleared. It is on the board.'; return null; }
        }
        foreach ($d['rejected.json'] as $row) {
            if (($row['url_hash'] ?? '') === $urlHash) { $err = 'A keeper has already declined that address.'; return null; }
        }
        if ($mine >= TTG_WIRE_PER_POSITION_DAY) { $err = 'The wire will not take more from this position today.'; return null; }
        if ($sameHost >= TTG_WIRE_PER_HOST_PENDING) { $err = 'Enough from that site is already waiting. Let a keeper catch up.'; return null; }
        if (count($d['pending.json']) >= TTG_WIRE_PENDING_MAX) { $err = 'The hopper is full. A keeper must clear it first.'; return null; }
        $d['pending.json'][] = [
            'id' => ttg_graph_public_id('01TTGW'),
            'url' => $norm['url'],
            'host' => $norm['host'],
            'url_hash' => $urlHash,
            'title' => $title,
            'note' => $note,
            'from' => $from !== '' ? $from : (!empty($viewer['known']) ? (string) $viewer['first'] : ''),
            'member' => !empty($viewer['known']) ? (string) ($viewer['slug'] ?? '') : '',
            'at' => time(),
            'ip_hash' => $ipHash,
        ];
        return $d;
    });
    if (!$ok) return ['ok' => false, 'error' => $err ?? 'The wire could not be written.'];
    ttg_jack_rate_allow('wire', TTG_WIRE_PER_SESSION_HOUR, true);
    return ['ok' => true];
}

/**
 * Keeper decision on one link. clear: pending → cleared. reject: pending → gone.
 * withdraw: cleared → gone. Rejected and withdrawn addresses cannot be resent.
 * @return array{ok:bool,error?:string}
 */
function ttg_wire_decide(string $action, string $id, array $viewer): array {
    if (!ttg_guild_keeper($viewer)) return ['ok' => false, 'error' => 'Only a keeper may decide.'];
    if (!in_array($action, ['clear', 'reject', 'withdraw'], true) || !preg_match('/^01TTGW[0-9A-F]{22}$/', $id)) {
        return ['ok' => false, 'error' => 'The clerk cannot find that slip.'];
    }
    $by = (string) ($viewer['slug'] ?? 'keeper');
    $now = time();
    $err = null;
    $ok = ttg_wire_transact(static function (array $d) use ($action, $id, $by, $now, &$err) {
        $from = $action === 'withdraw' ? 'cleared.json' : 'pending.json';
        $hit = null;
        $rest = [];
        foreach ($d[$from] as $row) {
            if ($hit === null && ($row['id'] ?? '') === $id) { $hit = $row; continue; }
            $rest[] = $row;
        }
        if ($hit === null) { $err = 'That slip has already been decided.'; return null; }
        $d[$from] = $rest;
        if ($action === 'clear') {
            unset($hit['ip_hash']);
            $hit['cleared_at'] = gmdate('c', $now);
            $hit['cleared_by'] = $by;
            $d['cleared.json'][] = $hit;
        } else {
            $d['rejected.json'][] = ['url_hash' => (string) ($hit['url_hash'] ?? ''), 'host' => (string) ($hit['host'] ?? ''), 'at' => $now, 'by' => $by, 'action' => $action];
            $d['rejected.json'] = array_slice($d['rejected.json'], -TTG_WIRE_REJECTED_KEEP);
        }
        return $d;
    });
    if (!$ok) return ['ok' => false, 'error' => $err ?? 'The wire could not be written.'];
    ttg_graph_navigator_ledger('WIRE_' . strtoupper($action), $viewer, $id, 'Link ' . $action . ' by keeper.');
    return ['ok' => true];
}

function ttg_wire_ago(int $ts): string {
    $s = max(0, time() - $ts);
    if ($s < 3600) return max(1, intdiv($s, 60)) . ' min ago';
    if ($s < 86400) return intdiv($s, 3600) . ' h ago';
    return intdiv($s, 86400) . ' d ago';
}
