<?php
declare(strict_types=1);

final class OfficeDispatcher
{
    public OfficeStore $store;
    public OfficeQuotas $quotas;
    public string $runId;
    public string $actor = 'JACK';
    public ?string $model = null;

    public function __construct(?OfficeStore $store = null, ?OfficeQuotas $quotas = null)
    {
        $this->store = $store ?? new OfficeStore();
        $this->store->boot();
        $this->quotas = $quotas ?? new OfficeQuotas();
        $this->runId = bin2hex(random_bytes(8));
    }

    /**
     * @param array<string, mixed> $arguments
     * @return array<string, mixed>
     */
    public function dispatch(string $name, array $arguments): array
    {
        $name = strtolower(trim($name));
        $quota = $this->quotas->checkTool();
        if ($quota !== null) {
            return $this->fail($name, $arguments, $quota);
        }
        $v = OfficeSchema::validate($name, $arguments);
        if ($v['ok'] !== true) {
            return $this->fail($name, $arguments, (string) ($v['error'] ?? 'invalid_field'));
        }
        $args = $v['args'] ?? [];
        try {
            $result = match ($name) {
                'list_station' => $this->listStation($args),
                'read_record' => $this->readRecord($args),
                'search_office' => $this->searchOffice($args),
                'list_links' => $this->listLinks($args),
                'create_folder' => $this->createFolder($args),
                'write_note' => $this->writeNote($args),
                'revise_note' => $this->reviseNote($args),
                'move_record' => $this->moveRecord($args),
                'link_records' => $this->linkRecords($args),
                'mark_unclassified' => $this->markUnclassified($args),
                'retire_record' => $this->retireRecord($args),
                'propose_programme' => $this->proposeProgramme($args),
                'enable_programme' => $this->enableProgramme($args),
                'disable_programme' => $this->disableProgramme($args),
                'run_programme_preview' => $this->previewProgramme($args),
                'run_programme' => $this->runProgramme($args),
                'request_dream_window' => $this->requestDream($args),
                'keep_dream' => $this->keepDream($args),
                'forget_dream' => $this->forgetDream($args),
                default => throw new InvalidArgumentException('unknown_tool'),
            };
            $this->ledger($name, $args, 'accepted', $result['approval_state'] ?? 'n/a', $result['result'] ?? 'ok', $result);
            return $result;
        } catch (InvalidArgumentException $e) {
            return $this->fail($name, $args, $e->getMessage());
        } catch (Throwable $e) {
            return $this->fail($name, $args, 'rejected');
        }
    }

    /**
     * @param array<string, mixed> $args
     * @return array<string, mixed>
     */
    private function fail(string $name, array $args, string $error): array
    {
        $this->ledger($name, $args, $error, 'rejected', $error, []);
        return ['ok' => false, 'error' => $error];
    }

    /**
     * @param array<string, mixed> $args
     * @param array<string, mixed> $result
     */
    private function ledger(string $action, array $args, string $validation, string $approval, string $outcome, array $result): void
    {
        $targets = [];
        foreach (['record_id', 'folder_id', 'parent_id', 'programme_id', 'dream_id', 'from_record_id', 'to_record_id', 'station_id'] as $k) {
            if (!empty($args[$k]) && is_string($args[$k])) $targets[] = $args[$k];
        }
        if (!empty($result['id']) && is_string($result['id'])) $targets[] = $result['id'];
        OfficeLedger::append($this->store->root(), [
            'actor' => $this->actor,
            'session_or_run_id' => $this->runId,
            'action' => $action,
            'target_record_ids' => array_values(array_unique($targets)),
            'request_summary' => $action . ' ' . OfficeLedger::safeSummary((string) json_encode($args, JSON_UNESCAPED_UNICODE)),
            'validation_result' => $validation,
            'approval_state' => $approval,
            'result' => $outcome,
            'previous_revision_id' => $result['previous_revision_id'] ?? null,
            'new_revision_id' => $result['new_revision_id'] ?? null,
            'programme_id' => $result['programme_id'] ?? ($args['programme_id'] ?? null),
            'model' => $this->model,
        ]);
    }

    /** @param array<string, mixed> $args */
    private function listStation(array $args): array
    {
        $id = $this->requireId((string) $args['station_id']);
        $st = $this->store->get($id);
        if (!$st || ($st['kind'] ?? '') !== 'station') {
            throw new InvalidArgumentException('not_found');
        }
        $cursor = (int) ($args['cursor'] ?? 0);
        $limit = (int) ($args['limit'] ?? 20);
        return ['ok' => true, 'station' => $this->store->publicRecord($st), 'records' => $this->store->children($id, $limit, $cursor)];
    }

    /** @param array<string, mixed> $args */
    private function readRecord(array $args): array
    {
        $id = $this->requireId((string) $args['record_id']);
        $rec = $this->store->get($id);
        if (!$rec) throw new InvalidArgumentException('not_found');
        return ['ok' => true, 'record' => $this->store->publicRecord($rec)];
    }

    /** @param array<string, mixed> $args */
    private function searchOffice(array $args): array
    {
        $ids = [];
        foreach ($args['station_ids'] ?? [] as $s) {
            $id = OfficePath::recordId((string) $s);
            if ($id !== '') $ids[] = $id;
        }
        return ['ok' => true, 'records' => $this->store->search((string) $args['query'], $ids, (int) ($args['limit'] ?? 20))];
    }

    /** @param array<string, mixed> $args */
    private function listLinks(array $args): array
    {
        $id = $this->requireId((string) $args['record_id']);
        if (!$this->store->get($id)) throw new InvalidArgumentException('not_found');
        return ['ok' => true, 'links' => $this->store->linksFor($id)];
    }

    /** @param array<string, mixed> $args */
    private function createFolder(array $args): array
    {
        $q = $this->quotas->checkFolder();
        if ($q !== null) throw new InvalidArgumentException($q);
        $parentId = $this->requireId((string) $args['parent_id']);
        $parent = $this->mustParent($parentId);
        $name = trim((string) $args['display_name']);
        $slug = OfficePath::safeSlug($this->slugFromName($name));
        if ($slug === '') throw new InvalidArgumentException('path_rejected');
        $rec = $this->store->blankRecord(OfficePath::mintRecordId(), 'folder', $parentId, $slug, $name);
        $rec['epistemic_status'] = 'inferred';
        $rec['body'] = trim((string) $args['reason']);
        $saved = $this->store->saveNew($rec);
        return ['ok' => true, 'id' => $saved['id'], 'record' => $this->store->publicRecord($saved), 'result' => 'created', 'new_revision_id' => 1];
    }

    /** @param array<string, mixed> $args */
    private function writeNote(array $args): array
    {
        $folderId = $this->requireId((string) $args['folder_id']);
        $this->mustParent($folderId);
        $body = (string) $args['body'];
        $this->assertNoteSize($body);
        $status = (string) $args['epistemic_status'];
        if ($status === 'canonical') throw new InvalidArgumentException('canonical_forbidden');
        $title = trim((string) $args['title']);
        $slug = OfficePath::safeSlug($this->slugFromName($title));
        if ($slug === '') throw new InvalidArgumentException('path_rejected');
        $sources = [];
        foreach ($args['source_record_ids'] ?? [] as $sid) {
            $id = OfficePath::recordId((string) $sid);
            if ($id !== '' && $this->store->get($id)) $sources[] = $id;
        }
        $rec = $this->store->blankRecord(OfficePath::mintRecordId(), 'note', $folderId, $slug, $title);
        $rec['body'] = $body;
        $rec['epistemic_status'] = $status;
        $rec['source_record_ids'] = $sources;
        $tags = [];
        foreach ($args['tags'] ?? [] as $t) {
            $s = OfficePath::safeSlug((string) $t);
            if ($s !== '') $tags[] = $s;
        }
        $rec['tags'] = array_slice(array_values(array_unique($tags)), 0, 8);
        $saved = $this->store->saveNew($rec);
        return ['ok' => true, 'id' => $saved['id'], 'record' => $this->store->publicRecord($saved), 'result' => 'created', 'new_revision_id' => 1];
    }

    /** @param array<string, mixed> $args */
    private function reviseNote(array $args): array
    {
        $id = $this->requireId((string) $args['record_id']);
        $rec = $this->store->get($id);
        if (!$rec || ($rec['kind'] ?? '') !== 'note') throw new InvalidArgumentException('not_found');
        if (!empty($rec['protected'])) throw new InvalidArgumentException('protected_station');
        $body = (string) $args['body'];
        $this->assertNoteSize($body);
        $prev = (int) ($rec['revision'] ?? 1);
        $rec['body'] = $body;
        $rec['revision'] = $prev + 1;
        $rec['updated_at'] = gmdate('c');
        $saved = $this->store->saveRevision($rec, null);
        return [
            'ok' => true,
            'id' => $id,
            'record' => $this->store->publicRecord($saved),
            'previous_revision_id' => $prev,
            'new_revision_id' => $saved['revision'],
            'result' => 'revised',
        ];
    }

    /** @param array<string, mixed> $args */
    private function moveRecord(array $args): array
    {
        $id = $this->requireId((string) $args['record_id']);
        $dest = $this->requireId((string) $args['destination_folder_id']);
        $rec = $this->store->get($id);
        if (!$rec) throw new InvalidArgumentException('not_found');
        if (!empty($rec['protected']) || ($rec['kind'] ?? '') === 'station') {
            throw new InvalidArgumentException('protected_station');
        }
        $this->mustParent($dest);
        if ($dest === $id) throw new InvalidArgumentException('path_rejected');
        $prev = (int) ($rec['revision'] ?? 1);
        $rec['parent_id'] = $dest;
        $rec['station_id'] = $this->store->stationOf($dest);
        $rec['revision'] = $prev + 1;
        $rec['updated_at'] = gmdate('c');
        $saved = $this->store->saveRevision($rec, null);
        return ['ok' => true, 'id' => $id, 'record' => $this->store->publicRecord($saved), 'previous_revision_id' => $prev, 'new_revision_id' => $saved['revision'], 'result' => 'moved'];
    }

    /** @param array<string, mixed> $args */
    private function linkRecords(array $args): array
    {
        $from = $this->requireId((string) $args['from_record_id']);
        $to = $this->requireId((string) $args['to_record_id']);
        if ($from === $to) throw new InvalidArgumentException('invalid_field');
        if (!$this->store->get($from) || !$this->store->get($to)) throw new InvalidArgumentException('not_found');
        $rel = OfficePath::safeSlug(strtolower(str_replace('_', '-', (string) $args['relation'])));
        if ($rel === '') {
            $rel = substr(preg_replace('/[^a-z0-9-]+/i', '-', (string) $args['relation']) ?? 'related', 0, 64);
            $rel = OfficePath::safeSlug(strtolower(trim($rel, '-'))) ?: 'related';
        }
        $link = [
            'id' => 'jlnk_' . bin2hex(random_bytes(6)),
            'from' => $from,
            'to' => $to,
            'relation' => $rel,
            'reason' => (string) $args['reason'],
            'created_at' => gmdate('c'),
            'retired' => false,
        ];
        $this->store->addLink($link);
        return ['ok' => true, 'link' => $link, 'result' => 'linked'];
    }

    /** @param array<string, mixed> $args */
    private function markUnclassified(array $args): array
    {
        $id = $this->requireId((string) $args['record_id']);
        $dest = OfficeConfig::stationId('UNCLASSIFIED');
        return $this->moveRecord([
            'record_id' => $id,
            'destination_folder_id' => $dest,
            'reason' => (string) $args['reason'],
        ]);
    }

    /** @param array<string, mixed> $args */
    private function retireRecord(array $args): array
    {
        $id = $this->requireId((string) $args['record_id']);
        $rec = $this->store->get($id);
        if (!$rec) throw new InvalidArgumentException('not_found');
        if (!empty($rec['protected']) || ($rec['kind'] ?? '') === 'station') {
            throw new InvalidArgumentException('protected_station');
        }
        $prev = (int) ($rec['revision'] ?? 1);
        $retired = OfficeConfig::stationId('RETIRED');
        $rec['previous_parent_id'] = $rec['parent_id'] ?? null;
        $rec['parent_id'] = $retired;
        $rec['station_id'] = $retired;
        $rec['retired'] = true;
        $rec['revision'] = $prev + 1;
        $rec['updated_at'] = gmdate('c');
        $saved = $this->store->saveRevision($rec, null);
        return ['ok' => true, 'id' => $id, 'record' => $this->store->publicRecord($saved), 'previous_revision_id' => $prev, 'new_revision_id' => $saved['revision'], 'result' => 'retired'];
    }

    /** @param array<string, mixed> $args */
    private function proposeProgramme(array $args): array
    {
        $v = ProgrammeManifest::validate($args['manifest'] ?? null);
        if ($v['ok'] !== true) throw new InvalidArgumentException((string) ($v['error'] ?? 'invalid_manifest'));
        $parent = OfficeConfig::stationId('PROGRAMMES');
        $name = trim((string) $args['display_name']);
        $slug = OfficePath::safeSlug($this->slugFromName($name));
        if ($slug === '') throw new InvalidArgumentException('path_rejected');
        $rec = $this->store->blankRecord(OfficePath::mintRecordId(), 'programme', $parent, $slug, $name);
        $rec['body'] = trim((string) $args['purpose']);
        $rec['epistemic_status'] = 'proposed';
        $rec['enabled'] = false;
        $rec['manifest'] = $v['manifest'];
        $rec['programme_version'] = 1;
        $rec['human_decision'] = 'awaiting';
        $rec['run_history'] = [];
        $saved = $this->store->saveNew($rec);
        return [
            'ok' => true,
            'id' => $saved['id'],
            'programme_id' => $saved['id'],
            'record' => $this->store->publicRecord($saved),
            'approval_state' => 'awaiting_authority',
            'result' => 'proposed',
            'new_revision_id' => 1,
        ];
    }

    /** @param array<string, mixed> $args */
    private function enableProgramme(array $args): array
    {
        $id = $this->requireId((string) $args['programme_id']);
        $rec = $this->store->get($id);
        if (!$rec || ($rec['kind'] ?? '') !== 'programme') throw new InvalidArgumentException('not_found');
        if ($this->actor !== 'TOBY') {
            throw new InvalidArgumentException('needs_approval');
        }
        $prev = (int) ($rec['revision'] ?? 1);
        $rec['enabled'] = true;
        if (($rec['human_decision'] ?? '') === 'disabled') {
            $rec['programme_version'] = (int) ($rec['programme_version'] ?? 1) + 1;
        }
        $rec['human_decision'] = 'approved';
        $rec['revision'] = $prev + 1;
        $rec['updated_at'] = gmdate('c');
        $saved = $this->store->saveRevision($rec, null);
        return ['ok' => true, 'id' => $id, 'programme_id' => $id, 'approval_state' => 'approved', 'result' => 'enabled', 'previous_revision_id' => $prev, 'new_revision_id' => $saved['revision']];
    }

    /** @param array<string, mixed> $args */
    private function disableProgramme(array $args): array
    {
        $id = $this->requireId((string) $args['programme_id']);
        $rec = $this->store->get($id);
        if (!$rec || ($rec['kind'] ?? '') !== 'programme') throw new InvalidArgumentException('not_found');
        $prev = (int) ($rec['revision'] ?? 1);
        $rec['enabled'] = false;
        $rec['human_decision'] = 'disabled';
        $rec['revision'] = $prev + 1;
        $rec['updated_at'] = gmdate('c');
        $saved = $this->store->saveRevision($rec, null);
        return ['ok' => true, 'id' => $id, 'programme_id' => $id, 'result' => 'disabled', 'previous_revision_id' => $prev, 'new_revision_id' => $saved['revision']];
    }

    /** @param array<string, mixed> $args */
    private function previewProgramme(array $args): array
    {
        $id = $this->requireId((string) $args['programme_id']);
        $rec = $this->store->get($id);
        if (!$rec || ($rec['kind'] ?? '') !== 'programme') throw new InvalidArgumentException('not_found');
        $preview = ProgrammeInterpreter::preview($rec, $this->store);
        $preview['programme_id'] = $id;
        $preview['result'] = 'preview';
        return $preview;
    }

    /** @param array<string, mixed> $args */
    private function runProgramme(array $args): array
    {
        $id = $this->requireId((string) $args['programme_id']);
        $rec = $this->store->get($id);
        if (!$rec || ($rec['kind'] ?? '') !== 'programme') throw new InvalidArgumentException('not_found');
        $out = ProgrammeInterpreter::run($rec, $this);
        $out['programme_id'] = $id;
        if (($out['error'] ?? '') === 'not_enabled' || ($out['error'] ?? '') === 'too_soon') {
            throw new InvalidArgumentException((string) $out['error']);
        }
        if (empty($out['ok'])) {
            throw new InvalidArgumentException((string) ($out['error'] ?? 'rejected'));
        }
        $this->rememberRun($rec, $out, false);
        return $out;
    }

    /**
     * @param array<string, mixed> $rec
     * @param array<string, mixed> $out
     */
    private function rememberRun(array $rec, array $out, bool $dry): void
    {
        $history = is_array($rec['run_history'] ?? null) ? $rec['run_history'] : [];
        array_unshift($history, [
            'run_id' => 'jrun_' . bin2hex(random_bytes(6)),
            'at' => gmdate('c'),
            'actor' => $this->actor,
            'mode' => $dry ? 'preview' : 'run',
            'matched' => count($out['matched'] ?? []),
            'result' => (string) ($out['result'] ?? ($out['error'] ?? '')),
        ]);
        $rec['run_history'] = array_slice($history, 0, 20);
        if (!$dry && ($out['result'] ?? '') === 'ran') {
            $rec['last_run_at'] = gmdate('c');
        }
        $rec['revision'] = (int) ($rec['revision'] ?? 1) + 1;
        $rec['updated_at'] = gmdate('c');
        $this->store->saveRevision($rec, null);
    }

    /** @param array<string, mixed> $args */
    private function requestDream(array $args): array
    {
        $parent = OfficeConfig::stationId('DREAMS');
        $theme = trim((string) $args['theme']);
        $slug = OfficePath::safeSlug($this->slugFromName($theme));
        if ($slug === '') throw new InvalidArgumentException('path_rejected');
        $sources = [];
        foreach ($args['eligible_station_ids'] ?? [] as $sid) {
            $id = OfficePath::recordId((string) $sid);
            if ($id !== '') $sources[] = $id;
        }
        $rec = $this->store->blankRecord(OfficePath::mintRecordId(), 'dream', $parent, $slug, $theme);
        $rec['epistemic_status'] = 'associative';
        $rec['warning'] = 'NON-EVIDENTIARY. ASSOCIATIVE MATERIAL.';
        $rec['body'] = 'Window requested. Not yet dreamt. Phase 1 holds the slip until the trusted runner is authorised.';
        $rec['source_record_ids'] = array_slice($sources, 0, OfficeConfig::MAX_DREAM_SOURCES);
        $rec['motifs'] = [];
        $saved = $this->store->saveNew($rec);
        return ['ok' => true, 'id' => $saved['id'], 'record' => $this->store->publicRecord($saved), 'result' => 'queued', 'new_revision_id' => 1];
    }

    /** @param array<string, mixed> $args */
    private function keepDream(array $args): array
    {
        $id = $this->requireId((string) $args['dream_id']);
        $rec = $this->store->get($id);
        if (!$rec || ($rec['kind'] ?? '') !== 'dream') throw new InvalidArgumentException('not_found');
        $prev = (int) ($rec['revision'] ?? 1);
        $rec['kept'] = true;
        $rec['revision'] = $prev + 1;
        $rec['updated_at'] = gmdate('c');
        $saved = $this->store->saveRevision($rec, null);
        return ['ok' => true, 'id' => $id, 'result' => 'kept', 'previous_revision_id' => $prev, 'new_revision_id' => $saved['revision']];
    }

    /** @param array<string, mixed> $args */
    private function forgetDream(array $args): array
    {
        return $this->retireRecord([
            'record_id' => (string) $args['dream_id'],
            'reason' => 'forget_dream',
        ]);
    }

    private function requireId(string $raw): string
    {
        $maybe = OfficePath::recordId($raw);
        if ($maybe !== '') return $maybe;
        $norm = str_replace('_', '-', strtoupper($raw));
        if (in_array($norm, OfficeConfig::STATIONS, true)) {
            return OfficeConfig::stationId($norm);
        }
        $norm2 = str_replace('-', '_', strtoupper($raw));
        $try = 'jsta_' . $norm2;
        if (OfficeConfig::isStationId($try)) return $try;
        throw new InvalidArgumentException('path_rejected');
    }

    /** @return array<string, mixed> */
    private function mustParent(string $id): array
    {
        $parent = $this->store->get($id);
        if (!$parent) throw new InvalidArgumentException('not_found');
        if (!empty($parent['retired'])) throw new InvalidArgumentException('not_found');
        $kind = (string) ($parent['kind'] ?? '');
        if ($kind !== 'station' && $kind !== 'folder') throw new InvalidArgumentException('invalid_parent');
        $station = $kind === 'station' ? $id : (string) ($parent['station_id'] ?? '');
        $name = OfficeConfig::stationName($station);
        if (in_array($name, OfficeConfig::NO_CHILDREN, true)) {
            throw new InvalidArgumentException('protected_station');
        }
        return $parent;
    }

    private function slugFromName(string $name): string
    {
        $s = strtolower(trim($name));
        $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
        $s = trim($s, '-');
        return $s !== '' ? $s : 'folder';
    }

    private function assertNoteSize(string $body): void
    {
        if (strlen($body) > OfficeConfig::maxNoteBytes()) {
            throw new InvalidArgumentException('quota_size');
        }
    }
}
