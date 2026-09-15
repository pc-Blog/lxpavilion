"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DiaryStats } from "@/lib/types";
import HoverTip from "@/app/_components/common/Tooltip";
import { categoryLabel, formatDiaryDate } from "./constants";

/**
 * 色板与 app/(main)/analytics/AnalyticsClient.tsx 的 PIE_COLORS 保持一致，
 * 避免同一个博客里出现两套图表配色。
 */
const PIE_COLORS = [
  "#818cf8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

// ── 主题感知的 Tooltip 样式（与 analytics 页同款）──
const LIGHT_TOOLTIP = {
  contentStyle: { background: "rgba(255,255,255,0.95)", border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
  itemStyle: { color: "#1e293b" },
  labelStyle: { color: "#1e293b", fontWeight: "bold" as const },
};
const DARK_TOOLTIP = {
  contentStyle: { background: "rgba(30,41,59,0.95)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "#fff", fontWeight: "bold" as const },
};

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

// ── 环形图 hover：外扩 + 白描边（同 analytics 的 renderActiveShape）──
const renderActiveShape = (props: unknown) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props as {
    cx: number; cy: number; innerRadius: number; outerRadius: number;
    startAngle: number; endAngle: number; fill: string;
  };
  return (
    <g style={{ animation: "donutPopIn 0.25s ease-out", transformOrigin: `${cx}px ${cy}px` }}>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="none" opacity={0.2} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="white" strokeWidth={2.5} />
    </g>
  );
};

// ── 条形图 hover：外扩 2px（同 analytics 的 renderBarShape）──
const renderBarShape = (props: unknown) => {
  const { x, y, width, height, fill } = props as {
    x: number; y: number; width: number; height: number; fill: string;
  };
  return (
    <rect x={x} y={y - 1} width={width + 2} height={height + 2} fill={fill} rx={4} style={{ transition: "all 0.15s ease-out" }} />
  );
};

/** 单元格几何：必须与下面的内联宽高/gap 完全一致，否则月标签会漂移 */
const CELL = 10;
const GAP = 2;
const ROWS = 7;
/** 星期列宽 + 列间距，月标签行需要同样偏移 */
const LABEL_W = 18;
const MIN_WEEKS = 12;
const MAX_WEEKS = 80;
const WEEK_LABELS = ["一", "", "三", "", "五", "", "日"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 取某天所在周的周一（热力图列以周一为起点） */
function weekStart(d: Date): Date {
  const t = new Date(d);
  const dow = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dow);
  t.setHours(0, 0, 0, 0);
  return t;
}

/** 由容器可用宽度反推能放下的周数，避免溢出把最近一列裁掉 */
function calcWeeks(available: number): number {
  if (available <= 0) return 26;
  const n = Math.floor((available - LABEL_W + GAP) / (CELL + GAP));
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, n));
}

/**
 * 五档色阶：全部由一个 accent 色派生（同色系递进）。
 * 空档与 1 档必须肉眼可分——若只差透明度会导致「有记录」和「没记录」看起来一样。
 */
const HEAT = {
  light: {
    empty: "rgba(99,102,241,0.09)",
    levels: [
      "rgba(99,102,241,0.09)",
      "rgba(99,102,241,0.28)",
      "rgba(99,102,241,0.50)",
      "rgba(99,102,241,0.74)",
      "#6366f1",
    ],
    border: "rgba(148,163,184,0.35)",
    accent: "#6366f1",
    label: "#94a3b8",
  },
  dark: {
    empty: "rgba(129,140,248,0.14)",
    levels: [
      "rgba(129,140,248,0.14)",
      "rgba(129,140,248,0.34)",
      "rgba(129,140,248,0.56)",
      "rgba(129,140,248,0.78)",
      "#818cf8",
    ],
    border: "rgba(148,163,184,0.28)",
    accent: "#818cf8",
    label: "#94a3b8",
  },
};

/** 条目数 → 档位 0-4 */
function heatLevel(count: number): number {
  if (!count) return 0;
  if (count <= 1) return 1;
  if (count <= 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * 打卡式热力图（手写，无图表库依赖）
 *
 * 参考 Kakuki 的 CheckinCard：GitHub 贡献图形态，列 = 周、每列 7 天、格子 10×10。
 * 与源 OmniPavilion 的 ECharts calendar 是两种形态，此处按需求改为本形态并去掉 echarts。
 *
 * 列数按容器宽度自适应（ResizeObserver），网格锚定「数据最后一天所在周」向左推，
 * 保证最近一天始终可见、且不会横向溢出。
 */
function CalendarHeatmap({ dailyCount, isDark }: { dailyCount: [string, number][]; isDark: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [weeks, setWeeks] = useState(26);
  const theme = isDark ? HEAT.dark : HEAT.light;

  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const [d, c] of dailyCount) m.set(String(d), Number(c));
    return m;
  }, [dailyCount]);

  /** 网格终点：数据最后一天所在周的周一（无数据则用今天） */
  const lastWeekMonday = useMemo(() => {
    const last = dailyCount.length ? String(dailyCount[dailyCount.length - 1][0]) : fmtDate(new Date());
    const [y, m, d] = last.split("-").map(Number);
    return weekStart(new Date(y, m - 1, d));
  }, [dailyCount]);

  const startDay = useMemo(() => {
    const s = new Date(lastWeekMonday);
    s.setDate(s.getDate() - (weeks - 1) * ROWS);
    return s;
  }, [lastWeekMonday, weeks]);

  /** 列 → 7 天 */
  const grid = useMemo(() => {
    const cols: { key: string; day: number }[][] = [];
    for (let w = 0; w < weeks; w += 1) {
      const col: { key: string; day: number }[] = [];
      for (let d = 0; d < ROWS; d += 1) {
        const date = new Date(startDay);
        date.setDate(startDay.getDate() + w * ROWS + d);
        col.push({ key: fmtDate(date), day: date.getDate() });
      }
      cols.push(col);
    }
    return cols;
  }, [startDay, weeks]);

  /** 月标签：按周所属月份分组（取该周周四判定），宽度按覆盖周数折算 */
  const monthSpans = useMemo(() => {
    const spans: { m: number; w: number }[] = [];
    for (let w = 0; w < weeks; w += 1) {
      const date = new Date(startDay);
      date.setDate(startDay.getDate() + w * ROWS + 3);
      const m = date.getMonth();
      const last = spans[spans.length - 1];
      if (last && last.m === m) last.w += 1;
      else spans.push({ m, w: 1 });
    }
    return spans;
  }, [startDay, weeks]);

  // 容器宽度 → 周数
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWeeks(calcWeeks(w));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative">
      {/* ── 头部：范围 + 图例（对应 checkin-heat-head）── */}
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          记录热力图
          <span className="ml-2 font-normal text-slate-400">
            {dailyCount[0]?.[0] ?? ""} ~ {dailyCount[dailyCount.length - 1]?.[0] ?? ""}
          </span>
        </span>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <i
              key={i}
              className="block h-2.5 w-2.5 rounded-[3px]"
              style={{
                background: theme.levels[i],
                border: i === 0 ? `1px solid ${theme.border}` : "1px solid transparent",
              }}
            />
          ))}
          <span>多</span>
        </div>
      </div>

      {/* ── 网格 ──
          不套 overflow-x-auto：列数由容器宽度反推（calcWeeks），设计上就不会溢出；
          去掉它才能复用项目的 absolute 定位 Tooltip（否则提示框会被滚动容器裁掉）。 */}
      <div ref={wrapRef}>
        <div>
          {/* 月标签行：偏移与星期列一致，宽度按覆盖周数算，否则会漂移 */}
          <div className="mb-1 flex" style={{ marginLeft: LABEL_W, gap: GAP }}>
            {monthSpans.map((s, i) => (
              <span
                key={i}
                className="flex-none whitespace-nowrap text-[10px] text-slate-400"
                style={{ width: s.w * CELL + (s.w - 1) * GAP }}
              >
                {s.m + 1}月
              </span>
            ))}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {/* 星期列：只显示一/三/五/日，与源一致 */}
            <div className="flex-none" style={{ width: 12, marginRight: 4, gap: GAP }}>
              {WEEK_LABELS.map((l, i) => (
                <span
                  key={i}
                  className="block text-right text-[9px] text-slate-400"
                  style={{ height: CELL, lineHeight: `${CELL}px` }}
                >
                  {l}
                </span>
              ))}
            </div>

            {grid.map((col, wi) => (
              <div key={wi} className="flex flex-none flex-col" style={{ gap: GAP }}>
                {col.map((cell) => {
                  const count = countMap.get(cell.key) ?? 0;
                  const lv = heatLevel(count);
                  const bg = lv === 0 ? theme.empty : theme.levels[lv];
                  return (
                    // 复用项目公共 Tooltip（glass-card 样式，absolute 定位）。
                    // 它的外层是 inline-flex 的 span，必须显式给尺寸，否则 flex 列里的
                    // 10px 几何会被撑开、月标签随之漂移。
                    <HoverTip
                      key={cell.key}
                      text={`${formatDiaryDate(cell.key)}${count ? ` · ${count} 条` : " · 无记录"}`}
                    >
                      <span
                        className="box-border block rounded-[3px] transition-transform duration-150 hover:scale-[1.35]"
                        style={{
                          width: CELL,
                          height: CELL,
                          background: bg,
                          border: lv === 0 ? `1px solid ${theme.border}` : "1px solid transparent",
                          outline: cell.key === fmtDate(new Date()) ? `2px solid ${theme.accent}` : undefined,
                          outlineOffset: 1,
                        }}
                      />
                    </HoverTip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 统计 tab
 *
 * 区块顺序与源项目 views/stats 一致：日历热力图 → 分类环形图 → 小分类条形图。
 * 环形图与条形图用项目已装的 recharts，写法与配色对齐
 * app/(main)/analytics/AnalyticsClient.tsx（activeShape / 渐变柱 / 主题感知 Tooltip）；
 * 热力图改为手写 GitHub 贡献图形态（无图表库依赖），见上方 CalendarHeatmap。
 */
export default function StatsTab({ stats }: { stats: DiaryStats | null }) {
  const isDark = useDarkMode();
  const tooltip = isDark ? DARK_TOOLTIP : LIGHT_TOOLTIP;

  const dailyCount = useMemo<[string, number][]>(
    () => (stats?.dailyCount ?? []).map(([d, c]) => [String(d), Number(c)]),
    [stats],
  );

  const total = stats?.total ?? 0;

  const categoryData = useMemo(
    () =>
      Object.entries(stats?.categoryCount ?? {})
        .map(([k, v]) => ({
          id: Number(k),
          name: categoryLabel(Number(k)),
          value: Number(v),
          pct: total ? Math.round((Number(v) / total) * 100) : 0,
        }))
        .sort((a, b) => b.value - a.value),
    [stats, total],
  );

  const subcategoryGroups = useMemo(() => {
    const groups: { category: number; rows: { name: string; value: number }[] }[] = [];
    for (const [catKey, subs] of Object.entries(stats?.subcategoryCount ?? {})) {
      const rows = Object.entries(subs)
        .map(([name, value]) => ({ name, value: Number(value) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
      if (rows.length > 0) groups.push({ category: Number(catKey), rows });
    }
    return groups.sort(
      (a, b) =>
        (stats?.categoryCount?.[String(b.category)] ?? 0) -
        (stats?.categoryCount?.[String(a.category)] ?? 0),
    );
  }, [stats]);

  if (!stats || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/40 bg-white/40 py-20 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">暂无统计数据</p>
        <p className="text-xs text-slate-400">写几篇日记后这里会显示分布与热力图</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 环形图 hover 动画关键帧：analytics 页也是用内联 style 注入的，非全局样式 */}
      <style>{`@keyframes donutPopIn { 0% { transform: scale(0.85); opacity: 0.3; } 100% { transform: scale(1); opacity: 1; } }`}</style>

      {/* ── 头部：标题 + 总条目（同源 stats-header）── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-black text-slate-700 dark:text-slate-200">📊 日记统计</span>
        <div className="rounded-2xl border border-white/40 bg-white/40 px-4 py-2 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">总条目</span>
          <span className="ml-2 text-xl font-black text-slate-900 dark:text-white">{total}</span>
        </div>
      </div>

      {/* ── 1. 日历热力图（源项目里就在最上面）── */}
      <div className="rounded-2xl border border-white/40 bg-white/40 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50 md:p-5">
        <CalendarHeatmap dailyCount={dailyCount} isDark={isDark} />
      </div>

      {/* ── 2. 分类分布（环形图）── */}
      <div className="rounded-2xl border border-white/40 bg-white/40 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50 md:p-5">
        <h3 className="mb-1 text-xs font-bold text-slate-600 dark:text-slate-300 md:text-sm">🍩 分类分布</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={78}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
              activeShape={renderActiveShape}
              stroke="none"
            >
              {categoryData.map((entry, i) => (
                <Cell key={entry.id} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltip.contentStyle}
              itemStyle={tooltip.itemStyle}
              labelStyle={tooltip.labelStyle}
              formatter={(value, _name, props) => [
                `${Number(value ?? 0)} 条 (${(props as { payload?: { pct?: number } })?.payload?.pct ?? 0}%)`,
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => {
                const item = categoryData.find((d) => d.name === value);
                return `${value} ${item ? item.pct + "%" : ""}`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ── 3. 小分类分布（每个分类一张横向条形图）── */}
      {subcategoryGroups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {subcategoryGroups.map((group) => {
            const label = categoryLabel(group.category);
            const baseColor = PIE_COLORS[group.category % PIE_COLORS.length];
            const sum = group.rows.reduce((s, r) => s + r.value, 0);
            const rows = group.rows.map((r) => ({
              ...r,
              pct: sum ? Math.round((r.value / sum) * 100) : 0,
            }));
            return (
              <div
                key={group.category}
                className="rounded-2xl border border-white/40 bg-white/40 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50 md:p-5"
              >
                <h3 className="mb-3 text-xs font-bold text-slate-600 dark:text-slate-300 md:text-sm">
                  {label} · 事项分布
                </h3>
                <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 28)}>
                  <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 44 }}>
                    <defs>
                      {rows.map((_, i) => (
                        <linearGradient key={i} id={`dg-${group.category}-${i}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={baseColor} />
                          <stop offset="100%" stopColor={baseColor} stopOpacity={0.35} />
                        </linearGradient>
                      ))}
                    </defs>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      width={88}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(148,163,184,0.1)" }}
                      contentStyle={tooltip.contentStyle}
                      itemStyle={tooltip.itemStyle}
                      labelStyle={tooltip.labelStyle}
                      formatter={(value, _name, props) => [
                        `${Number(value ?? 0)} 条 (${(props as { payload?: { pct?: number } })?.payload?.pct ?? 0}%)`,
                      ]}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 4, 4, 0]}
                      isAnimationActive
                      animationDuration={600}
                      animationEasing="ease-out"
                      activeBar={renderBarShape}
                      label={{ position: "right", fontSize: 10, fill: "#94a3b8", formatter: (v: unknown) => `${Number(v ?? 0)}` }}
                    >
                      {rows.map((_, i) => (
                        <Cell key={i} fill={`url(#dg-${group.category}-${i})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
