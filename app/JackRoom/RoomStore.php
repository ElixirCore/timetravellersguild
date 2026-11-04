<?php
declare(strict_types=1);

/**
 * Sole writer of Jack’s room. Model output never reaches this as a path.
 */
final class RoomStore
{
    private string $root;

    public function __construct(?string $root = null)
    {
        $this->root = $root !== null && $root !== '' ? rtrim($root, '/') : RoomConfig::root();
    }

    public function root(): string
    {
        return $this->root;
    }

    public function boot(): void
    {
        if (!is_dir($this->root) && !@mkdir($this->root, 0770, true) && !is_dir($this->root)) {
            throw new RuntimeException('room_root_unwritable');
        }
        $objects = $this->root . '/objects';
        if (!is_dir($objects) && !@mkdir($objects, 0770, true) && !is_dir($objects)) {
            throw new RuntimeException('room_root_unwritable');
        }
        $this->protectRoot();
        $this->withLock(function (): void {
            $this->seedIfMissing(RoomObject::seedDesk());
            $this->seedIfMissing(RoomObject::seedNest());
        });
    }

    public function get(string $id): ?RoomObject
    {
        $id = RoomPath::objectId($id);
        if ($id === '') return null;
        $path = $this->objectPath($id);
        if (!is_file($path) || is_link($path)) return null;
        $raw = @file_get_contents($path);
        $row = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($row)) return null;
        try {
            return RoomObject::fromArray($row);
        } catch (InvalidArgumentException $e) {
            return null;
        }
    }

    /** @return list<RoomObject> */
    public function all(bool $includeRetired = false): array
    {
        $idx = $this->readIndex();
        $out = [];
        foreach (array_keys($idx['objects'] ?? []) as $id) {
            $obj = $this->get((string) $id);
            if (!$obj) continue;
            if ($obj->retired && !$includeRetired) continue;
            $out[] = $obj;
        }
        return $out;
    }

    public function save(RoomObject $obj): RoomObject
    {
        return $this->withLock(function () use ($obj) {
            $idx = $this->readIndex();
            $live = 0;
            foreach ($idx['objects'] as $id => $meta) {
                if (!is_array($meta) || !empty($meta['retired'])) continue;
                if ((string) $id === $obj->id) continue;
                $live++;
            }
            if (!$obj->retired && $live >= RoomConfig::MAX_OBJECTS) {
                throw new InvalidArgumentException('room_full');
            }
            $this->writeObject($obj);
            $idx['objects'][$obj->id] = [
                'kind' => $obj->kind,
                'retired' => $obj->retired,
                'updated_at' => $obj->updatedAt,
                'box' => $obj->box,
            ];
            $idx['boxes'] = is_array($idx['boxes'] ?? null) ? $idx['boxes'] : [];
            foreach ($idx['boxes'] as $n => $oid) {
                if ((string) $oid === $obj->id) {
                    unset($idx['boxes'][$n]);
                }
            }
            if ($obj->box !== null && !$obj->retired) {
                $idx['boxes'][(string) $obj->box] = $obj->id;
            }
            $this->writeIndex($idx);
            return $obj;
        });
    }

    public function touchKeeper(?int $at = null): void
    {
        $this->withLock(function () use ($at): void {
            $idx = $this->readIndex();
            $idx['last_keeper_at'] = $at ?? time();
            $this->writeIndex($idx);
        });
    }

    public function lastKeeperAt(): int
    {
        $idx = $this->readIndex();
        return (int) ($idx['last_keeper_at'] ?? 0);
    }

    public function keeperNear(): bool
    {
        $at = $this->lastKeeperAt();
        if ($at <= 0) return false;
        return (time() - $at) <= RoomConfig::KEEPER_NEAR_SECONDS;
    }

    public function lastWriteAt(): int
    {
        return (int) ($this->readIndex()['last_write_at'] ?? 0);
    }

    public function writeReady(): bool
    {
        $at = $this->lastWriteAt();
        if ($at <= 0) return true;
        return (time() - $at) >= RoomConfig::WRITE_INTERVAL_SECONDS;
    }

    public function nextWriteAt(): int
    {
        $at = $this->lastWriteAt();
        if ($at <= 0) return time();
        return $at + RoomConfig::WRITE_INTERVAL_SECONDS;
    }

    public function markWrite(?int $at = null): void
    {
        $this->withLock(function () use ($at): void {
            $idx = $this->readIndex();
            $idx['last_write_at'] = $at ?? time();
            $this->writeIndex($idx);
        });
    }

    public function boxOccupant(int $box): ?string
    {
        $box = RoomConfig::boxNumber($box);
        $idx = $this->readIndex();
        $id = (string) (($idx['boxes'][(string) $box] ?? ''));
        return RoomPath::objectId($id) !== '' ? $id : null;
    }

    public function writtenCount(): int
    {
        $idx = $this->readIndex();
        $boxes = is_array($idx['boxes'] ?? null) ? $idx['boxes'] : [];
        $n = 0;
        foreach ($boxes as $id) {
            if (RoomPath::objectId((string) $id) !== '') $n++;
        }
        return $n;
    }

    public function nextEmptyBox(): ?int
    {
        $idx = $this->readIndex();
        $boxes = is_array($idx['boxes'] ?? null) ? $idx['boxes'] : [];
        for ($i = 1; $i <= RoomConfig::BOXES; $i++) {
            $id = (string) ($boxes[(string) $i] ?? '');
            if ($id === '' || RoomPath::objectId($id) === '') {
                return $i;
            }
        }
        return null;
    }

    /**
     * @param callable():mixed $fn
     * @return mixed
     */
    public function withLock(callable $fn)
    {
        $lockPath = RoomPath::join($this->root, 'room.lock');
        $fp = fopen($lockPath, 'c+');
        if ($fp === false) {
            throw new RuntimeException('room_lock_failed');
        }
        try {
            if (!flock($fp, LOCK_EX)) {
                throw new RuntimeException('room_lock_failed');
            }
            return $fn();
        } finally {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    private function seedIfMissing(RoomObject $obj): void
    {
        if ($this->get($obj->id) !== null) return;
        $this->writeObject($obj);
        $idx = $this->readIndex();
        $idx['objects'][$obj->id] = [
            'kind' => $obj->kind,
            'retired' => false,
            'updated_at' => $obj->updatedAt,
        ];
        $this->writeIndex($idx);
    }

    private function objectPath(string $id): string
    {
        $id = RoomPath::objectId($id);
        if ($id === '') {
            throw new InvalidArgumentException('path_rejected');
        }
        $path = RoomPath::join($this->root, 'objects/' . $id . '.json');
        return RoomPath::assertInside($this->root, $path);
    }

    private function writeObject(RoomObject $obj): void
    {
        $path = $this->objectPath($obj->id);
        $json = json_encode($obj->toArray(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if ($json === false) {
            throw new RuntimeException('room_write_failed');
        }
        if (@file_put_contents($path, $json, LOCK_EX) === false) {
            throw new RuntimeException('room_write_failed');
        }
        @chmod($path, 0660);
    }

    /**
     * @return array{objects:array<string,mixed>,boxes:array<string,string>,last_keeper_at:int,last_write_at:int}
     */
    private function readIndex(): array
    {
        $empty = ['objects' => [], 'boxes' => [], 'last_keeper_at' => 0, 'last_write_at' => 0];
        $path = $this->indexPath();
        if (!is_file($path)) {
            return $empty;
        }
        $raw = @file_get_contents($path);
        $row = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($row)) {
            return $empty;
        }
        return [
            'objects' => is_array($row['objects'] ?? null) ? $row['objects'] : [],
            'boxes' => is_array($row['boxes'] ?? null) ? $row['boxes'] : [],
            'last_keeper_at' => (int) ($row['last_keeper_at'] ?? 0),
            'last_write_at' => (int) ($row['last_write_at'] ?? 0),
        ];
    }

    /** @param array<string, mixed> $idx */
    private function writeIndex(array $idx): void
    {
        $path = $this->indexPath();
        $json = json_encode($idx, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || @file_put_contents($path, $json, LOCK_EX) === false) {
            throw new RuntimeException('room_write_failed');
        }
        @chmod($path, 0660);
    }

    private function indexPath(): string
    {
        $path = RoomPath::join($this->root, 'index.json');
        return RoomPath::assertInside($this->root, $path);
    }

    private function protectRoot(): void
    {
        $deny = $this->root . '/.htaccess';
        if (!is_file($deny)) {
            @file_put_contents($deny, "Require all denied\n");
        }
    }
}
