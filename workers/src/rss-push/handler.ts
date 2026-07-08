/**
 * RSS 推送 Cron 处理器
 *
 * 每天 0:00 UTC 自动运行：
 *   1. 抓取博客 RSS feed
 *   2. 筛选最近一周的文章
 *   3. 编译模板 → 通过 Resend Batch 群发给所有订阅者
 *   4. 记录推送日志
 */

import type { Env } from "../types";
import { respond } from "../utils/response";
import { renderRssEmail } from "./template";
import type { Article } from "./template";

const FEED_URL = "https://www.lxpavilion.top/feed.xml";
const FROM_EMAIL = "notify@lxpavilion.top";
const FROM_NAME = "ppc";
const CAMPAIGN_NAME = "栏轩·阁｜本周技术速递";
const DEFAULT_MAX_ARTICLES = 3;

// ── RSS 解析 ──

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchRssArticles(): Promise<Article[]> {
  const resp = await fetch(FEED_URL);
  if (!resp.ok) throw new Error(`Feed fetch failed: ${resp.status}`);
  const xml = await resp.text();

  const items: Article[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, "title").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    const link = extractTag(block, "link");
    const date = extractTag(block, "pubDate") || null;
    const descRaw = extractTag(block, "description");
    const summary = descRaw ? stripHtml(descRaw).slice(0, 300) : null;
    const category = extractTag(block, "category").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() || null;
    const tags: string[] = [];
    const tagRe = /<tag>([\s\S]*?)<\/tag>/gi;
    let tm;
    while ((tm = tagRe.exec(block)) !== null) {
      const t = tm[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      if (t) tags.push(t);
    }
    if (title) items.push({ title, link, date, summary, category, tags });
  }
  return items;
}

/** 从 D1 获取 article 分组的活跃订阅者数 */
async function getSubscriberCount(env: Env): Promise<number> {
  try {
    const { results } = await env.DB
      .prepare("SELECT COUNT(*) as count FROM subscribers WHERE group_name = 'article'")
      .all<{ count: number }>();
    return results?.[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

/** 通过 Resend Batch 群发邮件给所有订阅者 */
async function pushViaResend(
  env: Env,
  html: string,
  subject: string,
): Promise<void> {
  // 从 D1 查所有订阅者
  const { results } = await env.DB
    .prepare("SELECT email FROM subscribers WHERE group_name = 'article'")
    .all<{ email: string }>();

  if (!results || results.length === 0) {
    console.warn("RSS 推送无订阅者", { module: "rss_push", action: "no_subscribers" });
    return;
  }

  const fromName = env.EMAIL_FROM_NAME || FROM_NAME;
  const fromAddr = env.EMAIL_FROM_ADDRESS || FROM_EMAIL;

  // Resend Batch 一次最多 100 封
  const batchSize = 100;
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const payload = batch.map(sub => ({
      from: `${fromName} <${fromAddr}>`,
      to: [sub.email],
      subject,
      html,
    }));

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend batch send failed: ${res.status} ${err}`);
    }

    console.log("RSS Batch 已发送", { module: "rss_push", action: "batch_sent", count: batch.length });
  }
}

// ── 从 RSS 链接提取文章 ID ──

function extractArticleId(link: string): number | null {
  const m = link.match(/\/article\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

// ── 主入口 ──

interface PushResult {
  id: number;
  status: string;
}

export async function handleRssPush(env: Env): Promise<PushResult | null> {
  console.log("RSS 推送开始", { module: "rss_push", action: "start" });

  // 1. 获取 RSS 文章
  const allArticles = await fetchRssArticles();
  if (allArticles.length === 0) {
    console.warn("RSS 推送无文章", { module: "rss_push", action: "feed_empty" });
    const result = await env.DB.prepare(
      `INSERT INTO push_logs (article_count, subscriber_count, group_name, status, error_msg)
       VALUES (0, 0, 'article', 'failed', 'feed empty')`,
    ).run();
    return { id: result.meta.last_row_id, status: "failed" };
  }

  // 2. 收集已推送过的文章 ID
  const pushedRows = await env.DB
    .prepare(
      `SELECT article_ids FROM push_logs
       WHERE status = 'success' AND group_name = 'article'`,
    )
    .all<{ article_ids: string }>();

  const pushedIds = new Set<number>();
  for (const row of pushedRows.results || []) {
    if (row.article_ids) {
      try {
        const ids = JSON.parse(row.article_ids) as number[];
        ids.forEach((id) => pushedIds.add(id));
      } catch { /* 跳过格式异常的数据 */ }
    }
  }

  // 3. 筛选未推送过的文章
  const maxArticles = Number(env.RSS_MAX_ARTICLES) || DEFAULT_MAX_ARTICLES;

  const newArticles = allArticles
    .filter((a) => {
      const id = extractArticleId(a.link);
      return id !== null && !pushedIds.has(id);
    })
    .slice(0, maxArticles);

  if (newArticles.length === 0) {
    console.log("RSS 推送无新文章", { module: "rss_push", action: "no_new_articles" });
    const result = await env.DB.prepare(
      `INSERT INTO push_logs (article_count, subscriber_count, group_name, status)
       VALUES (0, 0, 'article', 'skipped')`,
    ).run();
    return { id: result.meta.last_row_id, status: "skipped" };
  }

  console.log("RSS 推送新文章", { module: "rss_push", action: "new_articles", count: newArticles.length, titles: newArticles.map(a => a.title) });

  // 4. 渲染模板
  const html = renderRssEmail(newArticles);

  // 5. 通过 Resend 群发
  try {
    await pushViaResend(env, html, CAMPAIGN_NAME);
  } catch (e) {
    const errMsg = (e as Error).message;
    console.error("RSS 推送失败", { module: "rss_push", action: "push_failed", error: errMsg });
    const result = await env.DB.prepare(
      `INSERT INTO push_logs (article_count, subscriber_count, group_name, status, error_msg)
       VALUES (?, 0, 'article', 'failed', ?)`,
    ).bind(newArticles.length, errMsg).run();
    return { id: result.meta.last_row_id, status: "failed" };
  }

  // 6. 记录推送日志
  const subscriberCount = await getSubscriberCount(env);
  const newArticleIds = newArticles
    .map((a) => extractArticleId(a.link))
    .filter((id): id is number => id !== null);

  const result = await env.DB.prepare(
    `INSERT INTO push_logs (article_count, subscriber_count, group_name, status, article_ids)
     VALUES (?, ?, 'article', 'success', ?)`,
  ).bind(newArticles.length, subscriberCount, JSON.stringify(newArticleIds)).run();

  console.log("RSS 推送完成", { module: "rss_push", action: "done", articles: newArticles.length, subscribers: subscriberCount, logId: result.meta.last_row_id });

  return { id: result.meta.last_row_id, status: "success" };
}
