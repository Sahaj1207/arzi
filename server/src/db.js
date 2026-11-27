// SQLite database (one file in DATA_DIR). Creates tables on first start.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(path.join(config.dataDir, 'recordings'), { recursive: true });
fs.mkdirSync(path.join(config.dataDir, 'pdfs'), { recursive: true });

export const db = new Database(path.join(config.dataDir, 'arzi.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,              -- anonymous ID from the browser
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    kind        TEXT NOT NULL DEFAULT 'deposit_notice',
    language    TEXT NOT NULL,                 -- hi | mr | en
    status      TEXT NOT NULL,                 -- pending_review | changes_requested | approved | consented
    transcript  TEXT NOT NULL DEFAULT '',      -- everything the citizen said
    fields_json TEXT NOT NULL DEFAULT '{}',    -- the 7 collected fields
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS versions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id  TEXT NOT NULL REFERENCES documents(id),
    version_no   INTEGER NOT NULL,
    notice_text  TEXT NOT NULL,                -- formal English notice
    summary_text TEXT NOT NULL,                -- plain-language summary in user's language
    author       TEXT NOT NULL,                -- system | advocate
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (document_id, version_no)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL REFERENCES documents(id),
    action      TEXT NOT NULL,                 -- approve | request_changes
    note        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS consents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL REFERENCES documents(id),
    version_id  INTEGER NOT NULL REFERENCES versions(id),
    audio_path  TEXT NOT NULL,                 -- relative to DATA_DIR
    transcript  TEXT NOT NULL DEFAULT '',
    method      TEXT NOT NULL DEFAULT 'voice', -- voice | button (mic fallback)
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usage (
    subject     TEXT NOT NULL,                 -- 'user:<id>' or 'ip:<addr>'
    day         TEXT NOT NULL,                 -- YYYY-MM-DD
    count       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (subject, day)
  );
`);
