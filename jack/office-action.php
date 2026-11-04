<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/JackOffice/autoload.php';

$viewer = OfficeAuth::requireOffice();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /jack/office', true, 303);
    exit;
}
if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    http_response_code(400);
    echo 'Unsigned slip.';
    exit;
}

$do = strtolower(trim((string) ($_POST['do'] ?? '')));
$id = OfficePath::recordId((string) ($_POST['record_id'] ?? ''));
if ($id === '') {
    header('Location: /jack/office', true, 303);
    exit;
}

$store = new OfficeStore();
$store->boot();
$office = new OfficeDispatcher($store);
$office->actor = 'TOBY';

switch ($do) {
    case 'recover':
        $store->recover($id);
        OfficeLedger::append($store->root(), [
            'actor' => 'TOBY',
            'action' => 'recover_record',
            'target_record_ids' => [$id],
            'request_summary' => 'Recover retired record',
            'validation_result' => 'accepted',
            'approval_state' => 'approved',
            'result' => 'recovered',
        ]);
        break;
    case 'enable':
        $office->dispatch('enable_programme', ['programme_id' => $id]);
        break;
    case 'disable':
        $office->dispatch('disable_programme', ['programme_id' => $id]);
        break;
    case 'preview':
        $office->dispatch('run_programme_preview', ['programme_id' => $id]);
        break;
    case 'run':
        $office->dispatch('run_programme', ['programme_id' => $id]);
        break;
    case 'reject':
    case 'retire':
    case 'forget':
        $office->dispatch('retire_record', ['record_id' => $id, 'reason' => 'toby_' . $do]);
        break;
    case 'keep':
        $office->dispatch('keep_dream', ['dream_id' => $id]);
        break;
    case 'interpret':
        $dream = $store->get($id);
        if ($dream) {
            $office->dispatch('write_note', [
                'folder_id' => OfficeConfig::stationId('PRIVATE-NOTES'),
                'title' => 'Interpretation of ' . (string) ($dream['display_name'] ?? 'dream'),
                'body' => 'Inferred from dream ' . $id . '. Associative source. Not evidence.',
                'epistemic_status' => 'inferred',
                'source_record_ids' => [$id],
            ]);
        }
        break;
    case 'wake':
        $office->dispatch('write_note', [
            'folder_id' => OfficeConfig::stationId('OUT-TRAY'),
            'title' => 'Wake notice',
            'body' => 'Human review requested for ' . $id . '. No external notification sent.',
            'epistemic_status' => 'proposed',
            'source_record_ids' => [$id],
        ]);
        break;
}

header('Location: /jack/office?record=' . rawurlencode($id), true, 303);
exit;
