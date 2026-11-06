<?php
declare(strict_types=1);
/*
 * /film/ — The Film room, carrying the canon treatment as a work in progress.
 * The text lives in great-awakenings.md beside this file: edit that, not this page.
 * Keeps the room's own facts (kicker, coordinate, access, status, limbs) from ttg_room('film').
 */
require_once dirname(__DIR__) . '/inc/network.php';

$slug = 'film';
$room = ttg_room($slug) ?: [];
$source = __DIR__ . '/great-awakenings.md';
$md = is_file($source) ? (string) file_get_contents($source) : '';
$revised = is_file($source) ? gmdate('j F Y', (int) filemtime($source)) : '';

/* /film/?text — the treatment as plain UTF-8 text, for reading or copying. */
if (isset($_GET['text'])) {
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo $md;
    exit;
}

/** Inline marks: **bold**, *italic*, `code`. Escapes first, so the text can never inject markup. */
$inline = static function (string $s): string {
    $s = ttg_h($s);
    $s = preg_replace('/`([^`]+)`/', '<code>$1</code>', $s) ?? $s;
    $s = preg_replace('/\*\*(.+?)\*\*/u', '<strong>$1</strong>', $s) ?? $s;
    return preg_replace('/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/u', '<em>$1</em>', $s) ?? $s;
};

/* The treatment as blocks: one title, a subtitle line, scene headings, paragraphs. */
$title = 'Great Awakenings';
$subtitle = '';
$scenes = [];   // [['id' => ..., 'heading' => ..., 'blocks' => [html, ...]], ...]
foreach (preg_split('/\R{2,}/u', trim($md)) ?: [] as $block) {
    $block = trim($block);
    if ($block === '') continue;
    if (str_starts_with($block, '# ')) { $title = trim(substr($block, 2)); continue; }
    if (str_starts_with($block, '### ')) {
        $h = trim(substr($block, 4));
        $scenes[] = ['id' => trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($h)), '-'), 'heading' => $h, 'blocks' => []];
        continue;
    }
    $text = preg_replace('/\s*\R\s*/u', ' ', $block) ?? $block;
    if (!$scenes && $subtitle === '' && preg_match('/^\*[^*].*\*$/u', $text)) { $subtitle = trim($text, '*'); continue; }
    $class = preg_match('/^\*\*.+\*\*$/u', $text) ? 'beat' : (preg_match('/^\*[^*].*\*$/u', $text) ? 'coda' : '');
    $html = '<p' . ($class !== '' ? ' class="' . $class . '"' : '') . '>' . $inline($text) . '</p>';
    if (!$scenes) $scenes[] = ['id' => 'opening', 'heading' => '', 'blocks' => []];
    $scenes[array_key_last($scenes)]['blocks'][] = $html;
}

$copy = (string) ($room['copy'] ?? 'A feature-length temporal event assembled across live performance, dome projection, testimony and recovered records.');
$pageTitle = $title . ' · The Film — The Time Travellers Guild';
$description = 'Work in progress: ' . $title . ', the canon treatment for the Time Travellers Guild feature film. ' . $copy;
$related = [];
foreach (($room['links'] ?? []) as $linkSlug) {
    if ($linked = ttg_room((string) $linkSlug)) $related[] = $linked;
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title><?= ttg_h($pageTitle) ?></title>
<meta name="description" content="<?= ttg_h($description) ?>">
<meta name="theme-color" content="#070706">
<link rel="canonical" href="https://timetravellersguild.com/film/">
<?= ttg_og_head(['title' => $pageTitle, 'description' => $description, 'url' => 'https://timetravellersguild.com/film/']) ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Courier+Prime:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/network.css">
<style>
:root{
  --ink:#070706; --ink-2:#0e0d0b; --rule:#231f19;
  --brass:#c9a961; --brass-dim:#7d6838; --brass-faint:#3d3320; --brass-bright:#e4c583;
  --sage:#a8bfa8; --parch:#ded7c8; --parch-dim:#948d80; --white:#f4eede; --red:#d4644f;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--parch);font-family:"EB Garamond",Georgia,serif;font-size:18px;line-height:1.62}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
a{color:inherit}
main{max-width:42rem;margin:0 auto;padding:2.4rem 16px 4.5rem}
@media(min-width:640px){main{padding:2.4rem 6vw 4.5rem}}
.mono{font-family:"Courier Prime",monospace}
.kicker{font-family:"Courier Prime",monospace;font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:var(--brass);margin:0 0 .8rem}
.room-title{font-weight:400;font-size:clamp(2.4rem,8vw,4.4rem);line-height:.95;color:var(--white);margin:0 0 1.1rem}
.copy{font-size:1.12rem;max-width:36ch;margin:0 0 1.4rem}
blockquote.signal{margin:1.8rem 0;padding:0 0 0 1.1rem;border-left:2px solid var(--brass);font-style:italic;color:var(--parch-dim)}
dl{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:2rem 0}
dt{font-family:"Courier Prime",monospace;font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--brass-dim)}
dd{margin:.35rem 0 0;font-family:"Courier Prime",monospace;font-size:.78rem;color:var(--brass-bright)}

/* the treatment */
.script{margin:3rem 0 0;border-top:1px solid var(--rule);padding-top:2.2rem}
.wip{display:flex;flex-wrap:wrap;gap:.4rem .9rem;align-items:center;font-family:"Courier Prime",monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--parch-dim);margin:0 0 1.6rem}
.wip .stamp{color:var(--red);border:1px solid var(--red);padding:.3rem .55rem;letter-spacing:.2em}
.wip .canon{color:var(--brass-bright);border:1px solid var(--brass-dim);padding:.3rem .55rem;letter-spacing:.2em}
.script h2{font-weight:400;font-size:clamp(2rem,6.5vw,3.2rem);line-height:1;color:var(--white);margin:0 0 .4rem}
.script .sub{font-style:italic;color:var(--parch-dim);margin:0 0 2rem}
nav.scenes{margin:0 0 2.6rem}
nav.scenes ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.4rem}
nav.scenes a{display:inline-block;font-family:"Courier Prime",monospace;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;border:1px solid var(--brass-faint);color:var(--brass-bright);padding:.5rem .7rem;min-height:2.2rem}
nav.scenes a:hover,nav.scenes a:focus-visible{border-color:var(--brass);background:rgba(201,169,97,.08);outline:none}
nav.scenes span{color:var(--brass-dim);margin-right:.35rem}
.scene{margin:0 0 2.8rem;scroll-margin-top:3.5rem}
.scene h3{font-family:"Courier Prime",monospace;font-weight:400;font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;color:var(--brass);margin:0 0 1.1rem;display:flex;gap:.8rem;align-items:baseline}
.scene h3 .no{color:var(--brass-dim)}
.scene p{margin:0 0 1.05rem;max-width:60ch}
.scene p.beat{font-family:"Courier Prime",monospace;font-size:.86rem;letter-spacing:.08em;color:var(--white);border-left:2px solid var(--red);padding:.15rem 0 .15rem .9rem;margin:1.5rem 0}
.scene p.beat strong{font-weight:400}
.scene p.coda{font-size:1.3rem;color:var(--white);margin-top:2rem}
.scene code{font-family:"Courier Prime",monospace;font-size:.82em;letter-spacing:.06em;color:var(--sage);border:1px solid #2c3a2c;padding:.02rem .3rem}
.scene strong{font-weight:600;color:var(--white)}
.end{font-family:"Courier Prime",monospace;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--parch-dim);border-top:1px solid var(--rule);padding-top:1.2rem;display:flex;flex-wrap:wrap;gap:.4rem 1rem;justify-content:space-between}
.end a{color:var(--brass-bright)}

.actions{display:flex;flex-wrap:wrap;gap:.6rem;margin:1.8rem 0 0}
.actions a{display:inline-block;font-family:"Courier Prime",monospace;font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border:1px solid var(--brass-faint);color:var(--brass-bright);padding:.5rem .85rem}
.actions a:hover{border-color:var(--brass);background:rgba(201,169,97,.08)}
.related{margin:2.6rem 0 0}
.related h2{font-weight:400;font-size:.78rem;font-family:"Courier Prime",monospace;letter-spacing:.14em;color:var(--brass-dim);margin:0 0 .8rem}
.related ul{list-style:none;margin:0;padding:0;display:grid;gap:.4rem}
.related a{display:flex;justify-content:space-between;gap:1rem;border:1px solid var(--rule);padding:.7rem .85rem;text-decoration:none}
.related a:hover{border-color:var(--brass-dim)}
.related .n{color:var(--white)}
.related .p{font-family:"Courier Prime",monospace;font-size:.62rem;color:var(--brass-dim)}
@media(max-width:640px){dl{grid-template-columns:1fr}}
@media print{body{background:#fff;color:#000}.wip,nav.scenes,.actions,.related{display:none}.scene p.beat{border-color:#000}}
</style>
</head>
<body>
<?= ttg_network_bar() ?>
<main>
  <p class="kicker"><?= ttg_h((string) ($room['kicker'] ?? 'film')) ?></p>
  <h1 class="room-title"><?= ttg_h((string) ($room['title'] ?? 'The Film')) ?></h1>
  <p class="copy"><?= ttg_h($copy) ?></p>
  <?php if (!empty($room['signal'])): ?>
    <blockquote class="signal"><?= ttg_h((string) $room['signal']) ?></blockquote>
  <?php endif; ?>
  <dl>
    <div><dt>coordinate</dt><dd><?= ttg_h((string) ($room['coord'] ?? 'F-2033')) ?></dd></div>
    <div><dt>access</dt><dd><?= ttg_h((string) ($room['access'] ?? 'screening')) ?></dd></div>
    <div><dt>status</dt><dd><?= ttg_h((string) ($room['status'] ?? 'forming')) ?></dd></div>
  </dl>

  <?php if ($scenes): ?>
  <article class="script" aria-labelledby="treatment-title">
    <p class="wip"><span class="stamp">Work in progress</span><span class="canon">Canon</span><?php if ($revised !== ''): ?><span>Draft of <?= ttg_h($revised) ?></span><?php endif; ?></p>
    <h2 id="treatment-title"><?= ttg_h($title) ?></h2>
    <?php if ($subtitle !== ''): ?><p class="sub"><?= ttg_h($subtitle) ?></p><?php endif; ?>

    <nav class="scenes" aria-label="Scenes">
      <ol>
        <?php foreach ($scenes as $i => $sc): if ($sc['heading'] === '') continue; ?>
          <li><a href="#<?= ttg_h($sc['id']) ?>"><span><?= $i + 1 ?></span><?= ttg_h($sc['heading']) ?></a></li>
        <?php endforeach; ?>
      </ol>
    </nav>

    <?php foreach ($scenes as $i => $sc): ?>
      <section class="scene" id="<?= ttg_h($sc['id']) ?>">
        <?php if ($sc['heading'] !== ''): ?><h3><span class="no"><?= $i + 1 ?></span><?= ttg_h($sc['heading']) ?></h3><?php endif; ?>
        <?= implode("\n        ", $sc['blocks']) ?>
      </section>
    <?php endforeach; ?>

    <p class="end"><span>End of treatment · subject to revision</span><a href="/film/?text">plain text</a></p>
  </article>
  <?php endif; ?>

  <div class="actions">
    <a href="/now">← the tree</a>
    <a href="/hub/">hub</a>
    <a href="/jack/mind/">Jack's mind</a>
    <a href="/n/department/">the Department</a>
  </div>
  <?php if ($related): ?>
  <section class="related">
    <h2>Limb</h2>
    <ul>
      <?php foreach ($related as $linked): ?>
        <li>
          <a href="<?= ttg_h((string) $linked['href']) ?>">
            <span class="n"><?= ttg_h((string) $linked['title']) ?></span>
            <span class="p">/<?= ttg_h((string) $linked['slug']) ?>/</span>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  </section>
  <?php endif; ?>
  <?= ttg_limbs($slug) ?>
</main>
<?= ttg_html_visit_tracker() ?>
</body>
</html>
