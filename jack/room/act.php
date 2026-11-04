<?php
declare(strict_types=1);

require_once __DIR__ . '/inc.php';

@set_time_limit(90);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    ttg_body_json(['ok' => false, 'error' => 'POST only.'], 405);
}

if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    ttg_body_json(['ok' => false, 'error' => 'The clerk will not accept an unsigned slip.'], 400);
}

$do = strtolower(trim((string) ($_POST['do'] ?? '')));

if ($do === 'recall') {
    try {
        ttg_body_json([
            'ok' => true,
            'canon' => false,
            'meeting' => ttg_body_meeting(),
        ]);
    } catch (Throwable $e) {
        ttg_body_json(['ok' => false, 'error' => 'The drawer would not open.'], 500);
    }
}

if ($do !== 'remember') {
    ttg_body_json(['ok' => false, 'error' => 'Unknown slip.'], 400);
}

$instruction = trim((string) ($_POST['instruction'] ?? ''));
$dossier = trim((string) ($_POST['dossier'] ?? $_POST['q'] ?? ''));
if (function_exists('mb_strlen') ? mb_strlen($dossier) > 100000 : strlen($dossier) > 100000) {
    $dossier = function_exists('mb_substr')
        ? mb_substr($dossier, 0, 100000)
        : substr($dossier, 0, 100000);
}

try {
    $out = ttg_body_remember($instruction, $dossier);
    ttg_body_json($out, !empty($out['ok']) ? 200 : 400);
} catch (Throwable $e) {
    ttg_body_json(['ok' => false, 'canon' => false, 'error' => 'The clerk could not hold the meeting.'], 500);
}
