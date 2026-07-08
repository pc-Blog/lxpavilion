/**
 * Email 管理 API — 对接 Cloudflare Worker 邮件归档接口
 *
 * 所有请求直接发送到 Worker，不经过 Java 后端。
 */

import type { Email, EmailListResult } from "@/lib/types";

const WORKER_API = "https://api.lxpavilion.top/api";

async function workerFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${WORKER_API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (json.code !== 1) throw new Error(json.msg || "Request failed");
  return json.data as T;
}

/** GET /api/email/list — 分页获取邮件列表 */
export async function getEmailList(page = 1, pageSize = 20, direction?: "in" | "out"): Promise<EmailListResult> {
  let path = `/email/list?page=${page}&pageSize=${pageSize}`;
  if (direction) path += `&direction=${direction}`;
  return workerFetch<EmailListResult>(path);
}

/** GET /api/email/detail — 获取单封邮件详情 */
export async function getEmailDetail(id: number): Promise<Email> {
  return workerFetch<Email>(`/email/detail?id=${id}`);
}

/** DELETE /api/email/delete — 删除邮件 */
export async function deleteEmail(id: number): Promise<void> {
  await workerFetch<void>(`/email/delete?id=${id}`, { method: "DELETE" });
}

/** GET /api/email/forward — 查看转发目标地址 */
export async function getForwardTarget(): Promise<{ address: string }> {
  return workerFetch<{ address: string }>("/email/forward");
}

/** POST /api/email/send — 发送邮件 */
export async function sendEmail(to: string, subject: string, text: string, toName?: string): Promise<{ messageId: string }> {
  return workerFetch<{ messageId: string }>("/email/send", {
    method: "POST",
    body: JSON.stringify({ to, subject, text, toName }),
  });
}
