import Link from "next/link";
import type { ArticleVO } from "@/lib/types";
import ViewCount from "./ViewCount";
import { assetUrl } from "@/lib/asset-url";

export default function ArticleCard({ article, viewCount = 0 }: { article: ArticleVO; viewCount?: number }) {
  const date = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <Link href={`/article/${article.id}`} className="block group">
      <article className="glass-card overflow-hidden h-full flex flex-col">
        {article.coverImage && (
          <div className="relative h-48 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(article.coverImage)}
              alt={article.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            {article.isPinned === 1 && (
              <span className="absolute top-3 left-3 px-2 py-0.5 bg-indigo-500/80 backdrop-blur-lg rounded-full text-[10px] font-bold text-white">
                Pinned
              </span>
            )}
          </div>
        )}
        <div className="flex-1 p-5 flex flex-col">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mb-2">
            <span>{article.categoryName}</span>
            <span>·</span>
            <span>{date}</span>
            <span>·</span>
            <ViewCount count={viewCount} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
            {article.title}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1">
            {article.summary}
          </p>
          {article.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span key={tag.id} className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
