<?php
declare(strict_types=1);

require_once __DIR__ . '/JackStore.php';

final class JackRelationship
{
    public static function file(): string
    {
        return dirname(__DIR__, 2) . '/storage/jack/relationships.json';
    }

    public static function blank(string $userId): array
    {
        $now = gmdate('c');
        return [
            'userId' => $userId,
            'firstEncounterAt' => $now,
            'knownSince' => $now,
            'preferredName' => null,
            'standing' => 'unknown',
            'trustStage' => 0,
            'currentMode' => 'reception',
            'formalityLevel' => 'formal',
            'unresolvedThreads' => [],
            'promises' => [],
            'objections' => [],
            'relevantPeople' => [],
            'lastConsequence' => null,
            'lastSeenAt' => $now,
            'consentScope' => ['JACK_READ', 'JACK_PROPOSE'],
            'visitCount' => 0,
            'unlockedEvents' => [],
        ];
    }

    public static function load(string $userId): array
    {
        $rows = JackStore::read(self::file());
        // Damaged: we cannot know who has withdrawn, so nobody is treated as having agreed.
        if ($rows === null) return ['standing' => 'withdrawn'] + self::blank($userId);
        foreach ($rows as $row) {
            if ((string) ($row['userId'] ?? '') === $userId) {
                return array_merge(self::blank($userId), $row);
            }
        }
        return self::blank($userId);
    }

    public static function touch(array $viewer, array $existing, string $mode): array
    {
        $now = gmdate('c');
        $row = $existing;
        $row['lastSeenAt'] = $now;
        $row['visitCount'] = (int) ($row['visitCount'] ?? 0) + 1;
        $row['currentMode'] = $mode;
        if (!empty($viewer['first'])) {
            $row['preferredName'] = (string) $viewer['first'];
        }
        if (($row['standing'] ?? 'unknown') === 'withdrawn') {
            return $row;
        }
        if (JackPolicy::isKeeper($viewer)) {
            $row['standing'] = 'keeper';
            $row['trustStage'] = max(2, (int) $row['trustStage']);
        } elseif ($row['visitCount'] >= 2 || !empty($viewer['known'])) {
            $row['standing'] = $row['standing'] === 'unknown' || $row['standing'] === 'visitor'
                ? 'returning_visitor'
                : $row['standing'];
            $row['trustStage'] = max(1, (int) $row['trustStage']);
        } else {
            $row['standing'] = 'visitor';
        }
        $row['formalityLevel'] = $mode === 'bartime'
            ? 'amicable'
            : ($mode === 'after_hours' ? 'quiet' : ($mode === 'reception' ? 'formal' : 'clerkly'));
        return $row;
    }

    public static function applyUpdate(array $row, array $update): array
    {
        $clean = JackPolicy::sanitiseRelationshipUpdate($update);
        if ($clean['lastConsequence'] !== null) {
            $row['lastConsequence'] = $clean['lastConsequence'];
        }
        if ($clean['unresolvedThreads'] !== []) {
            $row['unresolvedThreads'] = $clean['unresolvedThreads'];
        }
        return $row;
    }

    public static function save(array $row): bool
    {
        $id = (string) ($row['userId'] ?? '');
        if ($id === '') return false;
        $path = self::file();
        return JackStore::locked($path, static function () use ($path, $id, $row): bool {
            $list = JackStore::read($path);
            if ($list === null) return false;
            $found = false;
            foreach ($list as $i => $existing) {
                if ((string) ($existing['userId'] ?? '') === $id) {
                    $list[$i] = $row;
                    $found = true;
                    break;
                }
            }
            if (!$found) $list[] = $row;
            return JackStore::saveJson($path, $list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }) === true;
    }
}
