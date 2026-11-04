<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !net_same_origin() || !net_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    ttg_redirect('/network/');
}
ttg_logout();
ttg_redirect('/network/');
