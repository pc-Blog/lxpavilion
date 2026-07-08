/**
 * 订阅管理 API — 删除订阅
 *
 * 只依赖 D1，不再需要与 MailerLite 同步。
 */

import { respond } from "../utils/response";
import type { Env } from "../types";

/**
 * 从 D1 删除订阅者
 *
 * POST /api/subscribe/delete
 * Body: { email: string }           — 删除单个
 *       { emails: string[] }        — 批量删除
 *
 * 返回每条记录的操作结果及汇总统计。
 */
export async function handleDeleteSubscribe(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  let body: { email?: string; emails?: string[]; group?: string };
  try {
    body = await request.json();
  } catch {
    return respond(null, "请求体必须是 JSON", 0, origin);
  }

  const group = body.group?.trim().toLowerCase() || "article";

  // 收集待删除邮箱
  let emailsToDelete: string[];
  if (body.emails && Array.isArray(body.emails)) {
    emailsToDelete = body.emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean);
  } else if (body.email) {
    emailsToDelete = [body.email.trim().toLowerCase()];
  } else {
    return respond(null, "请提供 email 或 emails 参数", 0, origin);
  }

  if (emailsToDelete.length === 0) {
    return respond(null, "没有有效的邮箱地址", 0, origin);
  }

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of emailsToDelete) {
    if (!emailRegex.test(email)) {
      return respond(null, `无效的邮箱地址: ${email}`, 0, origin);
    }
  }

  interface DeleteResult {
    email: string;
    d1_deleted: boolean;
  }

  const results: DeleteResult[] = [];

  for (const email of emailsToDelete) {
    try {
      await env.DB
        .prepare("DELETE FROM subscribers WHERE email = ? AND group_name = ?")
        .bind(email, group)
        .run();
      results.push({ email, d1_deleted: true });
    } catch (e) {
      console.error(`删除失败: ${email}`, e);
      results.push({ email, d1_deleted: false });
    }
  }

  const summary = {
    group,
    total: results.length,
    deleted: results.filter(r => r.d1_deleted).length,
    failed: results.filter(r => !r.d1_deleted).length,
  };

  return respond({ results, summary }, "ok", 1, origin);
}
