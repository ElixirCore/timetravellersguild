<?php
declare(strict_types=1);

/**
 * A voice sitting. The page mints one for the visitor in front of it; the
 * voice agent carries the token to /jack/llm, which arrives from ElevenLabs’
 * servers with no cookie. The token is an opaque id plus a signature: who the
 * visitor is stays on this server, never in the token.
 */
final class JackSitting
{
    public const TTL = 7200;
    public const MAX_TURNS = 120;

    public static function dir(): string
    {
        $env = function_exists('ttg_env') ? ttg_env('JACK_SITTING_ROOT') : '';
        return $env !== '' ? rtrim($env, '/') : dirname(__DIR__, 2) . '/storage/jack/sittings';
    }

    /**
     * @param array<string, mixed> $viewer
     */
    public static function mint(array $viewer, string $subject, string $site): string
    {
        $dir = self::dir();
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
            return '';
        }
        self::prune();
        $id = bin2hex(random_bytes(16));
        $row = [
            'id' => $id,
            'viewer' => $viewer,
            'subject' => $subject,
            'site' => self::site($site),
            'exp' => time() + self::TTL,
            'turns' => 0,
        ];
        $json = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || @file_put_contents($dir . '/' . $id . '.json', $json, LOCK_EX) === false) {
            return '';
        }
        return $id . '.' . self::sign($id);
    }

    /**
     * Resolve a token and count one turn against it.
     *
     * @return array{viewer:array,subject:string,site:string,turn:int}|null
     */
    public static function take(string $token): ?array
    {
        if (!preg_match('/^([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/', trim($token), $m)) {
            return null;
        }
        $key = self::key();
        if ($key === '' || !hash_equals(self::sign($m[1]), $m[2])) {
            return null;
        }
        $path = self::dir() . '/' . $m[1] . '.json';
        $fp = @fopen($path, 'c+');
        if ($fp === false) return null;
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return null;
        }
        $row = json_decode((string) stream_get_contents($fp), true);
        $ok = is_array($row) && (int) ($row['exp'] ?? 0) > time() && (int) ($row['turns'] ?? 0) < self::MAX_TURNS;
        if ($ok) {
            $row['turns'] = (int) $row['turns'] + 1;
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, (string) json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }
        flock($fp, LOCK_UN);
        fclose($fp);
        if (!$ok) {
            if (is_array($row) && (int) ($row['exp'] ?? 0) <= time()) @unlink($path);
            return null;
        }
        return [
            'viewer' => is_array($row['viewer'] ?? null) ? $row['viewer'] : [],
            'subject' => (string) ($row['subject'] ?? ''),
            'site' => (string) ($row['site'] ?? 'intro'),
            'turn' => (int) $row['turns'],
        ];
    }

    private static function site(string $site): string
    {
        $site = strtolower(trim($site));
        return preg_match('/^[a-z]{1,16}$/', $site) ? $site : 'intro';
    }

    private static function sign(string $id): string
    {
        $raw = hash_hmac('sha256', 'jack-sitting|' . $id, self::key(), true);
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    /** JACK_SITTING_SECRET, or a key generated once beside the sittings. */
    private static function key(): string
    {
        static $key = null;
        if (is_string($key)) return $key;
        $env = function_exists('ttg_env') ? ttg_env('JACK_SITTING_SECRET') : '';
        if (strlen($env) >= 32) {
            return $key = $env;
        }
        $file = self::dir() . '/.key';
        $held = @file_get_contents($file);
        if (is_string($held) && strlen(trim($held)) >= 32) {
            return $key = trim($held);
        }
        if (!is_dir(self::dir()) && !@mkdir(self::dir(), 0775, true)) {
            return $key = '';
        }
        $fresh = bin2hex(random_bytes(32));
        if (@file_put_contents($file, $fresh, LOCK_EX) === false) {
            return $key = '';
        }
        @chmod($file, 0600);
        return $key = $fresh;
    }

    private static function prune(): void
    {
        if (random_int(1, 20) !== 1) return;
        foreach (glob(self::dir() . '/*.json') ?: [] as $f) {
            if (@filemtime($f) < time() - self::TTL - 600) @unlink($f);
        }
    }
}
