PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS push_clients (
  client_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS push_schedule (
  client_id TEXT NOT NULL REFERENCES push_clients(client_id) ON DELETE CASCADE,
  notice_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  next_attempt_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, notice_key)
);

CREATE INDEX IF NOT EXISTS push_schedule_due ON push_schedule(next_attempt_at);
