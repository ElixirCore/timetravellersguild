<?php
declare(strict_types=1);

final class ProgrammeManifest
{
    public const TRIGGERS = ['manual', 'manual_or_nightly', 'on_new_record'];
    public const CONDITIONS = ['contains_any_tag', 'contains_all_tags', 'record_type_is', 'older_than_days', 'unreviewed_for_days'];
    public const ACTIONS = ['propose_folder', 'propose_link', 'write_digest', 'move_to_unclassified', 'request_human_review'];

    /**
     * @param mixed $manifest
     * @return array{ok:bool,error?:string,manifest?:array<string, mixed>}
     */
    public static function validate($manifest): array
    {
        if (!is_array($manifest)) return ['ok' => false, 'error' => 'invalid_manifest'];
        $raw = json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($raw === false || strlen($raw) > OfficeConfig::MAX_MANIFEST_BYTES) {
            return ['ok' => false, 'error' => 'manifest_too_large'];
        }
        $blob = strtolower($raw);
        if (preg_match('/https?:\/\/|javascript:|<\?php|eval\s*\(|shell_exec|passthru|proc_open/', $blob)) {
            return ['ok' => false, 'error' => 'manifest_forbidden'];
        }
        foreach (['schema_version', 'display_name', 'purpose', 'trigger', 'scope', 'conditions', 'actions', 'authority'] as $k) {
            if (!array_key_exists($k, $manifest)) return ['ok' => false, 'error' => 'invalid_manifest'];
        }
        foreach (array_keys($manifest) as $k) {
            if (!in_array($k, ['schema_version', 'display_name', 'purpose', 'trigger', 'scope', 'conditions', 'actions', 'authority'], true)) {
                return ['ok' => false, 'error' => 'unknown_field'];
            }
        }
        if ((int) $manifest['schema_version'] !== 1) return ['ok' => false, 'error' => 'invalid_manifest'];
        if (($manifest['authority'] ?? '') !== 'interpret_only') return ['ok' => false, 'error' => 'invalid_manifest'];
        $trigger = $manifest['trigger'] ?? null;
        if (!is_array($trigger) || !in_array((string) ($trigger['type'] ?? ''), self::TRIGGERS, true)) {
            return ['ok' => false, 'error' => 'invalid_manifest'];
        }
        foreach (array_keys($trigger) as $k) {
            if (!in_array($k, ['type', 'minimum_interval_hours'], true)) return ['ok' => false, 'error' => 'unknown_field'];
        }
        if (isset($trigger['minimum_interval_hours'])) {
            $h = $trigger['minimum_interval_hours'];
            if (is_string($h) && preg_match('/^\d+$/', $h)) $h = (int) $h;
            if (!is_int($h) || $h < 0 || $h > 8760) return ['ok' => false, 'error' => 'invalid_manifest'];
            $manifest['trigger']['minimum_interval_hours'] = $h;
        }
        $scope = $manifest['scope'] ?? null;
        if (!is_array($scope)) return ['ok' => false, 'error' => 'invalid_manifest'];
        foreach (array_keys($scope) as $k) {
            if (!in_array($k, ['read_stations', 'maximum_records'], true)) return ['ok' => false, 'error' => 'unknown_field'];
        }
        $stations = $scope['read_stations'] ?? [];
        if (!is_array($stations) || $stations === []) return ['ok' => false, 'error' => 'invalid_manifest'];
        foreach ($stations as $s) {
            if (!is_string($s)) return ['ok' => false, 'error' => 'invalid_manifest'];
            $norm = str_replace('_', '-', strtoupper($s));
            if (!in_array($norm, OfficeConfig::STATIONS, true) && !OfficeConfig::isStationId($s)) {
                return ['ok' => false, 'error' => 'invalid_manifest'];
            }
        }
        $max = (int) ($scope['maximum_records'] ?? 33);
        if ($max < 1 || $max > 33) return ['ok' => false, 'error' => 'invalid_manifest'];
        $manifest['scope']['maximum_records'] = $max;
        $conditions = $manifest['conditions'] ?? [];
        if (!is_array($conditions)) return ['ok' => false, 'error' => 'invalid_manifest'];
        foreach ($conditions as $c) {
            if (!is_array($c) || !in_array((string) ($c['type'] ?? ''), self::CONDITIONS, true)) {
                return ['ok' => false, 'error' => 'invalid_manifest'];
            }
            foreach (array_keys($c) as $k) {
                if (!in_array($k, ['type', 'values', 'days', 'record_type'], true)) return ['ok' => false, 'error' => 'unknown_field'];
            }
        }
        $actions = $manifest['actions'] ?? [];
        if (!is_array($actions) || $actions === []) return ['ok' => false, 'error' => 'invalid_manifest'];
        foreach ($actions as $a) {
            if (!is_array($a) || !in_array((string) ($a['type'] ?? ''), self::ACTIONS, true)) {
                return ['ok' => false, 'error' => 'invalid_manifest'];
            }
            foreach (array_keys($a) as $k) {
                if (!in_array($k, ['type', 'destination_station'], true)) return ['ok' => false, 'error' => 'unknown_field'];
            }
            if (isset($a['destination_station'])) {
                if (!is_string($a['destination_station']) || ProgrammeInterpreter::resolveStation($a['destination_station']) === '') {
                    return ['ok' => false, 'error' => 'invalid_manifest'];
                }
            }
        }
        return ['ok' => true, 'manifest' => $manifest];
    }

    /**
     * Dry run. Does not mutate.
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    public static function preview(array $record, OfficeStore $store): array
    {
        $man = $record['manifest'] ?? null;
        $v = self::validate($man);
        if ($v['ok'] !== true) {
            return ['ok' => false, 'error' => $v['error'] ?? 'invalid_manifest', 'would' => []];
        }
        return ProgrammeInterpreter::preview($record, $store);
    }
}
