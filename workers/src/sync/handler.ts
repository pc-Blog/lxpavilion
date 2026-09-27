/**
 * 数据同步接口 — 供 Java 后端拉取 D1 数据做备份归档
 *
 * 所有接口都返回整表数据，后端每次清空镜像表后全量覆盖，因此不接受 since 之类的增量参数：
 *   GET /api/sync/users        — 用户
 *   GET /api/sync/views        — 文章浏览数
 *   GET /api/sync/emails       — 邮件归档
 *   GET /api/sync/subscribers  — 订阅者
 *   GET /api/sync/comments     — 评论
 *   GET /api/sync/reactions    — 评论反应
 *   GET /api/sync/upvotes      — 评论点赞
 *   GET /api/sync/push-logs    — 推送记录
 */

import type { Env } from "../types";
import { respond } from "../utils/response";

/** 整表查询，按时间字段升序返回 */
async function selectAll(
  db: D1Database,
  table: string,
  timeField: string,
): Promise<unknown[]> {
  const { results } = await db.prepare(
    `SELECT * FROM ${table} ORDER BY ${timeField} ASC`,
  ).all();
  return results;
}

export async function handleSync(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);

  // ── GET /api/sync/users ──
  if (url.pathname === "/api/sync/users") {
    return respond(await selectAll(env.DB, "user", "update_time"), "ok", 1, origin);
  }

  // ── GET /api/sync/views ──
  if (url.pathname === "/api/sync/views") {
    return respond(await selectAll(env.DB, "article_view", "updated_at"), "ok", 1, origin);
  }

  // ── GET /api/sync/emails ──
  if (url.pathname === "/api/sync/emails") {
    return respond(await selectAll(env.DB, "emails", "created_at"), "ok", 1, origin);
  }

  // ── GET /api/sync/subscribers ──
  if (url.pathname === "/api/sync/subscribers") {
    return respond(await selectAll(env.DB, "subscribers", "created_at"), "ok", 1, origin);
  }

  // ── GET /api/sync/comments ──
  if (url.pathname === "/api/sync/comments") {
    return respond(await selectAll(env.DB, "comment", "create_time"), "ok", 1, origin);
  }

  // ── GET /api/sync/reactions ──
  if (url.pathname === "/api/sync/reactions") {
    return respond(await selectAll(env.DB, "comment_reaction", "created_at"), "ok", 1, origin);
  }

  // ── GET /api/sync/upvotes ──
  if (url.pathname === "/api/sync/upvotes") {
    return respond(await selectAll(env.DB, "comment_upvote", "created_at"), "ok", 1, origin);
  }

  // ── GET /api/sync/push-logs ──
  if (url.pathname === "/api/sync/push-logs") {
    return respond(await selectAll(env.DB, "push_logs", "pushed_at"), "ok", 1, origin);
  }

  return respond(null, "Not Found", 0, origin);
}
