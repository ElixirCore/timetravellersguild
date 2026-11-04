<?php
declare(strict_types=1);

/** House visitor counter. Hits land on https://ffilm.org/visitors/ */
const TTG_VISIT_JS = 'https://ffilm.org/visitors/visit.js';

function ttg_html_visit_tracker(): string
{
    static $sent = false;
    if ($sent) {
        return '';
    }
    $sent = true;
    return '<script src="' . TTG_VISIT_JS . '" defer></script>' . "\n";
}

function ttg_visit_tracker_filter(string $html): string
{
    if ($html === '' || str_contains($html, 'ffilm.org/visitors/visit.js')) {
        return $html;
    }
    if (!preg_match('/<\\/body>/i', $html)) {
        return $html;
    }
    $lead = ltrim($html);
    if ($lead !== '' && ($lead[0] === '{' || $lead[0] === '[')) {
        return $html;
    }
    $out = preg_replace(
        '/<\\/body>/i',
        '<script src="' . TTG_VISIT_JS . '" defer></script>' . "\n</body>",
        $html,
        1
    );
    return is_string($out) ? $out : $html;
}

function ttg_visit_tracker_attach(): void
{
    static $on = false;
    if ($on || PHP_SAPI === 'cli') {
        return;
    }
    $on = true;
    ob_start('ttg_visit_tracker_filter');
}

ttg_visit_tracker_attach();

require_once __DIR__ . '/og.php';
