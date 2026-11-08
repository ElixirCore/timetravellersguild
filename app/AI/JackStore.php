<?php
declare(strict_types=1);

/**
 * How Jack's records reach the disk. Two promises:
 *
 *   A file is always whole. A new copy is written beside it and swapped in with rename, so a crash leaves
 *   either the old version or the new one, never half of each. Readers need no lock.
 *
 *   A file that cannot be read is never written over. read() says null, the caller stops, and the damaged
 *   file stays exactly as it was for someone to repair.
 *
 * The swap replaces the file itself, so a lock on the file would be a lock on something about to vanish.
 * Writers lock a small companion file instead.
 */
final class JackStore
{
    /**
     * Run $fn while holding the exclusive lock for $path. Read and save inside it.
     * @return mixed what $fn returned, or null if the lock could not be had
     */
    public static function locked(string $path, callable $fn, ?string $lockPath = null): mixed
    {
        $dir = dirname($path);
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $lock = @fopen($lockPath ?? $path . '.lock', 'c');
        if ($lock === false) return null;
        try {
            if (!flock($lock, LOCK_EX)) return null;
            return $fn();
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** @return array<mixed>|null [] if nothing has been written yet; null if the file is there but cannot be read */
    public static function read(string $path): ?array
    {
        $raw = @file_get_contents($path);
        if ($raw === false) {
            if (!file_exists($path)) return [];
            error_log('Jack: ' . basename($path) . ' cannot be read; refusing to touch it.');
            return null;
        }
        if (trim($raw) === '') return [];
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
        error_log('Jack: ' . basename($path) . ' is damaged; refusing to touch it.');
        return null;
    }

    /** Replace $path whole. On any failure the existing file is left as it was. */
    public static function replace(string $path, string $contents): bool
    {
        $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
        $fp = @fopen($tmp, 'xb');
        if ($fp === false) return false;
        $written = fwrite($fp, $contents) === strlen($contents) && fflush($fp);
        if ($written && function_exists('fsync')) @fsync($fp);
        fclose($fp);
        if ($written && is_file($path)) @chmod($tmp, fileperms($path) & 0777);
        if (!$written || !@rename($tmp, $path)) {
            @unlink($tmp);
            return false;
        }
        return true;
    }

    public static function saveJson(string $path, array $data, int $flags = 0): bool
    {
        $json = json_encode($data, $flags);
        return is_string($json) && self::replace($path, $json . "\n");
    }
}
