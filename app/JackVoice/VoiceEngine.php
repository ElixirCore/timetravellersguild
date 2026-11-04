<?php
declare(strict_types=1);

/**
 * Trusted voice engine. The model may produce a slip; it may not call the reader.
 */
final class VoiceEngine
{
    private VoiceCache $cache;
    private VoiceSynth $synth;

    public function __construct(?VoiceCache $cache = null, ?VoiceSynth $synth = null)
    {
        $this->cache = $cache ?? new VoiceCache();
        $this->synth = $synth ?? new ElevenLabsSynth();
    }

    public static function configured(): bool
    {
        return function_exists('ttg_eleven_configured') && ttg_eleven_configured();
    }

    /**
     * Speak the session-queued last slip only.
     * Optional client text must match the queue; the queue is what is read.
     *
     * @return array{ok:bool,audio:?string,cached:bool,error:string,http:int}
     */
    public function speakQueued(string $clientText = ''): array
    {
        if (!self::configured()) {
            return self::fail(503, 'unconfigured');
        }

        $queued = function_exists('ttg_jack_queued_speech') ? ttg_jack_queued_speech() : '';
        if ($queued === '') {
            return self::fail(400, 'nothing_to_read');
        }
        if ($clientText !== '' && !hash_equals($queued, $clientText)) {
            return self::fail(403, 'not_own_slip');
        }

        return $this->speakPrepared(SpeechPrep::prepare($queued));
    }

    /**
     * @return array{ok:bool,audio:?string,cached:bool,error:string,http:int}
     */
    public function speakPrepared(string $prepared): array
    {
        $prepared = trim($prepared);
        if ($prepared === '') {
            return self::fail(400, 'nothing_to_read');
        }

        $hash = $this->cache->key($prepared);
        $hit = $this->cache->get($hash);
        if (is_string($hit) && $hit !== '') {
            if (!$this->allowPlay(true)) {
                return self::fail(429, 'reader_occupied');
            }
            return [
                'ok' => true,
                'audio' => $hit,
                'cached' => true,
                'error' => '',
                'http' => 200,
            ];
        }

        if (!$this->allowPlay(false) || !$this->allowSynth(true) || !$this->allowPlay(true)) {
            return self::fail(429, 'reader_occupied');
        }

        try {
            $audio = $this->synth->synthesize($prepared);
        } catch (InvalidArgumentException $e) {
            return self::fail(400, $e->getMessage() === 'nothing_to_read' ? 'nothing_to_read' : 'synth_failed');
        } catch (Throwable $e) {
            $msg = $e->getMessage();
            if ($msg === 'voice_unconfigured') {
                return self::fail(503, 'unconfigured');
            }
            return self::fail(503, 'synth_failed');
        }

        if ($audio === '') {
            return self::fail(503, 'synth_failed');
        }

        try {
            $this->cache->put($hash, $audio);
        } catch (Throwable $e) {
            // Still return speech if the cache cannot keep a copy.
        }

        return [
            'ok' => true,
            'audio' => $audio,
            'cached' => false,
            'error' => '',
            'http' => 200,
        ];
    }

    private function allowSynth(bool $consume): bool
    {
        if (!function_exists('ttg_jack_rate_allow')) {
            return true;
        }
        return ttg_jack_rate_allow('speak', VoiceConfig::SYNTH_PER_HOUR, $consume);
    }

    private function allowPlay(bool $consume): bool
    {
        if (!function_exists('ttg_jack_rate_allow')) {
            return true;
        }
        return ttg_jack_rate_allow('play', VoiceConfig::PLAY_PER_HOUR, $consume);
    }

    /**
     * @return array{ok:bool,audio:?string,cached:bool,error:string,http:int}
     */
    private static function fail(int $http, string $error): array
    {
        return [
            'ok' => false,
            'audio' => null,
            'cached' => false,
            'error' => $error,
            'http' => $http,
        ];
    }
}
