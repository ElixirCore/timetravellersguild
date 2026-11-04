<?php
declare(strict_types=1);

/**
 * Path safety. The model never supplies a filesystem path.
 */
final class OfficePath
{
    public static function safeSlug(string $raw): string
    {
        $raw = strtolower(trim($raw));
        if ($raw === '' || str_contains($raw, "\0") || str_contains($raw, '%')) {
            return '';
        }
        if (preg_match('/[\/\\\\.:]|\\.\\./', $raw)) {
            return '';
        }
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,62}$/', $raw)) {
            return '';
        }
        if (str_contains($raw, '--')) {
            return '';
        }
        return $raw;
    }

    public static function recordId(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '' || str_contains($raw, "\0") || str_contains($raw, '/') || str_contains($raw, '\\')) {
            return '';
        }
        if (OfficeConfig::isStationId($raw)) {
            return $raw;
        }
        if (!preg_match('/^jrec_[a-f0-9]{16}$/', $raw)) {
            return '';
        }
        return $raw;
    }

    public static function mintRecordId(): string
    {
        return 'jrec_' . bin2hex(random_bytes(8));
    }

    public static function join(string $root, string $rel): string
    {
        $rel = ltrim(str_replace('\\', '/', $rel), '/');
        if ($rel === '' || str_contains($rel, "\0") || str_contains($rel, '..')) {
            throw new InvalidArgumentException('path_rejected');
        }
        if (preg_match('/[\\x00-\\x1f]/', $rel)) {
            throw new InvalidArgumentException('path_rejected');
        }
        return rtrim($root, '/') . '/' . $rel;
    }

    public static function assertInside(string $root, string $path): string
    {
        $rootReal = realpath($root);
        if ($rootReal === false) {
            throw new RuntimeException('office_root_missing');
        }
        if (is_link($path)) {
            throw new InvalidArgumentException('symlink_rejected');
        }
        $parent = dirname($path);
        $parentReal = is_dir($parent) ? realpath($parent) : false;
        if ($parentReal === false) {
            throw new InvalidArgumentException('path_rejected');
        }
        if (!str_starts_with($parentReal, $rootReal)) {
            throw new InvalidArgumentException('path_rejected');
        }
        $base = basename($path);
        if ($base === '' || $base === '.' || $base === '..') {
            throw new InvalidArgumentException('path_rejected');
        }
        if (preg_match('/\.(php|phtml|phar|cgi|exe|shtml|htaccess)$/i', $base)) {
            throw new InvalidArgumentException('executable_rejected');
        }
        $resolved = $parentReal . '/' . $base;
        if (is_link($resolved)) {
            throw new InvalidArgumentException('symlink_rejected');
        }
        if (is_file($resolved) || is_dir($resolved)) {
            $full = realpath($resolved);
            if ($full === false || !str_starts_with($full, $rootReal)) {
                throw new InvalidArgumentException('path_rejected');
            }
            if (is_link($full)) {
                throw new InvalidArgumentException('symlink_rejected');
            }
            return $full;
        }
        return $resolved;
    }

    public static function denyExecutableName(string $name): void
    {
        if (preg_match('/\.(php|phtml|phar|cgi|exe|shtml|js|htaccess)$/i', $name)) {
            throw new InvalidArgumentException('executable_rejected');
        }
        $mime = strtolower($name);
        if (str_contains($mime, 'application/x-httpd-php') || str_contains($mime, 'text/x-php')) {
            throw new InvalidArgumentException('executable_rejected');
        }
    }
}
