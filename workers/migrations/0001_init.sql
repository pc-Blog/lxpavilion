-- Migration number: 0001   2026-06-27T06:52:14.561Z
--
-- 全量初始化 — 所有业务表
-- 他人部署时仅需运行此迁移即可获得完整数据库结构

-- ── 用户 ──

CREATE TABLE IF NOT EXISTS user (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  username            TEXT UNIQUE NOT NULL,
  password            TEXT NOT NULL,
  nickname            TEXT,
  github_id           TEXT,
  deleted             INTEGER DEFAULT 0,
  create_time         TEXT DEFAULT (datetime('now')),
  update_time         TEXT DEFAULT (datetime('now')),
  avatar              TEXT,
  github_token        TEXT,
  github_refresh_token TEXT,
  github_token_expires_at TEXT
);

-- ── 浏览数 ──

CREATE TABLE IF NOT EXISTS article_view (
  article_id INTEGER PRIMARY KEY,
  views      INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── 评论反应 ──

CREATE TABLE IF NOT EXISTS comment_reaction (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id TEXT NOT NULL,
  user_id    INTEGER NOT NULL,
  reaction   TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subject_id, user_id, reaction)
);

-- ── 评论点赞 ──

CREATE TABLE IF NOT EXISTS comment_upvote (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id TEXT NOT NULL,
  user_id    INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subject_id, user_id)
);

-- ── 邮件归档 ──

CREATE TABLE IF NOT EXISTS emails (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id  TEXT NOT NULL,
  from_addr   TEXT NOT NULL,
  to_addr     TEXT NOT NULL,
  forward_to  TEXT NOT NULL DEFAULT '',
  subject     TEXT DEFAULT '',
  text_body   TEXT DEFAULT '',
  html_body   TEXT DEFAULT '',
  headers     TEXT DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);

-- ── 系统设置 ──

-- ── 系统设置（已废弃）
-- forward_email → 环境变量 FORWARD_EMAIL

-- ── 邮件订阅者 ──

CREATE TABLE IF NOT EXISTS subscribers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL,
  group_name    TEXT NOT NULL DEFAULT 'article',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, group_name)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);

-- ── RSS 推送记录 ──

CREATE TABLE IF NOT EXISTS push_logs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pushed_at        TEXT NOT NULL DEFAULT (datetime('now')),
  article_count    INTEGER NOT NULL DEFAULT 0,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  group_name       TEXT NOT NULL DEFAULT 'article',
  status           TEXT NOT NULL DEFAULT 'success',
  error_msg        TEXT,
  articles_end_date TEXT,
  article_ids      TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_push_logs_pushed_at ON push_logs(pushed_at);
