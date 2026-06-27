-- Migration number: 0001 	 2026-06-27T06:52:14.561Z

CREATE TABLE IF NOT EXISTS comment_reaction (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  reaction TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subject_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS comment_upvote (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subject_id, user_id)
);

-- github_token / github_refresh_token / github_token_expires_at 已手动添加
