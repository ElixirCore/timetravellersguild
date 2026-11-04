<?php
declare(strict_types=1);
$lang = $GLOBALS['DET_LANG'] ?? 'en';
?>
</main>

<footer class="foot">
  <div class="wrap">
    <ul class="foot-nav">
      <li><a href="<?= det_h(det_url('about')) ?>"><?= det_e('nav.about') ?></a></li>
      <li><a href="<?= det_h(det_url('publications')) ?>"><?= det_e('nav.publications') ?></a></li>
      <li><a href="<?= det_h(det_url('careers')) ?>"><?= det_e('nav.careers') ?></a></li>
      <li><a href="<?= det_h(det_url('forms')) ?>"><?= det_e('nav.forms') ?></a></li>
      <li><a href="<?= det_h(det_url('maps')) ?>"><?= det_e('nav.offices') ?></a></li>
      <li><a href="<?= det_h(det_url('about/foi.php')) ?>"><?= det_e('nav.foi') ?></a></li>
      <li><a href="<?= det_h(det_url('contact')) ?>"><?= det_e('nav.contact') ?></a></li>
      <li><a href="<?= det_h(det_url('cookies')) ?>"><?= det_e('nav.cookies') ?></a></li>
      <li><a href="<?= det_h(det_url('accessibility')) ?>"><?= det_e('nav.access') ?></a></li>
      <li><a href="<?= det_h(det_url('privacy')) ?>"><?= det_e('nav.privacy') ?></a></li>
    </ul>
    <p class="ogl"><?= det_h(det_t([
      'en' => '© Crown copyright. Material published by the Department of Excess Time may be reused under the Open Government Licence v3.0, except where otherwise stated. Established 1951. Serving Wales and the United Kingdom.',
      'cy' => '© Hawlfraint y Goron. Gellir ailddefnyddio deunydd a gyhoeddwyd gan Adran Amser Dros Ben o dan y Drwydded Llywodraeth Agored v3.0, oni nodir fel arall. Sefydlwyd 1951. Yn gwasanaethu Cymru a’r Deyrnas Unedig.',
    ])) ?></p>
  </div>
</footer>
<div class="foot-ink">
  <div class="wrap">
    <span><?= det_e('wg') ?> · <?= det_e('dept.short') ?></span>
    <a class="ttg13" id="ttg13" href="#ttg-13" aria-label="Catalogue mark TTG-13">TTG-13</a>
  </div>
</div>
<script src="<?= det_h(DET_WEB) ?>/assets/department.js"></script>
<?= function_exists('ttg_html_visit_tracker') ? ttg_html_visit_tracker() : '' ?>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
