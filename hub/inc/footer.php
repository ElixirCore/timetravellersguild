<script>
window.TTG_BOOT = {
  stationEndpoint: '/hub/api/stations.php',
  stationPageBase: '/hub/station/',
  hubBase: '/hub/'
};
</script>
<script src="<?= ttg_h(ttg_asset('js/hub.js')) ?>" defer></script>
<?= function_exists('ttg_html_visit_tracker') ? ttg_html_visit_tracker() : '' ?>
<script src="/assets/ask-jack.js?v=1" defer></script>
</body>
</html>
