<?php
declare(strict_types=1);

/** Is Jack's voice line open? {"open": true|false|null}. null = unknown. */

require_once dirname(__DIR__) . '/inc/voice-status.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=120');
header('X-Content-Type-Options: nosniff');
echo json_encode(['open' => ttg_voice_credit()]);
