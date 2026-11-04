<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/app/AI/JackMap.php';

$op = strtolower((string) ($_GET['op'] ?? ''));
if ($op === '') {
    $path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '');
    if (preg_match('#/api/map/([a-z]+)/?$#', $path, $m)) {
        $op = $m[1];
    }
}

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');

function ttg_map_out(array $row, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

switch ($op) {
    case 'topology':
        ttg_map_out(JackMap::topology());
    case 'nodes':
        $id = trim((string) ($_GET['id'] ?? ''));
        $cell = trim((string) ($_GET['cell'] ?? ''));
        $anatomy = trim((string) ($_GET['anatomy'] ?? ''));
        ttg_map_out(['nodes' => JackMap::nodes($id !== '' ? $id : null, $cell !== '' ? $cell : null, $anatomy !== '' ? $anatomy : null)]);
    case 'edges':
        $node = trim((string) ($_GET['node'] ?? ''));
        ttg_map_out(['nerves' => JackMap::edges($node !== '' ? $node : null)]);
    case 'holdings':
        $node = trim((string) ($_GET['node'] ?? ''));
        ttg_map_out(['holdings' => JackMap::holdings($node !== '' ? $node : null)]);
    case 'events':
        $from = trim((string) ($_GET['from'] ?? ''));
        $to = trim((string) ($_GET['to'] ?? ''));
        ttg_map_out(['events' => JackMap::events($from !== '' ? $from : null, $to !== '' ? $to : null)]);
    case 'search':
        ttg_map_out(JackMap::search((string) ($_GET['q'] ?? '')));
    case 'trace':
        $id = trim((string) ($_GET['id'] ?? ''));
        $t = $id !== '' ? JackMap::trace($id) : null;
        if (!$t) {
            ttg_map_out(['ok' => false, 'error' => 'No filed path for that id.'], 404);
        }
        ttg_map_out(['ok' => true, 'trace' => $t]);
    case 'address':
        $lat = (float) ($_GET['lat'] ?? 0);
        $lon = (float) ($_GET['lon'] ?? 0);
        $depth = (int) ($_GET['depth'] ?? 6);
        ttg_map_out(['address' => JackMap::address($lat, $lon, $depth)]);
    default:
        ttg_map_out(['ok' => false, 'error' => 'Unknown map enquiry.'], 404);
}
