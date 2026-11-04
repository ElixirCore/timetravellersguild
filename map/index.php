<?php
declare(strict_types=1);
require_once __DIR__ . '/../people/inc/db.php';

$user = ttg_current_user();
if (!$user) {
    header('Location: ' . ttg_base('auth/?next=' . urlencode('/map/')));
    exit;
}

$html = file_get_contents(__DIR__ . '/index.html');
// Inject the record endpoint override before </head>
$inject = '<script>window.TTG_MAP={record:"/map/record.php"};</script>';
echo str_replace('</head>', $inject . '</head>', $html);
