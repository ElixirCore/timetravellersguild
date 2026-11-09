<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/links.php';
ttg_graph_boot_session();
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /links/', true, 303);
    exit;
}
if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    ttg_wire_flash('The clerk will not accept an unsigned slip. Reload and try again.', 'err');
    header('Location: /links/', true, 303);
    exit;
}

$res = ttg_wire_transmit($_POST);
ttg_wire_flash($res['ok'] ? 'Received. The slip is in the hopper. A keeper will read it.' : (string) $res['error'], $res['ok'] ? 'ok' : 'err');
header('Location: /links/', true, 303);
