/**
 * Email 管理 API — 邮件归档查询与管理
 *
 * 所有响应统一为 { code, data, msg } 格式。
 */

import type { Env } from "../types";
import { respond } from "../utils/response";

// ── 邮件列表 ──

export async function handleList(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;
  const direction = url.searchParams.get("direction"); // "in" | "out" | null

  console.log("查询邮件列表", { module: "email", action: "list", page, pageSize, direction });

  try {
    let total: { count: number } | null;
    let list: { results: unknown[] };

    if (direction === "in" || direction === "out") {
      total = await env.DB
        .prepare("SELECT COUNT(*) AS count FROM emails WHERE direction = ?")
        .bind(direction)
        .first<{ count: number }>();

      list = await env.DB
        .prepare(
          `SELECT id, message_id, from_addr, to_addr, forward_to, subject, text_body, created_at, from_name, to_name, direction
           FROM emails WHERE direction = ?
           ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(direction, pageSize, offset)
        .all();
    } else {
      total = await env.DB
        .prepare("SELECT COUNT(*) AS count FROM emails")
        .first<{ count: number }>();

      list = await env.DB
        .prepare(
          `SELECT id, message_id, from_addr, to_addr, forward_to, subject, text_body, created_at, from_name, to_name, direction
           FROM emails
           ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(pageSize, offset)
        .all();
    }

    return respond(
      {
        list: list.results,
        total: total?.count ?? 0,
        page,
        pageSize,
      },
      "ok",
      1,
      origin,
    );
  } catch (err) {
    return respond(null, `查询失败: ${err}`, 0, origin);
  }
}

// ── 邮件详情 ──

export async function handleDetail(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const id = parseInt(url.searchParams.get("id") || "", 10);
  if (!id) {
    return respond(null, "缺少参数 id", 0, origin);
  }

  console.log("查询邮件详情", { module: "email", action: "detail", id });

  try {
    const row = await env.DB
      .prepare("SELECT * FROM emails WHERE id = ?")
      .bind(id)
      .first();

    if (!row) {
      return respond(null, "邮件不存在", 0, origin);
    }

    return respond(row, "ok", 1, origin);
  } catch (err) {
    return respond(null, `查询失败: ${err}`, 0, origin);
  }
}

// ── 删除邮件 ──

export async function handleDelete(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const id = parseInt(url.searchParams.get("id") || "", 10);
  if (!id) {
    return respond(null, "缺少参数 id", 0, origin);
  }

  console.log("删除邮件", { module: "email", action: "delete", id });

  try {
    const result = await env.DB
      .prepare("DELETE FROM emails WHERE id = ?")
      .bind(id)
      .run();

    if (result.meta.changes === 0) {
      return respond(null, "邮件不存在", 0, origin);
    }

    return respond(null, "已删除", 1, origin);
  } catch (err) {
    return respond(null, `删除失败: ${err}`, 0, origin);
  }
}

// ── 查看转发目标 ──

export async function handleGetForward(
  _request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  return respond({ address: env.FORWARD_EMAIL || "" }, "ok", 1, origin);
}
