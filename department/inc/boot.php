<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/inc/track.php';

function det_detect_base(): string {
    $sn = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    if (preg_match('#^(.*?/department)(?:/|$)#', $sn, $m)) return $m[1];
    $uri = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '');
    if (preg_match('#^(.*?/department)(?:/|$)#', $uri, $m)) return $m[1];
    return '/department';
}

define('DET_ROOT', dirname(__DIR__));
define('DET_WEB', det_detect_base());
const DET_BASE = '/department';

function det_path(): string {
    $uri = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if (str_starts_with($uri, DET_WEB)) $uri = substr($uri, strlen(DET_WEB));
    $uri = '/' . trim($uri, '/');
    if ($uri === '/') return '';
    $path = trim($uri, '/');
    if (str_ends_with(strtolower($path), '.php')) {
        $path = substr($path, 0, -4);
    }
    return $path;
}

function det_url(string $path = ''): string {
    $path = ltrim($path, '/');
    if ($path === '') {
        $url = DET_WEB . '/';
    } elseif (str_contains($path, '.php')) {
        $url = DET_WEB . '/' . $path;
    } else {
        $url = DET_WEB . '/' . $path . '/';
    }
    $lang = $GLOBALS['DET_LANG'] ?? 'en';
    if ($lang === 'cy') $url .= (str_contains($url, '?') ? '&' : '?') . 'lang=cy';
    return $url;
}

function det_s(string $key): string {
    static $pack;
    if ($pack === null) $pack = require DET_ROOT . '/inc/i18n.php';
    $lang = $GLOBALS['DET_LANG'] ?? 'en';
    if (!isset($pack[$key])) return $key;
    return $pack[$key][$lang] ?? $pack[$key]['en'] ?? $key;
}

function det_e(string $key): string {
    return det_h(det_s($key));
}

function det_la(array $row, string $field): array {
    $v = det_l($row, $field);
    return is_array($v) ? $v : [];
}

function det_status_label(string $st): string {
    if ($st === 'closed') return det_s('closed');
    if ($st === 'limited') return det_s('limited');
    return det_s('open');
}

function det_ptype(string $t): string {
    $s = det_s('type.'.$t);
    return $s === 'type.'.$t ? $t : $s;
}

function det_form_labels(string $id): array {
    $placeKey = 'form.place';
    $whatKey = 'form.what';
    $hintKey = 'form.what.h';
    $map = [
        'DET-14' => ['form.place.14', 'form.what.14', 'form.what.14.h'],
        'DET-22' => ['form.place.22', 'form.what.22', 'form.what.h'],
        'DET-44' => ['form.place.44', 'form.what.44', 'form.what.h'],
        'DET-61' => ['form.place.61', 'form.what.61', 'form.what.h'],
        'DET-78' => ['form.place.78', 'form.what.78', 'form.what.78.h'],
        'DET-09' => ['form.place.09', 'form.what.09', 'form.what.09.h'],
        'DET-17' => ['form.place.17', 'form.what.17', 'form.what.h'],
        'DET-33' => ['form.place.33', 'form.what.33', 'form.what.h'],
        'DET-52' => ['form.place.52', 'form.what.52', 'form.what.h'],
        'DET-80' => ['form.place.09', 'form.what.09', 'form.what.09.h'],
    ];
    if (isset($map[$id])) {
        [$placeKey, $whatKey, $hintKey] = $map[$id];
    }
    return ['place' => det_s($placeKey), 'what' => det_s($whatKey), 'hint' => det_s($hintKey)];
}

function det_lang_hidden(): string {
    if (($GLOBALS['DET_LANG'] ?? 'en') !== 'cy') return '';
    return '<input type="hidden" name="lang" value="cy">';
}

function det_rev_note(array $pub, array $r): string {
    $note = (string) ($r['note'] ?? '');
    if (($GLOBALS['DET_LANG'] ?? 'en') !== 'cy') return $note;
    $id = (string) ($pub['id'] ?? '');
    $ver = (string) ($r['ver'] ?? '');
    $cy = det_cy();
    return (string) ($cy['publications'][$id]['rev'][$ver] ?? $note);
}

function det_cy(): array {
    static $cy;
    if ($cy === null) {
        $raw = @file_get_contents(DET_ROOT . '/data/cy.json');
        $cy = $raw === false ? [] : (json_decode($raw, true) ?: []);
    }
    return $cy;
}

function det_l(array $row, string $field) {
    $lang = $GLOBALS['DET_LANG'] ?? 'en';
    if ($lang === 'cy') {
        if (isset($row[$field . '_cy']) && $row[$field . '_cy'] !== '' && $row[$field . '_cy'] !== []) {
            return $row[$field . '_cy'];
        }
        $ids = array_values(array_filter([
            (string) ($row['id'] ?? ''),
            (string) ($row['slug'] ?? ''),
        ]));
        $cy = det_cy();
        foreach ($ids as $id) {
            foreach (['vacancies', 'forms', 'news', 'publications', 'offices'] as $bucket) {
                if (isset($cy[$bucket][$id][$field])) return $cy[$bucket][$id][$field];
            }
        }
    }
    return $row[$field] ?? '';
}

function det_abs_href(string $href): string {
    if (str_starts_with($href, '/department/')) {
        $href = DET_WEB . substr($href, strlen('/department'));
    }
    $lang = $GLOBALS['DET_LANG'] ?? 'en';
    if ($lang === 'cy' && !str_contains($href, 'lang=')) {
        $href .= (str_contains($href, '?') ? '&' : '?') . 'lang=cy';
    }
    return $href;
}

function det_station_url(): string {
    return preg_replace('#/department$#', '/station13', DET_WEB) . '/';
}

function det_fmt_date(string $iso): string {
    return det_date($iso);
}

function det_h(string $v): string {
    return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function det_json(string $file): array {
    static $cache = [];
    if (!str_ends_with($file, '.json')) $file .= '.json';
    if (isset($cache[$file])) return $cache[$file];
    $raw = @file_get_contents(DET_ROOT . '/data/' . $file);
    $cache[$file] = $raw === false ? [] : (json_decode($raw, true) ?: []);
    return $cache[$file];
}

function det_publications(): array { return det_json('publications.json'); }
function det_vacancies(): array { return det_json('vacancies.json'); }
function det_news(): array { return det_json('news.json'); }
function det_forms(): array { return det_json('forms.json'); }
function det_offices(): array { return det_json('offices.json'); }

function det_pub(string $slug): ?array {
    $want = strtolower($slug);
    foreach (det_publications() as $p) {
        $id = strtolower((string) ($p['id'] ?? ''));
        $s = strtolower((string) ($p['slug'] ?? ''));
        if ($id === $want || $s === $want) return $p;
    }
    return null;
}

function det_job(string $slug): ?array {
    foreach (det_vacancies() as $j) {
        if (($j['slug'] ?? '') === $slug || ($j['id'] ?? '') === $slug) return $j;
    }
    return null;
}

function det_form(string $id): ?array {
    $want = strtoupper($id);
    foreach (det_forms() as $f) {
        if (strtoupper((string) ($f['id'] ?? '')) === $want) return $f;
    }
    return null;
}

function det_date(string $iso): string {
    $t = strtotime($iso);
    if ($t === false) return $iso;
    $lang = $GLOBALS['DET_LANG'] ?? 'en';
    if ($lang !== 'cy') return date('j F Y', $t);
    $months = ['Ionawr','Chwefror','Mawrth','Ebrill','Mai','Mehefin','Gorffennaf','Awst','Medi','Hydref','Tachwedd','Rhagfyr'];
    return (int) date('j', $t) . ' ' . $months[(int) date('n', $t) - 1] . ' ' . date('Y', $t);
}

function det_lang(): string {
    $allowed = ['en', 'cy'];
    if (isset($_GET['lang']) && in_array($_GET['lang'], $allowed, true)) {
        $lang = $_GET['lang'];
        setcookie('det_lang', $lang, [
            'expires' => time() + 86400 * 365,
            'path' => DET_WEB . '/',
            'samesite' => 'Lax',
        ]);
        return $lang;
    }
    $c = $_COOKIE['det_lang'] ?? 'en';
    return in_array($c, $allowed, true) ? $c : 'en';
}

function det_t(array $pair): string {
    $lang = $GLOBALS['DET_LANG'] ?? 'en';
    return $pair[$lang] ?? $pair['en'];
}

function det_self_lang(string $lang): string {
    $path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? DET_WEB . '/', PHP_URL_PATH) ?: DET_WEB . '/');
    $q = $_GET;
    $q['lang'] = $lang;
    return $path . '?' . http_build_query($q);
}

function det_fmt_money(string $s): string { return $s; }

$DET_LANG = det_lang();
$GLOBALS['DET_LANG'] = $DET_LANG;

require_once __DIR__ . '/mail.php';
$detPath = det_path();
if (
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'
    || $detPath === 'contact'
    || str_starts_with($detPath, 'forms')
    || $detPath === 'services/report'
    || $detPath === 'services/research-access'
) {
    det_form_session();
}
$GLOBALS['DET_FORM_RESULT'] = det_consume_form_post();
