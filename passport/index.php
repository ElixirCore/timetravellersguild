<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/people/inc/db.php';

$pplUser = ttg_current_user();
if (!$pplUser) ttg_redirect(ttg_base('auth/'));

define('REG_DIR',  (is_writable(dirname(__DIR__,3)) || is_dir(dirname(__DIR__,3).'/ttg-passport'))
                   ? dirname(__DIR__,3).'/ttg-passport' : __DIR__.'/registry');
define('REG_FILE', REG_DIR.'/citizens.json');
define('RET_FILE', REG_DIR.'/retractions.json');

function reg_load(): array { if(!is_file(REG_FILE)) return []; $d=json_decode(@file_get_contents(REG_FILE),true); return is_array($d)?$d:[]; }
function reg_save(array $r): void { if(!is_dir(REG_DIR)) mkdir(REG_DIR,0700,true); file_put_contents(REG_FILE,json_encode($r,JSON_PRETTY_PRINT),LOCK_EX); chmod(REG_FILE,0600); }
function b13(int $n): string { $d='0123456789ABC'; $s=''; do{ $s=$d[$n%13].$s; $n=intdiv($n,13);}while($n); return $s; }
function slugify(string $v): string { $v=strtolower(trim($v)); $v=preg_replace('/[^a-z0-9]+/','-',$v)??''; $v=trim($v,'-'); return $v!==''?$v:'page'; }

function citizen_find_or_create(string $displayName): array {
  $r=reg_load(); $needle=mb_strtolower(trim($displayName));
  foreach($r as $rec){
    if(mb_strtolower(trim((string)($rec['name']??'')))===$needle){ unset($rec['hash']); return $rec; }
  }
  $c=['id'=>bin2hex(random_bytes(8)),'name'=>$displayName,
      'number'=>'TTG-XIII-'.b13((time()%13**6)+13**5),
      'issued'=>gmdate('Y-m-d'),'places'=>[]];
  $r[]=$c; reg_save($r); return $c;
}

function tree_offer_place(string $placeName): array {
  try{
    $lib=dirname(__DIR__).'/inc/graph.php'; if(!is_file($lib)) return [false,'missing'];
    require_once $lib; if(!function_exists('ttg_graph_capture')) return [false,'missing'];
    $res=ttg_graph_capture(['type'=>'PLACE','title'=>$placeName,'body'=>'Passport place.','place'=>$placeName]);
    if(is_array($res)&&($res['ok']??false)){ $node=is_array($res['node']??null)?$res['node']:[];
      $nid=(string)($node['id']??''); $nslug=(string)($node['slug']??'');
      return [true,null,$nid!==''?$nid:null,$nslug!==''?$nslug:null]; }
    return [false,is_array($res)?(string)($res['error']??'refused'):'refused',null,null];
  }catch(Throwable $e){ return [false,'unreachable',null,null]; }
}

function ret_queue(): array { if(!is_file(RET_FILE)) return []; $d=json_decode(@file_get_contents(RET_FILE),true); return is_array($d)?$d:[]; }
function ret_save(array $q): void { if(!is_dir(REG_DIR)) mkdir(REG_DIR,0700,true); file_put_contents(RET_FILE,json_encode($q,JSON_PRETTY_PRINT),LOCK_EX); chmod(RET_FILE,0600); }
function tree_retract_pending(string $publicId): int {
  try{ $lib=dirname(__DIR__).'/inc/graph.php'; if(!is_file($lib)) return -1; require_once $lib;
    if(!function_exists('ttg_graph_save_locked')) return -1; $removed=0;
    $ok=ttg_graph_save_locked('pending.json',static function(array $list) use ($publicId,&$removed){
      $keep=[]; foreach($list as $n){ if(($n['public_id']??'')===$publicId&&($n['status']??'')==='PENDING'){ $removed++; continue; } $keep[]=$n; } return $keep; });
    if(!$ok) return -1; return $removed>0?1:0;
  }catch(Throwable $e){ return -1; }
}
function ret_sweep(): void {
  $q=ret_queue(); if(!$q) return; $left=[]; $tries=0;
  foreach($q as $idx=>$job){ $id=(string)($job['id']??''); if($id==='') continue;
    if($tries>=3){ $left[]=$job; continue; } $tries++; $r=tree_retract_pending($id);
    if($r===-1){ $left=array_merge($left,array_slice($q,$idx)); break; } }
  if(!$left&&is_file(RET_FILE)){ @unlink(RET_FILE); return; } ret_save($left);
}
function tree_retry(array $rec): array {
  $changed=false; $tries=0;
  foreach(($rec['places']??[]) as $j=>$p){
    if(($p['tree']??'awaiting')==='lodged') continue; if($tries>=3) break; $tries++;
    [$ok,$why,$nid,$nslug]=tree_offer_place((string)$p['name']);
    if($ok){ $rec['places'][$j]['tree']='lodged'; unset($rec['places'][$j]['tree_note']);
      if($nid) $rec['places'][$j]['tree_id']=$nid; if($nslug) $rec['places'][$j]['tree_slug']=$nslug; }
    else{ $rec['places'][$j]['tree']='awaiting'; if($why) $rec['places'][$j]['tree_note']=$why; }
    $changed=true; if(!$ok) break;
  }
  return [$rec,$changed];
}

function avatar_import(string $name): array {
  $f=dirname(__DIR__).'/storage/join/applications.jsonl'; if(!is_file($f)) return [];
  $lines=file($f,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES); if(!$lines) return [];
  $needle=mb_strtolower(trim($name));
  foreach(array_reverse($lines) as $line){
    $row=json_decode($line,true); if(!is_array($row)) continue;
    if(mb_strtolower(trim((string)($row['name']??'')))!==$needle) continue;
    $px=$row['avatar_pixels']??[]; if(is_array($px)&&count($px)===81) return $px;
  }
  return [];
}
function load_join_app(string $name): array {
  $f=dirname(__DIR__).'/storage/join/applications.jsonl'; if(!is_file($f)) return [];
  $lines=file($f,FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES); if(!$lines) return [];
  $needle=mb_strtolower(trim($name));
  foreach(array_reverse($lines) as $line){
    $row=json_decode($line,true); if(!is_array($row)) continue;
    if(mb_strtolower(trim((string)($row['name']??'')))!==$needle) continue;
    return $row;
  }
  return [];
}
function avatar_save_to_citizen(string $id, array $px): void {
  $r=reg_load();
  foreach($r as $i=>$rec){ if(($rec['id']??'')===$id){ $r[$i]['avatar_pixels']=$px; reg_save($r); return; } }
}

function citizen_save_field(string $id, string $field, mixed $value): void {
  $r=reg_load();
  foreach($r as $i=>$rec){ if(($rec['id']??'')===$id){ $r[$i][$field]=$value; reg_save($r); return; } }
}

function passport_gather_tree_context(array $places): string {
  $lib=dirname(__DIR__).'/inc/graph.php';
  if(!is_file($lib)) return '';
  require_once $lib;
  $lines=[];
  foreach($places as $idx=>$p){
    $nodeLine=''; $nodeId=(string)($p['tree_id']??$p['tree_slug']??'');
    if($nodeId!==''){
      $node=ttg_graph_node($nodeId);
      if(is_array($node)){
        $title=trim((string)($node['title']??'')); $body=trim((string)($node['body']??''));
        if($body!=='') $body=mb_substr($body,0,220).(mb_strlen($body)>220?'…':'');
        $nodeLine=($title!==''?' ['.$title.($body!==''?': '.$body:'').']':'');
      }
    }
    $lines[]='  '.($idx+1).'. '.(string)$p['name'].(($p['line']??'')!==''?', '.(string)$p['line']:'').' ('.(string)($p['inked']??'').')'.$nodeLine;
  }
  return implode("\n",$lines);
}

function passport_openai_chat(string $apiKey, string $model, array $messages, int $maxTokens=420): array {
  $body=json_encode(['model'=>$model,'messages'=>$messages,'max_tokens'=>$maxTokens,'temperature'=>0.78],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  if(!$body) return ['ok'=>false,'error'=>'encode failed'];
  $ch=curl_init('https://api.openai.com/v1/chat/completions');
  if(!$ch) return ['ok'=>false,'error'=>'curl unavailable'];
  curl_setopt_array($ch,[
    CURLOPT_POST=>true,
    CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$apiKey],
    CURLOPT_POSTFIELDS=>$body,
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_TIMEOUT=>28,
  ]);
  $raw=curl_exec($ch); $err=curl_error($ch); curl_close($ch);
  if($raw===false||$raw==='') return ['ok'=>false,'error'=>$err ?: 'no response'];
  $data=json_decode((string)$raw,true);
  if(!is_array($data)) return ['ok'=>false,'error'=>'bad json'];
  if(isset($data['error'])) return ['ok'=>false,'error'=>(string)($data['error']['message']??'api error')];
  $text=trim((string)($data['choices'][0]['message']['content']??''));
  return $text!==''?['ok'=>true,'text'=>$text]:['ok'=>false,'error'=>'empty response'];
}

$err=''; $chronicleErr='';
if($_SERVER['REQUEST_METHOD']==='POST'){
  ttg_require_csrf();
  $a=$_POST['a']??'';
  if($a==='ink'){
    $place=trim($_POST['place']??''); $line=trim($_POST['line']??'');
    if($place===''||mb_strlen($place)>60) $err='Name the place, sixty letters or fewer.';
    elseif(mb_strlen($line)>120) $err='One line.';
    else{
      $displayName=(string)$pplUser['display_name'];
      $r=reg_load(); $needle=mb_strtolower(trim($displayName));
      foreach($r as $i=>$rec){
        if(mb_strtolower(trim((string)($rec['name']??'')))!==$needle) continue;
        $slug=slugify($place); $base=$slug; $n=2;
        $have=array_map(fn($p)=>$p['slug'],$rec['places']??[]);
        while(in_array($slug,$have,true)){ $slug=$base.'-'.$n++; }
        $rec['places'][]=['slug'=>$slug,'name'=>$place,'line'=>$line,'inked'=>gmdate('Y-m-d'),'tree'=>'awaiting'];
        $r[$i]=$rec; reg_save($r);
        [$ok,$why,$nid,$nslug]=tree_offer_place($place);
        $last=count($rec['places'])-1;
        $rec['places'][$last]['tree']=$ok?'lodged':'awaiting';
        if(!$ok&&$why) $rec['places'][$last]['tree_note']=$why;
        if($ok){ if($nid) $rec['places'][$last]['tree_id']=$nid; if($nslug) $rec['places'][$last]['tree_slug']=$nslug; }
        $r[$i]=$rec; reg_save($r);
        header('Location: /passport/',true,303); exit;
      }
      $err='Record not found.';
    }
  }
  elseif($a==='delete_place'){
    $idx=(int)($_POST['idx']??-1);
    $displayName=(string)$pplUser['display_name'];
    $r=reg_load(); $needle=mb_strtolower(trim($displayName));
    foreach($r as $i=>$rec){
      if(mb_strtolower(trim((string)($rec['name']??'')))!==$needle) continue;
      $places=array_values((array)($rec['places']??[]));
      if($idx<0||$idx>=count($places)){ $err='Invalid index.'; break; }
      array_splice($places,$idx,1);
      $rec['places']=$places; $r[$i]=$rec; reg_save($r);
      header('Location: /passport/',true,303); exit;
    }
    if(!$err) $err='Record not found.';
  }
  elseif($a==='generate_chronicle'){
    require_once dirname(__DIR__).'/inc/env.php';
    $apiKey=ttg_env('OPENAI_API_KEY');
    if($apiKey===''||str_contains($apiKey,'YOUR_KEY')){ $chronicleErr='OpenAI key not configured.'; }
    else{
      $displayName=(string)$pplUser['display_name'];
      $r=reg_load(); $needle=mb_strtolower(trim($displayName)); $found=null; $fi=-1;
      foreach($r as $i=>$rec){ if(mb_strtolower(trim((string)($rec['name']??'')))!==$needle) continue; $found=$rec; $fi=$i; break; }
      if($found===null){ $chronicleErr='Citizen record not found.'; }
      else{
        $lastReq=(int)($found['chronicle_requested_at']??0);
        if($lastReq>0&&time()-$lastReq<7200){ $chronicleErr='Chronicle was just written. Try again in a couple of hours.'; }
        else{
          $places=array_values((array)($found['places']??[]));
          $treeCtx=passport_gather_tree_context($places);
          $stanzas=count($places)===0?'No places have been stamped yet. Write about the threshold — the moment before.'
                                     :$treeCtx;
          $model=ttg_env('OPENAI_MODEL','gpt-4o-mini');
          $systemMsg='You are the clerk of records for the Time Travellers Guild. You write chronicle entries for citizen passports. Write with quiet authority and faint bureaucratic formality, addressing the holder directly in second person. The vantage point is the network present, 17 April 2033. 180–260 words exactly.';
          $userMsg="Write the chronicle entry for this citizen's passport.\n\nNAME: ".$found['name']."\nPASSPORT: ".$found['number']."\nISSUED: ".$found['issued']."\nLOCATION: ".($pplUser['location']??'')."\nSTATION: ".($pplUser['role']??'')."\n\nSTAMPED PLACES:\n".$stanzas."\n\nWrite the chronicle now.";
          $res=passport_openai_chat($apiKey,$model,[['role'=>'system','content'=>$systemMsg],['role'=>'user','content'=>$userMsg]],360);
          if($res['ok']){
            $r2=reg_load(); foreach($r2 as $i=>$rec){ if(($rec['id']??'')!==($found['id']??'')) continue;
              $r2[$i]['chronicle']=['text'=>$res['text'],'generated'=>gmdate('Y-m-d'),'model'=>$model];
              $r2[$i]['chronicle_requested_at']=time(); reg_save($r2); break; }
            header('Location: /passport/',true,303); exit;
          } else { $chronicleErr='Chronicle could not be written: '.($res['error']??'unknown'); }
        }
      }
    }
  }
  elseif($a==='delete_chronicle'){
    $displayName=(string)$pplUser['display_name'];
    $r=reg_load(); $needle=mb_strtolower(trim($displayName));
    foreach($r as $i=>$rec){
      if(mb_strtolower(trim((string)($rec['name']??'')))!==$needle) continue;
      unset($r[$i]['chronicle'],$r[$i]['chronicle_requested_at']); $r=array_values($r); reg_save($r); break;
    }
    header('Location: /passport/',true,303); exit;
  }
  elseif($a==='update_avatar'){
    $raw=trim((string)($_POST['avatar_pixels']??'')); $px=json_decode($raw,true);
    if(is_array($px)&&count($px)===81){
      $px=array_map(fn($v)=>is_string($v)?$v:'',array_values($px));
      $displayName=(string)$pplUser['display_name'];
      $r=reg_load(); $needle=mb_strtolower(trim($displayName));
      foreach($r as $rec){
        if(mb_strtolower(trim((string)($rec['name']??'')))!==$needle) continue;
        avatar_save_to_citizen((string)$rec['id'],$px); break;
      }
      // Write back to people profile so the stamp travels with the user
      ttg_db()->prepare('UPDATE users SET avatar_pixels=?,updated_at=? WHERE id=?')
              ->execute([ttg_pixel_encode($px),gmdate('c'),(int)$pplUser['id']]);
    }
    header('Location: /passport/',true,303); exit;
  }
}

function passport_geocode_place(string $name): array {
  $url='https://nominatim.openstreetmap.org/search?'.http_build_query(['q'=>$name,'format'=>'json','limit'=>1,'addressdetails'=>0]);
  $ch=curl_init($url); if(!$ch) return [];
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>8,
    CURLOPT_HTTPHEADER=>['User-Agent: TTG-Passport/1.0 (tobywhy@gmail.com)']]);
  $raw=curl_exec($ch); curl_close($ch);
  if(!$raw) return [];
  $data=json_decode((string)$raw,true);
  if(!is_array($data)||!isset($data[0])) return [];
  $lat=(float)($data[0]['lat']??0); $lon=(float)($data[0]['lon']??0);
  return ($lat!==0.0||$lon!==0.0)?['lat'=>round($lat,5),'lon'=>round($lon,5)]:[];
}

$citizen=citizen_find_or_create((string)$pplUser['display_name']);
ret_sweep();
{
  // Profile avatar is authoritative — sync from people DB on every load
  $profilePx=array_values(is_array($pplUser['avatar']??null)?$pplUser['avatar']:[]);
  $profileHasInk=count($profilePx)===81&&array_filter($profilePx)!==[];
  $r=reg_load();
  foreach($r as $i=>$rec){
    if(($rec['id']??'')!==$citizen['id']) continue;
    [$rec,$changed]=tree_retry($rec);
    if($profileHasInk){
      $cur=array_values(is_array($rec['avatar_pixels']??null)?$rec['avatar_pixels']:[]);
      if($cur!==$profilePx){ $rec['avatar_pixels']=$profilePx; $changed=true; }
    } elseif(!isset($rec['avatar_pixels'])||!is_array($rec['avatar_pixels'])||count($rec['avatar_pixels'])!==81){
      $px=avatar_import((string)$rec['name']); if($px){ $rec['avatar_pixels']=$px; $changed=true; }
    }
    // Geocode one un-located place per load (Nominatim rate limit: 1 req/s)
    foreach(($rec['places']??[]) as $pi=>$p){
      if(isset($p['lat'],$p['lon'])) continue;
      $geo=passport_geocode_place((string)($p['name']??''));
      if($geo){ $rec['places'][$pi]['lat']=$geo['lat']; $rec['places'][$pi]['lon']=$geo['lon']; $changed=true; }
      break; // one per request
    }
    if($changed){ $r[$i]=$rec; reg_save($r); } $citizen=$rec; break;
  }
}

// All profile data comes live from the people record
$record=[
  'id'=>(string)($citizen['id']??''),
  'name'=>(string)$citizen['name'],
  'number'=>(string)$citizen['number'],
  'issued'=>(string)$citizen['issued'],
  'places'=>array_values((array)($citizen['places']??[])),
  'grid'=>(is_array($citizen['avatar_pixels']??null)&&count($citizen['avatar_pixels'])===81)
          ?array_values($citizen['avatar_pixels']):null,
  'email'=>(string)($pplUser['email']??''),
  'town'=>(string)($pplUser['location']??''),
  'placement'=>(string)($pplUser['role']??''),
];
$recordJson=json_encode($record,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
$hasSig=is_array($citizen['avatar_pixels']??null)&&count($citizen['avatar_pixels'])===81;
$sigJson=json_encode($citizen['avatar_pixels']??[]);
$csrfToken=ttg_csrf_token();
$chronicleData=is_array($citizen['chronicle']??null)?$citizen['chronicle']:null;
$chronicleJson=json_encode($chronicleData,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
$lastReq=(int)($citizen['chronicle_requested_at']??0);
$chronicleCooldown=$lastReq>0&&time()-$lastReq<7200;
?><!doctype html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta charset="utf-8">
<title>Passport · Time Travellers Guild</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
:root {
  --ground: #0e1418;
  --ink: #dde7e3;
  --dim: #8a9b97;
  --rule: #26333a;
  --iris: #5cc8d6;
  --paper: #e8eeea;
  --pink: #19313a;
  --page-ink: #10232b;
  --page-dim: #52666c;
  --f-display: "Bricolage Grotesque", "Arial Narrow", system-ui, sans-serif;
  --f-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-data: "JetBrains Mono", ui-monospace, Menlo, "Courier New", monospace;
  --ease: cubic-bezier(.45, .05, .25, 1);
  color-scheme: dark;
}
html, body { background: var(--ground); height: 100%; }
body {
  margin: 0; color: var(--ink); font: 400 14px/1.5 var(--f-body); overflow: hidden;
  padding-block: 12px 14px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  box-sizing: border-box;
}
body.has-panel { overflow: auto; }
.app { height: 100%; display: flex; flex-direction: column; gap: 10px; max-width: 1200px; margin: 0 auto; }
body.has-panel .app { height: auto; }
.top { display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: baseline; justify-content: space-between; }
.top h1 { margin: 0; font: 800 20px/1 var(--f-display); letter-spacing: -.01em; }
.top p { margin: 0; font: 400 12px/1.4 var(--f-data); color: var(--dim); }
#stage { position: relative; flex: 1 1 auto; min-height: 320px; overflow: hidden; touch-action: none; cursor: default; user-select: none; -webkit-user-select: none; outline: none; }
body.has-panel #stage { height: 70svh; min-height: 400px; flex: none; }
#zoom { position: absolute; inset: 0; transform-origin: 0 0; }
.scene { position: absolute; inset: 0; perspective: 2600px; }
.book { position: absolute; left: 50%; top: 50%; width: var(--pw); height: var(--ph); margin-top: calc(var(--ph) / -2); transform-style: preserve-3d; transform: translateX(var(--shift, 0px)); transition: transform .9s var(--ease); }
.book.nodrag { transition: none; }
.leaf { position: absolute; inset: 0; transform-origin: left center; transform-style: preserve-3d; transform: translateZ(var(--z, 0px)) rotateY(var(--a, 0deg)); transition: transform .95s var(--ease); }
.leaf.drag { transition: none; }
.face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; overflow: hidden; }
.face.back { transform: rotateY(180deg); }
.shade { position: absolute; inset: 0; pointer-events: none; opacity: var(--shade, 0); z-index: 5; }
.face.front .shade { background: linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,0) 70%); }
.face.back .shade { background: linear-gradient(270deg, rgba(0,0,0,.55), rgba(0,0,0,0) 70%); }
.page { position: absolute; inset: 0; font-size: calc(var(--pw) / 22); color: var(--page-ink); background: var(--lines) center / 100% 100% no-repeat, var(--paper); padding: 1.3em 1.2em; box-sizing: border-box; display: flex; flex-direction: column; gap: .7em; }
.page.right { box-shadow: inset 12px 0 18px -12px rgba(0,0,0,.35); }
.page.left { box-shadow: inset -12px 0 18px -12px rgba(0,0,0,.35); }
.page::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: .45em; background: linear-gradient(90deg, #0e6f87, #2b56b6, #7b3ab0, #b5367f, #c0782c, #2c8f6a); opacity: .85; }
.page h2 { margin: .4em 0 0; font: 800 1.5em/1.05 var(--f-display); letter-spacing: -.01em; }
.page .eyebrow { font: 600 .62em/1 var(--f-data); letter-spacing: .16em; text-transform: uppercase; color: var(--page-dim); }
.page p { margin: 0; font-size: .86em; line-height: 1.5; }
.page .small { font-size: .64em; color: var(--page-dim); }
.page dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .35em .9em; margin: 0; font-size: .8em; }
.page dt { font: 600 .72em/1.9 var(--f-data); letter-spacing: .1em; text-transform: uppercase; color: var(--page-dim); }
.page dd { margin: 0; overflow-wrap: anywhere; }
.page dd.none { color: var(--page-dim); font-style: italic; }
.page button.mini { font: 600 .8em/1 var(--f-data); color: #12525f; background: none; border: 0; padding: 0; margin-left: .6em; cursor: pointer; text-decoration: underline; }
.page canvas { display: block; width: 100%; height: auto; aspect-ratio: 1; }
.page .stampbox { width: 78%; margin: 0 auto; }
.page .grow { flex: 1 1 auto; }
.page .mrz { font: 600 calc(var(--pw) * 0.0305)/1.5 var(--f-data); white-space: pre; background: rgba(255,255,255,.55); padding: .4em .5em; letter-spacing: 0; overflow: hidden; }
.page .folio { position: absolute; bottom: .8em; font: 400 .56em/1 var(--f-data); color: var(--page-dim); }
.page.left .folio { left: 1.3em; } .page.right .folio { right: 1.3em; }
.page .flag { align-self: flex-start; font: 600 .62em/1 var(--f-data); letter-spacing: .1em; text-transform: uppercase; padding: .6em .8em; border: 1px solid #1f7a5a; color: #1f7a5a; }
.page .flag.bad { border-color: #c2381a; color: #c2381a; }
.page ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: .5em; font: 400 .66em/1.4 var(--f-data); }
.page ol li { overflow-wrap: anywhere; }
.page ol li b { font-weight: 600; }
.cover, .backcover { background: #0e2c36; color: #bfeef6; padding: 0; }
.cover::before, .backcover::before { display: none; }
.cover canvas, .backcover canvas { position: absolute; inset: 0; width: 100%; height: 100%; aspect-ratio: auto; }
.cover .t1 { position: absolute; top: 9%; left: 0; right: 0; text-align: center; font: 800 2.3em/1 var(--f-display); letter-spacing: .32em; text-indent: .32em; color: #bfeef6; }
.cover .t2 { position: absolute; top: 16.5%; left: 0; right: 0; text-align: center; font: 600 .6em/1 var(--f-data); letter-spacing: .5em; text-indent: .5em; color: #8fd8e6; text-transform: uppercase; }
.cover .t3 { position: absolute; bottom: 6.5%; left: 0; right: 0; text-align: center; font: 400 .62em/1.4 var(--f-data); letter-spacing: .24em; color: #8fd8e6; text-transform: uppercase; }
.cover { cursor: pointer; }
.cover:focus-visible { outline: 3px solid var(--iris); outline-offset: -6px; }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.bar .group { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bar button, .bar label.btn { font: 600 12px/1 var(--f-data); letter-spacing: .06em; text-transform: uppercase; color: var(--ink); background: transparent; border: 1px solid var(--rule); padding: 11px 13px; cursor: pointer; }
.bar button:hover:not(:disabled), .bar label.btn:hover { border-color: var(--iris); }
.bar button:disabled { opacity: .35; cursor: default; }
.bar button:focus-visible, .bar label.btn:focus-within, #stage:focus-visible { outline: 2px solid var(--iris); outline-offset: 2px; }
.bar a.btn { font: 600 12px/1 var(--f-data); letter-spacing: .06em; text-transform: uppercase; color: var(--ink); background: transparent; border: 1px solid var(--rule); padding: 11px 13px; text-decoration: none; }
.bar a.btn:hover { border-color: var(--iris); }
.bar input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
#status { font: 400 12px/1.4 var(--f-data); color: var(--dim); }
.note { font: 400 11px/1.4 var(--f-data); color: var(--dim); margin: 0; }
#zoom.anim { transition: transform .6s var(--ease); }
#reader { display: none; flex: 1 1 auto; min-height: 0; overflow: auto; background: var(--paper); color: var(--page-ink); }
.reading #reader { display: block; }
.reading #stage, .reading #prev, .reading #next, .reading #reset { display: none; }
#reader .col { max-width: 68ch; margin: 0 auto; padding: 28px 22px 56px; font: 400 18px/1.6 var(--f-body); }
#reader h2 { font: 800 34px/1.1 var(--f-display); margin: .2em 0 .4em; letter-spacing: -.01em; text-wrap: balance; }
#reader h3 { font: 800 22px/1.2 var(--f-display); margin: 1.8em 0 .5em; padding-top: .7em; border-top: 1px solid #b9c8c4; }
#reader h4 { font: 600 16px/1.3 var(--f-data); margin: 1.4em 0 .2em; }
#reader p { margin: .5em 0; }
#reader p.small { font: 400 14px/1.5 var(--f-data); color: var(--page-dim); }
#reader .eyebrow { font: 600 12px/1 var(--f-data); letter-spacing: .16em; text-transform: uppercase; color: var(--page-dim); margin: 0; }
#reader dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .4em 1.2em; margin: 0; }
#reader dt { font: 600 12px/2.2 var(--f-data); letter-spacing: .1em; text-transform: uppercase; color: var(--page-dim); }
#reader dd { margin: 0; overflow-wrap: anywhere; }
#reader dd.none { color: var(--page-dim); font-style: italic; }
#reader canvas { display: block; max-width: 100%; height: auto; margin: .6em 0; background: #f6faf8; }
#reader .mrz { font: 600 clamp(9px, 2.4vw, 14px)/1.5 var(--f-data); white-space: pre; overflow-x: auto; background: rgba(0,0,0,.06); padding: .6em .8em; }
#reader ol { padding-left: 1.2em; margin: .5em 0; font: 400 14px/1.7 var(--f-data); overflow-wrap: anywhere; }
#reader button.mini { font: 600 13px/1 var(--f-data); color: #12525f; background: none; border: 0; padding: 0; margin-left: .7em; cursor: pointer; text-decoration: underline; }
/* ink panel + signet panel */
.panel { background: #131e24; border-top: 1px solid var(--rule); padding: 22px 0 24px; }
.panel-inner { max-width: 1200px; margin: 0 auto;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.panel h3 { margin: 0 0 14px; font: 600 11px/1 var(--f-data); letter-spacing: .18em; text-transform: uppercase; color: var(--dim); }
.panel-row { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: flex-end; }
.panel input[type=text] { font: 400 15px/1 var(--f-body); color: var(--ink); background: transparent; border: 0; border-bottom: 1px solid var(--rule); padding: 9px 2px; outline: none; min-width: 0; }
.panel input[type=text]:focus { border-bottom-color: var(--iris); }
.panel input[type=text]::placeholder { color: var(--dim); }
.panel .place-in { flex: 2 1 180px; }
.panel .line-in { flex: 3 1 240px; }
.panel button[type=submit] { font: 600 11px/1 var(--f-data); letter-spacing: .1em; text-transform: uppercase; color: var(--ink); background: transparent; border: 1px solid var(--rule); padding: 11px 16px; cursor: pointer; white-space: nowrap; }
.panel button[type=submit]:hover { border-color: var(--iris); }
.panel .err { font: 400 11px/1.4 var(--f-data); color: #c06060; margin-top: 6px; }
/* footer */
.footer { border-top: 1px solid var(--rule); padding: 14px 0 10px; }
.footer-inner { max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 10px 20px; align-items: center;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.footer a, .footer button { font: 400 11px/1 var(--f-data); color: var(--dim); text-decoration: none; background: none; border: 0; padding: 0; cursor: pointer; }
.footer a:hover, .footer button:hover { color: var(--iris); }
/* signet grid in panel */
#sigGrid { display: grid; grid-template-columns: repeat(9,18px); grid-template-rows: repeat(9,18px); gap: 1px; background: #0a1418; border: 1px solid var(--rule); cursor: crosshair; }
#sigGrid button { width: 18px; height: 18px; border: 0; padding: 0; cursor: crosshair; }
@media (prefers-reduced-motion: reduce) { .book, .leaf { transition-duration: .01s; } }
/* composite stamp+map canvas */
.page .stampbox canvas, .page .composite-wrap canvas { display: block; width: 100%; height: auto; aspect-ratio: 1; border-radius: 2px; }
.page .composite-coords { font: 400 .56em/1.4 var(--f-data); color: var(--page-dim); margin-top: .25em; text-align: center; }
.page .del-place { margin-top: .6em; text-align: right; }
.page .del-place button { font: 400 .65em/1 var(--f-data); color: var(--page-dim); background: none; border: 1px solid var(--rule); border-radius: 2px; padding: .2em .55em; cursor: pointer; opacity: .6; }
.page .del-place button:hover { opacity: 1; color: #c0303a; border-color: #c0303a; }
</style>
</head>
<body<?= ($err||$chronicleErr) ? ' class="has-panel"' : '' ?>>

<div class="app">
  <div class="top">
    <h1>UNIKIN Passport</h1>
    <p>Tap the cover or press Enter to open. Scroll or pinch to look closer.</p>
  </div>
  <div id="stage" tabindex="0" aria-label="Passport booklet. Press Enter to open, arrow keys to turn pages, plus and minus to zoom.">
    <div id="zoom"><div class="scene"><div class="book" id="book"></div></div></div>
  </div>
  <div id="reader" aria-label="Passport as plain text"></div>
  <div class="bar">
    <div class="group">
      <button type="button" id="prev">Back</button>
      <button type="button" id="next">Forward</button>
      <button type="button" id="reset">Reset zoom</button>
    </div>
    <div class="group">
      <span id="status" role="status" aria-live="polite"></span>
      <button type="button" id="readbtn" aria-pressed="false">Read as text</button>
      <a class="btn" href="/people/profile/">Profile</a>
    </div>
  </div>
  <p class="note" id="note"></p>
</div>

<?php if($err): ?>
<div class="panel"><div class="panel-inner"><p class="err"><?= ttg_h($err) ?></p></div></div>
<?php endif; ?>

<div class="panel">
  <div class="panel-inner">
    <h3>Ink a new page &mdash; a place you belong to</h3>
    <form method="post" autocomplete="off">
      <input type="hidden" name="csrf" value="<?= ttg_h($csrfToken) ?>">
      <input type="hidden" name="a" value="ink">
      <div class="panel-row">
        <input class="place-in" type="text" name="place" required maxlength="60" placeholder="the place">
        <input class="line-in" type="text" name="line" maxlength="120" placeholder="one line it keeps (optional)">
        <button type="submit">Ink the page</button>
      </div>
    </form>
  </div>
</div>

<div class="panel">
  <div class="panel-inner">
    <h3>9&times;9 hexadecimal signet</h3>
    <form method="post" id="sigForm">
      <input type="hidden" name="csrf" value="<?= ttg_h($csrfToken) ?>">
      <input type="hidden" name="a" value="update_avatar">
      <input type="hidden" name="avatar_pixels" id="sigPixels" value="<?= ttg_h($sigJson) ?>">
      <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
        <div id="sigGrid"></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <input type="color" id="sigColor" value="#1e3a5f" style="width:36px;height:26px;border:0;background:none;cursor:pointer">
          <button type="button" id="sigFill" class="bar" style="font:600 11px/1 var(--f-data);letter-spacing:.08em;text-transform:uppercase;color:var(--ink);background:transparent;border:1px solid var(--rule);padding:7px 10px;cursor:pointer">Fill</button>
          <button type="button" id="sigClear" class="bar" style="font:600 11px/1 var(--f-data);letter-spacing:.08em;text-transform:uppercase;color:var(--ink);background:transparent;border:1px solid #633;padding:7px 10px;cursor:pointer">Clear</button>
        </div>
      </div>
      <div style="margin-top:12px"><button type="submit" style="font:600 11px/1 var(--f-data);letter-spacing:.1em;text-transform:uppercase;color:var(--ink);background:transparent;border:1px solid var(--rule);padding:11px 16px;cursor:pointer">Set signet &amp; reload passport</button></div>
    </form>
  </div>
</div>

<div class="panel">
  <div class="panel-inner">
    <h3>Chronicle &mdash; a permanent narrated record of your journey</h3>
    <?php if($chronicleData): ?>
      <p style="font:400 13px/1.6 var(--f-body);color:var(--ink);max-width:68ch;margin:0 0 14px">
        <?= ttg_h(mb_substr((string)($chronicleData['text']??''),0,320)) ?>…
      </p>
      <p style="font:400 11px/1 var(--f-data);color:var(--dim);margin:0 0 14px">
        Written <?= ttg_h((string)($chronicleData['generated']??'')) ?> by <?= ttg_h((string)($chronicleData['model']??'the clerk')) ?>.
        Visible in the booklet on the Chronicle page.
      </p>
      <div class="panel-row">
        <form method="post" style="display:inline">
          <input type="hidden" name="csrf" value="<?= ttg_h($csrfToken) ?>">
          <input type="hidden" name="a" value="delete_chronicle">
          <button type="submit" style="font:600 11px/1 var(--f-data);letter-spacing:.08em;text-transform:uppercase;color:#c06060;background:transparent;border:1px solid #633;padding:11px 16px;cursor:pointer">Burn the chronicle</button>
        </form>
      </div>
    <?php else: ?>
      <?php if($chronicleErr!==''): ?>
        <p class="err"><?= ttg_h($chronicleErr) ?></p>
      <?php endif; ?>
      <p style="font:400 12px/1.5 var(--f-data);color:var(--dim);margin:0 0 14px;max-width:60ch">
        <?php if($chronicleCooldown): ?>
          A chronicle was just requested. It will appear above once it has been written. Refresh in a moment.
        <?php else: ?>
          Ask the clerk to write a permanent narrative about your places in the tree. It will be stored in your passport and can be burned (deleted) at any time.
        <?php endif; ?>
      </p>
      <?php if(!$chronicleCooldown): ?>
      <form method="post">
        <input type="hidden" name="csrf" value="<?= ttg_h($csrfToken) ?>">
        <input type="hidden" name="a" value="generate_chronicle">
        <div class="panel-row">
          <button type="submit" style="font:600 11px/1 var(--f-data);letter-spacing:.1em;text-transform:uppercase;color:var(--ink);background:transparent;border:1px solid var(--rule);padding:11px 16px;cursor:pointer">Ask the clerk to write it</button>
        </div>
      </form>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</div>

<div class="footer">
  <div class="footer-inner">
    <a href="/people/profile/">Your profile</a>
    <a href="workbench.php">The Workbench</a>
    <a href="/people/auth/logout.php">Sign out</a>
  </div>
</div>

<script>
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;

  function cyrb128(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  }
  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0; c = (c << 21 | c >>> 11);
      d = d + 1 | 0; t = t + d | 0; c = c + t | 0; return (t >>> 0) / 4294967296;
    };
  }
  const rngFor = (key) => { const s = cyrb128(key); return sfc32(s[0], s[1], s[2], s[3]); };
  const hex = (key) => cyrb128(key).map((x) => x.toString(16).padStart(8, '0')).join('');
  const dg = (o) => hex(JSON.stringify(o)).slice(0, 8);
  const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unplaced';
  const initials = (n) => n.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').slice(0, 4) || '?';
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const clean = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cv = (c) => (c >= '0' && c <= '9' ? +c : c >= 'A' && c <= 'Z' ? c.charCodeAt(0) - 55 : 0);
  function check731(s) { const w = [7, 3, 1]; let t = 0; for (let i = 0; i < s.length; i++) t += cv(s[i]) * w[i % 3]; return t % 10; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function derive(F) {
    const slug = slugify(F.place), L = {};
    let r = rngFor('rosette|' + slug);
    const pool = [7, 9, 11, 13, 17, 19, 21, 23, 27, 29, 31, 33, 37, 39, 41, 43], curves = [];
    for (let i = 0; i < 3; i++) curves.push({ r: pool[Math.floor(r() * pool.length)], rho: +(0.56 + r() * 0.14).toFixed(3), ph: +(r() * TAU).toFixed(3) });
    L.rosette = { curves, digest: dg(curves) };
    const phase = +(rngFor('micro|' + slug + '|' + F.number)() * TAU).toFixed(3);
    const rings = [F.place.toUpperCase() + ' · ', F.number + ' · ' + F.date + ' · ', F.name.toUpperCase() + ' · UNIKIN · '];
    L.micro = { rings, phase, digest: dg({ rings, phase }) };
    r = rngFor('intaglio|' + F.number + '|' + F.date);
    L.intaglio = { k1: 5 + Math.floor(r() * 14), k2: 23 + Math.floor(r() * 26), a1: +(0.35 + r() * 0.3).toFixed(3), a2: +(0.15 + r() * 0.25).toFixed(3), p1: +(r() * TAU).toFixed(3), p2: +(r() * TAU).toFixed(3) };
    L.intaglio.digest = dg(L.intaglio);
    const ini = initials(F.name); r = rngFor('latent|' + ini + '|' + slug);
    L.latent = { glyph: ini, angle: Math.floor(r() * 12) * 15, period: 4 + Math.floor(r() * 2) };
    L.latent.digest = dg(L.latent);
    const S = clean(F.number) + clean(F.date) + clean(F.place) + String(F.ordinal), vals = S.split('').map(cv);
    L.ring = { vals, cd: check731(S), digest: dg(vals) };
    const gc = Array.isArray(F.grid) && F.grid.length === 81 && F.grid.some(Boolean) ? F.grid : null;
    L.idgrid = { cells: gc, digest: dg({ c: gc, n: F.number }) };
    const h = hex([F.prev, F.name, F.number, F.place, F.line, F.date, F.ordinal, F.town || '', F.placement || '', F.email || '', L.rosette.digest, L.micro.digest, L.intaglio.digest, L.latent.digest, L.ring.digest, L.idgrid.digest].join('|')).toUpperCase();
    L.seal = { value: 'XUN-' + h.slice(0, 4) + '-' + h.slice(4, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) };
    return L;
  }

  function loadComposite(canvas, lat, lon, label, L, stampOpts) {
    const zoom = 15;
    function toTile(la, lo, z) {
      const n = 1 << z;
      return { x: Math.floor((lo + 180) / 360 * n), y: Math.floor((1 - Math.log(Math.tan(la * Math.PI / 180) + 1 / Math.cos(la * Math.PI / 180)) / Math.PI) / 2 * n) };
    }
    const center = toTile(lat, lon, zoom);
    const GRID = 3, TILE = 256, SZ = GRID * TILE;
    canvas.width = canvas.height = SZ;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#cdd8d2'; ctx.fillRect(0, 0, SZ, SZ);
    let pending = GRID * GRID;
    function overlay() {
      /* draw stamp into offscreen canvas, then multiply-blend onto map */
      const off = document.createElement('canvas'); off.width = off.height = SZ;
      const og = off.getContext('2d');
      drawStamp(og, SZ, L, stampOpts);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.72;
      ctx.drawImage(off, 0, 0);
      ctx.restore();
      /* place marker */
      const cx = SZ / 2, cy = SZ / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(181,54,127,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((label || '?').charAt(0).toUpperCase(), cx, cy);
      ctx.restore();
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.src = 'https://tile.openstreetmap.org/' + zoom + '/' + (center.x + dx) + '/' + (center.y + dy) + '.png';
        const px = (dx + 1) * TILE, py = (dy + 1) * TILE;
        img.onload = () => { ctx.drawImage(img, px, py, TILE, TILE); if (--pending === 0) overlay(); };
        img.onerror = () => { if (--pending === 0) overlay(); };
      }
    }
  }

  function iris(g, foil) {
    if (g.createConicGradient) {
      const gr = g.createConicGradient(-Math.PI / 2, 0, 0);
      const st = foil ? [[0, '#7fe3f0'], [0.2, '#8fb0ff'], [0.42, '#c99bff'], [0.62, '#ff9bd0'], [0.8, '#ffd08a'], [0.92, '#8fe8c2'], [1, '#7fe3f0']]
                      : [[0, '#0e6f87'], [0.2, '#2b56b6'], [0.42, '#7b3ab0'], [0.62, '#b5367f'], [0.8, '#c0782c'], [0.92, '#2c8f6a'], [1, '#0e6f87']];
      st.forEach((s) => gr.addColorStop(s[0], s[1]));
      return gr;
    }
    return foil ? '#8fd8e6' : '#1f5f8f';
  }
  function latentCanvas(D, L, k, rgb) {
    const m = document.createElement('canvas'); m.width = m.height = D;
    const mg = m.getContext('2d'); mg.fillStyle = '#000'; mg.fillRect(0, 0, D, D); mg.fillStyle = '#fff';
    let fs = D * 0.30; const f = (s) => '900 ' + s + 'px "Arial Black",Impact,sans-serif';
    mg.font = f(fs); mg.textAlign = 'center'; mg.textBaseline = 'middle';
    while (mg.measureText(L.latent.glyph).width > D * 0.62 && fs > 10) { fs -= 4; mg.font = f(fs); }
    mg.fillText(L.latent.glyph, D / 2, D * 0.31);
    const md = mg.getImageData(0, 0, D, D).data;
    const out = document.createElement('canvas'); out.width = out.height = D;
    const og = out.getContext('2d'), id = og.createImageData(D, D), px = id.data;
    const P = Math.max(2.4, L.latent.period * k), A = L.latent.angle * Math.PI / 180, ca = Math.cos(A), sa = Math.sin(A), R2 = (D / 2) * (D / 2);
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const dx = x - D / 2, dy = y - D / 2; if (dx * dx + dy * dy > R2) continue;
      const u = dx * ca + dy * sa, inM = md[(y * D + x) * 4] > 127;
      if ((((u + (inM ? P / 2 : 0)) % P) + P) % P / P < 0.45) { const i = (y * D + x) * 4; px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 235; }
    }
    og.putImageData(id, 0, 0); return out;
  }
  function drawStamp(g, n, L, o) {
    const k = n / 2400, Rs = n * 0.46, on = o.layers;
    g.save(); g.translate(n / 2, n / 2);
    const sty = iris(g, o.foil);
    g.strokeStyle = sty; g.fillStyle = sty; g.lineJoin = 'round';
    const ring = (r, w, a) => { g.globalAlpha = a || 1; g.lineWidth = w * k; g.beginPath(); g.arc(0, 0, r * Rs, 0, TAU); g.stroke(); };
    ring(1, 6); ring(0.985, 1.6); ring(0.93, 1.6, 0.8); ring(0.795, 1.4, 0.8); ring(0.665, 1.8); ring(0.335, 2.2);
    if (on.rosette) {
      g.globalAlpha = 0.8; g.lineWidth = 2.1 * k;
      L.rosette.curves.forEach((c) => {
        const R = 100, r = c.r, d = (R - r) * (1 - c.rho) / (1 + c.rho), ext = R - r + d, sc = 0.655 * Rs / ext;
        const turns = r / gcd(R, r), steps = Math.min(26000, Math.round(turns * TAU / 0.012));
        g.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps * turns * TAU;
          const x = ((R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t + c.ph)) * sc, y = ((R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t + c.ph)) * sc;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      });
    }
    if (on.micro) {
      g.globalAlpha = 0.92; g.font = '600 ' + (11 * k) + 'px "JetBrains Mono",ui-monospace,Menlo,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      L.micro.rings.forEach((txt, idx) => {
        const r = [0.69, 0.725, 0.76][idx] * Rs, adv = 6.7 * k;
        const reps = Math.max(1, Math.round(TAU * r / adv / txt.length)), s = txt.repeat(reps), m = s.length, step = TAU / m, ph = L.micro.phase * (idx + 1);
        for (let i = 0; i < m; i++) { g.save(); g.rotate(ph + i * step); g.translate(0, -r); g.fillText(s[i], 0, 0); g.restore(); }
      });
    }
    if (on.intaglio) {
      const I = L.intaglio, M = 900; g.globalAlpha = 0.9; g.lineWidth = 2.6 * k; g.beginPath();
      for (let i = 0; i < M; i++) {
        const a = i / M * TAU, w = Math.sin(a * I.k1 + I.p1) * I.a1 + Math.sin(a * I.k2 + I.p2) * I.a2, t = clamp(0.5 + 0.5 * w, 0, 1);
        const r0 = 0.8 * Rs, r1 = r0 + (0.02 + 0.085 * t) * Rs, ca = Math.cos(a), sa = Math.sin(a);
        g.moveTo(ca * r0, sa * r0); g.lineTo(ca * r1, sa * r1);
      }
      g.stroke();
    }
    if (on.ring) {
      g.save(); g.globalAlpha = 1; g.rotate(-Math.PI / 2);
      const v = L.ring.vals, m = v.length;
      for (let j = 0; j < m; j++) {
        const a0 = j / m * TAU, a1 = (j + 0.68) / m * TAU, r0 = 0.945 * Rs, r1 = (0.955 + 0.025 * v[j] / 35) * Rs;
        g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath(); g.fill();
      }
      g.restore();
    }
    if (on.latent) { const D = Math.ceil(0.32 * Rs) * 2; g.globalAlpha = 1; g.drawImage(latentCanvas(D, L, k, [52, 58, 150]), -D / 2, -D / 2); }
    if (on.idgrid) {
      const s = 0.25 * Rs, cell = s / 9, x0 = -s / 2, y0 = 0.15 * Rs - s / 2, cells = L.idgrid.cells;
      g.globalAlpha = 1; g.fillStyle = '#e8eeea'; g.fillRect(x0 - cell * 0.5, y0 - cell * 0.5, s + cell, s + cell);
      if (cells) for (let i = 0; i < 81; i++) { if (!cells[i]) continue; g.fillStyle = cells[i]; g.fillRect(x0 + (i % 9) * cell, y0 + Math.floor(i / 9) * cell, cell * 0.92, cell * 0.92); }
      else {
        g.strokeStyle = sty; g.globalAlpha = 0.3; g.lineWidth = 1.2 * k; g.beginPath();
        for (let i = 0; i <= 9; i++) { g.moveTo(x0 + i * cell, y0); g.lineTo(x0 + i * cell, y0 + s); g.moveTo(x0, y0 + i * cell); g.lineTo(x0 + s, y0 + i * cell); }
        g.stroke();
      }
      g.globalAlpha = 1; g.strokeStyle = sty; g.lineWidth = 2.2 * k; g.strokeRect(x0 - cell * 0.5, y0 - cell * 0.5, s + cell, s + cell);
    }
    g.restore();
  }

  /* ── citizen record injected by PHP ── */
  const SAMPLE = <?= $recordJson ?>;
  const CHRONICLE = <?= $chronicleJson ?>;

  const CSRF = <?= json_encode($csrfToken) ?>;
  let HOLDER = null, RECORD = [], STAMPS = [];
  function normGrid(sig) {
    if (!sig) return null;
    let a = sig.cells || sig.grid || sig;
    if (typeof a === 'string') a = a.trim().split(/[\s,;|]+/).filter(Boolean);
    if (Array.isArray(a) && a.length === 9 && Array.isArray(a[0])) a = [].concat.apply([], a);
    if (!Array.isArray(a) || a.length !== 81) return null;
    return a.map((v) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v.trim())) ? v.trim() : ((v === 1 || v === true || v === '1') ? '#3a3f9e' : ''));
  }
  function buildChain() {
    STAMPS = []; let chain = 'GENESIS|' + HOLDER.number;
    RECORD.forEach((s, i) => {
      const dup = STAMPS.some((t) => t.ok && slugify(t.F.place) === slugify(s.place) && t.F.line === s.line && t.F.date === s.date);
      const F = { name: HOLDER.name, number: HOLDER.number, place: s.place, line: s.line, date: s.date, town: HOLDER.town, placement: HOLDER.placement, email: HOLDER.email, grid: HOLDER.grid, ordinal: i + 1, prev: chain, lat: s.lat, lon: s.lon };
      const L = derive(F); STAMPS.push({ F, L, ok: !dup }); if (!dup) chain = L.seal.value;
    });
  }
  function loadRecord(rec, label) {
    if (!rec || typeof rec !== 'object') throw new Error('The record is not a JSON object.');
    const name = String(rec.name || '').trim(), number = String(rec.number || '').trim();
    if (!name || !number) throw new Error('The record needs a name and a number.');
    const places = Array.isArray(rec.places) ? rec.places.filter((p) => p && typeof p === 'object') : [];
    const j = rec.join && typeof rec.join === 'object' ? rec.join : rec, str = (v) => (v == null ? '' : String(v).trim());
    HOLDER = { id: str(rec.id), name, number, issued: String(rec.issued || '').slice(0, 10) || '0000-00-00', email: str(j.email), town: str(j.town || j.nearest || j.valley), placement: str(j.placement || j.clerk), grid: normGrid(j.signature || j.grid || j.sig || rec.grid) };
    RECORD = places.slice(0, 10).map((p) => ({ place: String(p.name || p.slug || 'Unplaced'), line: String(p.line || ''), date: String(p.inked || rec.issued || '').slice(0, 10), lat: (p.lat != null) ? +p.lat : null, lon: (p.lon != null) ? +p.lon : null }));
    buildChain();
    $('note').textContent = (label || 'Record') + ': ' + name + ', ' + number + (places.length > 10 ? ' (first 10 places shown)' : '') + (places.length === 0 ? ' — no places yet, ink a page below.' : '.') + (HOLDER.grid || HOLDER.email || HOLDER.town ? '' : ' Paint the 9×9 signet below to fill the ID grid.');
    build();
  }

  const book = $('book'), stage = $('stage'), zoomEl = $('zoom');
  let pages = [], leaves = [], nLeaves = 0, t = 0, reveal = false, focus = 'R', focusMode = false, fitS = 1, lastVis = [];
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const maskEmail = (e) => { const i = e.indexOf('@'); return i < 1 ? e.slice(0, 1) + '***' : e.slice(0, 1) + '***' + e.slice(i); };
  const ALL = { rosette: true, micro: true, intaglio: true, latent: true, ring: true, idgrid: true };

  function coverPage() {
    const el = h('div', 'page cover'); el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-label', 'Open the passport');
    const c = document.createElement('canvas'); el.appendChild(c);
    el.appendChild(h('div', 't1', 'UNIKIN')); el.appendChild(h('div', 't2', 'Passport')); el.appendChild(h('div', 't3', 'the free future state'));
    return { el, draw() {
      c.width = 1000; c.height = 1400; const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 1000, 1400); gr.addColorStop(0, '#133a47'); gr.addColorStop(1, '#0a1d25'); g.fillStyle = gr; g.fillRect(0, 0, 1000, 1400);
      const r = rngFor('cover-grain'); for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.08)'; g.fillRect(r() * 1000, r() * 1400, 1 + r() * 2, 1 + r() * 2); }
      const L = derive({ name: 'UNIKIN', number: 'XUN', place: 'UNIKIN', line: '', date: 'FREE FUTURE STATE', ordinal: 0, prev: '' });
      g.save(); g.translate(0, 150); drawStamp(g, 1000, L, { layers: { rosette: true, micro: true, intaglio: true, ring: true }, foil: true }); g.restore();
      g.strokeStyle = 'rgba(143,224,240,.5)'; g.lineWidth = 3; g.strokeRect(36, 36, 928, 1328); g.lineWidth = 1; g.strokeRect(50, 50, 900, 1300);
    } };
  }
  function insidePage() {
    const el = h('div', 'page');
    el.appendChild(h('div', 'eyebrow', 'UNIKIN, the free future state'));
    el.appendChild(h('h2', '', 'This booklet records one person’s places.'));
    el.appendChild(h('p', '', 'Every stamp inside is drawn from the record it certifies. Change one letter of the record and the geometry moves, layer by layer.'));
    el.appendChild(h('p', '', 'Rule R4: one stamp per place, line and day. A repeat is refused and never joins the chain.'));
    el.appendChild(h('div', 'grow'));
    el.appendChild(h('p', 'small', 'Fictional state. XUN is a made-up issuer code. This is an art and ARG document, not a travel document.'));
    return { el };
  }
  function dataPage() {
    const el = h('div', 'page'); el.appendChild(h('div', 'eyebrow', 'Holder')); el.appendChild(h('h2', '', HOLDER.name));
    const dl = h('dl');
    const rows = [['Passport no.', HOLDER.number], ['Issued', HOLDER.issued], ['Nearest town or valley', HOLDER.town], ['Placed by the clerk', HOLDER.placement], ['Email', HOLDER.email ? (reveal ? HOLDER.email : maskEmail(HOLDER.email)) : ''], ['Record id', HOLDER.id]];
    rows.forEach((r) => {
      const dd = h('dd'); if (r[1]) dd.textContent = r[1]; else { dd.textContent = 'Not on record'; dd.className = 'none'; }
      if (r[0] === 'Email' && HOLDER.email) { const b = h('button', 'mini', reveal ? 'Hide' : 'Show'); b.type = 'button'; b.addEventListener('click', () => { reveal = !reveal; build(true); }); dd.appendChild(b); }
      dl.appendChild(h('dt', '', r[0])); dl.appendChild(dd);
    });
    el.appendChild(dl); el.appendChild(h('div', 'grow'));
    const mz = mrzLines(); el.appendChild(h('div', 'mrz', mz[0] + '\n' + mz[1]));
    el.appendChild(h('p', 'small', 'UniKin zone line. Check digits follow the public 7-3-1 scheme.'));
    return { el };
  }
  function gridPage() {
    const el = h('div', 'page'); el.appendChild(h('div', 'eyebrow', 'ID grid')); el.appendChild(h('h2', '', '9 \xd7 9 hexadecimal portrait'));
    const box = h('div', 'stampbox'), c = document.createElement('canvas'); box.appendChild(c); el.appendChild(box);
    el.appendChild(h('p', '', HOLDER.grid ? HOLDER.grid.filter(Boolean).length + ' of 81 cells filled. The grid is printed at the centre of every stamp, and one changed cell breaks the stamp.' : 'No signature on record. Paint the 9\xd79 signet panel below to fill the ID grid.'));
    el.appendChild(h('div', 'grow'));
    return { el, draw() {
      c.width = c.height = 540; const g = c.getContext('2d'), s = 60;
      g.fillStyle = '#f6faf8'; g.fillRect(0, 0, 540, 540);
      if (HOLDER.grid) HOLDER.grid.forEach((v, i) => { if (v) { g.fillStyle = v; g.fillRect((i % 9) * s, Math.floor(i / 9) * s, s, s); } });
      g.strokeStyle = 'rgba(18,48,58,.35)'; g.lineWidth = 3; g.beginPath();
      for (let i = 1; i < 9; i++) { g.moveTo(i * s, 0); g.lineTo(i * s, 540); g.moveTo(0, i * s); g.lineTo(540, i * s); }
      g.stroke(); g.lineWidth = 6; g.strokeStyle = '#12303a'; g.strokeRect(3, 3, 534, 534);
    } };
  }
  function stampPage(st, i) {
    const hasMap = st.F.lat != null && st.F.lon != null;
    const el = h('div', 'page');
    el.appendChild(h('div', 'eyebrow', 'Stamp ' + (i + 1) + ' \xb7 ' + st.F.date));
    el.appendChild(h('h2', '', st.F.place));
    if (st.F.line) el.appendChild(h('p', '', st.F.line));
    let stampC;
    if (hasMap) {
      const wrap = h('div', 'composite-wrap'); stampC = document.createElement('canvas'); wrap.appendChild(stampC);
      el.appendChild(wrap);
      el.appendChild(h('p', 'composite-coords', Math.abs(st.F.lat).toFixed(4) + '\xb0' + (st.F.lat >= 0 ? 'N' : 'S') + '\u2002' + Math.abs(st.F.lon).toFixed(4) + '\xb0' + (st.F.lon >= 0 ? 'E' : 'W')));
    } else {
      const box = h('div', 'stampbox'); stampC = document.createElement('canvas'); box.appendChild(stampC); el.appendChild(box);
    }
    el.appendChild(h('div', 'flag' + (st.ok ? '' : ' bad'), st.ok ? 'Lodged' : 'Refused by rule R4'));
    el.appendChild(h('p', 'small', (st.ok ? 'Seal ' : 'Would-be seal ') + st.L.seal.value + (st.ok ? '' : '. Not added to the chain.')));
    /* delete button */
    const df = h('div', 'del-place');
    const frm = document.createElement('form'); frm.method = 'POST'; frm.action = '/passport/';
    function hi(n, v) { const inp = document.createElement('input'); inp.type = 'hidden'; inp.name = n; inp.value = v; frm.appendChild(inp); }
    hi('csrf', CSRF); hi('a', 'delete_place'); hi('idx', String(i));
    const btn = document.createElement('button'); btn.type = 'submit'; btn.textContent = '\xd7 Remove stamp';
    btn.addEventListener('click', (e) => { if (!confirm('Remove this stamp from your passport?')) e.preventDefault(); });
    frm.appendChild(btn); df.appendChild(frm); el.appendChild(df);
    return { el, draw() {
      if (hasMap) {
        loadComposite(stampC, st.F.lat, st.F.lon, st.F.place, st.L, { layers: ALL });
        if (!st.ok) {
          /* REPLAY banner drawn once tiles + stamp have composited \u2014 approximate delay */
          setTimeout(() => {
            const SZ = stampC.width; const g = stampC.getContext('2d');
            g.save(); g.translate(SZ / 2, SZ / 2); g.rotate(-0.5);
            g.font = '900 ' + Math.round(SZ * 0.186) + 'px "Arial Black",Impact,sans-serif';
            g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = Math.round(SZ * 0.01);
            g.strokeStyle = g.fillStyle = 'rgba(210,60,30,.85)';
            g.strokeRect(-SZ * 0.357, -SZ * 0.136, SZ * 0.714, SZ * 0.272); g.fillText('REPLAY', 0, Math.round(SZ * 0.009));
            g.restore();
          }, 2000);
        }
      } else {
        stampC.width = stampC.height = 1400; const g = stampC.getContext('2d'); drawStamp(g, 1400, st.L, { layers: ALL });
        if (!st.ok) { g.save(); g.translate(700, 700); g.rotate(-0.5); g.font = '900 260px "Arial Black",Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 14; g.strokeStyle = g.fillStyle = 'rgba(210,60,30,.85)'; g.strokeRect(-500, -190, 1000, 380); g.fillText('REPLAY', 0, 12); g.restore(); }
      }
    } };
  }
  function drawMap(g, sz, places, t) {
    if (t === undefined) t = 0;
    const TAU = Math.PI * 2;
    const palette = ['#0e6f87','#2b56b6','#7b3ab0','#b5367f','#c0782c','#2c8f6a'];

    function mercY(lat) {
      const phi = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
      return Math.log(Math.tan(Math.PI / 4 + phi / 2));
    }

    const lats = places.map(p => p.lat), lons = places.map(p => p.lon);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats);
    let minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const dLat = maxLat - minLat || 0.6, dLon = maxLon - minLon || 0.6;
    minLat -= dLat * 0.3; maxLat += dLat * 0.3;
    minLon -= dLon * 0.3; maxLon += dLon * 0.3;

    const minMY = mercY(minLat), maxMY = mercY(maxLat), dMY = maxMY - minMY || 0.001;
    const L = sz * 0.07, R = sz * 0.93, T = sz * 0.055, B = sz * 0.91;

    function proj(lat, lon) {
      return [
        (lon - minLon) / (maxLon - minLon) * (R - L) + L,
        (1 - (mercY(lat) - minMY) / dMY) * (B - T) + T
      ];
    }

    g.fillStyle = '#e8eeea'; g.fillRect(0, 0, sz, sz);

    // Graticule
    function gridIv(span) {
      for (const iv of [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30]) { if (span / iv <= 7) return iv; }
      return 30;
    }
    const latIv = gridIv(maxLat - minLat), lonIv = gridIv(maxLon - minLon);
    const gridFs = Math.max(9, Math.round(sz * 0.011));
    g.save();
    g.strokeStyle = '#5a8a9a'; g.lineWidth = 0.5; g.globalAlpha = 0.28; g.setLineDash([3, 6]);
    for (let la = Math.ceil(minLat / latIv) * latIv; la <= maxLat; la += latIv) {
      const [, y] = proj(la, minLon); g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
    }
    for (let lo = Math.ceil(minLon / lonIv) * lonIv; lo <= maxLon; lo += lonIv) {
      const [x] = proj(minLat, lo); g.beginPath(); g.moveTo(x, T); g.lineTo(x, B); g.stroke();
    }
    g.setLineDash([]); g.globalAlpha = 0.55; g.fillStyle = '#2d5060';
    g.font = '400 ' + gridFs + 'px "JetBrains Mono",ui-monospace,monospace';
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let la = Math.ceil(minLat / latIv) * latIv; la <= maxLat; la += latIv) {
      const [, y] = proj(la, minLon);
      g.fillText(Math.abs(la).toFixed(latIv < 1 ? 1 : 0) + '\xb0' + (la >= 0 ? 'N' : 'S'), L - sz * 0.005, y);
    }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let lo = Math.ceil(minLon / lonIv) * lonIv; lo <= maxLon; lo += lonIv) {
      const [x] = proj(minLat, lo);
      g.fillText(Math.abs(lo).toFixed(lonIv < 1 ? 1 : 0) + '\xb0' + (lo >= 0 ? 'E' : 'W'), x, B + sz * 0.006);
    }
    g.restore();

    // Animated text rings — alternating rotation per ring
    const fontSize = Math.max(4, Math.round(sz * 0.0054));
    g.font = '400 ' + fontSize + 'px "JetBrains Mono",ui-monospace,monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    places.forEach((p, pi) => {
      const [cx, cy] = proj(p.lat, p.lon);
      const col = palette[pi % palette.length];
      // Coordinates etched into the texture — text is accurate to the place's geography
      const latStr = Math.abs(p.lat).toFixed(5) + (p.lat >= 0 ? '\xb0N' : '\xb0S');
      const lonStr = Math.abs(p.lon).toFixed(5) + (p.lon >= 0 ? '\xb0E' : '\xb0W');
      const src = (p.name + ' ' + latStr + ' ' + lonStr + ' · ' + (p.inked || '') + ' · ' + (p.number || '') + ' ').toUpperCase();
      for (let ring = 0; ring < 24; ring++) {
        const r = (ring + 1) * sz * 0.028;
        const alpha = Math.max(0.045, 0.22 - ring * 0.011);
        g.globalAlpha = alpha; g.fillStyle = col;
        const nChars = Math.max(1, Math.round(TAU * r / (fontSize * 1.18)));
        const step = TAU / nChars;
        const rotDir = ring % 2 === 0 ? 1 : -1;
        const phase = ring * 0.41 + pi * 1.73 + t * rotDir * (0.3 + ring * 0.04);
        for (let i = 0; i < nChars; i++) {
          const a = i * step + phase;
          const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
          if (x < -fontSize || x > sz + fontSize || y < -fontSize || y > sz + fontSize) continue;
          g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.fillText(src[i % src.length], 0, 0); g.restore();
        }
      }
    });
    g.globalAlpha = 1;

    // Animated spiral contours — turn count seeded by coordinates for per-place uniqueness
    g.save(); g.lineWidth = 0.5; g.globalAlpha = 0.07;
    places.forEach((p, pi) => {
      const [cx, cy] = proj(p.lat, p.lon);
      g.strokeStyle = palette[pi % palette.length];
      // Seed variation from coordinate fractional parts — each place has a distinct density
      const frac = ((Math.abs(p.lat) % 1) + (Math.abs(p.lon) % 1)) / 2;
      const turns = 11 + Math.round(frac * 7);  // 11–18 turns per place
      const steps = turns * 160;
      for (let arm = 0; arm < 3; arm++) {
        g.beginPath();
        const armPhase = arm * TAU / 3 + t * 0.15;
        for (let s = 0; s <= steps; s++) {
          const tv = s / steps * turns * TAU, r = tv / (turns * TAU) * sz * 0.46;
          const x = cx + r * Math.cos(tv + armPhase), y = cy + r * Math.sin(tv + armPhase);
          s === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
    });
    g.restore();

    // Connection path
    if (places.length > 1) {
      g.save(); g.strokeStyle = '#10232b'; g.lineWidth = 1.4; g.setLineDash([5, 7]); g.globalAlpha = 0.35;
      g.beginPath(); places.forEach((p, i) => { const [x, y] = proj(p.lat, p.lon); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }); g.stroke(); g.restore();
    }

    // Place glyph markers — initial-letter badge per place for recognition
    const mR = sz * 0.025, badgeFs = Math.max(12, Math.round(sz * 0.021)), labFs = Math.max(10, Math.round(sz * 0.014));
    places.forEach((p, pi) => {
      const [x, y] = proj(p.lat, p.lon), col = palette[pi % palette.length];
      const init = (p.name || '?').trim().charAt(0).toUpperCase();
      g.save();
      g.globalAlpha = 0.18; g.fillStyle = col; g.beginPath(); g.arc(x, y, mR * 2.6, 0, TAU); g.fill();
      g.globalAlpha = 1; g.fillStyle = col; g.beginPath(); g.arc(x, y, mR, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 ' + badgeFs + 'px "JetBrains Mono",ui-monospace,monospace'; g.fillText(init, x, y);
      const label = p.name + (p.inked ? ' \xb7 ' + p.inked.slice(0, 7) : '');
      g.font = '600 ' + labFs + 'px "JetBrains Mono",ui-monospace,monospace';
      g.textAlign = 'left'; g.textBaseline = 'middle';
      const lx = x + mR * 1.7, tw = g.measureText(label).width;
      g.globalAlpha = 0.72; g.fillStyle = '#e8eeea'; g.fillRect(lx - 2, y - labFs * 0.6, tw + 4, labFs * 1.2);
      g.globalAlpha = 0.95; g.fillStyle = col; g.fillText(label, lx, y);
      g.restore();
    });

    // North arrow — top right inside data area
    const ax = sz * 0.905, ay = sz * 0.08, ah = sz * 0.038;
    g.save(); g.globalAlpha = 0.65; g.fillStyle = '#10232b';
    g.beginPath(); g.moveTo(ax, ay - ah * 0.55); g.lineTo(ax - ah * 0.28, ay + ah * 0.35); g.lineTo(ax, ay + ah * 0.1); g.lineTo(ax + ah * 0.28, ay + ah * 0.35); g.closePath(); g.fill();
    g.font = '600 ' + Math.round(sz * 0.017) + 'px "JetBrains Mono",ui-monospace,monospace';
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('N', ax, ay + ah * 0.38); g.restore();

    // Scale bar — bottom left inside data area
    const cLat = (minLat + maxLat) / 2;
    const pxPerKm = (R - L) / ((maxLon - minLon) * Math.cos(cLat * Math.PI / 180) * 111.32);
    let sd = 1;
    for (const d of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) { if (d * pxPerKm < (R - L) * 0.18) sd = d; }
    const bx = L, by = B - sz * 0.04, bh = sz * 0.007, bp = sd * pxPerKm;
    g.save(); g.globalAlpha = 0.65; g.fillStyle = '#10232b';
    g.fillRect(bx, by, bp, bh); g.fillRect(bx, by - sz * 0.004, sz * 0.003, bh + sz * 0.004); g.fillRect(bx + bp - sz * 0.003, by - sz * 0.004, sz * 0.003, bh + sz * 0.004);
    g.font = '400 ' + Math.round(sz * 0.011) + 'px "JetBrains Mono",ui-monospace,monospace';
    g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(sd + ' km', bx, by - sz * 0.006); g.restore();

    g.save(); g.strokeStyle = '#12303a'; g.lineWidth = sz * 0.004; g.globalAlpha = 0.7;
    g.strokeRect(sz * 0.015, sz * 0.015, sz * 0.97, sz * 0.97); g.restore();
  }

  function mapPage() {
    const geo = SAMPLE.places.filter(p => p.lat != null && p.lon != null);
    const el = h('div', 'page');
    el.appendChild(h('div', 'eyebrow', 'Territory \xb7 ' + geo.length + '\xd7 located'));
    el.appendChild(h('h2', '', 'The map'));
    const box = h('div', 'stampbox'), c = document.createElement('canvas'); box.appendChild(c); el.appendChild(box);
    el.appendChild(h('p', '', geo.length + ' of ' + SAMPLE.places.length + ' places resolved via OpenStreetMap.'
      + (geo.length < SAMPLE.places.length ? ' Remaining will resolve on next visit.' : '')));
    el.appendChild(h('div', 'grow'));

    const annotated = geo.map(p => ({ ...p, number: SAMPLE.number }));
    let raf = null, startT = null;

    function frame(ts) {
      if (!startT) startT = ts;
      const t = (ts - startT) * 0.001;
      const g = c.getContext('2d');
      if (!geo.length) {
        g.fillStyle = '#e8eeea'; g.fillRect(0, 0, 1200, 1200);
        g.fillStyle = '#52666c'; g.font = '400 32px "JetBrains Mono",monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('No places located yet.', 600, 600); g.fillText('Refresh to resolve.', 600, 650);
        raf = null; return;
      }
      drawMap(g, 1200, annotated, t);
      raf = requestAnimationFrame(frame);
    }

    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { if (!raf) raf = requestAnimationFrame(frame); }
      else { if (raf) { cancelAnimationFrame(raf); raf = null; startT = null; } }
    }, { threshold: 0.1 });

    return { el, draw() {
      c.width = c.height = 1200; startT = null; obs.observe(c);
      if (!raf) raf = requestAnimationFrame(frame);
    } };
  }

  function chainPage() {
    const el = h('div', 'page'); el.appendChild(h('div', 'eyebrow', 'Chain')); el.appendChild(h('h2', '', 'Seals in order'));
    el.appendChild(h('p', '', 'Each accepted seal hashes the one before it. Deleting or reordering a stamp breaks every later seal.'));
    const ol = h('ol'); const g0 = h('li'); g0.innerHTML = '<b>Genesis</b> \xb7 number only'; ol.appendChild(g0);
    STAMPS.forEach((st, i) => { const li = h('li'); const b = h('b', '', 'Stamp ' + (i + 1) + (st.ok ? '' : ' refused')); li.appendChild(b); li.appendChild(document.createTextNode(' \xb7 ' + st.L.seal.value)); if (!st.ok) li.style.opacity = '.5'; ol.appendChild(li); });
    el.appendChild(ol); el.appendChild(h('div', 'grow'));
    el.appendChild(h('p', 'small', 'Visual fingerprints from a fast, non-cryptographic hash. A real issuer would sign the seal with a private key.'));
    return { el };
  }
  function blankPage() { const el = h('div', 'page'); el.appendChild(h('div', 'eyebrow', 'Further places')); el.appendChild(h('div', 'grow')); return { el }; }
  function chroniclePage() {
    const el = h('div', 'page'); el.appendChild(h('div', 'eyebrow', 'Chronicle · ' + (CHRONICLE ? CHRONICLE.generated : '')));
    el.appendChild(h('h2', '', 'The record as written'));
    if (CHRONICLE && CHRONICLE.text) {
      const paras = CHRONICLE.text.split(/\n+/).filter(Boolean);
      paras.forEach((p) => el.appendChild(h('p', '', p)));
      el.appendChild(h('div', 'grow'));
      el.appendChild(h('p', 'small', 'Narrated by ' + (CHRONICLE.model || 'the clerk') + ' on ' + (CHRONICLE.generated || '') + '. Permanent until burned.'));
    } else {
      el.appendChild(h('p', 'none', 'No chronicle yet. Use the panel below to have the clerk write one.'));
      el.appendChild(h('div', 'grow'));
    }
    return { el };
  }
  function backPage() {
    const el = h('div', 'page backcover'); const c = document.createElement('canvas'); el.appendChild(c);
    return { el, draw() {
      c.width = 1000; c.height = 1400; const g = c.getContext('2d');
      const gr = g.createLinearGradient(1000, 0, 0, 1400); gr.addColorStop(0, '#133a47'); gr.addColorStop(1, '#0a1d25'); g.fillStyle = gr; g.fillRect(0, 0, 1000, 1400);
      const r = rngFor('back-grain'); for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.08)'; g.fillRect(r() * 1000, r() * 1400, 1 + r() * 2, 1 + r() * 2); }
      g.strokeStyle = 'rgba(143,224,240,.5)'; g.lineWidth = 3; g.strokeRect(36, 36, 928, 1328); g.lineWidth = 1; g.strokeRect(50, 50, 900, 1300);
    } };
  }

  function mrzLines() {
    const parts = HOLDER.name.toUpperCase().split(/\s+/), sur = parts[parts.length - 1], giv = parts.slice(0, -1).join('<');
    const l1 = ('P<XUN' + sur + '<<' + giv).padEnd(44, '<').slice(0, 44);
    const doc = clean(HOLDER.number), c1 = check731(doc), iss = HOLDER.issued.replace(/-/g, '').slice(2), c2 = check731(iss);
    const cnt = String(STAMPS.filter((s) => s.ok).length).padStart(2, '0'), c3 = check731(cnt), comp = check731(doc + c1 + iss + c2 + cnt + c3);
    const l2 = (doc + c1 + 'XUN' + iss + c2 + cnt + c3 + comp).padEnd(44, '<').slice(0, 44);
    return [l1, l2];
  }
  let readerJobs = [];
  function buildReader() {
    const r = $('reader'); r.innerHTML = ''; readerJobs = [];
    const col = h('div', 'col'); r.appendChild(col);
    col.appendChild(h('p', 'eyebrow', 'UNIKIN, the free future state'));
    col.appendChild(h('h2', '', 'Passport of ' + HOLDER.name));
    col.appendChild(h('h3', '', 'Holder'));
    const dl = h('dl');
    [['Name', HOLDER.name], ['Passport number', HOLDER.number], ['Issued', HOLDER.issued], ['Nearest town or valley', HOLDER.town], ['Placed by the clerk', HOLDER.placement], ['Email', HOLDER.email ? (reveal ? HOLDER.email : maskEmail(HOLDER.email)) : ''], ['Record id', HOLDER.id]].forEach((row) => {
      const dd = h('dd'); if (row[1]) dd.textContent = row[1]; else { dd.textContent = 'Not on record'; dd.className = 'none'; }
      if (row[0] === 'Email' && HOLDER.email) { const b = h('button', 'mini', reveal ? 'Hide' : 'Show'); b.type = 'button'; b.addEventListener('click', () => { reveal = !reveal; build(true); }); dd.appendChild(b); }
      dl.appendChild(h('dt', '', row[0])); dl.appendChild(dd);
    });
    col.appendChild(dl);
    col.appendChild(h('h3', '', 'ID grid'));
    const gc = document.createElement('canvas'); gc.width = gc.height = 270; gc.style.maxWidth = '270px'; col.appendChild(gc);
    col.appendChild(h('p', '', HOLDER.grid ? HOLDER.grid.filter(Boolean).length + ' of 81 cells filled.' : 'No signature on record.'));
    readerJobs.push(() => {
      const g = gc.getContext('2d'), s = 30; g.fillStyle = '#f6faf8'; g.fillRect(0, 0, 270, 270);
      if (HOLDER.grid) HOLDER.grid.forEach((v, i) => { if (v) { g.fillStyle = v; g.fillRect((i % 9) * s, Math.floor(i / 9) * s, s, s); } });
      g.strokeStyle = 'rgba(18,48,58,.3)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= 9; i++) { g.moveTo(i * s, 0); g.lineTo(i * s, 270); g.moveTo(0, i * s); g.lineTo(270, i * s); } g.stroke();
      g.lineWidth = 3; g.strokeStyle = '#12303a'; g.strokeRect(0, 0, 270, 270);
    });
    if (STAMPS.length) {
      col.appendChild(h('h3', '', 'Stamps'));
      STAMPS.forEach((st, i) => {
        col.appendChild(h('h4', '', 'Stamp ' + (i + 1) + ': ' + st.F.place));
        col.appendChild(h('p', '', [st.F.line, st.F.date, st.ok ? 'Lodged' : 'Refused by rule R4'].filter(Boolean).join(' \xb7 ')));
        col.appendChild(h('p', 'small', (st.ok ? 'Seal ' : 'Would-be seal ') + st.L.seal.value));
        const c = document.createElement('canvas'); c.width = c.height = 700; c.style.maxWidth = '340px'; col.appendChild(c);
        readerJobs.push(() => drawStamp(c.getContext('2d'), 700, st.L, { layers: ALL }));
      });
    }
    col.appendChild(h('h3', '', 'Zone line'));
    const mz = mrzLines(); col.appendChild(h('div', 'mrz', mz[0] + '\n' + mz[1]));
    const rGeo = SAMPLE.places.filter((p) => p.lat != null && p.lon != null);
    if (rGeo.length) {
      col.appendChild(h('h3', '', 'Map'));
      const mc = document.createElement('canvas'); mc.width = mc.height = 700; mc.style.maxWidth = '100%'; col.appendChild(mc);
      col.appendChild(h('p', 'small', rGeo.length + ' of ' + SAMPLE.places.length + ' places resolved.'));
      readerJobs.push(() => drawMap(mc.getContext('2d'), 700, rGeo.map((p) => ({ ...p, number: SAMPLE.number }))));
    }
    if (STAMPS.length) {
      col.appendChild(h('h3', '', 'Chain'));
      const ol = h('ol'); STAMPS.forEach((st, i) => ol.appendChild(h('li', '', 'Stamp ' + (i + 1) + (st.ok ? '' : ' (refused)') + ': ' + st.L.seal.value))); col.appendChild(ol);
    }
    if (CHRONICLE && CHRONICLE.text) {
      col.appendChild(h('h3', '', 'Chronicle'));
      CHRONICLE.text.split(/\n+/).filter(Boolean).forEach((p) => col.appendChild(h('p', '', p)));
      col.appendChild(h('p', 'small', 'Narrated by ' + (CHRONICLE.model || 'the clerk') + ' on ' + (CHRONICLE.generated || '') + '.'));
    }
    col.appendChild(h('p', 'small', 'Fictional state. XUN is a made-up issuer code. Art and ARG document, not a travel document.'));
  }
  function drawReader() { readerJobs.forEach((j) => j()); readerJobs = []; }

  function build(keepTurn) {
    const keep = keepTurn ? t : 0;
    book.innerHTML = ''; pages = []; leaves = [];
    const add = (title, p) => { pages.push({ title, el: p.el, draw: p.draw, done: false }); };
    add('Cover', coverPage()); add('Inside cover', insidePage()); add('Holder page', dataPage()); add('ID grid', gridPage());
    STAMPS.forEach((st, i) => add('Stamp ' + (i + 1) + ', ' + st.F.place, stampPage(st, i)));
    add('Map', mapPage());
    add('Chain', chainPage());
    add('Chronicle', chroniclePage());
    if (pages.length % 2 === 0) add('Further places', blankPage());
    add('Back cover', backPage());
    nLeaves = pages.length / 2;
    for (let i = 0; i < nLeaves; i++) {
      const lf = h('div', 'leaf'), f = h('div', 'face front'), b = h('div', 'face back');
      pages[2 * i].el.classList.add('right'); pages[2 * i + 1].el.classList.add('left');
      f.appendChild(pages[2 * i].el); f.appendChild(h('div', 'shade')); b.appendChild(pages[2 * i + 1].el); b.appendChild(h('div', 'shade'));
      pages[2 * i].el.appendChild(h('div', 'folio', String(2 * i + 1))); pages[2 * i + 1].el.appendChild(h('div', 'folio', String(2 * i + 2)));
      lf.appendChild(f); lf.appendChild(b); book.appendChild(lf); leaves.push(lf);
    }
    layout(); setTurn(keep, true); buildReader(); if (document.body.classList.contains('reading')) drawReader();
  }

  function ensure(i) { const p = pages[i]; if (p && !p.done && p.draw) { p.done = true; p.draw(); } }
  function setTurn(n, instant) {
    t = clamp(n, 0, nLeaves);
    if (instant) book.classList.add('nodrag');
    leaves.forEach((lf, i) => {
      const turned = i < t; if (instant) lf.classList.add('drag');
      lf.style.setProperty('--a', turned ? '-180deg' : '0deg'); lf.style.setProperty('--z', ((turned ? i : nLeaves - i) * 0.6) + 'px'); lf.style.setProperty('--shade', '0');
    });
    book.dataset.state = t === 0 ? 'front' : (t === nLeaves ? 'back' : 'open'); applyShift();
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => { book.classList.remove('nodrag'); leaves.forEach((lf) => lf.classList.remove('drag')); }));
    const vis = []; if (t > 0) vis.push(2 * t - 1); if (t < nLeaves) vis.push(2 * t);
    pages.forEach((p, i) => { const on = vis.indexOf(i) >= 0; p.el.inert = !on; p.el.setAttribute('aria-hidden', on ? 'false' : 'true'); });
    for (let i = 2 * t - 3; i <= 2 * t + 2; i++) ensure(i);
    $('prev').disabled = t === 0; $('next').disabled = t === nLeaves;
    lastVis = vis; updateStatus();
    const cv0 = pages[0] && pages[0].el; if (cv0) cv0.tabIndex = t === 0 ? 0 : -1;
    fit(!instant);
  }
  function applyShift() { const pw = parseFloat(book.style.getPropertyValue('--pw')) || 300; const s = book.dataset.state; book.style.setProperty('--shift', (s === 'front' ? -pw / 2 : s === 'back' ? pw / 2 : 0) + 'px'); }
  const next = () => {
    if (focusMode && book.dataset.state === 'open' && focus === 'L') { focus = 'R'; fit(true); updateStatus(); return; }
    if (t < nLeaves) { focus = 'L'; setTurn(t + 1); }
  };
  const prev = () => {
    if (focusMode && book.dataset.state === 'open' && focus === 'R') { focus = 'L'; fit(true); updateStatus(); return; }
    if (t > 0) { focus = 'R'; setTurn(t - 1); }
  };
  $('next').addEventListener('click', next); $('prev').addEventListener('click', prev);

  function layout() {
    const w = stage.clientWidth, hh = stage.clientHeight;
    const pw = Math.floor(clamp(Math.min(w * 0.47, hh * 0.93 / 1.4), 120, 560));
    book.style.setProperty('--pw', pw + 'px'); book.style.setProperty('--ph', Math.round(pw * 1.4) + 'px'); applyShift();
    fitS = Math.min(w * 0.96 / pw, hh * 0.98 / (pw * 1.4)); focusMode = pw < 440 && fitS >= 1.3;
    const sv = (function () { let d = ''; for (let j = 0; j < 70; j++) { const y0 = j * 2.02; let p = 'M0 ' + y0.toFixed(2); for (let x = 2; x <= 100; x += 2) p += 'L' + x + ' ' + (y0 + Math.sin(x / 100 * 14 + j * 0.35) * 0.55).toFixed(2); d += p; }
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 141.4" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="rgba(30,92,110,.12)" stroke-width=".18"/></svg>'; })();
    book.style.setProperty('--lines', 'url("data:image/svg+xml,' + encodeURIComponent(sv) + '")');
  }
  window.addEventListener('resize', () => { layout(); if (focusMode) fit(false); else { clampPan(); applyZoom(); } });

  const Z = { s: 1, x: 0, y: 0 };
  function applyZoom() { zoomEl.style.transform = 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')'; }
  function clampPan() { const w = stage.clientWidth, hh = stage.clientHeight; Z.x = clamp(Z.x, w * (1 - Z.s), 0); Z.y = clamp(Z.y, hh * (1 - Z.s), 0); if (Z.s <= 1.001) { Z.s = 1; Z.x = 0; Z.y = 0; } }
  function zoomAt(cx, cy, f) { const s2 = clamp(Z.s * f, 1, 4); Z.x = cx - (cx - Z.x) * (s2 / Z.s); Z.y = cy - (cy - Z.y) * (s2 / Z.s); Z.s = s2; clampPan(); applyZoom(); }
  const stageXY = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomEl.classList.remove('anim'); const p = stageXY(e); zoomAt(p[0], p[1], Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016))); }, { passive: false });
  $('reset').addEventListener('click', () => resetZoom());

  const ptr = new Map(); let drag = null, pan = null, pinch = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input')) return;
    zoomEl.classList.remove('anim');
    try { stage.setPointerCapture(e.pointerId); } catch (x) {}
    ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 2) { const a = Array.from(ptr.values()); pinch = { d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), s: Z.s }; drag = null; pan = null; return; }
    if (Z.s > 1.02) { pan = { x: e.clientX, y: e.clientY, zx: Z.x, zy: Z.y, moved: false }; return; }
    const r = stage.getBoundingClientRect(), right = e.clientX - r.left > r.width / 2, st = book.dataset.state;
    let dir = 0; if (st === 'front') dir = 1; else if (st === 'back') dir = -1; else dir = right ? 1 : -1;
    if (dir > 0 && t >= nLeaves) dir = 0; if (dir < 0 && t <= 0) dir = 0;
    drag = { dir, x0: e.clientX, leaf: dir > 0 ? leaves[t] : leaves[t - 1], moved: false, target: e.target };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptr.size >= 2) { const a = Array.from(ptr.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), r = stage.getBoundingClientRect(); const cx = (a[0][0] + a[1][0]) / 2 - r.left, cy = (a[0][1] + a[1][1]) / 2 - r.top; zoomAt(cx, cy, (pinch.s * d / pinch.d) / Z.s); return; }
    if (pan) { const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (Math.abs(dx) + Math.abs(dy) > 4) pan.moved = true; Z.x = pan.zx + dx; Z.y = pan.zy + dy; clampPan(); applyZoom(); return; }
    if (!drag || !drag.dir) return;
    const dx = e.clientX - drag.x0; if (Math.abs(dx) > 5) drag.moved = true; if (!drag.moved) return;
    const span = parseFloat(book.style.getPropertyValue('--pw')) * 1.6;
    const ang = drag.dir > 0 ? -clamp(-dx / span * 180, 0, 180) : -180 + clamp(dx / span * 180, 0, 180);
    drag.ang = ang; drag.leaf.classList.add('drag'); drag.leaf.style.setProperty('--a', ang + 'deg'); drag.leaf.style.setProperty('--shade', String(Math.sin(Math.abs(ang) * Math.PI / 180) * 0.6));
    if (book.dataset.state === 'front' || book.dataset.state === 'back') { book.dataset.state = 'open'; applyShift(); }
  });
  function endPtr(e) {
    ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null;
    if (pan) {
      const p0 = pan; pan = null;
      if (!p0.moved && focusMode && Z.s <= fitS * 1.05) { const r = stage.getBoundingClientRect(); if (p0.x - r.left > r.width / 2) next(); else prev(); }
      return;
    }
    if (!drag) return; const d = drag; drag = null; if (!d.dir) return;
    if (d.leaf) d.leaf.classList.remove('drag');
    if (!d.moved) { if (window.getSelection && String(window.getSelection())) { setTurn(t); return; } d.dir > 0 ? next() : prev(); return; }
    const a = d.ang == null ? (d.dir > 0 ? 0 : -180) : d.ang;
    if (d.dir > 0) setTurn(a < -60 ? t + 1 : t); else setTurn(a > -120 ? t - 1 : t);
  }
  stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
  stage.addEventListener('dblclick', () => resetZoom());

  document.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key;
    if ((k === 'Enter' || k === ' ') && t === 0) { e.preventDefault(); next(); }
    else if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Home') { setTurn(0); } else if (k === 'End') { setTurn(nLeaves); }
    else if (k === '+' || k === '=') zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.25);
    else if (k === '-') zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.8);
    else if (k === '0' || k === 'Escape') resetZoom();
  });

  function fit(anim) {
    if (!focusMode) return;
    const w = stage.clientWidth, hh = stage.clientHeight, pw = parseFloat(book.style.getPropertyValue('--pw')) || 300, st = book.dataset.state;
    const side = st === 'front' ? 'R' : st === 'back' ? 'L' : focus, shift = st === 'front' ? -pw / 2 : st === 'back' ? pw / 2 : 0;
    const xc = shift + (side === 'R' ? pw / 2 : -pw / 2), s = clamp(fitS, 1, 4);
    Z.s = s; Z.x = w / 2 - s * (w / 2 + xc); Z.y = hh / 2 * (1 - s);
    zoomEl.classList.toggle('anim', anim !== false); applyZoom();
  }
  function resetZoom() { if (focusMode) fit(true); else { Z.s = 1; Z.x = 0; Z.y = 0; zoomEl.classList.remove('anim'); applyZoom(); } }
  function updateStatus() {
    let v = lastVis; if (focusMode && book.dataset.state === 'open' && v.length === 2) v = [v[focus === 'L' ? 0 : 1]];
    $('status').textContent = v.map((i) => pages[i].title).join(' \xb7 ');
  }
  $('readbtn').addEventListener('click', () => {
    const on = document.body.classList.toggle('reading');
    $('readbtn').textContent = on ? 'Show the book' : 'Read as text'; $('readbtn').setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { drawReader(); $('reader').scrollTop = 0; } else { layout(); fit(false); }
  });

  window.unikinPassport = { load: (rec) => loadRecord(rec, 'Signed-in member') };
  loadRecord(SAMPLE, '<?= addslashes(htmlspecialchars_decode(htmlspecialchars((string)$citizen['name']))) ?>');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { pages.forEach((p) => { p.done = false; }); const keep = t; setTurn(keep); });
})();

/* signet editor */
(function(){
  var grid=document.getElementById('sigGrid');
  var hidden=document.getElementById('sigPixels');
  var colorEl=document.getElementById('sigColor');
  if(!grid||!hidden||!colorEl) return;
  var cells; try{ cells=JSON.parse(hidden.value||'[]'); }catch(e){ cells=[]; }
  while(cells.length<81) cells.push(''); cells=cells.slice(0,81);
  var drawing=false, btns=[];
  function cellBg(h){ return h||'#1e3040'; }
  function sync(){ hidden.value=JSON.stringify(cells); }
  function paint(idx){ cells[idx]=colorEl.value; if(btns[idx]) btns[idx].style.background=cellBg(cells[idx]); sync(); }
  for(var i=0;i<81;i++){
    (function(idx){
      var b=document.createElement('button'); b.type='button';
      b.style.cssText='width:18px;height:18px;border:0;padding:0;cursor:crosshair;background:'+cellBg(cells[idx]);
      b.addEventListener('pointerdown',function(e){ e.preventDefault(); drawing=true; paint(idx); });
      b.addEventListener('pointerenter',function(){ if(drawing) paint(idx); });
      grid.appendChild(b); btns[idx]=b;
    })(i);
  }
  document.addEventListener('pointerup',function(){ drawing=false; });
  document.getElementById('sigFill').addEventListener('click',function(){
    var c=colorEl.value; for(var i=0;i<81;i++){ cells[i]=c; if(btns[i]) btns[i].style.background=c; } sync();
  });
  document.getElementById('sigClear').addEventListener('click',function(){
    for(var i=0;i<81;i++){ cells[i]=''; if(btns[i]) btns[i].style.background='#1e3040'; } sync();
  });
  document.body.classList.add('has-panel');
})();
</script>
</body>
</html>
