<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/inc/graph.php';
header('Cache-Control: no-store');
$html=file_get_contents(__DIR__.'/index.html');
$brain=['url'=>'/puppet/jack/brain.php','timeoutMs'=>35000,'csrf'=>ttg_graph_csrf()];
$deepgram=($_GET['voice']??'deepgram')!=='off';
$inject=($deepgram?'<script src="assets/deepgram-voice.js?v=20261108a"></script>':'').'<script>window.PUPPET_CONFIG.brain='.json_encode($brain,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT).';window.PUPPET_CONFIG.deepgram='.($deepgram?'true':'false').';</script>'; 
echo preg_replace('/(<script src="assets\/puppet\.js[^\"]*"><\/script>)/',$inject.'$1',$html);

