<?php
declare(strict_types=1);

// Jack thinks with nobody there. Run from the server's crontab, every eight hours:
// 23 */8 * * * /usr/local/bin/php /home/ffilsyql/public_html/timetravellersguild/scripts/jack-think.php >> /home/ffilsyql/jack-think.log 2>&1
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/app/AI/JackThought.php';
JackThought::loadMind();
@set_time_limit(400);
$r = JackThought::think('alone');
$t = $r['thought'] ?? null;
echo gmdate('c'), ' ', $t ? 'thought ' . $t['id'] . ' · ' . count($t['changes']) . ' changes' : json_encode($r), "\n";
