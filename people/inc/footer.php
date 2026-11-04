<nav id="dock" aria-label="Guild">
  <a href="/field/">FIELD</a>
  <a href="/now">TREE</a>
  <a href="/join/">JOIN</a>
  <a href="/jack">JACK</a>
  <a href="<?= ttg_h(ttg_base()) ?>"<?= preg_match('#^/people/?$#', (string) (parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '')) ? ' aria-current="page"' : '' ?>>PEOPLE</a>
  <?php
    $dockUser = ttg_current_user();
    if ($dockUser) {
        echo '<a href="/navigator">NAVIGATOR</a>';
    }
    echo ttg_you_dock([
      'href' => $dockUser ? ttg_base('profile/') : ttg_base('auth/'),
      'avatar' => is_array($dockUser) ? ($dockUser['avatar'] ?? []) : [],
    ]);
  ?>
</nav>
<footer class="site-footer">
  <span>Station XIII · Punch register · not canon</span>
  <span><a href="/jack/tarot/">punchcard tarot</a> · <a href="/join/">join</a></span>
</footer>
<?= function_exists('ttg_limbs') ? ttg_limbs('people', 'paper') : '' ?>
<script src="<?= ttg_h(ttg_base('assets/js/people.js')) ?>?v=punch3" defer></script>
<?= function_exists('ttg_html_visit_tracker') ? ttg_html_visit_tracker() : '' ?>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
