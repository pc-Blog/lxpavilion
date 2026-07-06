import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import ArticleDetailClient from "./ArticleDetailClient";
import { OG_TITLE_SUFFIX, defaultOgImage, breadcrumbSchema, jsonLdSchema, SITE_URL } from "@/lib/seo";

function readArticle(id: string) {
  try {
    const p = path.join(process.cwd(), "public", "data", "articles", `${id}.json`);
    return JSON.parse(fs.readFileSync(p, "utf-8")) as { title: string; summary?: string; coverImage?: string; content?: string; createdAt?: string; updateTime?: string };
  } catch { return null; }
}

function getArticleDate(id: string): string | undefined {
  try {
    const p = path.join(process.cwd(), "public", "data", "articles.json");
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw) as { rows: { id: number; createdAt?: string }[] };
    return data.rows?.find(a => String(a.id) === id)?.createdAt;
  } catch { return undefined; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = readArticle(id);
  if (!data) return { title: "Article" };
  const imgUrl = data.coverImage || defaultOgImage;
  const images = [{ url: imgUrl.startsWith("http") ? imgUrl : `${SITE_URL}${imgUrl}`, width: 1200, height: 630 }];
  return {
    title: data.title,
    description: data.summary || "",
    alternates: {
      canonical: `/article/${id}/`,
    },
    openGraph: {
      title: `${data.title} ${OG_TITLE_SUFFIX}`,
      description: data.summary || "",
      images,
    },
  };
}

export function generateStaticParams() {
  const p = path.join(process.cwd(), "public", "data", "articles.json");
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, "utf-8")) as { rows: { id: number }[] };
  return (data.rows || []).map((a) => ({ id: String(a.id) }));
}

export default async function ArticleDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const data = readArticle(id);
  const articleDate = getArticleDate(id);
  const coverUrl = data?.coverImage
    ? (data.coverImage.startsWith("http") ? data.coverImage : `${SITE_URL}${data.coverImage}`)
    : undefined;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "技术文章", path: "/article" },
            { name: data?.title || "文章", path: `/article/${id}` },
          ])),
        }}
      />
      {data && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdSchema("Article", data.title, data.summary, articleDate, coverUrl, data.updateTime)),
          }}
        />
      )}
      <ArticleDetailClient params={props.params} articleTitle={data?.title || ""} initialContent={data?.content || ""} />
    </>
  );
}
