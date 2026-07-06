import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import LiteratureDetailClient from "./LiteratureDetailClient";
import { OG_TITLE_SUFFIX, defaultOgImage, breadcrumbSchema, jsonLdSchema, SITE_URL } from "@/lib/seo";

function findLiterature(id: string) {
  try {
    const p = path.join(process.cwd(), "public", "data", "op-articles.json");
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw) as { rows: { articles: { id: number; title: string; content?: string; writtenAt?: string }[] }[] };
    for (const tag of data.rows || []) {
      const found = tag.articles?.find((a) => String(a.id) === id);
      if (found) return found;
    }
  } catch { /* skip */ }
  return null;
}

export function generateStaticParams() {
  const p = path.join(process.cwd(), "public", "data", "op-articles.json");
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf-8");
  const data = JSON.parse(raw) as { rows: { articles: { id: number }[] }[] };
  const ids: number[] = [];
  for (const tag of data.rows || []) {
    for (const a of tag.articles || []) {
      if (a.id != null) ids.push(a.id);
    }
  }
  return ids.map((id) => ({ id: String(id) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = findLiterature(id);
  if (found) return {
    title: found.title,
    description: found.content?.slice(0, 200) || "",
    alternates: {
      canonical: `/literature/${id}/`,
    },
    openGraph: {
      title: `${found.title} ${OG_TITLE_SUFFIX}`,
      description: found.content?.slice(0, 200) || "",
      images: [{ url: `${SITE_URL}${defaultOgImage}`, width: 1200, height: 630 }],
    },
  };
  return { title: "Literature" };
}

export default async function LiteratureDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const found = findLiterature(id);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "文学创作", path: "/literature" },
            { name: found?.title || "作品", path: `/literature/${id}` },
          ])),
        }}
      />
      {found && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdSchema("CreativeWork", found.title, found.content?.slice(0, 200), found.writtenAt)),
          }}
        />
      )}
      <LiteratureDetailClient params={props.params} articleTitle={found?.title || ""} initialContent={found?.content || ""} />
    </>
  );
}
