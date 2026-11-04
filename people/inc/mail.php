<?php
declare(strict_types=1);
require_once __DIR__ . '/functions.php';

/**
 * Transactional mail via PHP mail() with envelope + headers that match
 * SPF/DKIM on timetravellersguild.com (Namecheap / web-hosting.com).
 *
 * Pass opts['html'] for multipart/alternative (plain + parchment HTML).
 */
function ttg_send_mail(string $to, string $subject, string $body, array $opts = []): bool {
    $config = ttg_config();
    if (empty($config['mail_enabled']) && empty($opts['force'])) {
        return false;
    }

    $fromAddr = trim((string) ($opts['from'] ?? $config['mail_from'] ?? ''));
    if ($fromAddr === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    if (!filter_var($fromAddr, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $fromName = trim((string) ($opts['from_name'] ?? $config['app_name'] ?? 'The Time Travellers Guild'));
    $replyTo = trim((string) ($opts['reply_to'] ?? $fromAddr));
    $domain = substr(strrchr($fromAddr, '@') ?: '@timetravellersguild.com', 1) ?: 'timetravellersguild.com';
    $html = trim((string) ($opts['html'] ?? ''));

    $encodeHeader = static function (string $value): string {
        if (preg_match('/[^\x20-\x7E]/', $value)) {
            return '=?UTF-8?B?' . base64_encode($value) . '?=';
        }
        return $value;
    };

    $safeAddr = static function (string $addr): string {
        return str_replace(["\r", "\n", ' ', '"', '<', '>'], '', $addr);
    };

    $fromAddr = $safeAddr($fromAddr);
    $replyTo = $safeAddr($replyTo);
    $to = $safeAddr($to);

    $messageId = sprintf('<%s@%s>', bin2hex(random_bytes(16)), $domain);
    $date = gmdate('D, d M Y H:i:s O');
    $unsubUrl = trim((string) ($opts['unsubscribe_url'] ?? ''));
    $unsubscribe = $unsubUrl !== '' && preg_match('#^https://#', $unsubUrl)
        ? '<' . str_replace(["\r", "\n", '<', '>', ' '], '', $unsubUrl) . '>, <mailto:' . $fromAddr . '>'
        : '<mailto:' . $fromAddr . '>, <https://timetravellersguild.com/>';

    $headers = [
        'From: ' . $encodeHeader($fromName) . ' <' . $fromAddr . '>',
        'Reply-To: ' . $replyTo,
        'Message-ID: ' . $messageId,
        'Date: ' . $date,
        'MIME-Version: 1.0',
        'Auto-Submitted: auto-generated',
        'X-Auto-Response-Suppress: All',
        'List-Unsubscribe: ' . $unsubscribe,
        'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    ];

    if ($html !== '') {
        $boundary = 'ttg_' . bin2hex(random_bytes(12));
        $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
        $payload = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: 8bit\r\n\r\n"
            . str_replace(["\r\n", "\r"], "\n", $body) . "\r\n\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: 8bit\r\n\r\n"
            . $html . "\r\n\r\n"
            . "--{$boundary}--\r\n";
    } else {
        $headers[] = 'Content-Type: text/plain; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: 8bit';
        $payload = $body;
    }

    $encodedSubject = $encodeHeader($subject);
    $params = '-f' . $fromAddr;

    return @mail($to, $encodedSubject, $payload, implode("\r\n", $headers), $params);
}

/**
 * Immaculate Guild parchment slip — table layout, inline styles, client-safe.
 *
 * @param array{
 *   kicker?:string,
 *   title:string,
 *   lede?:string,
 *   body_html?:string,
 *   cta_label?:string,
 *   cta_url?:string,
 *   fine?:string,
 *   foot?:string
 * } $slip
 */
function ttg_parchment_html(array $slip): string {
    $h = static function (string $s): string {
        return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    };

    $kicker = $h(trim((string) ($slip['kicker'] ?? 'ZIPLOCK · ONE-TIME SLIP')));
    $title = $h(trim((string) ($slip['title'] ?? 'The Time Travellers Guild')));
    $lede = trim((string) ($slip['lede'] ?? ''));
    $bodyHtml = (string) ($slip['body_html'] ?? '');
    $ctaLabel = $h(trim((string) ($slip['cta_label'] ?? 'OPEN THE LINK')));
    $ctaUrl = trim((string) ($slip['cta_url'] ?? ''));
    $fine = $h(trim((string) ($slip['fine'] ?? 'This link expires in twenty minutes and can only be used once.')));
    $foot = $h(trim((string) ($slip['foot'] ?? 'If you did not request this, ignore this slip. The Guild keeps no password.')));
    $ledeHtml = $lede !== '' ? '<p style="margin:0 0 18px;font-family:Georgia,\'Times New Roman\',serif;font-size:16px;line-height:1.55;color:#3a3d34;">' . $h($lede) . '</p>' : '';
    $ctaBlock = '';
    if ($ctaUrl !== '' && preg_match('#^https?://#i', $ctaUrl)) {
        $safeUrl = $h($ctaUrl);
        $ctaBlock = <<<HTML
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 22px;">
        <tr>
          <td align="center" bgcolor="#1e3a5f" style="background:#1e3a5f;border:2px solid #161814;">
            <a href="{$safeUrl}" style="display:inline-block;padding:14px 22px;font-family:'Courier New',Courier,monospace;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;color:#d9cb9e;font-weight:700;">{$ctaLabel}</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 18px;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.5;color:#7b8070;word-break:break-all;">
        Or paste this address into your browser:<br>
        <a href="{$safeUrl}" style="color:#1e3a5f;text-decoration:underline;">{$safeUrl}</a>
      </p>
HTML;
    }

    return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>{$title}</title>
</head>
<body style="margin:0;padding:0;background:#b9ad86;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    {$kicker} · {$title}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#b9ad86;background-image:radial-gradient(circle at 10px 12px,#1e3a5f 1.6px,transparent 1.8px);background-size:28px 20px;background-repeat:repeat-x;background-position:0 0;">
    <tr>
      <td align="center" style="padding:28px 14px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border-collapse:collapse;">
          <tr>
            <td align="left" style="padding:0 0 10px;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#c41e3a;">
              <a href="https://timetravellersguild.com/" style="color:#c41e3a;text-decoration:none;">TIMETRAVELLERSGUILD.COM</a>
            </td>
          </tr>
          <tr>
            <td bgcolor="#d9cb9e" style="background:#d9cb9e;background:linear-gradient(180deg,#e2d4ab 0%,#d9cb9e 42%,#cfc19a 100%);border:2px solid #1e3a5f;box-shadow:8px 12px 0 rgba(22,24,20,0.14);">
              <!-- scarlet punch-card head -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#c41e3a" style="background:#c41e3a;padding:10px 18px;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#f4e8c8;border-bottom:2px solid #161814;">
                    IBM 5081 · FIELD SLIP · MAGIC LINK
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 26px 30px;">
                    <p style="margin:0 0 8px;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7b8070;">{$kicker}</p>
                    <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:0.02em;color:#161814;">{$title}</h1>
                    {$ledeHtml}
                    {$bodyHtml}
                    {$ctaBlock}
                    <p style="margin:0 0 10px;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.5;color:#3a3d34;">{$fine}</p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.5;font-style:italic;color:#7b8070;">{$foot}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 26px 22px;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#7b8070;border-top:1px solid rgba(30,58,95,0.25);padding-top:14px;">
                    THE TIME TRAVELLERS GUILD · A PROGRAMME, NOT A DESTINATION
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 8px 0;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5c5748;">
              <a href="https://timetravellersguild.com/" style="color:#1e3a5f;text-decoration:none;">HOME</a>
              &nbsp;·&nbsp;
              <a href="https://timetravellersguild.com/now" style="color:#1e3a5f;text-decoration:none;">NOW</a>
              &nbsp;·&nbsp;
              <a href="https://timetravellersguild.com/auction" style="color:#1e3a5f;text-decoration:none;">AUCTION</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
HTML;
}

function ttg_send_magic_link(string $email, string $link): bool {
    $config = ttg_config();
    $subject = (string) $config['mail_subject'];
    $text = "THE TIME TRAVELLERS GUILD — MAGIC LINK\n\n"
          . "Use this one-time link to enter the register:\n\n"
          . $link . "\n\n"
          . "The link expires in 20 minutes and can only be used once.\n"
          . "If you did not request this, ignore this email.\n\n"
          . "https://timetravellersguild.com/\n";
    $html = ttg_parchment_html([
        'kicker' => 'REGISTER · ZIPLOCK',
        'title' => 'Enter the Guild',
        'lede' => 'No password. A single-use slip is punched for your address alone.',
        'cta_label' => 'OPEN THE REGISTER',
        'cta_url' => $link,
        'fine' => 'This link expires in twenty minutes and can only be used once.',
        'foot' => 'If you did not request this, ignore this slip. The Guild keeps no password.',
    ]);
    return ttg_send_mail($email, $subject, $text, ['html' => $html]);
}
