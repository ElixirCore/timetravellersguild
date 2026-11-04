<?php
declare(strict_types=1);

/**
 * Who may ask Mabel to interpret. She never receives a write path.
 */
final class ProposalHandoffPolicy
{
    public static function allowInterpretation(array $viewer, array $relationship, ?array $node = null): bool
    {
        if (($relationship['standing'] ?? '') === 'withdrawn') {
            return false;
        }
        if (!JackPolicy::memoryConsented($relationship)) {
            return false;
        }
        $scope = $relationship['consentScope'] ?? [];
        if (is_array($scope) && in_array('MABEL_WITHHELD', $scope, true)) {
            return false;
        }
        if ($node && !JackPolicy::mayReadNode($node, $viewer, $relationship)) {
            return false;
        }
        return true;
    }
}
