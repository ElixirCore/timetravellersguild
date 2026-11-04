<?php
declare(strict_types=1);
require_once __DIR__ . '/functions.php';
require_once dirname(__DIR__, 2) . '/inc/briefing.php';

function ttg_db(): PDO {
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;

    $config = ttg_config();
    $pdo = new PDO('sqlite:' . $config['db_path'], null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    ttg_migrate($pdo);
    return $pdo;
}

function ttg_migrate(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            bio TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'traveller',
            avatar_url TEXT NOT NULL DEFAULT '',
            is_public INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS magic_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at INTEGER NOT NULL,
            used_at INTEGER,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_users_public ON users(is_public, display_name);
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    ");
    $have = [];
    foreach ($pdo->query('PRAGMA table_info(users)')->fetchAll() as $col) {
        $have[(string) ($col['name'] ?? '')] = true;
    }
    if (empty($have['avatar_pixels'])) {
        $pdo->exec("ALTER TABLE users ADD COLUMN avatar_pixels TEXT NOT NULL DEFAULT ''");
    }
    if (empty($have['briefing'])) {
        $pdo->exec("ALTER TABLE users ADD COLUMN briefing TEXT NOT NULL DEFAULT ''");
    }
    $linkCols = [];
    foreach ($pdo->query('PRAGMA table_info(magic_links)')->fetchAll() as $col) {
        $linkCols[(string) ($col['name'] ?? '')] = true;
    }
    if (empty($linkCols['briefing'])) {
        $pdo->exec("ALTER TABLE magic_links ADD COLUMN briefing TEXT NOT NULL DEFAULT ''");
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS knocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_id INTEGER NOT NULL,
            to_id INTEGER NOT NULL,
            message TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            read_at INTEGER,
            FOREIGN KEY(from_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(to_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_knocks_to ON knocks(to_id, created_at);
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS guide_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_guide_runs_user ON guide_runs(user_id, created_at);
    ");
    /* add run_id to guide_trail if the table pre-dates the runs feature — must run before the index below */
    $trailExists = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='guide_trail'")->fetchAll();
    if ($trailExists) {
        $trailCols = [];
        foreach ($pdo->query('PRAGMA table_info(guide_trail)')->fetchAll() as $col) {
            $trailCols[(string) ($col['name'] ?? '')] = true;
        }
        if (empty($trailCols['run_id'])) {
            $pdo->exec("ALTER TABLE guide_trail ADD COLUMN run_id INTEGER");
        }
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS guide_trail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            run_id INTEGER,
            label TEXT NOT NULL DEFAULT '',
            lng REAL NOT NULL,
            lat REAL NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            tree_slug TEXT NOT NULL DEFAULT '',
            tree_title TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(run_id) REFERENCES guide_runs(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_guide_trail_user ON guide_trail(user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_guide_trail_run ON guide_trail(run_id, created_at);
    ");
}

function ttg_user_by_slug(string $slug): ?array {
    $stmt = ttg_db()->prepare('SELECT * FROM users WHERE slug = ? AND is_public = 1 LIMIT 1');
    $stmt->execute([$slug]);
    $row = $stmt->fetch() ?: null;
    return ttg_user_hydrate($row);
}

function ttg_send_knock(int $fromId, int $toId, string $message): bool {
    if ($fromId === $toId) return false;
    $since = time() - 86400;
    $stmt = ttg_db()->prepare('SELECT COUNT(*) FROM knocks WHERE from_id = ? AND to_id = ? AND created_at >= ?');
    $stmt->execute([$fromId, $toId, $since]);
    if ((int)$stmt->fetchColumn() >= 1) return false; // one knock per day
    ttg_db()->prepare('INSERT INTO knocks(from_id, to_id, message, created_at) VALUES(?,?,?,?)')
        ->execute([$fromId, $toId, mb_substr(trim($message), 0, 160), time()]);
    return true;
}

function ttg_get_knocks(int $userId): array {
    $stmt = ttg_db()->prepare(
        'SELECT k.id, k.message, k.created_at, k.read_at,
                u.display_name AS from_name, u.slug AS from_slug
         FROM knocks k JOIN users u ON u.id = k.from_id
         WHERE k.to_id = ? ORDER BY k.created_at DESC LIMIT 40'
    );
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();
    // mark unread as read
    ttg_db()->prepare('UPDATE knocks SET read_at = ? WHERE to_id = ? AND read_at IS NULL')
        ->execute([time(), $userId]);
    return $rows;
}

function ttg_unread_knock_count(int $userId): int {
    $stmt = ttg_db()->prepare('SELECT COUNT(*) FROM knocks WHERE to_id = ? AND read_at IS NULL');
    $stmt->execute([$userId]);
    return (int)$stmt->fetchColumn();
}

function ttg_user_by_email(string $email): ?array {
    $stmt = ttg_db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $row = $stmt->fetch() ?: null;
    return ttg_user_hydrate($row);
}

function ttg_user_by_id(int $id): ?array {
    $stmt = ttg_db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch() ?: null;
    return ttg_user_hydrate($row);
}

function ttg_public_users(): array {
    $rows = ttg_db()->query('SELECT id, display_name, slug, bio, location, role, avatar_url, avatar_pixels FROM users WHERE is_public = 1 ORDER BY display_name COLLATE NOCASE')->fetchAll();
    $out = [];
    foreach ($rows as $row) {
        $hydrated = ttg_user_hydrate($row);
        if (is_array($hydrated)) {
            $out[] = $hydrated;
        }
    }
    return $out;
}

function ttg_user_keep_briefing(int $id, string $briefing): void {
    $briefing = trim($briefing);
    if ($id < 1 || $briefing === '') return;
    $stmt = ttg_db()->prepare('UPDATE users SET briefing = ? WHERE id = ? AND (briefing IS NULL OR briefing = \'\')');
    $stmt->execute([$briefing, $id]);
}

function ttg_ensure_user(string $email, string $briefing = ''): array {
    $user = ttg_user_by_email($email);
    if ($user) {
        if ($briefing !== '' && trim((string) ($user['briefing'] ?? '')) === '') {
            ttg_user_keep_briefing((int) $user['id'], $briefing);
            return ttg_user_by_id((int) $user['id']) ?? $user;
        }
        return $user;
    }

    $nameSeed = explode('@', $email)[0] ?: 'Traveller';
    $displayName = ucwords(str_replace(['.', '_', '-'], ' ', $nameSeed));
    $baseSlug = ttg_slug($displayName);
    $slug = $baseSlug;
    $counter = 2;
    while (ttg_slug_exists($slug)) $slug = $baseSlug . '-' . $counter++;

    $now = gmdate('c');
    $stmt = ttg_db()->prepare('INSERT INTO users(email, display_name, slug, briefing, created_at, updated_at) VALUES(?,?,?,?,?,?)');
    $stmt->execute([$email, $displayName, $slug, $briefing, $now, $now]);
    return ttg_user_by_id((int)ttg_db()->lastInsertId());
}

function ttg_slug_exists(string $slug): bool {
    $stmt = ttg_db()->prepare('SELECT 1 FROM users WHERE slug = ? LIMIT 1');
    $stmt->execute([$slug]);
    return (bool)$stmt->fetchColumn();
}

function ttg_create_magic_link(string $email): string {
    $config = ttg_config();
    $token = ttg_random_token(32);
    $hash = hash('sha256', $token);
    $expires = time() + (int)$config['magic_link_lifetime'];
    $briefing = ttg_briefing_json(ttg_briefing_read());
    $stmt = ttg_db()->prepare('INSERT INTO magic_links(email, token_hash, expires_at, created_at, briefing) VALUES(?,?,?,?,?)');
    $stmt->execute([$email, $hash, $expires, time(), $briefing]);
    return ttg_base('auth/consume.php?token=' . rawurlencode($token));
}

function ttg_consume_magic_link(string $token): ?array {
    $hash = hash('sha256', $token);
    $pdo = ttg_db();
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT * FROM magic_links WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ? LIMIT 1');
    $stmt->execute([$hash, time()]);
    $link = $stmt->fetch();
    if (!$link) {
        $pdo->rollBack();
        return null;
    }
    $pdo->prepare('UPDATE magic_links SET used_at = ? WHERE id = ?')->execute([time(), $link['id']]);
    $briefing = trim((string) ($link['briefing'] ?? ''));
    if ($briefing === '') $briefing = ttg_briefing_json(ttg_briefing_read());
    $user = ttg_ensure_user((string)$link['email'], $briefing);
    $pdo->commit();
    return $user;
}

function ttg_set_session(int $userId): void {
    $config = ttg_config();
    $token = ttg_random_token(32);
    $hash = hash('sha256', $token);
    $expires = time() + (int)$config['cookie_lifetime'];
    ttg_db()->prepare('INSERT INTO sessions(user_id, token_hash, expires_at, created_at) VALUES(?,?,?,?)')
        ->execute([$userId, $hash, $expires, time()]);
    setcookie((string)$config['cookie_name'], $token, [
        'expires' => $expires,
        'path' => '/',
        'secure' => ttg_cookie_secure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function ttg_current_user(): ?array {
    $config = ttg_config();
    $token = (string)($_COOKIE[$config['cookie_name']] ?? '');
    if ($token === '') return null;
    $hash = hash('sha256', $token);
    $stmt = ttg_db()->prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at >= ? LIMIT 1');
    $stmt->execute([$hash, time()]);
    $row = $stmt->fetch() ?: null;
    return ttg_user_hydrate($row);
}

function ttg_logout(): void {
    $config = ttg_config();
    $token = (string)($_COOKIE[$config['cookie_name']] ?? '');
    if ($token !== '') {
        ttg_db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    }
    setcookie((string)$config['cookie_name'], '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => ttg_cookie_secure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function ttg_handoff_url(array $user, string $targetKey): ?string {
    $config = ttg_config();
    $target = $config['handoff_targets'][$targetKey] ?? null;
    if (!is_array($target)) return null;
    $url = (string) ($target['url'] ?? '');
    if ($url === '') return null;
    // Plain door — receiver not installed (e.g. chronometer.online waitlist).
    if (($target['mode'] ?? 'handoff') === 'link') {
        return $url;
    }
    $now = time();
    $payload = [
        'iss' => 'timetravellersguild.com',
        'aud' => $target['audience'],
        'sub' => (string)$user['id'],
        'email' => $user['email'],
        'name' => $user['display_name'],
        'slug' => $user['slug'],
        'iat' => $now,
        'exp' => $now + (int)$config['handoff_lifetime'],
        'nonce' => ttg_random_token(12),
    ];
    return $url . '?token=' . rawurlencode(ttg_sign($payload));
}
