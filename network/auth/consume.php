<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
$token = trim((string) ($_GET['token'] ?? ''));
$user = $token !== '' && strlen($token) < 200 ? ttg_consume_magic_link($token) : null;
if (!$user) { http_response_code(400); exit('This link is invalid, expired or already used.'); }
try { net_apply_join_slip($user); } catch (Throwable $e) { error_log('Network: join slip could not be applied.'); }
ttg_set_session((int) $user['id']);
ttg_redirect('/network/');
