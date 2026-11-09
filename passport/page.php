<?php
/* A single passport page: one place, in calligraphic detail.
   Visible only to the citizen who owns it (signed-in session). */

session_name('TTGPASS');
session_set_cookie_params(['path'=>'/passport/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
session_start();

/* Registry kept outside the served tree when writable; denied folder as fallback. */
define('REG_DIR', (is_writable(dirname(__DIR__,3)) || is_dir(dirname(__DIR__,3).'/ttg-passport')) ? dirname(__DIR__,3).'/ttg-passport' : __DIR__.'/registry');
define('REG_FILE', REG_DIR.'/citizens.json');

function esc($s){ return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8'); }

$slug=(string)($_GET['slug']??'');
$c=$_SESSION['citizen']??null;
$found=null; $num=0;
if($c && $slug!=='' && is_file(REG_FILE)){
  $r=json_decode((string)file_get_contents(REG_FILE),true);
  if(is_array($r)) foreach($r as $rec){
    if(($rec['id']??'')===$c['id']){
      foreach(($rec['places']??[]) as $i=>$p){
        if($p['slug']===$slug){ $found=$p; $num=$i+1; break; }
      }
    }
  }
}
if(!$found){
  http_response_code(404);
  echo '<!DOCTYPE html><meta charset="utf-8"><meta name="robots" content="noindex"><title>No such page</title>';
  echo '<body style="background:#171310;color:#8a7a58;font:16px Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center"><p>No such page in this passport. <a style="color:#c9b98f" href="./">The office &rarr;</a></p>';
  exit;
}
?><!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title><?=esc($found['name'])?> - a passport page</title>
<style>
:root{--paper:#f3ecd9;--ink:#2a2118;--red:#8f1f1f;--line:#c9b98f;--gold:#a8842c}
*{box-sizing:border-box;margin:0}
body{background:#171310;color:var(--ink);font-family:'Palatino Linotype',Palatino,Georgia,serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 16px}
.sheet{background:var(--paper);background-image:repeating-linear-gradient(0deg,transparent 0 26px,#00000006 26px 27px);border:1px solid var(--line);box-shadow:0 30px 80px #000c,inset 0 0 60px #7a5c2a22;max-width:600px;width:100%;padding:50px 44px 40px;position:relative;text-align:center}
.sheet:before{content:'';position:absolute;inset:10px;border:1px solid var(--line);pointer-events:none}
.sheet:after{content:'';position:absolute;inset:14px;border:1px solid #c9b98f66;pointer-events:none}
.corner{position:absolute;font-size:26px;color:var(--gold);line-height:1;pointer-events:none}
.c1{top:18px;left:22px}.c2{top:18px;right:22px;transform:rotate(90deg)}
.c3{bottom:18px;right:22px;transform:rotate(180deg)}.c4{bottom:18px;left:22px;transform:rotate(270deg)}
.pageno{font-variant:small-caps;letter-spacing:3px;font-size:13px;color:#8a7a58}
.placename{font-family:'Snell Roundhand','Apple Chancery','Brush Script MT',cursive;font-size:56px;line-height:1.15;margin:18px 0 6px;color:#1d150c}
.bearer{font-variant:small-caps;letter-spacing:2px;font-size:15px;color:var(--red);margin-top:10px}
.line{font-style:italic;font-size:18px;color:#4a3c26;margin:22px auto 0;max-width:400px}
.inked{margin-top:26px;font-size:13px;color:#8a7a58;font-style:italic}
.seal{display:block;width:84px;height:84px;margin:20px auto 0}
.back{margin-top:26px}
.back a{color:#6a5a3d;font-size:13px;font-style:italic}
@media(max-width:520px){.sheet{padding:36px 24px}.placename{font-size:40px}}
</style>
</head>
<body>
<div class="sheet">
  <span class="corner c1">&#10038;</span><span class="corner c2">&#10038;</span>
  <span class="corner c3">&#10038;</span><span class="corner c4">&#10038;</span>
  <div class="pageno">Passport page <?=$num?> &middot; Time Travellers Guild</div>
  <div class="placename"><?=esc($found['name'])?></div>
  <div class="bearer">the place of <?=esc($c['name'])?></div>
  <?php if(($found['line']??'')!==''): ?><div class="line">&ldquo;<?=esc($found['line'])?>&rdquo;</div><?php endif; ?>
  <svg class="seal" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#8f1f1f" stroke-width="2.5"/><circle cx="50" cy="50" r="37" fill="none" stroke="#8f1f1f" stroke-width="1"/><text x="50" y="46" text-anchor="middle" font-family="Georgia" font-size="15" fill="#8f1f1f" letter-spacing="1">XIII</text><text x="50" y="63" text-anchor="middle" font-family="Georgia" font-size="8.5" fill="#8f1f1f" letter-spacing="2">GUILD</text></svg>
  <?php if(($found['tree']??'awaiting')==='lodged'): ?>
  <div class="inked">Inked at the office, <?=esc($found['inked'])?>. Lodged with the tree as a pending record, for a keeper's eye.</div>
  <?php else: ?>
  <div class="inked">Inked at the office, <?=esc($found['inked'])?>. Not yet lodged with the tree; the office offers it again each time you visit the office.</div>
  <?php endif; ?>
  <div class="back"><a href="../">&larr; back to the passport</a></div>
</div>
</body>
</html>
