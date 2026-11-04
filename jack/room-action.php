<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/JackOffice/autoload.php';
require_once dirname(__DIR__) . '/app/JackRoom/autoload.php';

$viewer = OfficeAuth::requireOffice();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /jack/room', true, 303);
    exit;
}
if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) {
    http_response_code(400);
    echo 'Unsigned slip.';
    exit;
}

$do = strtolower(trim((string) ($_POST['do'] ?? '')));
$store = new RoomStore();
$room = new JackRoom($store);
$store->touchKeeper();
$disp = new RoomDispatcher($store);
$disp->actor = 'TOBY';

$ok = 'ok';
switch ($do) {
    case 'place':
        $r = $disp->dispatch('place_object', [
            'kind' => 'keepsake',
            'title' => (string) ($_POST['title'] ?? ''),
            'when' => $_POST['when'] ?? null,
            'where' => (string) ($_POST['where'] ?? ''),
            'with' => (string) ($_POST['with'] ?? ''),
            'under' => (string) ($_POST['under'] ?? ''),
        ]);
        $ok = !empty($r['ok']) ? 'placed' : 'ok';
        break;
    case 'shift':
        $r = $disp->dispatch('shift_axis', [
            'id' => (string) ($_POST['id'] ?? ''),
            'axis' => (string) ($_POST['axis'] ?? ''),
            'value' => $_POST['value'] ?? '',
        ]);
        $ok = !empty($r['ok']) ? 'shifted' : 'ok';
        break;
    case 'retire':
        $r = $disp->dispatch('retire_object', [
            'id' => (string) ($_POST['id'] ?? ''),
        ]);
        $ok = !empty($r['ok']) ? 'retired' : 'ok';
        break;
    case 'line':
        $r = $disp->dispatch('line_the_nest', []);
        $ok = !empty($r['ok']) ? 'lined' : 'ok';
        break;
    case 'punch':
        $disp->actor = 'JACK';
        $r = $disp->dispatch('write_box', [
            'box' => $_POST['box'] ?? '',
            'card' => (string) ($_POST['card'] ?? ''),
        ]);
        $ok = !empty($r['ok']) ? 'punched' : ((($r['error'] ?? '') === 'still_punching') ? 'still' : 'ok');
        break;
}

$axis = RoomConfig::isAxis(strtolower(trim((string) ($_POST['axis'] ?? ''))))
    ? strtolower(trim((string) $_POST['axis']))
    : 'when';
header('Location: /jack/room?axis=' . rawurlencode($axis) . '&ok=' . rawurlencode($ok), true, 303);
exit;
