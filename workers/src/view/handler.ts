import { respond } from "../utils/response";
import type { Env } from "../types";

export async function handleView(request: Request, env: Env, origin: string | null) {
  const url = new URL(request.url);
  const method = request.method;

  try {
    // GET /api/view/total — 返回总浏览数
    if (method === "GET" && url.pathname === "/api/view/total") {
      const { results } = await env.DB.prepare(
        "SELECT SUM(views) as total FROM article_view"
      ).all();
      const total = (results as any[])[0]?.total || 0;
      console.log("查询总浏览数", { module: "view", action: "total", total });
      return respond({ total }, "ok", 1, origin);
    }

    // GET /api/view/articles — 返回全部文章浏览数
    if (method === "GET" && url.pathname === "/api/view/articles") {
      const { results } = await env.DB.prepare(
        "SELECT article_id, views, updated_at FROM article_view ORDER BY article_id"
      ).all();
      console.log("查询全部浏览数", { module: "view", action: "articles", count: results.length });
      return respond({ rows: results }, "ok", 1, origin);
    }

    // POST /api/view/article/:id — 浏览 +1（带去重）
    const match = url.pathname.match(/^\/api\/view\/article\/(\d+)$/);
    if (method === "POST" && match) {
      const articleId = Number(match[1]);
      const { token } = await request.json() as { token?: string };

      // localhost 不计数
      const host = request.headers.get("Host") || "";
      if (host.includes("localhost") || host.includes("127.0.0.1")) {
        const row = await env.DB.prepare("SELECT views FROM article_view WHERE article_id = ?")
          .bind(articleId).first<{ views: number }>();
        return respond({ article_id: articleId, views: row?.views ?? 0, counted: false }, "ok", 1, origin);
      }

      // 有 token 且未过期 → 1h 内看过，不计数
      if (token && Number(token) > Date.now()) {
        const row = await env.DB.prepare("SELECT views FROM article_view WHERE article_id = ?")
          .bind(articleId).first<{ views: number }>();
        return respond({ article_id: articleId, views: row?.views ?? 0, counted: false }, "ok", 1, origin);
      }

      // upsert: +1
      await env.DB.prepare(
        "INSERT INTO article_view (article_id, views) VALUES (?, 1) ON CONFLICT(article_id) DO UPDATE SET views = views + 1, updated_at = datetime('now')"
      ).bind(articleId).run();

      const row = await env.DB.prepare("SELECT views FROM article_view WHERE article_id = ?")
        .bind(articleId).first<{ views: number }>();

      console.log("文章浏览 +1", { module: "view", action: "increment", articleId, views: row?.views ?? 1 });
      return respond({ article_id: articleId, views: row?.views ?? 1, counted: true }, "ok", 1, origin);
    }

    return respond(null, "Not Found", 0, origin);
  } catch (e: any) {
    console.error("浏览数接口异常", { module: "view", action: "handler_error", method, path: url.pathname, error: e.message });
    return respond({ error: e.message }, "服务器错误", 0, origin);
  }
}
