<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/people/inc/db.php';
$user = ttg_current_user();
if (!$user) { header('Location: ' . ttg_base('auth/?next=' . urlencode('/map/arg/'))); exit; }
$cfg = ['record'=>'/map/record.php','pods'=>'/map/timepods.json','live'=>'/map/live.php','trail'=>'/map/trail.php','agent'=>'/map/agent.php','proxy'=>'/map/proxy.php','csrf'=>ttg_csrf_token(),'me'=>(string)$user['display_name']];
$secrets = is_file(dirname(__DIR__).'/secret_agent.php') ? require dirname(__DIR__).'/secret_agent.php' : [];
$cfg['maptiler'] = (string)($secrets['MAPTILER_KEY'] ?? getenv('MAPTILER_KEY') ?: '');
$cfg['europeana'] = !empty($secrets['EUROPEANA_KEY']) || (bool)getenv('EUROPEANA_KEY');
$html = (string)file_get_contents(dirname(__DIR__).'/index.html');
$bridge = <<<'JS'
window.GuildField = {map, view, setYear, card, get year(){return YEAR;}, get tap(){return lastTap;},
 evidence(){ if (!tipCurrent) return null; const t=TIPS[tipCurrent.kind]; return {kind:tipCurrent.kind,title:t?t.name(tipCurrent.p):'',record:JSON.stringify(tipCurrent.p).slice(0,1800),lng:tipCurrent.ll?.[0],lat:tipCurrent.ll?.[1]}; },
 context(){const c=map.getCenter();const out={};for(const id of ['photos','events','osmh','nmrw','names','graph-places']) {const s=map.getSource(id);const fs=s?._data?.features||s?._data?.geojson?.features||[];out[id]=fs.filter(f=>{const ll=centroid(f.geometry);return ll&&kmBetween([c.lng,c.lat],ll)<3;}).slice(0,8).map(f=>f.properties);}return out;}};
window.dispatchEvent(new Event('guild-field-ready'));
JS;
$pos = strrpos($html, '})();');
if ($pos !== false) $html = substr_replace($html, $bridge."\n", $pos, 0);
$html = str_replace('<title>Passport Map — Time Travellers Guild</title>', '<title>Guild Field Network | ARG test</title>', $html);
$html = str_replace('</head>', '<script>window.TTG_MAP='.json_encode($cfg, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_QUOT|JSON_HEX_APOS).';</script><link rel="stylesheet" href="/map/arg/field.css?v=3"></head>', $html);
echo str_replace('</body>', '<script src="/assets/terms-gate.js?v=1"></script><script src="/map/arg/field.js?v=3"></script></body>', $html);