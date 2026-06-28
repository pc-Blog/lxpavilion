/**
 * Email 处理器 — 接收 Email Routing 转发的邮件，归档后原样转发
 *
 * Worker 只做管理（归档），不修改邮件内容。
 * 使用 message.forward() 原样转发，发件人与正文完全保留。
 *
 * 依赖:
 *   postal-mime  — 解析原始 MIME 邮件内容
 *   DB           — D1 数据库（emails 表归档 + settings 表读取转发地址）
 */

import PostalMime from "postal-mime";

import type { Env } from "../types";

/**
 * 从 settings 表读取转发目标地址
 */
async function getForwardEmail(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind("forward_email")
    .first<{ value: string }>();
  return row?.value ?? null;
}

/**
 * 将邮件信息写入 emails 表
 */
async function storeEmail(
  db: D1Database,
  data: {
    messageId: string;
    fromAddr: string;
    toAddr: string;
    forwardTo: string;
    subject: string;
    textBody: string;
    htmlBody: string;
    headers: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO emails (message_id, from_addr, to_addr, forward_to, subject, text_body, html_body, headers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.messageId,
      data.fromAddr,
      data.toAddr,
      data.forwardTo,
      data.subject,
      data.textBody,
      data.htmlBody,
      data.headers,
    )
    .run();
}

export async function handleEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  console.log(`[Email] Received: from=${message.from} to=${message.to}`);

  // ── 1. 解析原始邮件 ──
  const raw = await new Response(message.raw).arrayBuffer();
  const parsed = await PostalMime.parse(raw);

  const messageId = parsed.messageId || message.headers.get("message-id") || "";
  const subject = parsed.subject || "(No Subject)";
  const textBody = parsed.text || "";
  const htmlBody = parsed.html || "";
  const headersJson = JSON.stringify(Object.fromEntries(message.headers.entries()));

  // ── 2. 获取转发目标地址 ──
  const forwardTo = await getForwardEmail(env.DB);

  // ── 3. 归档到 D1 ──
  if (forwardTo) {
    await storeEmail(env.DB, {
      messageId,
      fromAddr: message.from,
      toAddr: message.to,
      forwardTo,
      subject,
      textBody,
      htmlBody,
      headers: headersJson,
    });
    console.log(`[Email] ✅ 已归档到 D1`);
  } else {
    console.warn(`[Email] ⚠️ 未设置转发目标，邮件已归档但未转发`);
    await storeEmail(env.DB, {
      messageId,
      fromAddr: message.from,
      toAddr: message.to,
      forwardTo: "",
      subject,
      textBody,
      htmlBody,
      headers: headersJson,
    });
    return;
  }

  // ── 4. 原样转发（保留原始发件人、正文、附件） ──
  try {
    await message.forward(forwardTo);
    console.log(`[Email] ✅ 已原样转发到 ${forwardTo}`);
  } catch (err) {
    console.error(`[Email] ❌ 转发失败: ${err}`);
  }
}
