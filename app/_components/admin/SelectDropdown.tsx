"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";

interface SelectDropdownProps<T> {
  options: T[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder: string;
  renderOption: (option: T) => string;
  getValue: (option: T) => string | number;
  disabled?: boolean;
  direction?: "down" | "up" | "auto";
  searchable?: boolean;
}

export default function SelectDropdown<T>({
  options, value, onChange, placeholder, renderOption, getValue, disabled, direction = "auto", searchable,
}: SelectDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [search, setSearch] = useState("");
  const [scrollKey, setScrollKey] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭：同时检查触发器区域和 Portal 面板区域
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      const target = e.target as Node;
      const isOutside = !ref.current.contains(target)
        && (!panelRef.current || !panelRef.current.contains(target));
      if (isOutside) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus();
    }
    if (!open) setSearch("");
  }, [open, searchable]);

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

  const selectedOption = options.find((o) => getValue(o) === value);

  const filteredOptions = searchable && search
    ? options.filter((o) => renderOption(o).toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      if (direction === "up") setDropUp(true);
      else if (direction === "down") setDropUp(false);
      else if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const estimatedHeight = Math.min(options.length * 40, 192) + 8;
        setDropUp(rect.bottom + estimatedHeight > window.innerHeight);
      }
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        disabled={disabled}
        onClick={toggle}
        className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50 flex items-center justify-between gap-2 disabled:opacity-50"
      >
        <span className={selectedOption ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}>{selectedOption ? renderOption(selectedOption) : placeholder}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {/* 使用 Portal 渲染到 body：逃脱层叠上下文 & overflow 裁剪 */}
      {open && createPortal(
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: dropUp ? 4 : -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={ref.current ? (() => {
            const rect = ref.current.getBoundingClientRect();
            const margin = 4;
            if (dropUp) {
              const sh = searchable ? 40 : 0;
              const ch = Math.min(options.length * 40, 160) + 8;
              return { position: "fixed" as const, top: rect.top - ch - sh - margin, left: rect.left, width: rect.width };
            }
            return { position: "fixed" as const, top: rect.bottom + margin, left: rect.left, width: rect.width };
          })() : { position: "fixed" as const, top: -9999, left: -9999 }}
          className="z-[9999] glass-card !rounded-xl p-1 shadow-xl"
        >
          {searchable && (
            <div className="px-2 pt-1 pb-1.5">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredOptions.length > 0) {
                    onChange(getValue(filteredOptions[0]));
                    setOpen(false);
                  }
                  if (e.key === "Escape") { setOpen(false); }
                  e.stopPropagation();
                }}
                placeholder="搜索..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
              />
            </div>
          )}
          <div className="max-h-40 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-slate-400">无匹配</div>
            ) : (
              filteredOptions.map((opt) => {
                const v = getValue(opt);
                const isSelected = v === value;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { onChange(v); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                      isSelected ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {renderOption(opt)}
                    {isSelected && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>,
        document.body
      )}
    </div>
  );
}
