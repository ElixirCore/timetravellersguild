<?php
declare(strict_types=1);

/**
 * Canonical emergy. Never rewrite the governing equation —
 * only normalise for instrument display.
 *
 *   E_raw = M / R^(κ · ΔC)
 */
function ttg_machine_config(): array
{
    static $cfg;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
    }
    return $cfg;
}

function ttg_machine_clamp(float $v, float $lo, float $hi): float
{
    if ($v < $lo) return $lo;
    if ($v > $hi) return $hi;
    return $v;
}

/** Canonical raw emergy. */
function ttg_machine_emergy_raw(float $mind, float $matter, float $deltaContext, float $kappa): float
{
    $m = ttg_machine_clamp($mind, 0.001, 1.0);
    $r = ttg_machine_clamp($matter, 0.001, 1.0);
    $c = ttg_machine_clamp($deltaContext, 0.0, 1.0);
    $k = ttg_machine_clamp($kappa, 0.0, 3.33);
    $exp = $k * $c;
    return $m / ($r ** $exp);
}

function ttg_machine_sigmoid(float $x): float
{
    return 1.0 / (1.0 + exp(-$x));
}

/**
 * Instrument level from raw emergy. Does not alter E_raw.
 */
function ttg_machine_emergy_display(float $raw): float
{
    $x = log(max($raw, 1e-9));
    // Centre roughly around E≈1 → mid instrument.
    return ttg_machine_clamp(ttg_machine_sigmoid(($x + 0.2) * 1.1), 0.0, 1.0);
}

/** @return array{raw:float,display:float} */
function ttg_machine_emergy(float $mind, float $matter, float $deltaContext, float $kappa): array
{
    $raw = ttg_machine_emergy_raw($mind, $matter, $deltaContext, $kappa);
    return [
        'raw' => $raw,
        'display' => ttg_machine_emergy_display($raw),
    ];
}
