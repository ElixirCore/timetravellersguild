<?php
declare(strict_types=1);

/**
 * Prepare clerk speech for the reader. Untrusted bodies are not spoken.
 */
final class SpeechPrep
{
    private const ONES = [
        0 => 'zero', 1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four',
        5 => 'five', 6 => 'six', 7 => 'seven', 8 => 'eight', 9 => 'nine',
        10 => 'ten', 11 => 'eleven', 12 => 'twelve', 13 => 'thirteen',
        14 => 'fourteen', 15 => 'fifteen', 16 => 'sixteen', 17 => 'seventeen',
        18 => 'eighteen', 19 => 'nineteen',
    ];

    private const TENS = [
        2 => 'twenty', 3 => 'thirty', 4 => 'forty', 5 => 'fifty',
        6 => 'sixty', 7 => 'seventy', 8 => 'eighty', 9 => 'ninety',
    ];

    private const ORDINALS = [
        1 => 'first', 2 => 'second', 3 => 'third', 4 => 'fourth', 5 => 'fifth',
        6 => 'sixth', 7 => 'seventh', 8 => 'eighth', 9 => 'ninth', 10 => 'tenth',
        11 => 'eleventh', 12 => 'twelfth', 13 => 'thirteenth', 14 => 'fourteenth',
        15 => 'fifteenth', 16 => 'sixteenth', 17 => 'seventeenth', 18 => 'eighteenth',
        19 => 'nineteenth', 20 => 'twentieth', 21 => 'twenty-first', 22 => 'twenty-second',
        23 => 'twenty-third', 24 => 'twenty-fourth', 25 => 'twenty-fifth',
        26 => 'twenty-sixth', 27 => 'twenty-seventh', 28 => 'twenty-eighth',
        29 => 'twenty-ninth', 30 => 'thirtieth', 31 => 'thirty-first',
    ];

    private const MONTHS = [
        1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
        5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
        9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December',
    ];

    private const MONTH_NAMES = [
        'january' => 1, 'february' => 2, 'march' => 3, 'april' => 4,
        'may' => 5, 'june' => 6, 'july' => 7, 'august' => 8,
        'september' => 9, 'october' => 10, 'november' => 11, 'december' => 12,
    ];

    public static function prepare(string $raw): string
    {
        $text = trim($raw);
        if ($text === '') {
            return '';
        }
        if (self::looksLikeJsonDump($text)) {
            return '';
        }

        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = self::stripMarkup($text);
        $text = self::redactSecrets($text);
        $text = self::replaceUrls($text);
        $text = self::expandGuildTokens($text);
        $text = self::expandDates($text);
        $text = self::clerkPunctuation($text);
        $text = self::collapseSpace($text);
        $text = self::truncate($text);

        return $text;
    }

    /**
     * Split a prepared slip into its opening sentence and the rest, so he can start
     * speaking while the rest is being made. [text, ''] when there is nothing worth splitting.
     *
     * @return array{0:string,1:string}
     */
    public static function opening(string $prepared): array
    {
        if (!preg_match('/^(.{24,}?[.!?…]["”’)\\]]*)\s+(.+)$/us', $prepared, $m)) {
            return [$prepared, ''];
        }
        $rest = trim($m[2]);
        return mb_strlen($rest) < 20 ? [$prepared, ''] : [trim($m[1]), $rest];
    }

    public static function looksLikeJsonDump(string $text): bool
    {
        $t = ltrim($text);
        if ($t === '' || ($t[0] !== '{' && $t[0] !== '[')) {
            return false;
        }
        json_decode($t);
        return json_last_error() === JSON_ERROR_NONE;
    }

    private static function stripMarkup(string $text): string
    {
        $text = preg_replace('/```[\s\S]*?```/', ' ', $text) ?? $text;
        $text = preg_replace('/`([^`]+)`/', '$1', $text) ?? $text;
        $text = preg_replace('/\[([^\]]+)\]\(([^)]+)\)/', '$1', $text) ?? $text;
        $text = preg_replace('/[#*_~]+/', '', $text) ?? $text;
        $text = preg_replace('/<[^>]+>/', ' ', $text) ?? $text;
        return $text;
    }

    private static function redactSecrets(string $text): string
    {
        $text = preg_replace('/sk-[A-Za-z0-9_-]{8,}/', 'a redacted credential', $text) ?? $text;
        $text = preg_replace('/\bxi-api-key\b[:\s]*[A-Za-z0-9_-]{8,}/i', 'a redacted credential', $text) ?? $text;
        $text = preg_replace('/\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*\S+/i', 'a redacted credential', $text) ?? $text;
        $text = preg_replace('/\bBearer\s+[A-Za-z0-9._\-+=\/]{12,}/i', 'a redacted credential', $text) ?? $text;
        $text = preg_replace('/\b(?:OPENAI|ELEVENLABS)_[A-Z0-9_]+\s*=\s*\S+/', 'a redacted credential', $text) ?? $text;
        $text = preg_replace('/\b[A-Fa-f0-9]{32,}\b/', 'a redacted sequence', $text) ?? $text;
        return $text;
    }

    private static function replaceUrls(string $text): string
    {
        $text = preg_replace('/(?:https?:\/\/|www\.)[^\s<>"\']+/i', 'a linked address', $text) ?? $text;
        $text = preg_replace('/\b(?:javascript|data|vbscript):[^\s<>"\']+/i', 'a linked address', $text) ?? $text;
        return $text;
    }

    private static function expandGuildTokens(string $text): string
    {
        return preg_replace('/\bTTG\b/', 'the Guild', $text) ?? $text;
    }

    private static function expandDates(string $text): string
    {
        $text = preg_replace_callback(
            '/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/',
            static function (array $m): string {
                $spoken = SpeechPrep::spokenDate((int) $m[1], (int) $m[2], (int) $m[3]);
                return $spoken !== '' ? $spoken : $m[0];
            },
            $text
        ) ?? $text;

        $text = preg_replace_callback(
            '/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i',
            static function (array $m): string {
                $month = SpeechPrep::MONTH_NAMES[strtolower($m[2])] ?? 0;
                $spoken = SpeechPrep::spokenDate((int) $m[1], $month, (int) $m[3]);
                return $spoken !== '' ? $spoken : $m[0];
            },
            $text
        ) ?? $text;

        return $text;
    }

    public static function spokenDate(int $day, int $month, int $year): string
    {
        if ($day < 1 || $day > 31 || $month < 1 || $month > 12 || $year < 1000 || $year > 2999) {
            return '';
        }
        $ord = self::ORDINALS[$day] ?? '';
        $mon = self::MONTHS[$month] ?? '';
        if ($ord === '' || $mon === '') {
            return '';
        }
        return 'the ' . $ord . ' of ' . $mon . ', ' . self::yearSpoken($year);
    }

    public static function yearSpoken(int $year): string
    {
        if ($year < 1000 || $year > 2999) {
            return (string) $year;
        }
        $hi = intdiv($year, 100);
        $lo = $year % 100;
        $head = self::twoDigitSpoken($hi);
        if ($lo === 0) {
            return $head . ' hundred';
        }
        if ($lo < 10) {
            return $head . ' oh ' . self::ONES[$lo];
        }
        return $head . ' ' . self::twoDigitSpoken($lo);
    }

    private static function twoDigitSpoken(int $n): string
    {
        if ($n < 0 || $n > 99) {
            return (string) $n;
        }
        if ($n < 20) {
            return self::ONES[$n];
        }
        $tens = intdiv($n, 10);
        $ones = $n % 10;
        $head = self::TENS[$tens] ?? (string) $n;
        if ($ones === 0) {
            return $head;
        }
        return $head . '-' . self::ONES[$ones];
    }

    private static function clerkPunctuation(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/\n{2,}/', '. ', $text) ?? $text;
        $text = str_replace("\n", ' ', $text);
        $text = str_replace(['—', '–', ' -- ', '--'], ', ', $text);
        $text = str_replace(['…', '...'], ', ', $text);
        return $text;
    }

    private static function collapseSpace(string $text): string
    {
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
        $text = preg_replace('/\s+([,.;:!?])/', '$1', $text) ?? $text;
        $text = preg_replace('/([,.;:!?]){2,}/', '$1', $text) ?? $text;
        return trim($text);
    }

    private static function truncate(string $text): string
    {
        $max = VoiceConfig::MAX_CHARS;
        $len = function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
        if ($len <= $max) {
            return $text;
        }
        $cut = function_exists('mb_substr') ? mb_substr($text, 0, $max) : substr($text, 0, $max);
        $period = function_exists('mb_strrpos') ? mb_strrpos($cut, '.') : strrpos($cut, '.');
        if (is_int($period) && $period > (int) ($max * 0.6)) {
            $cut = function_exists('mb_substr') ? mb_substr($cut, 0, $period + 1) : substr($cut, 0, $period + 1);
        }
        return trim($cut);
    }
}
