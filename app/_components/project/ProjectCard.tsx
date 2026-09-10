"use client";

import type { ProjectVO } from "@/lib/types";
import { DEFAULT_LANGUAGE_COLOR, LANGUAGE_COLORS, formatRelativeTime, normalizeHomeUrl, repoLabel } from "@/lib/github-repo";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import type { ProjectRepoInfo } from "./ProjectList";

const ACCENTS = [
  { badge: "from-indigo-500 to-purple-500" },
  { badge: "from-emerald-500 to-teal-500" },
  { badge: "from-amber-500 to-orange-500" },
  { badge: "from-sky-500 to-blue-500" },
  { badge: "from-rose-500 to-pink-500" },
  { badge: "from-violet-500 to-fuchsia-500" },
];

function getAccent(id: number) {
  return ACCENTS[id % ACCENTS.length];
}

/** 环形扇形图（recharts，风格对齐分析页）：无中心文字、无图例，悬浮扇区时弹出 + Tooltip 显示语言与占比 */
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="none" opacity={0.2} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 5} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="white" strokeWidth={2.5} />
    </g>
  );
};

function LangTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; pct: number } }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-white/40 dark:border-white/10 shadow-xl px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-white">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LANGUAGE_COLORS[item.name] || DEFAULT_LANGUAGE_COLOR }} />
        {item.name}
      </span>
      <span className="ml-2 font-black text-indigo-600 dark:text-indigo-400">{item.pct}%</span>
    </div>
  );
}

function DonutChart({ languages }: { languages: Record<string, number> }) {
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return null;

  const top = entries.slice(0, 4);
  const topSum = top.reduce((s, [, v]) => s + v, 0);
  const other = total - topSum;
  const segments: [string, number][] = [...top, ...(other > 0 ? [["Other", other] as [string, number]] : [])];
  const data = segments.map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }));

  return (
    <div className="w-full" style={{ height: 130 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={33}
            outerRadius={46}
            paddingAngle={3}
            dataKey="value"
            isAnimationActive
            animationDuration={600}
            animationEasing="ease-out"
            activeShape={renderActiveShape}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={LANGUAGE_COLORS[d.name] || DEFAULT_LANGUAGE_COLOR} />
            ))}
          </Pie>
          <Tooltip content={<LangTooltip />} cursor={false} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ProjectCard({ project, info }: { project: ProjectVO; info: ProjectRepoInfo | null }) {
  const accent = getAccent(project.id);
  const href = project.githubUrl || "#";
  const fallbackLabel = repoLabel(project.githubUrl);
  const displayName = info?.name || fallbackLabel;
  const createdYear = info?.createdAt ? new Date(info.createdAt).getFullYear() : null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col h-full rounded-3xl bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl overflow-hidden hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all duration-700 p-6 md:p-8"
    >
      {/* 装饰性光晕 */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors duration-700" />

      {/* 头部：徽标 + 名称 + 主页图标 + GitHub 图标 */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="flex items-center gap-4 min-w-0">
          <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${accent.badge} flex items-center justify-center text-white text-lg font-black shadow-md flex-shrink-0`}>
            {displayName.charAt(0).toUpperCase()}
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
            {displayName}
          </h2>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {info?.homepage && (
            <a
              href={normalizeHomeUrl(info.homepage)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="主页 / Demo"
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </a>
          )}
          <svg className="w-7 h-7 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
        </div>
      </div>

      {/* 描述(3) + 环形扇形图(1) —— 左右 3:1 */}
      <div className="flex items-center gap-4 relative z-10 flex-1 mb-4">
        <p className="flex-[3] text-sm text-slate-700 dark:text-slate-300 font-serif leading-relaxed line-clamp-4 min-w-0">
          {info?.description || ""}
        </p>
        {info?.languages && Object.keys(info.languages).length > 0 && (
          <div className="flex-1 flex items-center justify-center">
            <DonutChart languages={info.languages} />
          </div>
        )}
      </div>

      {/* star 等信息行 */}
      {info && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 relative z-10">
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
          {info.pushedAt && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatRelativeTime(info.pushedAt)}
            </span>
          )}
          {createdYear && (
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">始于 {createdYear}</span>
          )}
          {info.license && (
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {info.license}
            </span>
          )}
          {info.archived && (
            <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
              已归档
            </span>
          )}
        </div>
      )}

      {/* 官方 Topics 标签 */}
      {info && info.topics.length > 0 && (
        <div className="flex flex-wrap gap-2 relative z-10">
          {info.topics.slice(0, 8).map((topic) => (
            <span key={topic} className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-md border border-indigo-500/20 shadow-sm">
              {topic}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}