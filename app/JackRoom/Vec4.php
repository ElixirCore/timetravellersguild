<?php
declare(strict_types=1);

/**
 * A position in Jack’s room. Four clerical axes, not a filesystem path.
 */
final class Vec4
{
    public function __construct(
        public readonly ?int $when,
        public readonly string $where,
        public readonly string $with,
        public readonly string $under
    ) {
    }

    /**
     * @param array<string, mixed> $row
     */
    public static function fromArray(array $row): self
    {
        return self::make(
            $row['when'] ?? null,
            (string) ($row['where'] ?? ''),
            (string) ($row['with'] ?? ''),
            (string) ($row['under'] ?? '')
        );
    }

    public static function make(mixed $when, string $where, string $with, string $under): self
    {
        return new self(
            self::year($when),
            self::axisValue('where', $where),
            self::axisValue('with', $with),
            self::axisValue('under', $under)
        );
    }

    public static function empty(): self
    {
        return new self(null, '', '', '');
    }

    public static function desk1951(): self
    {
        return new self(1951, 'desk', 'clerk', 'open');
    }

    public function isPlaced(): bool
    {
        return $this->when !== null
            && $this->where !== ''
            && $this->with !== ''
            && $this->under !== '';
    }

    public function driftingAxes(): array
    {
        $out = [];
        if ($this->when === null) $out[] = 'when';
        if ($this->where === '') $out[] = 'where';
        if ($this->with === '') $out[] = 'with';
        if ($this->under === '') $out[] = 'under';
        return $out;
    }

    public function axis(string $name): string
    {
        return match ($name) {
            'when' => $this->when === null ? '' : (string) $this->when,
            'where' => $this->where,
            'with' => $this->with,
            'under' => $this->under,
            default => '',
        };
    }

    public function withAxis(string $axis, mixed $value): self
    {
        if (!RoomConfig::isAxis($axis)) {
            throw new InvalidArgumentException('unknown_axis');
        }
        $when = $this->when;
        $where = $this->where;
        $with = $this->with;
        $under = $this->under;
        if ($axis === 'when') {
            $when = self::year($value);
        } elseif ($axis === 'where') {
            $where = self::axisValue('where', (string) $value);
        } elseif ($axis === 'with') {
            $with = self::axisValue('with', (string) $value);
        } else {
            $under = self::axisValue('under', (string) $value);
        }
        return new self($when, $where, $with, $under);
    }

    /**
     * @return array{when:?int,where:string,with:string,under:string}
     */
    public function toArray(): array
    {
        return [
            'when' => $this->when,
            'where' => $this->where,
            'with' => $this->with,
            'under' => $this->under,
        ];
    }

    public static function year(mixed $raw): ?int
    {
        if ($raw === null || $raw === '') {
            return null;
        }
        if (is_int($raw)) {
            $y = $raw;
        } elseif (is_string($raw) && preg_match('/^-?\d{1,4}$/', trim($raw))) {
            $y = (int) trim($raw);
        } else {
            throw new InvalidArgumentException('invalid_when');
        }
        if ($y < RoomConfig::YEAR_MIN || $y > RoomConfig::YEAR_MAX) {
            throw new InvalidArgumentException('invalid_when');
        }
        return $y;
    }

    public static function axisValue(string $axis, string $raw): string
    {
        $raw = strtolower(trim($raw));
        if ($raw === '') {
            return '';
        }
        if (str_contains($raw, "\0") || str_contains($raw, '/') || str_contains($raw, '\\') || str_contains($raw, '..')) {
            throw new InvalidArgumentException('path_rejected');
        }
        $ok = match ($axis) {
            'where' => RoomConfig::WHERE,
            'with' => RoomConfig::WITH,
            'under' => RoomConfig::UNDER,
            default => [],
        };
        if (!in_array($raw, $ok, true)) {
            throw new InvalidArgumentException('invalid_' . $axis);
        }
        return $raw;
    }
}
