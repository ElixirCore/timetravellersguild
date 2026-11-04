<?php
declare(strict_types=1);

/**
 * Derived plumage. Never a score. Never written by the model.
 */
final class JackSoul
{
    public const MAX_UNCLASSIFIED = 7;

    /**
     * @param array<string, mixed> $state
     * @return array{
     *   plumage:string,
     *   stamp:string,
     *   conditions:array<string,bool>,
     *   runtime:list<string>
     * }
     */
    public static function fromState(array $state): array
    {
        $withdrawn = !empty($state['withdrawn']);
        $mode = (string) ($state['mode'] ?? 'reception');
        $incident = $mode === 'incident';
        $disturbances = (int) ($state['disturbances'] ?? 0);
        $hasDesk = !empty($state['has_desk']);
        $drifting = (int) ($state['drifting_count'] ?? 0);
        $unclassified = (int) ($state['unclassified_count'] ?? 0);
        $promises = $state['promises'] ?? [];
        $promisesKept = !is_array($promises) || $promises === [];
        $keeperNear = !empty($state['keeper_near']);

        $nestLined = $hasDesk && $drifting <= RoomConfig::MAX_DRIFTING;
        $deskClear = $unclassified <= self::MAX_UNCLASSIFIED;
        $fieldQuiet = !$incident && $disturbances === 0;

        $conditions = [
            'nest_lined' => $nestLined,
            'desk_clear' => $deskClear,
            'promises_kept' => $promisesKept,
            'keeper_near' => $keeperNear,
            'field_quiet' => $fieldQuiet,
        ];

        if ($withdrawn || $incident) {
            $plumage = 'bare';
        } elseif ($disturbances > 0) {
            $plumage = 'molting';
        } elseif (!$nestLined || !$deskClear || !$promisesKept) {
            $plumage = 'ruffled';
        } elseif ($nestLined && $deskClear && $promisesKept && $keeperNear && $fieldQuiet) {
            $plumage = 'well_feathered';
        } else {
            $plumage = 'ruffled';
        }

        return [
            'plumage' => $plumage,
            'stamp' => self::stamp($plumage),
            'conditions' => $conditions,
            'runtime' => self::runtimeLines($plumage, $conditions),
        ];
    }

    /**
     * @param array<string, mixed> $relationship
     * @return array{plumage:string,stamp:string,conditions:array<string,bool>,runtime:list<string>}
     */
    public static function observe(?JackRoom $room, mixed $officeStore, array $relationship, string $mode): array
    {
        $hasDesk = $room ? $room->hasDesk() : false;
        $drifting = $room ? $room->driftingCount() : 99;
        $keeperNear = $room ? $room->store()->keeperNear() : false;

        $unclassified = 0;
        if (is_object($officeStore) && $officeStore instanceof OfficeStore) {
            try {
                $unclassified = count($officeStore->inStation(OfficeConfig::stationId('UNCLASSIFIED'), 33));
            } catch (Throwable $e) {
                $unclassified = 0;
            }
        }

        $withdrawn = class_exists('JackPolicy') && !JackPolicy::memoryConsented($relationship);
        $promises = is_array($relationship['promises'] ?? null) ? $relationship['promises'] : [];
        $disturbances = 0;
        if (class_exists('JackDisturbance')) {
            $disturbances = count(JackDisturbance::permitted($relationship));
        }

        return self::fromState([
            'has_desk' => $hasDesk,
            'drifting_count' => $drifting,
            'unclassified_count' => $unclassified,
            'promises' => $promises,
            'keeper_near' => $keeperNear,
            'mode' => $mode,
            'withdrawn' => $withdrawn,
            'disturbances' => $disturbances,
        ]);
    }

    /**
     * @param array<string, mixed> $relationship
     * @return array{plumage:string,stamp:string,conditions:array<string,bool>,runtime:list<string>}|null
     */
    public static function current(array $relationship, string $mode): ?array
    {
        try {
            $room = new JackRoom(new RoomStore());
        } catch (Throwable $e) {
            $room = null;
        }
        $office = null;
        if (class_exists('OfficeStore')) {
            try {
                $office = new OfficeStore();
                $office->boot();
            } catch (Throwable $e) {
                $office = null;
            }
        }
        return self::observe($room, $office, $relationship, $mode);
    }

    public static function stamp(string $plumage): string
    {
        return match ($plumage) {
            'well_feathered' => 'FEATHERED',
            'ruffled' => 'RUFFLED',
            'molting' => 'MOLTING',
            'bare' => 'BARE',
            default => 'RUFFLED',
        };
    }

    /**
     * @param array<string, bool> $conditions
     * @return list<string>
     */
    private static function runtimeLines(string $plumage, array $conditions): array
    {
        $spoken = match ($plumage) {
            'well_feathered' => 'well feathered',
            'ruffled' => 'ruffled',
            'molting' => 'molting',
            'bare' => 'bare',
            default => 'ruffled',
        };
        $detail = match ($plumage) {
            'well_feathered' => 'The nest is lined.',
            'ruffled' => !empty($conditions['nest_lined']) ? 'The desk is not clear.' : 'The nest is ruffled.',
            'molting' => 'A permitted disturbance is in the room.',
            'bare' => 'The field is not quiet, or consent is withheld.',
            default => 'The nest is ruffled.',
        };
        return [
            'Plumage: ' . $spoken . '. ' . $detail,
        ];
    }
}
