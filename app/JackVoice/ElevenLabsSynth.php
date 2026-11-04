<?php
declare(strict_types=1);

/**
 * ElevenLabs is called only here. The API key never leaves the server.
 * Error bodies from the vendor are not forwarded to the browser.
 */
final class ElevenLabsSynth implements VoiceSynth
{
    public function synthesize(string $preparedText): string
    {
        $preparedText = trim($preparedText);
        if ($preparedText === '') {
            throw new InvalidArgumentException('nothing_to_read');
        }

        $apiKey = ttg_env('ELEVENLABS_API_KEY');
        $voiceId = VoiceConfig::voiceId();
        $model = VoiceConfig::model();
        if ($apiKey === '' || $voiceId === '' || str_contains($apiKey, 'YOUR_KEY')) {
            throw new RuntimeException('voice_unconfigured');
        }

        $body = json_encode([
            'text' => $preparedText,
            'model_id' => $model,
            'voice_settings' => VoiceConfig::clerkSettings(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($body === false) {
            throw new RuntimeException('synth_failed');
        }

        $url = 'https://api.elevenlabs.io/v1/text-to-speech/'
            . rawurlencode($voiceId)
            . '?output_format=mp3_44100_128';

        $ch = curl_init($url);
        if ($ch === false) {
            throw new RuntimeException('synth_failed');
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Accept: audio/mpeg',
                'Content-Type: application/json',
                'xi-api-key: ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => VoiceConfig::TIMEOUT_SECONDS,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);

        $audio = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if (!is_string($audio) || $audio === '' || $err !== '' || $code < 200 || $code >= 300) {
            throw new RuntimeException('synth_failed');
        }
        if (strlen($audio) > VoiceConfig::MAX_AUDIO_BYTES) {
            throw new RuntimeException('synth_failed');
        }

        return $audio;
    }
}
