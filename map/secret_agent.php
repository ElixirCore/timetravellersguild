<?php
require_once __DIR__ . '/../inc/env.php';
return [
    'OPENAI_API_KEY' => ttg_env('OPENAI_API_KEY'),
    'OPENAI_MODEL'   => ttg_openai_model(),
];
