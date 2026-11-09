<?php
if (!is_file(__DIR__.'/config.php')) { http_response_code(500); exit; }
require __DIR__.'/config.php';
$id = (string)($_GET['f'] ?? '');
if (!preg_match('/^\d{8}-\d{6}-[0-9a-f]{6}$/', $id)) { http_response_code(400); exit; }
$path = STORE_DIR.'/clips/'.$id.'.mp3';
if (!is_file($path)) { http_response_code(404); exit; }
header('Content-Type: audio/mpeg');
header('Content-Length: '.filesize($path));
header('Cache-Control: private, max-age=3600');
readfile($path);
