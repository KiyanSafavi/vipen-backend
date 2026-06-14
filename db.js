const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'vipen.db'));

// فعال‌سازی WAL mode برای performance بهتر
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// -------- ساخت جدول‌ها --------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS channels (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    cover_url   TEXT DEFAULT '',
    owner_id    TEXT NOT NULL,
    created_at  INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS songs (
    id          TEXT PRIMARY KEY,
    channel_id  TEXT NOT NULL,
    title       TEXT NOT NULL,
    artist      TEXT DEFAULT '',
    url         TEXT NOT NULL,
    duration    INTEGER DEFAULT 0,
    order_idx   INTEGER DEFAULT 0,
    added_at    INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS channel_members (
    channel_id TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    role       TEXT DEFAULT 'member',
    joined_at  INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
  );
`);

module.exports = db;