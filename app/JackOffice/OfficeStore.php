<?php
declare(strict_types=1);

/**
 * Sole writer of Jack’s office records. Model output never reaches this as a path.
 */
final class OfficeStore
{
    private string $root;

    public function __construct(?string $root = null)
    {
        $this->root = $root !== null && $root !== '' ? rtrim($root, '/') : OfficeConfig::root();
    }

    public function root(): string
    {
        return $this->root;
    }

    public function boot(): void
    {
        if (!is_dir($this->root) && !@mkdir($this->root, 0770, true) && !is_dir($this->root)) {
            throw new RuntimeException('office_root_unwritable');
        }
        $this->protectRoot();
        $this->withLock(function (): void {
            $idx = $this->readIndex();
            foreach (OfficeConfig::STATIONS as $name) {
                $id = OfficeConfig::stationId($name);
                if (isset($idx['records'][$id])) continue;
                $rec = $this->blankRecord($id, 'station', null, strtolower(str_replace('_', '-', $name)), $name);
                $rec['protected'] = true;
                $this->writeRecordFile($rec);
                $idx['records'][$id] = $this->indexRow($rec);
            }
            $this->writeIndex($idx);
        });
    }

    public function get(string $id): ?array
    {
        $id = OfficePath::recordId($id);
        if ($id === '') return null;
        $path = $this->recordPath($id);
        if (!is_file($path)) return null;
        $raw = @file_get_contents($path);
        $row = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($row) ? $row : null;
    }

    /** @return list<array<string, mixed>> */
    public function children(string $parentId, int $limit = 40, int $offset = 0): array
    {
        $parentId = OfficePath::recordId($parentId);
        $idx = $this->readIndex();
        $out = [];
        $retiredStation = OfficeConfig::stationId('RETIRED');
        foreach ($idx['records'] as $id => $row) {
            if (!is_array($row)) continue;
            if ((string) ($row['parent_id'] ?? '') !== $parentId) continue;
            if (!empty($row['retired']) && $parentId !== $retiredStation) continue;
            $full = $this->get((string) $id);
            if ($full) $out[] = $this->publicRecord($full);
        }
        usort($out, static fn ($a, $b) => strcmp((string) ($a['display_name'] ?? ''), (string) ($b['display_name'] ?? '')));
        return array_slice($out, max(0, $offset), max(1, min($limit, OfficeConfig::MAX_LIST)));
    }

    /** @return list<array<string, mixed>> */
    public function inStation(string $stationId, int $limit = 33): array
    {
        $stationId = OfficePath::recordId($stationId);
        if ($stationId === '') return [];
        $limit = max(1, min($limit, 33));
        $idx = $this->readIndex();
        $out = [];
        foreach ($idx['records'] as $id => $row) {
            if (!is_array($row) || !empty($row['retired'])) continue;
            if ((string) ($row['station_id'] ?? '') !== $stationId) continue;
            if (($row['kind'] ?? '') === 'station') continue;
            $full = $this->get((string) $id);
            if ($full) $out[] = $full;
            if (count($out) >= $limit) break;
        }
        return $out;
    }

    /** @return list<array<string, mixed>> */
    public function search(string $query, array $stationIds, int $limit): array
    {
        $q = mb_strtolower(trim($query));
        $want = [];
        foreach ($stationIds as $sid) {
            $id = OfficePath::recordId((string) $sid);
            if ($id !== '') $want[$id] = true;
        }
        $idx = $this->readIndex();
        $hits = [];
        foreach ($idx['records'] as $id => $meta) {
            if (!is_array($meta) || !empty($meta['retired'])) continue;
            if ($want !== [] && !isset($want[(string) ($meta['station_id'] ?? '')]) && !isset($want[(string) $id])) {
                continue;
            }
            $full = $this->get((string) $id);
            if (!$full || ($full['kind'] ?? '') === 'station') continue;
            $hay = mb_strtolower(
                (string) ($full['display_name'] ?? '') . ' ' .
                (string) ($full['body'] ?? '') . ' ' .
                (string) ($full['slug'] ?? '')
            );
            if ($q !== '' && !str_contains($hay, $q)) continue;
            $hits[] = $this->publicRecord($full);
            if (count($hits) >= $limit) break;
        }
        return $hits;
    }

    /**
     * @param callable():mixed $fn
     * @return mixed
     */
    /** @var resource|null */
    private $lockFp = null;
    private int $lockDepth = 0;

    public function withLock(callable $fn)
    {
        if ($this->lockDepth > 0 && is_resource($this->lockFp)) {
            $this->lockDepth++;
            try {
                return $fn();
            } finally {
                $this->lockDepth--;
            }
        }
        $lockPath = OfficePath::join($this->root, 'office.lock');
        if (!is_dir($this->root) && !@mkdir($this->root, 0770, true)) {
            throw new RuntimeException('office_root_unwritable');
        }
        $fp = fopen($lockPath, 'c+');
        if ($fp === false) {
            throw new RuntimeException('office_lock_failed');
        }
        $this->lockFp = $fp;
        $this->lockDepth = 1;
        try {
            if (!flock($fp, LOCK_EX)) {
                throw new RuntimeException('office_lock_failed');
            }
            return $fn();
        } finally {
            $this->lockDepth = 0;
            flock($fp, LOCK_UN);
            fclose($fp);
            $this->lockFp = null;
        }
    }

    /**
     * @param array<string, mixed> $rec
     * @return array<string, mixed>
     */
    public function saveNew(array $rec): array
    {
        return $this->withLock(function () use ($rec) {
            $idx = $this->readIndex();
            $id = (string) $rec['id'];
            if (isset($idx['records'][$id])) {
                throw new RuntimeException('id_collision');
            }
            $this->writeRecordFile($rec);
            $this->writeRevision($rec, 1);
            $idx['records'][$id] = $this->indexRow($rec);
            $this->writeIndex($idx);
            return $rec;
        });
    }

    /**
     * @param array<string, mixed> $rec
     * @return array<string, mixed>
     */
    public function saveRevision(array $rec, ?array $previous): array
    {
        return $this->withLock(function () use ($rec, $previous) {
            $rev = (int) ($rec['revision'] ?? 1);
            $this->writeRecordFile($rec);
            $this->writeRevision($rec, $rev);
            $idx = $this->readIndex();
            $idx['records'][(string) $rec['id']] = $this->indexRow($rec);
            $this->writeIndex($idx);
            return $rec;
        });
    }

    /** @return list<array<string, mixed>> */
    public function linksFor(string $id): array
    {
        $id = OfficePath::recordId($id);
        $out = [];
        foreach ($this->readLinks() as $link) {
            if (!is_array($link)) continue;
            if (($link['from'] ?? '') === $id || ($link['to'] ?? '') === $id) {
                if (empty($link['retired'])) $out[] = $link;
            }
        }
        return $out;
    }

    /**
     * @param array<string, mixed> $link
     */
    public function addLink(array $link): array
    {
        return $this->withLock(function () use ($link) {
            $links = $this->readLinks();
            $links[] = $link;
            $this->writeLinks($links);
            return $link;
        });
    }

    public function blankRecord(string $id, string $kind, ?string $parentId, string $slug, string $name): array
    {
        $now = gmdate('c');
        $stationId = $parentId !== null ? $this->stationOf($parentId) : $id;
        return [
            'id' => $id,
            'kind' => $kind,
            'parent_id' => $parentId,
            'station_id' => $stationId,
            'slug' => $slug,
            'display_name' => $name,
            'body' => '',
            'epistemic_status' => 'proposed',
            'source_record_ids' => [],
            'tags' => [],
            'protected' => false,
            'retired' => false,
            'enabled' => false,
            'revision' => 1,
            'created_at' => $now,
            'updated_at' => $now,
            'author' => 'JACK',
            'manifest' => null,
            'programme_version' => 1,
            'human_decision' => 'awaiting',
            'last_run_at' => null,
            'run_history' => [],
        ];
    }

    public function stationOf(string $id): string
    {
        if (OfficeConfig::isStationId($id)) return $id;
        $cur = $this->get($id);
        $guard = 0;
        while ($cur && $guard++ < 24) {
            $sid = (string) ($cur['station_id'] ?? '');
            if (OfficeConfig::isStationId($sid)) return $sid;
            $pid = (string) ($cur['parent_id'] ?? '');
            if ($pid === '' || OfficeConfig::isStationId($pid)) return $pid !== '' ? $pid : '';
            $cur = $this->get($pid);
        }
        return '';
    }

    /** @param array<string, mixed> $rec */
    public function publicRecord(array $rec): array
    {
        return [
            'id' => $rec['id'] ?? '',
            'kind' => $rec['kind'] ?? '',
            'parent_id' => $rec['parent_id'] ?? null,
            'station_id' => $rec['station_id'] ?? '',
            'slug' => $rec['slug'] ?? '',
            'display_name' => $rec['display_name'] ?? '',
            'body' => $rec['body'] ?? '',
            'epistemic_status' => $rec['epistemic_status'] ?? 'proposed',
            'source_record_ids' => $rec['source_record_ids'] ?? [],
            'tags' => $rec['tags'] ?? [],
            'retired' => !empty($rec['retired']),
            'enabled' => !empty($rec['enabled']),
            'revision' => (int) ($rec['revision'] ?? 1),
            'created_at' => $rec['created_at'] ?? '',
            'updated_at' => $rec['updated_at'] ?? '',
            'author' => $rec['author'] ?? '',
            'protected' => !empty($rec['protected']),
            'warning' => $rec['warning'] ?? null,
            'motifs' => $rec['motifs'] ?? null,
            'manifest' => $rec['manifest'] ?? null,
            'kept' => !empty($rec['kept']),
            'previous_parent_id' => $rec['previous_parent_id'] ?? null,
            'programme_version' => (int) ($rec['programme_version'] ?? 1),
            'human_decision' => $rec['human_decision'] ?? null,
            'last_run_at' => $rec['last_run_at'] ?? null,
            'run_history' => is_array($rec['run_history'] ?? null) ? array_slice($rec['run_history'], 0, 8) : [],
        ];
    }

    public function recover(string $id): ?array
    {
        return $this->withLock(function () use ($id) {
            $rec = $this->get($id);
            if (!$rec || empty($rec['retired'])) return null;
            $prev = (int) ($rec['revision'] ?? 1);
            $home = (string) ($rec['previous_parent_id'] ?? '');
            if ($home === '' || $home === OfficeConfig::stationId('RETIRED')) {
                $home = OfficeConfig::stationId('UNCLASSIFIED');
            }
            $rec['retired'] = false;
            $rec['parent_id'] = $home;
            $rec['station_id'] = $this->stationOf($home);
            $rec['revision'] = $prev + 1;
            $rec['updated_at'] = gmdate('c');
            $this->writeRecordFile($rec);
            $this->writeRevision($rec, (int) $rec['revision']);
            $idx = $this->readIndex();
            $idx['records'][$id] = $this->indexRow($rec);
            $this->writeIndex($idx);
            return $rec;
        });
    }

    private function protectRoot(): void
    {
        $deny = "Options -Indexes\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n<IfModule php_module>\nphp_flag engine off\n</IfModule>\n";
        $ht = OfficePath::join($this->root, '.htaccess');
        if (!is_file($ht)) {
            @file_put_contents($ht, $deny, LOCK_EX);
        }
        foreach (['records', 'revisions'] as $d) {
            $dir = OfficePath::join($this->root, $d);
            if (!is_dir($dir)) @mkdir($dir, 0770, true);
        }
    }

    private function recordPath(string $id): string
    {
        $id = OfficePath::recordId($id);
        if ($id === '') {
            throw new InvalidArgumentException('path_rejected');
        }
        return OfficePath::assertInside($this->root, OfficePath::join($this->root, 'records/' . $id . '.json'));
    }

    /** @param array<string, mixed> $rec */
    private function writeRecordFile(array $rec): void
    {
        $path = $this->recordPath((string) $rec['id']);
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0770, true)) {
            throw new RuntimeException('record_unwritable');
        }
        $json = json_encode($rec, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) throw new RuntimeException('record_encode_failed');
        $tmp = $path . '.tmp.' . bin2hex(random_bytes(4));
        if (@file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
            throw new RuntimeException('record_unwritable');
        }
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException('record_unwritable');
        }
    }

    /** @param array<string, mixed> $rec */
    private function writeRevision(array $rec, int $n): void
    {
        $id = (string) $rec['id'];
        $rel = 'revisions/' . $id . '/' . $n . '.json';
        $path = OfficePath::join($this->root, $rel);
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0770, true)) {
            throw new RuntimeException('revision_unwritable');
        }
        $path = OfficePath::assertInside($this->root, $path);
        $json = json_encode($rec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) throw new RuntimeException('revision_encode_failed');
        @file_put_contents($path, $json . "\n", LOCK_EX);
    }

    /** @return array{records: array<string, array<string, mixed>>} */
    private function readIndex(): array
    {
        $path = OfficePath::join($this->root, 'index.json');
        if (!is_file($path)) return ['records' => []];
        $raw = @file_get_contents(OfficePath::assertInside($this->root, $path));
        $data = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($data) || !isset($data['records']) || !is_array($data['records'])) {
            return ['records' => []];
        }
        return $data;
    }

    /** @param array{records: array<string, array<string, mixed>>} $idx */
    private function writeIndex(array $idx): void
    {
        $path = OfficePath::join($this->root, 'index.json');
        $path = OfficePath::assertInside($this->root, $path);
        $json = json_encode($idx, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) throw new RuntimeException('index_encode_failed');
        $tmp = $path . '.tmp';
        if (@file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
            throw new RuntimeException('index_unwritable');
        }
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException('index_unwritable');
        }
    }

    /** @param array<string, mixed> $rec */
    private function indexRow(array $rec): array
    {
        return [
            'kind' => $rec['kind'] ?? '',
            'parent_id' => $rec['parent_id'] ?? null,
            'station_id' => $rec['station_id'] ?? '',
            'slug' => $rec['slug'] ?? '',
            'retired' => !empty($rec['retired']),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function readLinks(): array
    {
        $path = OfficePath::join($this->root, 'links.json');
        if (!is_file($path)) return [];
        $raw = @file_get_contents(OfficePath::assertInside($this->root, $path));
        $data = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($data) ? $data : [];
    }

    /** @param list<array<string, mixed>> $links */
    private function writeLinks(array $links): void
    {
        $path = OfficePath::assertInside($this->root, OfficePath::join($this->root, 'links.json'));
        $json = json_encode($links, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) throw new RuntimeException('links_encode_failed');
        @file_put_contents($path, $json . "\n", LOCK_EX);
    }
}
