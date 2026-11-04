<?php
declare(strict_types=1);

/**
 * Deterministic policy. The model does not grant access.
 */
final class JackPolicy
{
    public const STANDINGS = [
        'unknown', 'visitor', 'returning_visitor', 'witness', 'contributor',
        'applicant', 'keeper', 'disputed', 'withdrawn',
    ];

    public const CLASSIFICATIONS = [
        'observed', 'testified', 'remembered', 'inferred', 'disputed',
        'proposed_canon', 'canon', 'private', 'unclassified',
    ];

    public const PROPOSAL_TYPES = [
        'propose_memory', 'propose_node', 'propose_edge', 'propose_merge',
        'lodge_testimony', 'open_dispute', 'request_witness', 'classify_unclassified_item',
    ];

    public static function viewer(): array
    {
        return ttg_graph_viewer();
    }

    public static function subjectKey(array $viewer): string
    {
        $slug = trim((string) ($viewer['slug'] ?? ''));
        if (!empty($viewer['known']) && $slug !== '') {
            return 'user:' . $slug;
        }
        $name = mb_strtolower(trim((string) ($viewer['name'] ?? '')));
        if (!empty($viewer['known']) && $name !== '') {
            return 'user:' . ttg_graph_slugify($name);
        }
        ttg_graph_boot_session();
        $sid = session_id();
        return 'session:' . ($sid !== '' ? $sid : 'anon');
    }

    /**
     * Keeper identity. Exact allowlist only — never a display-name substring.
     * Configure JACK_KEEPER_SLUGS / JACK_KEEPER_EMAILS (comma or space separated).
     */
    public static function isKeeper(array $viewer): bool
    {
        if (empty($viewer['known'])) {
            return false;
        }
        $slug = strtolower(trim((string) ($viewer['slug'] ?? '')));
        $email = strtolower(trim((string) ($viewer['email'] ?? '')));
        if ($slug !== '' && in_array($slug, self::keeperAllowlist('JACK_KEEPER_SLUGS', 'tobywhy'), true)) {
            return true;
        }
        if ($email !== '' && in_array($email, self::keeperAllowlist('JACK_KEEPER_EMAILS', ''), true)) {
            return true;
        }
        return false;
    }

    /** @deprecated Use isKeeper(). Kept for call-site compatibility. */
    public static function isToby(array $viewer): bool
    {
        return self::isKeeper($viewer);
    }

    /** @return list<string> */
    private static function keeperAllowlist(string $envKey, string $default): array
    {
        $raw = function_exists('ttg_env') ? (string) ttg_env($envKey, $default) : $default;
        $parts = preg_split('/[,\s]+/', strtolower(trim($raw))) ?: [];
        $out = [];
        foreach ($parts as $part) {
            $part = trim((string) $part);
            if ($part === '' || in_array($part, $out, true)) continue;
            $out[] = $part;
        }
        return $out;
    }

    public static function memoryConsented(array $relationship): bool
    {
        $scope = $relationship['consentScope'] ?? [];
        if (!is_array($scope)) $scope = [];
        if (in_array('WITHDRAWN', $scope, true) || ($relationship['standing'] ?? '') === 'withdrawn') {
            return false;
        }
        return !in_array('MEMORY_REVOKED', $scope, true);
    }

    public static function mayReadNode(?array $node, array $viewer, array $relationship): bool
    {
        if (!$node) return false;
        $vis = strtoupper((string) ($node['visibility'] ?? 'PUBLIC'));
        if ($vis === 'PRIVATE' || $vis === 'SEALED') {
            return false;
        }
        if (!ttg_graph_public($node)) return false;
        if (!self::memoryConsented($relationship) && !empty($node['metadata']['owner_key'])) {
            return (string) $node['metadata']['owner_key'] === self::subjectKey($viewer);
        }
        return true;
    }

    public static function classifyNode(array $node): string
    {
        if (!empty($node['pending'])) return 'proposed_canon';
        $given = strtolower((string) ($node['metadata']['classification'] ?? ''));
        if (in_array($given, self::CLASSIFICATIONS, true)) return $given;
        $status = strtoupper((string) ($node['status'] ?? ''));
        if ($status === 'PENDING') return 'proposed_canon';
        if ($status === 'UNRESOLVED' || strtoupper((string) ($node['type'] ?? '')) === 'UNKNOWN') {
            return 'unclassified';
        }
        return 'canon';
    }

    public static function classifyRecord(array $node, array $viewer): array
    {
        $body = (string) ($node['body'] ?? '');
        if (function_exists('mb_strlen') ? mb_strlen($body) > 280 : strlen($body) > 280) {
            $body = (function_exists('mb_substr') ? mb_substr($body, 0, 280) : substr($body, 0, 280)) . '…';
        }
        $place = '';
        if (function_exists('ttg_graph_meta')) {
            $place = ttg_graph_meta($node, 'place');
        }
        if ($place === '') {
            $place = (string) ($node['place'] ?? '');
        }
        return [
            'id' => (string) ($node['slug'] ?? $node['public_id'] ?? ''),
            'title' => (string) ($node['title'] ?? ''),
            'standing' => self::classifyNode($node),
            'source' => !empty($node['pending']) ? 'pending_inbox' : 'graph',
            'owner' => (string) ($node['metadata']['custodian'] ?? 'undisclosed'),
            'created_at' => (string) ($node['created_at'] ?? $node['observed_at'] ?? ''),
            'event_time' => (string) ($node['observed_at'] ?? ''),
            'visibility' => (string) ($node['visibility'] ?? 'PUBLIC'),
            'consent_scope' => 'JACK_READ',
            'confidence' => isset($node['importance']) ? (float) $node['importance'] : null,
            'supporting' => [],
            'dispute_state' => strtoupper((string) ($node['status'] ?? '')) === 'DISPUTED' ? 'open' : 'none',
            'place' => $place,
            'body' => $body,
        ];
    }

    public static function mayRevealDisturbance(array $disturbance, array $relationship): bool
    {
        $status = (string) ($disturbance['status'] ?? '');
        if ($status === 'locked') {
            $need = (string) ($disturbance['requiredEvent'] ?? '');
            $unlocked = $relationship['unlockedEvents'] ?? [];
            return $need !== '' && is_array($unlocked) && in_array($need, $unlocked, true);
        }
        $stage = (int) ($relationship['trustStage'] ?? 0);
        return $stage >= (int) ($disturbance['earliestRevealStage'] ?? 0);
    }

    /**
     * Model-proposed mutations are never executed here.
     * @param array<string, mixed> $action
     */
    public static function mayPropose(array $action, array $viewer, array $relationship): bool
    {
        $type = (string) ($action['type'] ?? '');
        if (!in_array($type, self::PROPOSAL_TYPES, true)) return false;
        if (($relationship['standing'] ?? '') === 'withdrawn' && $type !== 'request_witness') {
            return false;
        }
        if (!empty($action['executeNow'])) return false;
        return true;
    }

    public static function redactForeignState(array $relationship, string $subjectKey): array
    {
        if ((string) ($relationship['userId'] ?? '') !== $subjectKey) {
            return [];
        }
        unset($relationship['ip_hash']);
        return $relationship;
    }

    public static function sanitiseRelationshipUpdate(array $update): array
    {
        $out = [
            'lastConsequence' => null,
            'unresolvedThreads' => [],
        ];
        $c = $update['lastConsequence'] ?? null;
        if (is_string($c)) {
            $c = trim($c);
            if ($c !== '' && mb_strlen($c) <= 240) $out['lastConsequence'] = $c;
        }
        $threads = $update['unresolvedThreads'] ?? [];
        if (is_array($threads)) {
            foreach (array_slice($threads, 0, 5) as $t) {
                if (!is_string($t)) continue;
                $t = trim($t);
                if ($t === '' || mb_strlen($t) > 200) continue;
                $out['unresolvedThreads'][] = $t;
            }
        }
        return $out;
    }
}
