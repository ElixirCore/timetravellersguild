<?php
// Scripts menu: rebuilt from the /script and /scripts folders on every page load.

// What may be listed: skip hidden items, backups, and credential/secret-looking files.
$excluded = function(string $name): bool {
    if ($name === '' || $name[0] === '.') return true;
    if (preg_match('/(backup|secret|credential|password|passwd|token)/i', $name)) return true;
    if (preg_match('/\.(bak|key|pem|p12|pfx|env|log|sql|db|sqlite|sqlite3|htpasswd)$/i', $name)) return true;
    return false;
};
$hasIndex = function(string $dir): bool {
    foreach (['index.php', 'index.html', 'index.htm'] as $idx) {
        if (is_file($dir . '/' . $idx)) return true;
    }
    return false;
};
$label = function(string $name): string {
    return htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
};

// Render the folder-wise menu for one folder. $webPrefix is the URL path it is served under.
$renderMenu = function(string $root, string $webPrefix) use ($excluded, $hasIndex, $label): string {
    if (!is_dir($root)) {
        return '<p class="empty">This folder could not be found.</p>';
    }
    $link = function(string $name, string $prefix = '') use ($webPrefix, $label): string {
        $href = $webPrefix . '/' . $prefix . rawurlencode($name);
        return '<a href="' . $href . '">' . $label($name) . '</a>';
    };
    $dirs = [];
    $files = [];
    foreach ((@scandir($root) ?: []) as $name) {
        if ($excluded($name)) continue;
        // Index pages are reached by opening the folder itself; never list them as files.
        if (in_array(strtolower($name), ['index.php', 'index.html', 'index.htm'], true)) continue;
        $real = realpath($root . '/' . $name);
        if ($real === false || strpos($real, $root . '/') !== 0) continue; // stay inside the folder
        if (is_dir($real)) $dirs[] = $name; else $files[] = $name;
    }
    natcasesort($dirs);
    natcasesort($files);
    ob_start();
    if (!$dirs && !$files) {
        echo '<p class="empty">This folder is empty. Items appear here as they are added.</p>';
    } else {
        echo '<ul>';
        foreach ($dirs as $d) {
            // Link a folder only when it has its own index page; otherwise it is a plain heading.
            $folderHtml = $hasIndex($root . '/' . $d) ? $link($d) : $label($d);
            echo '<li class="folder">' . $folderHtml . '/</li>';
            $kidDirs = [];
            $kidFiles = [];
            foreach ((@scandir($root . '/' . $d) ?: []) as $s) {
                if ($excluded($s)) continue;
                if (in_array(strtolower($s), ['index.php', 'index.html', 'index.htm'], true)) continue;
                if (is_dir($root . '/' . $d . '/' . $s)) $kidDirs[] = $s; else $kidFiles[] = $s;
            }
            natcasesort($kidDirs);
            natcasesort($kidFiles);
            if ($kidDirs || $kidFiles) {
                echo '<li class="children"><ul>';
                foreach ($kidDirs as $s) {
                    $sub = $hasIndex($root . '/' . $d . '/' . $s) ? $link($s, rawurlencode($d) . '/') : $label($s);
                    echo '<li>' . $sub . '/</li>';
                }
                foreach ($kidFiles as $s) {
                    echo '<li>' . $link($s, rawurlencode($d) . '/') . '</li>';
                }
                echo '</ul></li>';
            }
        }
        foreach ($files as $f) echo '<li>' . $link($f) . '</li>';
        echo '</ul>';
    }
    return ob_get_clean();
};

$scriptRoot  = __DIR__;                          // /script  (this folder)
$scriptsRoot = realpath(dirname(__DIR__) . '/scripts'); // /scripts
$scriptMenu  = $renderMenu($scriptRoot, '/script');
$scriptsMenu = $scriptsRoot === false
    ? '<p class="empty">This folder could not be found.</p>'
    : $renderMenu($scriptsRoot, '/scripts');
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Time Travellers Guild – Scripts</title>
<style>
  :root { --bg:#f4f1ea; --paper:#fffdf8; --ink:#1a1a1a; --mute:#6b655a; --rule:#d9d3c4; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#141414; --paper:#1c1c1c; --ink:#e8e4da; --mute:#9a9486; --rule:#333; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:"Courier Prime","Courier New",Courier,monospace; font-size:16px; line-height:1.5; }
  main { max-width:44rem; margin:0 auto; background:var(--paper); padding:2.5rem 1.25rem 4rem; border-left:1px solid var(--rule); border-right:1px solid var(--rule); min-height:100vh; }
  @media (min-width:700px){ main{ padding:4rem 4.5rem 6rem; } }
  .title { text-align:center; margin:2rem 0 3rem; }
  .title h1 { font-size:1.5rem; letter-spacing:.12em; text-transform:uppercase; margin:0 0 .75rem; }
  .title p { margin:.25rem 0; color:var(--mute); }
  .tagline { font-style:italic; }
  footer { margin-top:4rem; color:var(--mute); font-size:.85rem; text-align:center; }
  .scripts-menu { border:1px solid var(--rule); padding:.75rem 1rem 1rem; margin:0 0 2.5rem; }
  .scripts-menu h2 { font-size:1rem; text-transform:uppercase; letter-spacing:.1em; margin:.25rem 0 .75rem; border-bottom:1px solid var(--rule); padding-bottom:.3rem; }
  .scripts-menu ul { list-style:none; margin:0; padding:0; }
  .scripts-menu li { margin:.15rem 0; }
  .scripts-menu .folder { font-weight:700; }
  .scripts-menu .children ul { margin-left:1.25rem; }
  .scripts-menu .children, .scripts-menu .children a { color:var(--mute); }
  .scripts-menu a { color:inherit; }
  .scripts-menu .empty { color:var(--mute); margin:.25rem 0; }
  .scripts-menu .auto { color:var(--mute); font-size:.8rem; margin:.75rem 0 0; }
</style>
</head>
<body>
<main>

<header class="title">
  <h1>The Time Travellers Guild</h1>
  <p class="tagline">A documentary that becomes a Time Machine while it is being made.</p>
  <p>Scripts</p>
</header>

<section class="scripts-menu">
  <h2>Script</h2>
  <?php echo $scriptMenu; ?>
</section>

<section class="scripts-menu">
  <h2>Scripts</h2>
  <?php echo $scriptsMenu; ?>
  <p class="auto">This menu updates itself from the /script and /scripts folders.</p>
</section>

<footer>timetravellersguild.com/script</footer>
</main>
</body>
</html>
