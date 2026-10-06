"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { siteConfig } from "@/lib/siteConfig";

/**
 * 日记提醒：当天 17:00 起，只要还没有写日记，就用浏览器原生通知反复提醒。
 *
 * 提醒时刻：17:00、17:20、17:40 …… 固定每 20 分钟一次，直到当天日记被创建。
 *
 * 设计取舍：
 *   1. 用「轮询当前走到了哪个提醒点」而不是给每个点精确 setTimeout ——
 *      浏览器会节流后台标签页的定时器（切走后最快 1 分钟才跳一次），
 *      精确计时在后台并不可靠；按提醒点去重则节流后既不漏提醒也不重复提醒。
 *   2. 自带原生 fetch，刻意不用 lib/axios —— 那个实例的响应拦截器在请求失败时
 *      会 showErrorToast，而后端未启动时的静默探测不该弹错误提示打扰用户。
 *   3. 只在本地（非静态站）工作：日记数据不上静态站，静态构建下无从判断
 *      「今天有没有日记」。日记接口不需要登录（personal 布局、DiaryClient
 *      都没有登录门槛），因此这里不做登录态判断，未登录也照常提醒。
 *   4. 授权按钮用命令式 DOM 创建，而不是 React 状态：Notification.permission
 *      只能在客户端读，写进 state 会造成 SSR 与首帧不一致，
 *      而项目启用的 react-hooks/set-state-in-effect 也不允许在 effect 里同步 setState。
 */

/** 起始提醒时刻：17:00 */
const START_HOUR = 17;
/** 提醒间隔：20 分钟 */
const INTERVAL_MS = 20 * 60_000;
/** 轮询间隔：30 秒 */
const TICK_MS = 30_000;
/** localStorage 键前缀，按日期分桶，跨天自动失效 */
const STORAGE_PREFIX = "diary-reminder:";
/** 点击通知后跳转的日记页 */
const DIARY_PATH = "/personal/diary";

/** 本地时区的 YYYY-MM-DD（toISOString 走 UTC，跨时区会算错日期） */
function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 当前时刻已到达的最近一个提醒点；未到 17:00 返回 null */
function latestDueSlot(now: Date): Date | null {
  const first = new Date(now);
  first.setHours(START_HOUR, 0, 0, 0);
  if (now.getTime() < first.getTime()) return null;

  const k = Math.floor((now.getTime() - first.getTime()) / INTERVAL_MS);
  return new Date(first.getTime() + k * INTERVAL_MS);
}

/** 读取某天已提醒过的提醒点时间戳 */
function readNotified(day: string): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + day);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is number => typeof v === "number")
      : [];
  } catch {
    return [];
  }
}

/** 记录某天某个提醒点已提醒 */
function markNotified(day: string, slotMs: number): void {
  try {
    const list = readNotified(day);
    if (!list.includes(slotMs)) list.push(slotMs);
    localStorage.setItem(STORAGE_PREFIX + day, JSON.stringify(list));
  } catch {
    /* 隐私模式下 localStorage 可能不可用：忽略，退化为本次会话内去重 */
  }
}

/**
 * 静默查询今天是否已有日记。
 * 异常一律向上抛，由调用方吞掉 —— 探测失败不该有任何可见反馈。
 */
async function hasDiaryToday(day: string): Promise<boolean> {
  const token = localStorage.getItem("token");
  const res = await fetch(`http://${siteConfig.backUrl}/api/diary`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const body = (await res.json()) as {
    code?: number;
    message?: string;
    data?: { recordDate?: string }[];
  };
  if (body?.code !== 1) throw new Error(body?.message ?? `code ${body?.code}`);

  return (body.data ?? []).some((d) => d?.recordDate === day);
}

/**
 * 发原生通知，点击跳到日记页。
 *
 * 跳转回调由调用方用 router.push 提供：本函数挂在通知的 onclick 上，
 * 不是 React 事件处理器，拿不到 router，所以从外面传进来。
 */
function notifyDiaryMissing(openDiary: () => void): void {
  const n = new Notification("今天还没写日记", {
    body: "随手记两句今天的活动吧 —— 点这里打开日记页。",
    icon: "/logo.png",
    // 刻意不设 tag：带相同 tag 的新通知会被 Chrome 静默替换、不再弹出横幅，
    // 而自动提醒的意义正是每 20 分钟都要真正提醒到人（已实测验证过这一点）
  });
  n.onclick = () => {
    window.focus();
    n.close();
    // 读 pathname 是安全的，仅用 href 赋值才会触发 no-location-assign-relative-destination
    if (window.location.pathname !== DIARY_PATH) openDiary();
  };
}

/**
 * 挂载一次性授权按钮。
 *
 * 浏览器规定 requestPermission 必须由用户手势触发，页面加载时自动请求会被忽略，
 * 所以这里给一个显式入口；授权后按钮自行消失并回调一次，让提醒立刻生效。
 * 位置取左下角，避开右下角的看板娘与右上角的 toast。
 */
function mountPermissionButton(onGranted: () => void): () => void {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "🔔 开启日记提醒";
  btn.style.cssText =
    "position:fixed;left:16px;bottom:16px;z-index:9998;padding:8px 14px;border:none;border-radius:9999px;background:rgba(99,102,241,0.92);backdrop-filter:blur(8px);color:#fff;font-size:12px;font-weight:700;line-height:1.4;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,0.35);font-family:system-ui,sans-serif;";

  btn.onclick = () => {
    btn.remove();
    Notification.requestPermission()
      .then((permission) => {
        if (permission === "granted") onGranted();
      })
      .catch(() => {
        /* 授权失败：保持安静，用户可刷新后重试 */
      });
  };

  document.body.appendChild(btn);
  return () => btn.remove();
}

export default function DiaryReminder() {
  const router = useRouter();

  useEffect(() => {
    const isStatic = process.env.NEXT_PUBLIC_IS_STATIC === "true";
    if (isStatic) return;
    if (typeof Notification === "undefined") return;

    /** 本次会话已处理过的提醒点，避免同一个点反复打接口 */
    let handledSlot = 0;
    let disposed = false;

    const tick = async () => {
      if (disposed) return;

      const now = new Date();
      const slot = latestDueSlot(now);
      if (!slot) return;

      const slotMs = slot.getTime();
      if (slotMs === handledSlot) return;

      const day = toDateStr(now);

      // 该提醒点今天已经提醒过（含本次会话之前的提醒），不再重复
      if (readNotified(day).includes(slotMs)) {
        handledSlot = slotMs;
        return;
      }

      // 未授权就发不出通知，也不必去探测日记
      if (Notification.permission !== "granted") return;

      handledSlot = slotMs;

      try {
        if (await hasDiaryToday(day)) return;
      } catch {
        // 后端不可达 / 响应异常：静默跳过，等下一个提醒点再试
        return;
      }
      if (disposed) return;

      try {
        notifyDiaryMissing(() => router.push(DIARY_PATH));
      } catch {
        // 通知构造失败（例如系统禁用了通知）：不留痕迹
        return;
      }
      markNotified(day, slotMs);
    };

    void tick();
    const timer = window.setInterval(() => void tick(), TICK_MS);
    const unmountButton =
      Notification.permission === "default"
        ? mountPermissionButton(() => void tick())
        : null;

    return () => {
      disposed = true;
      window.clearInterval(timer);
      unmountButton?.();
    };
  }, [router]);

  return null;
}
