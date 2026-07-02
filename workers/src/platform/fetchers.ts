import type { Env, CSDNData, JuejinData, CnblogsData, PlatformArticle } from "../types";

// ── CSDN ──

export async function fetchCSDN(env: Env): Promise<CSDNData | null> {
  if (!env.CSDN_USER) {
    console.warn("CSDN 未配置用户名", { module: "platform", platform: "csdn", action: "skip" });
    return null;
  }

  const url = "https://blog.csdn.net/community/home-api/v1/get-business-list";
  const params = {
    page: "1",
    size: "100",
    businessType: "blog",
    username: env.CSDN_USER,
  };

  console.log("CSDN 开始请求", { module: "platform", platform: "csdn", action: "fetch", username: env.CSDN_USER });

  const resp = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: `https://blog.csdn.net/${env.CSDN_USER}`,
    },
  });

  if (!resp.ok) {
    console.error("CSDN 请求失败", { module: "platform", platform: "csdn", action: "error", status: resp.status });
    throw new Error(`CSDN HTTP ${resp.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = await resp.json();
  const list = data?.data?.list || [];

  console.log("CSDN 请求成功", { module: "platform", platform: "csdn", action: "success", status: resp.status, articles: list.length });

  return {
    articleCount: list.length,
    totalViews: list.reduce((s: number, a: Record<string, any>) => s + (a.viewCount || 0), 0),
    totalLikes: list.reduce((s: number, a: Record<string, any>) => s + (a.diggCount || 0), 0),
    totalComments: list.reduce((s: number, a: Record<string, any>) => s + (a.commentCount || 0), 0),
    totalCollects: list.reduce((s: number, a: Record<string, any>) => s + (a.collectCount || 0), 0),
    articles: list.map((a: Record<string, any>) => ({
      platform: "csdn",
      title: a.title || "",
      url: a.url || "",
      date: a.createTime ? a.createTime.slice(0, 10) : "",
      views: a.viewCount || 0,
      likes: a.diggCount || 0,
    })),
  };
}

// ── 掘金 ──

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10);
}

export async function fetchJuejin(env: Env): Promise<JuejinData | null> {
  if (!env.JUEJIN_USER_ID) {
    console.warn("掘金未配置用户 ID", { module: "platform", platform: "juejin", action: "skip" });
    return null;
  }

  // 用户信息
  console.log("掘金开始请求用户信息", { module: "platform", platform: "juejin", action: "fetch_user" });
  const userResp = await fetch(
    `https://api.juejin.cn/user_api/v1/user/get?user_id=${env.JUEJIN_USER_ID}`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userJson: Record<string, any> = await userResp.json();
  const user = userJson?.data || {};

  // 文章列表（分页）
  const allArticles: Record<string, any>[] = [];
  let cursor = "0";

  while (true) {
    const artResp = await fetch(
      "https://api.juejin.cn/content_api/v1/article/query_list",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
        body: JSON.stringify({ user_id: env.JUEJIN_USER_ID, sort_type: 2, cursor }),
      }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artJson: Record<string, any> = await artResp.json();
    const items = artJson?.data || [];
    if (items.length === 0) break;
    allArticles.push(...items);
    if (!artJson.has_more) break;
    cursor = String(Number(cursor) + 10);
  }

  console.log("掘金请求成功", { module: "platform", platform: "juejin", action: "success", articles: allArticles.length, views: user.got_view_count ?? 0 });

  return {
    articleCount: allArticles.length,
    totalViews: user.got_view_count || 0,
    totalLikes: user.got_digg_count || 0,
    totalCollects: allArticles.reduce(
      (s, item) => s + ((item.article_info?.collect_count) || 0),
      0
    ),
    followers: user.follower_count || 0,
    articles: allArticles.map((item) => {
      const info = item.article_info || {};
      return {
        platform: "juejin",
        title: info.title || "",
        url: `https://juejin.cn/post/${info.article_id}`,
        date: info.ctime ? formatDate(info.ctime) : "",
        views: info.view_count || 0,
        likes: info.digg_count || 0,
      };
    }),
  };
}

// ── 博客园 ──

export async function fetchCnblogs(env: Env): Promise<CnblogsData | null> {
  if (!env.CNBLOGS_BLOGAPP) {
    console.warn("博客园未配置 blogApp", { module: "platform", platform: "cnblogs", action: "skip" });
    return null;
  }

  const baseUrl = `https://www.cnblogs.com/${env.CNBLOGS_BLOGAPP}`;
  const allArticles: PlatformArticle[] = [];

  console.log("博客园开始请求", { module: "platform", platform: "cnblogs", action: "fetch" });

  for (let page = 1; page <= 100; page++) {
    const resp = await fetch(`${baseUrl}/default.html?page=${page}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!resp.ok) {
      console.warn("博客园页面请求失败", { module: "platform", platform: "cnblogs", action: "page_error", page, status: resp.status });
      break;
    }

    const html = await resp.text();

    const articleRegex =
      /<a class="postTitle2[^"]*"[^>]*href="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>/g;
    const viewRegex = /阅读\((\d+)\)/g;
    const diggRegex = /推荐\((\d+)\)/g;
    const commentRegex = /评论\((\d+)\)/g;
    const dateRegex = /posted @ (\d{4}-\d{2}-\d{2})/g;

    const titles = [...html.matchAll(articleRegex)];
    if (titles.length === 0) {
      console.log("博客园本页无文章", { module: "platform", platform: "cnblogs", action: "page_empty", page });
      break;
    }

    const views = [...html.matchAll(viewRegex)].map((m) => Number(m[1]));
    const diggs = [...html.matchAll(diggRegex)].map((m) => Number(m[1]));
    const comments = [...html.matchAll(commentRegex)].map((m) => Number(m[1]));
    const dates = [...html.matchAll(dateRegex)].map((m) => m[1].trim());

    for (let i = 0; i < titles.length; i++) {
      const dateStr = dates[i] || "";
      const date = dateStr.slice(0, 10);
      allArticles.push({
        platform: "cnblogs",
        title: titles[i][2],
        url: titles[i][1].startsWith("http")
          ? titles[i][1]
          : `${baseUrl}${titles[i][1]}`,
        date,
        views: views[i] || 0,
        likes: diggs[i] || 0,
        comments: comments[i] || 0,
      });
    }

    console.log("博客园页面解析完成", { module: "platform", platform: "cnblogs", action: "page_done", page, articles: titles.length });

    if (!html.includes(">下一页<") && !html.includes(">Next<")) {
      console.log("博客园无更多页", { module: "platform", platform: "cnblogs", action: "no_more_page", page });
      break;
    }
  }

  console.log("博客园请求完成", { module: "platform", platform: "cnblogs", action: "success", articles: allArticles.length });

  return {
    articleCount: allArticles.length,
    totalViews: allArticles.reduce((s, a) => s + a.views, 0),
    totalLikes: allArticles.reduce((s, a) => s + a.likes, 0),
    totalComments: allArticles.reduce((s, a) => s + (a.comments || 0), 0),
    articles: allArticles,
  };
}
