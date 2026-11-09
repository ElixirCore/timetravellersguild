<?php
// Copy this file to config.php and put your ElevenLabs key in it
// (or copy the config.php you already use in /interface2 and keep its key).
// Server-side only: the browser never sees the key. config.php is denied by .htaccess.
define('EL_API_KEY', 'PUT-YOUR-ELEVENLABS-KEY-HERE');
define('DAILY_CAP', 60);        // sounds per UTC day
define('MUSIC_CAP', 12);        // music loops per UTC day (they cost far more than sounds)
define('MIN_INTERVAL', 3);      // seconds between sounds
define('SFX_CR_SEC', 40);       // credits per second of sound effect (for the counter only)
define('STORE_DIR', __DIR__.'/store');   // sounds are kept here (made on first use, closed to the web)
