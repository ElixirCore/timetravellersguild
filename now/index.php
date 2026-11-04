<?php
declare(strict_types=1);

/** Boot: same tree engine as /now/tree, transient incomplete state. */
define('TTG_NOW_MODE', 'boot');
require dirname(__DIR__) . '/index.php';
