<?php
declare(strict_types=1);

/** Filesystem boundary for the PHP development server. Apache uses .htaccess. */
final class PublicPath
{
    public static function denied(string $uri): bool
    {
        if (str_contains($uri, "\0") || str_contains($uri, '\\') || str_contains($uri, '%')) return true;
        if (preg_match('#(?:^|/)\.{1,2}(?:/|$)#', $uri)) return true;
        if (preg_match('#(?:^|/)\.(?!well-known(?:/|$))#i', $uri)) return true;
        if (preg_match('#(?:^|/)(app|inc|prompts|storage|graph|lore|tests|private|logs?|feed-data)(?:/|$)#i', $uri)) return true;
        // Only these data files are consumed directly by the browser.
        if (preg_match('#(?:^|/)data(?:/|$)#i', $uri)
            && !in_array($uri, ['/jack/body/data/room.json', '/jack/room/data/room.json'], true)) return true;
        if (preg_match('#(?:^|/)(error_log|router\.php)(?:/|$)#i', $uri)) return true;
        return (bool) preg_match('#\.(?:sqlite(?:3)?(?:-(?:wal|shm|journal))?|db|log|jsonl|ini|bak|zip|sql)(?:/|$)#i', $uri);
    }

    /** Return only a canonical path within the supplied root, never a prefix sibling. */
    public static function resolve(string $root, string $uri): string|false
    {
        if (self::denied($uri)) return false;
        $root = realpath($root);
        if ($root === false) return false;
        $file = realpath($root . '/' . ltrim($uri, '/'));
        if ($file === false) return false;
        if ($file !== $root && !str_starts_with($file, $root . DIRECTORY_SEPARATOR)) return false;
        $canonicalUri = '/' . ltrim(substr($file, strlen($root)), DIRECTORY_SEPARATOR);
        return self::denied($canonicalUri) ? false : $file;
    }
}
