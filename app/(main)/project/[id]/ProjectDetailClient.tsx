"use client";

import { useState, useEffect, use } from "react";
import type { ProjectDetailVO } from "@/lib/types";
import { getPublicDetail } from "@/lib/api/project";
import ArticleProse from "@/app/_components/article/ArticleProse";
import ArticleSidebar from "@/app/_components/article/ArticleSidebar";
import ArticleNav from "@/app/_components/article/ArticleNav";
import BackButton from "@/app/_components/article/BackButton";
import CommentSection from "@/app/_components/comment/CommentSection";
import { downloadContentAsZip, downloadMarkdown } from "@/lib/download-content";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { assetUrl } from "@/lib/asset-url";
import { useContentStore } from "@/stores/contentStore";
import ScrollProgress from "@/app/_components/common/ScrollProgress";

export default function ProjectDetailClient(props: { params: Promise<{ id: string }>; projectName?: string; initialContent?: string }) {
  const { id } = use(props.params);
  const [project, setProject] = useState<ProjectDetailVO | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadingMd, setDownloadingMd] = useState(false);
  const [downloadingCover, setDownloadingCover] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getPublicDetail(Number(id));
        setProject(data);
      } catch {
        setProject(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // 分享内容给看板娘
  useEffect(() => {
    if (project) {
      useContentStore.getState().setContent({
        type: "project",
        title: project.name,
        summary: project.summary,
        categoryName: project.categoryName,
        tags: project.techs.map((t) => t.name),
        hasDemo: !!project.demoUrl,
        hasGithub: !!project.githubUrl,
      });
    }
    return () => { useContentStore.getState().clearContent(); };
  }, [project]);

  // API 返回失败且没有 SSR 兜底数据
  if (!loading && !project) return <div className="text-center py-24 text-slate-400">Project not found.</div>;

  const title = project?.name || props.projectName || "";
  const displayContent = project?.content || props.initialContent || "";

  return (
    <>
      <div className="min-h-screen relative pb-20">
        <div className="flex flex-col lg:flex-row gap-8">
          <article className="flex-1 min-w-0 bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 overflow-hidden">
            {project?.coverImage && (
              <div className="overflow-hidden">
                <img src={assetUrl(project.coverImage)} alt={`${project.name} 项目截图`} className="w-full aspect-video object-cover transition-transform duration-700 hover:scale-105" />
              </div>
            )}

            <div className="p-5 md:p-10">
              <BackButton />

              <header className="mb-8">
                {project?.categoryName && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-500 font-bold text-[10px] mb-3">
                    {project.categoryName}
                  </span>
                )}

                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight mb-4">
                  {title}
                </h1>

                {project?.summary && (
                  <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed mb-4">{project.summary}</p>
                )}

                {project?.techs && project.techs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.techs.map((t) => (
                      <span key={t.id} className="text-xs text-pink-500 dark:text-pink-400 font-medium">
                        #{t.name}
                      </span>
                    ))}
                  </div>
                )}

                {project ? (
                  <div className="flex flex-wrap gap-3">
                    {project.githubUrl && (
                      <a href={project.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-800 dark:bg-slate-700 text-white text-sm font-bold hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
                        GitHub
                      </a>
                    )}
                    {project.demoUrl && (
                      <a href={project.demoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Demo
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        setDownloading(true);
                        try {
                          const res = await downloadContentAsZip({
                            title: project.name,
                            content: project.content || "",
                            coverImage: project.coverImage ? assetUrl(project.coverImage) : undefined,
                            url: `project/${id}`,
                          });
                          const img = res.imageSuccess > 0 ? ` (${res.imageSuccess} images)` : "";
                          showSuccessToast(`"${res.title}" downloaded${img}`);
                        } catch (e) {
                          showErrorToast("Download failed", e instanceof Error ? e.message : undefined);
                        }
                        setDownloading(false);
                      }}
                      disabled={downloading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-500 disabled:opacity-50 transition-colors"
                      title="Download as ZIP"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      {downloading ? "..." : "Download"}
                    </button>
                    <button
                      onClick={async () => {
                        setDownloadingMd(true);
                        try {
                          downloadMarkdown({ title: project.name, content: project.content || "", url: `project/${id}`, origin: window.location.origin });
                          showSuccessToast("Markdown downloaded");
                        } catch {
                          showErrorToast("Download failed");
                        }
                        setDownloadingMd(false);
                      }}
                      disabled={downloadingMd}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-500 disabled:opacity-50 transition-colors"
                      title="Download as Markdown"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v4a1 1 0 001 1h4M5 12h14M5 16h14M5 20h14" />
                      </svg>
                      {downloadingMd ? "..." : "MD"}
                    </button>
                      {project?.coverImage && (
                        <button
                          onClick={async () => {
                            setDownloadingCover(true);
                            try {
                              const src = assetUrl(project.coverImage!);
                              const resp = await fetch(src);
                              const blob = await resp.blob();
                              const url = URL.createObjectURL(blob);
                              const ext = blob.type.split("/")[1] === "jpeg" ? "jpg" : blob.type.split("/")[1] || "jpg";
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${project.name}-cover.${ext}`;
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
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-500 disabled:opacity-50 transition-colors"
                          title="Download cover image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {downloadingCover ? "..." : "Cover"}
                        </button>
                      )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse w-24 h-9" />
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-200 dark:bg-indigo-700/50 animate-pulse w-20 h-9" />
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse w-24 h-9" />
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse w-16 h-9" />
                  </div>
                )}
              </header>

              {displayContent && <ArticleProse content={displayContent} />}
              {project && <ArticleNav prev={project.prev} next={project.next} basePath="/project" />}

              {project && (
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                  <CommentSection path={`/project/${id}`} />
                </div>
              )}
            </div>
          </article>

          <ArticleSidebar content={displayContent} />
        </div>
      </div>
      <ScrollProgress />
    </>
  );
}
