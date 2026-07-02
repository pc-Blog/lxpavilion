import type { Env, PlatformSummary, MergedArticle, ArticleMap } from "../types";
import { fetchCSDN, fetchJuejin, fetchCnblogs } from "./fetchers";
import { respond, cacheableResponse } from "../utils/response";

/**
 * GET /platform — 多平台文章统计与合并。
 */
export async function handlePlatform(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null
): Promise<Response> {
  try {
    // ── 缓存命中 ──
    const cacheKey = new Request(`${request.url}-cache-v4`, { method: "GET" });
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const data = (await cached.json()) as PlatformSummary;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data as any)._cache = "hit";
      console.log("平台统计缓存命中", { module: "platform", action: "cache_hit" });
      return respond(data, "ok", 1, origin);
    }
    console.log("平台统计开始拉取", { module: "platform", action: "fetch_start" });

    // ── 并发请求三个平台 ──
    const [csdn, juejin, cnblogs] = await Promise.allSettled([
      fetchCSDN(env),
      fetchJuejin(env),
      fetchCnblogs(env),
    ]);

    const csdnData = csdn.status === "fulfilled" ? csdn.value : null;
    const juejinData = juejin.status === "fulfilled" ? juejin.value : null;
    const cnblogsData = cnblogs.status === "fulfilled" ? cnblogs.value : null;

    console.log("CSDN 返回结果", { module: "platform", platform: "csdn", ok: csdn.status === "fulfilled", articles: csdnData?.articleCount ?? 0, views: csdnData?.totalViews ?? 0 });
    console.log("掘金返回结果", { module: "platform", platform: "juejin", ok: juejin.status === "fulfilled", articles: juejinData?.articleCount ?? 0, views: juejinData?.totalViews ?? 0 });
    console.log("博客园返回结果", { module: "platform", platform: "cnblogs", ok: cnblogs.status === "fulfilled", articles: cnblogsData?.articleCount ?? 0, views: cnblogsData?.totalViews ?? 0 });

    // ── 合并文章 ──
    const allArticles: ArticleMap = {};
    const platData = { csdn: csdnData, juejin: juejinData, cnblogs: cnblogsData };
    const platKeys = ["csdn", "juejin", "cnblogs"] as const;

    for (const plat of platKeys) {
      const data = platData[plat];
      if (!data) continue;
      for (const a of data.articles || []) {
        const key = a.title.trim();
        if (!allArticles[key]) allArticles[key] = { date: "" };
        allArticles[key][plat] = {
          views: a.views,
          likes: a.likes,
          url: a.url,
        };
        if (!allArticles[key].date) allArticles[key].date = a.date || "";
      }
    }

    const mergedArticles: MergedArticle[] = Object.entries(allArticles)
      .map(([title, val]) => ({
        title,
        date: val.date,
        csdn: val.csdn ?? null,
        juejin: val.juejin ?? null,
        cnblogs: val.cnblogs ?? null,
      }))
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      });

    const result: PlatformSummary = {
      csdn: csdnData
        ? {
            totalViews: csdnData.totalViews,
            totalLikes: csdnData.totalLikes,
            articleCount: csdnData.articleCount,
            totalComments: csdnData.totalComments,
            totalCollects: csdnData.totalCollects,
          }
        : null,
      juejin: juejinData
        ? {
            totalViews: juejinData.totalViews,
            totalLikes: juejinData.totalLikes,
            articleCount: juejinData.articleCount,
            totalCollects: juejinData.totalCollects,
            followers: juejinData.followers,
          }
        : null,
      cnblogs: cnblogsData
        ? {
            totalViews: cnblogsData.totalViews,
            totalLikes: cnblogsData.totalLikes,
            articleCount: cnblogsData.articleCount,
            totalComments: cnblogsData.totalComments,
          }
        : null,
      mergedArticles,
      generatedAt: new Date().toISOString(),
    };

    // 仅三平台全部成功才写缓存（避免缓存含 null 的失败结果）
    if (csdn.status === "fulfilled" && juejin.status === "fulfilled" && cnblogs.status === "fulfilled") {
      ctx.waitUntil(
        caches.default.put(cacheKey, cacheableResponse(result, origin))
      );
    }

    console.log("平台统计聚合完成", {
      module: "platform",
      action: "summary",
      csdn: csdnData?.articleCount ?? 0,
      juejin: juejinData?.articleCount ?? 0,
      cnblogs: cnblogsData?.articleCount ?? 0,
      merged: mergedArticles.length,
      cached: csdn.status === "fulfilled" && juejin.status === "fulfilled" && cnblogs.status === "fulfilled",
    });

    return respond(result, "ok", 1, origin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return respond(null, msg, 0, origin);
  }
}
