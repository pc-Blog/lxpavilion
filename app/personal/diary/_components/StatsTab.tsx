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
import { categoryLabel } from "./constants";

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

/**
 * 日历热力图（ECharts）
 *
 * 源项目 views/stats 用的就是 ECharts 的 calendar + heatmap + visualMap，
 * recharts 没有日历热力图组件，所以这一张图单独用 echarts 实现，配置照搬源：
 *   - calendar.range 取数据首尾日期，形成连续整幅日历
 *   - visualMap 连续色阶，max = max(每日条数, 3)
 *   - cellSize ['auto', 16]、splitLine 分隔月份、dayLabel.nameMap = 'zh'
 *
 * echarts 体积较大，用动态 import 按需加载，且只在客户端执行。
 */
function CalendarHeatmap({ dailyCount, isDark }: { dailyCount: [string, number][]; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optionRef = useRef<any>(null);

  // 依数据与主题构建配置
  useEffect(() => {
    if (dailyCount.length === 0) return;

    const dates = dailyCount.map((d) => String(d[0])).sort();
    const start = dates[0];
    const end = dates[dates.length - 1];
    const maxCount = Math.max(...dailyCount.map((d) => Number(d[1])), 3);

    // ── 配色改用博客自己的色系（indigo/slate），不再沿用源项目的暖米色 vintage 主题 ──
    // 浅色：与 DiaryTab 卡片的分档一致（slate-200 → indigo-500）
    // 深色：深底上改用深色系，末档用 indigo-400 保证对比度
    const levelColors = isDark
      ? ["rgba(51,65,85,0.35)", "#3730a3", "#4f46e5", "#818cf8"]
      : ["#e2e8f0", "#c7d2fe", "#818cf8", "#6366f1"];
    const accent = isDark ? "#818cf8" : "#6366f1";
    const cellBorder = isDark ? "#334155" : "#e2e8f0";
    const emptyCell = isDark ? "rgba(51,65,85,0.35)" : "#e2e8f0";
    const labelColor = isDark ? "#94a3b8" : "#64748b";

    // 连续色阶：由 levelColors 逐段插值，让 visualMap 与卡片分档同色系
    const lerpColor = (from: string, to: string, t: number) => {
      const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const [r1, g1, b1] = parse(from);
      const [r2, g2, b2] = parse(to);
      const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
      return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
    };
    const gradient = Array.from({ length: 16 }, (_, i) => {
      const pos = (i / 15) * (levelColors.length - 1);
      const lo = Math.min(Math.floor(pos), levelColors.length - 2);
      return lerpColor(levelColors[lo], levelColors[lo + 1], pos - lo);
    });

    optionRef.current = {
      animationDuration: 800,
      animationEasing: "elasticOut",
      tooltip: {
        trigger: "item",
        backgroundColor: isDark ? "rgba(30,41,59,0.95)" : "rgba(255,255,255,0.95)",
        borderColor: isDark ? "transparent" : "rgba(148,163,184,0.3)",
        borderWidth: 1,
        borderRadius: 8,
        padding: [8, 12],
        textStyle: { color: isDark ? "#fff" : "#1e293b", fontSize: 12 },
        formatter: (p: { value: [string, number] }) =>
          `<strong>${p.value[0]}</strong><br/>${p.value[1]} 条日志`,
      },
      visualMap: {
        min: 0,
        max: maxCount,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 14,
        itemHeight: 130,
        inRange: { color: gradient },
        textStyle: { color: labelColor, fontSize: 10 },
      },
      calendar: {
        left: 20,
        right: 20,
        top: 30,
        bottom: 55,
        range: [start, end],
        cellSize: ["auto", 16],
        splitLine: { lineStyle: { color: cellBorder, width: 1 } },
        itemStyle: {
          borderWidth: 1,
          borderColor: cellBorder,
          color: emptyCell,
          borderRadius: 4,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: "rgba(99,102,241,0.35)",
            borderColor: accent,
          },
        },
        dayLabel: { color: labelColor, fontSize: 10, nameMap: "zh" },
        monthLabel: { color: labelColor, fontSize: 11 },
      },
      series: [
        {
          type: "heatmap",
          coordinateSystem: "calendar",
          data: dailyCount.map(([date, count]) => [String(date), Number(count)]),
          blur: { itemStyle: { opacity: 0.5 } },
        },
      ],
    };

    // 图表若已就绪，立即下发（echarts 异步加载完成后无依赖变化，不会自动重跑本 effect）
    chartRef.current?.setOption(optionRef.current, true);
  }, [dailyCount, isDark]);

  // 初始化 + 尺寸自适应 + 卸载销毁
  useEffect(() => {
    let disposed = false;
    let onResize: (() => void) | null = null;
    import("echarts").then((echarts) => {
      if (disposed || !ref.current) return;
      const chart = echarts.init(ref.current);
      chartRef.current = chart;
      if (optionRef.current) chart.setOption(optionRef.current, true);
      onResize = () => chart.resize();
      window.addEventListener("resize", onResize);
    });
    return () => {
      disposed = true;
      if (onResize) window.removeEventListener("resize", onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return <div ref={ref} style={{ width: "100%", height: 230 }} />;
}

/**
 * 统计 tab —— 对应源项目 views/stats
 *
 * 区块顺序与源一致：日历热力图 → 分类环形图 → 小分类条形图。
 * 环形图与条形图用项目已装的 recharts，写法与配色对齐
 * app/(main)/analytics/AnalyticsClient.tsx（activeShape / 渐变柱 / 主题感知 Tooltip）；
 * 日历热力图用 echarts，配置照搬源项目。
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
