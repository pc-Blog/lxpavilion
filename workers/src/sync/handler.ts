/**
 * 数据同步接口 — 供 Java 后端定时拉取 D1 数据做备份归档
 *
 * 所有接口：
 *   GET /api/sync/users?since=ISO     — 用户
 *   GET /api/sync/views               — 文章浏览数（全量）
 *   GET /api/sync/emails?since=ISO    — 邮件归档
 *   GET /api/sync/subscribers?since=  — 订阅者
 *   GET /api/sync/reactions?since=    — 评论反应
 *   GET /api/sync/upvotes?since=      — 评论点赞
 *   GET /api/sync/push-logs?since=    — 推送记录
 *
 * 参数：
 *   since — ISO 时间字符串（可选），不传则返回全量数据
 */

import type { Env } from "../types";
import { respond } from "../utils/response";

function getSince(url: URL): string | null {
  const s = url.searchParams.get("since");
  return s && s.length > 0 ? s : null;
}

/** 通用查询：按时间字段增量查询 */
async function querySince(
  db: D1Database,
  table: string,
  timeField: string,
  since: string | null,
  orderBy = "ASC",
): Promise<unknown[]> {
  if (since) {
    const stmt = db.prepare(
      `SELECT * FROM ${table} WHERE ${timeField} >= ? ORDER BY ${timeField} ${orderBy}`,
    );
    const { results } = await stmt.bind(since).all();
    return results;
  }
  const { results } = await db.prepare(
    `SELECT * FROM ${table} ORDER BY ${timeField} ${orderBy}`,
  ).all();
  return results;
}

export async function handleSync(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const since = getSince(url);

  // ── GET /api/sync/users ──
  if (url.pathname === "/api/sync/users") {
    const rows = await querySince(env.DB, "user", "update_time", since);
    return respond(rows, "ok", 1, origin);
  }

  // ── GET /api/sync/views（全量，数据量小）──
  if (url.pathname === "/api/sync/views") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM article_view ORDER BY updated_at ASC",
    ).all();
    return respond(results, "ok", 1, origin);
  }

  // ── GET /api/sync/emails ──
  if (url.pathname === "/api/sync/emails") {
    const rows = await querySince(env.DB, "emails", "created_at", since);
    return respond(rows, "ok", 1, origin);
  }

  // ── GET /api/sync/subscribers ──
  if (url.pathname === "/api/sync/subscribers") {
    const rows = await querySince(env.DB, "subscribers", "created_at", since);
    return respond(rows, "ok", 1, origin);
  }

  // ── GET /api/sync/reactions ──
  if (url.pathname === "/api/sync/reactions") {
    const rows = await querySince(env.DB, "comment_reaction", "created_at", since);
    return respond(rows, "ok", 1, origin);
  }

  // ── GET /api/sync/upvotes ──
  if (url.pathname === "/api/sync/upvotes") {
    const rows = await querySince(env.DB, "comment_upvote", "created_at", since);
    return respond(rows, "ok", 1, origin);
  }

  // ── GET /api/sync/push-logs ──
  if (url.pathname === "/api/sync/push-logs") {
    const rows = await querySince(env.DB, "push_logs", "pushed_at", since);
    return respond(rows, "ok", 1, origin);
  }

  return respond(null, "Not Found", 0, origin);
}
