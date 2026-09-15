"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"（mode="calendar"）或 "YYYY-MM"（mode="month"）
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 可选上界（含），与 value 同格式 */
  max?: string;
  /** 可选下界（含），与 value 同格式 */
  min?: string;
  /** "calendar"：月历网格（默认）；"month"：只选年月（用于筛选） */
  mode?: "calendar" | "month";
}

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

const pad2 = (n: number) => String(n).padStart(2, "0");
/** 用本地时间构造，避免 toISOString 的 UTC 偏移 */
const toISO = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

function todayISO() {
  const t = new Date();
  return toISO(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

/**
 * 月历网格：以周一为一周之首，固定 6 行 × 7 列 = 42 格。
 * 前后补上月/下月的日期，保证任何月份网格尺寸一致、不会跳动。
 */
function buildGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  // getDay(): 0=周日 → 转成 0=周一
  const leading = (first.getDay() + 6) % 7;
  const cells: { key: string; day: number }[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(year, month - 1, 1 - leading + i);
    cells.push({
      key: toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()),
      day: dt.getDate(),
    });
  }
  return cells;
}

const NAV_BTN =
  "p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors";
const CELL_BASE = "rounded-lg text-xs tabular-nums transition-colors";
const CELL_ON = "bg-indigo-500 text-white font-bold";
const CELL_OFF = "text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-700/70";
const CELL_DISABLED = "text-slate-300 dark:text-slate-600 cursor-not-allowed";
const TODAY_RING = "ring-1 ring-inset ring-indigo-400/70 font-bold";

/** 年月面板（mode="month"）：筛选条用 */
function MonthPanel({
  value,
  min,
  max,
  onPick,
}: {
  value: string;
  min?: string;
  max?: string;
  onPick: (ym: string) => void;
}) {
  const [viewYear, setViewYear] = useState(() =>
    value ? Number(value.slice(0, 4)) : new Date().getFullYear(),
  );
  const thisYear = useMemo(() => new Date().getFullYear(), []);
  const thisMonth = useMemo(() => new Date().getMonth() + 1, []);
  const selectedYear = value ? Number(value.slice(0, 4)) : null;
  const selectedMonth = value ? Number(value.slice(5, 7)) : null;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setViewYear((y) => y - 1)} className={NAV_BTN} aria-label="上一年">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
          {viewYear} 年
        </span>
        <button type="button" onClick={() => setViewYear((y) => y + 1)} className={NAV_BTN} aria-label="下一年">
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const ym = `${viewYear}-${pad2(m)}`;
          const off =
            (min !== undefined && ym < min.slice(0, 7)) ||
            (max !== undefined && ym > max.slice(0, 7));
          const isSelected = selectedYear === viewYear && selectedMonth === m;
          const isThisMonth = viewYear === thisYear && m === thisMonth;
          return (
            <button
              key={m}
              type="button"
              disabled={off}
              onClick={() => onPick(ym)}
              className={`h-8 ${CELL_BASE} ${
                off ? CELL_DISABLED : isSelected ? CELL_ON : CELL_OFF
              } ${!off && isThisMonth && !isSelected ? TODAY_RING : ""}`}
            >
              {m} 月
            </button>
          );
        })}
      </div>

      {selectedYear === null ? (
        <p className="mt-1.5 py-1 text-center text-[11px] text-slate-400">未筛选</p>
      ) : (
        <button
          type="button"
          onClick={() => onPick("")}
          className="mt-1.5 w-full py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-indigo-500 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors"
        >
          清除筛选
        </button>
      )}
    </>
  );
}

/**
 * 月历面板（mode="calendar"）
 *
 * 只在 open 时挂载，所以 viewYear/viewMonth 的 useState 初始值天然等于
 * 「本次打开时 value 所在的月份」，不需要用 effect 去同步
 * （那会触发 react-hooks/set-state-in-effect）。
 */
function CalendarPanel({
  value,
  max,
  min,
  onPick,
}: {
  value: string;
  max?: string;
  min?: string;
  onPick: (iso: string) => void;
}) {
  const [viewYear, setViewYear] = useState(() =>
    value ? Number(value.slice(0, 4)) : new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(() =>
    value ? Number(value.slice(5, 7)) : new Date().getMonth() + 1,
  );

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const today = useMemo(() => todayISO(), []);

  const shiftMonth = (delta: number) => {
    const dt = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(dt.getFullYear());
    setViewMonth(dt.getMonth() + 1);
  };

  const blocked = (iso: string) =>
    (max !== undefined && iso > max) || (min !== undefined && iso < min);

  return (
    <>
      {/* ── 头部：年份切换 + 当前年月 ── */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setViewYear((y) => y - 1)} className={NAV_BTN} aria-label="上一年">
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
          {viewYear} 年
        </span>
        <button type="button" onClick={() => setViewYear((y) => y + 1)} className={NAV_BTN} aria-label="下一年">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="flex items-center justify-between mb-1.5 -mt-0.5">
        <button type="button" onClick={() => shiftMonth(-1)} className={NAV_BTN} aria-label="上个月">
          <ChevronLeft size={14} />
        </button>
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
          {viewMonth} 月
        </span>
        <button type="button" onClick={() => shiftMonth(1)} className={NAV_BTN} aria-label="下个月">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── 星期表头（周一起）── */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="text-center text-[10px] font-bold text-slate-400">
            {w}
          </div>
        ))}
      </div>

      {/* ── 日期网格：固定 6×7 ── */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((c) => {
          const isSelected = c.key === value;
          const isToday = c.key === today;
          const off = blocked(c.key);
          return (
            <button
              key={c.key}
              type="button"
              disabled={off}
              onClick={() => onPick(c.key)}
              className={`h-7 text-[11px] ${CELL_BASE} ${
                off ? CELL_DISABLED : isSelected ? CELL_ON : CELL_OFF
              } ${!off && isToday && !isSelected ? TODAY_RING : ""}`}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  max,
  min,
  mode = "calendar",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  /** 面板定位：存在 state 里（而不是渲染期读 ref），避免 react-hooks/refs */
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isMonth = mode === "month";
  const PANEL_W = isMonth ? 216 : 268;
  const PANEL_H = isMonth ? 200 : 300;

  // 点击外部关闭：触发器 + Portal 面板
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      const target = e.target as Node;
      const isOutside = !ref.current.contains(target)
        && (!panelRef.current || !panelRef.current.contains(target));
      if (isOutside) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.bottom + 4;
    if (top + PANEL_H > vh - 8) {
      // 下方放不下就翻到上方；上方也放不下就贴底
      const above = rect.top - PANEL_H - 4;
      top = above >= 8 ? above : Math.max(8, vh - PANEL_H - 8);
    }
    setPanelPos({
      top,
      left: Math.min(Math.max(8, rect.left), Math.max(8, vw - PANEL_W - 8)),
    });
  }, [PANEL_W, PANEL_H]);

  // 打开时测一次；滚动/缩放时重测（面板是 fixed，必须跟着触发器走）。
  // 依赖里只能有 open 和 measure——把 panelPos 放进来会因 setPanelPos 产生新对象而无限循环。
  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const rePosition = () => measure();
    window.addEventListener("scroll", rePosition, { capture: true, passive: true });
    window.addEventListener("resize", rePosition);
    return () => {
      window.removeEventListener("scroll", rePosition, { capture: true });
      window.removeEventListener("resize", rePosition);
    };
  }, [open, measure]);

  /** 选完即关。v 可为空串（年月面板的「清除筛选」），保持清除语义。 */
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className={isMonth ? "relative w-[112px]" : "relative w-[136px]"}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="glass-card !rounded-lg w-full h-8 px-2.5 text-xs outline-none bg-white/50 dark:bg-slate-800/50 flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={value ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}>
          {value || placeholder}
        </span>
        {isMonth ? (
          <svg className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        ) : (
          <CalendarDays className="w-4 h-4 shrink-0 text-slate-400" />
        )}
      </button>

      {open && panelPos && createPortal(
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={{ position: "fixed", top: panelPos.top, left: panelPos.left }}
          className={`z-[9999] glass-card !rounded-xl p-2.5 shadow-xl ${isMonth ? "w-[216px]" : "w-[268px]"}`}
        >
          {isMonth ? (
            <MonthPanel value={value} min={min} max={max} onPick={pick} />
          ) : (
            <CalendarPanel value={value} max={max} min={min} onPick={pick} />
          )}
        </motion.div>,
        document.body
      )}
    </div>
  );
}
