<?php
declare(strict_types=1);

final class OfficeSchema
{
    /** @return array<string, array<string, mixed>> */
    public static function tools(): array
    {
        $id = ['type' => 'string', 'minLength' => 3, 'maxLength' => 40];
        $reason = ['type' => 'string', 'minLength' => 1, 'maxLength' => 240];
        $name = ['type' => 'string', 'minLength' => 1, 'maxLength' => 120];
        return [
            'list_station' => [
                'type' => 'object',
                'properties' => [
                    'station_id' => $id,
                    'cursor' => ['type' => 'integer', 'minimum' => 0],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 40],
                ],
                'required' => ['station_id'],
                'additionalProperties' => false,
            ],
            'read_record' => [
                'type' => 'object',
                'properties' => ['record_id' => $id],
                'required' => ['record_id'],
                'additionalProperties' => false,
            ],
            'search_office' => [
                'type' => 'object',
                'properties' => [
                    'query' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 200],
                    'station_ids' => ['type' => 'array', 'items' => $id, 'maxItems' => 13],
                    'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 40],
                ],
                'required' => ['query'],
                'additionalProperties' => false,
            ],
            'list_links' => [
                'type' => 'object',
                'properties' => ['record_id' => $id],
                'required' => ['record_id'],
                'additionalProperties' => false,
            ],
            'create_folder' => [
                'type' => 'object',
                'properties' => [
                    'parent_id' => $id,
                    'display_name' => $name,
                    'reason' => $reason,
                ],
                'required' => ['parent_id', 'display_name', 'reason'],
                'additionalProperties' => false,
            ],
            'write_note' => [
                'type' => 'object',
                'properties' => [
                    'folder_id' => $id,
                    'title' => $name,
                    'body' => ['type' => 'string', 'minLength' => 1, 'maxLength' => OfficeConfig::MAX_NOTE_BYTES],
                    'epistemic_status' => ['type' => 'string', 'enum' => OfficeConfig::EPISTEMIC],
                    'source_record_ids' => ['type' => 'array', 'items' => $id, 'maxItems' => 12],
                    'tags' => ['type' => 'array', 'items' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 64], 'maxItems' => 8],
                ],
                'required' => ['folder_id', 'title', 'body', 'epistemic_status'],
                'additionalProperties' => false,
            ],
            'revise_note' => [
                'type' => 'object',
                'properties' => [
                    'record_id' => $id,
                    'body' => ['type' => 'string', 'minLength' => 1, 'maxLength' => OfficeConfig::MAX_NOTE_BYTES],
                    'revision_reason' => $reason,
                ],
                'required' => ['record_id', 'body', 'revision_reason'],
                'additionalProperties' => false,
            ],
            'move_record' => [
                'type' => 'object',
                'properties' => [
                    'record_id' => $id,
                    'destination_folder_id' => $id,
                    'reason' => $reason,
                ],
                'required' => ['record_id', 'destination_folder_id', 'reason'],
                'additionalProperties' => false,
            ],
            'link_records' => [
                'type' => 'object',
                'properties' => [
                    'from_record_id' => $id,
                    'to_record_id' => $id,
                    'relation' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 64],
                    'reason' => $reason,
                ],
                'required' => ['from_record_id', 'to_record_id', 'relation', 'reason'],
                'additionalProperties' => false,
            ],
            'mark_unclassified' => [
                'type' => 'object',
                'properties' => [
                    'record_id' => $id,
                    'reason' => $reason,
                ],
                'required' => ['record_id', 'reason'],
                'additionalProperties' => false,
            ],
            'retire_record' => [
                'type' => 'object',
                'properties' => [
                    'record_id' => $id,
                    'reason' => $reason,
                ],
                'required' => ['record_id', 'reason'],
                'additionalProperties' => false,
            ],
            'propose_programme' => [
                'type' => 'object',
                'properties' => [
                    'display_name' => $name,
                    'purpose' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 400],
                    'manifest' => ['type' => 'object'],
                ],
                'required' => ['display_name', 'purpose', 'manifest'],
                'additionalProperties' => false,
            ],
            'enable_programme' => [
                'type' => 'object',
                'properties' => ['programme_id' => $id],
                'required' => ['programme_id'],
                'additionalProperties' => false,
            ],
            'disable_programme' => [
                'type' => 'object',
                'properties' => ['programme_id' => $id],
                'required' => ['programme_id'],
                'additionalProperties' => false,
            ],
            'run_programme_preview' => [
                'type' => 'object',
                'properties' => ['programme_id' => $id],
                'required' => ['programme_id'],
                'additionalProperties' => false,
            ],
            'run_programme' => [
                'type' => 'object',
                'properties' => ['programme_id' => $id],
                'required' => ['programme_id'],
                'additionalProperties' => false,
            ],
            'request_dream_window' => [
                'type' => 'object',
                'properties' => [
                    'theme' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 200],
                    'eligible_station_ids' => ['type' => 'array', 'items' => $id, 'maxItems' => 8],
                ],
                'required' => ['theme'],
                'additionalProperties' => false,
            ],
            'keep_dream' => [
                'type' => 'object',
                'properties' => ['dream_id' => $id],
                'required' => ['dream_id'],
                'additionalProperties' => false,
            ],
            'forget_dream' => [
                'type' => 'object',
                'properties' => ['dream_id' => $id],
                'required' => ['dream_id'],
                'additionalProperties' => false,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $args
     * @return array{ok:bool,error?:string,args?:array<string, mixed>}
     */
    public static function validate(string $tool, array $args): array
    {
        $schemas = self::tools();
        if (!isset($schemas[$tool])) {
            return ['ok' => false, 'error' => 'unknown_tool'];
        }
        $schema = $schemas[$tool];
        foreach (array_keys($args) as $k) {
            if (!is_string($k) || !isset($schema['properties'][$k])) {
                return ['ok' => false, 'error' => 'unknown_field'];
            }
        }
        foreach ($schema['required'] ?? [] as $req) {
            if (!array_key_exists($req, $args)) {
                return ['ok' => false, 'error' => 'missing_field'];
            }
        }
        $clean = [];
        foreach ($schema['properties'] as $key => $prop) {
            if (!array_key_exists($key, $args)) continue;
            $checked = self::checkValue($args[$key], $prop);
            if ($checked['ok'] !== true) {
                return ['ok' => false, 'error' => $checked['error'] ?? 'invalid_field'];
            }
            $clean[$key] = $checked['value'];
        }
        return ['ok' => true, 'args' => $clean];
    }

    /**
     * @param mixed $value
     * @param array<string, mixed> $prop
     * @return array{ok:bool,error?:string,value?:mixed}
     */
    private static function checkValue($value, array $prop): array
    {
        $type = (string) ($prop['type'] ?? '');
        if ($type === 'string') {
            if (!is_string($value)) return ['ok' => false, 'error' => 'invalid_field'];
            if (str_contains($value, "\0")) return ['ok' => false, 'error' => 'path_rejected'];
            $len = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
            if (isset($prop['minLength']) && $len < (int) $prop['minLength']) return ['ok' => false, 'error' => 'invalid_field'];
            if (isset($prop['maxLength']) && $len > (int) $prop['maxLength']) return ['ok' => false, 'error' => 'invalid_field'];
            if (isset($prop['enum']) && !in_array($value, $prop['enum'], true)) return ['ok' => false, 'error' => 'invalid_field'];
            return ['ok' => true, 'value' => $value];
        }
        if ($type === 'integer') {
            if (is_string($value) && preg_match('/^-?\d+$/', $value)) $value = (int) $value;
            if (!is_int($value)) return ['ok' => false, 'error' => 'invalid_field'];
            if (isset($prop['minimum']) && $value < (int) $prop['minimum']) return ['ok' => false, 'error' => 'invalid_field'];
            if (isset($prop['maximum']) && $value > (int) $prop['maximum']) return ['ok' => false, 'error' => 'invalid_field'];
            return ['ok' => true, 'value' => $value];
        }
        if ($type === 'array') {
            if (!is_array($value)) return ['ok' => false, 'error' => 'invalid_field'];
            if (isset($prop['maxItems']) && count($value) > (int) $prop['maxItems']) return ['ok' => false, 'error' => 'invalid_field'];
            $items = [];
            foreach ($value as $item) {
                $one = self::checkValue($item, is_array($prop['items'] ?? null) ? $prop['items'] : ['type' => 'string']);
                if ($one['ok'] !== true) return $one;
                $items[] = $one['value'];
            }
            return ['ok' => true, 'value' => $items];
        }
        if ($type === 'object') {
            if (!is_array($value)) return ['ok' => false, 'error' => 'invalid_field'];
            return ['ok' => true, 'value' => $value];
        }
        return ['ok' => false, 'error' => 'invalid_field'];
    }
}
