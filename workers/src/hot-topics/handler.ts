/**
 * 热点推送 —— 基于 Hotspot 项目的每日技术热点邮件推送
 *
 * 数据源: https://hotspot.lxpavilion.top/report.json
 * 周期:   每天 1:00 UTC（北京时间 09:00）
 * 逻辑:   抓报告 → 去重 → 截取 → 渲染 → 通过 Resend 群发 → 记录
 */

import type { Env } from "../types";
import { respond } from "../utils/response";
import { insertPushLog, readPushedHashes } from "../utils/push-log";
import { renderHotEmail } from "./template";
import type { HotItem } from "./template";

// ── 常量 ──

const HOTSPOT_URL = "https://hotspot.lxpavilion.top/report.json";
const CAMPAIGN_NAME = "栏轩·阁｜今日技术热点";
const MAX_PER_KEYWORD = 2;

// ── URL 哈希（用于去重） ──

function hashUrl(url: string): string {
  if (!url) return "";
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16).slice(0, 8);
}

// ── 抓取热点报告 ──

interface HotspotReport {
  report_time: string;
  total_hotspots: number;
  results: {
    keyword: string;
    hotspots: {
      rank: number;
      title: string;
      url: string;
      summary: string;
      source: string;
      published_time: string;
      perspectives: { stance: string; summary: string }[];
    }[];
  }[];
}

async function fetchHotspotReport(): Promise<HotspotReport | null> {
  const resp = await fetch(HOTSPOT_URL);
  if (!resp.ok) {
    console.error("热点报告获取失败", { module: "hot_push", action: "fetch_report_error", status: resp.status });
    return null;
  }
  return resp.json() as Promise<HotspotReport>;
}

// ── 展平并分组 ──

interface KeywordGroup {
  keyword: string;
  items: HotItem[];
}

function flattenAndGroup(report: HotspotReport): KeywordGroup[] {
  const groups: KeywordGroup[] = [];

  for (const result of report.results) {
    if (!result.hotspots || result.hotspots.length === 0) continue;

    const items: HotItem[] = result.hotspots.map((h) => ({
      rank: h.rank,
      title: h.title,
      url: h.url || "",
      summary: h.summary || "",
      source: h.source || "",
      published_time: h.published_time || "",
      keyword: result.keyword,
      perspectives: h.perspectives || [],
      urlHash: hashUrl(h.url),
    }));

    groups.push({ keyword: result.keyword, items });
  }

  return groups;
}

// ── 获取已推送的 URL 哈希（该分组最新一行，已丢弃过期条目） ──

async function getPushedHashes(env: Env): Promise<Set<string>> {
  return readPushedHashes(env.DB, "hot-topics");
}

// ── 从 D1 获取 Hotspot 分组的订阅者数 ──

async function getSubscriberCount(env: Env): Promise<number> {
  try {
    const { results } = await env.DB
      .prepare("SELECT COUNT(*) as count FROM subscribers WHERE group_name = 'hot-topics'")
      .all<{ count: number }>();
    return results?.[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

// ── 通过 Resend Batch 群发 ──

async function pushViaResend(
  env: Env,
  html: string,
  subject: string,
): Promise<void> {
  const { results } = await env.DB
    .prepare("SELECT email FROM subscribers WHERE group_name = 'hot-topics'")
    .all<{ email: string }>();

  if (!results || results.length === 0) {
    console.warn("热点推送无订阅者", { module: "hot_push", action: "no_subscribers" });
    return;
  }

  const fromName = env.EMAIL_FROM_NAME;
  const fromAddr = env.NOTIFY_FROM_ADDRESS;

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

    console.log("热点 Batch 已发送", { module: "hot_push", action: "batch_sent", count: batch.length });
  }
}

// ── 主入口 ──

interface PushResult {
  id: number;
  status: string;
}

export async function handleHotPush(env: Env): Promise<PushResult | null> {
  console.log("热点推送开始", { module: "hot_push", action: "start" });

  // 1. 抓取热点报告
  const report = await fetchHotspotReport();
  if (!report) {
    console.error("热点推送报告为空", { module: "hot_push", action: "report_empty" });
    const id = await insertPushLog(env.DB, {
      group: "hot-topics", status: "failed", articleCount: 0, subscriberCount: 0,
      errorMsg: "fetch report.json failed",
    });
    return { id, status: "failed" };
  }

  if (!report.results || report.results.length === 0) {
    console.warn("热点报告无结果", { module: "hot_push", action: "no_results" });
    const id = await insertPushLog(env.DB, {
      group: "hot-topics", status: "skipped", articleCount: 0, subscriberCount: 0,
    });
    return { id, status: "skipped" };
  }

  // 2. 展平并分组
  const allGroups = flattenAndGroup(report);
  const flatItems = allGroups.flatMap((g) => g.items);

  if (flatItems.length === 0) {
    console.warn("热点报告无热点条目", { module: "hot_push", action: "no_items" });
    const id = await insertPushLog(env.DB, {
      group: "hot-topics", status: "skipped", articleCount: 0, subscriberCount: 0,
    });
    return { id, status: "skipped" };
  }

  // 3. 去重
  const pushedHashes = await getPushedHashes(env);

  const filteredGroups: KeywordGroup[] = [];

  for (const group of allGroups) {
    const fresh = group.items.filter((item) => !pushedHashes.has(item.urlHash));
    if (fresh.length > 0) {
      filteredGroups.push({ keyword: group.keyword, items: fresh });
    }
  }

  const totalFresh = filteredGroups.reduce((sum, g) => sum + g.items.length, 0);

  if (totalFresh === 0) {
    console.log("热点推送无新条目", { module: "hot_push", action: "all_pushed" });
    const id = await insertPushLog(env.DB, {
      group: "hot-topics", status: "skipped", articleCount: 0, subscriberCount: 0,
    });
    return { id, status: "skipped" };
  }

  // 4. 轮询选择：每个关键词最多取 2 条，按日期偏移轮转取数
  const maxArticles = Number(env.HOT_MAX_ARTICLES);

  const cappedGroups = filteredGroups.map((g) => ({
    keyword: g.keyword,
    items: g.items.slice(0, MAX_PER_KEYWORD),
  }));

  const sortedGroups = [...cappedGroups].sort((a, b) =>
    a.keyword.localeCompare(b.keyword),
  );

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / 86_400_000,
  );
  const offset = dayOfYear % sortedGroups.length;

  const pointers = new Array(sortedGroups.length).fill(0);
  const selected: HotItem[] = [];

  while (selected.length < maxArticles) {
    let anyRemaining = false;

    for (let gi = 0; gi < sortedGroups.length; gi++) {
      const idx = (offset + gi) % sortedGroups.length;
      const group = sortedGroups[idx];

      if (pointers[idx] < group.items.length) {
        anyRemaining = true;
        selected.push(group.items[pointers[idx]]);
        pointers[idx]++;
        if (selected.length >= maxArticles) break;
      }
    }

    if (!anyRemaining) break;
  }

  const selectedHashes = selected.map((item) => item.urlHash);

  const keywordOrder: string[] = [];
  const groupMap = new Map<string, HotItem[]>();

  for (const item of selected) {
    if (!groupMap.has(item.keyword)) {
      groupMap.set(item.keyword, []);
      keywordOrder.push(item.keyword);
    }
    groupMap.get(item.keyword)!.push(item);
  }

  const finalGroups: KeywordGroup[] = keywordOrder
    .map((kw) => ({ keyword: kw, items: groupMap.get(kw) || [] }))
    .filter((g) => g.items.length > 0);

  const finalCount = selected.length;
  const finalKeywordCount = finalGroups.length;

  console.log("热点推送新条目", { module: "hot_push", action: "new_items", count: finalCount, keywords: finalKeywordCount, offset });

  // 5. 渲染并群发
  const reportDate = report.report_time ? report.report_time.slice(0, 10) : "";
  const html = renderHotEmail(finalGroups, finalCount, finalKeywordCount, reportDate);

  try {
    await pushViaResend(env, html, CAMPAIGN_NAME);
  } catch (e) {
    const errMsg = (e as Error).message;
    console.error("热点推送失败", { module: "hot_push", action: "push_failed", error: errMsg });
    const id = await insertPushLog(env.DB, {
      group: "hot-topics", status: "failed", articleCount: finalCount,
      subscriberCount: 0, errorMsg: errMsg,
    });
    return { id, status: "failed" };
  }

  // 6. 记录推送日志
  const subscriberCount = await getSubscriberCount(env);

  const id = await insertPushLog(env.DB, {
    group: "hot-topics", status: "success", articleCount: finalCount,
    subscriberCount, articleIds: selectedHashes,
  });

  console.log("热点推送完成", { module: "hot_push", action: "done", items: finalCount, subscribers: subscriberCount, logId: id });

  return { id, status: "success" };
}
