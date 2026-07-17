import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchTotalCommits,
  fetchCommits,
  parseCommitMessage,
  getTypeInfo,
  formatDate,
} from "@/lib/growth";
import RecentNotes from "./_components/RecentNotes";
import NotesStats from "./_components/NotesStats";
import SkillsRadar from "./_components/SkillsRadar";

export const metadata: Metadata = {
  title: "个人空间",
  description: "提交记录 · 学习笔记 — 属于我自己的成长空间。",
};

export default async function PersonalPage() {
  const [totalCommits, commitData] = await Promise.all([
    fetchTotalCommits().catch(() => 0),
    fetchCommits(1).catch(() => null),
  ]);

  const commits = commitData?.commits.slice(0, 6) ?? [];

  return (
    <div className="flex-1 w-full min-h-screen py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
      {/* ========== 页面标题 ========== */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">
          📖 个人空间
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          欢迎回来 · 记录属于你自己的成长
        </p>
      </div>

      {/* ========== 统计卡片 ========== */}
      <div className="grid gap-5 sm:grid-cols-2 mb-8">
        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-4 md:p-5">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
            总提交
          </p>
          <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            {totalCommits.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-4 md:p-5">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
            学习笔记
          </p>
          <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            <NotesStats />
          </p>
        </div>
      </div>

      {/* ========== 内容区域 ========== */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近笔记 */}
        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5">
          <Link href="/article" className="group">
            <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-4 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
              📝 最近笔记 →
            </h2>
          </Link>
          <RecentNotes />
        </div>

        {/* 提交动态 */}
        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5">
          <Link href="/personal/commits" className="group">
            <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-4 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
              📊 提交动态 →
            </h2>
          </Link>
          {commits.length > 0 ? (
            <div className="space-y-2">
              {commits.map((c) => {
                const { subject } = parseCommitMessage(c.message);
                const { color: typeColor } = getTypeInfo(subject);
                return (
                  <a
                    key={c.sha}
                    href={c.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 group"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                      style={{ backgroundColor: typeColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                        {subject}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatDate(c.author.date)}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
              暂无提交记录
            </p>
          )}
        </div>
      </div>

      {/* ========== 技能星空 ========== */}
      <div className="mt-6">
        <SkillsRadar />
      </div>

    </div>
  );
}
