import api from "@/lib/axios";
import type { PageVO, Article, ArticleVO, ArticleDetailVO, ArticleQueryDTO, PageDTO, GroupedItem, GroupedPageVO, SeriesBrief } from "@/lib/types";
import { detectMode, ensureData, getDetailData } from "@/lib/static-data";
import { siteConfig } from "@/lib/siteConfig";

export async function getPublicList(params: PageDTO<ArticleQueryDTO>) {
  if ((await detectMode()) === "static") {
    const all = await ensureData<PageVO<ArticleVO>>("articles");
    if (!all) return { rows: [], total: 0 };

    let filtered = all.rows;
    const q = params.query;
    if (q?.categoryId) filtered = filtered.filter((a) => a.categoryId === q.categoryId);
    if (q?.tagId) filtered = filtered.filter((a) => a.tags?.some((t) => t.id === q.tagId));
    if (q?.keyword) {
      const kw = q.keyword.toLowerCase();
      filtered = filtered.filter((a) => a.title.toLowerCase().includes(kw));
    }
    if (q?.series) {
      filtered = filtered.filter((a) => a.series === q.series);
    }

    const pageNum = params.pageNum || 1;
    const pageSize = params.pageSize || 9;
    const start = (pageNum - 1) * pageSize;
    return { rows: filtered.slice(start, start + pageSize), total: filtered.length };
  }
  return api.post<PageVO<ArticleVO>, PageVO<ArticleVO>>("/article/public/page", params);
}

export async function getPublicDetail(id: number) {
  if ((await detectMode()) === "static") {
    return getDetailData<ArticleDetailVO>("articles", id);
  }
  return api.get<ArticleDetailVO, ArticleDetailVO>(`/article/public/${id}`);
}

const VIEW_API = `https://${siteConfig.workerApi}/api/view`;

/** 获取所有文章浏览数 */
export async function getViewCounts(): Promise<{ article_id: number; views: number }[]> {
  try {
    const res = await fetch(`${VIEW_API}/articles`);
    const json = await res.json();
    return json?.data?.rows ?? [];
  } catch {
    return [];
  }
}

/** 检测是否本地环境（后端可达） */
async function checkLocal(): Promise<boolean> {
  const cached = localStorage.getItem("is_local_env");
  if (cached !== null) return cached === "1";
  try {
    const res = await fetch(`http://${siteConfig.backUrl}/api/auth/ping`, { method: "POST" });
    const json = await res.json();
    const local = json?.data === "local_only_token";
    localStorage.setItem("is_local_env", local ? "1" : "0");
    return local;
  } catch {
    localStorage.setItem("is_local_env", "0");
    return false;
  }
}

/** 聚合分页查询（同系列文章合并展示） */
export async function getGroupedPublicList(
  params: PageDTO<ArticleQueryDTO>
): Promise<GroupedPageVO<GroupedItem>> {
  if ((await detectMode()) === "static") {
    const all = await ensureData<PageVO<ArticleVO>>("articles");
    if (!all) return { rows: [], total: 0, articleTotal: 0 };
    // 静态模式：前端聚合
    let filtered = all.rows;
    const q = params.query;
    if (q?.categoryId) filtered = filtered.filter((a) => a.categoryId === q.categoryId);
    if (q?.tagId) filtered = filtered.filter((a) => a.tags?.some((t) => t.id === q.tagId));
    if (q?.keyword) {
      const kw = q.keyword.toLowerCase();
      filtered = filtered.filter((a) => a.title.toLowerCase().includes(kw));
    }
    if (q?.series) {
      filtered = filtered.filter((a) => a.series === q.series);
    }
    return groupAndPage(filtered, params.pageNum || 1, params.pageSize || 9);
  }
  return api.post<GroupedPageVO<GroupedItem>, GroupedPageVO<GroupedItem>>("/article/public/grouped-page", params);
}

/** 静态模式下的前端聚合分页 */
function groupAndPage(articles: ArticleVO[], pageNum: number, pageSize: number): GroupedPageVO<GroupedItem> {
  const seriesMap = new Map<string, ArticleVO[]>();
  const slots: Array<{ type: "article" | "series"; key: string }> = [];
  const inserted = new Set<string>();

  for (const a of articles) {
    if (a.series) {
      const list = seriesMap.get(a.series);
      if (list) {
        list.push(a);
      } else {
        seriesMap.set(a.series, [a]);
      }
      if (!inserted.has(a.series)) {
        inserted.add(a.series);
        slots.push({ type: "series", key: a.series });
      }
    } else {
      slots.push({ type: "article", key: String(a.id) });
    }
  }

  // 构建展示列表
  const allItems: GroupedItem[] = slots.map((slot) => {
    if (slot.type === "article") {
      return { type: "article", article: articles.find((a) => String(a.id) === slot.key) };
    }
    const list = seriesMap.get(slot.key) || [];
    return {
      type: "series",
      series: slot.key,
      seriesArticleCount: list.length,
      seriesArticles: list,
    };
  });

  const total = allItems.length;
  const articleTotal = articles.length;
  const start = (pageNum - 1) * pageSize;
  return { rows: allItems.slice(start, start + pageSize), total, articleTotal };
}

/** 文章浏览 +1（带回源去重） */
export async function addView(id: number): Promise<number> {
  if (await checkLocal()) return 0;
  try {
    const token = localStorage.getItem(`viewed:article:${id}`);
    const res = await fetch(`${VIEW_API}/article/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const json = await res.json();
    const data = json?.data;
    if (data?.counted) {
      const expires = Date.now() + 3600 * 1000; // 1h
      localStorage.setItem(`viewed:article:${id}`, String(expires));
    }
    return data?.views ?? 0;
  } catch {
    return 0;
  }
}

/** 获取已有系列列表（管理端用） */
export async function getSeriesList(): Promise<SeriesBrief[]> {
  try {
    return await api.get<SeriesBrief[], SeriesBrief[]>("/article/series/list");
  } catch {
    return [];
  }
}

export async function getById(id: number) {
  return api.get("/article/{id}".replace("{id}", String(id)));
}

// Admin CRUD
export async function getList(keyword?: string, pageNum = 1, pageSize = 20) {
  return api.post<PageVO<Article>, PageVO<Article>>("/article/page", {
    pageNum,
    pageSize,
    query: keyword ? ({ title: keyword } as Article) : undefined,
  } satisfies PageDTO<Article>);
}
