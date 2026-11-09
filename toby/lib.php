<?php
/**
 * Toby — inner child access point. Self-contained feed library.
 * Same mechanics as the Guild's photo-feed pattern: posts live in data/posts.json,
 * images in m/ as -t/-m/-l webp triplets, config in data/config.json.
 */
declare(strict_types=1);

const TOBY_BASE = '/toby';
if (!defined('TOBY_PUBLIC')) define('TOBY_PUBLIC', __DIR__);
define('TOBY_DATA', TOBY_PUBLIC . '/data');
define('TOBY_MEDIA', TOBY_PUBLIC . '/m');

class UserError extends Exception {}

/* ----------------------------------------------------------------- setup */

function toby_bootstrap(): void
{
    foreach ([TOBY_DATA, TOBY_MEDIA] as $d) {
        if (!is_dir($d) && !mkdir($d, 0775, true)) throw new RuntimeException("Cannot create $d");
    }
    $deny = TOBY_DATA . '/.htaccess';
    if (!is_file($deny)) file_put_contents($deny, "Require all denied\nDeny from all\n");
    $idx = TOBY_DATA . '/index.html';
    if (!is_file($idx)) file_put_contents($idx, '');
    $cfg = TOBY_DATA . '/config.json';
    if (!is_file($cfg)) {
        file_put_contents($cfg, json_encode([
            'title' => 'Toby',
            'handle' => 'toby',
            'bio' => "inner child access point .;. anyone may look, only toby may add",
            'password_hash' => '',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    }
    if (!is_file(TOBY_DATA . '/posts.json')) file_put_contents(TOBY_DATA . '/posts.json', '[]', LOCK_EX);
    $mi = TOBY_MEDIA . '/.htaccess';
    if (!is_file($mi)) file_put_contents($mi, "Options -Indexes\n");
}

/* ----------------------------------------------------------------- config */

function toby_config(): array
{
    toby_bootstrap();
    $cfg = json_decode((string)file_get_contents(TOBY_DATA . '/config.json'), true);
    return is_array($cfg) ? $cfg + ['title' => 'Toby', 'handle' => 'toby', 'bio' => '', 'password_hash' => ''] : ['title' => 'Toby', 'handle' => 'toby', 'bio' => '', 'password_hash' => ''];
}

function config_write_hash(string $hash): void
{
    $cfg = toby_config();
    $cfg['password_hash'] = $hash;
    file_put_contents(TOBY_DATA . '/config.json', json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

/* ------------------------------------------------------------------ posts */

function posts_load(): array
{
    toby_bootstrap();
    $posts = json_decode((string)file_get_contents(TOBY_DATA . '/posts.json'), true);
    return is_array($posts) ? $posts : [];
}

/** Locked read-modify-write. The callback gets &$posts and its return value is returned. */
function posts_mutate(callable $fn)
{
    toby_bootstrap();
    $fp = fopen(TOBY_DATA . '/posts.json', 'c+');
    if (!$fp) throw new RuntimeException('Cannot open posts.json');
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $posts = json_decode($raw ?: '[]', true);
    if (!is_array($posts)) $posts = [];
    $out = $fn($posts);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(array_values($posts), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $out;
}

function post_public(array $p): array
{
    $src = [];
    foreach (['t', 'm', 'l'] as $k) {
        [$w, $h] = $p['sizes'][$k];
        $src[$k] = [TOBY_BASE . '/m/' . $p['id'] . '-' . $k . '.webp', $w, $h];
    }
    return [
        'id' => $p['id'], 'w' => $p['w'], 'h' => $p['h'], 'c' => $p['c'], 'lq' => $p['lq'],
        'cap' => $p['cap'] ?? '', 'at' => $p['at'], 'tk' => $p['tk'], 'src' => $src,
        'note' => $p['note'] ?? '', 'gloss' => $p['gloss'] ?? '', 'audio' => $p['audio'] ?? '',
    ];
}

function post_delete_files(string $id): void
{
    foreach (glob(TOBY_MEDIA . '/' . preg_replace('/[^a-z0-9-]/i', '', $id) . '-*.webp') ?: [] as $f) @unlink($f);
}

function clean_caption($cap): string
{
    $cap = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)$cap));
    return mb_strlen($cap) > 2200 ? mb_substr($cap, 0, 2200) : $cap;
}

/* ---------------------------------------------------------------- session */

function toby_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('TOBYSESSID');
    session_set_cookie_params(['lifetime' => 0, 'path' => TOBY_BASE . '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function csrf_token(): string
{
    toby_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
    return $_SESSION['csrf'];
}

function csrf_ok(?string $t): bool
{
    toby_session();
    return !empty($_SESSION['csrf']) && is_string($t) && hash_equals($_SESSION['csrf'], $t);
}

function hash_fingerprint(): string
{
    return hash('sha256', (string)toby_config()['password_hash']);
}

function is_authed(): bool
{
    toby_session();
    $hash = (string)toby_config()['password_hash'];
    return $hash !== '' && !empty($_SESSION['toby_ok'])
        && hash_equals((string)($_SESSION['toby_hash'] ?? ''), hash('sha256', $hash));
}

/* --------------------------------------------------------------- throttle */

function throttle_load(): array
{
    $f = TOBY_DATA . '/throttle.json';
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return is_array($d) ? $d : ['fails' => []];
}

function throttle_wait(): int
{
    $now = time();
    $fails = array_filter(throttle_load()['fails'] ?? [], fn($t) => $t > $now - 900);
    if (count($fails) < 5) return 0;
    $last = max($fails);
    return max(0, 60 - ($now - $last));
}

function throttle_record(bool $ok): void
{
    $now = time();
    $fails = $ok ? [] : array_values(array_filter(throttle_load()['fails'] ?? [], fn($t) => $t > $now - 900));
    if (!$ok) $fails[] = $now;
    file_put_contents(TOBY_DATA . '/throttle.json', json_encode(['fails' => $fails]), LOCK_EX);
}

/* ----------------------------------------------------------------- images */

function process_image(string $tmp, string $name): array
{
    toby_bootstrap();
    $id = date('Ymd') . '-' . bin2hex(random_bytes(6));
    if (class_exists('Imagick')) {
        try { return process_imagick($tmp, $id); } catch (UserError $e) { throw $e; } catch (Throwable $e) { /* fall through to GD */ }
    }
    return process_gd($tmp, $name, $id);
}

function size_targets(int $w, int $h): array
{
    $long = max($w, $h);
    $out = [];
    foreach (['t' => 640, 'm' => 1080, 'l' => 2048] as $k => $target) {
        $s = min(1, $target / $long);
        $out[$k] = [max(1, (int)round($w * $s)), max(1, (int)round($h * $s))];
    }
    return $out;
}

function process_imagick(string $tmp, string $id): array
{
    $img = new Imagick($tmp);
    $img->setIteratorIndex(0);
    switch ($img->getImageOrientation()) {
        case Imagick::ORIENTATION_RIGHTTOP:    $img->rotateImage('none', 90);  break;
        case Imagick::ORIENTATION_BOTTOMRIGHT: $img->rotateImage('none', 180); break;
        case Imagick::ORIENTATION_LEFTBOTTOM:  $img->rotateImage('none', 270); break;
    }
    $img->setImageOrientation(Imagick::ORIENTATION_TOPLEFT);
    $img->stripImage();   // drops EXIF incl. location
    if ($img->getImageColorspace() !== Imagick::COLORSPACE_SRGB) $img->transformImageColorspace(Imagick::COLORSPACE_SRGB);
    $w = $img->getImageWidth();
    $h = $img->getImageHeight();
    if ($w < 1 || $h < 1) throw new UserError('That image would not decode.');

    $sizes = size_targets($w, $h);
    foreach ($sizes as $k => [$tw, $th]) {
        $c = clone $img;
        if ($tw !== $w || $th !== $h) $c->resizeImage($tw, $th, Imagick::FILTER_LANCZOS, 1);
        $c->setImageFormat('webp');
        $c->setImageCompressionQuality(82);
        $c->writeImage(TOBY_MEDIA . "/$id-$k.webp");
        $c->destroy();
    }
    $lq = clone $img;
    $lq->thumbnailImage(18, 18);
    $lq->setImageFormat('webp');
    $lq->setImageCompressionQuality(42);
    $lqUri = 'data:image/webp;base64,' . base64_encode($lq->getImageBlob());
    $lq->destroy();
    $px = clone $img;
    $px->resizeImage(1, 1, Imagick::FILTER_BOX, 1);
    $rgb = $px->getImagePixelColor(0, 0)->getColor(true);
    $col = sprintf('#%02x%02x%02x', (int)round($rgb['r'] * 255), (int)round($rgb['g'] * 255), (int)round($rgb['b'] * 255));
    $px->destroy();
    $img->destroy();
    return ['id' => $id, 'w' => $w, 'h' => $h, 'c' => $col, 'lq' => $lqUri, 'at' => time(), 'tk' => date('Y-m-d'), 'sizes' => $sizes];
}

function process_gd(string $tmp, string $name, string $id): array
{
    $info = @getimagesize($tmp);
    if (!$info) throw new UserError('That image would not decode.');
    $src = match ($info['mime']) {
        'image/jpeg' => @imagecreatefromjpeg($tmp),
        'image/png'  => @imagecreatefrompng($tmp),
        'image/webp' => @imagecreatefromwebp($tmp),
        'image/gif'  => @imagecreatefromgif($tmp),
        default      => false,
    };
    if (!$src) throw new UserError('This server can only take JPG, PNG, WebP or GIF right now.');
    if ($info['mime'] === 'image/jpeg' && function_exists('exif_read_data')) {
        $ex = @exif_read_data($tmp);
        switch ((int)($ex['Orientation'] ?? 1)) {
            case 3: $src = imagerotate($src, 180, 0); break;
            case 6: $src = imagerotate($src, -90, 0); break;
            case 8: $src = imagerotate($src, 90, 0); break;
        }
    }
    $w = imagesx($src);
    $h = imagesy($src);
    $sizes = size_targets($w, $h);
    foreach ($sizes as $k => [$tw, $th]) {
        $d = imagescale($src, $tw, $th, IMG_BILINEAR_FIXED);
        imagewebp($d, TOBY_MEDIA . "/$id-$k.webp", 82);
        imagedestroy($d);
    }
    $lq = imagescale($src, 18, max(1, (int)round(18 * $h / $w)), IMG_BILINEAR_FIXED);
    ob_start(); imagewebp($lq, null, 42); $lqUri = 'data:image/webp;base64,' . base64_encode(ob_get_clean());
    imagedestroy($lq);
    $one = imagescale($src, 1, 1, IMG_BILINEAR_FIXED);
    $rgb = imagecolorat($one, 0, 0);
    $col = sprintf('#%02x%02x%02x', ($rgb >> 16) & 255, ($rgb >> 8) & 255, $rgb & 255);
    imagedestroy($one);
    imagedestroy($src);
    return ['id' => $id, 'w' => $w, 'h' => $h, 'c' => $col, 'lq' => $lqUri, 'at' => time(), 'tk' => date('Y-m-d'), 'sizes' => $sizes];
}

/* ------------------------------------------------------------------- misc */

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/** Goðen base-13: 0-9 ↊ ↋ ↈ */
function b13(int $n): string
{
    $A = preg_split('//u', '0123456789↊↋ↈ', -1, PREG_SPLIT_NO_EMPTY);
    if ($n === 0) return '0';
    $s = '';
    while ($n > 0) { $s = $A[$n % 13] . $s; $n = intdiv($n, 13); }
    return $s;
}

