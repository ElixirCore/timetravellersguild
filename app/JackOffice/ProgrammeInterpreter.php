<?php
declare(strict_types=1);

/**
 * Finite clerical interpreter. Not PHP, JS, SQL, or a shell.
 * Every mutation goes through OfficeDispatcher.
 */
final class ProgrammeInterpreter
{
    public const FORBIDDEN_WRITE = ['LEDGER'];

    public static function resolveStation(string $raw): string
    {
        $id = OfficePath::recordId($raw);
        if ($id !== '' && OfficeConfig::isStationId($id)) {
            $name = OfficeConfig::stationName($id);
            return $name !== '' ? $id : '';
        }
        $norm = str_replace('_', '-', strtoupper(trim($raw)));
        if (in_array($norm, OfficeConfig::STATIONS, true)) {
            return OfficeConfig::stationId($norm);
        }
        return '';
    }

    /**
     * @param array<string, mixed> $programme
     * @return array<string, mixed>
     */
    public static function preview(array $programme, OfficeStore $store): array
    {
        return self::execute($programme, $store, null, true);
    }

    /**
     * @param array<string, mixed> $programme
     * @return array<string, mixed>
     */
    public static function run(array $programme, OfficeDispatcher $office): array
    {
        return self::execute($programme, $office->store, $office, false);
    }

    /**
     * @param array<string, mixed> $programme
     * @return array<string, mixed>
     */
    private static function execute(array $programme, OfficeStore $store, ?OfficeDispatcher $office, bool $dry): array
    {
        $v = ProgrammeManifest::validate($programme['manifest'] ?? null);
        if ($v['ok'] !== true) {
            return ['ok' => false, 'error' => $v['error'] ?? 'invalid_manifest', 'would' => [], 'did' => []];
        }
        /** @var array<string, mixed> $man */
        $man = $v['manifest'];
        $pid = (string) ($programme['id'] ?? '');
        if (!$dry && empty($programme['enabled'])) {
            return ['ok' => false, 'error' => 'not_enabled', 'would' => [], 'did' => []];
        }
        if (!$dry && !self::intervalOk($programme, $man)) {
            return ['ok' => false, 'error' => 'too_soon', 'would' => [], 'did' => [], 'next_eligible_at' => self::nextEligible($programme, $man)];
        }

        $matched = self::select($man, $store, $programme);
        $would = [];
        $did = [];
        foreach ($man['actions'] as $action) {
            if (!is_array($action)) continue;
            $type = (string) ($action['type'] ?? '');
            $dest = self::resolveStation((string) ($action['destination_station'] ?? ''));
            $plan = self::planAction($type, $dest, $matched, $programme);
            $would[] = $plan;
            if ($dry) continue;
            if ($office === null) {
                return ['ok' => false, 'error' => 'rejected', 'would' => $would, 'did' => []];
            }
            foreach ($plan['calls'] as $call) {
                $name = (string) ($call['name'] ?? '');
                $args = is_array($call['args'] ?? null) ? $call['args'] : [];
                if ($name === 'enable_programme' || $name === 'disable_programme' || $name === 'run_programme') {
                    $did[] = ['ok' => false, 'error' => 'self_modification', 'action' => $type];
                    continue;
                }
                if (isset($args['record_id']) && (string) $args['record_id'] === $pid) {
                    $did[] = ['ok' => false, 'error' => 'self_modification', 'action' => $type];
                    continue;
                }
                $result = $office->dispatch($name, $args);
                $did[] = [
                    'action' => $type,
                    'tool' => $name,
                    'ok' => !empty($result['ok']),
                    'id' => $result['id'] ?? null,
                    'error' => $result['error'] ?? null,
                ];
            }
        }

        $matchedPublic = [];
        foreach ($matched as $rec) {
            $matchedPublic[] = [
                'id' => (string) ($rec['id'] ?? ''),
                'display_name' => (string) ($rec['display_name'] ?? ''),
                'kind' => (string) ($rec['kind'] ?? ''),
            ];
        }

        return [
            'ok' => true,
            'enabled' => !empty($programme['enabled']),
            'dry' => $dry,
            'authority' => 'interpret_only',
            'matched' => $matchedPublic,
            'would' => $would,
            'did' => $did,
            'result' => $dry ? 'preview' : 'ran',
        ];
    }

    /**
     * @param array<string, mixed> $programme
     * @param array<string, mixed> $man
     */
    public static function intervalOk(array $programme, array $man): bool
    {
        $hours = (int) ($man['trigger']['minimum_interval_hours'] ?? 0);
        if ($hours <= 0) return true;
        $last = (string) ($programme['last_run_at'] ?? '');
        if ($last === '') return true;
        $t = strtotime($last);
        if ($t === false) return true;
        return (time() - $t) >= ($hours * 3600);
    }

    /**
     * @param array<string, mixed> $programme
     * @param array<string, mixed> $man
     */
    public static function nextEligible(array $programme, array $man): ?string
    {
        $hours = (int) ($man['trigger']['minimum_interval_hours'] ?? 0);
        $last = (string) ($programme['last_run_at'] ?? '');
        if ($hours <= 0 || $last === '') return null;
        $t = strtotime($last);
        if ($t === false) return null;
        return gmdate('c', $t + ($hours * 3600));
    }

    /**
     * @param array<string, mixed> $man
     * @param array<string, mixed> $programme
     * @return list<array<string, mixed>>
     */
    public static function select(array $man, OfficeStore $store, array $programme): array
    {
        $scope = $man['scope'] ?? [];
        $max = (int) ($scope['maximum_records'] ?? 33);
        if ($max < 1) $max = 1;
        if ($max > 33) $max = 33;
        $trigger = (string) ($man['trigger']['type'] ?? 'manual');
        $since = null;
        if ($trigger === 'on_new_record') {
            $since = (string) ($programme['last_run_at'] ?? $programme['created_at'] ?? '');
        }
        $pool = [];
        foreach ($scope['read_stations'] ?? [] as $raw) {
            if (!is_string($raw)) continue;
            $sid = self::resolveStation($raw);
            if ($sid === '') continue;
            if (OfficeConfig::stationName($sid) === 'LEDGER') continue;
            foreach ($store->inStation($sid, $max) as $rec) {
                $id = (string) ($rec['id'] ?? '');
                if ($id === '' || $id === (string) ($programme['id'] ?? '')) continue;
                $kind = (string) ($rec['kind'] ?? '');
                if ($kind === 'station' || $kind === 'programme') continue;
                if (!empty($rec['protected']) || !empty($rec['retired'])) continue;
                if ($since !== '' && $since !== null) {
                    $created = strtotime((string) ($rec['created_at'] ?? '')) ?: 0;
                    $cut = strtotime($since) ?: 0;
                    if ($created <= $cut) continue;
                }
                $pool[$id] = $rec;
            }
        }
        $conditions = is_array($man['conditions'] ?? null) ? $man['conditions'] : [];
        $matched = [];
        foreach ($pool as $rec) {
            if (self::matches($rec, $conditions)) {
                $matched[] = $rec;
            }
            if (count($matched) >= $max) break;
        }
        return $matched;
    }

    /**
     * @param array<string, mixed> $rec
     * @param list<mixed> $conditions
     */
    public static function matches(array $rec, array $conditions): bool
    {
        if ($conditions === []) return true;
        foreach ($conditions as $c) {
            if (!is_array($c)) return false;
            $type = (string) ($c['type'] ?? '');
            if ($type === 'contains_any_tag') {
                $want = self::tagList($c['values'] ?? []);
                $have = self::tagList($rec['tags'] ?? []);
                if (!self::anyOverlap($want, $have)) return false;
            } elseif ($type === 'contains_all_tags') {
                $want = self::tagList($c['values'] ?? []);
                $have = self::tagList($rec['tags'] ?? []);
                foreach ($want as $t) {
                    if (!in_array($t, $have, true)) return false;
                }
            } elseif ($type === 'record_type_is') {
                $want = strtolower((string) ($c['record_type'] ?? ''));
                if ($want === '' || strtolower((string) ($rec['kind'] ?? '')) !== $want) return false;
            } elseif ($type === 'older_than_days') {
                $days = (int) ($c['days'] ?? 0);
                $created = strtotime((string) ($rec['created_at'] ?? '')) ?: time();
                if ($days < 1 || (time() - $created) < ($days * 86400)) return false;
            } elseif ($type === 'unreviewed_for_days') {
                $days = (int) ($c['days'] ?? 0);
                $stamp = (string) ($rec['reviewed_at'] ?? $rec['updated_at'] ?? $rec['created_at'] ?? '');
                $t = strtotime($stamp) ?: time();
                if ($days < 1 || (time() - $t) < ($days * 86400)) return false;
            } else {
                return false;
            }
        }
        return true;
    }

    /**
     * @param mixed $values
     * @return list<string>
     */
    private static function tagList($values): array
    {
        $out = [];
        if (!is_array($values)) return $out;
        foreach ($values as $v) {
            $s = OfficePath::safeSlug((string) $v);
            if ($s !== '') $out[] = $s;
        }
        return $out;
    }

    /**
     * @param list<string> $a
     * @param list<string> $b
     */
    private static function anyOverlap(array $a, array $b): bool
    {
        foreach ($a as $t) {
            if (in_array($t, $b, true)) return true;
        }
        return false;
    }

    /**
     * Plan dispatcher calls. Titles and IDs only — never copy untrusted bodies.
     *
     * @param list<array<string, mixed>> $matched
     * @param array<string, mixed> $programme
     * @return array{action:string,destination_station:?string,note:string,calls:list<array{name:string,args:array<string,mixed>}>}
     */
    private static function planAction(string $type, string $dest, array $matched, array $programme): array
    {
        $name = (string) ($programme['display_name'] ?? 'Programme');
        $ids = [];
        $lines = [];
        foreach ($matched as $rec) {
            $id = (string) ($rec['id'] ?? '');
            if ($id === '') continue;
            $ids[] = $id;
            $lines[] = $id . ' ' . self::safeTitle((string) ($rec['display_name'] ?? ''));
        }
        $list = $lines === [] ? 'No matching records.' : implode("\n", array_slice($lines, 0, 33));
        $calls = [];
        $note = '';

        if ($type === 'write_digest') {
            $dest = $dest !== '' ? $dest : self::resolveStation('ACTIVE-DESKS');
            if (self::writable($dest) && $ids !== []) {
                $calls[] = [
                    'name' => 'write_note',
                    'args' => [
                        'folder_id' => $dest,
                        'title' => 'Digest: ' . $name,
                        'body' => "Programme digest. Interpret only. Not evidence. Not canon.\n" . $list,
                        'epistemic_status' => 'inferred',
                        'source_record_ids' => array_slice($ids, 0, 12),
                    ],
                ];
                $note = 'Write an inferred digest naming ' . count($ids) . ' record(s).';
            } else {
                $note = 'No digest: nothing matched, or destination is forbidden.';
            }
        } elseif ($type === 'propose_folder') {
            $dest = $dest !== '' ? $dest : self::resolveStation('ACTIVE-DESKS');
            if (self::writable($dest) && $ids !== []) {
                $calls[] = [
                    'name' => 'create_folder',
                    'args' => [
                        'parent_id' => $dest,
                        'display_name' => $name,
                        'reason' => 'Programme folder for ' . count($ids) . ' matching records. Not canon.',
                    ],
                ];
                $note = 'Propose one folder in the destination station.';
            } else {
                $note = 'No folder: nothing matched, or destination is forbidden.';
            }
        } elseif ($type === 'propose_link') {
            $dest = $dest !== '' ? $dest : self::resolveStation('CORRESPONDENCES');
            if (count($ids) >= 2) {
                $calls[] = [
                    'name' => 'link_records',
                    'args' => [
                        'from_record_id' => $ids[0],
                        'to_record_id' => $ids[1],
                        'relation' => 'correspondence',
                        'reason' => 'Programme correspondence. Records remain distinct.',
                    ],
                ];
                $note = 'Link the first two matching records. No merge.';
            } else {
                $note = 'No link: fewer than two matching records.';
            }
            unset($dest);
            $dest = self::resolveStation('CORRESPONDENCES');
        } elseif ($type === 'move_to_unclassified') {
            $un = self::resolveStation('UNCLASSIFIED');
            foreach (array_slice($ids, 0, 8) as $id) {
                $calls[] = [
                    'name' => 'mark_unclassified',
                    'args' => [
                        'record_id' => $id,
                        'reason' => 'Programme moved this slip to UNCLASSIFIED.',
                    ],
                ];
            }
            $dest = $un;
            $note = $ids === [] ? 'Nothing to move.' : 'Move up to eight matching records to UNCLASSIFIED.';
        } elseif ($type === 'request_human_review') {
            $dest = self::resolveStation('OUT-TRAY');
            if ($ids !== []) {
                $calls[] = [
                    'name' => 'write_note',
                    'args' => [
                        'folder_id' => $dest,
                        'title' => 'Review: ' . $name,
                        'body' => "Human review requested. No external notification.\n" . $list,
                        'epistemic_status' => 'proposed',
                        'source_record_ids' => array_slice($ids, 0, 12),
                    ],
                ];
                $note = 'Lodge a review slip in OUT-TRAY. No mail is sent.';
            } else {
                $note = 'No review slip: nothing matched.';
            }
        } else {
            $note = 'Unknown action skipped.';
        }

        return [
            'action' => $type,
            'destination_station' => $dest !== '' ? $dest : null,
            'note' => $note,
            'calls' => $calls,
        ];
    }

    private static function writable(string $stationId): bool
    {
        if ($stationId === '') return false;
        $name = OfficeConfig::stationName($stationId);
        if ($name === '' || in_array($name, self::FORBIDDEN_WRITE, true)) return false;
        if (in_array($name, OfficeConfig::NO_CHILDREN, true)) return false;
        return true;
    }

    private static function safeTitle(string $title): string
    {
        $title = preg_replace('/\s+/u', ' ', $title) ?? $title;
        $title = preg_replace('/[\x00-\x1f]/', '', $title) ?? $title;
        if (function_exists('mb_strlen') && mb_strlen($title) > 80) {
            return mb_substr($title, 0, 79) . '…';
        }
        return strlen($title) > 80 ? substr($title, 0, 79) . '…' : $title;
    }
}
