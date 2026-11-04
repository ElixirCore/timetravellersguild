<?php
declare(strict_types=1);

/**
 * Jack's body map. Topology is filed JSON. The clerk does not invent geography
 * or telemetry. No namespaces: Jack classes stay global.
 */
class JackMap
{
    public static function path(): string
    {
        return dirname(__DIR__, 2) . '/jack/map/data/topology.json';
    }

    public static function load(): array
    {
        $raw = @file_get_contents(self::path());
        if ($raw === false || $raw === '') {
            return ['mode' => 'static', 'nodes' => [], 'nerves' => [], 'holdings' => [], 'events' => []];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : ['mode' => 'static', 'nodes' => [], 'nerves' => [], 'holdings' => [], 'events' => []];
    }

    public static function topology(): array
    {
        $data = self::load();
        $data['mode'] = 'static';
        $data['telemetry'] = false;
        $data['carrier'] = 'human-post';
        $data['shuffle'] = 'robot';
        $data['served'] = gmdate('c');
        $data['nodes'] = array_map([self::class, 'stamp'], $data['nodes'] ?? []);
        return $data;
    }

    public static function stamp(array $n): array
    {
        $geo = $n['geography'] ?? null;
        if (is_array($geo) && isset($geo['lat'], $geo['lon'])) {
            $n['earth_address'] = self::address((float) $geo['lat'], (float) $geo['lon'], 6);
        }
        return $n;
    }

    public static function nodeById(string $id): ?array
    {
        foreach (self::load()['nodes'] ?? [] as $n) {
            if (is_array($n) && (string) ($n['id'] ?? '') === $id) {
                return self::stamp($n);
            }
        }
        return null;
    }

    public static function nodes(?string $id = null, ?string $cell = null, ?string $anatomy = null): array
    {
        if ($id) {
            $n = self::nodeById($id);
            return $n ? [$n] : [];
        }
        $out = [];
        foreach (self::load()['nodes'] ?? [] as $n) {
            if (!is_array($n)) {
                continue;
            }
            if ($anatomy !== null && $anatomy !== '' && strtoupper((string) ($n['anatomy'] ?? '')) !== strtoupper($anatomy)) {
                continue;
            }
            if ($cell !== null && $cell !== '' && !self::cellMatch($n, $cell)) {
                continue;
            }
            $out[] = self::stamp($n);
        }
        return $out;
    }

    public static function edges(?string $node = null): array
    {
        $out = [];
        foreach (self::load()['nerves'] ?? [] as $e) {
            if (!is_array($e)) {
                continue;
            }
            if ($node !== null && $node !== '' && (string) ($e['from'] ?? '') !== $node && (string) ($e['to'] ?? '') !== $node) {
                continue;
            }
            $out[] = $e;
        }
        return $out;
    }

    public static function holdings(?string $node = null): array
    {
        $out = [];
        foreach (self::load()['holdings'] ?? [] as $h) {
            if (!is_array($h)) {
                continue;
            }
            if ($node !== null && $node !== '' && (string) ($h['node'] ?? '') !== $node) {
                continue;
            }
            $out[] = $h;
        }
        return $out;
    }

    public static function events(?string $from = null, ?string $to = null): array
    {
        $out = [];
        foreach (self::load()['events'] ?? [] as $ev) {
            if (!is_array($ev)) {
                continue;
            }
            $at = (string) ($ev['at'] ?? '');
            if ($from && $at !== '' && strcmp($at, $from) < 0) {
                continue;
            }
            if ($to && $at !== '' && strcmp($at, $to) > 0) {
                continue;
            }
            $out[] = $ev;
        }
        return $out;
    }

    public static function search(string $q): array
    {
        $q = function_exists('mb_strtolower') ? mb_strtolower(trim($q)) : strtolower(trim($q));
        if ($q === '') {
            return ['nodes' => [], 'holdings' => [], 'nerves' => []];
        }
        $data = self::load();
        $nodes = [];
        $holdings = [];
        $nerves = [];
        foreach ($data['nodes'] ?? [] as $n) {
            if (is_array($n) && self::hay($n, $q)) {
                $nodes[] = self::stamp($n);
            }
        }
        foreach ($data['holdings'] ?? [] as $h) {
            if (is_array($h) && self::hay($h, $q)) {
                $holdings[] = $h;
            }
        }
        foreach ($data['nerves'] ?? [] as $e) {
            if (is_array($e) && self::hay($e, $q)) {
                $nerves[] = $e;
            }
        }
        return ['nodes' => $nodes, 'holdings' => $holdings, 'nerves' => $nerves];
    }

    public static function trace(string $id): ?array
    {
        $data = self::load();
        foreach ($data['traces'] ?? [] as $t) {
            if (is_array($t) && ((string) ($t['id'] ?? '') === $id || (string) ($t['holding'] ?? '') === $id)) {
                return $t;
            }
        }
        foreach ($data['holdings'] ?? [] as $h) {
            if (!is_array($h) || (string) ($h['id'] ?? '') !== $id) {
                continue;
            }
            $path = $h['path'] ?? [];
            if (!is_array($path) || !$path) {
                $path = [(string) ($h['node'] ?? '')];
            }
            return [
                'id' => 'trace-' . $id,
                'holding' => $id,
                'label' => (string) ($h['name'] ?? $id),
                'path' => $path,
                'note' => (string) ($h['provenance'] ?? 'Filed path only. No live impulse.'),
            ];
        }
        $n = self::nodeById($id);
        if ($n) {
            $path = [$id];
            foreach ($data['nerves'] ?? [] as $e) {
                if (is_array($e) && (string) ($e['from'] ?? '') === $id) {
                    $path[] = (string) $e['to'];
                }
            }
            return [
                'id' => 'trace-' . $id,
                'holding' => null,
                'label' => (string) ($n['name'] ?? $id),
                'path' => $path,
                'note' => 'Outbound nerves from this organ. Not a live impulse.',
            ];
        }
        return null;
    }

    /** @return array{lat:float,lon:float,tetra_face:int,path:list<int>,depth:int} */
    public static function address(float $lat, float $lon, int $depth = 6): array
    {
        $p = self::latLonToVec($lat, $lon);
        $verts = self::tetraVerts();
        $faces = self::tetraFaces();
        $face = self::closestFace($p, $verts, $faces);
        $tri = [
            $verts[$faces[$face][0]],
            $verts[$faces[$face][1]],
            $verts[$faces[$face][2]],
        ];
        $path = [];
        $d = max(0, min(12, $depth));
        for ($i = 0; $i < $d; $i++) {
            $child = self::closestChild($p, $tri);
            $path[] = $child;
            $tri = self::childTriangle($tri, $child);
        }
        return [
            'lat' => $lat,
            'lon' => $lon,
            'tetra_face' => $face,
            'path' => $path,
            'depth' => $d,
        ];
    }

    public static function cellKey(array $addr): string
    {
        return (string) ($addr['tetra_face'] ?? 0) . ':' . implode('', $addr['path'] ?? []);
    }

    private static function cellMatch(array $node, string $cell): bool
    {
        $geo = $node['geography'] ?? null;
        if (!is_array($geo) || !isset($geo['lat'], $geo['lon'])) {
            return false;
        }
        $addr = self::address((float) $geo['lat'], (float) $geo['lon'], max(1, strlen($cell) - 2));
        $key = self::cellKey($addr);
        return str_starts_with($key, $cell) || str_starts_with($cell, $key);
    }

    private static function hay(array $row, string $q): bool
    {
        $parts = [
            $row['id'] ?? '',
            $row['name'] ?? '',
            $row['label'] ?? '',
            $row['anatomy'] ?? '',
            $row['technical_type'] ?? '',
            $row['technical'] ?? '',
            $row['type'] ?? '',
            $row['note'] ?? '',
            $row['provenance'] ?? '',
            $row['narrative'] ?? '',
            is_array($row['geography'] ?? null) ? ($row['geography']['place'] ?? '') : '',
        ];
        $hay = function_exists('mb_strtolower')
            ? mb_strtolower(implode(' ', $parts))
            : strtolower(implode(' ', $parts));
        return str_contains($hay, $q);
    }

    /** @return list<array{0:float,1:float,2:float}> */
    private static function tetraVerts(): array
    {
        $s = 1 / sqrt(3.0);
        return [
            [$s, $s, $s],
            [$s, -$s, -$s],
            [-$s, $s, -$s],
            [-$s, -$s, $s],
        ];
    }

    /** @return list<array{0:int,1:int,2:int}> */
    private static function tetraFaces(): array
    {
        return [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
    }

    /** @param array{0:float,1:float,2:float} $p */
    private static function closestFace(array $p, array $verts, array $faces): int
    {
        $best = 0;
        $bestDot = -INF;
        foreach ($faces as $i => $f) {
            $c = self::norm(self::add(self::add($verts[$f[0]], $verts[$f[1]]), $verts[$f[2]]));
            $d = self::dot($c, $p);
            if ($d > $bestDot) {
                $bestDot = $d;
                $best = $i;
            }
        }
        return $best;
    }

    /** @param list<array{0:float,1:float,2:float}> $tri */
    private static function closestChild(array $p, array $tri): int
    {
        $children = [0, 1, 2, 3];
        $best = 0;
        $bestDot = -INF;
        foreach ($children as $c) {
            $t = self::childTriangle($tri, $c);
            $cent = self::norm(self::add(self::add($t[0], $t[1]), $t[2]));
            $d = self::dot($cent, $p);
            if ($d > $bestDot) {
                $bestDot = $d;
                $best = $c;
            }
        }
        return $best;
    }

    /**
     * @param list<array{0:float,1:float,2:float}> $tri
     * @return list<array{0:float,1:float,2:float}>
     */
    private static function childTriangle(array $tri, int $child): array
    {
        $m01 = self::norm(self::add($tri[0], $tri[1]));
        $m12 = self::norm(self::add($tri[1], $tri[2]));
        $m20 = self::norm(self::add($tri[2], $tri[0]));
        return match ($child) {
            0 => [$tri[0], $m01, $m20],
            1 => [$tri[1], $m12, $m01],
            2 => [$tri[2], $m20, $m12],
            default => [$m01, $m12, $m20],
        };
    }

    /** @return array{0:float,1:float,2:float} */
    private static function latLonToVec(float $lat, float $lon): array
    {
        $phi = deg2rad(90.0 - $lat);
        $th = deg2rad($lon);
        return [
            sin($phi) * cos($th),
            cos($phi),
            sin($phi) * sin($th),
        ];
    }

    /** @param array{0:float,1:float,2:float} $a */
    private static function add(array $a, array $b): array
    {
        return [$a[0] + $b[0], $a[1] + $b[1], $a[2] + $b[2]];
    }

    /** @param array{0:float,1:float,2:float} $a */
    private static function dot(array $a, array $b): float
    {
        return $a[0] * $b[0] + $a[1] * $b[1] + $a[2] * $b[2];
    }

    /** @param array{0:float,1:float,2:float} $a */
    private static function norm(array $a): array
    {
        $l = sqrt(self::dot($a, $a));
        if ($l < 1e-12) {
            return [0.0, 1.0, 0.0];
        }
        return [$a[0] / $l, $a[1] / $l, $a[2] / $l];
    }
}
