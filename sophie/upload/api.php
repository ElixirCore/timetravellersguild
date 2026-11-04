<?php
/**
 * Upload station API. Every call needs a signed-in session and, for anything
 * that changes state, the CSRF token in the X-Sophie-Token header.
 *
 *   GET  ?a=list                         → { posts }
 *   POST ?a=upload   (multipart: photo, caption, batch, idx) → { post, index }
 *   POST ?a=caption  { id, caption }     → { post }
 *   POST ?a=delete   { id }              → { ok }
 *   POST ?a=reorder  { ids: [...] }      → { posts }
 *   POST ?a=logout                       → { ok }
 */
declare(strict_types=1);
define('SOPHIE_PUBLIC', dirname(__DIR__));
require (getenv('SOPHIE_DATA') ?: dirname(__DIR__, 4) . '/sophie-data') . '/lib.php';

ini_set('display_errors', '0');   // a stray notice must never corrupt the JSON
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $msg, int $code = 400): never { reply(['error' => $msg], $code); }

sophie_session();
if (!is_authed()) fail('Signed out — please unlock the station again.', 401);
session_write_close();   // don't hold the session lock while big uploads run in parallel

$a = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    if (!csrf_ok($_SERVER['HTTP_X_SOPHIE_TOKEN'] ?? null)) fail('This page went stale. Reload and try again.', 403);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $o = parse_url($origin);
        $host = ($o['host'] ?? '') . (isset($o['port']) ? ':' . $o['port'] : '');
        if (strcasecmp($host, $_SERVER['HTTP_HOST'] ?? '') !== 0) fail('Wrong origin.', 403);
    }
}

$body = [];
if ($method === 'POST' && str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
    $body = json_decode((string)file_get_contents('php://input'), true) ?: [];
}

try {
    switch ("$method $a") {
        case 'GET list':
            reply(['posts' => array_map('post_public', posts_load())]);

        case 'POST upload':
            upload();

        case 'POST caption':
            $id = (string)($body['id'] ?? '');
            $cap = clean_caption($body['caption'] ?? '');
            $post = posts_mutate(function (array &$posts) use ($id, $cap) {
                foreach ($posts as &$p) if ($p['id'] === $id) { $p['cap'] = $cap; return $p; }
                return null;
            });
            if (!$post) fail('That post has gone.', 404);
            reply(['post' => post_public($post)]);

        case 'POST delete':
            $id = (string)($body['id'] ?? '');
            $gone = posts_mutate(function (array &$posts) use ($id) {
                $before = count($posts);
                $posts = array_values(array_filter($posts, fn($p) => $p['id'] !== $id));
                return count($posts) < $before;
            });
            post_delete_files($id);
            reply(['ok' => true, 'deleted' => $gone]);

        case 'POST reorder':
            $ids = array_values(array_filter((array)($body['ids'] ?? []), 'is_string'));
            $posts = posts_mutate(function (array &$posts) use ($ids) {
                $byId = array_column($posts, null, 'id');
                $rank = array_flip($ids);
                // anything uploaded since the page last looked stays on top, in its own order
                $fresh = array_values(array_filter($posts, fn($p) => !isset($rank[$p['id']])));
                $known = array_values(array_filter(array_map(fn($id) => $byId[$id] ?? null, $ids)));
                $posts = array_merge($fresh, $known);
                return $posts;
            });
            reply(['posts' => array_map('post_public', $posts)]);

        case 'POST logout':
            sophie_session_destroy();
            reply(['ok' => true]);
    }
    fail('Unknown action.', 404);
} catch (UserError $e) {
    fail($e->getMessage(), 422);
} catch (Throwable $e) {
    error_log('[sophie] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fail('The server tripped over that one. Try again?', 500);
}

function upload(): never
{
    $f = $_FILES['photo'] ?? null;
    if (!$f) {
        // PHP drops the whole body silently when post_max_size is exceeded
        fail(($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 ? 'That file is larger than the server accepts.' : 'No photo arrived.', 413);
    }
    if (is_array($f['error'])) fail('One photo per request, please.');
    if ($f['error'] !== UPLOAD_ERR_OK) {
        $why = [
            UPLOAD_ERR_INI_SIZE => 'That file is larger than the server accepts.',
            UPLOAD_ERR_FORM_SIZE => 'That file is too large.',
            UPLOAD_ERR_PARTIAL => 'The upload was cut off part-way.',
            UPLOAD_ERR_NO_FILE => 'No photo arrived.',
        ][$f['error']] ?? 'The server could not store the upload.';
        fail($why, $f['error'] === UPLOAD_ERR_PARTIAL ? 400 : 413);
    }
    if (!is_uploaded_file($f['tmp_name'])) fail('No photo arrived.');

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) ?: '';
    $okMime = preg_match('#^image/(jpeg|png|webp|heic|heif|heic-sequence|heif-sequence|avif|gif|tiff)$#', $mime);
    $okExt = preg_match('/\.(jpe?g|png|webp|hei[cf]|avif|gif|tiff?)$/i', (string)$f['name']);
    // some finfo builds don't know HEIC yet and say octet-stream; let the decoder decide
    if (!$okMime && !($okExt && $mime === 'application/octet-stream')) fail("That doesn't look like a photo ($mime).", 415);

    $rec = process_image($f['tmp_name'], (string)$f['name']);
    $rec['cap'] = clean_caption($_POST['caption'] ?? '');
    $rec['batch'] = preg_replace('/[^a-z0-9]/i', '', (string)($_POST['batch'] ?? '')) ?: null;
    $rec['idx'] = (int)($_POST['idx'] ?? 0);

    try {
        $index = posts_mutate(function (array &$posts) use ($rec) {
            // Newest on top. Within one batch, files later in the selection
            // sit higher, whatever order they happen to finish uploading in.
            $at = 0;
            while ($at < count($posts) && $rec['batch'] && ($posts[$at]['batch'] ?? null) === $rec['batch'] && ($posts[$at]['idx'] ?? 0) > $rec['idx']) $at++;
            array_splice($posts, $at, 0, [$rec]);
            return $at;
        });
    } catch (Throwable $e) {
        post_delete_files($rec['id']);
        throw $e;
    }
    reply(['post' => post_public($rec), 'index' => $index]);
}

function sophie_session_destroy(): void
{
    sophie_session();
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => $p['samesite']]);
    session_destroy();
}
