<?php
declare(strict_types=1);
require_once __DIR__.'/../inc/functions.php';
require_once dirname(__DIR__, 2).'/inc/network.php';
$slug=trim((string)($_GET['slug']??''),'/');
$station=ttg_station($slug);
if(!$station){
  http_response_code(404);
  $pageTitle='Station not found — The Time Travellers Guild';
  require __DIR__.'/../inc/header.php';
  echo ttg_network_bar('fixed');
  echo '<main class="station-page"><a class="station-back" href="/now">← tree</a> <a class="station-back" href="/hub/">← hub</a><h1>Station not found</h1></main>';
  require __DIR__.'/../inc/footer.php';
  exit;
}
$pageTitle=$station['title'].' — The Time Travellers Guild';
$canonical=ttg_config()['canonical_base'].'/station/'.rawurlencode($slug).'/';
require __DIR__.'/../inc/header.php';
echo ttg_network_bar('fixed');
?>
<main class="station-page">
  <a class="station-back" href="/now">← tree</a>
  <a class="station-back" href="/hub/">← hub</a>
  <div class="station-kicker"><?=ttg_h($station['kicker'])?></div>
  <h1><?=ttg_h($station['title'])?></h1>
  <p class="station-copy"><?=ttg_h($station['copy'])?></p>
  <blockquote><?=ttg_h($station['signal'])?></blockquote>
  <dl>
    <div><dt>coordinate</dt><dd><?=ttg_h($station['coord'])?></dd></div>
    <div><dt>access</dt><dd><?=ttg_h($station['access'])?></dd></div>
    <div><dt>status</dt><dd><?=ttg_h($station['status'])?></dd></div>
  </dl>
  <a class="station-external" href="<?=ttg_h($station['href'])?>">continue</a>
  <?= ttg_limbs($slug) ?>
</main>
<?php require __DIR__.'/../inc/footer.php'; ?>
