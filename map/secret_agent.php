<?php
require_once __DIR__ . '/../people/inc/db.php';
return [
    'OPENAI_API_KEY' => ttg_env('OPENAI_API_KEY'),
    'OPENAI_MODEL'   => 'gpt-4o',
];
