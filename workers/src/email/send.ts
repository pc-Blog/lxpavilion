/**
 * Email 发送 — 使用 Resend API 发送邮件
 *
 * 仅供管理员测试/使用。
 */

import type { Env } from "../types";
import { respond } from "../utils/response";

/** POST /api/email/send — 发送邮件到指定地址 */
export async function handleSend(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const body: { to?: string; subject?: string; text?: string; toName?: string } =
    request.method === "POST" ? await request.json() : {};

  // 检查发件人配置
  const fromName = env.EMAIL_FROM_NAME;
  const fromAddr = env.EMAIL_FROM_ADDRESS;
  if (!fromName || !fromAddr) {
    return respond(null, "发件人未配置（EMAIL_FROM_NAME / EMAIL_FROM_ADDRESS）", 0, origin);
  }

  if (!body.to) {
    return respond(null, "缺少收件人地址（to）", 0, origin);
  }
  const to = body.to;
  const subject = body.subject || "";
  const text = body.text || "";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddr}>`,
        to: [to],
        subject,
        text,
        html: text.split("\n").map(p => `<p>${p}</p>`).join(""),
      }),
    });

    const data = await res.json() as { id?: string; message?: string };

    if (!res.ok) {
      const errMsg = data.message || JSON.stringify(data);
      console.error("Resend 发送失败", { module: "email", action: "send", error: errMsg });
      return respond(null, `发送失败: ${errMsg}`, 0, origin);
    }

    console.log("Resend 发送成功", { module: "email", action: "send", to, messageId: data.id });

    // 写入 D1 归档
    try {
      await env.DB
        .prepare(
          `INSERT INTO emails (message_id, from_addr, to_addr, subject, text_body, html_body, from_name, to_name, direction)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(data.id, fromAddr, to, subject, text, text.split("\n").map(p => `<p>${p}</p>`).join(""), fromName, body.toName || "", "out")
        .run();
    } catch (dbErr) {
      console.error("邮件归档失败", { module: "email", action: "store", error: String(dbErr) });
    }

    return respond({ messageId: data.id, to }, "发送成功", 1, origin);
  } catch (err) {
    const msg = String(err);
    console.error("Resend 请求异常", { module: "email", action: "send", error: msg });
    return respond(null, `发送失败: ${msg}`, 0, origin);
  }
}
