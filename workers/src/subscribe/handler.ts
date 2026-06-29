import { respond } from "../utils/response";
import type { Env } from "../types";

const MAILERLITE_GROUP_ID = "191576374630155327";

export async function handleSubscribe(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return respond(null, "请求体必须是 JSON", 0, origin);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(null, "请输入有效的邮箱地址", 0, origin);
  }

  try {
    // 1. 写入 D1（先写，即使 MailerLite 失败也已留底）
    await env.DB.prepare(
      "INSERT OR IGNORE INTO subscribers (email, group_name) VALUES (?, ?)",
    ).bind(email, "article").run();

    // 2. MailerLite API — 添加订阅者到 article 分组
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
        groups: [MAILERLITE_GROUP_ID],
        status: "active",
      }),
    });

    // 409 = 已存在，不计为错误
    if (!mlResp.ok && mlResp.status !== 409) {
      const err = await mlResp.text();
      console.error(`[Subscribe] MailerLite error (${mlResp.status}):`, err);
      // 不阻断：D1 已记录，留给后续重试
    }

    return respond({ email }, "订阅成功 🎉 欢迎加入！", 1, origin);
  } catch (e) {
    console.error("[Subscribe] Error:", e);
    return respond(null, "订阅失败，请稍后重试", 0, origin);
  }
}
