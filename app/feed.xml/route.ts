import fs from "fs";
import path from "path";
import { siteConfig } from "@/lib/siteConfig";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
const AUTHOR_NAME = siteConfig.authorName || "Author";

interface ArticleItem {
  id: number;
  title: string;
  summary?: string;
  content?: string;
  categoryName?: string;
  tags?: { id: number; name: string }[];
  createdAt?: string;
}

export async function GET() {
  const p = path.join(process.cwd(), "public", "data", "articles.json");
  let articles: ArticleItem[] = [];
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw) as { rows: ArticleItem[] };
    articles = data.rows || [];
  } catch {}

  const items = articles.slice(0, 20).map((a) => {
    const link = `${SITE_URL}/article/${a.id}/`;
    const date = a.createdAt ? new Date(a.createdAt) : new Date();
    return `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${date.toUTCString()}</pubDate>
      <description><![CDATA[${a.summary || a.content?.slice(0, 200) || ""}]]></description>
      ${a.categoryName ? `<category>${a.categoryName}</category>` : ""}
      ${a.tags?.length ? a.tags.map(t => `<tag>${t.name}</tag>`).join("\n      ") : ""}
      <author>${AUTHOR_NAME}</author>
    </item>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteConfig.title}</title>
    <link>${SITE_URL}</link>
    <description>${siteConfig.seoDescription}</description>
    <language>zh-CN</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
