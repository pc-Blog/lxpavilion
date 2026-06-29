/**
 * 订阅管理 API — 验证 & 删除
 *
 * MailerLite API v3 参考:
 *   GET    /api/subscribers?limit=100&cursor=...   — 列出订阅者（游标分页）
 *   GET    /api/subscribers/{email}                 — 按邮箱查找
 *   DELETE /api/subscribers/{id}                    — 删除订阅者（返回 204）
 *
 * 文档: https://developers.mailerlite.com/docs/subscribers.html
 */

import { respond } from "../utils/response";
import type { Env } from "../types";

// ── MailerLite API 响应类型 ──

interface MLSubscriber {
  id: string;
  email: string;
  status: string;
  subscribed_at: string;
}

interface MLListResponse {
  data: MLSubscriber[];
  meta: { next_cursor: string | null };
  links: { next: string | null };
}

// ── 获取 MailerLite 全部订阅者（自动遍历所有分页） ──

async function fetchAllMLSubscribers(apiKey: string): Promise<Map<string, { id: string; status: string; subscribed_at: string }>> {
  const subscribers = new Map<string, { id: string; status: string; subscribed_at: string }>();
  let cursor: string | null = null;

  do {
    const url = new URL("https://connect.mailerlite.com/api/subscribers");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`MailerLite list failed: ${resp.status} ${errText}`);
    }

    const result = await resp.json() as MLListResponse;
    for (const sub of result.data) {
      subscribers.set(sub.email, { id: sub.id, status: sub.status, subscribed_at: sub.subscribed_at });
    }

    cursor = result.meta?.next_cursor ?? null;
  } while (cursor);

  return subscribers;
}

// ── 从 MailerLite 删除单个订阅者（按邮箱查找 → 按 ID 删除） ──

async function deleteMLSubscriber(apiKey: string, email: string): Promise<{ success: boolean; error?: string }> {
  // 1. 按邮箱查找
  const lookupResp = await fetch(
    `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  if (lookupResp.status === 404) {
    // MailerLite 中不存在 → 视为已删除
    return { success: true };
  }

  if (!lookupResp.ok) {
    const errText = await lookupResp.text();
    return { success: false, error: `lookup failed: ${lookupResp.status} ${errText}` };
  }

  const subData = await lookupResp.json() as { data: { id: string } };
  const subscriberId = subData.data.id;

  // 2. 按 ID 删除
  const deleteResp = await fetch(
    `https://connect.mailerlite.com/api/subscribers/${subscriberId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  if (deleteResp.status !== 204) {
    const errText = await deleteResp.text();
    return { success: false, error: `delete failed: ${deleteResp.status} ${errText}` };
  }

  return { success: true };
}

// ══════════════════════════════════════════════════════════════
// 公开 Handler
// ══════════════════════════════════════════════════════════════

/**
 * 验证 D1 与 MailerLite 的订阅数据一致性
 *
 * GET /api/subscribe/verify
 *
 * 返回:
 *   - d1_total, mailerlite_total          — 两侧总数
 *   - matched                              — 一致的数量
 *   - only_in_d1                           — 仅在 D1 中的邮箱列表
 *   - only_in_mailerlite                   — 仅在 MailerLite 中的邮箱列表
 *   - is_consistent                        — 是否完全一致
 */
export async function handleVerifySubscribe(
  env: Env,
  origin: string | null,
): Promise<Response> {
  // 1. 获取 D1 所有订阅者
  const d1Result = await env.DB
    .prepare("SELECT email, created_at FROM subscribers WHERE group_name = 'article' ORDER BY email")
    .all<{ email: string; created_at: string }>();

  const d1Emails = new Map<string, string>();
  for (const row of d1Result.results || []) {
    d1Emails.set(row.email, row.created_at);
  }

  // 2. 获取 MailerLite 所有订阅者
  let mlEmails: Map<string, { id: string; status: string; subscribed_at: string }>;
  try {
    mlEmails = await fetchAllMLSubscribers(env.MAILERLITE_API_KEY);
  } catch (e) {
    return respond(null, `获取 MailerLite 订阅者失败: ${(e as Error).message}`, 0, origin);
  }

  // 3. 对比分析
  const onlyInD1: string[] = [];
  const onlyInML: { email: string; id: string; status: string }[] = [];
  let matched = 0;

  for (const [email] of d1Emails) {
    if (mlEmails.has(email)) {
      matched++;
    } else {
      onlyInD1.push(email);
    }
  }

  for (const [email, mlSub] of mlEmails) {
    if (!d1Emails.has(email)) {
      onlyInML.push({ email, id: mlSub.id, status: mlSub.status });
    }
  }

  return respond({
    d1_total: d1Emails.size,
    mailerlite_total: mlEmails.size,
    matched,
    only_in_d1: onlyInD1,
    only_in_mailerlite: onlyInML,
    only_in_d1_count: onlyInD1.length,
    only_in_mailerlite_count: onlyInML.length,
    is_consistent: onlyInD1.length === 0 && onlyInML.length === 0,
  }, "ok", 1, origin);
}

/**
 * 从 D1 和 MailerLite 同步删除订阅者
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
  let body: { email?: string; emails?: string[] };
  try {
    body = await request.json();
  } catch {
    return respond(null, "请求体必须是 JSON", 0, origin);
  }

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
    mailerlite_deleted: boolean;
    mailerlite_error?: string;
  }

  const results: DeleteResult[] = [];

  for (const email of emailsToDelete) {
    const result: DeleteResult = { email, d1_deleted: false, mailerlite_deleted: false };

    // 1. 从 D1 删除
    try {
      const d1Result = await env.DB
        .prepare("DELETE FROM subscribers WHERE email = ? AND group_name = 'article'")
        .bind(email)
        .run();
      result.d1_deleted = true; // D1 不会因为行不存在而报错
    } catch (e) {
      console.error(`[Delete] D1 error for ${email}:`, e);
    }

    // 2. 从 MailerLite 删除
    const mlResult = await deleteMLSubscriber(env.MAILERLITE_API_KEY, email);
    if (mlResult.success) {
      result.mailerlite_deleted = true;
    } else {
      result.mailerlite_error = mlResult.error;
    }

    results.push(result);
  }

  const summary = {
    total: results.length,
    fully_deleted: results.filter(r => r.d1_deleted && r.mailerlite_deleted).length,
    partial: results.filter(r => r.d1_deleted !== r.mailerlite_deleted).length,
    failed: results.filter(r => !r.d1_deleted && !r.mailerlite_deleted).length,
  };

  return respond({ results, summary }, "ok", 1, origin);
}
