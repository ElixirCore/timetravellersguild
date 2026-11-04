<?php
declare(strict_types=1);

/**
 * Jack’s habitat. No secrets except key names.
 */
final class RoomConfig
{
    public const AXES = ['when', 'where', 'with', 'under'];

    public const KINDS = [
        'desk', 'slip', 'nest', 'correspondence', 'instrument', 'unclassified', 'keepsake',
    ];

    public const WHERE = [
        'desk', 'office', 'station', 'valley', 'cardiff', 'elsewhen', 'nest',
    ];

    public const WITH = [
        'clerk', 'keeper', 'visitor', 'oracle', 'none',
    ];

    public const UNDER = [
        'open', 'keeper', 'private', 'drifting',
    ];

    public const DESK_ID = 'jobj_desk_hollerith';
    public const NEST_ID = 'jobj_nest_lining';

    public const BOXES = 1000;
    public const WRITE_INTERVAL_SECONDS = 180;
    public const MAX_OBJECTS = 1004;
    public const MAX_DRIFTING = 2;
    public const MAX_TITLE = 80;
    public const CARD_COLS = 80;
    public const KEEPER_NEAR_SECONDS = 604800;
    public const YEAR_MIN = 1000;
    public const YEAR_MAX = 2999;

    public static function boxNumber(mixed $raw): int
    {
        if (is_int($raw)) {
            $n = $raw;
        } elseif (is_string($raw) && preg_match('/^\d{1,4}$/', trim($raw))) {
            $n = (int) trim($raw);
        } else {
            throw new InvalidArgumentException('invalid_box');
        }
        if ($n < 1 || $n > self::BOXES) {
            throw new InvalidArgumentException('invalid_box');
        }
        return $n;
    }

    public static function boxLabel(int $n): string
    {
        return 'BOX ' . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }

    public static function root(): string
    {
        $explicit = function_exists('ttg_env') ? ttg_env('JACK_ROOM_ROOT') : '';
        if ($explicit !== '') {
            return rtrim($explicit, '/');
        }
        $home = getenv('HOME');
        if (is_string($home) && $home !== '') {
            $priv = rtrim($home, '/') . '/ttg-private/jack-room';
            if (self::usable($priv) || self::creatable(dirname($priv))) {
                return $priv;
            }
        }
        return dirname(__DIR__, 2) . '/storage/jack-room';
    }

    public static function usable(string $dir): bool
    {
        return is_dir($dir) && is_writable($dir);
    }

    public static function creatable(string $parent): bool
    {
        return is_dir($parent) && is_writable($parent);
    }

    public static function isKind(string $kind): bool
    {
        return in_array($kind, self::KINDS, true);
    }

    public static function isAxis(string $axis): bool
    {
        return in_array($axis, self::AXES, true);
    }
}
