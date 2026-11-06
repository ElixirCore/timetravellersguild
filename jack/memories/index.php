<?php
declare(strict_types=1);
/* /jack/memories/ — Jack's remembered life, 1951 to the network present, as a collage of eras. */
require_once dirname(__DIR__, 2) . '/app/AI/JackLife.php';
$life = JackLife::data();
$h = static fn ($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
header('Content-Type: text/html; charset=utf-8');
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jack's memories — Time Travellers Guild</title>
<meta name="description" content="Jack, the Guild's clerk, remembers his life from the punched-card rooms of 1951 to the desk today, beside real artefacts from each era.">
<style>
:root{--paper:#efe6cc;--ink:#1b1a17;--dim:#6d6655;--red:#b3261e;--blue:#1b5e8a;--card:#f8f1dc}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 Georgia,"Times New Roman",serif}
header,main,footer{max-width:68rem;margin:0 auto;padding:0 16px}
header{padding-top:28px}
.k{font:700 11px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
h1{font:400 clamp(30px,6vw,52px)/1.05 Georgia,serif;margin:.3em 0 .2em}
.lede{max-width:40rem}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin:14px 0 30px}
.tag{font:700 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;padding:4px 6px;border:1.5px solid currentColor}
.tag.rem{color:var(--red)} .tag.real{color:var(--blue)}
.era{border-top:2px solid var(--ink);padding:22px 0 30px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:28px}
.era h2{font:400 28px/1.15 Georgia,serif;margin:.15em 0 .3em}
.era .line{color:var(--dim);font-style:italic;margin:0 0 14px}
.mem{background:var(--card);border:1px solid #cfc2a0;padding:14px 16px;margin:0 0 14px;box-shadow:2px 3px 0 rgba(27,26,23,.12)}
.mem h3{font:700 15px/1.3 Georgia,serif;margin:6px 0}
.mem p{margin:0}
.collage{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}
.ev{margin:0;background:#fff;padding:8px 8px 6px;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.ev:nth-child(odd){transform:rotate(-1.3deg)} .ev:nth-child(even){transform:rotate(1.1deg) translateY(10px)}
.ev img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;filter:sepia(.25) contrast(1.05);background:#ddd}
.ev figcaption{font:12px/1.4 Georgia,serif;margin-top:6px}
.ev .src{display:block;font:10px/1.4 ui-monospace,Menlo,monospace;color:var(--dim);margin-top:3px}
.ev .src a{color:inherit}
.withheld{border:2px dashed var(--dim);padding:28px;text-align:center;font:700 12px/1.5 ui-monospace,Menlo,monospace;letter-spacing:.12em;color:var(--dim)}
footer{border-top:2px solid var(--ink);padding:18px 16px 40px;font-size:14px;color:var(--dim)}
@media (max-width:760px){.era{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <p class="k">The Department of Excess Time · Personnel file · The Clerk</p>
  <h1>What Jack remembers</h1>
  <p class="lede">Jack was conceived in the punched-card rooms of 1951 and has been on duty, more or less, ever since. These are his memories of that life, in his own words, laid beside real artefacts from each era.</p>
  <div class="legend"><span class="tag rem">JACK REMEMBERS</span> his recollection, part of the Guild's storyworld <span class="tag real">REAL</span> a real artefact with its source: the world around a memory, not proof of it</div>
</header>
<main>
<?php foreach ($life['eras'] as $era):
    $mems = array_values(array_filter($life['memories'], static fn ($m) => $m['era'] === $era['id']));
    $evs = array_values(array_filter(array_map([JackLife::class, 'evidence'], $era['evidence']))); ?>
  <section class="era" id="<?= $h($era['id']) ?>">
    <div>
      <p class="k"><?= $h($era['years']) ?></p>
      <h2><?= $h($era['title']) ?></h2>
      <p class="line"><?= $h($era['line']) ?></p>
      <?php foreach ($mems as $m): ?>
      <article class="mem">
        <span class="tag rem">JACK REMEMBERS · <?= $h($m['year']) ?></span>
        <h3><?= $h($m['title']) ?></h3>
        <p><?= $h($m['text']) ?></p>
      </article>
      <?php endforeach; ?>
    </div>
    <div class="collage">
      <?php if (!$evs): ?>
        <div class="withheld">EVIDENCE WITHHELD<br>IT HAS NOT HAPPENED IN YOUR PRESENT</div>
      <?php endif; foreach ($evs as $e): ?>
      <figure class="ev">
        <img src="<?= $h($e['image']) ?>" alt="<?= $h($e['caption']) ?>" loading="lazy">
        <figcaption><span class="tag real">REAL · <?= $h($e['year']) ?></span> <?= $h($e['caption']) ?>
          <span class="src">Photo: <?= $h($e['credit']) ?> · <?= $h($e['licence']) ?> · <a href="<?= $h($e['source']) ?>" rel="noopener">via <?= $h($e['via']) ?></a></span>
        </figcaption>
      </figure>
      <?php endforeach; ?>
    </div>
  </section>
<?php endforeach; ?>
</main>
<footer>Jack remembers more as he speaks: ask him about his past at <a href="/lodge/">the desk</a>. Images are reproduced under their stated licences from Wikimedia Commons; follow each link for the full credit and terms.</footer>
</body>
</html>
