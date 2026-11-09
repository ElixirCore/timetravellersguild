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
        $this->synth = $synth ?? (DeepgramSynth::available() ? new DeepgramSynth() : new ElevenLabsSynth());
    }

    public static function configured(): bool
    {
        if (DeepgramSynth::available()) {
            return true;
        }
        return function_exists('ttg_eleven_configured') && ttg_eleven_configured();
    }

    /**
     * Speak the session-queued last slip only.
     * Optional client text must match the queue; the queue is what is read.
     * Part 1 is the opening sentence, part 2 the rest (the server does the splitting); 0 is the whole slip.
     *
     * @return array{ok:bool,audio:?string,cached:bool,error:string,http:int}
     */
    public function speakQueued(string $clientText = '', int $part = 0): array
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

        $prepared = SpeechPrep::prepare($queued);
        if ($part !== 1 && $part !== 2) {
            return $this->speakPrepared($prepared);
        }
        [$opening, $rest] = SpeechPrep::opening($prepared);
        if ($part === 2) {
            return $rest === '' ? self::fail(400, 'nothing_to_read') : $this->speakPrepared($rest);
        }
        return ['more' => $rest !== ''] + $this->speakPrepared($opening);
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

        $chars = function_exists('mb_strlen') ? mb_strlen($prepared) : strlen($prepared);
        if (!self::sharedBudgetAllow($chars)) {
            return self::fail(429, 'test_budget_reached');
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
            require_once dirname(__DIR__, 2) . '/inc/voice-status.php';
            ttg_dg_balance(true);
        } catch (Throwable $e) {
            // Balance bookkeeping never blocks speech.
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


    /**
     * Shared credit-backed budget: same store and bounds as /puppet/jack/speech.php
     * (300 calls / 50,000 chars per day, $190 estimated-spend guard on the $200
     * credit). Incremented before provider dispatch. When a bound trips, speech
     * fails here and the browser falls back to its device voice.
     */
    private static function sharedBudgetAllow(int $chars): bool
    {
        $file = '/home/ffilsyql/ttg-private/jack-deepgram/quota.json';
        $fp = @fopen($file, 'c+');
        if (!$fp || !flock($fp, LOCK_EX)) {
            return false;
        }
        @chmod($file, 0600);
        $b = json_decode((string) stream_get_contents($fp), true);
        if (!is_array($b)) {
            $b = ['calls' => 0, 'chars' => 0];
        }
        $today = gmdate('Y-m-d');
        if (($b['day'] ?? '') !== $today) {
            $b['day'] = $today;
            $b['day_calls'] = 0;
            $b['day_chars'] = 0;
        }
        if ((int) ($b['day_calls'] ?? 0) >= 300 || (int) ($b['day_chars'] ?? 0) + $chars > 50000 || (float) ($b['est_usd'] ?? 0) >= 190.0) {
            flock($fp, LOCK_UN);
            fclose($fp);
            return false;
        }
        $b['calls'] = (int) ($b['calls'] ?? 0) + 1;
        $b['chars'] = (int) ($b['chars'] ?? 0) + $chars;
        $b['day_calls'] = (int) ($b['day_calls'] ?? 0) + 1;
        $b['day_chars'] = (int) ($b['day_chars'] ?? 0) + $chars;
        $b['est_usd'] = round($b['chars'] * 0.00003, 2);
        rewind($fp);
        $out = json_encode($b);
        if (fwrite($fp, $out) !== strlen($out) || !ftruncate($fp, strlen($out)) || !fflush($fp)) {
            flock($fp, LOCK_UN);
            fclose($fp);
            return false;
        }
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
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
