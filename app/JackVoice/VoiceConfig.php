<?php
declare(strict_types=1);

/**
 * Clerk voice configuration. No secrets in return values except key names.
 */
final class VoiceConfig
{
    public const DEFAULT_MODEL = 'eleven_multilingual_v2';

    public const MODELS = [
        'eleven_multilingual_v2',
        'eleven_turbo_v2_5',
        'eleven_flash_v2_5',
        'eleven_v3',
    ];

    public const MAX_CHARS = 1800;
    public const MAX_AUDIO_BYTES = 5000000;
    public const MAX_CACHE_FILES = 120;
    public const MAX_CACHE_BYTES = 83886080;
    public const SYNTH_PER_HOUR = 24;
    public const PLAY_PER_HOUR = 60;
    public const TIMEOUT_SECONDS = 40;

    /**
     * Dry institutional clerk. High stability, almost no style exaggeration.
     *
     * @return array{stability:float,similarity_boost:float,style:float,use_speaker_boost:bool,speed:float}
     */
    public static function clerkSettings(): array
    {
        return [
            'stability' => 0.72,
            'similarity_boost' => 0.78,
            'style' => 0.05,
            'use_speaker_boost' => true,
            'speed' => 0.94,
        ];
    }

    public static function root(): string
    {
        $explicit = ttg_env('JACK_VOICE_CACHE');
        if ($explicit !== '') {
            return rtrim($explicit, '/');
        }
        $home = getenv('HOME');
        if (is_string($home) && $home !== '') {
            $priv = rtrim($home, '/') . '/ttg-private/jack-voice';
            if (self::usable($priv) || self::creatable(dirname($priv))) {
                return $priv;
            }
        }
        return dirname(__DIR__, 2) . '/storage/jack-voice';
    }

    public static function usable(string $dir): bool
    {
        return is_dir($dir) && is_writable($dir);
    }

    public static function creatable(string $parent): bool
    {
        return is_dir($parent) && is_writable($parent);
    }

    public static function model(): string
    {
        $model = function_exists('ttg_eleven_model') ? ttg_eleven_model() : self::DEFAULT_MODEL;
        if (!in_array($model, self::MODELS, true)) {
            return self::DEFAULT_MODEL;
        }
        return $model;
    }

    public static function voiceId(): string
    {
        return function_exists('ttg_eleven_voice_id') ? ttg_eleven_voice_id() : '';
    }

    public static function settingsFingerprint(): string
    {
        $s = self::clerkSettings();
        return sprintf(
            'st%.2f-si%.2f-sy%.2f-sp%.2f-b%d',
            $s['stability'],
            $s['similarity_boost'],
            $s['style'],
            $s['speed'],
            $s['use_speaker_boost'] ? 1 : 0
        );
    }
}
