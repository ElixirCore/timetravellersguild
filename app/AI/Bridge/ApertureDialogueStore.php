<?php
declare(strict_types=1);

/**
 * Aperture turns. JSON ledger on this host. Not MariaDB. Not canon.
 */
final class ApertureDialogueStore
{
    public static function file(): string
    {
        return dirname(__DIR__, 3) . '/storage/jack/aperture-dialogues.json';
    }

    /** @return list<array<string, mixed>> */
    public static function all(): array
    {
        $path = self::file();
        if (!is_file($path)) return [];
        $raw = @file_get_contents($path);
        $data = is_string($raw) ? json_decode($raw, true) : [];
        return is_array($data) ? $data : [];
    }

    /** @param array<string, mixed> $row */
    public static function append(array $row): bool
    {
        $dir = dirname(self::file());
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) return false;
        $path = self::file();
        $fp = @fopen($path, 'c+');
        if ($fp === false) return false;
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return false;
        }
        rewind($fp);
        $raw = stream_get_contents($fp);
        $list = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
        if (!is_array($list)) $list = [];
        $list[] = $row;
        if (count($list) > 200) {
            $list = array_slice($list, -200);
        }
        $json = json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            flock($fp, LOCK_UN);
            fclose($fp);
            return false;
        }
        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, $json . "\n");
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
    }
}
