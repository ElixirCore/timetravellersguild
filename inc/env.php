<?php
declare(strict_types=1);

/**
 * Load OPENAI_* from the server environment or a private .env file.
 * Never send these values to HTML, JavaScript, logs, or the graph.
 */

function ttg_env_set(string $key, string $value): void {
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
    if (function_exists('putenv')) {
        @putenv($key . '=' . $value);
    }
}

function ttg_env(string $key, string $default = ''): string {
    ttg_env_boot();
    $v = getenv($key);
    if ($v === false || $v === '') {
        $v = $_ENV[$key] ?? $_SERVER[$key] ?? $default;
    }
    return is_string($v) ? $v : $default;
}

function ttg_env_file_candidates(): array {
    $root = dirname(__DIR__);
    $files = [];
    $explicit = getenv('TTG_ENV_FILE');
    if (is_string($explicit) && $explicit !== '') {
        $files[] = $explicit;
    }
    // Namecheap: /home/USER/ttg-private/.env (outside public_html)
    $home = getenv('HOME');
    if (is_string($home) && $home !== '') {
        $files[] = rtrim($home, '/') . '/ttg-private/.env';
    }
    $files[] = dirname($root, 2) . '/ttg-private/.env';
    $files[] = dirname($root) . '/ttg-private/.env';
    $files[] = $root . '/.env';
    return $files;
}

function ttg_env_parse_file(string $path): void {
    $raw = @file_get_contents($path);
    if ($raw === false) return;
    foreach (preg_split('/\R/', $raw) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v);
        if ($k === '') continue;
        if (
            (str_starts_with($v, '"') && str_ends_with($v, '"'))
            || (str_starts_with($v, "'") && str_ends_with($v, "'"))
        ) {
            $v = substr($v, 1, -1);
        }
        $existing = getenv($k);
        if (is_string($existing) && $existing !== '') continue;
        ttg_env_set($k, $v);
    }
}

function ttg_env_boot(): void {
    static $booted = false;
    if ($booted) return;
    $booted = true;
    foreach (ttg_env_file_candidates() as $path) {
        if (!is_string($path) || $path === '' || !is_file($path) || !is_readable($path)) {
            continue;
        }
        ttg_env_parse_file($path);
        break;
    }
}

function ttg_openai_configured(): bool {
    $key = ttg_env('OPENAI_API_KEY');
    return $key !== '' && !str_contains($key, 'YOUR_KEY');
}

function ttg_openai_model(): string {
    $model = ttg_env('OPENAI_MODEL', 'gpt-5.6');
    return $model !== '' ? $model : 'gpt-5.6';
}

function ttg_eleven_configured(): bool {
    $key = ttg_env('ELEVENLABS_API_KEY');
    $voice = ttg_eleven_voice_id();
    return $key !== '' && $voice !== '' && !str_contains($key, 'YOUR_KEY');
}

function ttg_eleven_voice_id(): string {
    $id = ttg_env('ELEVENLABS_VOICE_ID');
    if ($id === '' || !preg_match('/^[A-Za-z0-9_-]{10,64}$/', $id)) {
        return '';
    }
    return $id;
}
