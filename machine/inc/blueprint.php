<?php
declare(strict_types=1);

/**
 * TIME MACHINE №13 — blueprint.
 *
 * The machine is assembled from this list. Every part is a typed component
 * (see /machine/js/components-*.js) placed on the cabinet, bound to a key in
 * the instrument store, and wired to a named action (see /machine/js/actions.js).
 * Add, move or rebind a part here; no scene code needs to change.
 *
 * Coordinates are metres in machine space: x right, y up, z towards the operator.
 * Cabinet face sits at z ≈ 0.56; crown front at z ≈ 0.42.
 */
return [
    'version' => 2,

    // Travel economy — how much charge a jump needs, how much the field supplies.
    'travel' => [
        'cost_base' => 0.18,        // fixed cost of any jump
        'cost_per_decade' => 0.24,  // added per log10(1 + |Δyears|)
        'capacity_base' => 0.38,    // charge available before emergy
        'capacity_gain' => 1.0,     // × emergy display level
        'charge_ms' => 1300,
        'transit_ms' => 2100,
        'arrive_ms' => 700,
    ],

    // Fixed destinations on the drum. Records from the field are appended live.
    'destinations' => [
        ['id' => 'now', 'label' => 'LOCAL PRESENT', 'at' => 'now', 'kind' => 'PRESET'],
        ['id' => 'network', 'label' => 'NETWORK PRESENT', 'at' => '2033-04-17T00:00:00Z', 'kind' => 'PRESET'],
        ['id' => 'epoch', 'label' => 'UNIX EPOCH', 'at' => '1970-01-01T00:00:00Z', 'kind' => 'PRESET'],
        ['id' => 'millennium', 'label' => 'MILLENNIUM', 'at' => '2000-01-01T00:00:00Z', 'kind' => 'PRESET'],
    ],

    // CRT pages, selectable from the MODE switch.
    'pages' => ['STATE', 'FIELD', 'LEDGER', 'FEED'],

    'components' => [
        // ── Face: left column ───────────────────────────────────────────
        [
            'type' => 'plaque', 'id' => 'jack', 'pos' => [-0.86, 1.68, 0.6],
            'text' => 'JACK', 'action' => 'openJack',
            'tip' => 'JACK — clerk channel. Opens the desk.',
        ],
        [
            'type' => 'scope', 'id' => 'scope', 'pos' => [-0.86, 1.26, 0.6],
            'size' => [0.46, 0.36], 'label' => 'FIELD SCOPE', 'action' => 'pageField',
            'tip' => 'FIELD SCOPE — records per year across the world tree. The amber cursor is machine present; the trace ripples with emergy. Click to open the FIELD page.',
        ],
        [
            'type' => 'annunciator', 'id' => 'status', 'pos' => [-0.86, 0.95, 0.6],
            'lamps' => [
                ['label' => 'READY', 'bind' => 'ready', 'color' => 0x55dd77],
                ['label' => 'HELD', 'bind' => 'held', 'color' => 0xffaa33],
                ['label' => 'TRANSIT', 'bind' => 'travelling', 'color' => 0x66aaff],
                ['label' => 'FAULT', 'bind' => 'fault', 'color' => 0xff4433],
            ],
            'tip' => 'ANNUNCIATOR — READY, HELD, TRANSIT and FAULT states of the instrument.',
        ],

        // ── Face: centre ────────────────────────────────────────────────
        [
            'type' => 'crt', 'id' => 'crt', 'pos' => [0, 1.28, 0.6],
            'size' => [1.0, 0.64], 'action' => 'toggleReadout',
            'tip' => 'CRT — the instrument page selected by MODE. Click for the full plain-language readout.',
        ],

        // ── Face: right column ──────────────────────────────────────────
        [
            'type' => 'gauge', 'id' => 'emergy', 'pos' => [0.88, 1.6, 0.6],
            'radius' => 0.2, 'bind' => 'emergy_display', 'label' => 'EMERGY E',
            'redline' => 0.88,
            'tip' => 'EMERGY — E = M / R^(κ·ΔC), sigmoid-normalised. Past the red line the field saturates.',
        ],
        [
            'type' => 'radar', 'id' => 'radar', 'pos' => [0.88, 1.18, 0.6],
            'size' => [0.4, 0.34], 'label' => 'ΔC AXES',
            'tip' => 'ΔC RADAR — contextual distance on five axes. The bright spoke is the axis selected on the ΔC switch.',
        ],
        [
            'type' => 'printer', 'id' => 'printer', 'pos' => [0.88, 0.93, 0.6],
            'tip' => 'TICKET PRINTER — issues a stub for every journey. Click a stub to read the LEDGER.',
        ],

        // ── Shelf: operator controls ────────────────────────────────────
        [
            'type' => 'knob', 'id' => 'mind', 'pos' => [-0.78, 0.72, 0.74],
            'bind' => 'mind', 'min' => 0.001, 'max' => 1, 'sweep' => 1.6, 'label' => 'MIND',
            'tip' => 'MIND — attention aperture. Wide admits association; narrow reads literal records.',
        ],
        [
            'type' => 'knob', 'id' => 'matter', 'pos' => [-0.39, 0.72, 0.74],
            'bind' => 'matter', 'min' => 0.001, 'max' => 1, 'sweep' => 1.6, 'label' => 'MATTER',
            'tip' => 'MATTER — evidential weight. High privileges dated canon; low admits pending slips.',
        ],
        [
            'type' => 'selector', 'id' => 'dc', 'pos' => [0, 0.72, 0.74],
            'bind' => 'dcAxis', 'options' => ['TIME', 'PLACE', 'PEOPLE', 'INSTITUTIONS', 'SYMBOLS'],
            'short' => ['TIM', 'PLC', 'PPL', 'INS', 'SYM'], 'label' => 'ΔC', 'commit' => true,
            'tip' => 'ΔC AXIS — which context axis dominates contextual distance. Click or drag to step.',
        ],
        [
            'type' => 'knob', 'id' => 'kappa', 'pos' => [0.39, 0.72, 0.74],
            'bind' => 'kappa', 'min' => 0, 'max' => 3.33, 'sweep' => 1.8, 'label' => 'κ', 'brass' => true,
            'tip' => 'κ — context constant (0–3.33). High κ penalises loose association.',
        ],
        [
            'type' => 'clock', 'id' => 'present', 'pos' => [0.78, 0.72, 0.74],
            'bind' => 'present', 'units' => ['YEAR', 'MONTH', 'DAY', 'HOUR'], 'label' => 'PRESENT',
            'tip' => 'PRESENT — wind the machine clock directly. Click to change wind unit; drag or scroll to turn.',
        ],

        // ── Key row ─────────────────────────────────────────────────────
        ['type' => 'key', 'id' => 'sync', 'pos' => [-0.55, 0.5, 0.76], 'label' => 'SYNC', 'action' => 'sync',
            'tip' => 'SYNC — set machine present to local present.'],
        ['type' => 'key', 'id' => 'net', 'pos' => [-0.19, 0.5, 0.76], 'label' => '2033', 'action' => 'setTime',
            'args' => ['at' => '2033-04-17T00:00:00Z'],
            'tip' => 'NETWORK — set machine present to 17 April 2033 without travelling.'],
        ['type' => 'key', 'id' => 'hold', 'pos' => [0.17, 0.5, 0.76], 'label' => 'HOLD', 'action' => 'toggleHold',
            'latch' => 'held', 'tip' => 'HOLD — freeze the punchcard transport. Press again to release.'],
        ['type' => 'key', 'id' => 'reset', 'pos' => [0.53, 0.5, 0.76], 'label' => 'RESET', 'action' => 'reset',
            'tip' => 'RESET — default mind, matter, κ; clear focus and selectors; clock to local present.'],

        // ── Crown ───────────────────────────────────────────────────────
        [
            'type' => 'selector', 'id' => 'mode', 'pos' => [-0.7, 2.1, 0.45],
            'bind' => 'page', 'options' => ['STATE', 'FIELD', 'LEDGER', 'FEED'],
            'short' => ['STA', 'FLD', 'LDG', 'FED'], 'label' => 'MODE', 'scale' => 1.15,
            'tip' => 'MODE — what the CRT shows: STATE, FIELD (timeline), LEDGER (journeys), FEED (slips).',
        ],
        [
            'type' => 'nixie', 'id' => 'register', 'pos' => [-0.05, 2.12, 0.42],
            'bind' => 'present', 'groups' => ['YEAR', 'MONTH', 'DAY', 'HOUR'], 'label' => 'MACHINE PRESENT',
            'tip' => 'REGISTER — machine present in nixie tubes. Click the top half of a group to advance it, bottom half to retard.',
        ],
        [
            'type' => 'lampbar', 'id' => 'charge', 'pos' => [-0.05, 1.96, 0.43],
            'count' => 16, 'bind' => 'charge', 'mark' => 'cost', 'label' => 'CHARGE',
            'tip' => 'CHARGE — bar fills during a jump. The red lamp marks what the selected destination costs.',
        ],
        [
            'type' => 'drum', 'id' => 'dest', 'pos' => [0.66, 2.1, 0.45],
            'bind' => 'destIndex', 'label' => 'DESTINATION',
            'tip' => 'DESTINATION DRUM — presets and every dated record on the world tree. Click top/bottom or scroll to turn.',
        ],
        ['type' => 'gears', 'id' => 'gearsL', 'pos' => [-1.06, 2.08, 0.32], 'mirror' => true,
            'tip' => 'DRIVE TRAIN — turns with emergy; races in transit.'],
        ['type' => 'gears', 'id' => 'gearsR', 'pos' => [1.06, 2.08, 0.32], 'mirror' => false,
            'tip' => 'DRIVE TRAIN — turns with emergy; races in transit.'],

        // ── Side mounts ─────────────────────────────────────────────────
        [
            'type' => 'bank', 'id' => 'bank', 'pos' => [-1.42, 1.15, 0.32],
            'max' => 9, 'bind' => 'excluded', 'label' => 'SELECTOR',
            'tip' => 'SELECTOR BANK — one switch per record kind. Down excludes that kind from the field.',
        ],
        [
            'type' => 'lever', 'id' => 'travel', 'pos' => [1.32, 1.2, 0.3],
            'length' => 0.5, 'action' => 'travel', 'label' => 'ENGAGE',
            'tip' => 'TRAVEL LEVER — pull down to jump to the destination on the drum. Needs charge ≥ cost.',
        ],
    ],
];
