"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Loader2, RefreshCw } from "lucide-react";
import type { Diary, DiaryStats } from "@/lib/types";
import { getStats, listAll } from "@/lib/api/diary";
import DiaryTab from "./DiaryTab";
import StatsTab from "./StatsTab";
import HistoryTab from "./HistoryTab";

type TabKey = "diary" | "stats" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "diary", label: "日记" },
  { key: "stats", label: "统计" },
  { key: "history", label: "历史" },
];

/** 本地时区的 YYYY-MM-DD，与后端 recordDate 的格式对齐（toISOString 走 UTC 会算错） */
function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 日记模块容器
 *
 * 仅本地：线上静态构建直接短路，既不渲染内容也不发起请求。
 * 数据边界靠两处保证——
 *   1. 这里：NEXT_PUBLIC_IS_STATIC 为真时 return；
 *   2. 同步侧：github-sync.ts 的 collectAllData 白名单永远不含 diary，
 *      因为 GitHub data 分支是公开可读的。
 */
export default function DiaryClient() {
  const isStatic = process.env.NEXT_PUBLIC_IS_STATIC === "true";

  const [tab, setTab] = useState<TabKey>("diary");
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [stats, setStats] = useState<DiaryStats | null>(null);
  /** 首次加载：初始即为 true，由拉取完成后置 false */
  const [loading, setLoading] = useState(!isStatic);
  /** 手动刷新按钮的状态 */
  const [refreshing, setRefreshing] = useState(false);
  /** 测试提醒按钮的状态：请求权限与接口期间禁用，防连点 */
  const [testing, setTesting] = useState(false);
  const [failed, setFailed] = useState(false);
  /** stats 数据是否已过期，切到统计 tab 时按需重取 */
  const statsStale = useRef(true);

  /**
   * 手动刷新（事件处理器，先置 loading 是安全的）。
   *
   * 首屏不走这里：effect 里直接写 promise 链，照项目内 RecentNotes.tsx 的既有写法，
   * 以避开 react-hooks/set-state-in-effect。
   */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await listAll();
      const st = await getStats();
      setDiaries(list ?? []);
      setStats(st ?? null);
      statsStale.current = false;
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const reloadList = useCallback(async () => {
    try {
      const list = await listAll();
      setDiaries(list ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
    // 列表变了，统计随之过期
    statsStale.current = true;
  }, []);

  /**
   * 测试提醒：手动发一条通知，内容为「今天有没有写日记」，并报告权限状态。
   *
   * 与 DiaryReminder 的自动提醒刻意分开实现：
   *   - 由点击触发，所以能顺带完成授权 —— 浏览器只允许在用户手势里请求通知权限；
   *   - 通知刻意不设 tag，避免同 tag 的新通知被静默替换而看不到横幅；
   *   - 每次重新请求接口，不依赖页面上可能已过期的列表。
   *
   * 权限侧的死路一律用 alert 讲明白，不再静默返回：
   *   非安全上下文、浏览器不支持、denied 这三种情况，代码怎么调都发不出通知，
   *   只能让用户知道原因并手动处理 —— 与其毫无反应，不如说清卡在哪。
   */
  const testNotify = useCallback(async () => {
    // 非安全上下文：浏览器永久禁用 Notification，requestPermission 不可能成功
    if (!window.isSecureContext) {
      alert(
        "当前地址不是安全上下文，浏览器禁止使用系统通知。\n\n" +
          `当前地址：${window.location.origin}\n` +
          "请改用 localhost 或 *.localhost 访问（例如 http://blog.localhost），或为该域名配置 HTTPS。",
      );
      return;
    }

    if (typeof Notification === "undefined") {
      alert("当前浏览器不支持通知 API，无法发送系统通知。");
      return;
    }

    // denied 是终态：requestPermission 不再弹框，只能由用户手动改回
    if (Notification.permission === "denied") {
      alert(
        "通知权限已被拒绝，浏览器不会再弹出授权框。\n\n" +
          "请点击地址栏左侧的图标 → 找到「通知」→ 改为「允许」，然后刷新页面。",
      );
      return;
    }

    setTesting(true);
    try {
      // default：点击就是用户手势，此刻请求授权才会真正弹出授权框
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert(
            permission === "denied"
              ? "授权被拒绝。浏览器不会再自动弹出授权框，需要到地址栏的站点设置里改回「允许」后刷新页面。"
              : "没有拿到通知授权（授权框被关掉了），可以再点一次本按钮重试。",
          );
          return;
        }
      }

      // 重新拉一次拿最新结果；请求失败会由 axios 拦截器弹错误提示
      const list = await listAll();
      const today = toDateStr(new Date());
      const hasDiary = (list ?? []).some((d) => d.recordDate === today);

      new Notification(hasDiary ? "今天已经写过日记了" : "今天还没写日记", {
        body: hasDiary
          ? `${today} 的日记已存在，17:00 起不会触发自动提醒。`
          : `${today} 还没有日记，17:00 起每 20 分钟会自动提醒一次。`,
        icon: "/logo.png",
      });
    } catch {
      /* 接口失败已由 axios 拦截器提示；通知构造失败也无需额外反馈 */
    } finally {
      setTesting(false);
    }
  }, []);

  // 首屏加载：两条请求并行，完成后落状态
  useEffect(() => {
    if (isStatic) return;
    let alive = true;
    Promise.all([listAll(), getStats()])
      .then(([list, st]) => {
        if (!alive) return;
        setDiaries(list ?? []);
        setStats(st ?? null);
        statsStale.current = false;
        setFailed(false);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isStatic]);

  // 切到统计 tab 时按需刷新，避免每次编辑后都多打一次请求
  useEffect(() => {
    if (isStatic || tab !== "stats" || !statsStale.current) return;
    getStats()
      .then((st) => {
        setStats(st ?? null);
        statsStale.current = false;
      })
      .catch(() => {});
  }, [isStatic, tab]);

  if (isStatic) {
    return (
      <div className="rounded-2xl border border-white/40 bg-white/40 py-20 text-center shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
        <h2 className="text-lg font-black text-slate-700 dark:text-slate-200">日记仅在本地可用</h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-slate-500 dark:text-slate-400">
          日记属于私人记录，不参与线上静态数据同步。请通过 Docker 或 dev 模式启动应用后访问。
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Tab 切换 ── */}
      <div className="mb-6 flex items-center gap-1 border-b border-slate-200/70 dark:border-slate-700">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => void testNotify()}
          disabled={testing}
          title="测试日记提醒通知：点击后会弹出「今天有没有写日记」的通知"
          className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-500 disabled:opacity-50 dark:hover:bg-slate-700"
        >
          <Bell size={13} />
          测试提醒
        </button>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          title="刷新"
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-500 disabled:opacity-50 dark:hover:bg-slate-700"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── 内容 ── */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          加载中…
        </div>
      ) : failed ? (
        <div className="rounded-2xl border border-white/40 bg-white/40 py-20 text-center shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-800/50">
          <h2 className="text-base font-black text-slate-700 dark:text-slate-200">无法连接后端</h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500 dark:text-slate-400">
            日记接口只在本地后端可用。若 Docker 里跑的是旧镜像，需要重建后端镜像后重试。
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-600"
          >
            重试
          </button>
        </div>
      ) : tab === "diary" ? (
        <DiaryTab diaries={diaries} onRefresh={() => void reloadList()} />
      ) : tab === "stats" ? (
        <StatsTab stats={stats} />
      ) : (
        <HistoryTab diaries={diaries} />
      )}
    </>
  );
}
