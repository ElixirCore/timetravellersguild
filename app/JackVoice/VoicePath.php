<?php
declare(strict_types=1);

/**
 * Cache path safety. The model never supplies a filesystem path.
 */
final class VoicePath
{
    public static function join(string $root, string $rel): string
    {
        $rel = ltrim(str_replace('\\', '/', $rel), '/');
        if ($rel === '' || str_contains($rel, "\0") || str_contains($rel, '..')) {
            throw new InvalidArgumentException('path_rejected');
        }
        if (preg_match('/[\\x00-\\x1f]/', $rel) || str_contains($rel, '/')) {
            throw new InvalidArgumentException('path_rejected');
        }
        return rtrim($root, '/') . '/' . $rel;
    }

    public static function assertInside(string $root, string $path): string
    {
        $rootReal = realpath($root);
        if ($rootReal === false) {
            throw new RuntimeException('voice_root_missing');
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
        if (!preg_match('/^[a-f0-9]{64}\\.mp3$/', $base)) {
            throw new InvalidArgumentException('path_rejected');
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
}
