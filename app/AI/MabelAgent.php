<?php
declare(strict_types=1);

/**
 * Mabel: interpretive oracle. She proposes neighbourhoods. She never writes canon.
 */
final class MabelAgent
{
    /**
     * @param list<string> $slugs
     * @param list<float> $vector
     * @return array{status:string,note:string,detected_molecules:list<array>,recurrence_score:float,canon:false}
     */
    public static function evaluateTopology(array $slugs, array $vector, array $viewer): array
    {
        $molecules = [];
        $byType = [];
        foreach ($slugs as $slug) {
            $n = ttg_graph_node((string) $slug);
            if (!$n || !ttg_graph_public($n)) continue;
            $type = strtoupper((string) ($n['type'] ?? 'UNKNOWN'));
            $byType[$type][] = (string) ($n['title'] ?? $slug);
        }
        foreach ($byType as $type => $titles) {
            $molecules[] = [
                'kind' => $type,
                'members' => array_values(array_slice($titles, 0, 6)),
                'status' => 'proposal',
            ];
        }
        $recurrence = isset($vector[6]) ? (float) $vector[6] : 0.0;
        $recurrence = max(0.0, min(1.0, $recurrence + count($slugs) * 0.08));

        $note = $molecules === []
            ? 'No topological neighbourhood yet. I will not invent a molecule.'
            : ('Recurrence proposed, not written. ' . $molecules[0]['kind'] . ' neighbourhood in view. Interpretation only.');

        return [
            'status' => 'PROPOSAL',
            'note' => $note,
            'detected_molecules' => array_slice($molecules, 0, 8),
            'recurrence_score' => round($recurrence, 4),
            'canon' => false,
        ];
    }
}
