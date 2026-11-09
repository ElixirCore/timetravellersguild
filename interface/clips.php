<?php
header('Content-Type: application/json');
require __DIR__.'/config.php';
$metaFile = __DIR__.'/.clips.json';
$clips = is_file($metaFile) ? json_decode((string)file_get_contents($metaFile), true) : [];
if (!is_array($clips)) $clips = [];
$u = is_file(__DIR__.'/.usage.json') ? json_decode((string)file_get_contents(__DIR__.'/.usage.json'), true) : [];
$today = gmdate('Y-m-d');
$used = (is_array($u) && ($u['date'] ?? '') === $today) ? (int)$u['count'] : 0;
echo json_encode(['clips' => array_reverse($clips), 'used_today' => $used, 'cap' => DAILY_CAP]);