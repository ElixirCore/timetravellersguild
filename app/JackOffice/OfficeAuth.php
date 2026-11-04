<?php
declare(strict_types=1);

final class OfficeAuth
{
    public static function viewer(): array
    {
        return ttg_graph_viewer();
    }

    public static function isKeeper(array $viewer): bool
    {
        self::bootPolicy();
        if (class_exists('JackPolicy')) {
            return JackPolicy::isKeeper($viewer);
        }
        // Fallback if policy failed to load: exact slug allowlist only.
        if (empty($viewer['known'])) return false;
        $slug = strtolower(trim((string) ($viewer['slug'] ?? '')));
        if ($slug === '') return false;
        $allow = ttg_env('JACK_KEEPER_SLUGS', 'tobywhy');
        foreach (preg_split('/[,\s]+/', strtolower($allow)) ?: [] as $ok) {
            $ok = trim((string) $ok);
            if ($ok !== '' && $slug === $ok) return true;
        }
        return false;
    }

    public static function mayUseOffice(array $viewer): bool
    {
        return self::isKeeper($viewer);
    }

    public static function requireOffice(): array
    {
        $viewer = self::viewer();
        if (!self::mayUseOffice($viewer)) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=utf-8');
            echo "The office is closed to this visitor.\n";
            exit;
        }
        return $viewer;
    }

    private static function bootPolicy(): void
    {
        if (class_exists('JackPolicy', false)) return;
        $path = dirname(__DIR__) . '/AI/JackPolicy.php';
        if (is_file($path)) require_once $path;
    }
}
