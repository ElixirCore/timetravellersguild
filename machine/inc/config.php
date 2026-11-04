<?php
declare(strict_types=1);

/**
 * TIME MACHINE №13 — configurable matter weights and instrument defaults.
 * Knobs alter interpretation; these weights ground Matter in record kinds.
 */
return [
    'kappa_default' => 1.13,
    'kappa_min' => 0.0,
    'kappa_max' => 3.33,
    'mind_default' => 0.73,
    'matter_default' => 0.68,
    'card_cap' => 48,
    'feed_cap' => 24,
    'network_present' => '2033-04-17T00:00:00Z',
    'dc_axes' => ['TIME', 'PLACE', 'PEOPLE', 'INSTITUTIONS', 'SYMBOLS'],
    'matter_weights' => [
        'canon' => 1.00,
        'MEDIA' => 0.95,
        'DOCUMENT' => 0.90,
        'PLACE' => 0.90,
        'EVENT' => 0.85,
        'MOMENT' => 0.85,
        'PERSON' => 0.80,
        'INSTITUTION' => 0.75,
        'MISSION' => 0.70,
        'SIGNAL' => 0.55,
        'pending' => 0.60,
        'UNKNOWN' => 0.35,
        'symbolic' => 0.20,
        'default' => 0.50,
    ],
];
