<?php
declare(strict_types=1);

/**
 * A thing in Jack’s room. Coordinates, not a graph node.
 */
final class RoomObject
{
    public function __construct(
        public readonly string $id,
        public readonly string $kind,
        public readonly string $title,
        public readonly Vec4 $at,
        public readonly bool $protected = false,
        public readonly bool $retired = false,
        public readonly string $createdAt = '',
        public readonly string $updatedAt = '',
        public readonly ?int $box = null,
        public readonly string $card = ''
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromArray(array $row): self
    {
        $id = RoomPath::objectId((string) ($row['id'] ?? ''));
        if ($id === '') {
            throw new InvalidArgumentException('path_rejected');
        }
        $kind = strtolower(trim((string) ($row['kind'] ?? '')));
        if (!RoomConfig::isKind($kind)) {
            throw new InvalidArgumentException('unknown_kind');
        }
        $title = self::cleanTitle((string) ($row['title'] ?? ''));
        if ($title === '') {
            throw new InvalidArgumentException('empty_title');
        }
        $box = null;
        if (($row['box'] ?? null) !== null && $row['box'] !== '') {
            $box = RoomConfig::boxNumber($row['box']);
        }
        return new self(
            $id,
            $kind,
            $title,
            Vec4::fromArray($row),
            !empty($row['protected']),
            !empty($row['retired']),
            (string) ($row['created_at'] ?? ''),
            (string) ($row['updated_at'] ?? ''),
            $box,
            self::cleanCard((string) ($row['card'] ?? ''))
        );
    }

    public static function seedDesk(): self
    {
        $now = gmdate('c');
        return new self(
            RoomConfig::DESK_ID,
            'desk',
            'Hollerith desk',
            Vec4::desk1951(),
            true,
            false,
            $now,
            $now
        );
    }

    public static function seedNest(): self
    {
        $now = gmdate('c');
        return new self(
            RoomConfig::NEST_ID,
            'nest',
            'The lining',
            Vec4::desk1951(),
            true,
            false,
            $now,
            $now
        );
    }

    public function isPlaced(): bool
    {
        return !$this->retired && $this->at->isPlaced();
    }

    public function isDrifting(): bool
    {
        return !$this->retired && !$this->at->isPlaced();
    }

    public function withVector(Vec4 $at): self
    {
        return new self(
            $this->id,
            $this->kind,
            $this->title,
            $at,
            $this->protected,
            $this->retired,
            $this->createdAt,
            gmdate('c'),
            $this->box,
            $this->card
        );
    }

    public function retiredCopy(): self
    {
        return new self(
            $this->id,
            $this->kind,
            $this->title,
            $this->at,
            $this->protected,
            true,
            $this->createdAt,
            gmdate('c'),
            $this->box,
            $this->card
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'title' => $this->title,
            'when' => $this->at->when,
            'where' => $this->at->where,
            'with' => $this->at->with,
            'under' => $this->at->under,
            'protected' => $this->protected,
            'retired' => $this->retired,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'box' => $this->box,
            'card' => $this->card,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function publicRow(): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'title' => $this->title,
            'when' => $this->at->when,
            'where' => $this->at->where,
            'with' => $this->at->with,
            'under' => $this->at->under,
            'state' => $this->retired ? 'retired' : ($this->isPlaced() ? 'placed' : 'drifting'),
            'protected' => $this->protected,
            'box' => $this->box,
            'card' => $this->card,
        ];
    }

    public static function cleanTitle(string $raw): string
    {
        $title = trim($raw);
        $title = str_replace(["\0", "\r"], '', $title);
        $title = preg_replace('/\s+/', ' ', $title) ?? $title;
        if (function_exists('mb_strlen') ? mb_strlen($title) > RoomConfig::MAX_TITLE : strlen($title) > RoomConfig::MAX_TITLE) {
            $title = function_exists('mb_substr')
                ? mb_substr($title, 0, RoomConfig::MAX_TITLE)
                : substr($title, 0, RoomConfig::MAX_TITLE);
        }
        return $title;
    }

    public static function cleanCard(string $raw): string
    {
        $card = str_replace(["\0", "\r", "\n"], ' ', $raw);
        $card = trim(preg_replace('/\s+/', ' ', $card) ?? $card);
        if (function_exists('mb_strlen') ? mb_strlen($card) > RoomConfig::CARD_COLS : strlen($card) > RoomConfig::CARD_COLS) {
            $card = function_exists('mb_substr')
                ? mb_substr($card, 0, RoomConfig::CARD_COLS)
                : substr($card, 0, RoomConfig::CARD_COLS);
        }
        return $card;
    }
}
