<?php
declare(strict_types=1);

function det_mail_config(): array {
    static $config;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

function det_form_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('det_form');
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => DET_WEB . '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function det_csrf_token(): string {
    det_form_session();
    if (empty($_SESSION['det_csrf'])) {
        $_SESSION['det_csrf'] = bin2hex(random_bytes(16));
    }
    return (string) $_SESSION['det_csrf'];
}

function det_header_safe(string $value): string {
    return str_replace(["\r", "\n", "\0"], '', $value);
}

function det_form_wants_json(): bool {
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $xhr = (string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '');
    return str_contains($accept, 'application/json')
        || strcasecmp($xhr, 'XMLHttpRequest') === 0;
}

function det_form_json(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function det_allowed_form_ids(): array {
    $ids = ['CONTACT'];
    foreach (det_forms() as $f) {
        $id = strtoupper(trim((string) ($f['id'] ?? '')));
        if ($id !== '') $ids[] = $id;
    }
    return $ids;
}

function det_new_ref(string $id): string {
    return $id . '-' . date('Y') . '-' . (string) random_int(1000, 9999);
}

function det_form_rate_ok(): bool {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0');
    $file = sys_get_temp_dir() . '/det-form-' . hash('sha256', $ip);
    $now = time();
    $window = 30 * 60;
    $max = 8;
    $times = [];
    if (is_readable($file)) {
        $decoded = json_decode((string) file_get_contents($file), true);
        if (is_array($decoded)) $times = $decoded;
    }
    $times = array_values(array_filter($times, static function ($t) use ($now, $window) {
        return is_int($t) && $t > ($now - $window);
    }));
    if (count($times) >= $max) return false;
    $times[] = $now;
    @file_put_contents($file, json_encode($times), LOCK_EX);
    return true;
}

function det_form_hidden_fields(string $id): string {
    $hid = preg_replace('/[^A-Z0-9-]/', '', strtoupper($id)) ?: 'FORM';
    return det_lang_hidden()
        . '<input type="hidden" name="det_submit" value="1">'
        . '<input type="hidden" name="form_id" value="'.det_h($id).'">'
        . '<input type="hidden" name="csrf" value="'.det_h(det_csrf_token()).'">'
        . '<input type="hidden" name="path" value="'.det_h(det_path()).'">'
        . '<div class="hp" aria-hidden="true">'
        . '<label for="det-company-'.$hid.'">Company</label>'
        . '<input type="text" name="company" id="det-company-'.$hid.'" tabindex="-1" autocomplete="off">'
        . '</div>';
}

function det_form_confirmation_html(string $ref, string $doneKey = 'form.done', string $keepKey = 'form.keep', string $class = 'svc'): string {
    $wrap = $class !== '' ? ' class="'.det_h($class).'"' : '';
    return '<div'.$wrap.'><div class="confirm"><h1>'.det_e($doneKey).'</h1>'
        .'<p>'.det_e('form.ref').' <strong>'.det_h($ref).'</strong></p></div>'
        .'<p>'.det_e($keepKey).'</p>'
        .'<p>'.det_e('assurance').'</p></div>';
}

function det_form_wizard_html(string $id, array $opts = []): string {
    $class = (string) ($opts['class'] ?? 'svc');
    $result = $GLOBALS['DET_FORM_RESULT'] ?? null;
    if (is_array($result) && !empty($result['ok']) && (string) ($result['form_id'] ?? '') === $id) {
        return det_form_confirmation_html(
            (string) $result['ref'],
            (string) ($opts['done'] ?? 'form.done'),
            (string) ($opts['keep'] ?? 'form.keep'),
            $class
        );
    }

    $lead = (string) ($opts['lead'] ?? '');
    $error = '';
    if (is_array($result) && empty($result['ok']) && (string) ($result['form_id'] ?? $id) === $id) {
        $error = '<div class="error-sum" data-form-error><h2>'.det_e('form.error').'</h2></div>';
    } else {
        $error = '<div class="error-sum" data-form-error hidden></div>';
    }

    $html = '<form'.($class !== '' ? ' class="'.det_h($class).'"' : '').' method="post" action="" data-form="'.det_h($id).'" data-err="'.det_e('form.error').'" data-lbl-name="'.det_e('form.name.lbl').'" data-lbl-email="'.det_e('form.email').'" data-lbl-details="'.det_e('form.details').'">';
    $html .= det_form_hidden_fields($id);
    $html .= $error;
    $html .= $lead;
    $html .= '<div class="step" data-step="0">'
        .'<div class="field"><label for="name">'.det_e('form.fullname').'</label><input id="name" name="name" type="text" autocomplete="name" required></div>'
        .'<button class="btn js-only" data-next type="button">'.det_e('continue').'</button>'
        .'</div>'
        .'<div class="step">'
        .'<button class="back js-only" data-back type="button">'.det_e('back').'</button>'
        .'<div class="field"><label for="email">'.det_e('form.email').'</label><input id="email" name="email" type="email" autocomplete="email" required></div>'
        .'<button class="btn js-only" data-next type="button">'.det_e('continue').'</button>'
        .'</div>'
        .'<div class="step">'
        .'<button class="back js-only" data-back type="button">'.det_e('back').'</button>'
        .'<div class="field"><label for="details">'.det_e('form.details').'</label><span class="hint">'.det_e('form.details.h').'</span><textarea id="details" name="details" required></textarea></div>'
        .'<button class="btn js-only" data-next type="button">'.det_e('continue').'</button>'
        .'</div>'
        .'<div class="step">'
        .'<button class="back js-only" data-back type="button">'.det_e('back').'</button>'
        .'<h2>'.det_e('form.check').'</h2>'
        .'<dl class="summary js-only" data-check></dl>'
        .'<button class="btn" data-submit type="submit">'.det_e('form.send').'</button>'
        .'</div>'
        .'<div class="step step--confirm">'
        .'<div class="confirm"><h1>'.det_e((string) ($opts['done'] ?? 'form.done')).'</h1><p>'.det_e('form.ref').' <strong data-ref></strong></p></div>'
        .'<p>'.det_e((string) ($opts['keep'] ?? 'form.keep')).'</p>'
        .'<p>'.det_e('assurance').'</p>'
        .'</div>'
        .'</form>';
    return $html;
}

function det_send_form_mail(array $data): bool {
    $config = det_mail_config();
    if (empty($config['mail_enabled'])) {
        error_log('DET mail skipped: mail_enabled is false');
        return false;
    }

    $to = trim((string) ($config['mail_to'] ?? ''));
    $from = trim((string) ($config['mail_from'] ?? ''));
    if ($to === '' || $from === '') {
        error_log('DET mail skipped: mail_to or mail_from is empty');
        return false;
    }

    $prefix = trim((string) ($config['mail_subject_prefix'] ?? '[DET]'));
    $subject = det_header_safe($prefix.' '.$data['form_id'].' '.$data['ref']);
    $lines = [
        'Department of Excess Time form submission',
        '',
        'Form: '.$data['form_id'],
        'Reference: '.$data['ref'],
        'Name: '.$data['name'],
        'Email: '.$data['email'],
        'Details:',
        $data['details'],
    ];
    if ($data['place'] !== '') {
        $lines[] = '';
        $lines[] = 'Place: '.$data['place'];
    }
    if ($data['event_date'] !== '') {
        $lines[] = 'Date: '.$data['event_date'];
    }
    $lines[] = '';
    $lines[] = 'Page: '.$data['path'];
    $lines[] = 'Time: '.$data['timestamp'];
    $body = implode("\n", $lines)."\n";

    $headers = [
        'From: '.det_header_safe($from),
        'Content-Type: text/plain; charset=UTF-8',
        'X-Mailer: DET/1.0',
    ];
    if ($data['email'] !== '') {
        $headers[] = 'Reply-To: '.det_header_safe($data['email']);
    }

    return mail($to, $subject, $body, implode("\r\n", $headers));
}

function det_consume_form_post(): ?array {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') return null;
    if ((string) ($_POST['det_submit'] ?? '') !== '1') return null;

    $formId = strtoupper(trim((string) ($_POST['form_id'] ?? '')));
    $json = det_form_wants_json();

    $fail = static function (string $formId, bool $json) : ?array {
        if ($json) det_form_json(['ok' => false, 'error' => 'rejected'], 400);
        return ['ok' => false, 'form_id' => $formId];
    };

    if ($formId === '' || !in_array($formId, det_allowed_form_ids(), true)) {
        return $fail($formId !== '' ? $formId : 'DET-00', $json);
    }

    det_form_session();
    $given = (string) ($_POST['csrf'] ?? '');
    $stored = (string) ($_SESSION['det_csrf'] ?? '');
    if ($stored === '' || !hash_equals($stored, $given)) {
        return $fail($formId, $json);
    }

    $honeypot = trim((string) ($_POST['company'] ?? ''));
    if ($honeypot !== '') {
        $ref = det_new_ref($formId);
        if ($json) det_form_json(['ok' => true, 'ref' => $ref]);
        return ['ok' => true, 'ref' => $ref, 'form_id' => $formId];
    }

    if (!det_form_rate_ok()) {
        return $fail($formId, $json);
    }

    $name = trim((string) ($_POST['name'] ?? ''));
    $email = trim((string) ($_POST['email'] ?? ''));
    $details = trim((string) ($_POST['details'] ?? ''));
    $place = trim((string) ($_POST['place'] ?? ''));
    $eventDate = trim((string) ($_POST['event-date'] ?? ''));
    $path = trim((string) ($_POST['path'] ?? det_path()));

    if (strlen($name) > 200) $name = substr($name, 0, 200);
    if (strlen($email) > 200) $email = substr($email, 0, 200);
    if (strlen($details) > 8000) $details = substr($details, 0, 8000);
    if (strlen($place) > 300) $place = substr($place, 0, 300);
    if (strlen($eventDate) > 100) $eventDate = substr($eventDate, 0, 100);
    if (strlen($path) > 300) $path = substr($path, 0, 300);

    if ($name === '' || $details === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return $fail($formId, $json);
    }

    $ref = det_new_ref($formId);
    $payload = [
        'form_id' => $formId,
        'ref' => $ref,
        'name' => $name,
        'email' => $email,
        'details' => $details,
        'place' => $place,
        'event_date' => $eventDate,
        'path' => $path !== '' ? $path : det_path(),
        'timestamp' => date('c'),
    ];

    if (!det_send_form_mail($payload)) {
        error_log('DET mail() failed for '.$ref);
        return $fail($formId, $json);
    }

    if ($json) det_form_json(['ok' => true, 'ref' => $ref]);
    return ['ok' => true, 'ref' => $ref, 'form_id' => $formId];
}
