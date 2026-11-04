<?php
declare(strict_types=1);

/**
 * Open Graph + punch-card favicon for every public HTML door.
 * Attached like track.php. Never wraps JSON.
 */

const TTG_OG_ORIGIN = 'https://timetravellersguild.com';

function ttg_og_h(string $v): string
{
    return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** @return array<string, array{title:string,description:string,image:string,url:string,type?:string}> */
function ttg_og_catalog(): array
{
    $img = static fn(string $slug): string => TTG_OG_ORIGIN . '/assets/og/' . $slug . '.png';
    return [
        'intro' => [
            'title' => 'The Time Travellers Guild',
            'description' => 'Meet Jack, the clerk. The Guild is for people who forgot they already travel through time.',
            'image' => $img('intro'),
            'url' => TTG_OG_ORIGIN . '/',
        ],
        'now' => [
            'title' => 'NOW — timetravellersguild.com',
            'description' => 'A bounded field. Local present against network present 17.04.2033.',
            'image' => $img('now'),
            'url' => TTG_OG_ORIGIN . '/now',
        ],
        'jack' => [
            'title' => 'JACK — timetravellersguild.com',
            'description' => 'Jack lives inside a Rubik cube. Desk, tap, hopper, Jack. He is not a chatbot.',
            'image' => $img('jack'),
            'url' => TTG_OG_ORIGIN . '/jack',
        ],
        'tarot' => [
            'title' => 'JACK / PUNCHCARD TAROT — timetravellersguild.com',
            'description' => 'Jack’s punchcard tarot. Hold a question. Punch the hopper. Inspect each slip.',
            'image' => $img('tarot'),
            'url' => TTG_OG_ORIGIN . '/jack/tarot/',
        ],
        'feed' => [
            'title' => 'FEED∞ — Time Travellers Guild',
            'description' => 'Instrument №15. Media, machine interpretation, encounter. Observation alters navigation.',
            'image' => $img('feed'),
            'url' => TTG_OG_ORIGIN . '/feed/',
        ],
        'department' => [
            'title' => 'Department of Excess Time',
            'description' => 'Welsh Government. Established 1951. The Department administers consequences. It does not create causes.',
            'image' => $img('department'),
            'url' => TTG_OG_ORIGIN . '/department/',
        ],
        'join' => [
            'title' => 'JOIN — Time Travellers Guild',
            'description' => 'Punch your coordinates. Pop-up workshops. A programme, not a destination.',
            'image' => $img('join'),
            'url' => TTG_OG_ORIGIN . '/join/',
        ],
        'signals' => [
            'title' => 'SIGNALS — Time Travellers Guild',
            'description' => 'Audio fragments, coded broadcasts, public notices. A punchcard plane. Not canon.',
            'image' => $img('signals'),
            'url' => TTG_OG_ORIGIN . '/signals/',
        ],
        'watch' => [
            'title' => 'The Watch — Time Travellers Guild',
            'description' => 'Instrument №14: an orbital viewer for glass plates, warped through brass optics.',
            'image' => $img('watch'),
            'url' => TTG_OG_ORIGIN . '/watch/',
        ],
        'hub' => [
            'title' => 'HUB — The Time Travellers Guild',
            'description' => 'Modes, disciplines, avenues, properties and trajectory. Station XIII console.',
            'image' => $img('hub'),
            'url' => TTG_OG_ORIGIN . '/hub/',
        ],
        'station13' => [
            'title' => 'Station 13',
            'description' => 'The instrument does not announce itself.',
            'image' => $img('station13'),
            'url' => TTG_OG_ORIGIN . '/station13/',
        ],
        'square' => [
            'title' => 'Gillett Square — Time Travellers Guild Playground',
            'description' => 'Official playground of the Time Travellers Guild. Jack has brought his cube outdoors.',
            'image' => $img('square'),
            'url' => TTG_OG_ORIGIN . '/square/',
        ],
        'triangla' => [
            'title' => 'Triangla — Time Travellers Guild',
            'description' => 'The finger drum with three sides.',
            'image' => $img('triangla'),
            'url' => TTG_OG_ORIGIN . '/triangla/',
        ],
        'cardiff' => [
            'title' => 'On the Founding at Cardiff — Guild Archive, Instrument №13',
            'description' => 'An archival note on the cross-temporal founding of the Time Travellers Guild at Cardiff.',
            'image' => $img('cardiff'),
            'url' => TTG_OG_ORIGIN . '/cardiff/',
        ],
        'cube' => [
            'title' => 'JACK / CUBE',
            'description' => 'Jack has slightly broken geometry. Restore the cube, one lesson at a time.',
            'image' => $img('cube'),
            'url' => TTG_OG_ORIGIN . '/cube/',
        ],
        'machine' => [
            'title' => 'TIME MACHINE №13',
            'description' => 'Instrument №13. Operate the Guild’s living graph: knobs, punchcards, emergy.',
            'image' => $img('cube'),
            'url' => TTG_OG_ORIGIN . '/machine/',
        ],
        'people' => [
            'title' => 'People — The Time Travellers Guild',
            'description' => 'The cast register. Punch stock. Public layer. Not canon.',
            'image' => $img('people'),
            'url' => TTG_OG_ORIGIN . '/people/',
        ],
        'field' => [
            'title' => 'THE FIELD — Time Travellers Guild',
            'description' => 'Five projections of one field. Tell Jack your story. He lodges. He does not write canon.',
            'image' => $img('field'),
            'url' => TTG_OG_ORIGIN . '/field/',
        ],
        'navigator' => [
            'title' => 'NAVIGATOR — Time Travellers Guild',
            'description' => 'Walk the timetree. Pending slips are not canon. A keeper writes canon.',
            'image' => $img('navigator'),
            'url' => TTG_OG_ORIGIN . '/navigator/',
        ],
        'arianrhod' => [
            'title' => 'ARIANRHOD — Time Travellers Guild',
            'description' => 'Jack overheated. The warehouse is gone. Arianrhod must escape the labyrinth.',
            'image' => $img('arianrhod'),
            'url' => TTG_OG_ORIGIN . '/arianrhod/',
        ],
        'archive' => [
            'title' => 'Archive — Time Travellers Guild',
            'description' => 'Rooms attached to a stable chronology. Elsewhen is time without permission.',
            'image' => $img('archive'),
            'url' => TTG_OG_ORIGIN . '/archive/',
        ],
        'door' => [
            'title' => 'The Time Travellers Guild — Station XIII',
            'description' => 'Station XIII. The Ffilm is begun. Find your way through.',
            'image' => $img('door'),
            'url' => TTG_OG_ORIGIN . '/door.html',
        ],
        'puzzle' => [
            'title' => 'The polite phish — JACK / J-1951-PHI',
            'description' => 'A functional punchcard ARG. No login. No payment. Every puzzle is solvable.',
            'image' => $img('puzzle'),
            'url' => TTG_OG_ORIGIN . '/jack/puzzle/',
        ],
        'map' => [
            'title' => 'JACK / MAP — timetravellersguild.com',
            'description' => 'Jack\'s body as a postal map. Humans file. The robot shuffles.',
            'image' => $img('map'),
            'url' => TTG_OG_ORIGIN . '/jack/map/',
        ],
    ];
}

/** Longest-prefix path → catalog key. */
function ttg_og_routes(): array
{
    return [
        '/department' => 'department',
        '/jack/tarot' => 'tarot',
        '/jack/puzzle' => 'puzzle',
        '/jack/map' => 'map',
        '/jack/body' => 'jack',
        '/jack/room' => 'jack',
        '/jack/office' => 'jack',
        '/jack/ledger' => 'jack',
        '/deck' => 'tarot',
        '/jack' => 'jack',
        '/feed' => 'feed',
        '/join' => 'join',
        '/signals' => 'signals',
        '/watch' => 'watch',
        '/hub' => 'hub',
        '/station13' => 'station13',
        '/station' => 'station13',
        '/square' => 'square',
        '/triangla' => 'triangla',
        '/cardiff' => 'cardiff',
        '/cube' => 'cube',
        '/machine' => 'machine',
        '/people' => 'people',
        '/field' => 'field',
        '/navigator' => 'navigator',
        '/arianrhod' => 'arianrhod',
        '/now' => 'now',
        '/now/tree' => 'now',
        '/n' => 'now',
        '/archive' => 'archive',
        '/film' => 'archive',
        '/missions' => 'archive',
        '/stations' => 'archive',
        '/research' => 'archive',
        '/commons' => 'archive',
        '/calendar' => 'archive',
        '/elsewhen' => 'archive',
        '/chronometer' => 'archive',
        '/door.html' => 'door',
        '/two.html' => 'door',
        '/ok' => 'hub',
        '/' => 'intro',
    ];
}

function ttg_og_key_for_path(string $path): string
{
    $path = strtolower((string) (parse_url($path, PHP_URL_PATH) ?: $path));
    if ($path === '' || $path === '/intro' || $path === '/intro.php' || $path === '/index.html') {
        return 'intro';
    }
    if ($path !== '/') {
        $path = rtrim($path, '/') ?: '/';
    }
    $routes = ttg_og_routes();
    $best = '';
    $key = 'intro';
    foreach ($routes as $prefix => $slug) {
        if ($path === $prefix || ($prefix !== '/' && str_starts_with($path, $prefix))) {
            if (strlen($prefix) >= strlen($best)) {
                $best = $prefix;
                $key = $slug;
            }
        }
    }
    return $key;
}

/** @return array{title:string,description:string,image:string,url:string,type:string} */
function ttg_og_for_path(string $path): array
{
    $catalog = ttg_og_catalog();
    $key = ttg_og_key_for_path($path);
    $row = $catalog[$key] ?? $catalog['intro'];
    $row['type'] = $row['type'] ?? 'website';
    $row['key'] = $key;
    return $row;
}

function ttg_og_request_path(): string
{
    return (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
}

/** @return array{title:string,description:string,image:string,url:string,type:string,key:string} */
function ttg_og_for_request(): array
{
    $og = ttg_og_for_path(ttg_og_request_path());
    if (!empty($GLOBALS['TTG_OG']) && is_array($GLOBALS['TTG_OG'])) {
        $og = array_merge($og, $GLOBALS['TTG_OG']);
    }
    return $og;
}

function ttg_og_abs(string $href): string
{
    $href = trim($href);
    if ($href === '') return TTG_OG_ORIGIN . '/';
    if (str_starts_with($href, 'http://') || str_starts_with($href, 'https://')) return $href;
    if ($href[0] !== '/') $href = '/' . $href;
    return TTG_OG_ORIGIN . $href;
}

function ttg_og_favicon_tags(): string
{
    return implode("\n", [
        '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
        '<link rel="icon" href="/assets/favicon.ico" sizes="32x32">',
        '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
    ]) . "\n";
}

/** @param array{title?:string,description?:string,image?:string,url?:string,type?:string} $og */
function ttg_og_meta_tags(array $og): string
{
    $title = (string) ($og['title'] ?? 'The Time Travellers Guild');
    $desc = (string) ($og['description'] ?? '');
    $image = (string) ($og['image'] ?? TTG_OG_ORIGIN . '/assets/og/intro.png');
    $url = ttg_og_abs((string) ($og['url'] ?? TTG_OG_ORIGIN . '/'));
    $type = (string) ($og['type'] ?? 'website');
    $lines = [
        '<meta property="og:site_name" content="TIMETRAVELLERSGUILD.COM">',
        '<meta property="og:title" content="' . ttg_og_h($title) . '">',
        '<meta property="og:description" content="' . ttg_og_h($desc) . '">',
        '<meta property="og:image" content="' . ttg_og_h($image) . '">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:url" content="' . ttg_og_h($url) . '">',
        '<meta property="og:type" content="' . ttg_og_h($type) . '">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="twitter:title" content="' . ttg_og_h($title) . '">',
        '<meta name="twitter:description" content="' . ttg_og_h($desc) . '">',
        '<meta name="twitter:image" content="' . ttg_og_h($image) . '">',
    ];
    return implode("\n", $lines) . "\n";
}

function ttg_og_canonical_tag(string $url): string
{
    return '<link rel="canonical" href="' . ttg_og_h(ttg_og_abs($url)) . '">' . "\n";
}

/** @param array<string,string>|null $override */
function ttg_og_head(?array $override = null): string
{
    $og = ttg_og_for_request();
    if ($override) $og = array_merge($og, $override);
    return ttg_og_favicon_tags() . ttg_og_meta_tags($og);
}

function ttg_og_extract_attr(string $html, string $pattern): string
{
    if (preg_match($pattern, $html, $m)) {
        return html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    return '';
}

function ttg_og_filter(string $html): string
{
    if ($html === '' || !preg_match('/<\\/head>/i', $html)) {
        return $html;
    }
    $lead = ltrim($html);
    if ($lead !== '' && ($lead[0] === '{' || $lead[0] === '[')) {
        return $html;
    }

    $og = ttg_og_for_request();
    $title = ttg_og_extract_attr($html, '/<title[^>]*>([^<]*)<\\/title>/i');
    if ($title !== '') $og['title'] = $title;
    $desc = ttg_og_extract_attr($html, '/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']/i');
    if ($desc === '') {
        $desc = ttg_og_extract_attr($html, '/<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\']/i');
    }
    if ($desc !== '') $og['description'] = $desc;
    $canon = ttg_og_extract_attr($html, '/<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']*)["\']/i');
    if ($canon === '') {
        $canon = ttg_og_extract_attr($html, '/<link[^>]+href=["\']([^"\']*)["\'][^>]+rel=["\']canonical["\']/i');
    }
    if ($canon !== '') $og['url'] = ttg_og_abs($canon);

    $inject = '';
    if (!preg_match('/rel=["\']icon["\']/i', $html)) {
        $inject .= ttg_og_favicon_tags();
    }
    if (!preg_match('/property=["\']og:image["\']/i', $html)) {
        $inject .= ttg_og_meta_tags($og);
    }
    if ($canon === '' && !preg_match('/rel=["\']canonical["\']/i', $html)) {
        $inject .= ttg_og_canonical_tag((string) $og['url']);
    }
    if ($inject === '') {
        return $html;
    }

    $out = preg_replace('/<\\/head>/i', $inject . '</head>', $html, 1);
    return is_string($out) ? $out : $html;
}

function ttg_og_attach(): void
{
    static $on = false;
    if ($on || PHP_SAPI === 'cli') {
        return;
    }
    $on = true;
    ob_start('ttg_og_filter');
}

ttg_og_attach();
