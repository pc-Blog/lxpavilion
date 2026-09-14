"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import type { Diary } from "@/lib/types";
import { WeatherIcon } from "./WeatherIcon";
import { categoryColor, categoryLabel, formatDiaryDate } from "./constants";

/**
 * 历史 tab —— 只读时间线
 *
 * 对应源项目 views/history：年/月两级筛选 + 按天分块展示。
 * 「日记」tab 是日历卡片网格，这里是文字时间线，两者定位不同。
 */
export default function HistoryTab({ diaries }: { diaries: Diary[] }) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const d of diaries) set.add(Number(d.recordDate.slice(0, 4)));
    return [...set].sort((a, b) => b - a);
  }, [diaries]);

  const months = useMemo(() => {
    if (selectedYear === null) return [];
    const set = new Set<number>();
    for (const d of diaries) {
      if (Number(d.recordDate.slice(0, 4)) === selectedYear) {
        set.add(Number(d.recordDate.slice(5, 7)));
      }
    }
    return [...set].sort((a, b) => b - a);
  }, [diaries, selectedYear]);

  const filtered = useMemo(() => {
    return diaries.filter((d) => {
      const y = Number(d.recordDate.slice(0, 4));
      const m = Number(d.recordDate.slice(5, 7));
      if (selectedYear !== null && y !== selectedYear) return false;
      if (selectedMonth !== null && m !== selectedMonth) return false;
      return true;
    });
  }, [diaries, selectedYear, selectedMonth]);

  const entryTotal = useMemo(
    () => filtered.reduce((sum, d) => sum + (d.logs?.length ?? 0), 0),
    [filtered],
  );

  const toggleYear = (year: number) => {
    if (selectedYear === year) {
      setSelectedYear(null);
      setSelectedMonth(null);
    } else {
      setSelectedYear(year);
      setSelectedMonth(null);
    }
  };

  return (
    <>
      {/* ── 筛选条 ── */}
      <div className="mb-6 space-y-2.5 rounded-2xl border border-white/40 bg-white/40 p-3 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-8 shrink-0 text-[11px] font-bold text-slate-400">年份</span>
          <div className="flex flex-wrap gap-1.5">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => toggleYear(y)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-all ${
                  selectedYear === y
                    ? "border-indigo-400 bg-indigo-500 text-white"
                    : "border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
            {filtered.length} 天 / {entryTotal} 条
          </span>
        </div>

        {selectedYear !== null && months.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-8 shrink-0 text-[11px] font-bold text-slate-400">月份</span>
            <div className="flex flex-wrap gap-1.5">
              {months.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMonth(selectedMonth === m ? null : m)}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition-all ${
                    selectedMonth === m
                      ? "border-indigo-400 bg-indigo-500 text-white"
                      : "border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300"
                  }`}
                >
                  {m}月
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 时间线 ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/40 bg-white/40 py-20 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
          <ClipboardList size={40} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">暂无日志</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((d) => (
            <div
              key={d.id ?? d.recordDate}
              className="overflow-hidden rounded-2xl border border-white/40 bg-white/40 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50"
            >
              {/* 日期头 */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 bg-slate-100/50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-700/20">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {formatDiaryDate(d.recordDate)}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <WeatherIcon weather={d.weather} size={13} />
                  {d.logs?.length ?? 0} 条
                </span>
              </div>

              {/* 条目 */}
              <div className="px-4 py-1.5">
                {(d.logs ?? []).map((log, i) => (
                  <div
                    key={log.id ?? i}
                    className="flex items-center gap-2.5 border-b border-slate-200/40 py-2 last:border-b-0 dark:border-slate-700/40"
                  >
                    <span
                      className="shrink-0 rounded px-2 py-0.5 text-[11px] font-bold text-white"
                      style={{ backgroundColor: categoryColor(log.category) }}
                    >
                      {categoryLabel(log.category)}
                    </span>
                    {log.subcategory && (
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
                        {log.subcategory}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 break-words text-[13px] text-slate-700 dark:text-slate-300">
                      {log.activity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
