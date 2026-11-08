<?php
declare(strict_types=1);

/**
 * A keeper strikes out something Jack holds, for good. Run on the server:
 *   php scripts/jack-strike.php                 lists what he holds, with ids
 *   php scripts/jack-strike.php h7 "the reason" strikes belief h7
 *   php scripts/jack-strike.php i7 "the reason" strikes inference i7 out of the graph
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/app/AI/JackThought.php';
$id = (string) ($argv[1] ?? '');
if ($id === '') {
    $h = JackThought::held();
    foreach (['holds', 'doubts', 'dropped', 'struck'] as $k) {
        echo strtoupper($k), "\n";
        foreach ($h[$k] as $b) echo '  ', $b['id'], '  ', $b['text'], "\n";
    }
    $book = JackThought::readInferences() ?? JackThought::blankInferences();
    echo "INFERENCES\n";
    foreach ($book['items'] as $i) echo '  ', $i['id'], '  ', $i['kind'] === 'link' ? $i['a'] . ' ~ ' . $i['b'] . ': ' . $i['note'] : 'on ' . $i['on'] . ': ' . $i['text'], "\n";
    exit;
}
$b = JackThought::strike($id, (string) ($argv[2] ?? ''), time());
echo $b ? 'Struck: ' . $b['text'] . "\n" : "Not struck. No such belief, or it could not be saved: $id\n";
