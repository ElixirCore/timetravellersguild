<script>
window.TTG_BOOT = {
  stationEndpoint: '/hub/api/stations.php',
  stationPageBase: '/hub/station/',
  hubBase: '/hub/'
};
</script>
<script src="<?= ttg_h(ttg_asset('js/hub.js')) ?>" defer></script>
<?= function_exists('ttg_html_visit_tracker') ? ttg_html_visit_tracker() : '' ?>
</body>
</html>
