<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/inc/graph.php';
require_once dirname(__DIR__, 3) . '/app/AI/JackTarot.php';
require_once dirname(__DIR__, 3) . '/app/AI/JackTarotDeck.php';

ttg_graph_boot_session();
$cards = JackTarotDeck::all();
$want = preg_replace('/[^a-z0-9-]/', '', (string) ($_GET['card'] ?? ''));
$open = $want !== '' ? JackTarotDeck::byId($want) : null;
$json = json_encode($cards, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    $json = '[]';
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>JACK / TAROT · FULL HOPPER<?= $open ? ' · ' . ttg_h((string) $open['compiled']) : '' ?> — timetravellersguild.com</title>
<meta name="theme-color" content="#d9cb9e">
<meta name="description" content="Jack’s compiled deck. Seventy-eight analogue computing archetypes. Generation 0. Not the Oracle.">
<link rel="stylesheet" href="/jack/tarot/css/tarot.css?v=g1">
<link rel="stylesheet" href="/jack/tarot/css/deck.css?v=g1">
</head>
<body class="deck-page">
<?php readfile(dirname(__DIR__) . '/svg/deck.svg'); ?>
<?= ttg_html_site_mark() ?>

<div id="app" class="deck-app">
  <header>
    <p class="guild">JACK · CLERK · GENERATION 0</p>
    <h1>FULL HOPPER</h1>
    <p class="rule">78 analogue computing archetypes · the deck is compiled · Jack is learning to see · not canon</p>
  </header>

  <p class="filters" id="filters">
    <button type="button" data-dept="ALL" class="on">ALL</button>
    <button type="button" data-dept="STANDING">STANDING</button>
    <button type="button" data-dept="PROGRAMME">PROGRAMME</button>
    <button type="button" data-dept="RECOLLECTION">RECOLLECTION</button>
    <button type="button" data-dept="CLASSIFICATION">CLASSIFICATION</button>
    <button type="button" data-dept="RECORD">RECORD</button>
  </p>
  <label class="sr" for="find">Find a slip</label>
  <input id="find" type="search" maxlength="80" placeholder="Find a compiled title, inherited name, or code…">
  <p class="count" id="count"><?= count($cards) ?> SLIPS</p>

  <div id="grid" class="deck-grid">
    <?php foreach ($cards as $card): ?>
      <a class="thumb" id="thumb-<?= ttg_h((string) $card['id']) ?>" href="<?= ttg_h((string) $card['href']) ?>" data-id="<?= ttg_h((string) $card['id']) ?>" data-dept="<?= ttg_h((string) $card['dept']) ?>" data-q="<?= ttg_h(strtolower($card['compiled'] . ' ' . $card['catalog'] . ' ' . $card['code'] . ' ' . $card['dept'])) ?>">
        <?= JackTarotDeck::faceMarkup($card) ?>
        <span class="thumb-code"><?= ttg_h((string) $card['roman']) ?></span>
        <span class="thumb-title"><?= ttg_h((string) $card['compiled']) ?></span>
      </a>
    <?php endforeach; ?>
  </div>
</div>

<dialog id="dossier" class="dossier"<?= $open ? ' open' : '' ?>>
  <div class="dossier-inner" id="dossierInner">
    <?php if ($open): ?>
      <?php $c = $open; ?>
      <p class="dossier-kicker"><?= ttg_h((string) $c['code']) ?></p>
      <div class="dossier-grid">
        <figure>
          <?= JackTarotDeck::faceMarkup($c) ?>
        </figure>
        <div class="dossier-copy">
          <p class="inherited"><?= ttg_h((string) $c['catalog']) ?> · <?= ttg_h((string) $c['class']) ?></p>
          <h2><?= ttg_h((string) $c['compiled']) ?></h2>
          <section>
            <h3>NUMEROLOGY</h3>
            <p><?= ttg_h((string) $c['numerology']['number']) ?> · <?= ttg_h((string) $c['numerology']['name']) ?> · reduces to <?= ttg_h((string) $c['numerology']['reduction']) ?> · <?= ttg_h((string) $c['numerology']['path']) ?></p>
            <p><?= ttg_h((string) $c['numerology']['note']) ?></p>
          </section>
          <section>
            <h3>SYMBOLS</h3>
            <ul><?php foreach ($c['symbols'] as $sym): ?><li><?= ttg_h((string) $sym) ?></li><?php endforeach; ?></ul>
          </section>
          <section>
            <h3>CORRESPONDENCE</h3>
            <dl><?php foreach ($c['correspondence'] as $k => $v): ?><div><dt><?= ttg_h((string) $k) ?></dt><dd><?= ttg_h((string) $v) ?></dd></div><?php endforeach; ?></dl>
          </section>
          <section>
            <h3>PSYCHOLOGICAL MESSAGE</h3>
            <p><?= ttg_h((string) $c['psychology']) ?></p>
          </section>
          <section>
            <h3>FACE-DOWN</h3>
            <p><?= ttg_h((string) $c['inverted']) ?></p>
          </section>
        </div>
      </div>
    <?php endif; ?>
  </div>
  <p class="dossier-nav">
    <button type="button" id="prev">PREVIOUS</button>
    <button type="button" id="closeDossier">CLOSE</button>
    <button type="button" id="next">NEXT</button>
  </p>
</dialog>

<nav class="doors" aria-label="Doors">
  <a class="door" href="/jack/tarot/"><b>DOOR</b> THE HOPPER</a>
  <a class="door" href="/jack/"><b>DOOR</b> DESK</a>
  <a class="door" href="/now"><b>DOOR</b> THE TREE</a>
</nav>

<script>window.TTG_DECK=<?= $json ?>;</script>
<script src="/jack/tarot/js/deck.js?v=g1"></script>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
