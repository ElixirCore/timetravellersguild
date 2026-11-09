<?php
require __DIR__.'/config.php';
$id = (string)($_GET['f'] ?? '');
if (!preg_match('/^\d{8}-\d{6}-[0-9a-f]{6}$/', $id)) { http_response_code(400); exit; }
$path = __DIR__.'/clips/'.$id.'.mp3';
if (!is_file($path)) { http_response_code(404); exit; }
header('Content-Type: audio/mpeg');
header('Content-Length: '.filesize($path));
header('Cache-Control: private, max-age=3600');
if (isset($_GET['dl'])) header('Content-Disposition: attachment; filename="'.$id.'.mp3"');
readfile($path);