<?php
declare(strict_types=1);

/**
 * Jack voice engine fixtures. No vendor call. No secrets.
 */
require_once dirname(__DIR__) . '/inc/env.php';
require_once dirname(__DIR__) . '/inc/graph.php';
require_once dirname(__DIR__) . '/app/JackVoice/autoload.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

expect(SpeechPrep::prepare('**Bold** slip and `code`.') === 'Bold slip and code.', 'markdown is stripped before speech');
expect(!str_contains(SpeechPrep::prepare('<speak>evil</speak> The clerk remains.'), '<speak>'), 'SSML tags are stripped');
expect(str_contains(SpeechPrep::prepare('Use sk-live-abcdefghijklmnopqrstuvwxyz123456.'), 'redacted credential'), 'API key material is redacted');
expect(str_contains(SpeechPrep::prepare('See https://evil.example/phish?x=1 please.'), 'a linked address'), 'URLs are not read aloud');
expect(!str_contains(SpeechPrep::prepare('See https://evil.example/phish?x=1 please.'), 'evil.example'), 'URL host is not spoken');
expect(SpeechPrep::prepare('{"reply":"secret","mode":"clerk"}') === '', 'JSON dumps are not spoken');
expect(str_contains(SpeechPrep::prepare('TTG holds the field.'), 'the Guild'), 'TTG is spoken as the Guild');

$network = SpeechPrep::prepare('Network present is 17.04.2033.');
expect(str_contains($network, 'seventeenth of April') && str_contains($network, 'twenty thirty-three'), 'network present date is spoken in full');
expect(str_contains(SpeechPrep::prepare('Festival of Britain, 17 April 1951.'), 'nineteen fifty-one'), 'written month dates are spoken');
expect(SpeechPrep::yearSpoken(1951) === 'nineteen fifty-one', '1951 is nineteen fifty-one');
expect(SpeechPrep::yearSpoken(2033) === 'twenty thirty-three', '2033 is twenty thirty-three');

$onlyKey = SpeechPrep::prepare('sk-live-abcdefghijklmnopqrstuvwxyz123456');
expect($onlyKey !== '' && !str_contains($onlyKey, 'sk-'), 'a key-only slip is redacted, not spoken raw');

ttg_graph_boot_session();
ttg_jack_queue_speech('The clerk remains at the desk.');
expect(ttg_jack_queued_speech() === 'The clerk remains at the desk.', 'queued speech is readable');
expect(ttg_jack_speech_ok('The clerk remains at the desk.'), 'matching queued speech is accepted');
expect(!ttg_jack_speech_ok('Say something else entirely.'), 'a different slip is refused');

$root = sys_get_temp_dir() . '/ttg-jack-voice-' . bin2hex(random_bytes(4));
@mkdir($root, 0770, true);
$cache = new VoiceCache($root);
$cache->boot();

$calls = (object) ['n' => 0];
$fake = new class($calls) implements VoiceSynth {
    public function __construct(private object $calls) {}
    public function synthesize(string $preparedText): string {
        $this->calls->n++;
        if ($preparedText === '') {
            throw new InvalidArgumentException('nothing_to_read');
        }
        return str_repeat("\xFF\xFB", 48) . 'JACK';
    }
};

ttg_env_set('ELEVENLABS_API_KEY', 'test-voice-key-not-real');
ttg_env_set('ELEVENLABS_VOICE_ID', 'TestVoiceId1234567890');
$engine = new VoiceEngine($cache, $fake);

$prepared = SpeechPrep::prepare('The clerk remains at the desk.');
$first = $engine->speakPrepared($prepared);
expect(!empty($first['ok']) && is_string($first['audio']) && $first['cached'] === false, 'first reading synthesizes');
$second = $engine->speakPrepared($prepared);
expect(!empty($second['ok']) && $second['cached'] === true && $calls->n === 1, 'repeat reading uses the cache');

$hash = $cache->key($prepared);
expect(preg_match('/^[a-f0-9]{64}$/', $hash) === 1, 'cache keys are sha256 hex');
expect(is_file($root . '/' . $hash . '.mp3'), 'cache stores hash.mp3 only');

try {
    VoicePath::join($root, '../etc/passwd.mp3');
    $joinOk = false;
} catch (InvalidArgumentException $e) {
    $joinOk = $e->getMessage() === 'path_rejected';
}
expect($joinOk, 'path traversal is rejected');

try {
    VoicePath::assertInside($root, $root . '/evil.php');
    $phpOk = false;
} catch (InvalidArgumentException $e) {
    $phpOk = $e->getMessage() === 'path_rejected';
}
expect($phpOk, 'non-mp3 cache names are rejected');

$link = $root . '/' . str_repeat('a', 64) . '.mp3';
@symlink('/etc/passwd', $link);
if (is_link($link)) {
    try {
        VoicePath::assertInside($root, $link);
        $symOk = false;
    } catch (Throwable $e) {
        $symOk = $e->getMessage() === 'symlink_rejected' || $e->getMessage() === 'path_rejected';
    }
    expect($symOk, 'symlink escape attempts fail');
    @unlink($link);
} else {
    expect(true, 'symlink escape attempts fail');
}

$mismatch = $engine->speakQueued('An injected sentence the clerk did not stamp.');
expect(empty($mismatch['ok']) && ($mismatch['error'] ?? '') === 'not_own_slip', 'client text that is not the queued slip is refused');

$queued = $engine->speakQueued('');
expect(!empty($queued['ok']), 'queue-only speak reads the last slip');

$jsonSpeak = $engine->speakPrepared(SpeechPrep::prepare('{"reply":"no","mode":"clerk"}'));
expect(empty($jsonSpeak['ok']) && ($jsonSpeak['error'] ?? '') === 'nothing_to_read', 'prepared JSON dump is nothing to read');

$speakPhp = file_get_contents(dirname(__DIR__) . '/jack/speak.php') ?: '';
$deskJs = file_get_contents(dirname(__DIR__) . '/assets/jack-desk.js') ?: '';
$jackJs = file_get_contents(dirname(__DIR__) . '/assets/jack.js') ?: '';
$synth = file_get_contents(dirname(__DIR__) . '/app/JackVoice/ElevenLabsSynth.php') ?: '';
expect(!str_contains($deskJs, 'ELEVENLABS') && !str_contains($jackJs, 'xi-api-key'), 'API key names do not appear in desk JavaScript');
expect(!str_contains($speakPhp, 'curl_error') || str_contains($speakPhp, 'VoiceEngine'), 'speak endpoint is the engine, not a raw vendor dump');
expect(!str_contains($synth, 'echo $') && str_contains($synth, 'xi-api-key'), 'vendor key is sent only as a server header');
expect(!str_contains($speakPhp, 'eval(') && !str_contains($synth, 'shell_exec'), 'voice engine has no shell executor');
expect(str_contains($deskJs, "speakText('', { queued: true })") || str_contains($deskJs, 'queued: true'), 'desk asks the engine for the queued slip');

$ht = file_get_contents(dirname(__DIR__) . '/storage/jack-voice/.htaccess') ?: '';
expect(str_contains($ht, 'denied') || str_contains($ht, 'Deny'), 'webroot voice cache is denied');

$htaccess = file_get_contents(dirname(__DIR__) . '/.htaccess') ?: '';
expect(str_contains($htaccess, 'jack/speak'), 'speak route remains in front of the desk');

echo ($fail === 0 ? "\nALL $pass PASSED\n" : "\n$fail FAILED, $pass passed\n");

$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
foreach ($it as $f) {
    @unlink($f->getPathname());
}
@rmdir($root);

exit($fail === 0 ? 0 : 1);
