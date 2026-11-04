<?php
declare(strict_types=1);

final class OfficeLedger
{
    public static function file(string $root): string
    {
        return OfficePath::assertInside($root, OfficePath::join($root, 'ledger.jsonl'));
    }

    /**
     * @param array<string, mixed> $event
     */
    public static function append(string $root, array $event): string
    {
        $id = 'jled_' . bin2hex(random_bytes(8));
        $row = [
            'event_id' => $id,
            'server_timestamp' => gmdate('c'),
            'actor' => (string) ($event['actor'] ?? 'JACK'),
            'session_or_run_id' => (string) ($event['session_or_run_id'] ?? ''),
            'action' => (string) ($event['action'] ?? ''),
            'target_record_ids' => array_values(array_filter(
                is_array($event['target_record_ids'] ?? null) ? $event['target_record_ids'] : [],
                static fn ($v) => is_string($v) && $v !== ''
            )),
            'request_summary' => self::safeSummary((string) ($event['request_summary'] ?? '')),
            'validation_result' => (string) ($event['validation_result'] ?? ''),
            'approval_state' => (string) ($event['approval_state'] ?? 'n/a'),
            'result' => (string) ($event['result'] ?? ''),
            'previous_revision_id' => $event['previous_revision_id'] ?? null,
            'new_revision_id' => $event['new_revision_id'] ?? null,
            'programme_id' => $event['programme_id'] ?? null,
            'programme_version' => $event['programme_version'] ?? null,
            'model' => $event['model'] ?? null,
        ];
        $line = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($line === false) {
            throw new RuntimeException('ledger_encode_failed');
        }
        $path = OfficePath::join($root, 'ledger.jsonl');
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0770, true)) {
            throw new RuntimeException('ledger_unwritable');
        }
        $path = OfficePath::assertInside($root, $path);
        $fp = fopen($path, 'ab');
        if ($fp === false) {
            throw new RuntimeException('ledger_unwritable');
        }
        try {
            if (!flock($fp, LOCK_EX)) {
                throw new RuntimeException('ledger_locked');
            }
            fwrite($fp, $line . "\n");
            fflush($fp);
            flock($fp, LOCK_UN);
        } finally {
            fclose($fp);
        }
        return $id;
    }

    /** @return list<array<string, mixed>> */
    public static function recent(string $root, int $limit = 40): array
    {
        $path = OfficePath::join($root, 'ledger.jsonl');
        if (!is_file($path)) return [];
        $path = OfficePath::assertInside($root, $path);
        $raw = @file($path, FILE_IGNORE_NEW_LINES);
        if (!is_array($raw)) return [];
        $out = [];
        foreach (array_reverse($raw) as $line) {
            if ($line === '') continue;
            $row = json_decode($line, true);
            if (!is_array($row)) continue;
            $out[] = $row;
            if (count($out) >= $limit) break;
        }
        return $out;
    }

    public static function safeSummary(string $s): string
    {
        $s = preg_replace('/\s+/u', ' ', $s) ?? $s;
        $s = preg_replace('/(?:api[_-]?key|sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+)/i', '[redacted]', $s) ?? $s;
        if (function_exists('mb_strlen') && mb_strlen($s) > 240) {
            return mb_substr($s, 0, 239) . '…';
        }
        return strlen($s) > 240 ? substr($s, 0, 239) . '…' : $s;
    }
}
