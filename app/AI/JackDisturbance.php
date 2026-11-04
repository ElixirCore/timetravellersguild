<?php
declare(strict_types=1);

final class JackDisturbance
{
    public static function all(): array
    {
        $path = dirname(__DIR__, 2) . '/data/jack/disturbances.json';
        $raw = is_file($path) ? @file_get_contents($path) : false;
        $data = is_string($raw) ? json_decode($raw, true) : [];
        return is_array($data) ? $data : [];
    }

    /** @return list<array<string, mixed>> */
    public static function permitted(array $relationship): array
    {
        $out = [];
        foreach (self::all() as $row) {
            if (!is_array($row)) continue;
            if (!JackPolicy::mayRevealDisturbance($row, $relationship)) continue;
            $out[] = [
                'id' => (string) ($row['id'] ?? ''),
                'title' => (string) ($row['title'] ?? ''),
                'text' => (string) ($row['text'] ?? ''),
                'status' => (string) ($row['status'] ?? 'authored'),
            ];
        }
        return $out;
    }
}
