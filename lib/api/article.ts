import api from "@/lib/axios";
import type { PageVO, Article, ArticleVO, ArticleDetailVO, ArticleQueryDTO, PageDTO } from "@/lib/types";
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
