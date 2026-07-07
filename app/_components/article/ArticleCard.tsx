import Link from "next/link";
import type { ArticleVO } from "@/lib/types";
import ViewCount from "./ViewCount";
import { siteConfig } from "@/lib/siteConfig";
import { assetUrl } from "@/lib/asset-url";

const THEMES = [
  {
    bg: "from-white/80 to-indigo-50/80 dark:from-indigo-950/40 dark:to-purple-950/40",
    accent: "from-indigo-400 to-purple-400 dark:from-indigo-500/20 dark:to-purple-500/20",
    glow: "bg-indigo-100/60 dark:bg-indigo-500/20",
    text: "bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-300 dark:to-purple-300",
    border: "border-indigo-200 dark:border-indigo-500/15",
  },
  {
    bg: "from-white/80 to-emerald-50/80 dark:from-emerald-950/40 dark:to-teal-950/40",
    accent: "from-emerald-400 to-teal-400 dark:from-emerald-500/20 dark:to-teal-500/20",
    glow: "bg-emerald-100/60 dark:bg-emerald-500/20",
    text: "bg-gradient-to-br from-emerald-600 to-teal-600 dark:from-emerald-300 dark:to-teal-300",
    border: "border-emerald-200 dark:border-emerald-500/15",
  },
  {
    bg: "from-white/80 to-amber-50/80 dark:from-amber-950/40 dark:to-orange-950/40",
    accent: "from-amber-400 to-orange-400 dark:from-amber-500/20 dark:to-orange-500/20",
    glow: "bg-amber-100/60 dark:bg-amber-500/20",
    text: "bg-gradient-to-br from-amber-600 to-orange-600 dark:from-amber-300 dark:to-orange-300",
    border: "border-amber-200 dark:border-amber-500/15",
  },
  {
    bg: "from-white/80 to-sky-50/80 dark:from-sky-950/40 dark:to-blue-950/40",
    accent: "from-sky-400 to-blue-400 dark:from-sky-500/20 dark:to-blue-500/20",
    glow: "bg-sky-100/60 dark:bg-sky-500/20",
    text: "bg-gradient-to-br from-sky-600 to-blue-600 dark:from-sky-300 dark:to-blue-300",
    border: "border-sky-200 dark:border-sky-500/15",
  },
  {
    bg: "from-white/80 to-rose-50/80 dark:from-rose-950/40 dark:to-pink-950/40",
    accent: "from-rose-400 to-pink-400 dark:from-rose-500/20 dark:to-pink-500/20",
    glow: "bg-rose-100/60 dark:bg-rose-500/20",
    text: "bg-gradient-to-br from-rose-600 to-pink-600 dark:from-rose-300 dark:to-pink-300",
    border: "border-rose-200 dark:border-rose-500/15",
  },
  {
    bg: "from-white/80 to-violet-50/80 dark:from-violet-950/40 dark:to-fuchsia-950/40",
    accent: "from-violet-400 to-fuchsia-400 dark:from-violet-500/20 dark:to-fuchsia-500/20",
    glow: "bg-violet-100/60 dark:bg-violet-500/20",
    text: "bg-gradient-to-br from-violet-600 to-fuchsia-600 dark:from-violet-300 dark:to-fuchsia-300",
    border: "border-violet-200 dark:border-violet-500/15",
  },
];

function getTheme(id: number) {
  return THEMES[id % THEMES.length];
}

export default function ArticleCard({ article, viewCount = 0 }: { article: ArticleVO; viewCount?: number }) {
  const date = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const theme = getTheme(article.id);

  return (
    <Link href={`/article/${article.id}`} className="block group">
      <article className="glass-card overflow-hidden h-full flex flex-col">
        {article.coverImage ? (
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
        ) : (
          <div className={`relative h-48 overflow-hidden bg-gradient-to-br ${theme.bg}`}>
            {/* 顶部主题色装饰线 */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.accent}`} />
            {/* 装饰光晕 */}
            <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl ${theme.glow}`} />
            <div className={`absolute -bottom-6 -left-6 w-28 h-28 rounded-full blur-2xl ${theme.glow}`} />
            {/* 装饰内边框 */}
            <div className={`absolute inset-3 border rounded-xl ${theme.border}`} />
            {/* 底部渐变遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-white/10 to-transparent dark:from-black/60 dark:via-black/20 dark:to-transparent" />
            {article.isPinned === 1 && (
              <span className="absolute top-3 left-3 px-2 py-0.5 bg-indigo-500/80 backdrop-blur-lg rounded-full text-[10px] font-bold text-white z-10">
                Pinned
              </span>
            )}
            {/* 文章标题 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`${theme.text} text-2xl font-black tracking-wide bg-clip-text text-transparent drop-shadow-sm dark:drop-shadow-lg text-center px-4`}>
                {article.title}
              </span>
            </div>
          </div>
        )}
        <div className="flex-1 p-5 flex flex-col">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mb-2">
            <span>{article.categoryName}</span>
            <span>·</span>
            <span>{date}</span>
            <span>·</span>
            {siteConfig.featureViewCount && <ViewCount count={viewCount} />}
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
