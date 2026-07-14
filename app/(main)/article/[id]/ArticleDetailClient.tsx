"use client";

import { useState, useEffect, use } from "react";
import type { ArticleDetailVO } from "@/lib/types";
import { getPublicDetail, addView } from "@/lib/api/article";
import ArticleProse from "@/app/_components/article/ArticleProse";
import ArticleSidebar from "@/app/_components/article/ArticleSidebar";
import ArticleNav from "@/app/_components/article/ArticleNav";
import BackButton from "@/app/_components/article/BackButton";
import ViewCount from "@/app/_components/article/ViewCount";
import CommentSection from "@/app/_components/comment/CommentSection";
import { downloadContentAsZip, downloadMarkdown } from "@/lib/download-content";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";
import Link from "next/link";
import { useContentStore } from "@/stores/contentStore";

export default function ArticleDetailClient(props: { params: Promise<{ id: string }>; articleTitle?: string; initialContent?: string }) {
  const { id } = use(props.params);
  const [article, setArticle] = useState<ArticleDetailVO | null>(null);
  const [viewCount, setViewCount] = useState<number>(0);
  const [liveCommentCount, setLiveCommentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadingMd, setDownloadingMd] = useState(false);
  const [downloadingCover, setDownloadingCover] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getPublicDetail(Number(id));
        setArticle(data);
        if (siteConfig.featureViewCount) {
          addView(Number(id)).then(setViewCount).catch(() => {});
        }
        if (siteConfig.featureComments) {
          fetch(`https://${siteConfig.workerApi}/api/comment/count?path=/article/${id}`)
            .then(r => r.json())
            .then(j => { if (j.code === 1) setLiveCommentCount(j.data.count); })
            .catch(() => {});
        }
      } catch {
        setArticle(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // 分享内容给看板娘
  useEffect(() => {
    if (article) {
      useContentStore.getState().setContent({
        type: "article",
        title: article.title,
        summary: article.summary,
        categoryName: article.categoryName,
        tags: article.tags.map((t) => t.name),
      });
    }
    return () => { useContentStore.getState().clearContent(); };
  }, [article]);

  // API 返回失败且没有 SSR 兜底数据
  if (!loading && !article) return <div className="text-center py-24 text-slate-400">Article not found.</div>;

  // 优先使用 API 数据，SSR 数据做兜底
  const title = article?.title || props.articleTitle || "";
  const displayContent = article?.content || props.initialContent || "";
  const date = article?.createdAt
    ? new Date(article.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <>
      <div className="min-h-screen relative pb-20">
        <div className="flex flex-col lg:flex-row gap-8">
          <article className="flex-1 min-w-0 bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 overflow-hidden">
            {article?.coverImage && (
              <div className="overflow-hidden">
                <img src={assetUrl(article.coverImage)} alt={`${article.title} 封面图`} className="w-full aspect-video object-cover transition-transform duration-700 hover:scale-105" />
              </div>
            )}

            <div className="p-5 md:p-10">
              <BackButton />

              <header className="mb-8">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 dark:text-slate-400 mb-4">
                  {article ? (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {date}
                      </span>
                      {article.categoryName && (
                        <Link href={`/article?categoryId=${article.categoryId}`} className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 font-bold text-[10px] hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                          {article.categoryName}
                        </Link>
                      )}
                      {siteConfig.featureViewCount && <ViewCount count={viewCount} />}
                      {siteConfig.featureComments && (
                        <span>{liveCommentCount ?? article.commentCount} comments</span>
                      )}
                      <button
                        onClick={async () => {
                          setDownloading(true);
                          try {
                            const res = await downloadContentAsZip({
                              title: article.title,
                              content: article.content,
                              coverImage: article.coverImage ? assetUrl(article.coverImage) : undefined,
                              url: `article/${id}`,
                            });
                            const img = res.imageSuccess > 0 ? ` (${res.imageSuccess} images)` : "";
                            showSuccessToast(`"${res.title}" downloaded${img}`);
                          } catch (e) {
                            showErrorToast("Download failed", e instanceof Error ? e.message : undefined);
                          }
                          setDownloading(false);
                        }}
                        disabled={downloading}
                        className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-600 disabled:opacity-50 transition-colors"
                        title="Download as ZIP"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                        </svg>
                        {downloading ? "..." : "Download"}
                      </button>
                      <button
                        onClick={async () => {
                          setDownloadingMd(true);
                          try {
                            downloadMarkdown({ title: article.title, content: article.content, url: `article/${id}`, origin: window.location.origin });
                            showSuccessToast("Markdown downloaded");
                          } catch {
                            showErrorToast("Download failed");
                          }
                          setDownloadingMd(false);
                        }}
                        disabled={downloadingMd}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
                        title="Download as Markdown"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v4a1 1 0 001 1h4M5 12h14M5 16h14M5 20h14" />
                        </svg>
                        {downloadingMd ? "..." : "MD"}
                      </button>
                      {article?.coverImage && (
                        <button
                          onClick={async () => {
                            setDownloadingCover(true);
                            try {
                              const src = assetUrl(article.coverImage!);
                              const resp = await fetch(src);
                              const blob = await resp.blob();
                              const url = URL.createObjectURL(blob);
                              const ext = blob.type.split("/")[1] === "jpeg" ? "jpg" : blob.type.split("/")[1] || "jpg";
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${article.title}-cover.${ext}`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                              showSuccessToast("Cover downloaded");
                            } catch {
                              showErrorToast("Download failed");
                            }
                            setDownloadingCover(false);
                          }}
                          disabled={downloadingCover}
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
                          title="Download cover image"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {downloadingCover ? "..." : "Cover"}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      </span>
                      <span className="w-14 h-4 bg-indigo-100 dark:bg-indigo-900/40 rounded animate-pulse" />
                      <span className="w-12 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      <span className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </>
                  )}
                </div>

                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  {title}
                </h1>

                {article?.summary && (
                  <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed mb-4">{article.summary}</p>
                )}

                {article?.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {article.tags.map((tag) => (
                      <Link key={tag.id} href={`/article?tagId=${tag.id}`} className="text-xs text-pink-500 dark:text-pink-400 font-medium hover:text-pink-600 dark:hover:text-pink-300 transition-colors">
                        #{tag.name}
                      </Link>
                    ))}
                  </div>
                )}
              </header>

              <ArticleProse content={displayContent} />
              {article && <ArticleNav prev={article.prev} next={article.next} />}

              {article && siteConfig.featureComments && (
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                  <CommentSection path={`/article/${id}`} />
                </div>
              )}
            </div>
          </article>

          <ArticleSidebar content={displayContent} />
        </div>
      </div>
    </>
  );
}
