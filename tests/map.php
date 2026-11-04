<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/app/AI/JackMap.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

$topo = JackMap::topology();
$nodes = $topo['nodes'] ?? [];
$by = [];
foreach ($nodes as $n) {
    if (is_array($n) && isset($n['id'])) $by[$n['id']] = $n;
}

$stations = ['station-abercrave','station-cardiff','station-brecon','station-bristol','station-edinburgh','station-rennes','station-berlin','station-varanasi','station-sanfrancisco'];
foreach ($stations as $id) {
    expect(isset($by[$id]), $id . ' is filed');
    expect(isset($by[$id]['geography']['lat'], $by[$id]['geography']['lon']), $id . ' has a city mark');
    expect(($by[$id]['kind'] ?? '') === 'human', $id . ' is human filing');
}

expect(isset($by['robot-heart']), 'the shuffle is filed');
expect(($by['robot-heart']['kind'] ?? '') === 'robot', 'the shuffle is a robot');
expect(empty($by['robot-heart']['geography']), 'the shuffle has no street');

$ab = $by['station-abercrave']['geography'];
expect(abs(($ab['lat'] ?? 0) - 51.7964) < 0.05 && abs(($ab['lon'] ?? 0) + 3.7108) < 0.05, 'Abercrave is in the Swansea valley');
expect(str_contains((string) ($by['station-cardiff']['flavour'] ?? ''), 'Civic'), 'Cardiff is the civic desk');
expect(str_contains((string) ($by['station-berlin']['flavour'] ?? ''), 'Akt'), 'Berlin keeps the Akt');
expect(str_contains((string) ($by['station-varanasi']['name'] ?? ''), 'VARANASI'), 'Varanasi is spelled as the city');
expect(str_contains((string) ($by['station-sanfrancisco']['flavour'] ?? ''), 'not our warehouse'), 'San Francisco is a public relay, not the shed');

foreach ($topo['nerves'] ?? [] as $e) {
    expect(isset($by[$e['from']], $by[$e['to']]), ($e['id'] ?? 'nerve') . ' ends exist');
    if (($e['carrier'] ?? '') === 'post') {
        expect(($e['days'] ?? 0) >= 1, ($e['id'] ?? 'post') . ' takes at least a day');
        expect(($by[$e['from']]['kind'] ?? '') === 'human' && ($by[$e['to']]['kind'] ?? '') === 'human', ($e['id'] ?? 'post') . ' is human to human');
    }
    if (($e['carrier'] ?? '') === 'shuffle') {
        expect(($e['to'] ?? '') === 'robot-heart', ($e['id'] ?? 'shuffle') . ' ends at the robot');
    }
}

$seek = JackMap::search('Abercrave');
expect(count($seek['nodes'] ?? []) >= 1, 'search finds Abercrave');
$trace = JackMap::trace('holding-punch-deck');
expect(is_array($trace) && in_array('station-abercrave', $trace['path'] ?? [], true) && in_array('robot-heart', $trace['path'] ?? [], true), 'deck trace is post then shuffle');

$addr = JackMap::address(51.7964, -3.7108, 6);
expect(isset($addr['tetra_face'], $addr['path']) && count($addr['path']) === 6, 'Abercrave has a Jack cell');
expect(($by['station-abercrave']['earth_address']['depth'] ?? 0) === 6, 'topology stamps tetra addresses');

expect(($topo['telemetry'] ?? true) === false, 'no live telemetry flag');
expect(($topo['carrier'] ?? '') === 'human-post', 'carrier is human post');

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
