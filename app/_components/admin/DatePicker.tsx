"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

export default function DatePicker({ value, onChange, placeholder = "Select date", disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [scrollKey, setScrollKey] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // 打开期间监听 scroll/resize → 触发重渲染以重新计算 fixed 定位
  useLayoutEffect(() => {
    if (!open) return;
    const rePosition = () => setScrollKey(k => k + 1);
    window.addEventListener("scroll", rePosition, { capture: true, passive: true });
    window.addEventListener("resize", rePosition);
    return () => {
      window.removeEventListener("scroll", rePosition, { capture: true });
      window.removeEventListener("resize", rePosition);
    };
  }, [open]);

  const parts = value ? value.split("-") : [];
  const selectedYear = parts[0] || String(currentYear);
  const selectedMonth = parts[1] || "01";
  const selectedDay = parts[2] || "01";

  const select = (y: string, m: string, d: string) => {
    const maxDay = new Date(Number(y), Number(m), 0).getDate();
    const safeDay = String(Math.min(Number(d), maxDay)).padStart(2, "0");
    onChange(`${y}-${m}-${safeDay}`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50 flex items-center justify-between gap-2 disabled:opacity-50"
      >
        <span className={value ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && createPortal(
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={ref.current ? (() => {
            const rect = ref.current.getBoundingClientRect();
            return { position: "fixed" as const, top: rect.bottom + 4, left: rect.left, minWidth: rect.width };
          })() : { position: "fixed" as const, top: -9999, left: -9999 }}
          className="z-[9999] glass-card !rounded-xl p-2 shadow-xl flex gap-1"
        >
            {/* Year column */}
            <div className="flex-1 max-h-48 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 px-2 py-1 sticky top-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur">Year</div>
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => select(String(y), selectedMonth, selectedDay)}
                  className={`w-full text-center px-2 py-1 text-xs rounded-md transition-colors ${
                    String(y) === selectedYear ? "bg-indigo-500 text-white font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            {/* Month column */}
            <div className="flex-1 max-h-48 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 px-2 py-1 sticky top-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur">Month</div>
              {months.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => select(selectedYear, m, selectedDay)}
                  className={`w-full text-center px-2 py-1 text-xs rounded-md transition-colors ${
                    m === selectedMonth ? "bg-indigo-500 text-white font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {/* Day column */}
            <div className="flex-1 max-h-48 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 px-2 py-1 sticky top-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur">Day</div>
              {days.map((d) => {
                const maxDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
                const dayNum = Number(d);
                const disabled = dayNum > maxDay;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => select(selectedYear, selectedMonth, d)}
                    className={`w-full text-center px-2 py-1 text-xs rounded-md transition-colors ${
                      disabled ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" :
                      d === selectedDay ? "bg-indigo-500 text-white font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </motion.div>,
          document.body
        )}
    </div>
  );
}
