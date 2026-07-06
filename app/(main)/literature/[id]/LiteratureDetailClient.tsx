"use client";

import { useState, useEffect, use, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { OpArticle, OpTag } from "@/lib/types";
import { getArticleList } from "@/lib/api/op";
import BackButton from "@/app/_components/article/BackButton";
import CommentSection from "@/app/_components/comment/CommentSection";
import { tagIconMap } from "@/app/_components/literature/tag-icons";
import { useContentStore } from "@/stores/contentStore";

export default function LiteratureDetailPage(props: { params: Promise<{ id: string }>; articleTitle?: string; initialContent?: string }) {
  const { id } = use(props.params);
  const [item, setItem] = useState<OpArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<OpTag[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getArticleList();
        setAllTags(data.rows);
        const numId = Number(id);
        const found = data.rows
          .flatMap((t) => t.articles)
          .find((a) => a.id === numId || a.title === id);
        setItem(found || null);
      } catch {
        setItem(null);
        setAllTags([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // 分享文学内容给看板娘
  useEffect(() => {
    if (item) {
      const names = allTags.filter((t) => item.tagIds.includes(t.id)).map((t) => t.name);
      useContentStore.getState().setContent({
        type: "literature",
        title: item.title,
        summary: "",
        categoryName: names[0] || "",
        tags: names,
        content: item.content || "",
      });
    }
    return () => { useContentStore.getState().clearContent(); };
  }, [item, allTags]);

  const tagNames = useMemo(() => {
    if (!item) return [];
    return allTags
      .filter((t) => item.tagIds.includes(t.id))
      .map((t) => t.name);
  }, [allTags, item]);

  const relatedArticles = useMemo(() => {
    if (!item || allTags.length === 0) return [];
    const currentTagIds = new Set(item.tagIds);
    const related: OpArticle[] = [];
    const seen = new Set<number>();
    for (const tag of allTags) {
      for (const article of tag.articles) {
        if (article.id === item.id || seen.has(article.id)) continue;
        if (article.tagIds.some((tid) => currentTagIds.has(tid))) {
          related.push(article);
          seen.add(article.id);
        }
      }
    }
    return related.slice(0, 6);
  }, [allTags, item]);

  const [spotXY, setSpotXY] = useState({ x: 50, y: 50 });
  const handleSpotMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSpotXY({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  const displayContent = item?.content || props.initialContent || "";

  // API 返回失败且没有 SSR 兜底数据
  if (!loading && !item) return <div className="text-center py-24 text-slate-400">Work not found.</div>;

  return (
    <>
      <motion.div
      initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      transition={{ ease: [0.25, 0.46, 0.45, 0.94], duration: 0.35 }}
    >
      <div className="max-w-3xl mx-auto">
        <BackButton />

        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 dark:text-white transition-all duration-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:drop-shadow-[0_0_8px_rgba(99,102,241,0.3)]">
            {item?.title || props.articleTitle}
          </h1>

          {item?.writtenAt && (
            <p className="mt-3 text-sm text-slate-400">
              {new Date(item.writtenAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          )}

          {tagNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tagNames.map((name) => (
                <span key={name} className="text-xs text-pink-500 dark:text-pink-400 font-medium">
                  #{name}
                </span>
              ))}
            </div>
          )}
        </header>

        {displayContent && (
          <div className="relative" onMouseMove={handleSpotMove} onMouseLeave={() => setSpotXY({ x: -50, y: -50 })}>
            <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {displayContent}
            </div>
            <div
              className="absolute inset-0 leading-relaxed whitespace-pre-wrap pointer-events-none text-amber-200/90 dark:text-yellow-400/90 drop-shadow-[0_0_3px_rgba(253,230,138,0.6)] dark:drop-shadow-[0_0_3px_rgba(251,191,36,0.5)]"
              style={{
                WebkitMaskImage: `radial-gradient(60px circle at ${spotXY.x}% ${spotXY.y}%, black 20%, transparent 100%)`,
                maskImage: `radial-gradient(60px circle at ${spotXY.x}% ${spotXY.y}%, black 20%, transparent 100%)`,
              }}
            >
              {displayContent}
            </div>
          </div>
        )}

        <div className="mt-8 h-px bg-gradient-to-r from-transparent via-indigo-300/50 dark:via-indigo-500/30 to-transparent" />

        <div className="mt-6 text-center">
          <Link
            href="/literature"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
          >
            ← Back to Literature
          </Link>
        </div>

        {relatedArticles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            {(() => {
              const primaryTag = tagNames[0];
              const info = primaryTag ? tagIconMap[primaryTag] : undefined;
              if (info) {
                const { Icon, color } = info;
                return <Icon className={`w-6 h-6 ${color}`} strokeWidth={1.5} />;
              }
              return <span className="text-indigo-400">◇</span>;
            })()} More in this category
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/literature/${article.id}`}
                  className="block group"
                >
                  <article className="rounded-xl bg-indigo-50/30 dark:bg-indigo-900/10 p-4 h-full transition-all duration-500 hover:bg-indigo-100/40 dark:hover:bg-indigo-800/20">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    {article.writtenAt && (
                      <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(article.writtenAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    )}
                  </article>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12">
          <CommentSection path={`/literature/${id}`} />
        </div>
      </div>
    </motion.div>
    </>
  );
}
