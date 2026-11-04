<?php
declare(strict_types=1);

/**
 * Jack holds evidence. Mabel proposes interpretation. Neither writes canon.
 * WebGL / canvas is a projection. This file is the only writer of aperture turns.
 */
final class ApertureDialogueService
{
    /**
     * @param array{yaw?:float,z?:float,focus?:string} $body
     * @return array<string, mixed>
     */
    public static function exchange(string $userMessage, array $viewer, array $body = [], ?string $contextSlug = null): array
    {
        $rel = JackRelationship::load(JackPolicy::subjectKey($viewer));
        $node = $contextSlug ? ttg_graph_node($contextSlug) : null;
        $jack = JackAgent::clericalGate($userMessage, $viewer);
        $vector = ApertureDimensionTransformer::fromJackTurn($jack, $body);

        $mabel = ['status' => 'CONSENT_WITHHELD', 'note' => 'Interpretation withheld.', 'detected_molecules' => [], 'recurrence_score' => 0.0, 'canon' => false];
        $allow = ProposalHandoffPolicy::allowInterpretation($viewer, $rel, is_array($node) ? $node : null);
        if ($allow && ($jack['status'] ?? '') !== 'HALTED' && empty($jack['rejected_unverified'])) {
            $mabel = MabelAgent::evaluateTopology($jack['vetted_node_ids'] ?? [], $vector, $viewer);
        }

        $status = !empty($jack['rejected_unverified']) ? 'HALTED_BY_CLERK' : 'PENDING';
        $id = self::publicId();
        ApertureDialogueStore::append([
            'public_id' => $id,
            'conversation_id' => JackPolicy::subjectKey($viewer),
            'initiator_agent' => 'JACK',
            'target_agent' => 'MABEL',
            'context_slug' => $contextSlug,
            'jack_state' => $jack,
            'mabel_state' => $mabel,
            'hyper_vector' => $vector,
            'turn_status' => $status,
            'created_at' => gmdate('c'),
        ]);

        return [
            'ok' => true,
            'aperture_id' => $id,
            'canon' => false,
            'jack' => $jack,
            'mabel' => $mabel,
            'vector_7d' => $vector,
            'turn_status' => $status,
        ];
    }

    public static function publicId(): string
    {
        return sprintf(
            '%08x%04x%04x%04x%012x',
            time(),
            random_int(0, 0xffff),
            random_int(0, 0xffff),
            random_int(0, 0xffff),
            random_int(0, 0xffffffffffff)
        );
    }
}
