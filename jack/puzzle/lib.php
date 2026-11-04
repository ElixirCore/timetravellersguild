<?php
declare(strict_types=1);

/**
 * Real IBM 80-column (Hollerith / BCD) letter encoding as issued on the circular.
 * Zone 12/11/0 plus a numeric punch. Digits use the numeric row alone.
 */

function ttg_hollerith_map(): array
{
    $m = [];
    foreach (['A','B','C','D','E','F','G','H','I'] as $i => $ch) {
        $m[$ch] = [12, $i + 1];
    }
    foreach (['J','K','L','M','N','O','P','Q','R'] as $i => $ch) {
        $m[$ch] = [11, $i + 1];
    }
    $zero = ['S' => 2, 'T' => 3, 'U' => 4, 'V' => 5, 'W' => 6, 'X' => 7, 'Y' => 8, 'Z' => 9];
    foreach ($zero as $ch => $n) {
        $m[$ch] = [0, $n];
    }
    for ($d = 0; $d <= 9; $d++) {
        $m[(string) $d] = [$d];
    }
    $m[' '] = [];
    return $m;
}

/** @return list<list<int>> */
function ttg_hollerith_columns(string $text): array
{
    $map = ttg_hollerith_map();
    $cols = [];
    $text = strtoupper($text);
    $len = strlen($text);
    for ($i = 0; $i < $len; $i++) {
        $ch = $text[$i];
        if (!isset($map[$ch])) continue;
        $cols[] = $map[$ch];
    }
    return $cols;
}

function ttg_hollerith_decode_col(array $rows): string
{
    $map = ttg_hollerith_map();
    sort($rows);
    foreach ($map as $ch => $want) {
        $w = $want;
        sort($w);
        if ($w === $rows) return $ch === ' ' || $ch === '' ? ' ' : (string) $ch;
    }
    return '?';
}

function ttg_hollerith_decode(array $cols): string
{
    $out = '';
    foreach ($cols as $rows) {
        $out .= ttg_hollerith_decode_col($rows);
    }
    return rtrim($out);
}

function ttg_puzzle_norm(string $n, string $raw): string
{
    $s = trim(preg_replace('/\s+/u', ' ', $raw) ?? $raw);
    if ($n === '05' || $n === '06') {
        return preg_replace('/\D+/', '', $s) ?? '';
    }
    $s = strtoupper($s);
    if (in_array($n, ['02', '03', '04', '07'], true)) {
        return preg_replace('/[^A-Z]/', '', $s) ?? '';
    }
    return $s;
}

/** SHA-256 of the canonical answers. The plaintext lives only here and on the solutions page. */
function ttg_puzzle_hashes(): array
{
    return [
        '01' => hash('sha256', 'ASK WHAT ENTERED THE FIELD'),
        '02' => hash('sha256', 'WITNESS'),
        '03' => hash('sha256', 'TRUST'),
        '04' => hash('sha256', 'AGENCY'),
        '05' => hash('sha256', '2418'),
        '06' => hash('sha256', '334'),
        '07' => hash('sha256', 'KINDNESS'),
        'card' => hash('sha256', 'ASK WHAT ENTERED THE FIELD. I enter as a WITNESS. I offer TRUST, retain AGENCY, and proceed with KINDNESS. REFERENCE: FILE 2418 / WAREHOUSE 334.'),
    ];
}

function ttg_puzzle_card_text(): string
{
    return 'ASK WHAT ENTERED THE FIELD. I enter as a WITNESS. I offer TRUST, retain AGENCY, and proceed with KINDNESS. REFERENCE: FILE 2418 / WAREHOUSE 334.';
}

function ttg_puzzle_ok(string $n, string $raw): bool
{
    $hashes = ttg_puzzle_hashes();
    if (!isset($hashes[$n])) return false;
    return hash_equals($hashes[$n], hash('sha256', ttg_puzzle_norm($n, $raw)));
}

function ttg_puzzle_stamp(string $card): string
{
    return strtoupper(substr(hash('sha256', trim($card)), 0, 12));
}

/**
 * Render a real punch card. Every hole corresponds to the issued encoding. No decorative punches.
 */
function ttg_hollerith_svg(string $text, string $title, int $totalCols = 0, bool $printText = false): string
{
    $cols = ttg_hollerith_columns($text);
    $n = $totalCols > 0 ? $totalCols : count($cols) + 2;
    if ($n < count($cols)) $n = count($cols);
    $rows = [12, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    $cw = $n >= 60 ? 11 : 14;
    $rh = 15;
    $left = 28;
    $top = 26;
    $w = $left + $n * $cw + 10;
    $h = $top + count($rows) * $rh + ($printText ? 28 : 16);
    $svg = '<svg class="punch-svg" viewBox="0 0 ' . $w . ' ' . $h . '" role="img" aria-label="' . htmlspecialchars($title, ENT_QUOTES) . '">';
    $svg .= '<rect x="1" y="1" width="' . ($w - 2) . '" height="' . ($h - 2) . '" class="card-body"/>';
    $svg .= '<polygon points="1,1 16,1 1,16" class="card-clip"/>';
    foreach ($rows as $ri => $row) {
        $y = $top + $ri * $rh + $rh / 2;
        $svg .= '<text x="14" y="' . ($y + 3.5) . '" class="row-lab">' . $row . '</text>';
        $svg .= '<line x1="' . $left . '" y1="' . $y . '" x2="' . ($w - 8) . '" y2="' . $y . '" class="row-rule"/>';
    }
    for ($ci = 0; $ci < $n; $ci++) {
        $holes = $cols[$ci] ?? [];
        $x = $left + $ci * $cw + $cw / 2;
        $punch = $holes === [] ? 'blank' : implode('+', $holes);
        $svg .= '<text x="' . $x . '" y="16" class="col-lab' . ($ci >= count($cols) ? ' dim' : '') . '">' . ($ci + 1) . '</text>';
        $svg .= '<rect class="col-hit" data-col="' . ($ci + 1) . '" data-rows="' . htmlspecialchars($punch, ENT_QUOTES) . '" x="' . ($left + $ci * $cw) . '" y="' . $top . '" width="' . $cw . '" height="' . (count($rows) * $rh) . '"/>';
        foreach ($holes as $hole) {
            $ri = array_search($hole, $rows, true);
            if ($ri === false) continue;
            $y = $top + ((int) $ri) * $rh + $rh / 2;
            $rx = $n >= 60 ? 3.4 : 4.4;
            $svg .= '<ellipse cx="' . $x . '" cy="' . $y . '" rx="' . $rx . '" ry="3.8" class="hole" data-col="' . ($ci + 1) . '" data-rows="' . htmlspecialchars($punch, ENT_QUOTES) . '"/>';
        }
        if ($printText && isset($cols[$ci])) {
            $ch = ttg_hollerith_decode_col($holes);
            $svg .= '<text x="' . $x . '" y="' . ($h - 8) . '" class="print-lab">' . htmlspecialchars($ch === ' ' ? '·' : $ch, ENT_QUOTES) . '</text>';
        }
    }
    $svg .= '</svg>';
    return $svg;
}
