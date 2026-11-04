<?php
declare(strict_types=1);
function ttg_config(): array { static $c; if($c===null){$c=require __DIR__.'/config.php'; date_default_timezone_set($c['timezone']);} return $c; }
function ttg_stations(): array { static $s; if($s!==null)return $s; $raw=@file_get_contents(ttg_config()['data_file']); $d=$raw===false?[]:json_decode($raw,true); return $s=is_array($d)?$d:[]; }
function ttg_station(string $slug): ?array { foreach(ttg_stations() as $s){if(($s['slug']??'')===$slug)return $s;} return null; }
function ttg_codex(): array {
    static $c;
    if ($c !== null) return $c;
    $path = dirname(__DIR__) . '/data/codex.json';
    $raw = @file_get_contents($path);
    $d = $raw === false ? [] : json_decode($raw, true);
    return $c = is_array($d) ? $d : ['faces' => [], 'avenues' => []];
}
function ttg_h(string $v): string { return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function ttg_asset(string $p): string { return '/hub/assets/' . ltrim($p, '/') . '?v=260910c'; }
