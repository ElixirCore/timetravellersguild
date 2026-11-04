<?php
require_once __DIR__ . '/../people/inc/db.php';
return ttg_current_user() ? true : false;
