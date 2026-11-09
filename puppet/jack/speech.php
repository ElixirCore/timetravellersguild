<?php
/** Jack TTS on the owner's $200 Deepgram credit (auto top-up off, approved 2026-11-07).
    Conservative local accounting + daily abuse bounds; no client/office data, tools or retries. */
declare(strict_types=1);
require_once dirname(__DIR__,2).'/inc/graph.php';
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
function speech_fail(int $n,string $s): never {http_response_code($n);header('Content-Type: application/json');echo json_encode(['ok'=>false,'error'=>$s]);exit;}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')speech_fail(405,'post_only');
if(($_SERVER['HTTP_ORIGIN']??'')!=='https://timetravellersguild.com')speech_fail(403,'wrong_origin');
$raw=file_get_contents('php://input',false,null,0,4001);if(!is_string($raw)||strlen($raw)>4000)speech_fail(413,'too_long');
$in=json_decode($raw,true);if(!is_array($in)||!ttg_graph_csrf_ok((string)($in['csrf']??'')))speech_fail(403,'unsigned_slip');
$c=require __DIR__.'/secret_agent.php';if(empty($c['DEEPGRAM_TEST_ENABLED']))speech_fail(503,'test_not_enabled');
$text=trim(preg_replace('/\[[^\]]*\]|<[^>]*>/u','',(string)($in['text']??''))??'');
if($text===''||mb_strlen($text)>600)speech_fail(400,'invalid_text');
$key=trim((string)$c['DEEPGRAM_API_KEY']);if($key==='')$key=trim((string)@file_get_contents($c['DEEPGRAM_KEY_FILE']));if($key==='')speech_fail(503,'key_missing');
$root='/home/ffilsyql/ttg-private/jack-deepgram';if(!is_dir($root)&&!mkdir($root,0700,true))speech_fail(503,'storage_unavailable');
$fp=fopen($root.'/quota.json','c+');if(!$fp||!flock($fp,LOCK_EX))speech_fail(503,'quota_locked');chmod($root.'/quota.json',0600);
$b=json_decode(stream_get_contents($fp),true)??['calls'=>0,'chars'=>0];
// Credit-backed budget: est spend = total chars x Aura-2 list $0.030/1,000. Hard stops are
// the daily abuse bounds and the $190 credit guard against the $200 credit. The gate in
// inc/voice-status.php also checks the live Deepgram balance when its cached probe is fresh.
$today=gmdate('Y-m-d');
if(($b['day']??'')!==$today){$b['day']=$today;$b['day_calls']=0;$b['day_chars']=0;}
$n=mb_strlen($text);
if(($b['day_calls']??0)>=300||($b['day_chars']??0)+$n>50000||(float)($b['est_usd']??0)>=190.0){flock($fp,LOCK_UN);fclose($fp);speech_fail(429,'credit_guard_reached');}
$b['calls']=($b['calls']??0)+1;$b['chars']=($b['chars']??0)+$n;$b['day_calls']++;$b['day_chars']+=$n;$b['est_usd']=round($b['chars']*0.00003,2);rewind($fp);$out=json_encode($b);if(fwrite($fp,$out)!==strlen($out)||!ftruncate($fp,strlen($out))||!fflush($fp)){flock($fp,LOCK_UN);fclose($fp);speech_fail(503,'quota_write_failed');}flock($fp,LOCK_UN);fclose($fp);
$url='https://api.deepgram.com/v1/speak?'.http_build_query(['model'=>$c['DEEPGRAM_MODEL'],'encoding'=>'mp3','mip_opt_out'=>'true']);
$ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode(['text'=>$text]),CURLOPT_HTTPHEADER=>['Authorization: Token '.$key,'Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20]);$audio=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$type=curl_getinfo($ch,CURLINFO_CONTENT_TYPE);curl_close($ch);unset($key);
if($code!==200||!is_string($audio)||!str_starts_with((string)$type,'audio/'))speech_fail(503,'speech_unavailable');
require_once dirname(__DIR__,2).'/inc/voice-status.php';ttg_dg_balance(true);
header('Content-Type: audio/mpeg');header('X-Jack-Voice: Deepgram');echo $audio;
