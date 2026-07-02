import { respond } from "../utils/response";
import type { Env } from "../types";

const MAILERLITE_GROUP_ID = "191576374630155327";
const HOT_MAILERLITE_GROUP_ID = "191576388726163183";
const ADMIN_GROUP_ID = "191757744228795902";

const FROM_EMAIL = "notify@lxpavilion.top";
const FROM_NAME = "ppc";

const GROUP_MAP: Record<string, { mailerliteId: string; label: string }> = {
  article: { mailerliteId: MAILERLITE_GROUP_ID, label: "文章推送" },
  "hot-topics": { mailerliteId: HOT_MAILERLITE_GROUP_ID, label: "技术热点" },
};

// ── 管理员通知模板 ──

import adminTpl from "./admin-notification.html";

function renderAdminNotification(
  email: string,
  service: string,
  time: string,
  total: number,
): string {
  return adminTpl
    .replace(/\{\{EMAIL\}\}/g, email)
    .replace(/\{\{SERVICE\}\}/g, service)
    .replace(/\{\{TIME\}\}/g, time)
    .replace(/\{\{TOTAL_SUBSCRIBERS\}\}/g, String(total));
}

/** 订阅成功后给管理员发通知邮件 */
async function sendAdminNotification(
  env: Env,
  email: string,
  groupLabel: string,
  groupName: string,
): Promise<void> {
  try {
    // 1. 查当前分组的总订阅数
    const { results } = await env.DB
      .prepare("SELECT COUNT(*) as count FROM subscribers WHERE group_name = ?")
      .bind(groupName)
      .all<{ count: number }>();
    const total = results?.[0]?.count ?? 0;

    // 2. 渲染模板
    const now = new Date();
    const time = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const campaignName = `新订阅通知 - ${email}`;
    const html = renderAdminNotification(email, `${groupLabel}（${groupName}）`, time, total);

    // 3. 创建 Campaign → main 组
    const createResp = await fetch("https://connect.mailerlite.com/api/campaigns", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: campaignName,
        type: "regular",
        groups: [ADMIN_GROUP_ID],
        emails: [{
          subject: `栏轩阁 - 新订阅通知`,
          from: FROM_EMAIL,
          from_name: FROM_NAME,
          content: html,
        }],
      }),
    });

    if (!createResp.ok) {
      const err = await createResp.text();
      console.error("管理员通知创建失败", { module: "subscribe", action: "admin_notify_create_error", status: createResp.status, error: err });
      return;
    }

    const { data } = await createResp.json() as { data: { id: string } };
    const campaignId = data.id;

    // 4. v2 API 发送
    const sendResp = await fetch(
      `https://api.mailerlite.com/api/v2/campaigns/${campaignId}/actions/send`,
      {
        method: "POST",
        headers: {
          "X-MailerLite-ApiKey": env.MAILERLITE_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );

    if (!sendResp.ok) {
      const err = await sendResp.text();
      console.error("管理员通知发送失败", { module: "subscribe", action: "admin_notify_send_error", status: sendResp.status, error: err });
    }
  } catch (e) {
    // 通知失败不影响订阅流程
    console.error("管理员通知异常", { module: "subscribe", action: "admin_notify_error", error: String(e) });
  }
}

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
    // 1. 写入 D1（先写，即使 MailerLite 失败也已留底）
    await env.DB.prepare(
      "INSERT OR IGNORE INTO subscribers (email, group_name) VALUES (?, ?)",
    ).bind(email, group).run();

    // 2. MailerLite API — 添加订阅者到对应的分组
    //    Automation 会自动发欢迎邮件
    const mlResp = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        groups: [groupConfig.mailerliteId],
        status: "active",
      }),
    });

    // 409 = 已存在，不计为错误
    if (!mlResp.ok && mlResp.status !== 409) {
      const err = await mlResp.text();
      console.error("MailerLite 订阅错误", { module: "subscribe", action: "mailerlite_error", status: mlResp.status, email, error: err });
      // 不阻断：D1 已记录，留给后续重试
    } else {
      console.log("MailerLite 订阅成功", { module: "subscribe", action: "mailerlite_success", email, status: mlResp.status });
    }

    // 3. 给管理员发通知（不阻断主流程）
    await sendAdminNotification(env, email, groupConfig.label, group);

    return respond({ email, group }, "订阅成功 🎉 欢迎加入！", 1, origin);
  } catch (e) {
    console.error("订阅异常", { module: "subscribe", action: "handler_error", email, error: String(e) });
    return respond(null, "订阅失败，请稍后重试", 0, origin);
  }
}
