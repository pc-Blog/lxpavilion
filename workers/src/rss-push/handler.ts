/**
 * RSS 推送 Cron 处理器
 *
 * 每天 0:00 UTC 自动运行：
 *   1. 抓取博客 RSS feed
 *   2. 筛选最近一周的文章
 *   3. 编译模板 → 创建 MailerLite Campaign → 发送
 *   4. 记录推送日志
 */

import type { Env } from "../types";
import { respond } from "../utils/response";
import { renderRssEmail } from "./template";
import type { Article } from "./template";

const FEED_URL = "https://www.lxpavilion.top/feed.xml";
const GROUP_ID = "191576374630155327";
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

/** 获取 article 分组的活跃订阅者数 */
async function getSubscriberCount(env: Env): Promise<number> {
  try {
    const resp = await fetch(
      `https://connect.mailerlite.com/api/groups/${GROUP_ID}`,
      {
        headers: {
          Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
          Accept: "application/json",
        },
      },
    );
    if (!resp.ok) return 0;
    const { data } = await resp.json() as { data: { active_count: number } };
    return data.active_count ?? 0;
  } catch {
    return 0;
  }
}

/** 创建并发送 MailerLite Campaign — 返回 campaign ID */
async function pushToMailerLite(
  env: Env,
  articles: Article[],
): Promise<string> {
  const html = renderRssEmail(articles);

  const createResp = await fetch("https://connect.mailerlite.com/api/campaigns", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name: CAMPAIGN_NAME,
      type: "regular",
      groups: [GROUP_ID],
      emails: [{
        subject: CAMPAIGN_NAME,
        from: FROM_EMAIL,
        from_name: FROM_NAME,
        content: html,
      }],
    }),
  });

  if (!createResp.ok) {
    const err = await createResp.text();
    throw new Error(`Campaign creation failed: ${createResp.status} ${err}`);
  }

  const { data } = await createResp.json() as { data: { id: string } };
  const campaignId = data.id;
  console.log("RSS Campaign 已创建", { module: "rss_push", action: "campaign_created", campaignId });

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
    throw new Error(`Campaign send failed: ${sendResp.status} ${err}`);
  }

  console.log("RSS Campaign 已发送", { module: "rss_push", action: "campaign_sent" });

  return campaignId;
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
  campaign_id?: string;
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

  // 2. 收集已推送过的文章 ID（从所有成功的 push_logs 中汇总）
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

  // 3. 筛选未推送过的文章（按文章 ID 去重，而不是按日期）
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

  // 4. 推送到 MailerLite
  let campaignId: string | undefined;
  try {
    campaignId = await pushToMailerLite(env, newArticles);
  } catch (e) {
    const errMsg = (e as Error).message;
    console.error("RSS 推送失败", { module: "rss_push", action: "push_failed", error: errMsg });
    const result = await env.DB.prepare(
      `INSERT INTO push_logs (article_count, subscriber_count, group_name, status, error_msg)
       VALUES (?, 0, 'article', 'failed', ?)`,
    ).bind(newArticles.length, errMsg).run();
    return { id: result.meta.last_row_id, status: "failed" };
  }

  // 5. 记录推送日志（记录文章 ID 列表，替代原来的时间戳）
  const subscriberCount = await getSubscriberCount(env);
  const newArticleIds = newArticles
    .map((a) => extractArticleId(a.link))
    .filter((id): id is number => id !== null);

  const result = await env.DB.prepare(
    `INSERT INTO push_logs (article_count, subscriber_count, group_name, status, article_ids)
     VALUES (?, ?, 'article', 'success', ?)`,
  ).bind(newArticles.length, subscriberCount, JSON.stringify(newArticleIds)).run();

  console.log("RSS 推送完成", { module: "rss_push", action: "done", articles: newArticles.length, subscribers: subscriberCount, logId: result.meta.last_row_id });

  return { id: result.meta.last_row_id, status: "success", campaign_id: campaignId };
}

// ══════════════════════════════════════════════════════════════
// MailerLite Campaign 查询与管理 API
// ══════════════════════════════════════════════════════════════

const ML_API_BASE = "https://connect.mailerlite.com/api";

/**
 * 查询 MailerLite Campaign 详情（含投递统计）
 *
 * GET /api/rss-push/detail?id=<campaign_id>
 */
export async function handleRssPushDetail(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return respond(null, "缺少 id 参数（MailerLite campaign ID）", 0, origin);
  }

  const resp = await fetch(`${ML_API_BASE}/campaigns/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (resp.status === 404) {
    return respond(null, "Campaign 不存在", 0, origin);
  }

  if (!resp.ok) {
    const err = await resp.text();
    return respond(null, `查询失败: ${resp.status} ${err}`, 0, origin);
  }

  const result = await resp.json() as { data: unknown };
  return respond(result.data, "ok", 1, origin);
}

/**
 * 获取 MailerLite Campaign 总数
 *
 * GET /api/rss-push/count
 */
export async function handleRssPushCount(
  env: Env,
  origin: string | null,
): Promise<Response> {
  // MailerLite v3 不分页时默认返回所有 campaigns
  const resp = await fetch(`${ML_API_BASE}/campaigns`, {
    headers: {
      Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const err = await resp.text();
    return respond(null, `获取 Campaign 列表失败: ${resp.status} ${err}`, 0, origin);
  }

  const result = await resp.json() as { data: unknown[] };
  return respond({ total: result.data.length }, "ok", 1, origin);
}

/**
 * 批量删除所有 MailerLite Campaign
 *
 * DELETE /api/rss-push
 */
export async function handleRssPushDeleteAll(
  env: Env,
  origin: string | null,
): Promise<Response> {
  // 1. 获取所有 campaign
  const listResp = await fetch(`${ML_API_BASE}/campaigns`, {
    headers: {
      Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!listResp.ok) {
    const err = await listResp.text();
    return respond(null, `获取 Campaign 列表失败: ${listResp.status} ${err}`, 0, origin);
  }

  const result = await listResp.json() as { data: { id: string }[] };
  const campaigns = result.data;

  if (campaigns.length === 0) {
    return respond({ deleted_count: 0 }, "没有待删除的 Campaign", 1, origin);
  }

  // 2. 逐个删除
  let deletedCount = 0;
  for (const c of campaigns) {
    try {
      const delResp = await fetch(`${ML_API_BASE}/campaigns/${c.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
          Accept: "application/json",
        },
      });
      if (delResp.status === 204) deletedCount++;
    } catch (e) {
      console.error("RSS 推送删除 campaign 失败", { module: "rss_push", action: "delete_campaign_error", campaignId: c.id, error: String(e) });
    }
  }

  return respond(
    { deleted_count: deletedCount },
    `已删除 ${deletedCount} 个 Campaign`,
    1,
    origin,
  );
}
