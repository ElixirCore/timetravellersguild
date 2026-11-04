<?php
declare(strict_types=1);

final class JackMode
{
    public static function select(array $viewer, array $relationship, string $message, array $flags = []): string
    {
        $ql = mb_strtolower($message);
        if (!empty($flags['incident']) || self::looksLikeIncident($ql)) {
            return 'incident';
        }
        if (!empty($flags['contested']) || self::looksContested($ql)) {
            return 'contested_record';
        }
        if (!empty($flags['private']) || self::looksPrivate($ql)) {
            return 'private_holding';
        }

        if (!empty($flags['bartime'])) {
            return 'bartime';
        }

        $standing = (string) ($relationship['standing'] ?? 'unknown');
        $known = !empty($viewer['known']) || in_array($standing, ['returning_visitor', 'witness', 'contributor', 'applicant', 'keeper'], true);
        $hour = (int) ($flags['hour'] ?? (int) date('G'));
        $late = $hour >= 22 || $hour < 6;
        $clerical = self::looksClerical($ql);

        if ($known && ($clerical || !$late)) {
            return 'clerk';
        }
        if ($known && $late) {
            return 'after_hours';
        }
        return 'reception';
    }

    public static function looksLikeIncident(string $ql): bool
    {
        return (bool) preg_match('/\b(unauthori[sz]ed|data loss|breach|revoke|withdraw (consent|memory)|delete (me|my memory)|safety)\b/', $ql);
    }

    public static function looksContested(string $ql): bool
    {
        return (bool) preg_match('/\b(conflict|contradict|two accounts|disagree|dispute|versus|can\'t both)\b/', $ql);
    }

    public static function looksPrivate(string $ql): bool
    {
        return (bool) preg_match('/\b(private|don\'t (tell|record|lodge|put this)|between us|not for the (tree|field|guild)|hold this)\b/', $ql);
    }

    public static function looksClerical(string $ql): bool
    {
        return (bool) preg_match('/\b(dossier|classif|record|lodge|canon|field|slug|pending|retrieve|search|who is|where is|what is)\b/', $ql);
    }
}
