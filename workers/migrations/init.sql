-- 全量初始化 — 所有业务表
-- 他人部署时仅需运行此文件即可获得完整数据库结构
--
-- 用法：
--   线上：npx wrangler d1 execute blog-database --remote --file=migrations/init.sql
--   本地：npx wrangler d1 execute blog-database --local  --file=migrations/init.sql
--
-- 注意：所有语句均为 CREATE TABLE IF NOT EXISTS，对已存在的表不做改动。
--       因此本文件只保证「新部署得到正确结构」，线上结构的变更需另行手动执行。

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
  email               TEXT,
  login_time          TEXT,
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

-- ── 评论 ──
--   path      评论挂载位置（如 /article/12、wishes、chatter-88）
--   parent_id 回复指向的父评论 id，顶层评论为 NULL
--   user_id   作者；游客也是 user 表里的一行（username 为随机占位码），归属判断只看此列
--   deleted   0 正常 / 1 已删除
--   content   评论正文（Markdown 原文）

CREATE TABLE IF NOT EXISTS comment (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  path         TEXT NOT NULL,
  parent_id    INTEGER,
  user_id      INTEGER NOT NULL,
  content      TEXT NOT NULL,
  deleted      INTEGER NOT NULL DEFAULT 0,
  create_time  TEXT NOT NULL DEFAULT (datetime('now')),
  update_time  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comment_path   ON comment(path, create_time);
CREATE INDEX IF NOT EXISTS idx_comment_parent ON comment(parent_id);
CREATE INDEX IF NOT EXISTS idx_comment_user   ON comment(user_id);

-- ── 评论反应 ──
--   subject_id 指向 comment.id

CREATE TABLE IF NOT EXISTS comment_reaction (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  reaction   TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subject_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_reaction_subject ON comment_reaction(subject_id);

-- ── 评论点赞 ──

CREATE TABLE IF NOT EXISTS comment_upvote (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(subject_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_upvote_subject ON comment_upvote(subject_id);

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
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  from_name   TEXT NOT NULL DEFAULT '',
  to_name     TEXT NOT NULL DEFAULT '',
  direction   TEXT NOT NULL DEFAULT 'in'
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
