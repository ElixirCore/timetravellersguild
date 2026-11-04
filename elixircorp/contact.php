<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$name    = trim($_POST['name']    ?? '');
$email   = trim($_POST['email']   ?? '');
$message = trim($_POST['message'] ?? '');

if (!$message) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please include a message.']);
    exit;
}

if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'That email address doesn\'t look right.']);
    exit;
}

$to      = 'elixircorpenterprises@gmail.com';
$subject = $name ? 'Enquiry from ' . $name : 'Enquiry via ElixirCorp';

$body  = $name    ? "Name: $name\n"    : '';
$body .= $email   ? "Email: $email\n"  : '';
$body .= $body    ? "\n"               : '';
$body .= $message;

$from    = 'noreply@timetravellersguild.com';
$headers = "From: ElixirCorp <$from>\r\n";
$headers .= "Return-Path: $from\r\n";
if ($email) {
    $headers .= "Reply-To: $email\r\n";
}
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "X-Mailer: ElixirCorp/1.0\r\n";

$sent = mail($to, $subject, $body, $headers, '-f ' . $from);

if ($sent) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Mail could not be sent. Please email us directly.']);
}
