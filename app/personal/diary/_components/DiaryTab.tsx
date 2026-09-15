"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import type { Diary } from "@/lib/types";
import DatePicker from "@/app/_components/admin/DatePicker";
import SelectDropdown from "@/app/_components/admin/SelectDropdown";
import DiaryEditor from "./DiaryEditor";
import { WeatherIcon } from "./WeatherIcon";
import { CATEGORY_OPTIONS, categoryColor, categoryLabel, dayOfMonth } from "./constants";

const MONTHS_CN = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

/** 分类筛选的哨兵值：0 表示不筛选 */
const ALL_CATEGORY = 0;

/** 分类下拉的选项：0 排在最前，其余复用 constants 的 CATEGORY_OPTIONS */
const CATEGORY_FILTER_OPTIONS: number[] = [
  ALL_CATEGORY,
  ...CATEGORY_OPTIONS.map((o) => o.value),
];

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
  /** 小分类筛选；空串 = 不筛选。仅在选中具体分类时可用 */
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("");
  /** null = 关闭；{ diary: null } = 新建；{ diary } = 编辑 */
  const [editing, setEditing] = useState<{ diary: Diary | null } | null>(null);

  /**
   * 小分类选项：直接从 diaries 内存去重。
   *
   * 不用 /diary/subcategories 接口——全量数据本来就在手上了，再打一次请求是多余的
   * （该接口后端也只是从同一批活动条目里 SELECT DISTINCT）。
   * 空串选项代表「不筛选小分类」，0 条小分类时列表为空，下拉自然只显示占位文案。
   */
  const subOptions = useMemo(() => {
    if (categoryFilter === ALL_CATEGORY) return [];
    const set = new Set<string>();
    for (const d of diaries) {
      for (const l of d.logs ?? []) {
        if (l.category === categoryFilter && l.subcategory) set.add(l.subcategory);
      }
    }
    return ["", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [diaries, categoryFilter]);

  /** 应用筛选后的数据 */
  const filtered = useMemo(() => {
    return diaries.filter((d) => {
      if (monthFilter && !d.recordDate.startsWith(monthFilter)) return false;
      if (categoryFilter !== ALL_CATEGORY) {
        return d.logs?.some((l) => {
          if (l.category !== categoryFilter) return false;
          if (subcategoryFilter && l.subcategory !== subcategoryFilter) return false;
          return true;
        }) ?? false;
      }
      return true;
    });
  }, [diaries, categoryFilter, monthFilter, subcategoryFilter]);

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

  /**
   * 筛选组合的指纹。
   *
   * 把卡片的 key 前缀挂上它，筛选一变 key 就变 → 卡片重新挂载 → CSS 动画重播。
   * 不能只靠 key={d.id}：筛选只是移除部分卡片，保留下来的那些 React 会复用节点，
   * 动画不会重新触发；结果就是「消失的卡片有动画、留下的没有」。
   */
  const filterKey = `${monthFilter}|${categoryFilter}|${subcategoryFilter}`;

  return (
    <>
      {/* 筛选条入场 + 小分类下拉出现的过渡动效。keyframes 内联注入，与 StatsTab 一致 */}
      <style>{`
        @keyframes filterBarIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes filterChipIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(10px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .filter-bar-in, .filter-chip-in, .diary-card { animation: none; }
        }
      `}</style>

      {/* ── 筛选条 ── */}
      <div className="filter-bar-in mb-6 flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/40 bg-white/40 p-3 shadow-lg backdrop-blur-md [animation:filterBarIn_0.3s_ease-out] dark:border-white/10 dark:bg-slate-800/50">
        {/* 分类筛选：用项目公共 SelectDropdown，替掉原生 <select>
            根节点是 flex-1，这里按 Pagination.tsx 的既有用法用固定宽度的 div 约束 */}
        <div className="w-[124px]">
          <SelectDropdown
            options={CATEGORY_FILTER_OPTIONS}
            value={categoryFilter}
            onChange={(v) => {
              setCategoryFilter(Number(v));
              // 小分类是按分类查的，换分类必须清掉，否则会筛出空结果
              setSubcategoryFilter("");
            }}
            placeholder="全部分类"
            renderOption={(v) => (v === ALL_CATEGORY ? "全部分类" : categoryLabel(v))}
            getValue={(v) => v}
            size="sm"
          />
        </div>

        {/* 小分类筛选：选项由 diaries 内存去重得到，只有选中具体分类时才有意义 */}
        {categoryFilter !== ALL_CATEGORY && (
          <div className="filter-chip-in w-[124px] [animation:filterChipIn_0.26s_cubic-bezier(0.22,1,0.36,1)]">
            <SelectDropdown
              options={subOptions}
              value={subcategoryFilter}
              onChange={(v) => setSubcategoryFilter(String(v))}
              placeholder="小分类"
              renderOption={(v) => v || "小分类"}
              getValue={(v) => v}
              size="sm"
            />
          </div>
        )}

        {/* 月份筛选：用项目公共 DatePicker 的年月模式，替掉原生 input[type=month] */}
        <DatePicker
          value={monthFilter}
          onChange={setMonthFilter}
          placeholder="全部月份"
          mode="month"
        />

        {(categoryFilter !== ALL_CATEGORY || monthFilter || subcategoryFilter) && (
          <button
            type="button"
            onClick={() => {
              setCategoryFilter(ALL_CATEGORY);
              setMonthFilter("");
              setSubcategoryFilter("");
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
        <div className="diary-card flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/40 bg-white/40 py-20 shadow-lg backdrop-blur-md [animation:cardIn_0.3s_cubic-bezier(0.22,1,0.36,1)_both] dark:border-white/10 dark:bg-slate-800/50">
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
                      {/* 卡片尺寸/交互对齐源 LogCard：88×88、margin 8px、圆角 8px、hover 上移 2px */}
                      <div className="flex flex-wrap">
                        {months.get(month)!.map((d, idx) => (
                          <button
                            key={`${filterKey}:${d.id ?? d.recordDate}`}
                            type="button"
                            onClick={() => setEditing({ diary: d })}
                            title={`${d.recordDate} · ${d.logs?.length ?? 0} 条`}
                            style={{ animationDelay: `${Math.min(idx * 14, 220)}ms` }}
                            className="diary-card group relative m-2 flex h-[88px] w-[88px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-slate-200/70 bg-white/85 shadow-[0_2px_4px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-[2px] transition-all duration-300 [animation:cardIn_0.36s_cubic-bezier(0.22,1,0.36,1)_both] [transition-timing-function:cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_4px_8px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.08)] dark:border-slate-700/60 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                          >
                            <span className="mb-1 font-[Georgia,serif] text-[28px] font-semibold leading-none text-slate-700 [text-shadow:0_1px_1px_rgba(0,0,0,0.05)] dark:text-slate-200">
                              {dayOfMonth(d.recordDate)}
                            </span>
                            {/* 源项目这里是 .weather-icon-container：白圆底 + 阴影；按需求去掉背景，只留图标 */}
                            <span className="flex h-8 w-8 items-center justify-center">
                              <WeatherIcon
                                weather={d.weather}
                                size={18}
                                className="text-slate-500 transition-transform duration-300 group-hover:scale-[1.15] dark:text-slate-300"
                              />
                            </span>
                            {(d.logs?.length ?? 0) > 0 && (
                              <span className="absolute -right-[3px] -top-[3px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-indigo-400 text-[10px] font-semibold leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
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
                                    ? categoryColor(categoryFilter)
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
