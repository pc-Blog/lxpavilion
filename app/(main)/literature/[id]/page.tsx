import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import LiteratureDetailClient from "./LiteratureDetailClient";
import { OG_TITLE_SUFFIX, defaultOgImage, breadcrumbSchema, jsonLdSchema, SITE_URL } from "@/lib/seo";
import { siteConfig } from "@/lib/siteConfig";

/** 静态导出时由 github-sync 写入的平铺数据文件 */
const DATA_FILE = path.join(process.cwd(), "public", "data", "literature.json");

interface StaticLiterature {
  id: number;
  title: string;
  content?: string;
  writtenAt?: string;
}

function readStaticList(): StaticLiterature[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(raw) as { rows?: StaticLiterature[] };
    return data.rows ?? [];
  } catch {
    return [];
  }
}

function findLiterature(id: string): StaticLiterature | null {
  return readStaticList().find((a) => String(a.id) === id) ?? null;
}

export function generateStaticParams() {
  const ids = readStaticList()
    .filter((a) => a.id != null)
    .map((a) => ({ id: String(a.id) }));
  // Next 16.3+ 在 output: export 下禁止返回空数组（PR #95969）：
  // 静态导出时若 public/data/literature.json 不存在（例如 CI 尚未同步数据分支），
  // 生成一个占位 id 使构建通过；动态模式维持原行为。
  if (ids.length === 0 && process.env.STATIC_EXPORT === "true") {
    return [{ id: "0" }];
  }
  return ids;
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
  if (!siteConfig.featureLiterature) {
    return (
      <div className="flex-1 w-full mt-28 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pb-20">
        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-12 text-center">
          <div className="text-4xl mb-4">📖</div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">Literature</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">该功能未启用。</p>
        </div>
      </div>
    );
  }

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
