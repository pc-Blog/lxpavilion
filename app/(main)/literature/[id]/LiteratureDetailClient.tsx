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

/* ── 复制按钮 ── */
function CopyButton({ title, content }: { title: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    const text = `${title}\n\n${content}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } else {
      // fallback: 非安全上下文（HTTP）下 clipboard API 不可用
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [title, content]);

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
      aria-label="复制全文"
    >
      {copied ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
        </svg>
      )}
    </button>
  );
}

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
    // 取主要分类
    const primaryTag = allTags.find((t) => t.id === item.tagIds[0]);
    if (!primaryTag) return [];
    // 按 writtenAt 降序排列
    const sorted = [...primaryTag.articles].sort(
      (a, b) => new Date(b.writtenAt || 0).getTime() - new Date(a.writtenAt || 0).getTime()
    );
    const idx = sorted.findIndex((a) => a.id === item.id);
    if (idx === -1) return [];
    // 从当前位置向两侧扩展，取前 3 + 后 3
    const result: OpArticle[] = [];
    let left = idx - 1;
    let right = idx + 1;
    while (result.length < 6 && (left >= 0 || right < sorted.length)) {
      if (left >= 0) {
        result.push(sorted[left]);
        left--;
      }
      if (right < sorted.length && result.length < 6) {
        result.push(sorted[right]);
        right++;
      }
    }
    return result;
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
            <div className="flex items-center gap-2 mt-3">
              <p className="text-sm text-slate-400">
                {new Date(item.writtenAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              <CopyButton title={item?.title || props.articleTitle || ""} content={displayContent} />
            </div>
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
