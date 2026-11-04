<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/inc/boot.php';

$cy = ($GLOBALS['DET_LANG'] ?? 'en') === 'cy';
$pageTitle = 'DET-CODEX-001 ' . ($cy ? 'Codex Sefydlu' : 'Founding Codex') . ' — ' . det_s('dept');
$pageDescription = det_s('codex.kicker') . ' — ' . det_s('codex.h1') . '. ' . det_s('codex.ed') . '. ' . det_s('codex.int') . '.';
$crumbs = [
    ['label' => det_s('nav.publications'), 'href' => det_url('publications')],
    ['label' => 'DET-CODEX-001'],
];
$bodyClass = 'codex-body';
$extraHead = true;
$extraCss = [DET_WEB . '/assets/codex.css'];
require dirname(__DIR__, 2) . '/inc/header.php';
?>
<div class="codex-wrap">
<article class="codex-sheet">
<?php if ($cy): ?>
  <header class="codex-id">
    <p>Adran Amser Dros Ben</p>
    <p>Argraffiad Codex 1.0</p>
    <p>Cyhoeddiad mewnol</p>
    <p class="mark">DET-CODEX-001</p>
  </header>

  <p class="codex-kicker">Pennod 0</p>
  <h1>OFFERYN SEFYDLU</h1>

  <section class="codex-sec" id="s-0-0">
    <h2>0.0 DIBEN</h2>
    <p>Mae Adran Amser Dros Ben (AADB) yn bodoli i nodi, cadw a gweinyddu’n gyfrifol capasiti amserol dros ben sy’n codi o fewn y Deyrnas Unedig ac awdurdodaethau cysylltiedig.</p>
    <p>At ddibenion y Codex hwn, deellir Amser Dros Ben fel hyd mesuradwy sydd wedi datgysylltu oddi wrth ei swyddogaeth gymdeithasol, economaidd neu bersonol ddisgwyliedig.</p>
    <p>Mae’r Adran yn cydnabod nad uned fesur yn unig yw amser, ond adnodd cyhoeddus y mae teuluoedd, cymunedau, sefydliadau a gwareiddiad ei hun yn dibynnu arno.</p>
    <p>Mae colli, cronni neu ddadleoli amser o’r fath yn fater o ddiddordeb cyhoeddus.</p>
  </section>

  <section class="codex-sec" id="s-0-1">
    <h2>0.1 STATWS</h2>
    <p>Mae Adran Amser Dros Ben yn adran weithredol sy’n gweithredu o dan awdurdod gweinidogol.</p>
    <p>Mae ei chyfrifoldebau yn ymestyn ar draws Cymru, Lloegr, yr Alban a Gogledd Iwerddon, gyda chytundebau ychwanegol yn llywodraethu cydweithrediad amserol trawsffiniol lle y bo’n briodol.</p>
    <p>Mae’r Adran yn gweithio ochr yn ochr ag awdurdodau lleol, gwasanaethau brys, sefydliadau ymchwil a chyrff cyhoeddus eraill y gall eu dyletswyddau groesi â gweinyddu amserol.</p>
    <p>Ni ddylid dehongli dim yn y cyhoeddiad hwn fel pe bai’n rhoi awdurdod dros basio cyfreithlon amser ei hun.</p>
    <div class="codex-axiom">
      <p>Mae’r Adran yn gweinyddu canlyniadau.</p>
      <p>Nid yw’n creu achosion.</p>
    </div>
  </section>

  <section class="codex-sec" id="s-0-2">
    <h2>0.2 EGWYDDOR SEFYDLU</h2>
    <p>Mae gwareiddiad modern yn cymryd yn ganiataol fod gan bob awr gyrchfan fwriadedig.</p>
    <div class="codex-stack">
      <p>Gellir neilltuo awr i waith.</p>
      <p>I ddysgu.</p>
      <p>I ofalu.</p>
      <p>I ddathlu.</p>
      <p>I alaru.</p>
      <p>I orffwys.</p>
    </div>
    <p>Weithiau, fodd bynnag, mae oriau’n methu â chyrraedd lle’r oedd disgwyl iddynt.</p>
    <p>Mae prynhawniau cyfan yn diflannu o gof torfol.</p>
    <p>Mae sgyrsiau’n gorffen cyn iddynt ddechrau.</p>
    <p>Mae prosiectau’n llyncu blynyddoedd heb adael olrhain cyfatebol.</p>
    <p>Mae cymunedau’n adrodd cyfnodau sy’n teimlo’n anesboniadwy absennol.</p>
    <p>Mae unigolion yn disgrifio diwrnodau sy’n ymddangos wedi digwydd ond na ellir eu hail-lunio’n ddigonol.</p>
    <p>Am genedlaethau, triniwyd y digwyddiadau hyn fel cyd-ddigwyddiad.</p>
    <p>Sefydlwyd yr Adran ar sail yr arsylwad nad oedd cyd-ddigwyddiad yn ddigon o esboniad ynddo’i hun.</p>
  </section>

  <section class="codex-sec" id="s-0-3">
    <h2>0.3 MANDAD</h2>
    <p>Mae’r Adran felly yn derbyn pedair rhwymedigaeth barhaol.</p>
    <div class="codex-duty">
      <p><strong>Arsylwi.</strong> Cadw gwylfa barhaus dros ddangosyddion anghydbwysedd amserol.</p>
      <p><strong>Cofnodi.</strong> Cadw cofnodion cywir a diduedd o bob Digwyddiad Amser Dros Ben cydnabyddedig.</p>
      <p><strong>Diogelu.</strong> Lleihau niwed sy’n deillio o ddadleoli amserol lle y mae’n rhesymol ymarferol.</p>
      <p><strong>Adfer.</strong> Cynorthwyo dychweliad cyfreithlon parhad amserol adenilladwy i unigolion, cymunedau a sefydliadau cyhoeddus.</p>
    </div>
  </section>

  <section class="codex-sec" id="s-0-4">
    <h2>0.4 CWMPAS</h2>
    <div class="codex-stack">
      <p>Nid yw’r Adran yn rheoleiddio clociau.</p>
      <p>Nid yw’n rheoleiddio calendrau.</p>
      <p>Nid yw’n rheoleiddio cof.</p>
      <p>Nid yw’n rheoleiddio hanes.</p>
    </div>
    <p>Mae ei phryder yn dechrau dim ond pan fydd parhad mesuradwy yn gwyro oddi wrth ddisgwyliad cyffredin a bod y gwyriad hwnnw yn cynhyrchu effeithiau dangosadwy ar fywyd cyhoeddus.</p>
  </section>

  <section class="codex-sec" id="s-0-5">
    <h2>0.5 MAXIM ARWEINIOL</h2>
    <p>Ni chaiff amser neb ei ystyried yn ormodol oherwydd diffyg cynhyrchiant economaidd yn unig.</p>
    <div class="codex-stack">
      <p>Mae oriau a neilltuir i gyfeillgarwch yn parhau’n oriau.</p>
      <p>Mae oriau a neilltuir i alaru yn parhau’n oriau.</p>
      <p>Mae oriau a neilltuir i grwydro yn parhau’n oriau.</p>
      <p>Mae oriau a neilltuir i ryfeddod yn parhau’n oriau.</p>
    </div>
    <p>Ni chaiff gwerth amser ei bennu gan fasnach yn unig.</p>
  </section>

  <section class="codex-sec" id="s-0-6">
    <h2>0.6 SICRWYDD CYHOEDDUS</h2>
    <p>Ni ddylid dehongli bodolaeth yr Adran hon fel tystiolaeth bod y cyhoedd ar hyn o bryd mewn perygl anarferol.</p>
    <p>Ni fydd mwyafrif llethol y dinasyddion byth yn dod ar draws Digwyddiad Amser Dros Ben yn wybodus.</p>
    <p>Pan fydd digwyddiadau o’r fath yn digwydd maent, yn y rhan fwyaf o achosion, yn lleol, yn dros dro ac yn cael eu datrys heb ganlyniad parhaol.</p>
    <p>Anogir aelodau’r cyhoedd i barhau â’u materion arferol.</p>
  </section>

  <section class="codex-sec" id="s-0-7">
    <h2>0.7 NODYN I’R DARLLENYDD</h2>
    <p>Paratowyd y Codex hwn ar gyfer swyddogion yr Adran, sefydliadau partner ac ymchwilwyr awdurdodedig.</p>
    <p>Bydd rhai termau’n ymddangos yn anghyfarwydd ar y darlleniad cyntaf.</p>
    <p>Cynghorir darllenwyr i beidio â cheisio dealltwriaeth gyflawn ymlaen llaw.</p>
    <p>Mae diffiniadau’n ennill manwl gywirdeb drwy gyfarfyddiadau dro ar ôl tro.</p>
    <p class="codex-close">Ewch ymlaen i Bennod 1.</p>
  </section>
<?php else: ?>
  <header class="codex-id">
    <p>Department of Excess Time</p>
    <p>Codex Edition 1.0</p>
    <p>Internal Publication</p>
    <p class="mark">DET-CODEX-001</p>
  </header>

  <p class="codex-kicker">Chapter 0</p>
  <h1>FOUNDING INSTRUMENT</h1>

  <section class="codex-sec" id="s-0-0">
    <h2>0.0 PURPOSE</h2>
    <p>The Department of Excess Time (DET) exists to identify, preserve and responsibly administer excess temporal capacity arising within the United Kingdom and associated jurisdictions.</p>
    <p>For the purposes of this Codex, Excess Time shall be understood as measurable duration that has become detached from its anticipated social, economic or personal function.</p>
    <p>The Department recognises that time is not merely a unit of measurement but a public resource upon which families, communities, institutions and civilisation itself depend.</p>
    <p>The loss, accumulation or displacement of such time constitutes a matter of public interest.</p>
  </section>

  <section class="codex-sec" id="s-0-1">
    <h2>0.1 STATUS</h2>
    <p>The Department of Excess Time is an executive department operating under ministerial authority.</p>
    <p>Its responsibilities extend across England, Wales, Scotland and Northern Ireland, with additional agreements governing cross-border temporal cooperation where appropriate.</p>
    <p>The Department works alongside local authorities, emergency services, research institutions and other public bodies whose duties may intersect with temporal administration.</p>
    <p>Nothing within this publication should be interpreted as conferring authority over the lawful passage of time itself.</p>
    <div class="codex-axiom">
      <p>The Department administers consequences.</p>
      <p>It does not create causes.</p>
    </div>
  </section>

  <section class="codex-sec" id="s-0-2">
    <h2>0.2 FOUNDING PRINCIPLE</h2>
    <p>Modern civilisation assumes that every hour possesses an intended destination.</p>
    <div class="codex-stack">
      <p>An hour may be devoted to work.</p>
      <p>To learning.</p>
      <p>To care.</p>
      <p>To celebration.</p>
      <p>To grief.</p>
      <p>To rest.</p>
    </div>
    <p>Occasionally, however, hours fail to arrive where they were expected.</p>
    <p>Entire afternoons disappear from collective memory.</p>
    <p>Conversations conclude before they have begun.</p>
    <p>Projects consume years while leaving no corresponding trace.</p>
    <p>Communities report periods that feel inexplicably absent.</p>
    <p>Individuals describe days that appear to have occurred but cannot be adequately reconstructed.</p>
    <p>For generations these incidents were regarded as coincidence.</p>
    <p>The Department was established upon the observation that coincidence alone proved an insufficient explanation.</p>
  </section>

  <section class="codex-sec" id="s-0-3">
    <h2>0.3 MANDATE</h2>
    <p>The Department therefore accepts four permanent obligations.</p>
    <div class="codex-duty">
      <p><strong>Observe.</strong> To maintain continuous watch over indicators of temporal imbalance.</p>
      <p><strong>Record.</strong> To preserve accurate and impartial records of all recognised Excess Time Events.</p>
      <p><strong>Protect.</strong> To reduce harm arising from temporal displacement wherever reasonably practicable.</p>
      <p><strong>Restore.</strong> To assist the lawful return of recoverable temporal continuity to individuals, communities and public institutions.</p>
    </div>
  </section>

  <section class="codex-sec" id="s-0-4">
    <h2>0.4 SCOPE</h2>
    <div class="codex-stack">
      <p>The Department does not regulate clocks.</p>
      <p>It does not regulate calendars.</p>
      <p>It does not regulate memory.</p>
      <p>It does not regulate history.</p>
    </div>
    <p>Its concern begins only when measurable continuity diverges from ordinary expectation and that divergence produces demonstrable effects upon public life.</p>
  </section>

  <section class="codex-sec" id="s-0-5">
    <h2>0.5 GUIDING MAXIM</h2>
    <p>No person’s time shall be deemed surplus solely by reason of economic unproductivity.</p>
    <div class="codex-stack">
      <p>Hours devoted to friendship remain hours.</p>
      <p>Hours devoted to mourning remain hours.</p>
      <p>Hours devoted to wandering remain hours.</p>
      <p>Hours devoted to wonder remain hours.</p>
    </div>
    <p>The value of time shall not be determined exclusively by commerce.</p>
  </section>

  <section class="codex-sec" id="s-0-6">
    <h2>0.6 PUBLIC ASSURANCE</h2>
    <p>The existence of this Department should not be interpreted as evidence that the public is presently at unusual risk.</p>
    <p>The overwhelming majority of citizens will never knowingly encounter an Excess Time Event.</p>
    <p>Where such events do occur they are, in most cases, localised, temporary and resolved without lasting consequence.</p>
    <p>Members of the public are encouraged to continue with their ordinary affairs.</p>
  </section>

  <section class="codex-sec" id="s-0-7">
    <h2>0.7 NOTE TO THE READER</h2>
    <p>This Codex has been prepared for officers of the Department, partner organisations and authorised researchers.</p>
    <p>Some terminology will appear unfamiliar upon first reading.</p>
    <p>Readers are advised not to seek complete understanding in advance.</p>
    <p>Definitions acquire precision through repeated encounter.</p>
    <p class="codex-close">Proceed to Chapter 1.</p>
  </section>
<?php endif; ?>
</article>
<p class="codex-after"><a href="<?= det_h(det_url('publications')) ?>"><?= det_e('pub.return') ?></a> · <span class="ttg13" data-ttg13>TTG-13</span></p>
</div>
<?php require dirname(__DIR__, 2) . '/inc/footer.php'; ?>
