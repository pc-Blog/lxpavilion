"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Sector,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from "recharts";
import { fetchAnalytics, type AnalyticsData } from "@/lib/analytics";
import { siteConfig } from "@/lib/siteConfig";
import Loading from "@/app/_components/common/Loading";

// ── Color palette ──
const COLORS = {
  requests: "#818cf8",
  visitors: "#10b981",
  pageViews: "#f59e0b",
  cacheRate: "#8b5cf6",
  bandwidth: "#ef4444",
};
const PIE_COLORS = ["#818cf8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

// ── 多平台统计配色 ──
const PLATFORM_COLORS: Record<string, string> = { csdn: "#e74c3c", juejin: "#007fff", cnblogs: "#10b981" };
const PLATFORM_NAMES: Record<string, string> = { csdn: "CSDN", juejin: "掘金", cnblogs: "博客园" };

interface PlatformArticle {
  platform: string; title: string; url: string; date: string; views: number; likes: number; comments?: number;
}
interface PlatformData {
  articleCount: number; totalViews: number; totalLikes: number; totalComments?: number; totalCollects?: number; followers?: number;
  articles: PlatformArticle[];
}
interface PlatformResult {
  csdn: PlatformData | null; juejin: PlatformData | null; cnblogs: PlatformData | null;
  mergedArticles?: { title: string; date: string; csdn: { views: number; likes: number; url: string } | null; juejin: any; cnblogs: any }[];
  generatedAt: string;
}

const DEVICE_COLORS: Record<string, string> = { desktop: "#818cf8", mobile: "#10b981", tablet: "#f59e0b" };
const CACHE_COLORS: Record<string, string> = { hit: "#10b981", dynamic: "#94a3b8", miss: "#ef4444", expired: "#f59e0b", revalidated: "#8b5cf6" };
const HTTP_COLORS: Record<string, string> = { "HTTP/3": "#10b981", "HTTP/2": "#818cf8", "HTTP/1.1": "#f59e0b" };

function fmtNum(n: number) { return n.toLocaleString(); }
function fmtMb(mb: number) { return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`; }
function fmtPct(pct: number) { return `${pct}%`; }
function fmtHour(dt: string) {
  const m = dt.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  return m ? `${m[2]}/${m[3]} ${m[4]}:00` : dt;
}

// ── 统计卡片 ──
const CARD_META = [
  { key: "requests", label: "总请求数", color: COLORS.requests, fmt: fmtNum },
  { key: "uniqueVisitors", label: "独立访客", color: COLORS.visitors, fmt: fmtNum },
  { key: "pageViews", label: "页面浏览", color: COLORS.pageViews, fmt: fmtNum },
  { key: "cacheHitRateBytes", label: "缓存命中率", color: COLORS.cacheRate, fmt: fmtPct },
  { key: "bandwidthMB", label: "带宽消耗", color: COLORS.bandwidth, fmt: fmtMb },
] as const;

function SummaryCards({ totals }: { totals: AnalyticsData["totals"] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
      {CARD_META.map((m) => (
        <div key={m.key} className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-4 md:p-5 transition-all duration-700 hover:scale-[1.02] relative overflow-hidden group">
          <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-700" style={{ background: m.color }} />
          <div className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{m.label}</div>
          <div className="text-xl md:text-2xl font-black" style={{ color: m.color }}>
            {m.fmt(totals[m.key] as number)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 视口检测：可见时才挂载图表，带淡入效果 ──
function LazyMount({ children, height = 200 }: { children: React.ReactNode; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setSeen(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (seen) requestAnimationFrame(() => setFadeIn(true));
  }, [seen]);
  if (seen) return <div style={{ opacity: fadeIn ? 1 : 0, transition: "opacity 0.5s ease-out" }}>{children}</div>;
  return <div ref={ref} style={{ height }} className="rounded-2xl bg-white/20 dark:bg-slate-800/30 backdrop-blur-md border border-white/30 dark:border-white/5" />;
}

// ── 主题感知的 Tooltip 样式 ──
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
type TooltipStyle = typeof LIGHT_TOOLTIP;

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

// ── 面积图 ──
function TrendChart({
  data, dataKey, name, color, unit, isHourly, tooltip,
}: {
  data: any[]; dataKey: string; name: string; color: string; unit?: string; isHourly?: boolean; tooltip: TooltipStyle;
}) {
  const id = `grad-${dataKey}`;
  return (
    <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-4 md:p-5 group">
      <h3 className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">{name}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.6} />
              <stop offset="95%" stopColor={color} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey={isHourly ? "datetime" : "date"} tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" tickFormatter={isHourly ? (v: string) => fmtHour(v) : undefined} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={tooltip.contentStyle}
            itemStyle={tooltip.itemStyle}
            labelStyle={tooltip.labelStyle}
            formatter={(value) => [`${fmtNum(Number(value ?? 0))}${unit || ""}`, name]}
            labelFormatter={(label) => String(label)}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#${id})`} animationDuration={800} animationEasing="ease-out"
            dot={{ r: 3, fill: color, stroke: "none" }}
            activeDot={{ r: 6, fill: color, stroke: "white", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 条形图 ──
const renderBarShape = (props: any) => {
  const { x, y, width, height, fill } = props;
  return (
    <rect x={x} y={y - 1} width={width + 2} height={height + 2} fill={fill} rx={4} style={{ transition: "all 0.15s ease-out" }} />
  );
};

function HorizontalBar({ data, title, tooltip }: { data: { name: string; value: number; pct: number }[]; title: string; tooltip: TooltipStyle; }) {
  const top = data.slice(0, 8);
  return (
    <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-4 md:p-5">
      <h3 className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={Math.max(160, top.length * 28)}>
        <BarChart data={top} layout="vertical" margin={{ left: 0, right: 20 }}>
          <defs>
            {top.map((_, i) => (
              <linearGradient key={i} id={`bg-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} />
                <stop offset="100%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={0.35} />
              </linearGradient>
            ))}
          </defs>
          <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} width={80} />
          <Tooltip
            contentStyle={tooltip.contentStyle}
            itemStyle={tooltip.itemStyle}
            labelStyle={tooltip.labelStyle}
            formatter={(value, _: any, props: any) => [`${fmtNum(Number(value ?? 0))} (${props.payload.pct}%)`]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={600} animationEasing="ease-out" activeBar={renderBarShape}>
            {top.map((_, i) => <Cell key={i} fill={`url(#bg-${i})`} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 环形图 ──
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g style={{ animation: "donutPopIn 0.25s ease-out", transformOrigin: `${cx}px ${cy}px` }}>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="none" opacity={0.2} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="white" strokeWidth={2.5} />
    </g>
  );
};

function DonutChart({ data, title, colorMap, tooltip }: { data: { name: string; value: number; pct: number }[]; title: string; colorMap?: Record<string, string>; tooltip: TooltipStyle; }) {
  return (
    <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-4 md:p-5">
      <h3 className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={50}
            outerRadius={78}
            paddingAngle={3}
            dataKey="value"
            isAnimationActive
            animationDuration={800}
            animationEasing="ease-out"
            activeShape={renderActiveShape}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={colorMap?.[entry.name.toLowerCase()] || PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltip.contentStyle}
            itemStyle={tooltip.itemStyle}
            labelStyle={tooltip.labelStyle}
            formatter={(value, _: any, props: any) => [`${fmtNum(Number(value ?? 0))} (${props.payload.pct}%)`]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => {
              const item = data.find((d) => d.name === value);
              return `${value} ${item ? item.pct + "%" : ""}`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Page Component ──
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [platformData, setPlatformData] = useState<PlatformResult | null>(null);
  const isDark = useDarkMode();
  const tooltip = isDark ? DARK_TOOLTIP : LIGHT_TOOLTIP;

  const hasAnalytics = siteConfig.featureAnalytics;
  const hasPlatform = siteConfig.featurePlatformData;

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAnalytics(d);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (hasAnalytics) load(days); else setLoading(false); }, [days, load, hasAnalytics]);

  // 多平台统计
  const WORKER_URL = `https://${siteConfig.workerApi}`;
  useEffect(() => {
    if (!hasPlatform) return;
    fetch(`${WORKER_URL}/platform`)
      .then((r) => r.json())
      .then((d) => { if (d.code === 1) setPlatformData(d.data); })
      .catch(() => { });
  }, [hasPlatform]);

  return (
    <div className="pb-16">
      <style>{`@keyframes donutPopIn { 0% { transform: scale(0.85); opacity: 0.3; } 100% { transform: scale(1); opacity: 1; } } @keyframes barPopIn { 0% { transform: scaleX(0.92); opacity: 0.5; } 100% { transform: scaleX(1); opacity: 1; } }`}</style>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white">Analytics</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Site traffic and visitor insights.
          </p>
        </div>
        {hasAnalytics && (
          <div className="flex gap-2">
            {[7, 14, 30, 364].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${days === d
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                  : "glass-btn text-slate-500 dark:text-slate-400 hover:text-indigo-500"
                  }`}
              >
                {d === 364 ? "1年" : `${d} 天`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 流量分析 */}
      {hasAnalytics && (
        loading ? (
          <div className="py-24"><Loading /></div>
        ) : error ? (
          <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-8 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={() => load(days)} className="mt-4 text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors">
              重试
            </button>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-6">
            <SummaryCards totals={data.totals} />

            {data.hourly.length > 0 && (
              <LazyMount>
                <div>
                  <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-3">⏱ 小时趋势（最近 3 天）</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TrendChart data={data.hourly} dataKey="requests" name="请求数" color={COLORS.requests} isHourly tooltip={tooltip} />
                    <TrendChart data={data.hourly} dataKey="uniqueVisitors" name="独立访客" color={COLORS.visitors} isHourly tooltip={tooltip} />
                    <TrendChart data={data.hourly} dataKey="cacheHitRate" name="缓存命中率 (%)" color={COLORS.cacheRate} unit="%" isHourly tooltip={tooltip} />
                    <TrendChart data={data.hourly} dataKey="bandwidthMB" name="带宽消耗 (MB)" color={COLORS.bandwidth} unit=" MB" isHourly tooltip={tooltip} />
                  </div>
                </div>
              </LazyMount>
            )}

            <LazyMount>
              <div>
                <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-3">📈 每日趋势</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TrendChart data={data.daily} dataKey="requests" name="请求数" color={COLORS.requests} tooltip={tooltip} />
                  <TrendChart data={data.daily} dataKey="uniqueVisitors" name="独立访客" color={COLORS.visitors} tooltip={tooltip} />
                  <TrendChart data={data.daily} dataKey="cacheHitRateBytes" name="缓存命中率 (%)" color={COLORS.cacheRate} unit="%" tooltip={tooltip} />
                  <TrendChart data={data.daily} dataKey="bandwidthMB" name="带宽消耗 (MB)" color={COLORS.bandwidth} unit=" MB" tooltip={tooltip} />
                </div>
              </div>
            </LazyMount>

            <LazyMount>
              <div>
                <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-3">👥 访客画像</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.byCountry.length > 0 && <HorizontalBar data={data.byCountry} title="🌏 国家分布" tooltip={tooltip} />}
                  {data.byDevice.length > 0 && <DonutChart data={data.byDevice} title="📱 设备类型" colorMap={DEVICE_COLORS} tooltip={tooltip} />}
                  {data.byBrowser.length > 0 && <HorizontalBar data={data.byBrowser} title="🌐 浏览器排行" tooltip={tooltip} />}
                  {data.byOS.length > 0 && <HorizontalBar data={data.byOS} title="💻 操作系统" tooltip={tooltip} />}
                </div>
              </div>
            </LazyMount>

            <LazyMount>
              <div>
                <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-3">🔧 技术指标</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.byCacheStatus.length > 0 && <DonutChart data={data.byCacheStatus} title="🔄 缓存状态" colorMap={CACHE_COLORS} tooltip={tooltip} />}
                  {data.byHTTPProtocol.length > 0 && <DonutChart data={data.byHTTPProtocol} title="📡 HTTP 协议" colorMap={HTTP_COLORS} tooltip={tooltip} />}
                </div>
              </div>
            </LazyMount>
          </div>
        ) : null
      )}

      {/* 第三方博客平台统计 */}
      {hasPlatform && platformData && (
        <LazyMount>
          <div className={hasAnalytics && data ? "mt-6" : ""}>
            <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-3">📊 多平台统计</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {["csdn", "juejin", "cnblogs"].map((key) => {
                    const p = platformData[key as keyof PlatformResult] as PlatformData | null;
                    if (!p) return null;
                    const extras: [string, string | number][] = [];
                    if (key === "csdn") { extras.push(["评论", p.totalComments ?? 0], ["收藏", p.totalCollects ?? 0]); }
                    if (key === "juejin") { extras.push(["收藏", p.totalCollects ?? 0], ["粉丝", p.followers ?? 0]); }
                    if (key === "cnblogs") { extras.push(["评论", p.totalComments ?? 0]); }
                    return (
                      <div key={key} className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-3">
                        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: PLATFORM_COLORS[key] }}>{PLATFORM_NAMES[key]}</div>
                        <div className="grid grid-cols-3 gap-x-2 text-xs">
                          <div><span className="text-slate-400">文章</span><br /><span className="text-lg font-black text-slate-800 dark:text-white">{p.articleCount}</span></div>
                          <div><span className="text-slate-400">阅读</span><br /><span className="text-lg font-black" style={{ color: PLATFORM_COLORS[key] }}>{p.totalViews.toLocaleString()}</span></div>
                          {p.totalLikes > 0 ? (
                            <div><span className="text-slate-400">点赞</span><br /><span className="text-lg font-black text-slate-800 dark:text-white">{p.totalLikes.toLocaleString()}</span></div>
                          ) : null}
                          {extras.filter(([, v]) => Number(v) > 0).map(([label, val]) => (
                            <div key={label}><span className="text-slate-400">{label}</span><br /><span className="text-lg font-black text-slate-800 dark:text-white">{typeof val === "number" ? val.toLocaleString() : val}</span></div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(platformData as any)?.mergedArticles?.length > 0 && (
                  <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-4 md:p-5 group">
                    <h3 className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">📈 文章阅读量时间线</h3>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={(platformData as any).mergedArticles.map((a: any, i: number) => ({
                        idx: i + 1, date: a.date, _title: a.title,
                        csdn: a.csdn?.views ?? null,
                        juejin: a.juejin?.views ?? null,
                        cnblogs: a.cnblogs?.views ?? null,
                      }))}>
                        <defs>
                          {["csdn", "juejin", "cnblogs"].map((k) => (
                            <linearGradient key={k} id={`platGrad-${k}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={PLATFORM_COLORS[k]} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={PLATFORM_COLORS[k]} stopOpacity={0.02} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                        <XAxis dataKey="idx" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                        <Tooltip contentStyle={tooltip.contentStyle} itemStyle={tooltip.itemStyle} labelStyle={tooltip.labelStyle}
                          labelFormatter={(l, p) => p?.[0]?.payload?._title || String(l)}
                          formatter={(v, n) => [`${v} 阅读`, PLATFORM_NAMES[n as string] || n]} />
                        <Legend />
                        {["csdn", "juejin", "cnblogs"].map((k) => (
                          <Area key={k} dataKey={k} name={PLATFORM_NAMES[k]} type="monotone"
                            stroke={PLATFORM_COLORS[k]} strokeWidth={2.5} fill={`url(#platGrad-${k})`}
                            dot={{ r: 3, fill: PLATFORM_COLORS[k], stroke: "none" }}
                            activeDot={{ r: 6, fill: PLATFORM_COLORS[k], stroke: "white", strokeWidth: 2 }}
                            animationDuration={800} animationEasing="ease-out"
                            connectNulls />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {(() => {
                    const raw = ["csdn", "juejin", "cnblogs"].map((k) => { const p = platformData[k as keyof PlatformResult] as PlatformData | null; return { name: PLATFORM_NAMES[k], value: p?.totalViews || 0 }; }).filter((d) => d.value > 0);
                    if (!raw.length) return null;
                    const total = raw.reduce((s, d) => s + d.value, 0);
                    return <DonutChart data={raw.map((d) => ({ ...d, pct: total ? Math.round((d.value / total) * 100) : 0 }))} title="👁 阅读量分布" colorMap={PLATFORM_COLORS} tooltip={tooltip} />;
                  })()}
                  {(() => {
                    const raw = ["csdn", "juejin", "cnblogs"].map((k) => { const p = platformData[k as keyof PlatformResult] as PlatformData | null; return { name: PLATFORM_NAMES[k], value: p?.totalLikes || 0 }; }).filter((d) => d.value > 0);
                    if (!raw.length) return null;
                    const total = raw.reduce((s, d) => s + d.value, 0);
                    return <DonutChart data={raw.map((d) => ({ ...d, pct: total ? Math.round((d.value / total) * 100) : 0 }))} title="👍 点赞量分布" colorMap={PLATFORM_COLORS} tooltip={tooltip} />;
                  })()}
                </div>
              </div>
            </LazyMount>
          )}
    </div>
  );
}

