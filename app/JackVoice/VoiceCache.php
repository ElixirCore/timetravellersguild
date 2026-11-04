<?php
declare(strict_types=1);

/**
 * MPEG cache. Filenames are hashes. Nothing executable is stored.
 */
final class VoiceCache
{
    private string $root;

    public function __construct(?string $root = null)
    {
        $this->root = $root ?? VoiceConfig::root();
    }

    public function root(): string
    {
        return $this->root;
    }

    public function boot(): void
    {
        if (!is_dir($this->root)) {
            if (!@mkdir($this->root, 0770, true) && !is_dir($this->root)) {
                throw new RuntimeException('voice_root_missing');
            }
        }
        $deny = $this->root . '/.htaccess';
        if (!is_file($deny)) {
            @file_put_contents($deny, "Require all denied\n");
        }
    }

    public function key(string $preparedText): string
    {
        $material = VoiceConfig::voiceId()
            . '|' . VoiceConfig::model()
            . '|' . VoiceConfig::settingsFingerprint()
            . '|' . $preparedText;
        return hash('sha256', $material);
    }

    public function get(string $hash): ?string
    {
        $this->boot();
        $path = $this->safeFile($hash);
        if (!is_file($path) || is_link($path)) {
            return null;
        }
        $bytes = @file_get_contents($path);
        if (!is_string($bytes) || $bytes === '') {
            return null;
        }
        if (strlen($bytes) > VoiceConfig::MAX_AUDIO_BYTES) {
            return null;
        }
        @touch($path);
        return $bytes;
    }

    public function put(string $hash, string $audio): void
    {
        if ($audio === '' || strlen($audio) > VoiceConfig::MAX_AUDIO_BYTES) {
            throw new InvalidArgumentException('audio_rejected');
        }
        $this->boot();
        $path = $this->safeFile($hash);
        $ok = @file_put_contents($path, $audio, LOCK_EX);
        if ($ok === false) {
            throw new RuntimeException('voice_cache_write');
        }
        @chmod($path, 0660);
        $this->prune();
    }

    private function safeFile(string $hash): string
    {
        if (!preg_match('/^[a-f0-9]{64}$/', $hash)) {
            throw new InvalidArgumentException('path_rejected');
        }
        $path = VoicePath::join($this->root, $hash . '.mp3');
        return VoicePath::assertInside($this->root, $path);
    }

    private function prune(): void
    {
        $files = glob($this->root . '/*.mp3') ?: [];
        $rows = [];
        $total = 0;
        foreach ($files as $file) {
            if (!is_file($file) || is_link($file)) {
                continue;
            }
            $base = basename($file);
            if (!preg_match('/^[a-f0-9]{64}\\.mp3$/', $base)) {
                continue;
            }
            $size = (int) filesize($file);
            $rows[] = ['path' => $file, 'mtime' => (int) filemtime($file), 'size' => $size];
            $total += $size;
        }
        usort($rows, static fn (array $a, array $b): int => $a['mtime'] <=> $b['mtime']);
        while (
            (count($rows) > VoiceConfig::MAX_CACHE_FILES || $total > VoiceConfig::MAX_CACHE_BYTES)
            && $rows !== []
        ) {
            $old = array_shift($rows);
            $total -= (int) $old['size'];
            @unlink($old['path']);
        }
    }
}
