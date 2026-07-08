import { respond } from "../utils/response";
import type { Env } from "../types";

// ── 欢迎邮件模板 ──

import welcomeArticleTpl from "./welcome-article.html";
import welcomeHotTpl from "./welcome-hot.html";

// ── 管理员通知模板 ──

import adminTpl from "./admin-notification.html";

const GROUP_MAP: Record<string, { label: string; tpl: string }> = {
  article: { label: "文章推送", tpl: welcomeArticleTpl },
  "hot-topics": { label: "技术热点", tpl: welcomeHotTpl },
};

// ── Resend 发送辅助 ──

async function sendViaResend(
  env: Env,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const fromName = env.EMAIL_FROM_NAME || "ppc";
  const fromAddr = env.EMAIL_FROM_ADDRESS || "mail@lxpavilion.top";

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
      console.error("Resend 发送失败", { module: "subscribe", action: "resend_error", to, subject, error: err });
    }
  } catch (e) {
    console.error("Resend 请求异常", { module: "subscribe", action: "resend_exception", to, subject, error: String(e) });
  }
}

// ── 发送欢迎邮件 ──

async function sendWelcomeEmail(env: Env, email: string, group: string): Promise<void> {
  const config = GROUP_MAP[group];
  if (!config) return;

  const unsubUrl = `https://api.lxpavilion.top/api/unsubscribe?email=${encodeURIComponent(email)}&group=${group}`;
  const html = config.tpl
    .replace(/\{\$email\}/g, email)
    .replace(/\{\$viewemail\}/g, "https://www.lxpavilion.top")
    .replace(/\{\$unsubscribe\}/g, unsubUrl);

  await sendViaResend(env, email, `欢迎订阅 LXPavilion — ${config.label}`, html);
}

// ── 发送管理员通知 ──

async function sendAdminNotification(
  env: Env,
  email: string,
  groupLabel: string,
  groupName: string,
): Promise<void> {
  try {
    const { results } = await env.DB
      .prepare("SELECT COUNT(*) as count FROM subscribers WHERE group_name = ?")
      .bind(groupName)
      .all<{ count: number }>();
    const total = results?.[0]?.count ?? 0;

    const now = new Date();
    const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const html = adminTpl
      .replace(/\{\{EMAIL\}\}/g, email)
      .replace(/\{\{SERVICE\}\}/g, `${groupLabel}（${groupName}）`)
      .replace(/\{\{TIME\}\}/g, time)
      .replace(/\{\{TOTAL_SUBSCRIBERS\}\}/g, String(total));

    await sendViaResend(env, "msg@lxpavilion.top", "栏轩阁 - 新订阅通知", html);
  } catch (e) {
    console.error("管理员通知异常", { module: "subscribe", action: "admin_notify_error", error: String(e) });
  }
}

// ── 主入口 ──

export async function handleSubscribe(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  let body: { email?: string; group?: string };
  try {
    body = await request.json();
  } catch {
    return respond(null, "请求体必须是 JSON", 0, origin);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(null, "请输入有效的邮箱地址", 0, origin);
  }

  const group = body.group?.trim().toLowerCase() || "article";
  const groupConfig = GROUP_MAP[group];
  if (!groupConfig) {
    return respond(null, `不支持的订阅类型：${group}`, 0, origin);
  }

  console.log("订阅请求", { module: "subscribe", action: "request", email, group });

  try {
    // 1. 检查是否已订阅
    const existing = await env.DB
      .prepare("SELECT id FROM subscribers WHERE email = ? AND group_name = ?")
      .bind(email, group)
      .all();

    if (existing.results && existing.results.length > 0) {
      return respond({ email, group }, "您已订阅，无需重复订阅", 1, origin);
    }

    // 2. 写入 D1
    await env.DB.prepare(
      "INSERT INTO subscribers (email, group_name) VALUES (?, ?)",
    ).bind(email, group).run();

    // 3. 发送欢迎邮件（不阻断主流程）
    await sendWelcomeEmail(env, email, group);

    // 4. 给管理员发通知（不阻断主流程）
    await sendAdminNotification(env, email, groupConfig.label, group);

    return respond({ email, group }, "订阅成功 🎉 欢迎加入！", 1, origin);
  } catch (e) {
    console.error("订阅异常", { module: "subscribe", action: "handler_error", email, error: String(e) });
    return respond(null, "订阅失败，请稍后重试", 0, origin);
  }
}
