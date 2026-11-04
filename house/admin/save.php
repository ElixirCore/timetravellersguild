<?php
declare(strict_types=1);
// Must be installed only inside a Directory Privacy-protected /house/admin/.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function fail(int $status, string $message): never { http_response_code($status); echo json_encode(['ok'=>false,'error'=>$message]); exit; }
if (($_SERVER['REMOTE_USER'] ?? $_SERVER['PHP_AUTH_USER'] ?? '') !== 'toby') fail(403,'Author access is not configured.');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405,'Use the photo form.');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($origin !== 'https://'.$host) fail(403,'Open the secure photo form first.');
session_start();
if (!isset($_SESSION['guild_house_csrf'], $_POST['csrf']) || !hash_equals($_SESSION['guild_house_csrf'], (string)$_POST['csrf'])) fail(403,'Photo form expired. Reload and try again.');
$kind = $_POST['kind'] ?? '';
if (!in_array($kind,['room','object'],true)) fail(400,'Choose room or object.');
if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) fail(400,'Choose a photo under 8 MB and try again.');
$file=$_FILES['photo'];
if ($file['size'] < 100 || $file['size'] > 8*1024*1024 || !is_uploaded_file($file['tmp_name'])) fail(413,'Choose a photo under 8 MB.');
$mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
if ($mime !== 'image/jpeg') fail(415,'Please use the secure photo form to prepare a JPEG.');
$info=@getimagesize($file['tmp_name']);
if (!$info || $info['mime'] !== $mime || $info[0]<64 || $info[1]<64 || $info[0]>4096 || $info[1]>4096 || $info[0]*$info[1]>12000000) fail(415,'This image cannot be used.');
if (!function_exists('imagecreatefromjpeg') || !function_exists('imagejpeg')) fail(503,'Image storage is not configured.');
$image=@imagecreatefromjpeg($file['tmp_name']);
if (!$image) fail(415,'This JPEG cannot be decoded.');
$root=dirname(__DIR__);$manifest=$root.'/manifest-v1.json';$assetDir=$root.'/assets/'.($kind==='room'?'roomskins':'objectskins');
if (!is_dir($assetDir) || !is_writable($assetDir) || !is_writable($manifest) || !is_writable($root)) fail(503,'Server storage is unavailable. Nothing was saved.');
$name=trim((string)($_POST['name']??''));
if ($name==='')$name=pathinfo((string)$file['name'], PATHINFO_FILENAME);
$name=trim(preg_replace('/[\x00-\x1F\x7F<>]/u','',substr($name,0,280)) ?? '');
if ($name==='')$name=($kind==='room'?'New room':'New object');
$roomId=(string)($_POST['room']??'threshold');
$lon=(float)($_POST['lon']??0);$lat=(float)($_POST['lat']??0);
if (!is_finite($lon)||!is_finite($lat)) fail(400,'Invalid placement.');
$lon=max(-180,min(180,$lon));$lat=max(-80,min(80,$lat));
$lock=@fopen($root.'/admin/.manifest.lock','c');if (!$lock||!flock($lock,LOCK_EX)) fail(503,'House is busy. Try again.');
try {
 $raw=@file_get_contents($manifest);$data=json_decode($raw===false?'':$raw,true,512,JSON_THROW_ON_ERROR);
 if (!isset($data['rooms'])||!is_array($data['rooms'])) fail(503,'House map is unavailable. Nothing was saved.');
 $sourceIndex=null;foreach($data['rooms'] as $i=>$room) if (($room['id']??'')===$roomId){$sourceIndex=$i;break;}
 if ($sourceIndex===null) fail(409,'This room no longer exists. Reload the house.');
 $id='photo-'.bin2hex(random_bytes(12));$fileName=$id.'.jpg';$path=$assetDir.'/'.$fileName;
 if (!@imagejpeg($image,$path,86)) fail(503,'Could not store the photo.');
 imagedestroy($image);
 @chmod($path,0644);
 if ($kind==='room') {
   $new=['id'=>$id,'title'=>$name,'glitch'=>18,'mass'=>1,'capture'=>'one photo; partial field, unphotographed directions stay dark','doors'=>[['id'=>'back-'.$roomId,'label'=>$data['rooms'][$sourceIndex]['title'],'lon'=>135,'lat'=>0,'target'=>$roomId]],'layers'=>[['url'=>'./assets/roomskins/'.$fileName,'label'=>'Photo / partial field','era'=>'Present'],['url'=>'','label'=>'Void / uncaptured','era'=>'Awaiting capture','void'=>true]],'objects'=>[]];
   $data['rooms'][]=$new;$data['rooms'][$sourceIndex]['doors'][]=['id'=>'to-'.$id,'label'=>$name,'lon'=>$lon,'lat'=>$lat,'target'=>$id];$resultRoom=$id;
 } else {
   $data['rooms'][$sourceIndex]['objects'][]=['id'=>$id,'label'=>$name,'lon'=>$lon,'lat'=>$lat,'url'=>'./assets/objectskins/'.$fileName,'record'=>['what'=>'Photographed object: '.$name,'source'=>'Author photo.','note'=>'Single view only. NO RECORD of measured 3D shape or catalog provenance.']];$resultRoom=$roomId;
 }
 $data['capture_manifest']='Author photos persist in roomskins/objectskins. New rooms are partial photo patches with uncaptured directions black; object photos are single-view, not measured 3D.';$data['version']=(int)($data['version']??0)+1;$data['updated']=date(DATE_ATOM);
 $encoded=json_encode($data,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 $temporary=tempnam($root,'.manifest-next-');if ($temporary===false||file_put_contents($temporary,$encoded)===false){if($temporary!==false)@unlink($temporary);@unlink($path);fail(503,'Could not update the house map.');}
 @chmod($temporary,0644);
 if (!rename($temporary,$manifest)){@unlink($temporary);@unlink($path);fail(503,'Could not finish saving.');}
 echo json_encode(['ok'=>true,'kind'=>$kind,'id'=>$id,'room'=>$resultRoom]);
} catch(Throwable $error) { if(isset($temporary)&&$temporary!==false)@unlink($temporary);if(isset($path))@unlink($path);error_log('Guild house save error: '.$error->getMessage()); fail(503,'Save failed. Please retry.'); }
finally {flock($lock,LOCK_UN);fclose($lock);}
