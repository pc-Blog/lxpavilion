"use client";

import { useState, useEffect } from "react";
import type { GitHubRepoInfo, ProjectVO } from "@/lib/types";
import { fetchRepoInfo, repoLabel } from "@/lib/github-repo";

const ACCENTS = [
  { badge: "from-indigo-500 to-purple-500", text: "text-indigo-600 dark:text-indigo-400" },
  { badge: "from-emerald-500 to-teal-500", text: "text-emerald-600 dark:text-emerald-400" },
  { badge: "from-amber-500 to-orange-500", text: "text-amber-600 dark:text-amber-400" },
  { badge: "from-sky-500 to-blue-500", text: "text-sky-600 dark:text-sky-400" },
  { badge: "from-rose-500 to-pink-500", text: "text-rose-600 dark:text-rose-400" },
  { badge: "from-violet-500 to-fuchsia-500", text: "text-violet-600 dark:text-violet-400" },
];

function getAccent(id: number) {
  return ACCENTS[id % ACCENTS.length];
}

function useRepoInfo(url?: string) {
  const [info, setInfo] = useState<GitHubRepoInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      setInfo(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchRepoInfo(url).then((r) => {
      if (cancelled) return;
      setInfo(r);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [url]);

  return { info, loading };
}

export default function ProjectCard({ project }: { project: ProjectVO }) {
  const accent = getAccent(project.id);
  const href = project.githubUrl || "#";
  const { info, loading } = useRepoInfo(project.githubUrl);
  const fallbackLabel = repoLabel(project.githubUrl);
  const failed = !loading && !info;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col h-full rounded-3xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl overflow-hidden hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all duration-700 p-6 md:p-8"
    >
      {/* 装饰性光晕 */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors duration-700" />

      {/* 头部：徽标 + 名称 + GitHub 图标 */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="flex items-center gap-4 min-w-0">
          {loading ? (
            <span className="w-12 h-12 rounded-2xl bg-slate-200/70 dark:bg-slate-700/50 animate-pulse flex-shrink-0" />
          ) : (
            <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${accent.badge} flex items-center justify-center text-white text-lg font-black shadow-md flex-shrink-0`}>
              {(info?.name || fallbackLabel).charAt(0).toUpperCase()}
            </span>
          )}
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
            {loading ? (
              <span className="inline-block w-40 h-6 bg-slate-200/70 dark:bg-slate-700/50 animate-pulse rounded align-middle" />
            ) : (
              info?.name || fallbackLabel
            )}
          </h2>
        </div>
        <svg className="w-7 h-7 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      </div>

      {/* 描述（等高对齐） */}
      <p className="text-sm text-slate-700 dark:text-slate-300 font-serif leading-relaxed line-clamp-3 mb-4 relative z-10 min-h-[60px] flex-1">
        {loading ? (
          <span className="inline-block w-full h-4 bg-slate-200/70 dark:bg-slate-700/50 animate-pulse rounded" />
        ) : (
          info?.description || (failed ? fallbackLabel : "")
        )}
      </p>

      {/* 星标 / 分支（GitHub API） */}
      {!loading && info && (
        <div className="flex items-center gap-4 mb-4 relative z-10">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            {info.stargazersCount}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
            <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.5 4a2.5 2.5 0 10.56 4.91 7.05 7.05 0 014.7 6.34 2.5 2.5 0 101.57-.12A8.6 8.6 0 0015.5 4.5a2.5 2.5 0 00-1-.5zM5 6.5A2.5 2.5 0 104 11.5a8.6 8.6 0 005.66 7.65 2.5 2.5 0 10.66-4.91A7.05 7.05 0 017 9.06 2.5 2.5 0 005 6.5z" />
            </svg>
            {info.forksCount}
          </span>
          {info.language && (
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{info.language}</span>
          )}
        </div>
      )}

      {/* 标签 */}
      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 relative z-10">
          {project.tags.map((tag) => (
            <span key={tag.id} className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-md border border-indigo-500/20 shadow-sm">
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}