<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'error' => 'POST only'
    ]);
    exit;
}

$keyFile = '/home/ffilsyql/private/quill-publish-key.php';

if (!is_file($keyFile)) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Publisher key unavailable'
    ]);
    exit;
}

$expectedKey = trim((string) require $keyFile);
$providedKey = trim(
    (string) ($_SERVER['HTTP_X_QUILL_KEY'] ?? '')
);

if (
    $expectedKey === ''
    || $providedKey === ''
    || !hash_equals($expectedKey, $providedKey)
) {
    http_response_code(403);
    echo json_encode([
        'ok' => false,
        'error' => 'Forbidden'
    ]);
    exit;
}

$liveDir = __DIR__ . '/live';

if (
    !is_dir($liveDir)
    && !mkdir($liveDir, 0755, true)
    && !is_dir($liveDir)
) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Could not create live directory'
    ]);
    exit;
}

function fail_upload(string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode([
        'ok' => false,
        'error' => $message
    ]);
    exit;
}

function clean_hash(?string $value): string
{
    $value = strtolower(trim((string) $value));

    if (
        $value !== ''
        && !preg_match('/^[a-f0-9]{64}$/', $value)
    ) {
        return '';
    }

    return $value;
}

function atomic_bytes(
    string $destination,
    string $bytes
): void {
    $tmp = $destination
        . '.tmp.'
        . bin2hex(random_bytes(5));

    if (
        file_put_contents(
            $tmp,
            $bytes,
            LOCK_EX
        ) === false
    ) {
        fail_upload(
            'Could not write temporary file',
            500
        );
    }

    chmod($tmp, 0644);

    if (!rename($tmp, $destination)) {
        @unlink($tmp);

        fail_upload(
            'Could not publish temporary file',
            500
        );
    }
}

function uploaded_bytes(
    string $field,
    int $limit
): ?string {
    if (!isset($_FILES[$field])) {
        return null;
    }

    $file = $_FILES[$field];

    if (
        !isset($file['error'])
        || $file['error'] !== UPLOAD_ERR_OK
    ) {
        fail_upload(
            "Upload failed: {$field}"
        );
    }

    if (
        !isset($file['size'])
        || (int) $file['size'] > $limit
    ) {
        fail_upload(
            "Upload too large: {$field}"
        );
    }

    $bytes = file_get_contents(
        $file['tmp_name']
    );

    if ($bytes === false) {
        fail_upload(
            "Could not read upload: {$field}"
        );
    }

    return $bytes;
}


/*
 * ROOM HTML
 *
 * This is only the already-rendered visible room.
 * The public site does not receive Quill's full private room JSON.
 */
$roomBytes = uploaded_bytes(
    'room_html',
    2 * 1024 * 1024
);

if ($roomBytes !== null) {
    $sample = strtolower(
        substr($roomBytes, 0, 4096)
    );

    if (
        !str_contains($sample, '<html')
        && !str_contains($sample, '<!doctype')
    ) {
        fail_upload(
            'Room upload was not HTML'
        );
    }

    atomic_bytes(
        $liveDir . '/room.html',
        $roomBytes
    );
}


/*
 * SCREEN FRAME
 */
$screenBytes = uploaded_bytes(
    'screen',
    2 * 1024 * 1024
);

if ($screenBytes !== null) {
    $tmp = tempnam(
        sys_get_temp_dir(),
        'quill-screen-'
    );

    if ($tmp === false) {
        fail_upload(
            'Could not validate screen frame',
            500
        );
    }

    file_put_contents(
        $tmp,
        $screenBytes
    );

    $info = @getimagesize($tmp);

    @unlink($tmp);

    if (
        !$info
        || !in_array(
            $info[2],
            [
                IMAGETYPE_WEBP,
                IMAGETYPE_PNG,
                IMAGETYPE_JPEG
            ],
            true
        )
    ) {
        fail_upload(
            'Invalid screen image'
        );
    }

    atomic_bytes(
        $liveDir . '/screen.webp',
        $screenBytes
    );
}


/*
 * SAFE PUBLIC POSITION / STATUS
 */
$x = filter_var(
    $_POST['quill_x'] ?? null,
    FILTER_VALIDATE_FLOAT
);

$y = filter_var(
    $_POST['quill_y'] ?? null,
    FILTER_VALIDATE_FLOAT
);

if ($x === false || $x === null) {
    $x = 50.0;
}

if ($y === false || $y === null) {
    $y = 50.0;
}

$x = max(0.0, min(100.0, (float) $x));
$y = max(0.0, min(100.0, (float) $y));

$pose = preg_replace(
    '/[^a-zA-Z0-9 _-]/',
    '',
    (string) ($_POST['quill_pose'] ?? '')
);

$pose = substr(
    trim($pose),
    0,
    40
);

$roomName = trim(
    (string) (
        $_POST['room_name']
        ?? "Quill's Quarters"
    )
);

$roomName = mb_substr(
    strip_tags($roomName),
    0,
    100
);

$roomHash = clean_hash(
    $_POST['room_hash'] ?? ''
);

$screenHash = clean_hash(
    $_POST['screen_hash'] ?? ''
);

/* CURRENT PUBLIC CHAT FEED */

$chatRaw = (string) (
    $_POST['public_chat']
    ?? '[]'
);

$chatDecoded = json_decode(
    $chatRaw,
    true
);

$cleanChat = [];

if (is_array($chatDecoded)) {

    $chatDecoded = array_slice(
        $chatDecoded,
        -20
    );

    foreach ($chatDecoded as $entry) {

        if (!is_array($entry)) {
            continue;
        }

        $speaker = trim(
            (string) (
                $entry['speaker']
                ?? ''
            )
        );

        if (
            $speaker !== 'Toby'
            && $speaker !== 'Quill'
        ) {
            continue;
        }

        $text = trim(
            strip_tags(
                (string) (
                    $entry['text']
                    ?? ''
                )
            )
        );

        if ($text === '') {
            continue;
        }

        $text = mb_substr(
            $text,
            0,
            4000
        );

        $cleanChat[] = [
            'speaker' => $speaker,
            'text' => $text
        ];
    }
}

atomic_bytes(
    $liveDir . '/chat.json',
    json_encode(
        [
            'updated_at' => time(),
            'turns' => $cleanChat
        ],
        JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_UNICODE
        | JSON_PRETTY_PRINT
    )
);


$now = time();

$status = [
    'last_seen' => $now,
    'last_seen_iso' => gmdate(
        'c',
        $now
    ),

    'room_name' => $roomName,

    'room_hash' => $roomHash,

    'screen_hash' => $screenHash,

    'screen_available' => (
        $screenHash !== ''
        && is_file(
            $liveDir . '/screen.webp'
        )
    ),

    'quill' => [
        'x' => $x,
        'y' => $y,
        'pose' => $pose
    ]
];

atomic_bytes(
    $liveDir . '/status.json',
    json_encode(
        $status,
        JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_UNICODE
        | JSON_PRETTY_PRINT
    )
);

echo json_encode([
    'ok' => true,
    'received_at' => $now
]);
