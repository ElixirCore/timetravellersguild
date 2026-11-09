<?php
/* Registry office - the plain-paper back room, outside the story.
   What is held, export, erasure. No fiction here. */

session_name('TTGPASS');
session_set_cookie_params(['path'=>'/passport/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
session_start();

/* Registry kept outside the served tree when writable; denied folder as fallback. */
define('REG_DIR', (is_writable(dirname(__DIR__,3)) || is_dir(dirname(__DIR__,3).'/ttg-passport')) ? dirname(__DIR__,3).'/ttg-passport' : __DIR__.'/registry');
define('REG_FILE', REG_DIR.'/citizens.json');

/* Retract one of this office's OWN submissions from the tree's pending field -
   only while it is still PENDING (not yet accepted by a keeper). Uses the tree's
   own locked save. 1 retracted, 0 not in the pending field, -1 write failed. */
function tree_retract_pending(string $publicId): int {
  try{
    $lib=dirname(__DIR__).'/inc/graph.php';
    if(!is_file($lib)) return -1;
    require_once $lib;
    if(!function_exists('ttg_graph_save_locked')) return -1;
    $removed=0;
    $ok=ttg_graph_save_locked('pending.json', static function(array $list) use ($publicId,&$removed){
      $keep=[];
      foreach($list as $n){
        if(($n['public_id']??'')===$publicId && ($n['status']??'')==='PENDING'){ $removed++; continue; }
        $keep[]=$n;
      }
      return $keep;
    });
    if(!$ok) return -1;
    return $removed>0 ? 1 : 0;
  }catch(Throwable $e){ return -1; }
}

/* Retraction queue: tombstones for submissions whose retraction could not
   complete at erase time; the Passport Office sweeps them on its visits. */
define('RET_FILE', REG_DIR.'/retractions.json');
function ret_queue(){ if(!is_file(RET_FILE)) return []; $d=json_decode(@file_get_contents(RET_FILE),true); return is_array($d)?$d:[]; }
function ret_save($q){ if(!is_dir(REG_DIR)) mkdir(REG_DIR,0700,true); file_put_contents(RET_FILE,json_encode($q,JSON_PRETTY_PRINT),LOCK_EX); chmod(RET_FILE,0600); }
function ret_sweep(): void {
  $q=ret_queue(); if(!$q) return;
  $left=[]; $tries=0;
  foreach($q as $idx=>$job){
    $id=(string)($job['id']??'');
    if($id==='') continue;
    if($tries>=3){ $left[]=$job; continue; }
    $tries++;
    $r=tree_retract_pending($id);
    if($r===-1){ $left=array_merge($left,array_slice($q,$idx)); break; }
  }
  if(!$left && is_file(RET_FILE)){ @unlink(RET_FILE); return; }
  ret_save($left);
}
ret_sweep();

/* Workbench archive cleanup: if an archive could not be unlinked at erase time its
   exact path is queued here and retried on office visits. Only archives explicitly
   queued by an erasure are ever touched; nothing is deleted by inference. */
define('WBRET_FILE', REG_DIR.'/workbench-cleanup.json');
function wb_queue(){ if(!is_file(WBRET_FILE)) return []; $d=json_decode(@file_get_contents(WBRET_FILE),true); return is_array($d)?$d:[]; }
function wb_save($q){ if(!is_dir(REG_DIR)) mkdir(REG_DIR,0700,true); $ok=@file_put_contents(WBRET_FILE,json_encode($q,JSON_PRETTY_PRINT),LOCK_EX); if($ok!==false) chmod(WBRET_FILE,0600); return $ok!==false; }
function wb_sweep(): void {
  $q=wb_queue(); if(!$q) return;
  $left=[]; $tries=0;
  foreach($q as $f){
    $f=(string)$f;
    if(!preg_match('#^'.preg_quote(REG_DIR,'#').'/workbench-[a-f0-9]+\.json$#',$f)) continue;   /* only ever this office's own archive files, named explicitly at erase time */
    if($tries>=3){ $left[]=$f; continue; }
    $tries++;
    if(is_file($f) && !@unlink($f)) $left[]=$f;
  }
  if(!$left){ @unlink(WBRET_FILE); return; }
  wb_save($left);   /* entries are never dropped silently: a failed save leaves the existing queue file in place */
}
wb_sweep();

function esc($s){ return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8'); }
function reg_load(){ if(!is_file(REG_FILE)) return []; $d=json_decode(@file_get_contents(REG_FILE),true); return is_array($d)?$d:[]; }
function reg_save($r){ file_put_contents(REG_FILE,json_encode($r,JSON_PRETTY_PRINT),LOCK_EX); chmod(REG_FILE,0600); }
function csrf_ok(){ return isset($_POST['csrf'],$_SESSION['csrf']) && hash_equals($_SESSION['csrf'],$_POST['csrf']); }
function csrf_token(){ if(empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32)); return $_SESSION['csrf']; }

$c=$_SESSION['citizen']??null; $msg=''; $err='';

if($_SERVER['REQUEST_METHOD']==='POST' && $c){
  if(!csrf_ok()) $err='Form seal mismatch. Try again.';
  elseif(($_POST['a']??'')==='erase'){
    $pass=(string)($_POST['pass']??'');
    $r=reg_load();
    $found=false;
    foreach($r as $i=>$rec){
      if($rec['id']===$c['id']){
        if(!password_verify($pass,$rec['hash'])){ $err='Passphrase did not match; record kept.'; $found=true; break; }
        array_splice($r,$i,1); reg_save($r);   /* the record goes first; the queue below can never lose the node ids */
        $wbf=REG_DIR.'/workbench-'.preg_replace('/[^a-f0-9]/','',$rec['id']).'.json';   /* the Workbench archive goes with the record */
        $wbqueued=0;   /* 0 removed or none; 1 removal queued; 2 could not be removed or queued - both told plainly below */
        if(is_file($wbf) && !@unlink($wbf) && !@unlink($wbf)){   /* tried twice; failure is never silently claimed */
          $wq=wb_queue();
          if(!in_array($wbf,$wq,true)) $wq[]=$wbf;
          $wbqueued=wb_save($wq)?1:2;
        }
        $retracted=0; $queued=0; $kept=0; $jobs=ret_queue();
        foreach(($rec['places']??[]) as $p){
          if(($p['tree']??'')==='lodged'){
            $tid=(string)($p['tree_id']??'');
            if($tid===''){ $kept++; continue; }   /* no exact id recorded: nothing safe to retract */
            $rr=tree_retract_pending($tid);
            if($rr===1) $retracted++;
            elseif($rr===0) $kept++;               /* no longer pending: accepted by a keeper or already gone */
            else{ $jobs[]=['id'=>$tid,'slug'=>(string)($p['tree_slug']??''),'queued_at'=>gmdate('c')]; $queued++; }
          }
        }
        if($queued>0) ret_save($jobs);
        $_SESSION=[]; session_destroy();
        header('Location: registry.php?erased=1&retracted='.$retracted.'&queued='.$queued.'&kept='.$kept.'&wbqueued='.$wbqueued); exit;
      }
    }
    if(!$found && !$err) $err='Record not found in the registry.';
  }
}
if(($_GET['a']??'')==='export' && $c){
  $r=reg_load();
  foreach($r as $rec) if($rec['id']===$c['id']){
    unset($rec['hash']);
    foreach(($rec['places']??[]) as $j=>$p) unset($rec['places'][$j]['tree_note']);
    $wbf=REG_DIR.'/workbench-'.preg_replace('/[^a-f0-9]/','',$rec['id']).'.json';
    $rec['workbench']=is_file($wbf)?json_decode(@file_get_contents($wbf),true):null;
    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="ttg-passport-record.json"');
    echo json_encode($rec,JSON_PRETTY_PRINT); exit;
  }
}
$erased=($_GET['erased']??'')==='1';
$retracted=(int)($_GET['retracted']??0); $queued=(int)($_GET['queued']??0); $kept=(int)($_GET['kept']??0); $wbqueued=(int)($_GET['wbqueued']??0);
?><!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Registry office - your record and its keeping</title>
<style>
body{background:#faf8f2;color:#222;font:16px/1.6 Georgia,serif;margin:0;padding:40px 20px}
main{max-width:640px;margin:0 auto}
h1{font-size:22px}
h2{font-size:17px;margin-top:28px}
button{cursor:pointer;font:inherit;padding:9px 18px;margin:6px 8px 6px 0;border:1px solid #888;background:#fff}
button.warn{border-color:#a33;color:#a33}
input{font:inherit;padding:8px 10px;border:1px solid #aaa;width:100%;max-width:320px}
.rec{background:#fff;border:1px solid #ccc;padding:14px 18px;white-space:pre-wrap;font:13px/1.5 monospace;max-height:220px;overflow:auto}
.err{color:#a33;font-style:italic}
.ok{color:#274}
</style>
</head>
<body>
<main>
<h1>Registry office</h1>
<p>This is the plain-paper back room of the <a href="./">Passport Office</a>. No story here: just what is held, where, and the buttons that control it.</p>
<?php if($erased): ?>
<p class="ok">Your record has been erased. The Passport Office will greet you as a new arrival.
<?php if($retracted>0): ?><br><?=$retracted?> page record<?=$retracted===1?'':'s'?> still waiting for a keeper's eye <?=$retracted===1?'was':'were'?> retracted from the tree's pending field.<?php endif; ?>
<?php if($queued>0): ?><br><?=$queued?> retraction<?=$queued===1?' is':'s are'?> queued and will complete on a later office visit, as soon as the field can be written.<?php endif; ?>
<?php if($kept>0): ?><br><?=$kept?> page record<?=$kept===1?'':'s'?> could not be retracted by the office: already in the keeper's hands, already gone, or inked before the office kept exact note of its tree entry. <?=$kept===1?'It names':'They name'?> the place only, never your name. If any page of yours still stands in the tree and you want it taken down, contact <a href="mailto:info@ffilm.org">info@ffilm.org</a> to request removal.<?php endif; ?>
<?php if($wbqueued===1): ?><br>Your Workbench archive could not be removed this moment. It remains held privately pending deletion; the office will try again on its visits. If it is urgent, contact <a href="mailto:info@ffilm.org">info@ffilm.org</a> to request removal.<?php endif; ?>
<?php if($wbqueued===2): ?><br>Your Workbench archive could not be removed, and the office could not schedule its removal. It remains held privately; contact <a href="mailto:info@ffilm.org">info@ffilm.org</a> to request removal.<?php endif; ?></p>
<?php endif; ?>
<?php if($err): ?><p class="err"><?=esc($err)?></p><?php endif; ?>

<h2>What the passport holds</h2>
<p>Only what you gave it, so the office can keep your citizenship and pages between visits: the traveller name you chose, a one-way hash of your passphrase (the passphrase itself is never stored), your citizen number, registration date, the place pages you ink (place names and your optional line), and the Workbench archive you keep behind your passport (the build entries, notes and photographs you add there), kept until you erase it. While you are signed in, a single session cookie keeps you signed in; it lapses when you take your leave. A short-lived log of failed sign-in attempts - a salted one-way hash of the visitor's IP address with the name attempted - is kept for at most ten minutes to frustrate guessing, then dropped. The office asks for and holds no email address, no legal name, no identity documents.</p>

<h2>Where it is kept</h2>
<p>In a registry file on the Guild's own hosting, kept outside the public folders of the site (with a server-denied folder as fallback). Like almost every website, the hosting company's web server keeps its own standard access logs of page requests and visitor IP addresses; how long those are kept is set by the hosting company, not by this office.</p>

<h2>The NOW tree</h2>
<p>Each page you ink is offered to the Guild's NOW tree as a pending public record that names the place - not your traveller name - for a keeper to review. If the tree cannot take it that day, your page says so plainly, and the office offers it again each time you visit until the field takes it. Erasing your passport record removes your name, pages and sign-in from this office, retracts your pages still waiting in the tree's pending field (queueing the retraction if the field cannot be written that moment), and stops pages never yet lodged from ever being offered. Pages a keeper has already accepted into the tree's keeping name the place only; whether and how those can be withdrawn is a question this office has not yet settled with the keepers. A page inked before the office kept exact note of its tree entry cannot be retracted automatically either; if any page of yours remains in the tree, contact <a href="mailto:info@ffilm.org">info@ffilm.org</a> to request removal.</p>

<h2>If you lose your passphrase</h2>
<p>The office keeps no email address and cannot prove you are you, so a lost passphrase cannot be reset: that passport is simply lost. You may register anew under a different name. An existing name and its page are never handed to a new claimant without proof.</p>

<h2>Your standing</h2>
<p>You can see everything the office holds about you below, export it as JSON, or erase it entirely (passphrase required); erasing is as easy as enrolling was. If you are unhappy with how this office keeps your record, you can complain to the UK Information Commissioner's Office (ico.org.uk).</p>

<h2>Your record</h2>
<?php if(!$c): ?>
<p>You are not signed in. <a href="./">Present yourself at the office</a> to view, export or erase your record here.</p>
<?php else:
  $r=reg_load(); $mine=null;
  foreach($r as $rec) if($rec['id']===$c['id']){ $mine=$rec; break; }
  if($mine){ $show=$mine; unset($show['hash']);
    foreach(($show['places']??[]) as $j=>$p) unset($show['places'][$j]['tree_note']); ?>
<div class="rec"><?=esc(json_encode($show,JSON_PRETTY_PRINT))?></div>
<p><a href="registry.php?a=export"><button type="button">Export my record (JSON)</button></a></p>
<form method="post" onsubmit="return confirm('Erase your Guild passport record from the server? This cannot be undone.')">
  <input type="hidden" name="csrf" value="<?=esc(csrf_token())?>">
  <input type="hidden" name="a" value="erase">
  <p>To erase, prove yourself with your passphrase:<br><input type="password" name="pass" required autocomplete="current-password"></p>
  <button type="submit" class="warn">Erase my record</button>
</form>
<?php } else { ?><p>Your session is valid but no record was found. It may already have been erased.</p><?php } endif; ?>

<h2>Who keeps these records</h2>
<p>The Time Travellers Guild is run by Toby Godden, who is responsible for the records this office keeps. For any request about your record - to see it, correct it, or erase it - write to <a href="mailto:info@ffilm.org">info@ffilm.org</a>. Erasing your record yourself, above, is usually the quickest route.</p>
</main>
</body>
</html>
