"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Loading from "@/app/_components/common/Loading";
import {
  fetchCommits,
  fetchTotalCommits,
  fetchCommitStats,
  parseCommitMessage,
  getTypeInfo,
  getScope,
  formatDate,
  getMonthKey,
  getMonthLabel,
  type CommitData,
  type CommitStats,
} from "@/lib/growth";

function TypeBadge({ type, color, bg }: { type: string; color: string; bg: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full ${bg}`}
      style={{ color }}
    >
      {type}
    </span>
  );
}

function CommitCard({ commit }: { commit: CommitData }) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<CommitStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const { subject, body } = parseCommitMessage(commit.message);
  const typeInfo = getTypeInfo(subject);
  const scope = getScope(subject);

  const handleToggle = () => {
    if (!body) return;
    const next = !expanded;
    setExpanded(next);
    if (next && !stats && !statsLoading) {
      setStatsLoading(true);
      fetchCommitStats(commit.sha).then((s) => {
        setStats(s);
        setStatsLoading(false);
      });
    }
  };

  return (
    <div
      className="group relative rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-4 md:p-5 transition-all duration-500 hover:shadow-2xl hover:scale-[1.01] cursor-pointer"
      onClick={handleToggle}
    >
      {/* 时间轴连接线 */}
      <div className="absolute -left-[25px] top-6 w-3 h-3 rounded-full border-2 border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900 z-10" />

      <div className="flex items-start gap-3">
        {/* 左侧类型徽章 */}
        <div className="shrink-0 mt-0.5 hidden sm:block">
          <TypeBadge type={typeInfo.type} color={typeInfo.color} bg={typeInfo.bg} />
        </div>

        {/* 主内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              {/* scope 标签 */}
              {scope && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                  {scope}
                </span>
              )}
              {/* subject - 移除 type(scope): 前缀 */}
              <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-white leading-snug">
                {subject.replace(/^\w+(\([^)]*\))?:\s*/, "")}
              </h3>
            </div>
            {/* 展开指示器 */}
            {body && (
              <svg
                className={`w-4 h-4 mt-1 shrink-0 text-slate-400 transition-transform duration-300 ${
                  expanded ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>

          {/* 技术正文 */}
          {body && (
            <div
              className={`overflow-hidden transition-all duration-500 ease-out ${
                expanded ? "max-h-[1000px] opacity-100 mt-3" : "max-h-0 opacity-0"
              }`}
            >
              <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap font-mono bg-black/[0.03] dark:bg-white/[0.03] rounded-xl p-3 md:p-4 border border-slate-200/50 dark:border-slate-700/50">
                {body}
              </div>
              {stats && (
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-emerald-500 font-bold">+{stats.additions.toLocaleString()}</span>
                  <span className="text-red-500 font-bold">-{stats.deletions.toLocaleString()}</span>
                  <span className="text-slate-400">
                    {stats.total.toLocaleString()} 文件变动
                  </span>
                </div>
              )}
              {statsLoading && (
                <div className="mt-2 text-xs text-slate-400 animate-pulse">加载 diff 统计...</div>
              )}
            </div>
          )}

          {/* 底部信息 */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{formatDate(commit.author.date)}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <time dateTime={commit.author.date} className="text-slate-400">
                {new Date(commit.author.date).toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </time>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <code className="text-[10px] text-slate-400 font-mono">{commit.sha.slice(0, 7)}</code>
            </div>
            <a
              href={commit.html_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-slate-400 hover:text-indigo-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthGroup({ monthKey, commits }: { monthKey: string; commits: CommitData[] }) {
  return (
    <div className="relative">
      {/* 月份标题 */}
      <div className="sticky top-20 z-20 mb-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/60 dark:border-slate-700/50 shadow-lg">
          <span className="text-sm font-black text-slate-800 dark:text-white">
            {getMonthLabel(monthKey)}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            已加载 {commits.length} 次提交
          </span>
        </div>
      </div>

      {/* 时间轴 */}
      <div className="relative pl-8 md:pl-10">
        {/* 竖线 */}
        <div className="absolute left-[13px] md:left-[21px] top-3 bottom-0 w-px bg-gradient-to-b from-indigo-400/40 via-indigo-300/20 to-transparent" />

        <div className="flex flex-col gap-4">
          {commits.map((commit) => (
            <CommitCard key={commit.sha} commit={commit} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GrowthClient() {
  const [commits, setCommits] = useState<CommitData[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCommits, setTotalCommits] = useState<number | null>(null);

  useEffect(() => {
    fetchTotalCommits().then(setTotalCommits);
  }, []);

  const load = useCallback(async (p: number) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await fetchCommits(p);
      if (p === 1) {
        setCommits(result.commits);
      } else {
        setCommits((prev) => [...prev, ...result.commits]);
      }
      setHasMore(result.hasMore);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  // 按月份分组
  const groups: Record<string, CommitData[]> = {};
  for (const commit of commits) {
    const key = getMonthKey(commit.author.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(commit);
  }

  if (loading) {
    return (
      <div className="pb-16">
        <div className="mb-8">
          <div className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white">Growth</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            The evolution journey of this blog.
          </p>
        </div>
        <Loading />
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="mb-8">
        <div className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white">Growth</div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Every commit tells a story — trace how this blog evolved, one change at a time.
        </p>
        <div className="flex gap-4 mt-3 text-xs text-slate-400">
          <span>总计 {totalCommits ?? commits.length} 次提交</span>
          <span>·</span>
          <span>{Object.keys(groups).length} 个月</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-10">
        {Object.entries(groups).map(([key, groupCommits]) => (
          <MonthGroup key={key} monthKey={key} commits={groupCommits} />
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loadingMore}
            className="px-6 py-3 text-xs font-bold rounded-xl glass-btn text-slate-500 dark:text-slate-400 hover:text-indigo-500 disabled:opacity-50 transition-all"
          >
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}
