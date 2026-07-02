/**
 * RSS 代理 — 抓取并解析 RSS 2.0 / Atom feed，返回文章列表
 *
 * GET /rss?url=https://example.com/feed.xml
 *
 * 缓存：Worker Cache API，3600s，重新部署自动失效。
 */

import type { Env } from "../types";
import { corsHeaders } from "../utils/response";

interface RssItem {
  title: string;
  link: string;
  date: string | null;
  summary: string | null;
}

interface RssResult {
  title: string;
  articles: RssItem[];
}

/** 提取 XML 标签间文本的简单工具 */
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

/** 处理 CDATA 包裹 */
function stripCdata(raw: string): string {
  return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/** 解码 HTML 实体（&#xxx; &amp; &lt; 等） */
function decodeEntities(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** 去除 HTML 标签，截取摘要 */
function stripHtml(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** 解析 RSS 2.0 */
function parseRss(xml: string): RssResult | null {
  const channelMatch = /<channel>([\s\S]*)<\/channel>/i.exec(xml);
  if (!channelMatch) return null;
  const channel = channelMatch[1];

  const channelTitle = decodeEntities(stripCdata(extractTag(channel, "title")));
  if (!channelTitle) return null;

  const itemBlocks: string[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(channel)) !== null) {
    itemBlocks.push(m[1]);
  }

  const articles: RssItem[] = itemBlocks
    .map((block) => {
      const title = decodeEntities(stripCdata(extractTag(block, "title")));
      const link = extractTag(block, "link");
      const date = extractTag(block, "pubDate") || null;
      const descRaw = extractTag(block, "description");
      const summary = descRaw ? stripHtml(descRaw).slice(0, 200) || null : null;
      return title ? { title, link, date, summary } : null;
    })
    .filter((item): item is RssItem => item !== null)
    .slice(0, 5);

  return { title: channelTitle, articles };
}

/** 解析 Atom feed */
function parseAtom(xml: string): RssResult | null {
  const feedTitle = decodeEntities(stripCdata(extractTag(xml, "title")));
  if (!feedTitle) return null;

  const entryBlocks: string[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    entryBlocks.push(m[1]);
  }

  const articles: RssItem[] = entryBlocks
    .map((block) => {
      const title = decodeEntities(stripCdata(extractTag(block, "title")));
      const linkMatch = /<link[^>]*href="([^"]+)"/i.exec(block);
      const link = linkMatch ? linkMatch[1] : "";
      const updated = extractTag(block, "updated") || extractTag(block, "published") || null;
      const descRaw = extractTag(block, "summary");
      const summary = descRaw ? stripHtml(descRaw).slice(0, 200) || null : null;
      return title ? { title, link, date: updated, summary } : null;
    })
    .filter((item): item is RssItem => item !== null)
    .slice(0, 5);

  return { title: feedTitle, articles };
}

function respondJson(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export async function handleRss(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  const url = new URL(request.url);
  const feedUrl = url.searchParams.get("url");

  if (!feedUrl) {
    return respondJson({ code: 0, data: null, msg: "Missing ?url= parameter" }, origin, 400);
  }

  // 验证 URL 格式
  try {
    const parsed = new URL(feedUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return respondJson({ code: 0, data: null, msg: "Invalid URL" }, origin, 400);
  }

  // ── Worker 内部缓存 ──
  const cacheKey = new Request(`${url}-v1`, { method: "GET" });
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    console.log("RSS 缓存命中", { module: "rss", action: "cache_hit", url: feedUrl });
    return cached;
  }

  console.log("RSS 开始抓取", { module: "rss", action: "fetch", url: feedUrl });

  try {
    const resp = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!resp.ok) {
      console.warn("RSS 抓取失败", { module: "rss", action: "fetch_error", url: feedUrl, status: resp.status });
      return respondJson(
        { code: 0, data: null, msg: `Feed fetch failed: ${resp.status}` },
        origin,
        502
      );
    }

    const xml = await resp.text();

    const isAtom = xml.includes("<feed") && xml.includes("xmlns");
    const result = isAtom ? parseAtom(xml) : parseRss(xml);

    if (!result || result.articles.length === 0) {
      console.warn("RSS 解析无文章", { module: "rss", action: "parse_empty", url: feedUrl });
      return respondJson({ code: 0, data: null, msg: "No articles found in feed" }, origin);
    }

    console.log("RSS 抓取成功", { module: "rss", action: "success", url: feedUrl, type: isAtom ? "atom" : "rss", articles: result.articles.length });

    const response = respondJson({ code: 1, data: result, msg: "ok" }, origin);

    // 后台写入 Worker 内部缓存（3600s）
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));

    return response;
  } catch (e) {
    console.error("RSS 抓取异常", { module: "rss", action: "handler_error", url: feedUrl, error: (e as Error).message });
    return respondJson(
      { code: 0, data: null, msg: `Fetch error: ${(e as Error).message}` },
      origin,
      502
    );
  }
}
