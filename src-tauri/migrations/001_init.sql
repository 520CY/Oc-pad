CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    opencode_config TEXT NOT NULL,
    ohmyoc_enabled INTEGER DEFAULT 0,
    ohmyoc_config TEXT DEFAULT '',
    target_path TEXT DEFAULT '',
    stats_enabled INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_activated_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    activated_at TEXT NOT NULL,
    deactivated_at TEXT,
    target_path TEXT NOT NULL
);
