<?php
declare(strict_types=1);

/** Asset identifiers only: never put the exposed address or captions here. */
final class WithdrawnMedia
{
    public const FILENAMES = [
        '20260907-220544-147e0f3ea5.jpg',
        '20260907-220503-d5b1f49c93.jpg',
        '20260907-220533-95f371bb60.jpg',
    ];

    public static function contains(string $filename): bool
    {
        return in_array(strtolower($filename), self::FILENAMES, true);
    }

    /** Remove public analysis and its history as well as the feed entries. */
    public static function purge(PDO $pdo): void
    {
        $pdo->exec('PRAGMA secure_delete = ON');
        $marks = implode(',', array_fill(0, count(self::FILENAMES), '?'));
        $pdo->beginTransaction();
        try {
            foreach (['events', 'revisions'] as $table) {
                $stmt = $pdo->prepare("DELETE FROM $table WHERE image_id IN (SELECT id FROM images WHERE filename IN ($marks))");
                $stmt->execute(self::FILENAMES);
            }
            $stmt = $pdo->prepare("DELETE FROM images WHERE filename IN ($marks)");
            $stmt->execute(self::FILENAMES);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
