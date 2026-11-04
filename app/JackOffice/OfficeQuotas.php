<?php
declare(strict_types=1);

final class OfficeQuotas
{
    public int $toolCalls = 0;
    public int $folders = 0;
    public float $startedAt;

    public function __construct()
    {
        $this->startedAt = microtime(true);
    }

    public function checkTool(): ?string
    {
        if ($this->toolCalls >= OfficeConfig::MAX_TOOL_CALLS) return 'quota_tools';
        if ((microtime(true) - $this->startedAt) > 30) return 'quota_runtime';
        $this->toolCalls++;
        return null;
    }

    public function checkFolder(): ?string
    {
        if ($this->folders >= OfficeConfig::MAX_FOLDERS_PER_TURN) return 'quota_folders';
        $this->folders++;
        return null;
    }

    public static function rateOk(): bool
    {
        ttg_graph_boot_session();
        $hour = (int) floor(time() / 3600);
        $n = (int) ($_SESSION['ttg_office_n'] ?? 0);
        $window = (int) ($_SESSION['ttg_office_h'] ?? 0);
        if ($window !== $hour) {
            $_SESSION['ttg_office_n'] = 0;
            $_SESSION['ttg_office_h'] = $hour;
            $n = 0;
        }
        if ($n >= OfficeConfig::RATE_PER_HOUR) return false;
        $_SESSION['ttg_office_n'] = $n + 1;
        return true;
    }
}
