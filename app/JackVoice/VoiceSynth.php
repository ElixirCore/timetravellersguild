<?php
declare(strict_types=1);

/**
 * The only thing a synthesis backend may do: turn prepared clerk speech into MPEG.
 * The model never chooses the backend, the voice, or the settings.
 */
interface VoiceSynth
{
    public function synthesize(string $preparedText): string;
}
