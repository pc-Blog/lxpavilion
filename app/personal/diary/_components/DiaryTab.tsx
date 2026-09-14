"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import type { Diary } from "@/lib/types";
import DiaryEditor from "./DiaryEditor";
import { WeatherIcon } from "./WeatherIcon";
import { CATEGORY_OPTIONS, categoryLabel, dayOfMonth } from "./constants";

const MONTHS_CN = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

/** 分类筛选的哨兵值：0 表示不筛选 */
const ALL_CATEGORY = 0;

/**
 * 日记 tab —— 年月分组的日历卡片网格
 *
 * 对应源项目 views/log（Search.vue + ListCard.vue + LogCard.vue）。
 * 点击任意日期卡片打开编辑对话框。
 *
 * 筛选全部在内存完成：接口是全量的（约 13KB），无需再打请求。
 */
export default function DiaryTab({
  diaries,
  onRefresh,
}: {
  diaries: Diary[];
  /** 保存/删除后重新拉取全量数据 */
  onRefresh: () => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<number>(ALL_CATEGORY);
  const [monthFilter, setMonthFilter] = useState<string>("");
  /** null = 关闭；{ diary: null } = 新建；{ diary } = 编辑 */
  const [editing, setEditing] = useState<{ diary: Diary | null } | null>(null);

  /** 应用筛选后的数据 */
  const filtered = useMemo(() => {
    return diaries.filter((d) => {
      if (monthFilter && !d.recordDate.startsWith(monthFilter)) return false;
      if (categoryFilter !== ALL_CATEGORY) {
        return d.logs?.some((l) => l.category === categoryFilter) ?? false;
      }
      return true;
    });
  }, [diaries, categoryFilter, monthFilter]);

  /** 年 → 月 → 日记，年与月均降序 */
  const grouped = useMemo(() => {
    const map = new Map<number, Map<number, Diary[]>>();
    for (const d of filtered) {
      const year = Number(d.recordDate.slice(0, 4));
      const month = Number(d.recordDate.slice(5, 7));
      if (!map.has(year)) map.set(year, new Map());
      const months = map.get(year)!;
      if (!months.has(month)) months.set(month, []);
      months.get(month)!.push(d);
    }
    for (const months of map.values()) {
      for (const list of months.values()) {
        list.sort((a, b) => b.recordDate.localeCompare(a.recordDate));
      }
    }
    return map;
  }, [filtered]);

  const years = useMemo(
    () => [...grouped.keys()].sort((a, b) => b - a),
    [grouped],
  );

  return (
    <>
      {/* ── 筛选条 ── */}
      <div className="mb-6 flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/40 bg-white/40 p-3 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(Number(e.target.value))}
          className="h-8 rounded-lg border border-slate-200 bg-white/70 px-2 text-xs text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200"
        >
          <option value={ALL_CATEGORY}>全部分类</option>
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="h-8 rounded-lg border border-slate-200 bg-white/70 px-2 text-xs text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200"
        />

        {(categoryFilter !== ALL_CATEGORY || monthFilter) && (
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(ALL_CATEGORY);
              setMonthFilter("");
            }}
            className="h-8 rounded-lg px-2 text-xs text-slate-400 transition-colors hover:text-indigo-500"
          >
            清除筛选
          </button>
        )}

        <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
          {filtered.length} 天
        </span>

        <button
          type="button"
          onClick={() => setEditing({ diary: null })}
          className="flex h-8 items-center gap-1 rounded-full bg-indigo-500 px-3 text-xs font-bold text-white transition-colors hover:bg-indigo-600"
        >
          <Plus size={13} />
          添加日志
        </button>
      </div>

      {/* ── 日历网格 ── */}
      {years.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/40 bg-white/40 py-20 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
          <CalendarDays size={40} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {diaries.length === 0 ? "暂无日志记录" : "当前筛选下没有记录"}
          </p>
          {diaries.length === 0 && (
            <button
              type="button"
              onClick={() => setEditing({ diary: null })}
              className="rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-600"
            >
              写第一篇
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {years.map((year) => {
            const months = grouped.get(year)!;
            const monthKeys = [...months.keys()].sort((a, b) => b - a);
            return (
              <section key={year}>
                <h2 className="mb-4 border-b-2 border-slate-200/70 pb-2 text-xl font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {year}年
                </h2>
                <div className="space-y-5">
                  {monthKeys.map((month) => (
                    <div key={month} className="sm:ml-4">
                      <h3 className="mb-2.5 text-sm font-bold text-slate-500 dark:text-slate-400">
                        {MONTHS_CN[month - 1]}
                        <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                          {months.get(month)!.length} 天
                        </span>
                      </h3>
                      <div className="flex flex-wrap gap-3 sm:ml-4">
                        {months.get(month)!.map((d) => (
                          <button
                            key={d.id ?? d.recordDate}
                            type="button"
                            onClick={() => setEditing({ diary: d })}
                            title={`${d.recordDate} · ${d.logs?.length ?? 0} 条`}
                            className="relative flex h-[74px] w-[74px] flex-col items-center justify-center gap-0.5 rounded-xl border border-white/50 bg-white/50 shadow-md backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg dark:border-white/10 dark:bg-slate-800/50 dark:hover:border-indigo-500/50"
                          >
                            <span className="text-lg font-black leading-none text-slate-700 dark:text-slate-200">
                              {dayOfMonth(d.recordDate)}
                            </span>
                            <WeatherIcon
                              weather={d.weather}
                              size={15}
                              className="text-slate-400 dark:text-slate-500"
                            />
                            {(d.logs?.length ?? 0) > 0 && (
                              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
                                {d.logs.length}
                              </span>
                            )}
                            {categoryFilter !== ALL_CATEGORY && (
                              <span
                                className="absolute bottom-1 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full opacity-70"
                                style={{
                                  backgroundColor: d.logs?.some(
                                    (l) => l.category === categoryFilter,
                                  )
                                    ? "#6366f1"
                                    : "transparent",
                                }}
                                aria-label={categoryLabel(categoryFilter)}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* 底部导航（保持与源项目一致的可达性） */}
      <div className="mt-8 text-center">
        <Link
          href="/personal"
          className="text-xs text-slate-400 transition-colors hover:text-indigo-500"
        >
          ← 返回个人空间
        </Link>
      </div>

      {/* ── 编辑对话框 ── */}
      {editing && (
        <DiaryEditor
          diary={editing.diary}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
}
