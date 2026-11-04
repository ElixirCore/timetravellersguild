<?php
declare(strict_types=1);

/**
 * Jack’s one habitat. Objects live in 4-space. Screens are projections.
 */
final class JackRoom
{
    public function __construct(private RoomStore $store)
    {
        $this->store->boot();
    }

    public function store(): RoomStore
    {
        return $this->store;
    }

    /** @return list<RoomObject> */
    public function contents(): array
    {
        return $this->store->all(false);
    }

    /** @return list<RoomObject> */
    public function drifting(): array
    {
        $out = [];
        foreach ($this->contents() as $obj) {
            if ($obj->isDrifting()) $out[] = $obj;
        }
        return $out;
    }

    /** @return list<RoomObject> */
    public function placed(): array
    {
        $out = [];
        foreach ($this->contents() as $obj) {
            if ($obj->isPlaced()) $out[] = $obj;
        }
        return $out;
    }

    public function hasDesk(): bool
    {
        $desk = $this->store->get(RoomConfig::DESK_ID);
        return $desk !== null && !$desk->retired && $desk->kind === 'desk';
    }

    public function driftingCount(): int
    {
        return count($this->drifting());
    }

    /**
     * Flatten one axis. Keys are axis values; empty key is unset on that axis.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function project(string $axis): array
    {
        if (!RoomConfig::isAxis($axis)) {
            throw new InvalidArgumentException('unknown_axis');
        }
        $groups = [];
        foreach ($this->contents() as $obj) {
            $key = $obj->at->axis($axis);
            if (!isset($groups[$key])) $groups[$key] = [];
            $groups[$key][] = $obj->publicRow();
        }
        ksort($groups);
        return $groups;
    }

    /**
     * Short facts for the runtime. No other users. No paths.
     *
     * @return list<string>
     */
    public function runtimeLines(): array
    {
        $n = count($this->contents());
        $d = $this->driftingCount();
        $written = $this->store->writtenCount();
        $lines = [];
        $lines[] = 'Room: Jack’s habitat. A thousand boxes of punch cards. ' . $written . ' written. He writes one at a time, slowly.';
        $lines[] = 'Room objects: ' . $n . '. Drifting: ' . $d . '.';
        $lines[] = $this->hasDesk()
            ? 'The Hollerith desk stands at 1951, the desk face, with the clerk, under open warrant.'
            : 'The Hollerith desk is not in the room.';
        foreach (array_slice($this->drifting(), 0, 4) as $obj) {
            $axes = implode(', ', $obj->at->driftingAxes());
            $lines[] = 'Drifting: ' . $obj->title . ' (unset ' . $axes . ').';
        }
        return $lines;
    }
}
