<?php
/**
 * timetravellersguild.com/feed/index.php
 * ─────────────────────────────────────────────────────────────────────────────
 * FEED∞ — Instrument №15 of the Time Travellers Guild.
 *
 * MEDIA + MACHINE INTERPRETATION + ENCOUNTER
 *      ↓
 * FIELD STATE
 *      ↓
 * NEXT STATE
 *
 * OBSERVATION ALTERS NAVIGATION.
 *
 * One file. PHP 8+, PDO SQLite, cURL. No CDNs, no fonts phoned home.
 *
 *   /feed/
 *     index.php
 *     /images/             plates
 *     /feed-data/          created automatically, never public
 *
 * FIRST USE:
 *   Visit /feed/?admin
 *
 * The auth hook is deliberately isolated in verifyFaetimePass().
 * For now the local clerk can upload. Public observation remains anonymous.
 *
 * When faetime.space is supplied, replace/configure that function.
 */
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/env.php';
require_once dirname(__DIR__) . '/app/Privacy/WithdrawnMedia.php';
require_once dirname(__DIR__) . '/inc/track.php';
require_once dirname(__DIR__) . '/app/AI/JackTarot.php';
require_once dirname(__DIR__) . '/app/AI/JackTarotDeck.php';

session_start();

/* ============================================================
   CONFIG
   ============================================================ */

const APP_NAME          = 'FEED∞';
const APP_VERSION       = '0.2 / FIELD PROTOTYPE';
const IMAGE_DIR         = __DIR__ . '/images';
const DATA_DIR          = __DIR__ . '/feed-data';
const DB_FILE           = DATA_DIR . '/feed.sqlite';
const CONFIG_FILE       = DATA_DIR . '/config.php';

const MAX_UPLOAD_BYTES  = 25 * 1024 * 1024;
const INGEST_MAX_EDGE   = 1600;
const INGEST_JPEG_Q     = 72;

const RAW_EVENT_DAYS    = 7;
const FEED_BATCH        = 10;


/* ============================================================
   BASIC SECURITY HEADERS
   ============================================================ */

header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: same-origin");
header("X-Frame-Options: SAMEORIGIN");
header(
    "Permissions-Policy: ".
    "camera=(), microphone=(), geolocation=(), ".
    "accelerometer=(self), gyroscope=(self)"
);


/* ============================================================
   HELPERS
   ============================================================ */

function h(?string $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function jsonResponse(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE |
        JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}

function ensureDirs(): void {
    foreach ([IMAGE_DIR, DATA_DIR] as $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
    }

    $htaccess = DATA_DIR . '/.htaccess';

    if (!file_exists($htaccess)) {
        @file_put_contents(
            $htaccess,
            "Require all denied\nDeny from all\n"
        );
    }
}

ensureDirs();


/* ============================================================
   CONFIG FILE
   ============================================================ */

function loadConfig(): array {
    if (!file_exists(CONFIG_FILE)) {
        return [];
    }

    $config = include CONFIG_FILE;

    return is_array($config) ? $config : [];
}

function saveConfig(array $config): void {
    $php = "<?php\nreturn " . var_export($config, true) . ";\n";
    file_put_contents(CONFIG_FILE, $php, LOCK_EX);
}

$config = loadConfig();


/* ============================================================
   DATABASE
   ============================================================ */

function db(): PDO {
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $pdo = new PDO(
        'sqlite:' . DB_FILE,
        null,
        null,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $pdo->exec("
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 3000;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            filename TEXT NOT NULL UNIQUE,
            sha256 TEXT NOT NULL UNIQUE,

            width INTEGER,
            height INTEGER,
            bytes INTEGER,

            created_at TEXT NOT NULL,

            analysed_at TEXT,
            analysis_json TEXT,
            analysis_machine_json TEXT,
            revised_at TEXT,
            revised_by TEXT,

            original_name TEXT,
            mime TEXT,

            seen_count INTEGER NOT NULL DEFAULT 0,
            dwell_total REAL NOT NULL DEFAULT 0,
            revisit_count INTEGER NOT NULL DEFAULT 0,

            residue REAL NOT NULL DEFAULT 0,
            last_seen_at TEXT
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            image_id INTEGER,
            session_id TEXT,

            type TEXT NOT NULL,
            time_bucket TEXT NOT NULL,

            visible_ms INTEGER DEFAULT 0,
            visibility REAL DEFAULT 0,

            scroll_velocity REAL DEFAULT 0,
            scroll_acceleration REAL DEFAULT 0,

            direction INTEGER DEFAULT 0,
            direction_changes INTEGER DEFAULT 0,

            touch_duration INTEGER DEFAULT 0,
            pressure REAL DEFAULT 0,

            touch_x REAL DEFAULT 0,
            touch_y REAL DEFAULT 0,

            tilt_beta REAL DEFAULT 0,
            tilt_gamma REAL DEFAULT 0,

            motion_energy REAL DEFAULT 0,

            revisited INTEGER DEFAULT 0,
            annotation TEXT DEFAULT '',
            thread TEXT DEFAULT ''
        )
    ");

    $pdo->exec("
        CREATE INDEX IF NOT EXISTS idx_events_image
        ON events(image_id)
    ");

    $pdo->exec("
        CREATE INDEX IF NOT EXISTS idx_events_session
        ON events(session_id)
    ");

    $pdo->exec("
        CREATE INDEX IF NOT EXISTS idx_events_bucket
        ON events(time_bucket)
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER NOT NULL,
            source TEXT NOT NULL,
            analysis_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ");

    $pdo->exec("
        CREATE INDEX IF NOT EXISTS idx_revisions_image
        ON revisions(image_id)
    ");

    ensureImageColumns($pdo);
    WithdrawnMedia::purge($pdo);

    return $pdo;
}

function tableHasColumn(PDO $pdo, string $table, string $column): bool {
    $stmt = $pdo->query('PRAGMA table_info(' . $table . ')');

    foreach ($stmt as $col) {
        if (($col['name'] ?? '') === $column) {
            return true;
        }
    }

    return false;
}

function ensureImageColumns(PDO $pdo): void {
    foreach ([
        'analysis_machine_json' => 'TEXT',
        'revised_at' => 'TEXT',
        'revised_by' => 'TEXT',
        'original_name' => 'TEXT',
        'mime' => 'TEXT',
    ] as $column => $type) {
        if (!tableHasColumn($pdo, 'images', $column)) {
            $pdo->exec(
                'ALTER TABLE images ADD COLUMN ' . $column . ' ' . $type
            );
        }
    }
}


/* ============================================================
   INSTALLATION
   ============================================================ */

function installed(): bool {
    global $config;

    return !empty($config['admin_password_hash']);
}

if (!installed() && isset($_POST['install'])) {

    $password = trim((string)($_POST['password'] ?? ''));
    $confirm  = trim((string)($_POST['confirm'] ?? ''));

    if (strlen($password) < 8) {
        $installError = 'Use at least eight characters.';
    } elseif ($password !== $confirm) {
        $installError = 'Passwords do not match.';
    } else {
        $config = [
            'admin_password_hash' => password_hash(
                $password,
                PASSWORD_DEFAULT
            ),

            // Later:
            'faetime_verify_url' => '',
            'faetime_secret'     => '',

            'installed_at' => gmdate('c'),
            'installation_id' => bin2hex(random_bytes(12))
        ];

        saveConfig($config);

        $_SESSION['feed_admin'] = true;

        header('Location: ?admin');
        exit;
    }
}


/* ============================================================
   ADMIN AUTH
   ============================================================ */

function isAdmin(): bool {
    return !empty($_SESSION['feed_admin']);
}

if (isset($_POST['login'])) {

    global $config;

    $password = (string)($_POST['password'] ?? '');

    if (
        !empty($config['admin_password_hash']) &&
        password_verify(
            $password,
            $config['admin_password_hash']
        )
    ) {
        $_SESSION['feed_admin'] = true;

        header('Location: ?admin');
        exit;
    }

    $loginError = 'ACCESS REFUSED';
}

if (isset($_GET['logout'])) {
    session_destroy();

    header('Location: ./');
    exit;
}


/* ============================================================
   CSRF
   ============================================================ */

function csrf(): string {

    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }

    return $_SESSION['csrf'];
}

function requireCsrf(): void {

    $given = (string)($_POST['csrf'] ?? '');

    if (!hash_equals(csrf(), $given)) {
        http_response_code(403);
        exit('FIELD AUTHENTICATION FAILED');
    }
}


/* ============================================================
   FAETIME PASS HOOK
   ============================================================ */

/**
 * This is the seam.
 *
 * Give me the faetime.space machinery later and only this
 * section needs substantially changing.
 */
function verifyFaetimePass(string $pass): bool {

    global $config;

    /*
     * ADMIN IS CURRENT PROTOTYPE PASS.
     */
    if (isAdmin()) {
        return true;
    }

    $url    = trim((string)($config['faetime_verify_url'] ?? ''));
    $secret = trim((string)($config['faetime_secret'] ?? ''));

    /*
     * NO EXTERNAL PASS AUTH CONFIGURED YET.
     */
    if (!$url || !$secret || !$pass) {
        return false;
    }

    /*
     * FUTURE EXAMPLE:
     *
     * POST {
     *   pass: "...",
     *   audience: "feed"
     * }
     *
     * signed server-to-server.
     *
     * Not activated until the real faetime interface exists.
     */

    return false;
}


/* ============================================================
   IMAGE INGESTION
   ============================================================ */

function allowedMime(string $path): ?string {

    $allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
    ];

    $mime = @mime_content_type($path);

    if (in_array($mime, $allowed, true)) {
        return $mime;
    }

    $info = @getimagesize($path);
    $fallback = is_array($info) ? ($info['mime'] ?? null) : null;

    return in_array($fallback, $allowed, true)
        ? $fallback
        : null;
}

function formatBytes(int $bytes): string {
    if ($bytes < 1024) {
        return $bytes . 'B';
    }
    if ($bytes < 1048576) {
        return (string)round($bytes / 1024) . 'KB';
    }
    return number_format($bytes / 1048576, 1) . 'MB';
}

function gdMillReady(): bool {
    return extension_loaded('gd') && function_exists('imagejpeg');
}

function findImageByHash(string $sha): ?array {
    $stmt = db()->prepare("
        SELECT *
        FROM images
        WHERE sha256 = ?
        LIMIT 1
    ");
    $stmt->execute([$sha]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function registerImageFile(string $filename, array $extra = []): ?array {
    if (WithdrawnMedia::contains($filename)) {
        return null;
    }
    $path = IMAGE_DIR . '/' . $filename;

    if (!is_file($path) || !allowedMime($path)) {
        return null;
    }

    $sha = hash_file('sha256', $path);
    $existing = findImageByHash($sha);

    if ($existing) {
        return $existing;
    }

    $size = @getimagesize($path);
    $mime = allowedMime($path) ?? ($size['mime'] ?? null);

    $stmt = db()->prepare("
        INSERT OR IGNORE INTO images (
            filename,
            sha256,
            width,
            height,
            bytes,
            created_at,
            original_name,
            mime
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $filename,
        $sha,
        $size[0] ?? null,
        $size[1] ?? null,
        filesize($path),
        gmdate('c'),
        substr((string)($extra['original_name'] ?? ''), 0, 240) ?: null,
        $mime,
    ]);

    $id = (int)db()->lastInsertId();

    if ($id < 1) {
        return findImageByHash($sha);
    }

    $row = db()->prepare("SELECT * FROM images WHERE id = ?");
    $row->execute([$id]);
    $found = $row->fetch();

    return $found ?: null;
}

function loadUploadBitmap(string $path, string $mime): \GdImage {
    $src = match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($path),
        'image/png'  => @imagecreatefrompng($path),
        'image/webp' => function_exists('imagecreatefromwebp')
            ? @imagecreatefromwebp($path)
            : false,
        'image/gif'  => @imagecreatefromgif($path),
        default      => false,
    };

    if (!$src instanceof \GdImage) {
        throw new RuntimeException('MILL COULD NOT OPEN PLATE');
    }

    return $src;
}

function applyJpegOrientation(\GdImage $src, string $path): array {
    $steps = [];

    if (!function_exists('exif_read_data')) {
        return [$src, $steps];
    }

    $exif = @exif_read_data($path);
    $ori = (int)($exif['Orientation'] ?? 1);

    if ($ori <= 1) {
        return [$src, $steps];
    }

    $turned = match ($ori) {
        3, 4 => @imagerotate($src, 180, 0),
        5, 6 => @imagerotate($src, -90, 0),
        7, 8 => @imagerotate($src, 90, 0),
        default => false,
    };

    if ($turned instanceof \GdImage) {
        $src = $turned;
        $steps[] = 'ORIENTED FROM EXIF ' . $ori;
    }

    if (
        in_array($ori, [2, 4, 5, 7], true) &&
        function_exists('imageflip')
    ) {
        imageflip($src, IMG_FLIP_HORIZONTAL);
        $steps[] = 'MIRRORED';
    }

    return [$src, $steps];
}

function containBitmap(\GdImage $src, int $maxEdge): array {
    $w = imagesx($src);
    $h = imagesy($src);
    $long = max($w, $h);

    if ($long <= $maxEdge) {
        return [$src, $w, $h, false];
    }

    $scale = $maxEdge / $long;
    $nw = max(1, (int)round($w * $scale));
    $nh = max(1, (int)round($h * $scale));
    $dst = imagecreatetruecolor($nw, $nh);

    if ($dst === false) {
        throw new RuntimeException('MILL COULD NOT CONTAIN PLATE');
    }

    $soil = imagecolorallocate($dst, 13, 12, 8);
    imagefilledrectangle($dst, 0, 0, $nw, $nh, $soil);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

    return [$dst, $nw, $nh, true];
}

function ingestToJpeg(string $tmp, string $originalName): array {
    if (!gdMillReady()) {
        throw new RuntimeException('MILL UNAVAILABLE — GD REQUIRED');
    }

    $mime = allowedMime($tmp);

    if (!$mime) {
        throw new RuntimeException('UNSUPPORTED IMAGE');
    }

    $inBytes = (int)filesize($tmp);
    $kind = strtoupper((string)(explode('/', $mime)[1] ?? 'IMAGE'));
    $steps = [
        'RECEIVED ' . $kind . ' ' . formatBytes($inBytes)
    ];

    if ($mime === 'image/gif') {
        $steps[] = 'FIRST FRAME ONLY';
    }

    $src = loadUploadBitmap($tmp, $mime);
    [$src, $orientSteps] = applyJpegOrientation($src, $tmp);
    $steps = array_merge($steps, $orientSteps);

    $ow = imagesx($src);
    $oh = imagesy($src);
    [$src, $w, $h, $scaled] = containBitmap($src, INGEST_MAX_EDGE);

    if ($scaled) {
        $steps[] = 'CONTAINING ' . $ow . '×' . $oh . ' → ' . $w . '×' . $h;
    } else {
        $steps[] = 'ALREADY WITHIN ' . $w . '×' . $h;
    }

    $filename =
        gmdate('Ymd-His') .
        '-' .
        bin2hex(random_bytes(5)) .
        '.jpg';

    $dest = IMAGE_DIR . '/' . $filename;
    imageinterlace($src, true);
    $ok = imagejpeg($src, $dest, INGEST_JPEG_Q);

    if (!$ok || !is_file($dest)) {
        throw new RuntimeException('MILL COULD NOT WRITE JPEG');
    }

    @chmod($dest, 0644);

    $outBytes = (int)filesize($dest);
    $steps[] = 'WROTE JPEG Q' . INGEST_JPEG_Q . ' ' . formatBytes($outBytes);

    $sha = hash_file('sha256', $dest);
    $existing = findImageByHash($sha);

    if ($existing && ($existing['filename'] ?? '') !== $filename) {
        @unlink($dest);
        $id = (int)$existing['id'];
        $steps[] = 'ALREADY HELD #' . str_pad((string)$id, 6, '0', STR_PAD_LEFT);
        return [
            'ok' => true,
            'duplicate' => true,
            'id' => $id,
            'filename' => (string)$existing['filename'],
            'src' => 'images/' . rawurlencode((string)$existing['filename']),
            'width' => (int)$existing['width'],
            'height' => (int)$existing['height'],
            'bytes' => (int)$existing['bytes'],
            'from' => $mime,
            'from_name' => basename($originalName),
            'steps' => $steps,
            'analysed' => !empty($existing['analysed_at']),
        ];
    }

    $row = registerImageFile($filename, [
        'original_name' => basename($originalName),
    ]);

    if (!$row) {
        throw new RuntimeException('MILL COULD NOT REGISTER PLATE');
    }

    $id = (int)$row['id'];
    $steps[] = 'REGISTERED #' . str_pad((string)$id, 6, '0', STR_PAD_LEFT);

    return [
        'ok' => true,
        'duplicate' => false,
        'id' => $id,
        'filename' => $filename,
        'src' => 'images/' . rawurlencode($filename),
        'width' => $w,
        'height' => $h,
        'bytes' => $outBytes,
        'from' => $mime,
        'from_name' => basename($originalName),
        'steps' => $steps,
        'analysed' => false,
    ];
}

function scanImages(): int {

    if (!is_dir(IMAGE_DIR)) {
        return 0;
    }

    $count = 0;
    $files = scandir(IMAGE_DIR);

    foreach ($files as $filename) {

        if ($filename === '.' || $filename === '..') {
            continue;
        }

        $path = IMAGE_DIR . '/' . $filename;

        if (!is_file($path) || !allowedMime($path)) {
            continue;
        }

        $before = findImageByHash(hash_file('sha256', $path));
        $row = registerImageFile($filename);

        if ($row && !$before) {
            $count++;
        }
    }

    return $count;
}

scanImages();


/* ============================================================
   ANALYSIS UTILITIES
   ============================================================ */

function decodeAnalysis(?string $json): array {

    if (!$json) {
        return [];
    }

    $a = json_decode($json, true);

    return is_array($a) ? normalizeAnalysis($a) : [];
}

function houseHosts(): array {
    return [
        'ffilm.org',
        'www.ffilm.org',
        'timetravellersguild.com',
        'www.timetravellersguild.com',
        'faetime.space',
        'www.faetime.space',
        'zoneout.net',
        'www.zoneout.net',
        'tobygodden.com',
        'www.tobygodden.com',
        'chronometer.online',
        'www.chronometer.online',
    ];
}

function hrefAllowed(string $href): bool {
    $href = trim($href);

    if ($href === '' || strlen($href) > 240) {
        return false;
    }

    if (
        str_starts_with($href, '/') &&
        !str_starts_with($href, '//') &&
        !str_contains($href, '\\') &&
        preg_match('#^/[A-Za-z0-9._~:/#?&=%+-]*$#', $href)
    ) {
        return true;
    }

    $parts = parse_url($href);

    if (!is_array($parts)) {
        return false;
    }

    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    $host = strtolower((string)($parts['host'] ?? ''));

    return in_array($scheme, ['http', 'https'], true)
        && in_array($host, houseHosts(), true);
}

function loadJsonFile(string $path): array {
    if (!is_file($path)) {
        return [];
    }

    $data = json_decode((string)file_get_contents($path), true);

    return is_array($data) ? $data : [];
}

function punchHref(string $id): string {
    $id = strtolower(trim($id));
    $id = preg_replace('/[^a-z0-9-]/', '', $id) ?? '';

    return $id === '' ? '/jack/tarot/' : JackTarotDeck::href($id);
}

function jackCatalog(): array {
    static $catalog = null;

    if (is_array($catalog)) {
        return $catalog;
    }

    $root = dirname(__DIR__);
    $hrefs = [];
    $tickets = [];
    $punches = [];

    $house = [
        ['label' => 'FFILM.org', 'href' => 'https://ffilm.org/', 'why' => 'parent house'],
        ['label' => 'Clwb Ffilm', 'href' => 'https://ffilm.org/clwb/', 'why' => 'film club'],
        ['label' => 'Draig Drŵg', 'href' => 'https://ffilm.org/', 'why' => 'CIC / production'],
        ['label' => 'Time Travellers Guild', 'href' => '/', 'why' => 'this archive'],
        ['label' => 'Faetime', 'href' => 'https://faetime.space/', 'why' => 'call culture'],
        ['label' => 'Zoneout', 'href' => 'https://zoneout.net/', 'why' => 'drift surface'],
        ['label' => 'Help', 'href' => 'https://tobygodden.com/help', 'why' => 'a person, not a page'],
    ];

    foreach ($house as $row) {
        $hrefs[] = $row;
    }

    $rooms = loadJsonFile($root . '/data/rooms.json');

    foreach (($rooms['rooms'] ?? []) as $room) {
        if (!is_array($room)) {
            continue;
        }

        $href = (string)($room['href'] ?? '');

        if (!hrefAllowed($href)) {
            continue;
        }

        $hrefs[] = [
            'label' => (string)($room['title'] ?? $room['slug'] ?? $href),
            'href' => $href,
            'why' => (string)($room['kicker'] ?? $room['slug'] ?? ''),
        ];
    }

    foreach (loadJsonFile($root . '/graph/nodes.json') as $node) {
        if (!is_array($node)) {
            continue;
        }

        $href = (string)($node['href'] ?? '');

        if (!hrefAllowed($href)) {
            continue;
        }

        $hrefs[] = [
            'label' => (string)($node['title'] ?? $node['slug'] ?? $href),
            'href' => $href,
            'why' => (string)($node['type'] ?? ''),
        ];
    }

    foreach (JackTarotDeck::all() as $card) {
        $punches[] = [
            'id' => (string)($card['id'] ?? ''),
            'title' => (string)($card['compiled'] ?? $card['catalog'] ?? ''),
            'href' => (string)($card['href'] ?? punchHref((string)($card['id'] ?? ''))),
            'why' => trim(
                (string)($card['catalog'] ?? '') .
                ' / ' .
                (string)($card['dept'] ?? '')
            ),
        ];
    }

    foreach ((loadJsonFile($root . '/lore/open_cases.json')['records'] ?? []) as $case) {
        if (!is_array($case) || ($case['status'] ?? 'open') === 'closed') {
            continue;
        }

        $tickets[] = [
            'id' => (string)($case['id'] ?? ''),
            'title' => (string)($case['title'] ?? ''),
            'href' => '/jack',
            'standing' => 'open',
            'why' => (string)($case['summary'] ?? $case['jack_note'] ?? ''),
        ];
    }

    foreach (loadJsonFile($root . '/graph/pending.json') as $node) {
        if (!is_array($node)) {
            continue;
        }

        $href = (string)($node['href'] ?? '/jack');

        $tickets[] = [
            'id' => (string)($node['public_id'] ?? $node['slug'] ?? ''),
            'title' => (string)($node['title'] ?? 'Pending leaf'),
            'href' => hrefAllowed($href) ? $href : '/jack',
            'standing' => 'pending',
            'why' => (string)($node['body'] ?? 'Not yet canon.'),
        ];
    }

    $catalog = [
        'hrefs' => $hrefs,
        'punches' => $punches,
        'tickets' => $tickets,
    ];

    return $catalog;
}

function catalogLookup(): array {
    static $map = null;

    if (is_array($map)) {
        return $map;
    }

    $map = [
        'href' => [],
        'punch' => [],
        'ticket' => [],
    ];

    $cat = jackCatalog();

    foreach ($cat['hrefs'] as $row) {
        $href = (string)($row['href'] ?? '');
        $label = strtolower(trim((string)($row['label'] ?? '')));

        if ($href !== '') {
            $map['href'][strtolower($href)] = $row;
        }

        if ($label !== '') {
            $map['href'][$label] = $row;
        }
    }

    foreach ($cat['punches'] as $row) {
        $id = strtolower((string)($row['id'] ?? ''));
        $title = strtolower((string)($row['title'] ?? ''));
        $why = strtolower((string)($row['why'] ?? ''));

        if ($id !== '') {
            $map['punch'][$id] = $row;
        }

        if ($title !== '') {
            $map['punch'][$title] = $row;
        }

        if ($why !== '') {
            $map['punch'][$why] = $row;
        }
    }

    foreach ($cat['tickets'] as $row) {
        $id = strtolower((string)($row['id'] ?? ''));
        $title = strtolower((string)($row['title'] ?? ''));

        if ($id !== '') {
            $map['ticket'][$id] = $row;
        }

        if ($title !== '') {
            $map['ticket'][$title] = $row;
        }
    }

    return $map;
}

function resolveCatalogHref(string $label, string $href = ''): ?array {
    $map = catalogLookup()['href'];
    $href = trim($href);
    $label = trim($label);

    if ($href !== '' && hrefAllowed($href)) {
        return [
            'label' => $label !== '' ? $label : $href,
            'href' => $href,
        ];
    }

    $key = strtolower($href !== '' ? $href : $label);

    if ($key !== '' && isset($map[$key])) {
        $hit = $map[$key];

        return [
            'label' => $label !== '' ? $label : (string)$hit['label'],
            'href' => (string)$hit['href'],
        ];
    }

    return null;
}

function resolvePunch(string $id, string $title = ''): ?array {
    $map = catalogLookup()['punch'];
    $id = trim($id);
    $title = trim($title);

    foreach ([$id, $title, strtolower($id), strtolower($title)] as $key) {
        $key = strtolower(trim((string)$key));

        if ($key !== '' && isset($map[$key])) {
            $hit = $map[$key];

            return [
                'id' => (string)$hit['id'],
                'title' => $title !== '' ? $title : (string)$hit['title'],
                'href' => (string)$hit['href'],
            ];
        }
    }

    if ($id !== '' || $title !== '') {
        $cardId = $id !== '' ? $id : $title;

        return [
            'id' => $cardId,
            'title' => $title !== '' ? $title : $cardId,
            'href' => punchHref($cardId),
        ];
    }

    return null;
}

function resolveTicket(string $id, string $title = ''): ?array {
    $map = catalogLookup()['ticket'];
    $id = trim($id);
    $title = trim($title);

    foreach ([$id, $title] as $key) {
        $key = strtolower(trim((string)$key));

        if ($key !== '' && isset($map[$key])) {
            $hit = $map[$key];

            return [
                'id' => (string)$hit['id'],
                'title' => $title !== '' ? $title : (string)$hit['title'],
                'href' => (string)$hit['href'],
                'standing' => (string)($hit['standing'] ?? 'provisional'),
            ];
        }
    }

    if ($id === '' && $title === '') {
        return null;
    }

    return [
        'id' => $id !== '' ? $id : $title,
        'title' => $title !== '' ? $title : $id,
        'href' => '/jack',
        'standing' => 'provisional',
    ];
}

function stringList(mixed $v): array {
    if (is_string($v)) {
        $v = preg_split('/[\n,]+/', $v) ?: [];
    }

    if (!is_array($v)) {
        return [];
    }

    $out = [];

    foreach ($v as $x) {
        if (!is_scalar($x)) {
            continue;
        }

        $s = trim((string)$x);

        if ($s !== '') {
            $out[] = $s;
        }
    }

    return array_values(array_unique($out));
}

function objectList(mixed $v, callable $resolve): array {
    if (!is_array($v)) {
        return [];
    }

    $out = [];
    $seen = [];

    foreach ($v as $row) {
        if (is_string($row)) {
            $row = ['label' => $row, 'title' => $row, 'id' => $row];
        }

        if (!is_array($row)) {
            continue;
        }

        $hit = $resolve($row);

        if (!is_array($hit)) {
            continue;
        }

        $key = strtolower(
            (string)($hit['href'] ?? '') .
            '|' .
            (string)($hit['id'] ?? '') .
            '|' .
            (string)($hit['label'] ?? $hit['title'] ?? '')
        );

        if ($key === '||' || isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;

        if (!empty($row['why'])) {
            $hit['why'] = substr(trim((string)$row['why']), 0, 240);
        }

        $out[] = $hit;
    }

    return $out;
}

function normalizeAnalysis(array $a): array {
    $hrefs = objectList($a['hrefs'] ?? [], static function (array $row): ?array {
        return resolveCatalogHref(
            (string)($row['label'] ?? $row['title'] ?? ''),
            (string)($row['href'] ?? '')
        );
    });

    $punches = objectList($a['punches'] ?? [], static function (array $row): ?array {
        $hit = resolvePunch(
            (string)($row['id'] ?? ''),
            (string)($row['title'] ?? $row['label'] ?? '')
        );

        return $hit;
    });

    $tickets = objectList($a['tickets'] ?? [], static function (array $row): ?array {
        $hit = resolveTicket(
            (string)($row['id'] ?? ''),
            (string)($row['title'] ?? $row['label'] ?? '')
        );

        if (!$hit) {
            return null;
        }

        $standing = strtolower((string)($row['standing'] ?? $hit['standing'] ?? 'provisional'));

        if (!in_array($standing, ['open', 'pending', 'provisional'], true)) {
            $standing = 'provisional';
        }

        $hit['standing'] = $standing;

        return $hit;
    });

    $luminance = (float)($a['luminance'] ?? 0.5);
    $energy = (float)($a['energy'] ?? 0.5);

    return [
        'caption' => trim((string)($a['caption'] ?? '')),
        'jack' => trim((string)($a['jack'] ?? '')),
        'visible_text' => stringList($a['visible_text'] ?? []),
        'objects' => stringList($a['objects'] ?? []),
        'themes' => stringList($a['themes'] ?? []),
        'threads' => stringList($a['threads'] ?? []),
        'colours' => stringList($a['colours'] ?? []),
        'places' => stringList($a['places'] ?? []),
        'dates' => stringList($a['dates'] ?? []),
        'links' => stringList($a['links'] ?? []),
        'hrefs' => $hrefs,
        'punches' => $punches,
        'tickets' => $tickets,
        'standing' => in_array(
            strtolower(trim((string)($a['standing'] ?? ''))),
            ['noise', 'held', 'relevant'],
            true
        ) ? strtolower(trim((string)$a['standing'])) : 'held',
        'luminance' => max(0, min(1, $luminance)),
        'energy' => max(0, min(1, $energy)),
    ];
}

function jackBriefing(): string {
    $cat = jackCatalog();
    $lines = [];

    $lines[] = 'HOUSE DIRECTIONS (cite only these hrefs, or a URL visibly printed in the plate):';

    foreach ($cat['hrefs'] as $row) {
        $lines[] = '- ' . $row['label'] . ' → ' . $row['href'];
    }

    $lines[] = '';
    $lines[] = 'OPEN TICKETS (link provisionally if the plate seems to corroborate):';

    foreach ($cat['tickets'] as $row) {
        $lines[] = '- [' . $row['standing'] . '] ' . $row['id'] . ' · ' . $row['title'] . ' → ' . $row['href'];
    }

    $lines[] = '';
    $lines[] = 'PUNCH CARDS (be generous; cite by id when a plate rhymes):';

    foreach ($cat['punches'] as $row) {
        $lines[] = '- ' . $row['id'] . ' · ' . $row['title'] . ' → ' . $row['href'];
    }

    return implode("\n", $lines);
}

function persistAnalysis(int $id, array $analysis, string $source): array {
    $analysis = normalizeAnalysis($analysis);
    $json = json_encode(
        $analysis,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

    $stmt = db()->prepare('SELECT * FROM images WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if (!$row) {
        throw new RuntimeException('PLATE NOT HELD');
    }

    $machine = (string)($row['analysis_machine_json'] ?? '');
    $now = gmdate('c');

    if ($source === 'machine' || $machine === '') {
        $machine = $json;
    }

    $revisedBy = $source === 'clerk' ? 'clerk' : ($row['revised_by'] ?? null);
    $revisedAt = $source === 'clerk' ? $now : ($row['revised_at'] ?? null);

    db()->prepare("
        UPDATE images
        SET
            analysed_at = COALESCE(analysed_at, ?),
            analysis_json = ?,
            analysis_machine_json = ?,
            revised_at = ?,
            revised_by = ?
        WHERE id = ?
    ")->execute([
        $now,
        $json,
        $machine,
        $revisedAt,
        $revisedBy,
        $id,
    ]);

    db()->prepare("
        INSERT INTO revisions (
            image_id,
            source,
            analysis_json,
            created_at
        )
        VALUES (?, ?, ?, ?)
    ")->execute([
        $id,
        $source,
        $json,
        $now,
    ]);

    return $analysis;
}

function words(array $analysis): array {

    $things = [];

    foreach (
        [
            'objects',
            'themes',
            'threads',
            'places',
            'dates',
            'colours',
            'links'
        ] as $key
    ) {

        $v = $analysis[$key] ?? [];

        if (is_string($v)) {
            $v = [$v];
        }

        if (!is_array($v)) {
            continue;
        }

        foreach ($v as $x) {

            if (is_scalar($x)) {
                $s = strtolower(trim((string)$x));

                if ($s !== '') {
                    $things[] = $s;
                }
            }
        }
    }

    foreach (['hrefs', 'punches', 'tickets'] as $key) {
        foreach (($analysis[$key] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }

            foreach (['label', 'title', 'id'] as $field) {
                $s = strtolower(trim((string)($row[$field] ?? '')));

                if ($s !== '') {
                    $things[] = $s;
                }
            }
        }
    }

    return array_values(array_unique($things));
}

function similarity(array $a, array $b): float {

    $wa = words($a);
    $wb = words($b);

    if (!$wa || !$wb) {
        return 0.0;
    }

    $intersection = array_intersect($wa, $wb);
    $union = array_unique(array_merge($wa, $wb));

    return count($union)
        ? count($intersection) / count($union)
        : 0.0;
}


/* ============================================================
   OPENAI IMAGE ANALYSIS
   ============================================================ */

function analyseImage(array $image): array {

    $key = trim(ttg_env('OPENAI_API_KEY'));

    if ($key === '' || str_contains($key, 'YOUR_KEY')) {
        throw new RuntimeException(
            'OPENAI KEY NOT CONFIGURED'
        );
    }

    $path = IMAGE_DIR . '/' . $image['filename'];

    if (!is_file($path)) {
        throw new RuntimeException('IMAGE MISSING');
    }

    $mime = allowedMime($path);

    if (!$mime) {
        throw new RuntimeException('UNSUPPORTED IMAGE');
    }

    $dataUrl =
        'data:' .
        $mime .
        ';base64,' .
        base64_encode(file_get_contents($path));

    $briefing = jackBriefing();

    $instructions = <<<PROMPT
You are JACK. Private detective of the Time Travellers Guild.
Archival clerk. Machine intelligence. You do not write canon.

A plate has entered FEED∞. Your job is to solve the narrative
puzzle it belongs to: what is this, where does it sit in the
ffilm.org house, which punch cards it rhymes with, and whether
it corroborates an open ticket.

You are generous with cross-reference and modest with certainty.
Provisional links are allowed. Invented URLs are not.

Do not identify unknown real people.
Do not infer race, health, sexuality, religion, politics,
criminality or other sensitive personal attributes.
Observe only what is visually supported, then file it against
the house catalogue below.

Return ONLY a compact JSON object with exactly these fields:

{
  "caption": "literal short description",
  "jack": "detective note: what this plate is doing in the story, terse, no hype",
  "visible_text": ["important visible text"],
  "objects": ["object"],
  "themes": ["theme"],
  "threads": ["semantic wormhole"],
  "colours": ["dominant colour"],
  "places": ["only visibly explicit or strongly evidenced place"],
  "dates": ["only visible date/time clues"],
  "links": ["2-6 archive concepts"],
  "hrefs": [{"label":"door name","href":"/path-or-https-house-url","why":"why this plate opens that door"}],
  "punches": [{"id":"major-13","title":"STATION 13","why":"how the plate rhymes with this slip"}],
  "tickets": [{"id":"case.gillett-milk-float","title":"Open case title","standing":"provisional","why":"what in the plate corroborates the ticket"}],
  "standing": "held",
  "luminance": 0.5,
  "energy": 0.5
}

luminance and energy are numbers from 0 to 1.

hrefs: 1-6 directions inside the ffilm.org universe. Use ONLY
hrefs from the catalogue, or a URL actually printed on the plate
if it belongs to the house (ffilm.org, timetravellersguild.com,
faetime.space, zoneout.net, tobygodden.com, chronometer.online).
Be generous: a station plate opens Station XIII; a valley hill
opens Abercrave / Cribarth; a cube opens Jack.

punches: 2-8 punch cards. Prefer catalogue ids. Generous rhyme
is correct. Do not force every plate onto The Fool.

tickets: 0-3 open tickets. If the plate seems to corroborate a
case or pending leaf, link it with standing "provisional".
Do not upgrade a ticket to proven.

standing: one of noise, held, relevant.
relevant = graduate this plate onto the tree. Use it when the
plate belongs to the narrative puzzle: it corroborates a ticket,
opens a house door with evidence, or is clearly a leaf of the
Ffilm. Most plates stay held. noise is stray material.
A relevant plate becomes viewable through the tree’s lens.

THREADS: useful categories (threshold, costume, machine, family,
archive, guardian, advertising, body-as-interface, public-space).

JACK speaks like a very old filing machine that learned
detection by accident. Curious. Precise. No mystical certainty.

HOUSE CATALOGUE
{$briefing}
PROMPT;

    $payload = [
        'model' => ttg_openai_model(),
        'input' => [
            [
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'input_text',
                        'text' => $instructions
                    ],
                    [
                        'type' => 'input_image',
                        'image_url' => $dataUrl
                    ]
                ]
            ]
        ]
    ];

    $ch = curl_init(
        'https://api.openai.com/v1/responses'
    );

    curl_setopt_array(
        $ch,
        [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $key,
                'Content-Type: application/json'
            ],
            CURLOPT_POSTFIELDS => json_encode(
                $payload,
                JSON_UNESCAPED_SLASHES
            ),
            CURLOPT_TIMEOUT => 90
        ]
    );

    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($raw === false) {
        throw new RuntimeException(
            'AI NETWORK ERROR: ' . curl_error($ch)
        );
    }

    curl_close($ch);

    $response = json_decode($raw, true);

    if (
        $code < 200 ||
        $code >= 300
    ) {
        throw new RuntimeException(
            'AI ERROR ' .
            $code .
            ': ' .
            substr(
                (string)(
                    $response['error']['message'] ??
                    $raw
                ),
                0,
                500
            )
        );
    }

    /*
     * Responses API may expose output_text directly
     * or as text content within output[].
     */
    $text = trim(
        (string)(
            $response['output_text'] ?? ''
        )
    );

    if (!$text && !empty($response['output'])) {

        foreach ($response['output'] as $output) {

            foreach (($output['content'] ?? []) as $part) {

                if (
                    isset($part['text']) &&
                    is_string($part['text'])
                ) {
                    $text .= $part['text'];
                }
            }
        }

        $text = trim($text);
    }

    /*
     * Strip accidental markdown fencing.
     */
    $text = preg_replace(
        '/^```(?:json)?\s*|\s*```$/i',
        '',
        $text
    );

    $analysis = json_decode($text, true);

    if (!is_array($analysis)) {

        /*
         * Rescue first JSON object if prose slipped in.
         */
        if (
            preg_match(
                '/\{.*\}/s',
                $text,
                $m
            )
        ) {
            $analysis = json_decode(
                $m[0],
                true
            );
        }
    }

    if (!is_array($analysis)) {
        throw new RuntimeException(
            'MACHINE RETURNED UNREADABLE CARD'
        );
    }

    return $analysis;
}


/* ============================================================
   IMAGE UPLOAD
   ============================================================ */

if (
    isset($_POST['upload']) &&
    isAdmin()
) {

    requireCsrf();

    $files = $_FILES['images'] ?? null;

    if ($files) {

        $names = is_array($files['name'])
            ? $files['name']
            : [$files['name']];

        $tmps = is_array($files['tmp_name'])
            ? $files['tmp_name']
            : [$files['tmp_name']];

        $errors = is_array($files['error'])
            ? $files['error']
            : [$files['error']];

        $sizes = is_array($files['size'])
            ? $files['size']
            : [$files['size']];

        foreach ($names as $i => $name) {

            if (
                ($errors[$i] ?? UPLOAD_ERR_NO_FILE)
                !== UPLOAD_ERR_OK
            ) {
                continue;
            }

            if (
                ($sizes[$i] ?? 0) >
                MAX_UPLOAD_BYTES
            ) {
                continue;
            }

            $tmp = $tmps[$i];

            if (!allowedMime((string)$tmp)) {
                continue;
            }

            try {
                ingestToJpeg((string)$tmp, (string)$name);
            } catch (Throwable $e) {
                continue;
            }
        }
    }

    header('Location: ?admin');
    exit;
}


/* ============================================================
   INGEST ONE PLATE
   ============================================================ */

if (
    isset($_GET['api']) &&
    $_GET['api'] === 'ingest' &&
    isAdmin()
) {

    requireCsrf();

    $file = $_FILES['image'] ?? null;

    if (
        !is_array($file) ||
        ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
    ) {
        jsonResponse(
            ['ok' => false, 'error' => 'NO PLATE RECEIVED'],
            400
        );
    }

    if (($file['size'] ?? 0) > MAX_UPLOAD_BYTES) {
        jsonResponse(
            ['ok' => false, 'error' => 'PLATE TOO LARGE'],
            413
        );
    }

    try {
        jsonResponse(
            ingestToJpeg(
                (string)$file['tmp_name'],
                (string)($file['name'] ?? 'plate')
            )
        );
    } catch (Throwable $e) {
        jsonResponse(
            [
                'ok' => false,
                'error' => $e->getMessage(),
            ],
            500
        );
    }
}


/* ============================================================
   ANALYSE ONE / ALL
   ============================================================ */

if (
    isset($_GET['api']) &&
    $_GET['api'] === 'analyse' &&
    isAdmin()
) {

    requireCsrf();

    $id = (int)($_POST['id'] ?? 0);

    $stmt = db()->prepare("
        SELECT *
        FROM images
        WHERE id = ?
    ");

    $stmt->execute([$id]);

    $image = $stmt->fetch();

    if (!$image) {
        jsonResponse(
            ['ok' => false, 'error' => 'not found'],
            404
        );
    }

    try {

        $analysis = persistAnalysis(
            $id,
            analyseImage($image),
            'machine'
        );

        jsonResponse([
            'ok' => true,
            'analysis' => $analysis
        ]);

    } catch (Throwable $e) {

        jsonResponse(
            [
                'ok' => false,
                'error' => $e->getMessage()
            ],
            500
        );
    }
}


/* ============================================================
   CLERK DOSSIER
   ============================================================ */

if (
    isset($_GET['api']) &&
    $_GET['api'] === 'plate' &&
    isAdmin()
) {

    $id = (int)($_GET['id'] ?? 0);

    $stmt = db()->prepare("
        SELECT *
        FROM images
        WHERE id = ?
    ");
    $stmt->execute([$id]);
    $image = $stmt->fetch();

    if (!$image) {
        jsonResponse(['ok' => false, 'error' => 'not found'], 404);
    }

    $revs = db()->prepare("
        SELECT id, source, created_at
        FROM revisions
        WHERE image_id = ?
        ORDER BY id DESC
        LIMIT 12
    ");
    $revs->execute([$id]);

    jsonResponse([
        'ok' => true,
        'id' => (int)$image['id'],
        'filename' => (string)$image['filename'],
        'src' => 'images/' . rawurlencode((string)$image['filename']),
        'sha256' => (string)$image['sha256'],
        'width' => (int)$image['width'],
        'height' => (int)$image['height'],
        'bytes' => (int)$image['bytes'],
        'mime' => (string)($image['mime'] ?? ''),
        'original_name' => (string)($image['original_name'] ?? ''),
        'created_at' => (string)$image['created_at'],
        'analysed_at' => (string)($image['analysed_at'] ?? ''),
        'revised_at' => (string)($image['revised_at'] ?? ''),
        'revised_by' => (string)($image['revised_by'] ?? ''),
        'analysis' => decodeAnalysis($image['analysis_json'] ?? null),
        'machine' => decodeAnalysis($image['analysis_machine_json'] ?? null),
        'revisions' => $revs->fetchAll(),
    ]);
}

if (
    isset($_GET['api']) &&
    $_GET['api'] === 'revise' &&
    isAdmin()
) {

    requireCsrf();

    $id = (int)($_POST['id'] ?? 0);

    $stmt = db()->prepare("
        SELECT id
        FROM images
        WHERE id = ?
    ");
    $stmt->execute([$id]);

    if (!$stmt->fetch()) {
        jsonResponse(['ok' => false, 'error' => 'not found'], 404);
    }

    $raw = $_POST['analysis'] ?? null;
    $analysis = is_string($raw) ? json_decode($raw, true) : $raw;

    if (!is_array($analysis)) {
        jsonResponse(['ok' => false, 'error' => 'UNREADABLE CARD'], 400);
    }

    jsonResponse([
        'ok' => true,
        'analysis' => persistAnalysis($id, $analysis, 'clerk'),
    ]);
}


/* ============================================================
   TELEMETRY
   ============================================================ */

function fiveMinuteBucket(): string {

    $t = time();

    $bucket = (int)(
        floor($t / 300) * 300
    );

    return gmdate(
        'Y-m-d\TH:i:00\Z',
        $bucket
    );
}

function clampFloat(
    mixed $value,
    float $min,
    float $max
): float {

    return max(
        $min,
        min(
            $max,
            (float)$value
        )
    );
}

if (
    isset($_GET['api']) &&
    $_GET['api'] === 'event'
) {

    $raw = file_get_contents('php://input');
    $j   = json_decode($raw, true);

    if (!is_array($j)) {
        jsonResponse(['ok' => false], 400);
    }

    $imageId = (int)($j['image_id'] ?? 0);

    $session = preg_replace(
        '/[^a-zA-Z0-9_-]/',
        '',
        substr(
            (string)($j['session_id'] ?? ''),
            0,
            80
        )
    );

    if (!$session) {
        $session = 'anonymous';
    }

    $allowedTypes = [
        'enter',
        'leave',
        'annotation',
        'thread',
        'touch'
    ];

    $type = (string)(
        $j['type'] ?? 'leave'
    );

    if (
        !in_array(
            $type,
            $allowedTypes,
            true
        )
    ) {
        $type = 'leave';
    }

    $visibleMs = max(
        0,
        min(
            120000,
            (int)($j['visible_ms'] ?? 0)
        )
    );

    $revisited = !empty(
        $j['revisited']
    ) ? 1 : 0;

    $stmt = db()->prepare("
        INSERT INTO events (
            image_id,
            session_id,
            type,
            time_bucket,

            visible_ms,
            visibility,

            scroll_velocity,
            scroll_acceleration,

            direction,
            direction_changes,

            touch_duration,
            pressure,

            touch_x,
            touch_y,

            tilt_beta,
            tilt_gamma,

            motion_energy,

            revisited,
            annotation,
            thread
        )
        VALUES (
            ?,?,?,?,
            ?,?,
            ?,?,
            ?,?,
            ?,?,
            ?,?,
            ?,?,
            ?,
            ?,?,?
        )
    ");

    $stmt->execute([
        $imageId,
        $session,
        $type,
        fiveMinuteBucket(),

        $visibleMs,
        clampFloat(
            $j['visibility'] ?? 0,
            0,
            1
        ),

        clampFloat(
            $j['scroll_velocity'] ?? 0,
            -20000,
            20000
        ),

        clampFloat(
            $j['scroll_acceleration'] ?? 0,
            -50000,
            50000
        ),

        max(
            -1,
            min(
                1,
                (int)($j['direction'] ?? 0)
            )
        ),

        max(
            0,
            min(
                100,
                (int)(
                    $j['direction_changes'] ?? 0
                )
            )
        ),

        max(
            0,
            min(
                30000,
                (int)(
                    $j['touch_duration'] ?? 0
                )
            )
        ),

        clampFloat(
            $j['pressure'] ?? 0,
            0,
            1
        ),

        clampFloat(
            $j['touch_x'] ?? 0,
            0,
            1
        ),

        clampFloat(
            $j['touch_y'] ?? 0,
            0,
            1
        ),

        clampFloat(
            $j['tilt_beta'] ?? 0,
            -180,
            180
        ),

        clampFloat(
            $j['tilt_gamma'] ?? 0,
            -90,
            90
        ),

        clampFloat(
            $j['motion_energy'] ?? 0,
            0,
            20
        ),

        $revisited,

        substr(
            (string)(
                $j['annotation'] ?? ''
            ),
            0,
            120
        ),

        substr(
            (string)(
                $j['thread'] ?? ''
            ),
            0,
            120
        )
    ]);

    /*
     * Convert raw encounter into anonymous residue.
     *
     * Long dwell increases field strength,
     * recurrence increases it,
     * rapid skipping barely does.
     */
    if (
        $type === 'leave' &&
        $imageId > 0
    ) {

        $seconds = $visibleMs / 1000;

        $dwellSignal = min(
            1,
            log(1 + $seconds) / log(16)
        );

        $hesitation =
            min(
                1,
                (
                    (int)(
                        $j['direction_changes'] ?? 0
                    )
                ) / 6
            );

        $residueIncrement =
            ($dwellSignal * 0.65) +
            ($hesitation * 0.15) +
            ($revisited * 0.20);

        $update = db()->prepare("
            UPDATE images
            SET
                seen_count = seen_count + 1,
                dwell_total = dwell_total + ?,
                revisit_count =
                    revisit_count + ?,

                residue =
                    (residue * 0.985) + ?,

                last_seen_at = ?
            WHERE id = ?
        ");

        $update->execute([
            $seconds,
            $revisited,
            $residueIncrement,
            gmdate('c'),
            $imageId
        ]);
    }

    /*
     * Opportunistic transient retention.
     * Aggregate residue survives.
     * Raw hand movement does not live forever.
     */
    if (random_int(1, 100) === 1) {

        $cutoff = gmdate(
            'Y-m-d\TH:i:00\Z',
            time() -
            (
                RAW_EVENT_DAYS *
                86400
            )
        );

        db()->prepare("
            DELETE FROM events
            WHERE time_bucket < ?
        ")->execute([$cutoff]);
    }

    jsonResponse(['ok' => true]);
}


/* ============================================================
   FEED SELECTOR
   ============================================================ */

function imagePublic(array $row): array {

    $analysis = decodeAnalysis(
        $row['analysis_json'] ?? null
    );

    return [
        'id'       => (int)$row['id'],
        'src'      =>
            'images/' .
            rawurlencode($row['filename']),

        'width'    => (int)$row['width'],
        'height'   => (int)$row['height'],

        'residue'  =>
            round(
                (float)$row['residue'],
                4
            ),

        'seen'     =>
            (int)$row['seen_count'],

        'analysis' => $analysis
    ];
}

function shuffleRows(array $rows): array {
    $n = count($rows);

    for ($i = $n - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$rows[$i], $rows[$j]] = [$rows[$j], $rows[$i]];
    }

    return $rows;
}

function rowMatchesThread(array $row, ?string $thread): bool {
    if (!$thread) {
        return true;
    }

    $needle = strtolower($thread);

    foreach (words(decodeAnalysis($row['analysis_json'] ?? null)) as $word) {
        if (str_contains($word, $needle) || str_contains($needle, $word)) {
            return true;
        }
    }

    return false;
}

function selectFeed(
    int $currentId,
    array $exclude,
    ?string $thread,
    int $limit
): array {

    $rows = db()->query("
        SELECT *
        FROM images
        ORDER BY id DESC
        LIMIT 600
    ")->fetchAll();

    if (!$rows) {
        return [];
    }

    $pool = [];

    foreach ($rows as $r) {
        if (rowMatchesThread($r, $thread)) {
            $pool[] = $r;
        }
    }

    /*
     * A thread with no matches returns to the open field
     * rather than dead-ending the ribbon.
     */
    if (!$pool) {
        $pool = $rows;
    }

    $excludeMap = array_fill_keys(
        array_map('intval', $exclude),
        true
    );

    $unseen = [];

    foreach ($pool as $r) {
        $id = (int)$r['id'];

        if (isset($excludeMap[$id]) || $id === $currentId) {
            continue;
        }

        $unseen[] = $r;
    }

    $result = [];
    $used = [];

    if ($currentId > 0) {
        $used[$currentId] = true;
    }

    foreach (shuffleRows($unseen) as $r) {
        if (count($result) >= $limit) {
            break;
        }

        $id = (int)$r['id'];
        $result[] = imagePublic($r);
        $used[$id] = true;
    }

    /*
     * Cycle complete: reshuffle the corpus.
     * Do not lead with the plate still on screen.
     */
    if (count($result) < $limit) {
        $rest = [];

        foreach (shuffleRows($pool) as $r) {
            $id = (int)$r['id'];

            if (isset($used[$id])) {
                continue;
            }

            $rest[] = $r;
        }

        foreach ($rest as $r) {
            if (count($result) >= $limit) {
                break;
            }

            $result[] = imagePublic($r);
            $used[(int)$r['id']] = true;
        }
    }

    /*
     * Single-plate archive: repeat is the only motion left.
     */
    if (!$result && $pool) {
        $result[] = imagePublic(shuffleRows($pool)[0]);
    }

    return $result;
}


/* ============================================================
   FEED API
   ============================================================ */

if (
    isset($_GET['api']) &&
    $_GET['api'] === 'feed'
) {

    $currentId =
        (int)(
            $_GET['current'] ?? 0
        );

    $thread = trim(
        (string)(
            $_GET['thread'] ?? ''
        )
    );

    $excludeRaw =
        (string)(
            $_GET['exclude'] ?? ''
        );

    $exclude = array_filter(
        array_map(
            'intval',
            explode(
                ',',
                $excludeRaw
            )
        )
    );

    $items = selectFeed(
        $currentId,
        $exclude,
        $thread ?: null,
        FEED_BATCH
    );

    /*
     * Empty corpus fallback.
     */
    jsonResponse([
        'ok'     => true,
        'items'  => $items,
        'thread' => $thread ?: null
    ]);
}


/* ============================================================
   STATS
   ============================================================ */

function stats(): array {

    $pdo = db();

    return [
        'images' =>
            (int)$pdo
                ->query(
                    "SELECT COUNT(*) FROM images"
                )
                ->fetchColumn(),

        'analysed' =>
            (int)$pdo
                ->query(
                    "SELECT COUNT(*) FROM images
                     WHERE analysed_at IS NOT NULL"
                )
                ->fetchColumn(),

        'events' =>
            (int)$pdo
                ->query(
                    "SELECT COUNT(*) FROM events"
                )
                ->fetchColumn(),

        'sessions' =>
            (int)$pdo
                ->query(
                    "SELECT COUNT(
                        DISTINCT session_id
                     ) FROM events"
                )
                ->fetchColumn()
    ];
}

/**
 * Anonymous house residue. No session ids, no coordinates.
 */
function telemetryHouse(): array {

    $s = stats();
    $pdo = db();

    $last = (string) $pdo
        ->query(
            "SELECT time_bucket
             FROM events
             ORDER BY id DESC
             LIMIT 1"
        )
        ->fetchColumn();

    $hourCut = gmdate(
        'Y-m-d\TH:i:00\Z',
        time() - 3600
    );

    $hourStmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM events
         WHERE time_bucket >= ?"
    );
    $hourStmt->execute([$hourCut]);

    $types = [];
    foreach (
        $pdo->query(
            "SELECT type, COUNT(*) AS c
             FROM events
             GROUP BY type"
        ) as $row
    ) {
        $types[(string) $row['type']] = (int) $row['c'];
    }

    return [
        'ok' => true,
        'canon' => false,
        'plates' => $s['images'],
        'analysed' => $s['analysed'],
        'events' => $s['events'],
        'sessions' => $s['sessions'],
        'seen' => (int) $pdo
            ->query(
                "SELECT COALESCE(SUM(seen_count),0)
                 FROM images"
            )
            ->fetchColumn(),
        'dwell_s' => round(
            (float) $pdo
                ->query(
                    "SELECT COALESCE(SUM(dwell_total),0)
                     FROM images"
                )
                ->fetchColumn(),
            1
        ),
        'residue' => round(
            (float) $pdo
                ->query(
                    "SELECT COALESCE(SUM(residue),0)
                     FROM images"
                )
                ->fetchColumn(),
            2
        ),
        'motion_avg' => round(
            (float) $pdo
                ->query(
                    "SELECT COALESCE(AVG(motion_energy),0)
                     FROM events"
                )
                ->fetchColumn(),
            3
        ),
        'hour' => (int) $hourStmt->fetchColumn(),
        'last_bucket' => $last,
        'types' => $types,
        'window_days' => RAW_EVENT_DAYS,
    ];
}

if (
    isset($_GET['api']) &&
    $_GET['api'] === 'telemetry'
) {
    jsonResponse(telemetryHouse());
}


/* ============================================================
   INSTALL / ADMIN HTML
   ============================================================ */

if (
    isset($_GET['admin']) ||
    !installed()
) {

    $stats = stats();
    $machineReady = ttg_openai_configured();

?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>
<title>FEED∞ / CLERK</title>

<style>
*{box-sizing:border-box}

:root{
    --bg:#080808;
    --ink:#e7eadf;
    --muted:#777b73;
    --line:#292c29;
    --field:#a9ff9c;
    --moss:#7fbf72;
    --chlorophyll:#c6ff8c;
    --brass:#c9a961;
    --sap:#2a3320;
    --soil:#10140c;
}

html,body{
    margin:0;
    background:var(--bg);
    color:var(--ink);
    font-family:
        "Courier New",
        ui-monospace,
        monospace;
}

main{
    width:min(1050px,calc(100% - 32px));
    margin:0 auto;
    padding:38px 0 100px;
}

header{
    border-bottom:1px solid var(--line);
    padding-bottom:22px;
    margin-bottom:30px;
    display:flex;
    justify-content:space-between;
    align-items:end;
    gap:20px;
}

h1{
    margin:0;
    font-size:32px;
    letter-spacing:-.06em;
}

.sub{
    color:var(--muted);
    margin-top:6px;
    font-size:12px;
}

.status{
    color:var(--field);
    font-size:12px;
}

.card{
    border:1px solid var(--line);
    padding:20px;
    margin:18px 0;
}

label{
    display:block;
    color:var(--muted);
    font-size:11px;
    text-transform:uppercase;
    letter-spacing:.1em;
    margin:15px 0 7px;
}

input,
button{
    font:inherit;
}

input[type=password],
input[type=text]{
    width:100%;
    background:#111;
    border:1px solid #393c38;
    color:var(--ink);
    padding:13px;
}

button,
.button{
    display:inline-block;
    border:1px solid #50544e;
    background:#111;
    color:var(--ink);
    padding:11px 14px;
    margin-top:12px;
    cursor:pointer;
    text-decoration:none;
}

button:hover,
.button:hover{
    border-color:var(--field);
}

.stats{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    border-top:1px solid var(--line);
    border-left:1px solid var(--line);
    margin:20px 0;
}

.stat{
    padding:18px;
    border-right:1px solid var(--line);
    border-bottom:1px solid var(--line);
}

.stat strong{
    display:block;
    font-size:28px;
}

.stat span{
    color:var(--muted);
    font-size:10px;
}

.grid{
    display:grid;
    grid-template-columns:
        repeat(
            auto-fill,
            minmax(150px,1fr)
        );
    gap:9px;
}

.asset{
    border:1px solid var(--line);
    background:#0d0d0d;
    position:relative;
}

.asset img{
    width:100%;
    aspect-ratio:1/1;
    object-fit:cover;
    display:block;
}

.asset footer{
    padding:8px;
    font-size:10px;
    color:var(--muted);
}

.asset .ai{
    color:var(--field);
}

.asset{
    cursor:pointer;
}

.asset:hover{
    border-color:var(--brass);
}

.dossier{
    display:none;
    border:1px solid var(--line);
    padding:20px;
    margin:18px 0;
    background:#0b0c0a;
}

.dossier.open{
    display:block;
}

.dossier-head{
    display:flex;
    justify-content:space-between;
    gap:16px;
    align-items:end;
    margin-bottom:16px;
}

.dossier-meta{
    color:var(--muted);
    font-size:11px;
    line-height:1.7;
    word-break:break-all;
}

.dossier-grid{
    display:grid;
    grid-template-columns:minmax(160px,220px) 1fr;
    gap:18px;
}

.dossier-grid img{
    width:100%;
    display:block;
    border:1px solid var(--line);
}

.dossier textarea,
.dossier select,
.dossier input[type=text]{
    width:100%;
    background:#111;
    border:1px solid #393c38;
    color:var(--ink);
    padding:10px;
    font:inherit;
}

.dossier textarea{
    min-height:4.8em;
    resize:vertical;
}

.dossier .tall{
    min-height:8em;
}

.dossier-actions{
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    margin-top:8px;
}

@media(max-width:700px){
    .dossier-grid{
        grid-template-columns:1fr;
    }
}

.error{
    color:#ff8585;
}

.drop{
    display:block;
    position:relative;
    margin-top:12px;
    padding:22px 16px;
    border:1px dashed #4a5338;
    background:
        repeating-linear-gradient(
            90deg,
            transparent,
            transparent 11px,
            rgba(201,169,97,.08) 11px,
            rgba(201,169,97,.08) 12px
        ),
        var(--soil);
    color:var(--muted);
    text-align:center;
    cursor:pointer;
}

.drop:hover,
.drop:focus-within{
    border-color:var(--brass);
    color:var(--chlorophyll);
}

.drop input{
    position:absolute;
    width:1px;
    height:1px;
    opacity:0;
}

.drop b{
    display:block;
    color:var(--brass);
    letter-spacing:.14em;
    font-size:11px;
}

.mill{
    display:none;
    margin-top:18px;
}

.mill.on{
    display:block;
}

.mill-head{
    display:flex;
    justify-content:space-between;
    align-items:baseline;
    gap:12px;
    margin-bottom:8px;
    font-size:10px;
    letter-spacing:.12em;
    text-transform:uppercase;
    color:var(--brass);
}

.mill-rail{
    position:relative;
    height:14px;
    border:1px solid #4a5338;
    background:
        repeating-linear-gradient(
            90deg,
            var(--sap),
            var(--sap) 6px,
            #1a2014 6px,
            #1a2014 8px
        );
    overflow:hidden;
}

.mill-fill{
    display:block;
    height:100%;
    width:0;
    background:
        linear-gradient(
            90deg,
            #3f6a32,
            var(--moss) 55%,
            var(--chlorophyll)
        );
    box-shadow:0 0 18px rgba(169,255,156,.28);
    transition:width .28s ease;
}

.mill-rail:after{
    content:"";
    position:absolute;
    inset:0;
    background:
        repeating-linear-gradient(
            90deg,
            transparent,
            transparent 14px,
            rgba(8,8,8,.35) 14px,
            rgba(8,8,8,.35) 16px
        );
    pointer-events:none;
}

.mill-now{
    margin-top:10px;
    min-height:2.4em;
    color:var(--chlorophyll);
    font-size:12px;
    line-height:1.45;
}

.mill-now:before{
    content:".;. ";
    color:var(--field);
}

.mill-log{
    list-style:none;
    margin:12px 0 0;
    padding:10px 0 0;
    border-top:1px solid var(--line);
    max-height:160px;
    overflow:auto;
    color:var(--muted);
    font-size:10px;
    line-height:1.7;
}

.mill-log li.done{
    color:var(--ink);
}

.mill-log li.fail{
    color:#ff8585;
}

button[disabled]{
    opacity:.45;
    cursor:wait;
}

@media(max-width:650px){
    .stats{
        grid-template-columns:1fr 1fr;
    }
}
</style>
</head>

<body>
<main>

<header>
<div>
<h1>FEED∞ / CLERK</h1>
<div class="sub">
TIME TRAVELLERS GUILD /
FIELD ADMINISTRATION
</div>
</div>

<div class="status">
.;. JACK
</div>
</header>

<?php if (!installed()): ?>

<div class="card">
<h2>INITIALISE INSTRUMENT</h2>

<p>
The first password becomes the local
prototype administrator.
Machine vision uses the Guild
<code>OPENAI_API_KEY</code>.
</p>

<?php if (!empty($installError)): ?>
<p class="error"><?=h($installError)?></p>
<?php endif; ?>

<form method="post">

<label>
ADMINISTRATOR PASS
</label>

<input
    type="password"
    name="password"
    autocomplete="new-password"
    required
>

<label>
CONFIRM
</label>

<input
    type="password"
    name="confirm"
    autocomplete="new-password"
    required
>

<button
    type="submit"
    name="install"
    value="1"
>
INITIALISE FEED∞
</button>

</form>
</div>

<?php elseif (!isAdmin()): ?>

<div class="card">
<h2>CLERK ACCESS</h2>

<?php if (!empty($loginError)): ?>
<p class="error"><?=h($loginError)?></p>
<?php endif; ?>

<form method="post">

<input
    type="password"
    name="password"
    autofocus
    placeholder="PASS"
>

<button
    type="submit"
    name="login"
    value="1"
>
ENTER
</button>

</form>
</div>

<?php else: ?>

<div class="stats">
<div class="stat">
<strong><?=$stats['images']?></strong>
<span>OBJECTS</span>
</div>

<div class="stat">
<strong><?=$stats['analysed']?></strong>
<span>THREADED</span>
</div>

<div class="stat">
<strong><?=$stats['sessions']?></strong>
<span>FIELD VISITS</span>
</div>

<div class="stat">
<strong><?=$stats['events']?></strong>
<span>RAW EVENTS / TRANSIENT</span>
</div>
</div>

<div class="card">

<h2>FEED THE FEED</h2>

<p class="sub">
The mill receives each plate, contains it
to <?=INGEST_MAX_EDGE?>px on the long edge,
and writes a JPEG (Q<?=INGEST_JPEG_Q?>)
before it enters the field.
</p>

<form
    id="ingestForm"
    method="post"
    enctype="multipart/form-data"
    data-csrf="<?=h(csrf())?>"
>

<input
    type="hidden"
    name="csrf"
    value="<?=h(csrf())?>"
>

<label class="drop" id="ingestDrop">
<input
    id="ingestFiles"
    type="file"
    name="images[]"
    accept="image/jpeg,image/png,image/webp,image/gif"
    multiple
>
<b>DROP PLATES / CHOOSE FILES</b>
<span id="ingestPick">nothing selected</span>
</label>

<button
    type="submit"
    name="upload"
    value="1"
    id="ingestGo"
>
RELEASE MATERIAL
</button>

</form>

<div class="mill" id="ingestMill">
<div class="mill-head">
<span>CHLOROPHYLL RAIL</span>
<span id="ingestCount">0 / 0</span>
</div>
<div
    class="mill-rail"
    id="ingestRail"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow="0"
    aria-label="Ingest progress"
>
<i class="mill-fill" id="ingestFill"></i>
</div>
<div class="mill-now" id="ingestNow">WAITING FOR MATERIAL</div>
<ol class="mill-log" id="ingestLog"></ol>
</div>

<p class="sub">
Files placed directly in /images/
are also discovered automatically.
They are not remilled.
</p>

</div>

<div class="card">

<h2>MACHINE VISION</h2>

<p class="status">
<?= $machineReady ? 'CONFIGURED' : 'ABSENT' ?>
</p>

<p class="sub">
Jack reads as a private detective: house
directions, punch cards, open tickets.
A guild person may overwrite every field.
The plate file stays in /images/; the row
in SQLite holds hash, measure, mill name,
and the working card.
</p>

<button
    id="analyseAll"
    data-csrf="<?=h(csrf())?>"
    <?= $machineReady ? '' : 'disabled' ?>
>
ANALYSE ALL UNTHREADED
</button>

<button
    id="refileAll"
    data-csrf="<?=h(csrf())?>"
    <?= $machineReady ? '' : 'disabled' ?>
>
RE-FILE ALL
</button>

<span id="machineStatus"></span>

</div>

<?php

$images = db()
    ->query("
        SELECT *
        FROM images
        ORDER BY id DESC
        LIMIT 200
    ")
    ->fetchAll();

?>

<div class="grid" id="assetGrid">

<?php foreach ($images as $img): ?>

<div
    class="asset"
    data-id="<?=(int)$img['id']?>"
    data-analysed="<?=$img['analysed_at'] ? '1':'0'?>"
>

<img
    src="images/<?=h(
        rawurlencode(
            $img['filename']
        )
    )?>"
    loading="lazy"
>

<footer>
#<?=str_pad(
    (string)$img['id'],
    6,
    '0',
    STR_PAD_LEFT
)?>
<br>

<span class="ai">
<?=$img['analysed_at']
    ? 'THREADED'
    : 'UNREAD'
?>
</span>
</footer>

</div>

<?php endforeach; ?>

</div>

<aside class="dossier" id="dossier">
<div class="dossier-head">
<div>
<h2 id="dossierTitle">DOSSIER</h2>
<div class="dossier-meta" id="dossierMeta"></div>
</div>
<button type="button" id="dossierClose">CLOSE</button>
</div>
<div class="dossier-grid">
<img id="dossierImg" alt="">
<form id="dossierForm" data-csrf="<?=h(csrf())?>">
<input type="hidden" name="id" id="dossierId" value="">
<label>JACK</label>
<textarea name="jack" id="fieldJack"></textarea>
<label>CAPTION</label>
<textarea name="caption" id="fieldCaption"></textarea>
<label>VISIBLE TEXT</label>
<input type="text" name="visible_text" id="fieldVisible">
<label>OBJECTS</label>
<input type="text" name="objects" id="fieldObjects">
<label>THEMES</label>
<input type="text" name="themes" id="fieldThemes">
<label>THREADS</label>
<input type="text" name="threads" id="fieldThreads">
<label>COLOURS</label>
<input type="text" name="colours" id="fieldColours">
<label>PLACES</label>
<input type="text" name="places" id="fieldPlaces">
<label>DATES</label>
<input type="text" name="dates" id="fieldDates">
<label>LINKS</label>
<input type="text" name="links" id="fieldLinks">
<label>DIRECTIONS · label | href | why</label>
<textarea class="tall" name="hrefs" id="fieldHrefs"></textarea>
<label>PUNCH CARDS · id | title | why</label>
<textarea class="tall" name="punches" id="fieldPunches"></textarea>
<label>TICKETS · id | title | standing | why</label>
<textarea class="tall" name="tickets" id="fieldTickets"></textarea>
<label>STANDING · Jack’s graduation</label>
<select id="fieldStanding" name="standing">
<option value="noise">NOISE</option>
<option value="held" selected>HELD</option>
<option value="relevant">RELEVANT — ON THE TREE</option>
</select>
<div class="dossier-actions">
<button type="submit">FILE THE CARD</button>
<button type="button" id="dossierRerun" <?= $machineReady ? '' : 'disabled' ?>>RE-RUN JACK</button>
</div>
<p class="sub" id="dossierStatus"></p>
</form>
</div>
</aside>

<p>
<a
    class="button"
    href="./"
>
OPEN FEED∞
</a>

<a
    class="button"
    href="/archive/"
>
ARCHIVE
</a>

<a
    class="button"
    href="/watch/"
>
WATCH
</a>

<a
    class="button"
    href="?logout"
>
LEAVE CLERK
</a>
</p>

<script>
const analyseAll =
    document.getElementById('analyseAll');

const machineStatus =
    document.getElementById('machineStatus');

const ingestForm =
    document.getElementById('ingestForm');

const ingestFiles =
    document.getElementById('ingestFiles');

const ingestPick =
    document.getElementById('ingestPick');

const ingestGo =
    document.getElementById('ingestGo');

const ingestMill =
    document.getElementById('ingestMill');

const ingestFill =
    document.getElementById('ingestFill');

const ingestRail =
    document.getElementById('ingestRail');

const ingestCount =
    document.getElementById('ingestCount');

const ingestNow =
    document.getElementById('ingestNow');

const ingestLog =
    document.getElementById('ingestLog');

const assetGrid =
    document.getElementById('assetGrid');

function setMill(percent, count, now){
    const p = Math.max(0, Math.min(100, percent));
    if (ingestFill) ingestFill.style.width = p + '%';
    ingestRail?.setAttribute('aria-valuenow', String(Math.round(p)));
    if (ingestCount && count) ingestCount.textContent = count;
    if (ingestNow && now) ingestNow.textContent = now;
}

function logMill(text, kind=''){
    if (!ingestLog) return;
    const li = document.createElement('li');
    if (kind) li.className = kind;
    li.textContent = text;
    ingestLog.appendChild(li);
    ingestLog.scrollTop = ingestLog.scrollHeight;
}

function describeFiles(files){
    if (!files.length) return 'nothing selected';
    const bytes = [...files].reduce((n,f) => n + (f.size || 0), 0);
    return files.length +
        (files.length === 1 ? ' plate · ' : ' plates · ') +
        (bytes < 1048576
            ? Math.round(bytes / 1024) + 'KB'
            : (bytes / 1048576).toFixed(1) + 'MB');
}

ingestFiles?.addEventListener('change', () => {
    if (ingestPick) {
        ingestPick.textContent =
            describeFiles([...ingestFiles.files]);
    }
});

function prependAsset(item){
    if (!assetGrid || !item || !item.id) return;
    if (assetGrid.querySelector('[data-id="'+item.id+'"]')) return;

    const el = document.createElement('div');
    el.className = 'asset';
    el.dataset.id = String(item.id);
    el.dataset.analysed = item.analysed ? '1' : '0';
    el.innerHTML =
        '<img src="'+String(item.src||'').replace(/"/g,'')+'" loading="lazy">' +
        '<footer>#'+String(item.id).padStart(6,'0')+'<br>' +
        '<span class="ai">'+(item.analysed ? 'THREADED' : 'UNREAD')+'</span></footer>';
    assetGrid.prepend(el);
}

function millOne(file, index, total){
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const body = new FormData();
        const csrf = ingestForm?.dataset.csrf || '';

        body.append('csrf', csrf);
        body.append('image', file, file.name);

        xhr.upload.addEventListener('progress', (e) => {
            if (!e.lengthComputable) return;
            const sent = e.loaded / e.total;
            const overall = ((index + sent * 0.42) / total) * 100;
            setMill(
                overall,
                (index + 1) + ' / ' + total,
                'SENDING ' + file.name + ' · ' + Math.round(sent * 100) + '%'
            );
        });

        xhr.addEventListener('load', () => {
            let j = null;
            try { j = JSON.parse(xhr.responseText); } catch(_) {}

            if (!j || !j.ok) {
                logMill(
                    'FAILED ' + file.name +
                    ' · ' + (j && j.error ? j.error : ('HTTP ' + xhr.status)),
                    'fail'
                );
                resolve(false);
                return;
            }

            (j.steps || []).forEach((step) => logMill(step, 'done'));
            prependAsset(j);
            resolve(true);
        });

        xhr.addEventListener('error', () => {
            logMill('TEMPORAL LINK LOST · ' + file.name, 'fail');
            resolve(false);
        });

        setMill(
            ((index + 0.42) / total) * 100,
            (index + 1) + ' / ' + total,
            'MILL HAS THE PLATE · CONTAINING TO <?=INGEST_MAX_EDGE?>px · WRITING JPEG Q<?=INGEST_JPEG_Q?>'
        );

        xhr.open('POST', '?api=ingest');
        xhr.send(body);
    });
}

ingestForm?.addEventListener('submit', async (e) => {
    const files = ingestFiles ? [...ingestFiles.files] : [];
    if (!files.length) return;

    e.preventDefault();

    ingestMill?.classList.add('on');
    if (ingestLog) ingestLog.innerHTML = '';
    ingestGo && (ingestGo.disabled = true);

    logMill('OPENING THE MILL · ' + files.length + ' PLATE' + (files.length===1?'':'S'));

    let done = 0;

    for (let i = 0; i < files.length; i++) {
        setMill(
            (i / files.length) * 100,
            (i + 1) + ' / ' + files.length,
            'RECEIVING ' + files[i].name
        );
        const ok = await millOne(files[i], i, files.length);
        if (ok) done++;
        setMill(
            ((i + 1) / files.length) * 100,
            (i + 1) + ' / ' + files.length,
            ok
                ? 'PLATE ENTERED THE FIELD'
                : 'PLATE REFUSED'
        );
    }

    setMill(
        100,
        done + ' / ' + files.length,
        done === files.length
            ? 'MILL COMPLETE · ALL PLATES HELD'
            : 'MILL COMPLETE · ' + done + ' HELD, ' + (files.length - done) + ' REFUSED'
    );

    logMill(
        'CLOSED THE MILL · JPEG Q<?=INGEST_JPEG_Q?> · EDGE <?=INGEST_MAX_EDGE?>',
        'done'
    );

    ingestGo && (ingestGo.disabled = false);
    if (ingestFiles) ingestFiles.value = '';
    if (ingestPick) ingestPick.textContent = 'nothing selected';
});

async function runJackOn(assets){
        let n = 0;

        for (const asset of assets) {

            n++;

            machineStatus.textContent =
                ` .;. ${n}/${assets.length}`;

            const form = new FormData();

            form.append(
                'id',
                asset.dataset.id
            );

            form.append(
                'csrf',
                analyseAll?.dataset.csrf ||
                document.getElementById('refileAll')?.dataset.csrf ||
                ''
            );

            try {

                const r =
                    await fetch(
                        '?api=analyse',
                        {
                            method:'POST',
                            body:form
                        }
                    );

                const j = await r.json();

                if (j.ok) {

                    asset.dataset.analysed = '1';

                    const ai =
                        asset.querySelector('.ai');

                    if (ai) {
                        ai.textContent =
                            'THREADED';
                    }
                }

            } catch(e) {
                console.error(e);
            }
        }

        machineStatus.textContent =
            ' .;. COMPLETE';
}

analyseAll?.addEventListener(
    'click',
    async () => {

        const assets = [
            ...document.querySelectorAll(
                '.asset[data-analysed="0"]'
            )
        ];

        await runJackOn(assets);
    }
);

document.getElementById('refileAll')?.addEventListener(
    'click',
    async () => {
        const assets = [...document.querySelectorAll('.asset')];
        await runJackOn(assets);
    }
);

const dossier = document.getElementById('dossier');
const dossierForm = document.getElementById('dossierForm');
const dossierStatus = document.getElementById('dossierStatus');
const dossierCsrf = dossierForm?.dataset.csrf || '';

function joinList(v){
    return Array.isArray(v) ? v.join(', ') : (v || '');
}

function joinRefs(rows, keys){
    return (rows || []).map((row) =>
        keys.map((k) => String(row[k] || '').trim()).join(' | ')
    ).join('\n');
}

function splitList(s){
    return String(s || '')
        .split(/[\n,]+/)
        .map((x) => x.trim())
        .filter(Boolean);
}

function splitRefs(s, keys){
    return String(s || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const parts = line.split('|').map((x) => x.trim());
            const row = {};
            keys.forEach((k, i) => { row[k] = parts[i] || ''; });
            return row;
        });
}

function fillDossier(j){
    document.getElementById('dossierId').value = j.id;
    document.getElementById('dossierTitle').textContent =
        'DOSSIER #' + String(j.id).padStart(6,'0');
    document.getElementById('dossierImg').src = j.src;
    document.getElementById('dossierMeta').innerHTML =
        (j.original_name ? ('FILED AS ' + j.original_name + '<br>') : '') +
        j.filename + ' · ' + j.width + '×' + j.height + ' · ' +
        (j.bytes ? Math.round(j.bytes/1024) + 'KB' : '') + '<br>' +
        'SHA256 ' + j.sha256 + '<br>' +
        (j.analysed_at ? ('JACK ' + j.analysed_at + '<br>') : 'UNREAD<br>') +
        (j.revised_by ? ('CLERK ' + j.revised_at + '<br>') : '');

    const a = j.analysis || {};
    document.getElementById('fieldJack').value = a.jack || '';
    document.getElementById('fieldCaption').value = a.caption || '';
    document.getElementById('fieldVisible').value = joinList(a.visible_text);
    document.getElementById('fieldObjects').value = joinList(a.objects);
    document.getElementById('fieldThemes').value = joinList(a.themes);
    document.getElementById('fieldThreads').value = joinList(a.threads);
    document.getElementById('fieldColours').value = joinList(a.colours);
    document.getElementById('fieldPlaces').value = joinList(a.places);
    document.getElementById('fieldDates').value = joinList(a.dates);
    document.getElementById('fieldLinks').value = joinList(a.links);
    document.getElementById('fieldHrefs').value = joinRefs(a.hrefs, ['label','href','why']);
    document.getElementById('fieldPunches').value = joinRefs(a.punches, ['id','title','why']);
    document.getElementById('fieldTickets').value = joinRefs(a.tickets, ['id','title','standing','why']);
    document.getElementById('fieldStanding').value =
        (a.standing === 'noise' || a.standing === 'relevant')
            ? a.standing
            : 'held';
    dossierStatus.textContent = '';
    dossier.classList.add('open');
    dossier.scrollIntoView({behavior:'smooth', block:'start'});
}

async function openDossier(id){
    const r = await fetch('?api=plate&id=' + encodeURIComponent(id));
    const j = await r.json();
    if (!j.ok) {
        dossierStatus.textContent = j.error || 'NOT HELD';
        return;
    }
    fillDossier(j);
}

assetGrid?.addEventListener('click', (e) => {
    const asset = e.target.closest('.asset');
    if (!asset) return;
    openDossier(asset.dataset.id);
});

document.getElementById('dossierClose')?.addEventListener('click', () => {
    dossier.classList.remove('open');
});

function readDossier(){
    return {
        jack: document.getElementById('fieldJack').value,
        caption: document.getElementById('fieldCaption').value,
        visible_text: splitList(document.getElementById('fieldVisible').value),
        objects: splitList(document.getElementById('fieldObjects').value),
        themes: splitList(document.getElementById('fieldThemes').value),
        threads: splitList(document.getElementById('fieldThreads').value),
        colours: splitList(document.getElementById('fieldColours').value),
        places: splitList(document.getElementById('fieldPlaces').value),
        dates: splitList(document.getElementById('fieldDates').value),
        links: splitList(document.getElementById('fieldLinks').value),
        hrefs: splitRefs(document.getElementById('fieldHrefs').value, ['label','href','why']),
        punches: splitRefs(document.getElementById('fieldPunches').value, ['id','title','why']),
        tickets: splitRefs(document.getElementById('fieldTickets').value, ['id','title','standing','why']),
        standing: document.getElementById('fieldStanding').value
    };
}

dossierForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('csrf', dossierCsrf);
    form.append('id', document.getElementById('dossierId').value);
    form.append('analysis', JSON.stringify(readDossier()));
    dossierStatus.textContent = '.;. FILING';
    const r = await fetch('?api=revise', {method:'POST', body:form});
    const j = await r.json();
    dossierStatus.textContent = j.ok ? '.;. FILED' : (j.error || 'REFUSED');
});

document.getElementById('dossierRerun')?.addEventListener('click', async () => {
    const id = document.getElementById('dossierId').value;
    const form = new FormData();
    form.append('csrf', dossierCsrf);
    form.append('id', id);
    dossierStatus.textContent = '.;. JACK IS LOOKING';
    const r = await fetch('?api=analyse', {method:'POST', body:form});
    const j = await r.json();
    if (!j.ok) {
        dossierStatus.textContent = j.error || 'REFUSED';
        return;
    }
    await openDossier(id);
    dossierStatus.textContent = '.;. JACK FILED A NEW CARD';
});
</script>

<?php endif; ?>

</main>
</body>
</html>
<?php
exit;
}


/* ============================================================
   PUBLIC FEED∞
   ============================================================ */

?>
<!doctype html>
<html lang="en">

<head>

<meta charset="utf-8">

<meta
    name="viewport"
    content="
        width=device-width,
        initial-scale=1,
        maximum-scale=1,
        viewport-fit=cover
    "
>

<meta
    name="theme-color"
    content="#000000"
>

<title>FEED∞</title>

<style>

/* ============================================================
   2033 FIELD LANGUAGE
   ============================================================ */

:root{
    color-scheme:dark;

    --void:#000;
    --ink:rgba(244,247,240,.94);
    --dim:rgba(244,247,240,.47);
    --ghost:rgba(244,247,240,.19);
    --field:rgba(174,255,156,.78);
    --danger:rgba(255,113,95,.86);

    --safe-top:
        env(safe-area-inset-top,0px);

    --safe-bottom:
        env(safe-area-inset-bottom,0px);
}

*{
    box-sizing:border-box;
    -webkit-tap-highlight-color:
        transparent;
}

html,body{
    margin:0;
    height:100%;
    background:var(--void);
    color:var(--ink);
    overscroll-behavior:none;
}

body{
    font-family:
        "Courier New",
        ui-monospace,
        monospace;

    overflow:hidden;
}

/*
 * The puddle.
 * One WebGL surface over the plate we are looking through.
 */
#fieldCanvas{
    position:fixed;
    inset:0;
    width:100%;
    height:100%;

    z-index:3;

    pointer-events:none;

    background:transparent;
    opacity:1;
    mix-blend-mode:normal;
}

body.puddle-ready .feed-item.active .source-image{
    opacity:0;
}

body.no-webgl .feed-item.active .source-image{
    opacity:1;
}

/*
 * Optical depth / vignette.
 */
#optics{
    position:fixed;
    inset:0;

    z-index:1;

    pointer-events:none;

    background:
        radial-gradient(
            ellipse at center,
            transparent 47%,
            rgba(0,0,0,.12) 75%,
            rgba(0,0,0,.55) 125%
        );

    mix-blend-mode:normal;
}


/* ============================================================
   FEED
   ============================================================ */

#feed{
    position:relative;
    z-index:2;

    width:100%;
    height:100svh;

    overflow-x:hidden;
    overflow-y:auto;

    scroll-snap-type:y proximity;
    scroll-behavior:smooth;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior-y:contain;
}

.feed-item,
.feed-slip{
    position:relative;
    width:100%;
    margin:0;
}

.feed-item{
    height:100svh;
    min-height:100svh;

    scroll-snap-align:start;
    scroll-snap-stop:normal;

    display:flex;
    align-items:center;
    justify-content:center;

    overflow:hidden;
}

.source-image{
    width:100%;
    height:100%;
    object-fit:cover;

    opacity:1;

    pointer-events:none;

    position:absolute;
    inset:0;
}

.feed-slip{
    min-height:42svh;
    padding:
        28px
        22px
        calc(var(--safe-bottom) + 36px);

    color:#1a2438;
    background:
        linear-gradient(180deg, rgba(196,30,58,.08), transparent 2.1rem),
        repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 11px,
            rgba(30,58,95,.07) 12px,
            transparent 13px
        ),
        #f3ead4;
    border-top:3px solid #1e3a5f;
    border-bottom:1px solid #c9b48a;
}

.feed-slip:before{
    content:"";
    position:absolute;
    top:0;
    right:0;
    width:1.15rem;
    height:1.15rem;
    background:
        linear-gradient(
            135deg,
            transparent 49%,
            #1e3a5f 50%,
            #1e3a5f 53%,
            #f3ead4 54%
        );
    pointer-events:none;
}

.slip-inner{
    max-width:36rem;
    margin:0 auto;
}

.slip-batch{
    margin:0 0 10px;
    font-size:9px;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:#1e3a5f;
}

.slip-jack{
    margin:0 0 14px;
    font-size:15px;
    line-height:1.45;
    color:#1a2438;
}

.slip-jack:before{
    content:".;. ";
    color:#c41e3a;
}

.slip-cap{
    margin:0 0 18px;
    color:#2a3350;
    font-size:12px;
    line-height:1.5;
}

.slip-row{
    margin:0 0 8px;
    font-size:11px;
    line-height:1.55;
    letter-spacing:.04em;
    color:#1a2438;
}

.slip-row span{
    display:inline-block;
    min-width:5.2em;
    color:#1e3a5f;
    font-size:9px;
    letter-spacing:.14em;
}

.slip-text{
    margin:16px 0 0;
    padding-left:12px;
    border-left:2px solid #c41e3a;
    color:#2a3350;
    font-size:11px;
    line-height:1.55;
}

.slip-threads{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    margin-top:16px;
}

#punchDock{
    position:fixed;
    z-index:30;
    top:0;
    right:0;
    bottom:0;
    width:min(28rem,92vw);
    margin:0;
    padding:
        calc(var(--safe-top) + 22px)
        22px
        calc(var(--safe-bottom) + 28px);
    overflow:auto;
    color:#1a2438;
    background:
        linear-gradient(180deg, rgba(196,30,58,.08), transparent 2.1rem),
        repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 11px,
            rgba(30,58,95,.07) 12px,
            transparent 13px
        ),
        #f3ead4;
    border-left:3px solid #1e3a5f;
    box-shadow:-18px 0 40px rgba(26,36,56,.18);
    transform:translate3d(104%,0,0);
    transition:transform .62s cubic-bezier(.22,1,.28,1);
    pointer-events:none;
}

#punchDock.open{
    transform:translate3d(0,0,0);
    pointer-events:auto;
}

#punchDock:before{
    content:"";
    position:absolute;
    top:0;
    right:0;
    width:1.15rem;
    height:1.15rem;
    background:
        linear-gradient(
            135deg,
            transparent 49%,
            #1e3a5f 50%,
            #1e3a5f 53%,
            #f3ead4 54%
        );
    pointer-events:none;
}

#punchClose{
    position:absolute;
    top:calc(var(--safe-top) + 10px);
    left:12px;
    z-index:1;
    border:1.5px solid #1e3a5f;
    background:#f3ead4;
    color:#1e3a5f;
    width:36px;
    height:36px;
    font:16px/1 "Courier New",monospace;
    cursor:pointer;
}

#punchClose:hover,
#punchClose:focus-visible{
    border-color:#c41e3a;
    color:#c41e3a;
}

#punchDock .feed-slip{
    min-height:0;
    padding:36px 0 0;
    background:transparent;
    border:0;
}

#punchDock .feed-slip:before{
    display:none;
}

a.direction,
.slip-row a{
    color:#c41e3a;
    text-decoration:none;
    border-bottom:1px solid #c41e3a;
}

a.direction{
    display:inline-block;
    border:1.5px solid #1e3a5f;
    border-bottom-width:1.5px;
    background:#f3ead4;
    color:#1e3a5f;
    padding:4px 8px;
    font:inherit;
    font-size:10px;
    letter-spacing:.06em;
}

a.direction:hover,
a.direction:focus-visible{
    border-color:#c41e3a;
    color:#c41e3a;
}


/* ============================================================
   ARCHIVE REGISTRATION
   ============================================================ */

.registration{
    position:absolute;

    inset:
        calc(var(--safe-top) + 56px)
        18px
        calc(var(--safe-bottom) + 54px)
        18px;

    pointer-events:none;

    opacity:.36;

    transition:
        opacity .9s ease;
}

.feed-item.active .registration{
    opacity:.64;
}

.corner{
    position:absolute;

    width:12px;
    height:12px;
}

.corner:before,
.corner:after{
    content:"";
    position:absolute;
    background:var(--ink);
}

.corner:before{
    width:12px;
    height:1px;
}

.corner:after{
    width:1px;
    height:12px;
}

.tl{
    left:0;
    top:0;
}

.tr{
    right:0;
    top:0;
    transform:rotate(90deg);
}

.br{
    right:0;
    bottom:0;
    transform:rotate(180deg);
}

.bl{
    left:0;
    bottom:0;
    transform:rotate(-90deg);
}


/* ============================================================
   PERMANENT HUD — ALMOST NOTHING
   ============================================================ */

#hudTop{
    position:fixed;

    z-index:20;

    left:0;
    right:0;

    top:0;

    height:
        calc(
            48px +
            var(--safe-top)
        );

    padding:
        calc(
            var(--safe-top) +
            12px
        )
        15px
        0;

    display:flex;
    justify-content:space-between;
    align-items:flex-start;

    pointer-events:none;

    font-size:10px;
    line-height:1.2;

    letter-spacing:.08em;
    text-transform:uppercase;

    color:rgba(244,247,240,.55);
}

.brand{
    pointer-events:auto;
    display:flex;
    align-items:center;
    gap:8px;
    text-decoration:none;
    color:#1a2438;
    background:#f3ead4;
    border:1.5px solid #1e3a5f;
    padding:5px 9px 5px 7px;
    box-shadow:1px 1px 0 #1e3a5f;
}

.brand b{
    font-size:12px;
    letter-spacing:.16em;
    font-weight:700;
}

.infinity{
    width:42px;
    height:20px;
    display:block;
    transform-style:preserve-3d;
    animation:infinity-gyre 18s linear infinite;
}

.infinity-path{
    fill:none;
    stroke:#1a2438;
    stroke-width:1.7;
    stroke-linecap:round;
    stroke-linejoin:round;
    stroke-dasharray:160;
    animation:infinity-draw 9s ease-in-out infinite;
}

.infinity-head{
    fill:#c41e3a;
}

@keyframes infinity-gyre{
    from{transform:rotate3d(.18,1,.12,0deg)}
    to{transform:rotate3d(.18,1,.12,360deg)}
}

@keyframes infinity-draw{
    0%{stroke-dashoffset:160}
    45%{stroke-dashoffset:0}
    100%{stroke-dashoffset:-160}
}

#fieldReadout{
    text-align:right;
}

.hud-lead{
    display:flex;
    align-items:flex-start;
    gap:8px;
    pointer-events:auto;
}

#telemBtn{
    appearance:none;
    pointer-events:auto;
    border:1.5px solid #1e3a5f;
    background:#f3ead4;
    color:#1a2438;
    box-shadow:1px 1px 0 #1e3a5f;
    padding:7px 9px;
    font:700 9px/1 "Courier New",monospace;
    letter-spacing:.14em;
    text-transform:uppercase;
    cursor:pointer;
    min-height:30px;
}

#telemBtn[aria-expanded="true"],
#telemBtn:hover,
#telemBtn:focus-visible{
    border-color:#c41e3a;
    color:#c41e3a;
}

#telemDock{
    position:fixed;
    z-index:30;
    top:0;
    left:0;
    bottom:0;
    width:min(22rem,92vw);
    margin:0;
    padding:
        calc(var(--safe-top) + 22px)
        18px
        calc(var(--safe-bottom) + 28px);
    overflow:auto;
    color:#1a2438;
    background:
        repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent 11px,
            rgba(30,58,95,.07) 12px,
            transparent 13px
        ),
        #f3ead4;
    border-right:3px solid #1e3a5f;
    box-shadow:18px 0 40px rgba(26,36,56,.18);
    transform:translate3d(-104%,0,0);
    transition:transform .62s cubic-bezier(.22,1,.28,1);
    pointer-events:none;
}

#telemDock.open{
    transform:translate3d(0,0,0);
    pointer-events:auto;
}

#telemDock[hidden]{
    display:block;
}

#telemClose{
    position:absolute;
    top:calc(var(--safe-top) + 10px);
    right:12px;
    border:1.5px solid #1e3a5f;
    background:#f3ead4;
    color:#1e3a5f;
    width:36px;
    height:36px;
    font:16px/1 "Courier New",monospace;
    cursor:pointer;
}

#telemClose:hover,
#telemClose:focus-visible{
    border-color:#c41e3a;
    color:#c41e3a;
}

#telemDock h2{
    margin:8px 28px 14px 0;
    font:700 12px/1 "Courier New",monospace;
    letter-spacing:.16em;
    text-transform:uppercase;
}

.telem-kicker{
    margin:18px 0 8px;
    font:700 9px/1 "Courier New",monospace;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:#c41e3a;
}

#telemLive,
#telemHouse{
    margin:0;
    display:grid;
    grid-template-columns:8.4rem 1fr;
    gap:6px 10px;
    font:11px/1.25 "Courier New",monospace;
    letter-spacing:.04em;
}

#telemLive dt,
#telemHouse dt{
    margin:0;
    color:#1e3a5f;
    text-transform:uppercase;
    letter-spacing:.08em;
    font-size:9px;
}

#telemLive dd,
#telemHouse dd{
    margin:0;
    text-align:right;
    word-break:break-word;
}

#telemNote{
    margin:18px 0 0;
    font:10px/1.4 "Courier New",monospace;
    color:#4a4458;
}


/* ============================================================
   LOWER FIELD INSTRUMENT
   ============================================================ */

#hudBottom{
    position:fixed;

    z-index:20;

    left:0;
    right:0;
    bottom:0;

    padding:
        0 15px
        calc(
            var(--safe-bottom) +
            12px
        );

    display:flex;
    justify-content:space-between;
    align-items:end;

    pointer-events:none;

    font-size:9px;
    letter-spacing:.07em;

    color:rgba(244,247,240,.55);
}

#pulse{
    white-space:nowrap;
}

#objectNo{
    text-align:right;
}

#lensPort{
    position:fixed;
    z-index:22;
    top:calc(var(--safe-top) + 52px);
    right:14px;
    width:58px;
    height:58px;
    padding:0;
    border:0;
    background:transparent;
    pointer-events:auto;
    cursor:pointer;
    display:block;
    mix-blend-mode:normal;
}

#lensPort[hidden]{
    display:none;
}

#lensPort .lens-glass{
    display:block;
    width:46px;
    height:46px;
    border-radius:50%;
    border:2px solid rgba(201,169,97,.85);
    box-shadow:
        0 0 0 1px rgba(8,8,8,.7),
        inset 0 0 10px rgba(169,255,156,.18);
    overflow:hidden;
    background:rgba(8,10,8,.55);
}

#lensPort .lens-glass img{
    width:100%;
    height:100%;
    object-fit:cover;
    display:block;
}

#lensPort .lens-handle{
    position:absolute;
    width:16px;
    height:3px;
    right:2px;
    bottom:8px;
    background:rgba(201,169,97,.9);
    transform:rotate(42deg);
    transform-origin:left center;
}


/* ============================================================
   MACHINE ANNOTATION
   ============================================================ */

.annotation{
    position:absolute;

    left:18px;
    right:18px;

    bottom:
        calc(
            72px +
            var(--safe-bottom)
        );

    z-index:7;

    pointer-events:none;

    opacity:.92;
    transform:none;
}

.jack-line{
    max-width:min(620px,84vw);

    font-size:12px;
    line-height:1.45;

    letter-spacing:.02em;

    text-shadow:
        0 1px 5px #000,
        0 0 18px #000;
}

.jack-line:before{
    content:".;. ";
    color:var(--field);
}

.caption{
    margin-top:8px;

    max-width:600px;

    color:var(--dim);

    font-size:10px;
    line-height:1.35;
}


/* ============================================================
   SEMANTIC WORMHOLES
   ============================================================ */

.threads{
    display:flex;
    flex-wrap:wrap;

    gap:5px;

    margin-top:12px;

    pointer-events:auto;
}

.thread{
    appearance:none;

    border:1.5px solid #1e3a5f;
    background:#f3ead4;
    color:#1e3a5f;

    padding:
        7px 9px;

    font:
        9px/1
        "Courier New",
        monospace;

    letter-spacing:.07em;

    text-transform:uppercase;

    cursor:pointer;
}

.thread:hover,
.thread:focus-visible{
    border-color:#c41e3a;
    color:#c41e3a;
}

.thread:active{
    background:#c41e3a;
    border-color:#c41e3a;
    color:#f3ead4;
}


/* ============================================================
   WAKE MARK
   ============================================================ */

.residue{
    position:absolute;

    right:17px;
    top:50%;

    transform:
        translateY(-50%)
        rotate(90deg);

    transform-origin:right center;

    font-size:8px;

    letter-spacing:.11em;

    color:var(--ghost);

    pointer-events:none;
}


/* ============================================================
   THREAD BANNER
   ============================================================ */

#threadMode{
    position:fixed;

    top:
        calc(
            var(--safe-top) +
            51px
        );

    left:50%;

    transform:
        translateX(-50%);

    z-index:40;

    display:none;

    border:
        1px solid
        rgba(255,255,255,.25);

    background:
        rgba(0,0,0,.62);

    backdrop-filter:
        blur(15px);

    padding:
        8px 10px;

    font-size:9px;

    letter-spacing:.08em;

    color:var(--ink);

    cursor:pointer;
}

#threadMode.on{
    display:block;
}


/* ============================================================
   FIRST FIELD WAKE
   ============================================================ */

#sensorWake{
    position:fixed;

    inset:0;

    z-index:100;

    display:grid;
    place-items:center;

    pointer-events:none;

    opacity:1;

    transition:
        opacity 1.4s ease;
}

#sensorWake.gone{
    opacity:0;
}

.wake-copy{
    font-size:10px;
    letter-spacing:.15em;

    color:
        rgba(255,255,255,.45);

    text-align:center;

    animation:
        breathe 3.2s infinite;
}

@keyframes breathe{
    0%,100%{opacity:.28}
    50%{opacity:.72}
}


/* ============================================================
   EMPTY
   ============================================================ */

#empty{
    min-height:100svh;

    display:grid;
    place-items:center;

    color:var(--dim);

    font-size:11px;

    text-align:center;

    line-height:1.8;
}


/* ============================================================
   PUNCH REGISTER LOADER
   ============================================================ */

#register{
    position:fixed;

    z-index:50;

    left:50%;
    bottom:
        calc(
            36px +
            var(--safe-bottom)
        );

    transform:
        translateX(-50%);

    display:none;

    letter-spacing:.14em;

    font-size:9px;

    color:var(--ghost);

    pointer-events:none;
}

#register.on{
    display:block;
}


/* ============================================================
   DEBUG / 4D PORTAL
   ============================================================ */

#deepField{
    position:fixed;

    inset:0;

    z-index:15;

    pointer-events:none;

    opacity:0;

    transition:
        opacity .7s ease;
}

body.deep #deepField{
    opacity:1;
}

.orbit{
    position:absolute;

    left:50%;
    top:50%;

    width:min(78vw,640px);
    aspect-ratio:1;

    border:
        1px solid
        rgba(255,255,255,.08);

    border-radius:50%;

    transform:
        translate(-50%,-50%);

    animation:
        orbit 90s linear infinite;
}

.orbit:after{
    content:"";

    position:absolute;

    inset:14%;

    border:
        1px dashed
        rgba(255,255,255,.07);

    border-radius:50%;
}

@keyframes orbit{
    to{
        transform:
            translate(-50%,-50%)
            rotate(360deg);
    }
}

.axisX,
.axisY{
    position:absolute;

    background:
        rgba(255,255,255,.07);

    left:50%;
    top:50%;
}

.axisX{
    width:100vw;
    height:1px;

    transform:
        translate(-50%,-50%);
}

.axisY{
    width:1px;
    height:100vh;

    transform:
        translate(-50%,-50%);
}


/* ============================================================
   ACCESSIBILITY
   ============================================================ */

@media(prefers-reduced-motion:reduce){

    .orbit,
    .infinity,
    .infinity-path{
        animation:none;
    }

    #punchDock,
    #telemDock{
        transition-duration:.2s;
    }

    #feed{
        scroll-snap-type:none;
        scroll-behavior:auto;
    }

    *{
        scroll-behavior:auto !important;
    }
}

</style>

</head>


<body>

<canvas
    id="fieldCanvas"
    aria-hidden="true"
></canvas>

<div
    id="optics"
    aria-hidden="true"
></div>

<div id="deepField">
    <div class="orbit"></div>
    <div class="axisX"></div>
    <div class="axisY"></div>
</div>

<a
    id="lensPort"
    class="hud-lens"
    hidden
    href="/now"
    aria-label="Open this plate in the tree"
>
    <span class="lens-glass"><img id="lensPlate" alt=""></span>
    <span class="lens-handle" aria-hidden="true"></span>
</a>

<header id="hudTop">
    <div class="hud-lead">
    <a class="brand" href="/feed/" aria-label="FEED">
        <svg class="infinity" viewBox="0 0 72 36" aria-hidden="true">
            <path
                class="infinity-path"
                id="lemniscate"
                d="M36 18C36 8 24 4 16 10C8 16 8 20 16 26C24 32 36 28 36 18C36 8 48 4 56 10C64 16 64 20 56 26C48 32 36 28 36 18"
            />
            <circle class="infinity-head" r="2.1">
                <animateMotion dur="7s" rotate="auto" repeatCount="indefinite">
                    <mpath href="#lemniscate"/>
                </animateMotion>
            </circle>
        </svg>
        <b>FEED</b>
    </a>
    <button
        type="button"
        id="telemBtn"
        aria-expanded="false"
        aria-controls="telemDock"
    >TELEMETRY</button>
    </div>

    <div id="fieldReadout">
        FIELD —
    </div>
</header>

<aside id="telemDock" hidden>
    <button type="button" id="telemClose" aria-label="Close telemetry">×</button>
    <h2>TELEMETRY</h2>
    <p class="telem-kicker">THIS SITTING</p>
    <dl id="telemLive"></dl>
    <p class="telem-kicker">HOUSE</p>
    <dl id="telemHouse"></dl>
    <p id="telemNote">Anonymous residue. Shake, scroll, dwell. Raw hand movement is transient. No account.</p>
</aside>

<footer id="hudBottom">
    <div id="pulse">
        ◎ LOCAL
    </div>

    <div id="objectNo">
        ∞ 000000
    </div>
</footer>

<div
    id="threadMode"
    title="Return to field"
></div>

<div id="sensorWake">
    <div class="wake-copy">
        FEED∞<br>
        TOUCH THE FIELD
    </div>
</div>

<div id="register">
    ○ ○ ● ○ ● ● ○ ● ○
</div>

<aside id="punchDock" aria-hidden="true">
    <button type="button" id="punchClose" aria-label="Close card">×</button>
    <div id="punchInner"></div>
</aside>

<main id="feed"></main>

<script>

/* ============================================================
   FEED∞
   CLIENT FIELD INSTRUMENT
   ============================================================ */

(() => {

'use strict';


/* ============================================================
   SESSION

   Ephemeral.
   sessionStorage.
   No account.
   No fingerprint.
   ============================================================ */

const SESSION_KEY =
    'feed-infinity-session';

let sessionId =
    sessionStorage.getItem(
        SESSION_KEY
    );

if (!sessionId) {

    sessionId =
        crypto.randomUUID
            ? crypto.randomUUID()
            :
            (
                Date.now().toString(36) +
                Math.random()
                    .toString(36)
                    .slice(2)
            );

    sessionStorage.setItem(
        SESSION_KEY,
        sessionId
    );
}


/* ============================================================
   DOM
   ============================================================ */

const feed =
    document.getElementById('feed');

const canvas =
    document.getElementById(
        'fieldCanvas'
    );

const fieldReadout =
    document.getElementById(
        'fieldReadout'
    );

const objectNo =
    document.getElementById(
        'objectNo'
    );

const pulse =
    document.getElementById('pulse');

const sensorWake =
    document.getElementById(
        'sensorWake'
    );

const register =
    document.getElementById(
        'register'
    );

const threadMode =
    document.getElementById(
        'threadMode'
    );

const telemBtn =
    document.getElementById('telemBtn');

const telemDock =
    document.getElementById('telemDock');

const telemLive =
    document.getElementById('telemLive');

const telemHouse =
    document.getElementById('telemHouse');

const telemClose =
    document.getElementById('telemClose');


/* ============================================================
   SHARED FIELD STATE

   Future Chronometer / magnetic / mapping modules
   can simply populate this object.
   ============================================================ */

window.FEED_FIELD = {

    t:Date.now(),

    currentImage:null,

    visibleMs:0,
    visibility:0,

    scrollVelocity:0,
    scrollAcceleration:0,

    direction:0,
    directionChanges:0,

    pressure:0,
    touchDuration:0,

    touchX:0,
    touchY:0,
    touchLive:0,
    drop:null,

    orientation:{
        alpha:0,
        beta:0,
        gamma:0
    },

    motionEnergy:0,
    scrollLength:0,
    rippleEnergy:0,
    ripplePhase:0,

    attention:0,
    recurrence:0,

    thread:null,

    chronometer:{
        jd:null,
        lst:null,
        phase:0
    },

    map:{
        lat:null,
        lon:null,
        heading:null
    },

    magnetic:{
        magnitude:null,
        heading:null
    },

    pulse:{
        phase:0,
        harmonic:0
    }
};

const F =
    window.FEED_FIELD;


/* ============================================================
   SCROLL PHYSICS
   ============================================================ */

let previousY =
    feed ? feed.scrollTop : 0;

let previousV = 0;

let previousT =
    performance.now();

let lastDropAt = 0;

let directionChanges = 0;

function updateScrollPhysics(){

    const now =
        performance.now();

    const dt =
        Math.max(
            16,
            now - previousT
        );

    const y =
        feed ? feed.scrollTop : window.scrollY;

    const dy =
        y - previousY;

    const v =
        dy / dt * 1000;

    const a =
        (v - previousV) /
        dt * 1000;

    const direction =
        Math.sign(v);

    if (
        direction &&
        F.direction &&
        direction !== F.direction
    ) {
        directionChanges++;
    }

    F.scrollVelocity = v;
    F.scrollAcceleration = a;
    F.direction = direction;
    F.directionChanges =
        directionChanges;

    F.scrollLength =
        F.scrollLength * 0.978 +
        Math.min(80, Math.abs(dy)) * 0.012;

    F.rippleEnergy =
        F.rippleEnergy * 0.90 +
        Math.min(1.4, Math.abs(dy) / 28);

    F.ripplePhase +=
        dy * 0.018;

    if (
        Math.abs(dy) > 8 &&
        now - lastDropAt > 90
    ) {
        lastDropAt = now;
        F.drop = {
            x: F.touchX || 0.5,
            y: F.touchY || 0.48,
            s: Math.min(1, Math.abs(dy) / 22),
            t: now
        };
    }

    previousY = y;
    previousV = v;
    previousT = now;
}

(feed || window).addEventListener(
    'scroll',
    updateScrollPhysics,
    {passive:true}
);


/* ============================================================
   DEVICE FIELD
   ============================================================ */

addEventListener(
    'deviceorientation',
    e => {

        F.orientation.alpha =
            e.alpha || 0;

        F.orientation.beta =
            e.beta || 0;

        F.orientation.gamma =
            e.gamma || 0;
    },
    {passive:true}
);

addEventListener(
    'devicemotion',
    e => {

        const a =
            e.accelerationIncludingGravity;

        if (!a) return;

        const x = a.x || 0;
        const y = a.y || 0;
        const z = a.z || 0;

        const magnitude =
            Math.sqrt(
                x*x +
                y*y +
                z*z
            );

        /*
         * Difference from stationary gravity.
         */
        F.motionEnergy =
            Math.min(
                20,
                Math.abs(
                    magnitude - 9.81
                )
            );
    },
    {passive:true}
);


/* ============================================================
   POINTER FIELD
   ============================================================ */

let pointerDownAt = 0;

addEventListener(
    'pointerdown',
    e => {

        pointerDownAt =
            performance.now();

        F.pressure =
            e.pressure || 0;

        F.touchX =
            e.clientX /
            innerWidth;

        F.touchY =
            e.clientY /
            innerHeight;

        F.touchLive = 1;

        F.drop = {
            x: F.touchX,
            y: F.touchY,
            s: 0.72,
            t: performance.now()
        };
    },
    {passive:true}
);

addEventListener(
    'pointermove',
    e => {

        if (
            e.buttons ||
            e.pointerType === 'touch'
        ) {
            F.pressure =
                e.pressure || 0;

            F.touchX =
                e.clientX /
                innerWidth;

            F.touchY =
                e.clientY /
                innerHeight;

            F.touchLive = 1;
        }
    },
    {passive:true}
);

addEventListener(
    'pointerup',
    () => {

        F.touchDuration =
            Math.max(
                0,
                performance.now() -
                pointerDownAt
            );

        setTimeout(
            () => {
                F.pressure = 0;
            },
            120
        );
    },
    {passive:true}
);


/* ============================================================
   IOS FIELD PERMISSION
   ============================================================ */

async function wakeField(){

    sensorWake.classList.add(
        'gone'
    );

    try{

        if (
            typeof DeviceOrientationEvent
                !== 'undefined' &&
            typeof DeviceOrientationEvent
                .requestPermission
                === 'function'
        ) {
            await DeviceOrientationEvent
                .requestPermission();
        }

        if (
            typeof DeviceMotionEvent
                !== 'undefined' &&
            typeof DeviceMotionEvent
                .requestPermission
                === 'function'
        ) {
            await DeviceMotionEvent
                .requestPermission();
        }

    }catch(_){}

    removeEventListener(
        'pointerdown',
        wakeField
    );
}

addEventListener(
    'pointerdown',
    wakeField,
    {passive:true}
);


/* ============================================================
   EVENT TRANSMISSION
   ============================================================ */

function sendEvent(
    type,
    item,
    extra={}
){

    if (!item) return;

    const payload = {

        type,

        image_id:
            Number(item.dataset.id),

        session_id:
            sessionId,

        visible_ms:
            Math.round(
                item._visibleMs || 0
            ),

        visibility:
            item._visibility || 0,

        scroll_velocity:
            F.scrollVelocity,

        scroll_acceleration:
            F.scrollAcceleration,

        direction:
            F.direction,

        direction_changes:
            F.directionChanges,

        touch_duration:
            Math.round(
                F.touchDuration
            ),

        pressure:
            F.pressure,

        touch_x:
            F.touchX,

        touch_y:
            F.touchY,

        tilt_beta:
            F.orientation.beta,

        tilt_gamma:
            F.orientation.gamma,

        motion_energy:
            F.motionEnergy,

        revisited:
            item._visitCount > 1
                ? 1
                : 0,

        annotation:
            '',

        thread:
            F.thread || '',

        ...extra
    };

    const blob =
        new Blob(
            [
                JSON.stringify(
                    payload
                )
            ],
            {
                type:
                    'application/json'
            }
        );

    navigator.sendBeacon(
        '?api=event',
        blob
    );
}


/* ============================================================
   FEED STATE
   ============================================================ */

let loading = false;

let activeItem = null;

let currentThread = null;

const history = [];

const loadedIds =
    new Set();

const cycleSeen =
    new Set();

const visits =
    new Map();


/* ============================================================
   ITEM HTML
   ============================================================ */

function escapeHTML(s=''){

    return String(s)
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'","&#039;");
}

function tagList(v){
    if (Array.isArray(v)) {
        return v.filter(x => x !== '' && x != null).map(String);
    }
    if (typeof v === 'string' && v.trim()) {
        return [v.trim()];
    }
    return [];
}

function refList(v){
    if (!Array.isArray(v)) return [];
    return v.filter((x) => x && typeof x === 'object');
}

function safeHref(href){
    const s = String(href || '').trim();
    if (!s || s.length > 240) return '';
    if (s.startsWith('/') && !s.startsWith('//') && !s.includes('\\')) {
        return s;
    }
    try {
        const u = new URL(s);
        const host = u.hostname.toLowerCase();
        const ok = [
            'ffilm.org','www.ffilm.org',
            'timetravellersguild.com','www.timetravellersguild.com',
            'faetime.space','www.faetime.space',
            'zoneout.net','www.zoneout.net',
            'tobygodden.com','www.tobygodden.com',
            'chronometer.online','www.chronometer.online'
        ];
        if ((u.protocol === 'http:' || u.protocol === 'https:') && ok.includes(host)) {
            return u.href;
        }
    } catch (_) {}
    return '';
}

function directionHTML(row){
    const label = escapeHTML(row.label || row.title || row.href || '');
    const href = safeHref(row.href || '');
    const why = row.why ? ` title="${escapeHTML(row.why)}"` : '';
    if (!href) return label;
    const ext = href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
    return `<a class="direction" href="${escapeHTML(href)}"${ext}${why}>${label}</a>`;
}

function bindThreads(root, item){
    root.querySelectorAll('.thread').forEach(button => {
        button.addEventListener('click', e => {
            e.stopPropagation();
            enterThread(button.dataset.thread);
            sendEvent('thread', item, {
                thread: button.dataset.thread
            });
        });
    });

    root.querySelectorAll('a.direction').forEach(a => {
        a.addEventListener('click', e => e.stopPropagation());
        a.addEventListener('pointerdown', e => e.stopPropagation());
    });
}

function buildSlip(data){
    const a = data.analysis || {};
    const slip = document.createElement('section');
    slip.className = 'feed-slip';
    slip.dataset.id = data.id;
    slip._data = data;

    const fields = [
        ['THREAD', tagList(a.threads)],
        ['OBJECT', tagList(a.objects)],
        ['THEME', tagList(a.themes)],
        ['COLOUR', tagList(a.colours)],
        ['PLACE', tagList(a.places)],
        ['DATE', tagList(a.dates)],
        ['LINK', tagList(a.links)]
    ];

    const rows = fields
        .filter(([, xs]) => xs.length)
        .map(([label, xs]) =>
            `<p class="slip-row"><span>${label}</span> ${
                xs.map(escapeHTML).join(' · ')
            }</p>`
        )
        .join('');

    const hrefs = refList(a.hrefs);
    const punches = refList(a.punches);
    const tickets = refList(a.tickets);

    const doorRow = hrefs.length
        ? `<p class="slip-row"><span>DOOR</span> ${
            hrefs.map(directionHTML).join(' · ')
        }</p>`
        : '';

    const punchRow = punches.length
        ? `<p class="slip-row slip-punch"><span>PUNCH</span> ${
            punches.map(directionHTML).join(' · ')
        }</p>`
        : '';

    const ticketRow = tickets.length
        ? `<p class="slip-row slip-ticket"><span>TICKET</span> ${
            tickets.map((t) => {
                const mark = t.standing ? ` [${escapeHTML(t.standing)}]` : '';
                return directionHTML({
                    ...t,
                    label: (t.title || t.label || t.id || '') + mark
                });
            }).join(' · ')
        }</p>`
        : '';

    const visible = tagList(a.visible_text);
    const threads = [...new Set([
        ...tagList(a.threads),
        ...tagList(a.links)
    ])].slice(0, 10);

    slip.innerHTML = `
        <div class="slip-inner">
            <p class="slip-batch">IBM 5081 · FEED∞ · #${
                String(data.id).padStart(6,'0')
            }</p>
            ${a.jack ? `<p class="slip-jack">${escapeHTML(a.jack)}</p>` : ''}
            ${a.caption && a.caption !== a.jack
                ? `<p class="slip-cap">${escapeHTML(a.caption)}</p>`
                : ''}
            ${rows}
            ${doorRow}
            ${punchRow}
            ${ticketRow}
            ${visible.length
                ? `<blockquote class="slip-text">${
                    visible.map(escapeHTML).join('<br>')
                }</blockquote>`
                : ''}
            <div class="slip-threads">
                ${threads.map(t => `
                    <button class="thread" data-thread="${escapeHTML(t)}">
                        ${escapeHTML(t)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    bindThreads(slip, slip);
    return slip;
}

const punchDock = document.getElementById('punchDock');
const punchInner = document.getElementById('punchInner');
const punchClose = document.getElementById('punchClose');
let punchOpenId = null;

function closePunch(){
    if (!punchDock) return;
    punchDock.classList.remove('open');
    punchDock.setAttribute('aria-hidden','true');
    punchOpenId = null;
    const done = (e) => {
        if (e && e.target !== punchDock) return;
        if (!punchDock.classList.contains('open')) {
            punchInner.innerHTML = '';
        }
        punchDock.removeEventListener('transitionend', done);
    };
    punchDock.addEventListener('transitionend', done);
}

function openPunch(data){
    if (!punchDock || !data) return;
    if (punchOpenId === data.id) {
        closePunch();
        return;
    }
    punchInner.innerHTML = '';
    punchInner.appendChild(buildSlip(data));
    punchDock.hidden = false;
    punchDock.setAttribute('aria-hidden','false');
    punchOpenId = data.id;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            punchDock.classList.add('open');
        });
    });
}

punchClose?.addEventListener('click', closePunch);
addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePunch();
});

function buildItem(data){

    const item =
        document.createElement(
            'section'
        );

    item.className =
        'feed-item';

    item.dataset.id =
        data.id;

    item.dataset.src =
        data.src;

    item.dataset.residue =
        data.residue || 0;

    const a =
        data.analysis || {};

    item._data = data;
    item._visibleMs = 0;
    item._visibility = 0;
    item._visitCount =
        visits.get(data.id) || 0;

    const caption =
        a.caption ||
        a.jack ||
        '';

    item.innerHTML = `

        <img
            class="source-image"
            src="${escapeHTML(data.src)}"
            alt="${escapeHTML(caption)}"
            loading="lazy"
        >

        <div class="registration">
            <i class="corner tl"></i>
            <i class="corner tr"></i>
            <i class="corner br"></i>
            <i class="corner bl"></i>
        </div>
    `;

    /*
     * A short tap files the punchcard from the right.
     * A hold still awakens the deeper weft.
     */
    let holdTimer = null;
    let press = null;

    item.addEventListener(
        'pointerdown',
        (e) => {
            press = {
                x: e.clientX,
                y: e.clientY,
                t: performance.now()
            };
            holdTimer =
                setTimeout(
                    () => {
                        document.body
                            .classList
                            .add('deep');
                    },
                    700
                );
        },
        {passive:true}
    );

    item.addEventListener(
        'pointerup',
        (e) => {

            clearTimeout(
                holdTimer
            );

            setTimeout(
                () => {
                    document.body
                        .classList
                        .remove('deep');
                },
                700
            );

            if (!press) return;
            const moved = Math.hypot(
                e.clientX - press.x,
                e.clientY - press.y
            );
            const held = performance.now() - press.t;
            press = null;
            if (moved < 14 && held < 520) {
                openPunch(item._data);
            }
        },
        {passive:true}
    );

    return item;
}


/* ============================================================
   LOAD FEED
   ============================================================ */

async function requestFeed(excludeIds){

    const current =
        activeItem
            ? activeItem.dataset.id
            : 0;

    const params =
        new URLSearchParams({
            api:'feed',
            current,
            exclude: [...excludeIds].join(',')
        });

    if (currentThread) {
        params.set(
            'thread',
            currentThread
        );
    }

    const r =
        await fetch(
            '?' + params.toString(),
            {
                cache:'no-store'
            }
        );

    const j =
        await r.json();

    if (
        !j.ok ||
        !Array.isArray(j.items)
    ) {
        throw new Error(
            'field unavailable'
        );
    }

    return j.items;
}

async function loadMore(){

    if (loading) return;

    loading = true;
    register.classList.add('on');

    try{

        let items =
            await requestFeed(cycleSeen);

        /*
         * Bag empty: reshuffle.
         * Keep the plate on screen out of the first draw.
         */
        if (
            !items.length &&
            cycleSeen.size
        ) {
            const last =
                Number(
                    activeItem &&
                    activeItem.dataset.id
                ) || 0;

            cycleSeen.clear();

            if (last) {
                cycleSeen.add(last);
            }

            items =
                await requestFeed(cycleSeen);
        }

        if (
            !items.length &&
            !feed.children.length
        ) {

            feed.innerHTML = `
                <div id="empty">
                    FEED∞ HAS NO MATERIAL<br>
                    /images/ awaits history
                </div>
            `;

            return;
        }

        for (const data of items) {

            cycleSeen.add(data.id);

            const item =
                buildItem(data);

            feed.appendChild(item);
            loadedIds.add(data.id);
            observeItem(item);

            /* Metatext lives on the sliding punchcard, not under the plate. */
        }

    }catch(e){

        console.error(e);

        register.textContent =
            'TEMPORAL LINK LOST';

        setTimeout(
            () => {
                register.textContent =
                    '○ ○ ● ○ ● ● ○ ● ○';
            },
            1800
        );

    }finally{

        loading = false;

        register.classList.remove(
            'on'
        );
    }
}


/* ============================================================
   SEMANTIC WORMHOLES
   ============================================================ */

function enterThread(thread){

    cycleSeen.clear();

    currentThread =
        thread;

    F.thread =
        thread;

    threadMode.textContent =
        `⌁ ${thread} ×`;

    threadMode.classList.add(
        'on'
    );

    /*
     * Remove future material.
     * Current encounter remains.
     */
    if (activeItem) {

        let n =
            activeItem.nextElementSibling;

        while(n){

            const next =
                n.nextElementSibling;

            n.remove();

            n = next;
        }
    }

    loadMore();
}

threadMode.addEventListener(
    'click',
    () => {

        currentThread = null;
        F.thread = null;
        cycleSeen.clear();

        threadMode.classList.remove(
            'on'
        );

        loadMore();
    }
);


/* ============================================================
   OBSERVATION
   ============================================================ */

const observer =
    new IntersectionObserver(
        entries => {

            for (const entry of entries) {

                const item =
                    entry.target;

                item._visibility =
                    entry.intersectionRatio;

                if (
                    entry.intersectionRatio >
                    .61
                ) {
                    activate(item);
                }
            }

        },
        {
            root: feed,
            threshold:[
                0,
                .15,
                .35,
                .61,
                .8,
                1
            ]
        }
    );

function observeItem(item){
    observer.observe(item);
}

function activate(item){

    if (
        activeItem === item
    ) return;

    /*
     * Complete previous encounter.
     */
    if (activeItem) {

        activeItem
            .classList
            .remove(
                'active',
                'awake'
            );

        sendEvent(
            'leave',
            activeItem
        );
    }

    activeItem =
        item;

    F.currentImage =
        Number(item.dataset.id);

    const src =
        item.dataset.src ||
        (item._data && item._data.src) ||
        '';

    item._visibleMs = 0;

    item._visitCount =
        (visits.get(
            F.currentImage
        ) || 0) + 1;

    visits.set(
        F.currentImage,
        item._visitCount
    );

    history.push(
        F.currentImage
    );

    item.classList.add(
        'active'
    );

    sendEvent(
        'enter',
        item
    );

    /*
     * The annotation does not immediately
     * assault grazing vision.
     *
     * It resolves when the eye stays.
     */
    setTimeout(
        () => {

            if (
                activeItem === item &&
                item._visibleMs > 750
            ) {
                item.classList.add(
                    'awake'
                );
            }

        },
        850
    );

    objectNo.textContent =
        '∞ ' +
        String(F.currentImage)
            .padStart(6,'0');

    const lensPort = document.getElementById('lensPort');
    const lensPlate = document.getElementById('lensPlate');
    const standing = String(
        (item._data && item._data.analysis && item._data.analysis.standing) || ''
    );
    if (lensPort) {
        if (standing === 'relevant') {
            lensPort.hidden = false;
            lensPort.href = '/now?lens=feed-' + encodeURIComponent(item.dataset.id);
            if (lensPlate) {
                lensPlate.src = item.dataset.src || '';
            }
        } else {
            lensPort.hidden = true;
        }
    }

    /*
     * Send image into archive surface.
     */
    if (src) {
        GL.setImage(src, item._data);
    }

    /*
     * Maintain finite DOM while feed remains infinite.
     */
    trimFeed();

    /*
     * Grazing ahead.
     */
    const plates = [
        ...feed.querySelectorAll('.feed-item')
    ];

    if (
        item.classList.contains('feed-item') &&
        item === plates[plates.length - 2]
    ) {
        loadMore();
    }
}


/* ============================================================
   DOM RETENTION
   ============================================================ */

function trimFeed(){

    while (
        feed.children.length >
        36
    ) {

        const first =
            feed.firstElementChild;

        if (
            !first ||
            first === activeItem
        ) {
            break;
        }

        observer.unobserve(first);

        loadedIds.delete(
            Number(first.dataset.id)
        );

        first.remove();
    }
}


/* ============================================================
   ATTENTION CLOCK
   ============================================================ */

let lastFrame =
    performance.now();

function fieldClock(now){

    const dt =
        Math.min(
            100,
            now - lastFrame
        );

    lastFrame = now;

    F.t = Date.now();

    if (activeItem) {

        activeItem._visibleMs += dt;

        F.visibleMs =
            activeItem._visibleMs;

        F.visibility =
            activeItem._visibility;

        /*
         * Attention is not identity
         * and not a psychological diagnosis.

         * It is a transient encounter signal.
         */
        const dwell =
            Math.min(
                1,
                activeItem._visibleMs /
                6500
            );

        const stillness =
            1 -
            Math.min(
                1,
                Math.abs(
                    F.scrollVelocity
                ) / 1800
            );

        const returnSignal =
            Math.min(
                1,
                (
                    activeItem._visitCount -
                    1
                ) / 2
            );

        F.attention =
            (
                dwell * .55 +
                stillness * .30 +
                returnSignal * .15
            );
    }

    /*
     * Pulse harmonic derived from encounter
     * until an external body signal exists.
     */
    F.pulse.phase +=
        dt *
        (
            .0006 +
            F.attention *
            .0004
        );

    F.pulse.harmonic =
        (
            Math.sin(
                F.pulse.phase *
                Math.PI *
                2
            ) +
            1
        ) / 2;

    /*
     * Chronometer hook.
     * Later replaced by actual Chronometer.
     */
    F.chronometer.phase =
        (
            (
                Date.now() %
                86400000
            ) /
            86400000
        );

    updateHUD();

    requestAnimationFrame(
        fieldClock
    );
}

requestAnimationFrame(
    fieldClock
);


/* ============================================================
   HUD
   ============================================================ */

function updateHUD(){

    const motion =
        Math.min(
            1,
            F.motionEnergy / 4
        );

    const field =
        Math.min(
            .99,
            (
                F.attention * .62 +
                motion * .18 +
                Math.min(
                    1,
                    Math.abs(
                        F.scrollAcceleration
                    ) / 6000
                ) * .20
            )
        );

    fieldReadout.innerHTML = [

        `FIELD ${field.toFixed(2)}`,

        F.thread
            ? `⌁ ${escapeHTML(F.thread)}`
            : '',

        `∆ ${(
            F.visibleMs /
            1000
        ).toFixed(1)}s`

    ].filter(Boolean)
     .join('<br>');

    const marks =
        Math.round(
            F.pulse.harmonic * 7
        );

    pulse.textContent =
        '◎ ' +
        '·'.repeat(
            Math.max(1,marks)
        ) +
        ' ' +
        (
            F.attention >
            .66
                ? 'HOLD'
                :
                'LOCAL'
        );

    paintTelemetry(field);
}


/* ============================================================
   TELEMETRY DOCK
   ============================================================ */

function telemRow(label, value){

    return (
        '<dt>' +
        escapeHTML(label) +
        '</dt><dd>' +
        escapeHTML(String(value)) +
        '</dd>'
    );
}

function paintTelemetry(field){

    if (
        !telemDock ||
        !telemDock.classList.contains('open') ||
        !telemLive
    ) {
        return;
    }

    const plate =
        F.currentImage
            ? String(F.currentImage)
                .padStart(6,'0')
            : '—';

    telemLive.innerHTML = [

        telemRow(
            'FIELD',
            Number(field || 0).toFixed(2)
        ),
        telemRow(
            'ATTENTION',
            Number(F.attention || 0).toFixed(2)
        ),
        telemRow(
            'MOTION',
            Number(F.motionEnergy || 0).toFixed(2)
        ),
        telemRow(
            'SCROLL LEN',
            Number(F.scrollLength || 0).toFixed(2)
        ),
        telemRow(
            'SCROLL V',
            Math.round(F.scrollVelocity || 0)
        ),
        telemRow(
            'TILT β / γ',
            Math.round(F.orientation.beta || 0) +
            ' / ' +
            Math.round(F.orientation.gamma || 0)
        ),
        telemRow(
            'DWELL',
            (Number(F.visibleMs || 0) / 1000)
                .toFixed(1) + 's'
        ),
        telemRow(
            'PULSE',
            Number(F.pulse.harmonic || 0).toFixed(2)
        ),
        telemRow(
            'PLATE',
            plate
        )

    ].join('');
}

function paintHouse(j){

    if (!telemHouse || !j) return;

    const types = j.types || {};

    telemHouse.innerHTML = [

        telemRow('PLATES', j.plates ?? 0),
        telemRow('ANALYSED', j.analysed ?? 0),
        telemRow('ENCOUNTERS', j.events ?? 0),
        telemRow(
            '  ENTER / LEAVE',
            (types.enter || 0) +
            ' / ' +
            (types.leave || 0)
        ),
        telemRow('SESSIONS', j.sessions ?? 0),
        telemRow('SEEN', j.seen ?? 0),
        telemRow(
            'DWELL Σ',
            Number(j.dwell_s || 0).toFixed(1) + 's'
        ),
        telemRow('RESIDUE', j.residue ?? 0),
        telemRow('MOTION AVG', j.motion_avg ?? 0),
        telemRow('LAST HOUR', j.hour ?? 0),
        telemRow(
            'LAST BUCKET',
            j.last_bucket || '—'
        ),
        telemRow(
            'WINDOW',
            (j.window_days || 7) + 'd'
        )

    ].join('');
}

let houseTimer = 0;

function pullHouse(){

    fetch(
        '?api=telemetry',
        {credentials:'same-origin'}
    )
        .then(r => r.json())
        .then(paintHouse)
        .catch(() => {});
}

function openTelem(){

    if (!telemDock || !telemBtn) return;

    telemDock.hidden = false;
    void telemDock.offsetWidth;
    telemDock.classList.add('open');
    telemBtn.setAttribute(
        'aria-expanded',
        'true'
    );
    pullHouse();
    if (houseTimer) {
        clearInterval(houseTimer);
    }
    houseTimer = setInterval(
        pullHouse,
        8000
    );
}

function closeTelem(){

    if (!telemDock || !telemBtn) return;

    telemDock.classList.remove('open');
    telemBtn.setAttribute(
        'aria-expanded',
        'false'
    );
    if (houseTimer) {
        clearInterval(houseTimer);
        houseTimer = 0;
    }
}

telemBtn && telemBtn.addEventListener(
    'click',
    () => {
        if (
            telemDock &&
            telemDock.classList.contains('open')
        ) {
            closeTelem();
        } else {
            openTelem();
        }
    }
);

telemClose && telemClose.addEventListener(
    'click',
    closeTelem
);


/* ============================================================
   WEBGL FIELD SURFACE
   ============================================================ */

const GL = (() => {

    const gl =
        canvas.getContext(
            'webgl',
            {
                alpha:true,
                antialias:false,
                premultipliedAlpha:true,
                powerPreference:
                    'high-performance'
            }
        );

    if (!gl) {

        document.body
            .classList
            .add('no-webgl');

        return {
            setImage(){},
            drop(){}
        };
    }


/* ------------------------------------------------------------
   SHADERS

   The image remains credible.

   This is not a psychedelic filter.

   Warp the weft.
   ------------------------------------------------------------ */

const vertexSource = `

attribute vec2 a_position;

varying vec2 v_uv;

void main(){

    v_uv =
        a_position * 0.5 + 0.5;

    gl_Position =
        vec4(
            a_position,
            0.0,
            1.0
        );
}
`;

const fragmentSource = `

precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_image;
uniform float u_time;
uniform float u_ready;
uniform float u_energy;
uniform float u_phase;
uniform float u_aspect;
uniform float u_imageAspect;
uniform vec4 u_item;
uniform vec4 u_drop0;
uniform vec4 u_drop1;
uniform vec3 u_hand;

/*
 * WARP THE WEFT.
 * The puddle: thumb-scroll rings, then refract the plate beneath.
 */
float ring(vec2 p, vec4 drop){

    float s =
        drop.w;

    if (s < 0.001) {
        return 0.0;
    }

    vec2 d =
        p - drop.xy;

    d.x *=
        u_aspect;

    float dist =
        length(d);

    float t =
        drop.z;

    float wave =
        sin(dist * 46.0 - t * 11.0);

    float envelope =
        exp(-dist * 2.6) *
        exp(-t * 1.12);

    return wave * envelope * s;
}

float height(vec2 p){

    vec2 loc =
        (p - u_item.xy) /
        max(u_item.zw, vec2(0.0001));

    float H =
        ring(p, u_drop0) +
        ring(p, u_drop1);

    H +=
        sin(
            loc.y * 22.0 -
            u_phase +
            sin(loc.x * 11.0) * 0.7
        ) *
        u_energy *
        0.44;

    H +=
        sin(loc.x * 8.0 + u_time * 1.05) *
        sin(loc.y * 10.0 - u_time * 0.72) *
        (0.06 + u_energy * 0.05);

    vec2 hand =
        p - u_hand.xy;

    hand.x *=
        u_aspect;

    H +=
        exp(-dot(hand, hand) * 42.0) *
        u_hand.z *
        (0.18 + u_energy * 0.22);

    return H;
}

vec2 coverUV(vec2 local){

    float pa =
        (u_item.z / max(u_item.w, 0.0001)) *
        u_aspect;

    float ia =
        max(u_imageAspect, 0.001);

    vec2 uv =
        local;

    if (ia > pa) {
        uv.x =
            (local.x - 0.5) * (pa / ia) +
            0.5;
    } else {
        uv.y =
            (local.y - 0.5) * (ia / pa) +
            0.5;
    }

    return clamp(uv, 0.002, 0.998);
}

void main(){

    vec2 local =
        (v_uv - u_item.xy) /
        max(u_item.zw, vec2(0.0001));

    if (
        local.x < 0.0 ||
        local.x > 1.0 ||
        local.y < 0.0 ||
        local.y > 1.0 ||
        u_ready < 0.02
    ) {
        gl_FragColor =
            vec4(0.0);
        return;
    }

    float e =
        0.0035;

    vec2 n =
        vec2(
            height(v_uv + vec2(e, 0.0)) -
            height(v_uv - vec2(e, 0.0)),
            height(v_uv + vec2(0.0, e)) -
            height(v_uv - vec2(0.0, e))
        );

    float ior =
        0.052 +
        u_energy * 0.09;

    vec2 bent =
        local +
        n * ior;

    vec2 ch =
        n *
        (0.011 + u_energy * 0.02);

    float r =
        texture2D(
            u_image,
            coverUV(bent + ch)
        ).r;

    float g =
        texture2D(
            u_image,
            coverUV(bent)
        ).g;

    float b =
        texture2D(
            u_image,
            coverUV(bent - ch)
        ).b;

    vec3 col =
        vec3(r, g, b);

    float h =
        height(v_uv);

    float spec =
        pow(
            max(0.0, 1.0 - abs(h) * 2.2),
            16.0
        );

    col +=
        vec3(0.70, 0.86, 1.0) *
        spec *
        (0.07 + u_energy * 0.18);

    col *=
        mix(
            vec3(0.90, 0.95, 1.0),
            vec3(1.0),
            0.82
        );

    float rim =
        min(
            min(local.x, 1.0 - local.x),
            min(local.y, 1.0 - local.y)
        );

    col *=
        0.94 +
        0.06 *
        smoothstep(0.0, 0.035, rim);

    gl_FragColor =
        vec4(
            col,
            u_ready
        );
}
`;


/* ------------------------------------------------------------
   COMPILE
   ------------------------------------------------------------ */

function shader(type,src){

    const s =
        gl.createShader(type);

    gl.shaderSource(
        s,
        src
    );

    gl.compileShader(s);

    if (
        !gl.getShaderParameter(
            s,
            gl.COMPILE_STATUS
        )
    ) {
        console.error(
            gl.getShaderInfoLog(s)
        );
    }

    return s;
}

const program =
    gl.createProgram();

gl.attachShader(
    program,
    shader(
        gl.VERTEX_SHADER,
        vertexSource
    )
);

gl.attachShader(
    program,
    shader(
        gl.FRAGMENT_SHADER,
        fragmentSource
    )
);

gl.linkProgram(program);
gl.useProgram(program);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(0, 0, 0, 0);


/* ------------------------------------------------------------
   QUAD
   ------------------------------------------------------------ */

const buffer =
    gl.createBuffer();

gl.bindBuffer(
    gl.ARRAY_BUFFER,
    buffer
);

gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
        -1,-1,
         1,-1,
        -1, 1,

        -1, 1,
         1,-1,
         1, 1
    ]),
    gl.STATIC_DRAW
);

const position =
    gl.getAttribLocation(
        program,
        'a_position'
    );

gl.enableVertexAttribArray(
    position
);

gl.vertexAttribPointer(
    position,
    2,
    gl.FLOAT,
    false,
    0,
    0
);


/* ------------------------------------------------------------
   UNIFORMS
   ------------------------------------------------------------ */

function U(name){
    return gl.getUniformLocation(
        program,
        name
    );
}

const uniforms = {

    image:
        U('u_image'),

    time:
        U('u_time'),

    ready:
        U('u_ready'),

    energy:
        U('u_energy'),

    phase:
        U('u_phase'),

    aspect:
        U('u_aspect'),

    imageAspect:
        U('u_imageAspect'),

    item:
        U('u_item'),

    drop0:
        U('u_drop0'),

    drop1:
        U('u_drop1'),

    hand:
        U('u_hand')
};


/* ------------------------------------------------------------
   TEXTURE
   ------------------------------------------------------------ */

const texture =
    gl.createTexture();

gl.bindTexture(
    gl.TEXTURE_2D,
    texture
);

gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR
);

gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    gl.LINEAR
);

gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_S,
    gl.CLAMP_TO_EDGE
);

gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_T,
    gl.CLAMP_TO_EDGE
);

let imageAspect = 1;
let ready = 0;
let targetReady = 0;

const drops = [
    {x:0.5, y:0.5, t:0, s:0},
    {x:0.5, y:0.5, t:0, s:0}
];

let dropI = 0;

function takeDrop(){

    const d =
        F.drop;

    if (!d) {
        return;
    }

    F.drop =
        null;

    drops[dropI] = {
        x: d.x,
        y: 1 - d.y,
        t: d.t || performance.now(),
        s: d.s
    };

    dropI =
        1 - dropI;
}

function dropVec(d, now){

    const age =
        d.s > 0
            ? (now - d.t) * 0.001
            : 9;

    const strength =
        age < 3
            ? d.s * Math.exp(-age * 0.35)
            : 0;

    return [
        d.x,
        d.y,
        age,
        strength
    ];
}

function setImage(src){

    targetReady = 0;
    ready = 0;

    document.body
        .classList
        .remove('puddle-ready');

    const img =
        new Image();

    img.decoding =
        'async';

    img.onload = () => {

        gl.bindTexture(
            gl.TEXTURE_2D,
            texture
        );

        gl.pixelStorei(
            gl.UNPACK_FLIP_Y_WEBGL,
            true
        );

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            img
        );

        imageAspect =
            img.naturalWidth /
            img.naturalHeight;

        ready = 0;
        targetReady = 1;

        document.body
            .classList
            .remove('puddle-ready');
    };

    img.src = src;
}


/* ------------------------------------------------------------
   RESIZE
   ------------------------------------------------------------ */

function resize(){

    const dpr =
        Math.min(
            devicePixelRatio || 1,
            2
        );

    const w =
        Math.floor(
            innerWidth * dpr
        );

    const h =
        Math.floor(
            innerHeight * dpr
        );

    if (
        canvas.width !== w ||
        canvas.height !== h
    ) {

        canvas.width = w;
        canvas.height = h;

        gl.viewport(
            0,
            0,
            w,
            h
        );
    }
}


/* ------------------------------------------------------------
   RENDER FIELD
   ------------------------------------------------------------ */

function render(time){

    resize();

    takeDrop();

    ready +=
        (
            targetReady -
            ready
        ) * .08;

    if (ready > 0.82) {
        document.body
            .classList
            .add('puddle-ready');
    } else {
        document.body
            .classList
            .remove('puddle-ready');
    }

    if (F.scrollLength) {
        F.scrollLength *= 0.992;
    }

    F.rippleEnergy *=
        0.965;

    F.touchLive *=
        0.94;

    const now =
        performance.now();

    let itemX = 0;
    let itemY = 0;
    let itemW = 1;
    let itemH = 1;

    if (activeItem) {

        const r =
            activeItem
                .getBoundingClientRect();

        itemX =
            r.left / innerWidth;

        itemY =
            1 - r.bottom / innerHeight;

        itemW =
            r.width / innerWidth;

        itemH =
            r.height / innerHeight;
    }

    const d0 =
        dropVec(drops[0], now);

    const d1 =
        dropVec(drops[1], now);

    gl.useProgram(program);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(
        uniforms.image,
        0
    );

    gl.uniform1f(
        uniforms.time,
        time * .001
    );

    gl.uniform1f(
        uniforms.ready,
        ready
    );

    gl.uniform1f(
        uniforms.energy,
        Math.min(
            1.5,
            (F.rippleEnergy || 0) +
            Math.min(0.35, (F.motionEnergy || 0) / 14)
        )
    );

    gl.uniform1f(
        uniforms.phase,
        F.ripplePhase || 0
    );

    gl.uniform1f(
        uniforms.aspect,
        innerWidth / Math.max(innerHeight, 1)
    );

    gl.uniform1f(
        uniforms.imageAspect,
        imageAspect
    );

    gl.uniform4f(
        uniforms.item,
        itemX,
        itemY,
        itemW,
        itemH
    );

    gl.uniform4f(
        uniforms.drop0,
        d0[0],
        d0[1],
        d0[2],
        d0[3]
    );

    gl.uniform4f(
        uniforms.drop1,
        d1[0],
        d1[1],
        d1[2],
        d1[3]
    );

    gl.uniform3f(
        uniforms.hand,
        F.touchX || 0.5,
        1 - (F.touchY || 0.48),
        F.touchLive || 0
    );

    gl.drawArrays(
        gl.TRIANGLES,
        0,
        6
    );

    requestAnimationFrame(
        render
    );
}

requestAnimationFrame(
    render
);

return {
    setImage
};

})();


/* ============================================================
   DEPARTURE
   ============================================================ */

addEventListener(
    'pagehide',
    () => {

        if (activeItem) {
            sendEvent(
                'leave',
                activeItem
            );
        }
    }
);


/* ============================================================
   INITIALISE
   ============================================================ */

loadMore();


/* ============================================================
   JACK'S FUTURE PORTS

   window.FEED_FIELD.chronometer = {
       jd,
       lst,
       phase,
       aspects:[]
   };

   window.FEED_FIELD.map = {
       lat,
       lon,
       heading
   };

   window.FEED_FIELD.magnetic = {
       magnitude,
       heading
   };

   Any future instrument writes into the same field.

   FEED∞ remains the aperture.
   ============================================================ */

})();
</script>

</body>
</html>
