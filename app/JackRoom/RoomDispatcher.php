<?php
declare(strict_types=1);

/**
 * Finite verbs for the habitat. Visitors never write. The model never chooses a path.
 */
final class RoomDispatcher
{
    public string $actor = 'JACK';

    public function __construct(private RoomStore $store)
    {
        $this->store->boot();
    }

    /**
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    public function dispatch(string $name, array $arguments): array
    {
        $name = strtolower(trim($name));
        if (!in_array($name, ['place_object', 'shift_axis', 'retire_object', 'line_the_nest', 'write_box'], true)) {
            return ['ok' => false, 'error' => 'unknown_tool'];
        }
        $jackMay = $name === 'write_box';
        if ($this->actor !== 'TOBY' && !($jackMay && $this->actor === 'JACK')) {
            return ['ok' => false, 'error' => 'unauthorized'];
        }
        try {
            return match ($name) {
                'place_object' => $this->placeObject($arguments),
                'shift_axis' => $this->shiftAxis($arguments),
                'retire_object' => $this->retireObject($arguments),
                'line_the_nest' => $this->lineTheNest(),
                'write_box' => $this->writeBox($arguments),
            };
        } catch (InvalidArgumentException $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => 'rejected'];
        }
    }

    /**
     * @param array<string, mixed> $args
     * @return array<string, mixed>
     */
    private function placeObject(array $args): array
    {
        $kind = strtolower(trim((string) ($args['kind'] ?? 'keepsake')));
        if (!RoomConfig::isKind($kind)) {
            throw new InvalidArgumentException('unknown_kind');
        }
        if (in_array($kind, ['desk', 'nest'], true)) {
            throw new InvalidArgumentException('protected_kind');
        }
        $title = RoomObject::cleanTitle((string) ($args['title'] ?? ''));
        if ($title === '') {
            throw new InvalidArgumentException('empty_title');
        }
        $at = Vec4::make($args['when'] ?? null, (string) ($args['where'] ?? ''), (string) ($args['with'] ?? ''), (string) ($args['under'] ?? ''));
        $now = gmdate('c');
        $obj = new RoomObject(RoomPath::mintObjectId(), $kind, $title, $at, false, false, $now, $now);
        $saved = $this->store->save($obj);
        return ['ok' => true, 'object' => $saved->publicRow()];
    }

    /**
     * @param array<string, mixed> $args
     * @return array<string, mixed>
     */
    private function shiftAxis(array $args): array
    {
        $id = RoomPath::objectId((string) ($args['id'] ?? ''));
        $axis = strtolower(trim((string) ($args['axis'] ?? '')));
        if ($id === '') {
            throw new InvalidArgumentException('path_rejected');
        }
        if (!RoomConfig::isAxis($axis)) {
            throw new InvalidArgumentException('unknown_axis');
        }
        $obj = $this->store->get($id);
        if (!$obj || $obj->retired) {
            throw new InvalidArgumentException('not_found');
        }
        $next = $obj->withVector($obj->at->withAxis($axis, $args['value'] ?? ''));
        $saved = $this->store->save($next);
        return ['ok' => true, 'object' => $saved->publicRow()];
    }

    /**
     * @param array<string, mixed> $args
     * @return array<string, mixed>
     */
    private function retireObject(array $args): array
    {
        $id = RoomPath::objectId((string) ($args['id'] ?? ''));
        if ($id === '') {
            throw new InvalidArgumentException('path_rejected');
        }
        $obj = $this->store->get($id);
        if (!$obj) {
            throw new InvalidArgumentException('not_found');
        }
        if ($obj->protected) {
            throw new InvalidArgumentException('protected');
        }
        $saved = $this->store->save($obj->retiredCopy());
        return ['ok' => true, 'object' => $saved->publicRow()];
    }

    /**
     * One 80-column card into one box. Never a batch. The clerk is slow on purpose.
     *
     * @param array<string, mixed> $args
     * @return array<string, mixed>
     */
    private function writeBox(array $args): array
    {
        if (!$this->store->writeReady()) {
            throw new InvalidArgumentException('still_punching');
        }
        $box = isset($args['box']) && $args['box'] !== '' && $args['box'] !== null
            ? RoomConfig::boxNumber($args['box'])
            : $this->store->nextEmptyBox();
        if ($box === null) {
            throw new InvalidArgumentException('boxes_full');
        }
        if ($this->store->boxOccupant($box) !== null) {
            throw new InvalidArgumentException('box_occupied');
        }
        $card = RoomObject::cleanCard((string) ($args['card'] ?? $args['title'] ?? ''));
        if ($card === '') {
            throw new InvalidArgumentException('empty_title');
        }
        $now = gmdate('c');
        $obj = new RoomObject(
            RoomPath::mintObjectId(),
            'slip',
            $card,
            Vec4::desk1951(),
            false,
            false,
            $now,
            $now,
            $box,
            $card
        );
        $saved = $this->store->save($obj);
        $this->store->markWrite();
        return ['ok' => true, 'object' => $saved->publicRow()];
    }

    /**
     * @return array<string, mixed>
     */
    private function lineTheNest(): array
    {
        $desk = $this->store->get(RoomConfig::DESK_ID) ?? RoomObject::seedDesk();
        if (!$desk->at->isPlaced() || $desk->retired) {
            $desk = RoomObject::seedDesk();
        }
        $nest = $this->store->get(RoomConfig::NEST_ID) ?? RoomObject::seedNest();
        if (!$nest->at->isPlaced() || $nest->retired) {
            $nest = RoomObject::seedNest();
        }
        $this->store->save($desk);
        $this->store->save($nest);
        return [
            'ok' => true,
            'object' => $nest->publicRow(),
            'desk' => $desk->publicRow(),
        ];
    }
}
