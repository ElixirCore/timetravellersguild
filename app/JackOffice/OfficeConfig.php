<?php
declare(strict_types=1);

/**
 * Office configuration. No secrets in return values except the key names.
 */
final class OfficeConfig
{
    public const STATIONS = [
        'IN-TRAY', 'ACTIVE-DESKS', 'PERSONS', 'PLACES', 'UNCLASSIFIED',
        'CORRESPONDENCES', 'PROGRAMMES', 'DREAMS', 'PRIVATE-NOTES',
        'OUT-TRAY', 'QUARANTINE', 'RETIRED', 'LEDGER',
    ];

    public const NO_CHILDREN = ['LEDGER'];

    public const EPISTEMIC = [
        'observed', 'reported', 'inferred', 'associative', 'proposed',
    ];

    public const MAX_TOOL_CALLS = 13;
    public const MAX_FOLDERS_PER_TURN = 3;
    public const MAX_NOTE_BYTES = 65536;
    public const MAX_MANIFEST_BYTES = 8192;
    public const MAX_DREAM_SOURCES = 33;
    public const MAX_DREAM_BYTES = 32768;
    public const MAX_LIST = 40;
    public const RATE_PER_HOUR = 60;

    public static function root(): string
    {
        $explicit = ttg_env('JACK_OFFICE_ROOT');
        if ($explicit !== '') {
            return rtrim($explicit, '/');
        }
        $home = getenv('HOME');
        if (is_string($home) && $home !== '') {
            $priv = rtrim($home, '/') . '/ttg-private/jack-office';
            if (self::usable($priv) || self::creatable(dirname($priv))) {
                return $priv;
            }
        }
        $fallback = dirname(__DIR__, 2) . '/storage/jack-office';
        return $fallback;
    }

    public static function usable(string $dir): bool
    {
        return is_dir($dir) && is_writable($dir);
    }

    public static function creatable(string $parent): bool
    {
        return is_dir($parent) && is_writable($parent);
    }

    public static function stationId(string $station): string
    {
        return 'jsta_' . str_replace('-', '_', strtoupper($station));
    }

    public static function stationName(string $id): string
    {
        if (!str_starts_with($id, 'jsta_')) return '';
        return str_replace('_', '-', substr($id, 5));
    }

    public static function isStationId(string $id): bool
    {
        $name = self::stationName($id);
        return $name !== '' && in_array($name, self::STATIONS, true);
    }

    public static function maxNoteBytes(): int
    {
        $n = (int) ttg_env('JACK_OFFICE_MAX_NOTE_BYTES', (string) self::MAX_NOTE_BYTES);
        return $n > 0 ? $n : self::MAX_NOTE_BYTES;
    }
}
