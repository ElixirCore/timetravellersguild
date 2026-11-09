<?php
declare(strict_types=1);

/**
 * Is Jack's voice line open? Since 2026-11-07 the line is powered by Deepgram
 * (Aura-2), billed against the owner's $200 credit with auto top-up off.
 *
 * The gate first checks the live Deepgram balance via the cached server-side
 * probe in deepgram-credit.php (the key never leaves the server). When the
 * probe is unavailable it falls back to conservative local accounting in the
 * shared store (/home/ffilsyql/ttg-private/jack-deepgram/quota.json), the same
 * store the puppet speech.php and JackVoice VoiceEngine charge against.
 *
 *   true  = key present and budget remains
 *   false = a bound is spent (daily abuse bound, estimated-spend guard, or the
 *           live balance is nearly gone)
 *   null  = unknown (no key, unreadable store): leave Jack up and let the
 *           browser notice if a call fails
 *
 * The bound values duplicate those in puppet/jack/speech.php and
 * app/JackVoice/VoiceEngine.php; a budget change must update all three.
 */

const TTG_VOICE_DAY_CALLS = 300;
const TTG_VOICE_DAY_CHARS = 50000;
const TTG_VOICE_CREDIT_GUARD_USD = 190.0;
const TTG_VOICE_MIN_BALANCE_USD = 2.0;



function ttg_voice_key_file(): string {
    return dirname(__DIR__, 3) . '/ttg-private/deepgram-api-key.txt';
}

function ttg_voice_quota_file(): string {
    return dirname(__DIR__, 3) . '/ttg-private/jack-deepgram/quota.json';
}

function ttg_voice_credit(): ?bool {
    $key = ttg_voice_key_file();
    if (!is_file($key) || trim((string) @file_get_contents($key)) === '') {
        return null;
    }
    $file = ttg_voice_quota_file();
    $quota = is_file($file) ? json_decode((string) @file_get_contents($file), true) : null;
    if (!is_array($quota) || !isset($quota['calls'], $quota['chars'])) {
        return null;
    }
    // Daily abuse bounds always apply.
    if (($quota['day'] ?? '') === gmdate('Y-m-d')) {
        if ((int) ($quota['day_calls'] ?? 0) >= TTG_VOICE_DAY_CALLS
            || (int) ($quota['day_chars'] ?? 0) >= TTG_VOICE_DAY_CHARS) {
            return false;
        }
    }
    // Live balance when a fresh cached probe exists; conservative local estimate
    // otherwise. The probe itself refreshes in the speech path after a synth, so
    // this gate never waits on the Deepgram API.
    $balance = ttg_dg_balance(false);
    if ($balance !== null) {
        return $balance > TTG_VOICE_MIN_BALANCE_USD;
    }
    $est = (float) ($quota['est_usd'] ?? ((int) $quota['chars'] * 0.00003));
    return $est < TTG_VOICE_CREDIT_GUARD_USD;
}


/**
 * Live Deepgram credit balance for Jack's voice line. The probe runs
 * server-side (the API key never leaves the server) and is cached for six hours in ttg-private/jack-deepgram/balance.json. Every function returns
 * null rather than failing loud: the gate falls back to local accounting.
 */

function ttg_dg_balance_file(): string {
    return dirname(__DIR__, 3) . '/ttg-private/jack-deepgram/balance.json';
}

function ttg_dg_balance_fresh(): ?array {
    $file = ttg_dg_balance_file();
    if (!is_file($file)) {
        return null;
    }
    $d = json_decode((string) @file_get_contents($file), true);
    if (!is_array($d) || !isset($d['ts']) || time() - (int) $d['ts'] > 21600) {
        return null;
    }
    return $d; // fresh record; balance_usd may be null when the probe cannot read it
}

function ttg_dg_balance_refresh(): ?float {
    $keyFile = dirname(__DIR__, 3) . '/ttg-private/deepgram-api-key.txt';
    $key = is_file($keyFile) ? trim((string) @file_get_contents($keyFile)) : '';
    if ($key === '') {
        return null;
    }
    $get = function (string $url) use ($key) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ['Authorization: Token ' . $key],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 8,
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($code !== 200 || !is_string($body)) {
            return null;
        }
        $d = json_decode($body, true);
        return is_array($d) ? $d : null;
    };
    $projects = $get('https://api.deepgram.com/v1/projects');
    $pid = $projects['projects'][0]['project_id'] ?? null;
    if (!$pid) {
        return null;
    }
    $balances = $get('https://api.deepgram.com/v1/projects/' . $pid . '/balances');
    $amount = null;
    foreach (($balances['balances'] ?? []) as $b) {
        if (($b['units'] ?? '') === 'USD') {
            $amount = (float) $b['balance'];
            break;
        }
    }
    if ($amount === null) {
        // Cache the failure too, so a key without management scope does not cost
        // two API round trips on every cold-cache synth.
        @file_put_contents(ttg_dg_balance_file(), json_encode(['ts' => time(), 'balance_usd' => null]));
        return null;
    }
    @file_put_contents(ttg_dg_balance_file(), json_encode(['ts' => time(), 'balance_usd' => $amount, 'project_id' => $pid]));
    @chmod(ttg_dg_balance_file(), 0600);
    return $amount;
}

function ttg_dg_balance(bool $refreshIfStale = true): ?float {
    $fresh = ttg_dg_balance_fresh();
    if ($fresh !== null) {
        return $fresh['balance_usd'] === null ? null : (float) $fresh['balance_usd'];
    }
    return $refreshIfStale ? ttg_dg_balance_refresh() : null;
}
