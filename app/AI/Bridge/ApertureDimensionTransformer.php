<?php
declare(strict_types=1);

/**
 * Seven scalars for the orthoplex. Projection telemetry, not storage.
 */
final class ApertureDimensionTransformer
{
    /**
     * D1 X, D2 Y, D3 Z, D4 T_local, D5 provenance, D6 consent/boundary, D7 recurrence.
     *
     * @return list<float>
     */
    public static function fromJackTurn(array $jackTurn, array $body = []): array
    {
        $now = time();
        $vetted = $jackTurn['vetted_node_ids'] ?? [];
        $claims = (int) ($jackTurn['claims_count'] ?? count($vetted));
        $yaw = isset($body['yaw']) ? (float) $body['yaw'] : 0.0;
        return [
            round(sin($now * 0.001 + $yaw), 4),
            round(cos($now * 0.001 + $yaw * 0.5), 4),
            isset($body['z']) ? max(-1.0, min(1.0, (float) $body['z'] / 4.0)) : 0.0,
            round(($now % 86400) / 86400.0, 4),
            $vetted !== [] ? 1.0 : 0.2,
            !empty($jackTurn['rejected_unverified']) ? 0.05 : 0.85,
            round(min($claims * 0.15, 1.0), 4),
        ];
    }
}
