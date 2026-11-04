<?php
declare(strict_types=1);

final class JackTurn
{
    /**
     * @return array{reply:string,mode:string,claims:list<array>,proposedActions:list<array>,unresolvedQuestions:list<string>,relationshipUpdate:array,disturbance:?string}
     */
    public static function parse(string $raw, string $fallbackMode): array
    {
        $empty = [
            'reply' => '',
            'mode' => $fallbackMode,
            'claims' => [],
            'proposedActions' => [],
            'unresolvedQuestions' => [],
            'relationshipUpdate' => ['lastConsequence' => null, 'unresolvedThreads' => []],
            'disturbance' => null,
        ];
        $raw = trim($raw);
        if ($raw === '') return $empty;

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            if (str_starts_with($raw, '```')) {
                $raw = preg_replace('/^```(?:json)?\s*/i', '', $raw) ?? $raw;
                $raw = preg_replace('/\s*```$/', '', $raw) ?? $raw;
            }
            $start = strpos($raw, '{');
            $end = strrpos($raw, '}');
            if ($start !== false && $end !== false && $end > $start) {
                $data = json_decode(substr($raw, $start, $end - $start + 1), true);
            }
        }
        if (!is_array($data)) {
            $empty['reply'] = $raw;
            return $empty;
        }

        $reply = trim((string) ($data['reply'] ?? ''));
        if ($reply === '' && isset($data['text']) && is_string($data['text'])) {
            $reply = trim($data['text']);
        }
        $mode = strtolower((string) ($data['mode'] ?? $fallbackMode));
        $allowedModes = ['reception', 'clerk', 'after_hours', 'bartime', 'incident', 'contested_record', 'private_holding'];
        if (!in_array($mode, $allowedModes, true)) $mode = $fallbackMode;

        $claims = [];
        foreach (is_array($data['claims'] ?? null) ? $data['claims'] : [] as $c) {
            if (!is_array($c)) continue;
            $standing = strtolower((string) ($c['standing'] ?? 'unclassified'));
            if (!in_array($standing, JackPolicy::CLASSIFICATIONS, true)) $standing = 'unclassified';
            $sources = [];
            foreach (is_array($c['sourceIds'] ?? null) ? $c['sourceIds'] : [] as $sid) {
                if (is_string($sid) && $sid !== '') $sources[] = $sid;
            }
            $claims[] = [
                'text' => mb_substr(trim((string) ($c['text'] ?? '')), 0, 400),
                'standing' => $standing,
                'sourceIds' => array_slice($sources, 0, 6),
            ];
        }

        $actions = [];
        foreach (is_array($data['proposedActions'] ?? null) ? $data['proposedActions'] : [] as $a) {
            if (!is_array($a)) continue;
            $type = (string) ($a['type'] ?? '');
            if (!in_array($type, JackPolicy::PROPOSAL_TYPES, true)) continue;
            $actions[] = [
                'type' => $type,
                'payload' => is_array($a['payload'] ?? null) ? $a['payload'] : [],
                'requiresConfirmation' => true,
            ];
        }

        $questions = [];
        foreach (is_array($data['unresolvedQuestions'] ?? null) ? $data['unresolvedQuestions'] : [] as $q) {
            if (is_string($q) && trim($q) !== '') $questions[] = mb_substr(trim($q), 0, 200);
        }

        $disturbance = $data['disturbance'] ?? null;
        if (!is_string($disturbance) || trim($disturbance) === '') $disturbance = null;

        return [
            'reply' => $reply,
            'mode' => $mode,
            'claims' => $claims,
            'proposedActions' => $actions,
            'unresolvedQuestions' => array_slice($questions, 0, 5),
            'relationshipUpdate' => JackPolicy::sanitiseRelationshipUpdate(
                is_array($data['relationshipUpdate'] ?? null) ? $data['relationshipUpdate'] : []
            ),
            'disturbance' => $disturbance,
        ];
    }

    /**
     * @param list<array<string, mixed>> $actions
     * @return list<array<string, mixed>>
     */
    public static function proposalOps(array $actions, array $viewer, array $relationship): array
    {
        $ops = [];
        foreach ($actions as $action) {
            if (!JackPolicy::mayPropose($action, $viewer, $relationship)) continue;
            $type = (string) $action['type'];
            $label = match ($type) {
                'lodge_testimony' => 'Lodge this as testimony. It remains a proposal.',
                'propose_node' => 'Propose a record. A keeper must accept it.',
                'propose_edge' => 'Propose a relation. Not canon.',
                'propose_merge' => 'Propose a merge. Two eyes required.',
                'propose_memory' => 'Propose a memory. You may withdraw it.',
                'open_dispute' => 'Open a dispute. Both accounts will be kept.',
                'request_witness' => 'Request a witness.',
                'classify_unclassified_item' => 'Propose a classification. Unclassified may remain.',
                default => 'Proposal held.',
            };
            $context = self::actionContext($type, is_array($action['payload'] ?? null) ? $action['payload'] : []);
            $ops[] = [
                'kind' => $type === 'lodge_testimony' ? 'CAPTURE' : 'PROPOSE_EDGE',
                'label' => $label,
                'context' => $context,
            ];
        }
        return array_slice($ops, 0, 3);
    }

    public static function clip(string $s, int $max = 110): string
    {
        $s = trim(preg_replace('/\s+/u', ' ', $s) ?? $s);
        if ($s === '') return '';
        if (function_exists('mb_strlen') && mb_strlen($s) > $max) {
            return mb_substr($s, 0, $max - 1) . '…';
        }
        if (strlen($s) > $max) {
            return substr($s, 0, $max - 1) . '…';
        }
        return $s;
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function actionContext(string $type, array $payload): string
    {
        $get = static function (array $keys) use ($payload): string {
            foreach ($keys as $k) {
                $v = $payload[$k] ?? null;
                if (is_string($v) && trim($v) !== '') return trim($v);
            }
            return '';
        };

        $title = $get(['title', 'name', 'label']);
        $text = $get(['text', 'body', 'note', 'memory', 'testimony', 'summary']);
        $rel = $get(['relationship', 'relation', 'edge']);
        $src = $get(['source', 'from', 'a', 'left']);
        $tgt = $get(['target', 'to', 'b', 'right']);
        $cls = $get(['classification', 'standing', 'as']);
        $about = $get(['subject', 'about', 'of', 'slug']);

        $line = match ($type) {
            'propose_node' => $title !== '' ? ($title . ($text !== '' ? ' — ' . $text : '')) : $text,
            'propose_edge' => trim($src . ' · ' . ($rel !== '' ? $rel : 'related to') . ' · ' . $tgt, ' ·'),
            'propose_merge' => trim($src . ' with ' . $tgt),
            'propose_memory', 'lodge_testimony' => $text !== '' ? $text : $title,
            'open_dispute' => $text !== '' ? $text : trim($src . ' / ' . $tgt, ' /'),
            'request_witness' => $about !== '' ? $about : $text,
            'classify_unclassified_item' => trim(($title !== '' ? $title : $about) . ($cls !== '' ? ' as ' . $cls : '')),
            default => $title !== '' ? $title : $text,
        };

        return self::clip($line);
    }

    /**
     * @param array<string, mixed> $hit
     */
    public static function focusContext(array $hit): string
    {
        $bits = [];
        $type = str_replace('_', ' ', strtoupper(trim((string) ($hit['type'] ?? ''))));
        $place = trim((string) ($hit['place'] ?? ''));
        $status = trim((string) ($hit['status'] ?? ''));
        if ($type !== '' && $type !== 'UNKNOWN') $bits[] = $type;
        if ($place !== '' && $place !== 'unplaced') $bits[] = $place;
        if ($status !== '' && $status !== '—') $bits[] = $status;
        if (!empty($hit['pending'])) $bits[] = 'pending, not canon';
        $body = trim((string) ($hit['body'] ?? ''));
        if ($bits === [] && $body !== '') {
            return self::clip($body, 90);
        }
        return self::clip(implode(' · ', $bits), 90);
    }
}
