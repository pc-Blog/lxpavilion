/**
 * 自定义退订处理
 *
 * GET  /api/unsubscribe?email=xxx&group=xxx  → 展示确认页
 * POST /api/unsubscribe                      → 执行退订
 */

import type { Env } from "../types";
import { respond } from "../utils/response";
import tpl from "./unsubscribe.html";
import notifyTpl from "./unsubscribe-notification.html";

const GROUP_MAP: Record<string, string> = {
  article: "文章推送",
  "hot-topics": "技术热点",
};

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderUnsubscribePage(email: string, group: string, groupLabel: string): string {
  return tpl
    .replace(/\{\{EMAIL\}\}/g, escHtml(email))
    .replace(/\{\{GROUP_LABEL\}\}/g, escHtml(groupLabel))
    .replace(/\{\{EMAIL_JSON\}\}/g, JSON.stringify(email))
    .replace(/\{\{GROUP_JSON\}\}/g, JSON.stringify(group));
}

// ── Resend 发送辅助 ──

async function sendViaResend(
  env: Env,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const fromName = env.EMAIL_FROM_NAME || "ppc";
  const fromAddr = env.NOTIFY_FROM_ADDRESS;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddr}>`,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Resend 发送失败", { module: "subscribe", action: "unsubscribe_resend_error", error: err });
    }
  } catch (e) {
    console.error("Resend 请求异常", { module: "subscribe", action: "unsubscribe_resend_exception", error: String(e) });
  }
}

export async function handleUnsubscribe(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  console.log("退订请求", { module: "subscribe", action: "unsubscribe", method });

  if (method === "GET") {
    const email = url.searchParams.get("email")?.trim().toLowerCase() || "";
    const group = url.searchParams.get("group")?.trim().toLowerCase() || "article";
    const groupLabel = GROUP_MAP[group] || group;

    if (!email) {
      return new Response("缺少 email 参数", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const html = renderUnsubscribePage(email, group, groupLabel);
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (request.method === "POST") {
    let body: { email?: string; group?: string };
    try {
      body = await request.json();
    } catch {
      return respond(null, "请求体必须是 JSON", 0, origin);
    }

    const email = body.email?.trim().toLowerCase() || "";
    const group = body.group?.trim().toLowerCase() || "article";

    if (!email) {
      return respond(null, "缺少 email", 0, origin);
    }

    try {
      // 1. 查 D1 是否有这条订阅
      const existing = await env.DB
        .prepare("SELECT id FROM subscribers WHERE email = ? AND group_name = ?")
        .bind(email, group)
        .all();

      const existsInD1 = existing.results && existing.results.length > 0;

      if (!existsInD1) {
        return respond(null, "该邮箱未订阅，无法退订", 0, origin);
      }

      // 2. 从 D1 删除
      await env.DB
        .prepare("DELETE FROM subscribers WHERE email = ? AND group_name = ?")
        .bind(email, group)
        .run();

      // 3. 给管理员发通知（不阻断主流程）
      try {
        const { results } = await env.DB
          .prepare("SELECT COUNT(*) as count FROM subscribers WHERE group_name = ?")
          .bind(group)
          .all<{ count: number }>();
        const total = results?.[0]?.count ?? 0;

        const now = new Date();
        const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const groupLabel = GROUP_MAP[group] || group;

        const html = notifyTpl
          .replace(/\{\{EMAIL\}\}/g, escHtml(email))
          .replace(/\{\{SERVICE\}\}/g, groupLabel)
          .replace(/\{\{TIME\}\}/g, time)
          .replace(/\{\{TOTAL_SUBSCRIBERS\}\}/g, String(total));

        await sendViaResend(env, env.NOTIFY_TO_ADDRESS, "栏轩阁 - 退订通知", html);
      } catch (e) {
        console.error("退订通知异常", { module: "subscribe", action: "unsubscribe_notify_error", email, error: String(e) });
      }

      return respond({ email, group }, "退订成功", 1, origin);
    } catch (e) {
      console.error("退订异常", { module: "subscribe", action: "unsubscribe_handler_error", email, error: String(e) });
      return respond(null, "退订失败，请稍后重试", 0, origin);
    }
  }

  return respond(null, "Method Not Allowed", 0, origin);
}
