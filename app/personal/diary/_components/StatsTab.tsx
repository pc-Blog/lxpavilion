"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DiaryStats } from "@/lib/types";
import { categoryColor, categoryLabel } from "./constants";

const MONTHS_CN = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];
/** 周一起始的星期表头，与 getDayIndex 的映射一致 */
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** 0=无记录，1=1条，2=2条，3=3条及以上 */
function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count >= 3) return 3;
  return count;
}

const LEVEL_BG = [
  "bg-slate-200/50 dark:bg-slate-700/40",
  "bg-indigo-200/70 dark:bg-indigo-900/50",
  "bg-indigo-400/80 dark:bg-indigo-700/70",
  "bg-indigo-600 dark:bg-indigo-500",
];

/**
 * 统计 tab —— 对应源项目 views/stats
 *
 * 源用 ECharts 画日历热力图 + 环形图 + 条形图；这里改用项目已装的 recharts
 * 画后两者，日历热力图先用原生日期格子重写（不额外引入 echarts）。
 */
export default function StatsTab({ stats }: { stats: DiaryStats | null }) {
  /** 年 → 月 → [日, 条目数][] */
  const calendar = useMemo(() => {
    const byYear = new Map<number, Map<number, [number, number][]>>();
    for (const [date, count] of stats?.dailyCount ?? []) {
      const ds = String(date);
      const year = Number(ds.slice(0, 4));
      const month = Number(ds.slice(5, 7));
      const day = Number(ds.slice(8, 10));
      if (!byYear.has(year)) byYear.set(year, new Map());
      const months = byYear.get(year)!;
      if (!months.has(month)) months.set(month, []);
      months.get(month)!.push([day, Number(count)]);
    }
    return byYear;
  }, [stats]);

  const categoryData = useMemo(
    () =>
      Object.entries(stats?.categoryCount ?? {})
        .map(([k, v]) => ({
          id: Number(k),
          name: categoryLabel(Number(k)),
          value: Number(v),
          color: categoryColor(Number(k)),
        }))
        .sort((a, b) => b.value - a.value),
    [stats],
  );

  const subcategoryGroups = useMemo(() => {
    const groups: { category: number; rows: { name: string; value: number }[] }[] = [];
    for (const [catKey, subs] of Object.entries(stats?.subcategoryCount ?? {})) {
      const rows = Object.entries(subs)
        .map(([name, value]) => ({ name, value: Number(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
      if (rows.length > 0) groups.push({ category: Number(catKey), rows });
    }
    return groups.sort(
      (a, b) =>
        (stats?.categoryCount?.[String(b.category)] ?? 0) -
        (stats?.categoryCount?.[String(a.category)] ?? 0),
    );
  }, [stats]);

  const total = stats?.total ?? 0;

  if (!stats || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/40 bg-white/40 py-20 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">暂无统计数据</p>
        <p className="text-xs text-slate-400">写几篇日记后这里会显示分布与热力图</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── 总条目 ── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-black text-slate-700 dark:text-slate-200">📊 日记统计</span>
        <span className="flex items-baseline gap-1 rounded-xl border border-white/40 bg-white/40 px-3 py-1 backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
          <span className="text-lg font-black text-slate-800 dark:text-white">{total}</span>
          <span className="text-[10px] text-slate-400">总条目</span>
        </span>
      </div>

      {/* ── 日历热力图 ── */}
      <section className="rounded-2xl border border-white/40 bg-white/40 p-4 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
        <h3 className="mb-3 text-xs font-bold text-slate-500 dark:text-slate-400">
          记录热力图
          <span className="ml-2 font-normal text-slate-400">
            {stats.dailyCount[0]?.[0] ?? ""} ~ {stats.dailyCount[stats.dailyCount.length - 1]?.[0] ?? ""}
          </span>
        </h3>

        <div className="space-y-5">
          {[...calendar.keys()].sort((a, b) => b - a).map((year) => (
            <div key={year}>
              <p className="mb-2 text-[11px] font-black text-slate-400 dark:text-slate-500">{year}年</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[...calendar.get(year)!.keys()].sort((a, b) => a - b).map((month) => {
                  const days = calendar.get(year)!.get(month)!;
                  const countMap = new Map(days);
                  const first = new Date(year, month - 1, 1);
                  const daysInMonth = new Date(year, month, 0).getDate();
                  const pad = (first.getDay() + 6) % 7;
                  const monthTotal = days.reduce((s, [, c]) => s + c, 0);

                  return (
                    <div key={month}>
                      <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">
                        {MONTHS_CN[month - 1]}
                        <span className="ml-1 text-slate-300 dark:text-slate-600">{monthTotal}</span>
                      </p>
                      <div className="grid grid-cols-7 gap-[3px]">
                        {WEEKDAYS.map((w) => (
                          <span
                            key={w}
                            className="text-center text-[8px] leading-3 text-slate-300 dark:text-slate-600"
                          >
                            {w}
                          </span>
                        ))}
                        {Array.from({ length: pad }, (_, i) => (
                          <span key={`pad-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const day = i + 1;
                          const count = countMap.get(day) ?? 0;
                          const level = activityLevel(count);
                          return (
                            <span
                              key={day}
                              title={`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}：${count} 条`}
                              className={`aspect-square rounded-[3px] ${LEVEL_BG[level]}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 图例 */}
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-400">
          <span>少</span>
          {LEVEL_BG.map((bg, i) => (
            <span key={i} className={`h-3 w-3 rounded-[3px] ${bg}`} />
          ))}
          <span>多</span>
        </div>
      </section>

      {/* ── 分类分布 ── */}
      <section className="rounded-2xl border border-white/40 bg-white/40 p-4 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
        <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">分类分布</h3>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-[240px] w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="72%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {categoryData.map((d) => (
                    <Cell key={d.id} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [`${value} 条`, String(name)]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.3)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-1.5 sm:w-1/2">
            {categoryData.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: d.color }}
                />
                <span className="flex-1 text-slate-600 dark:text-slate-300">{d.name}</span>
                <span className="font-bold tabular-nums text-slate-700 dark:text-slate-200">
                  {d.value}
                </span>
                <span className="w-10 text-right tabular-nums text-slate-400">
                  {((d.value / total) * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 小分类分布 ── */}
      {subcategoryGroups.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {subcategoryGroups.map((group) => {
            const label = categoryLabel(group.category);
            const color = categoryColor(group.category);
            const chartHeight = Math.max(160, group.rows.length * 30);
            return (
              <section
                key={group.category}
                className="rounded-2xl border border-white/40 bg-white/40 p-4 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50"
              >
                <h3 className="mb-2 text-xs font-bold" style={{ color }}>
                  {label} · 事项分布
                </h3>
                <div style={{ height: chartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={group.rows}
                      layout="vertical"
                      margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={92}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(148,163,184,0.1)" }}
                        formatter={(value: unknown) => [`${value} 条`, ""]}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid rgba(148,163,184,0.3)",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
