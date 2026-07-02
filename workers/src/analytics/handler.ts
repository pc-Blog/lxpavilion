import type { Env, AnalyticsResult } from "../types";
import { buildDailyHourlyQuery, buildBreakdownQuery } from "./queries";
import { callCF } from "./client";
import {
  parseDailyHourly,
  createEmptyMaps,
  accumulateGroups,
  toBreakdown,
} from "./parser";
import { sha256 } from "../utils/crypto";
import { pMapSerial } from "../utils/concurrency";
import { respond, cacheableResponse, corsHeaders } from "../utils/response";

/**
 * POST / — 获取完整分析数据。
 */
export async function handleAnalytics(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  try {
    const body: { days?: number } = await request.json();
    const days = Math.min(body?.days || 7, 364);
    console.log("流量分析请求", { module: "analytics", action: "request", days });

    // ── 缓存命中检查 ──
    const cache = caches.default;
    const bodyText = JSON.stringify(body);
    const hash = await sha256(bodyText);
    const cacheUrl = new URL(request.url);
    cacheUrl.pathname = "/analytics/" + hash;
    const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });

    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = (await cached.json()) as AnalyticsResult;
      data._cache = "hit";
      data._cachedAt = new Date().toISOString();
      data.generatedAt = new Date().toISOString();
      console.log("流量分析缓存命中", { module: "analytics", action: "cache_hit", days });
      return respond(data, "ok", 1, origin);
    }
    console.log("流量分析开始拉取", { module: "analytics", action: "fetch_start", days });

    // ── 每日 + 逐小时 ──
    const dhJson = await callCF(
      buildDailyHourlyQuery(env.CF_ZONE_ID, days),
      env
    );
    const { daily, hourly, totals } = parseDailyHourly(dhJson);

    // ── 细分数据（最多 30 天） ──
    const breakdownDays = Math.min(days, 30);
    const maps = createEmptyMaps();
    const startDate = new Date(Date.now() - breakdownDays * 86_400_000);
    const dayDates = Array.from({ length: breakdownDays }, (_, i) => {
      const d = new Date(startDate.getTime() + i * 86_400_000);
      return d.toISOString().slice(0, 10);
    });

    const zones = await pMapSerial(dayDates, 5, async (dateStr) => {
      const bJson = await callCF(buildBreakdownQuery(env.CF_ZONE_ID, dateStr), env);
      return bJson?.data?.viewer?.zones?.[0] || null;
    });

    for (const z of zones) {
      if (z) accumulateGroups(z, maps);
    }

    const result: AnalyticsResult = {
      daily,
      hourly,
      totals,
      byCountry: toBreakdown(maps.byCountry),
      byDevice: toBreakdown(maps.byDevice),
      byBrowser: toBreakdown(maps.byBrowser),
      byOS: toBreakdown(maps.byOS),
      byCacheStatus: toBreakdown(maps.byCache),
      byHTTPProtocol: toBreakdown(maps.byHTTP),
      generatedAt: new Date().toISOString(),
      _cache: "miss",
    };

    // 写缓存（后台）— 只存纯数据，不包 respond 外层
    ctx.waitUntil(
      cache.put(cacheKey, cacheableResponse(result, origin))
    );

    return respond(result, "ok", 1, origin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("流量分析异常", { module: "analytics", action: "handler_error", error: msg });
    return respond(null, msg, 0, origin);
  }
}
