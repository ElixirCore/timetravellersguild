<?php
declare(strict_types=1);

/**
 * Cardiff's public archives, as Jack reads them.
 *
 *   museum    Amgueddfa Cymru – Museum Wales, Collections Online (the national museum, Cathays Park).
 *             No published API: we read its public search and object pages and keep only text and links.
 *             Images are "by permission of Amgueddfa Cymru", so Jack links to them and never copies them.
 *   archives  Glamorgan Archives, Canfod catalogue (Leckwith, Cardiff), via its public JSON search.
 *
 * Read-only, HTTPS only, fixed hosts, short timeouts, answers cached for a day under storage/
 * so a busy gallery does not hammer either institution. These are REAL records: they show the
 * world around Jack's memories, never proof of them.
 */
final class CardiffArchives
{
    private const MUSEUM = 'https://museum.wales';
    private const CANFOD = 'https://canfod.glamarchives.gov.uk';
    private const UA = 'JackTheClerk/1 (+https://timetravellersguild.com)';
    private const TTL = 86400;

    /** @return array<string, mixed> */
    public static function search(string $query, string $source = 'both', int $limit = 6): array
    {
        $query = trim(preg_replace('/\s+/', ' ', $query) ?? '');
        if ($query === '' || mb_strlen($query) > 120) return ['ok' => false, 'error' => 'Give a few words to search for.'];
        $limit = max(1, min(10, $limit));
        $source = in_array($source, ['museum', 'archives', 'both'], true) ? $source : 'both';
        $out = ['ok' => true, 'query' => $query];
        $museum = self::MUSEUM . '/collections/online/?field0=string&value0=' . rawurlencode($query);
        $canfod = self::CANFOD . '/api/catalogues/glamorgan/search/public/records/default/all?' . http_build_query([
            'q' => $query, 'spellcheck' => 'false', 'limit' => $limit, 'sort' => 'score desc',
        ], '', '&', PHP_QUERY_RFC3986);
        // Both institutions are asked at once; the museum is the slow one (often 5 to 8 seconds).
        $got = self::fetchMany(array_filter([
            'museum' => $source !== 'archives' ? $museum : null,
            'archives' => $source !== 'museum' ? $canfod : null,
        ]));
        if ($source !== 'archives') $out['museum_wales'] = self::museumResults($got['museum'] ?? null, $museum, $limit);
        if ($source !== 'museum') $out['glamorgan_archives'] = self::canfodResults($got['archives'] ?? null, $query, $limit);
        $out['note'] = 'Real public records held in Cardiff. Cite them by title, reference and link. They show the world around your memories; they are not proof of them. Museum Wales images are by permission: link, do not copy.';
        return $out;
    }

    /** Read one Museum Wales object in full, by its link or id. */
    public static function readObject(string $ref): array
    {
        if (!preg_match('~(?:^|/object/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})~i', trim($ref), $m)) {
            return ['ok' => false, 'error' => 'Give a Museum Wales object link or id from search_cardiff_archives.'];
        }
        $id = strtolower($m[1]);
        $url = self::MUSEUM . '/collections/online/object/' . $id . '/';
        $html = self::fetchMany(['o' => $url])['o'] ?? null;
        if ($html === null) return ['ok' => false, 'error' => 'The museum did not answer.'];
        $main = ($p = stripos($html, '<main')) !== false ? substr($html, $p) : $html;
        // Drop the search form and everything after the record itself.
        $body = preg_replace('~^.*?Back to search results~is', '', $main) ?? $main;
        $body = preg_replace('~(Comments are currently unavailable|Related Items|Site Map).*$~is', '', $body) ?? $body;
        $text = self::text(preg_replace('~<(br|p|div|li|h[1-6]|tr|dt|dd)\b~i', "\n<$1", $body) ?? '', true);
        if ($text === '') return ['ok' => false, 'error' => 'No such object.'];
        $title = strtok($text, "\n") ?: '';  // the object's own heading leads the record
        return ['ok' => true, 'source' => 'Amgueddfa Cymru – Museum Wales', 'title' => $title,
            'record' => mb_substr($text, 0, 2500), 'link' => $url,
            'rights' => 'Image and record by permission of Amgueddfa Cymru – Museum Wales. Link to it; do not reproduce the image.'];
    }

    /** @return array<string, mixed> */
    private static function museumResults(?string $html, string $url, int $limit): array
    {
        if ($html === null) return ['ok' => false, 'error' => 'The museum did not answer.', 'search_link' => $url];
        $total = preg_match('~([\d,]+)\s+results?~i', $html, $n) ? (int) str_replace(',', '', $n[1]) : 0;
        $items = [];
        foreach (preg_split('~<div class="search_result">~', $html) ?: [] as $i => $chunk) {
            if ($i === 0) continue;
            if (!preg_match('~<h3><a href="(/collections/online/object/([0-9a-f-]{36})[^"?]*)[^"]*">(.*?)</a></h3>~is', $chunk, $h)) continue;
            $items[] = array_filter([
                'title' => self::text($h[3]),
                'area' => preg_match('~<div class="result_type">(.*?)</div>~is', $chunk, $a) ? self::text($a[1]) : '',
                'item_number' => preg_match('~<div class="result_identifier">(.*?)</div>~is', $chunk, $r) ? self::text($r[1]) : '',
                'has_image' => str_contains($chunk, '/media-dams/'),
                'id' => $h[2],
                'link' => self::MUSEUM . '/collections/online/object/' . $h[2] . '/',
            ], static fn ($v) => $v !== '' && $v !== false);
            if (count($items) >= $limit) break;
        }
        return ['ok' => true, 'found' => $total ?: count($items), 'items' => $items,
            'search_link' => $url, 'read_more' => 'read_museum_object with an id gives dates, makers, materials and categories.'];
    }

    /** @return array<string, mixed> */
    private static function canfodResults(?string $json, string $q, int $limit): array
    {
        $data = $json === null ? null : json_decode($json, true);
        if (!is_array($data) || !is_array($data['records']['docs'] ?? null)) return ['ok' => false, 'error' => 'The archive did not answer.'];
        $items = [];
        foreach (array_slice($data['records']['docs'], 0, $limit) as $d) {
            $ref = (string) ($d['publicRefNo'] ?? $d['refNo'] ?? '');
            $items[] = array_filter([
                'title' => (string) ($d['recordTitle'] ?? $d['title'] ?? ''),
                'date' => (string) ($d['date'] ?? ''),
                'level' => (string) ($d['level'] ?? ''),
                'reference' => $ref,
                'collection' => (string) ($d['collectionTitle'] ?? ''),
                'within' => implode(' › ', array_map(static fn ($a) => (string) ($a['title'] ?? ''), (array) ($d['ancestors'] ?? []))),
                'digitised' => !empty($d['thumb']),
                'link' => $ref !== '' ? self::CANFOD . '/en/records/' . implode('/', array_map('rawurlencode', explode('/', $ref))) : '',
            ], static fn ($v) => $v !== '' && $v !== false);
        }
        return ['ok' => true, 'found' => (int) ($data['records']['numFound'] ?? count($items)), 'items' => $items,
            'search_link' => self::CANFOD . '/en/search/all:records/0_50/all/score_desc/' . rawurlencode($q)];
    }

    /**
     * GET fixed-host HTTPS URLs in parallel, each cached for a day.
     * @param array<string, string> $urls key => url
     * @return array<string, ?string> key => body (null when it failed)
     */
    private static function fetchMany(array $urls): array
    {
        $dir = dirname(__DIR__, 2) . '/storage/jack/archives';
        $out = [];
        $mh = curl_multi_init();
        $handles = [];
        foreach ($urls as $key => $url) {
            $host = parse_url($url, PHP_URL_HOST);
            if (!in_array($host, ['museum.wales', 'canfod.glamarchives.gov.uk'], true)) { $out[$key] = null; continue; }
            $file = $dir . '/' . sha1($url) . '.cache';
            if (is_file($file) && filemtime($file) > time() - self::TTL && is_string($hit = file_get_contents($file)) && $hit !== '') {
                $out[$key] = $hit;
                continue;
            }
            $ch = curl_init($url);
            if ($ch === false) { $out[$key] = null; continue; }
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 2,
                CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_USERAGENT => self::UA,
                CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
                CURLOPT_HTTPHEADER => [str_contains($url, '/api/') ? 'Accept: application/json' : 'Accept: text/html', 'Accept-Language: en-GB'],
            ]);
            curl_multi_add_handle($mh, $ch);
            $handles[$key] = [$ch, $host, $file];
        }
        if ($handles !== []) {
            do {
                $status = curl_multi_exec($mh, $running);
                if ($running) curl_multi_select($mh, 1.0);
            } while ($running && $status === CURLM_OK);
        }
        foreach ($handles as $key => [$ch, $host, $file]) {
            $body = curl_multi_getcontent($ch);
            $ok = is_string($body) && $body !== '' && (int) curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200
                && parse_url((string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL), PHP_URL_HOST) === $host;
            curl_multi_remove_handle($mh, $ch);
            $out[$key] = $ok ? $body : null;
            if ($ok) {
                if (!is_dir($dir)) @mkdir($dir, 0775, true);
                @file_put_contents($file, $body, LOCK_EX);
            }
        }
        curl_multi_close($mh);
        return $out;
    }

    private static function text(string $html, bool $lines = false): string
    {
        $s = html_entity_decode(strip_tags(preg_replace('~<(script|style)\b.*?</\1>~is', ' ', $html) ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (!$lines) return trim(preg_replace('/\s+/u', ' ', $s) ?? '');
        $rows = array_filter(array_map(static fn ($l) => trim(preg_replace('/[ \t\x{00A0}]+/u', ' ', $l) ?? ''), explode("\n", $s)), static fn ($l) => $l !== '');
        return implode("\n", $rows);
    }
}
