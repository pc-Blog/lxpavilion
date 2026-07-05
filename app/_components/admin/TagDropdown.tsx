"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";

interface TagDropdownProps<T> {
  options: T[];
  selected: (string | number)[];
  onChange: (selected: (string | number)[]) => void;
  placeholder: string;
  renderOption: (option: T) => string;
  getValue: (option: T) => string | number;
  disabled?: boolean;
  searchable?: boolean;
}

export default function TagDropdown<T>({
  options, selected, onChange, placeholder, renderOption, getValue, disabled, searchable = true,
}: TagDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [scrollKey, setScrollKey] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭：触发器 + Portal 面板
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

  const filteredOptions = searchable && search
    ? options.filter((o) => renderOption(o).toLowerCase().includes(search.toLowerCase()))
    : options;

  const selectedOptions = options.filter((o) => selected.includes(getValue(o)));
  const visibleTags = selectedOptions.slice(0, 3);
  const moreCount = selectedOptions.length - visibleTags.length;

  const toggle = (v: string | number) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50 flex items-center justify-between gap-2 disabled:opacity-50 min-h-[42px]"
      >
        <span className="flex items-center gap-1.5 flex-wrap min-w-0">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            <>
              {visibleTags.map((o) => (
                <span key={getValue(o)} className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[100px]">
                  {renderOption(o)}
                </span>
              ))}
              {moreCount > 0 && (
                <span className="text-[11px] text-slate-400">+{moreCount} more</span>
              )}
            </>
          )}
        </span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && createPortal(
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={ref.current ? (() => {
            const rect = ref.current.getBoundingClientRect();
            return { position: "fixed" as const, top: rect.bottom + 4, left: rect.left, width: rect.width };
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
                    if (e.key === "Escape") { setOpen(false); }
                    e.stopPropagation();
                  }}
                  placeholder="搜索..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
                />
              </div>
            )}
            <div className="max-h-72 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center text-slate-400">无匹配</div>
              ) : (
                filteredOptions.map((o) => {
                  const v = getValue(o);
                  const isSelected = selected.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggle(v)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                        isSelected ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? "bg-indigo-500 border-indigo-500" : "border-slate-300 dark:border-slate-600"
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </span>
                      {renderOption(o)}
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
