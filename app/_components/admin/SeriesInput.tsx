"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { SeriesBrief } from "@/lib/types";
import { getSeriesList } from "@/lib/api/article";
import { assetUrl } from "@/lib/asset-url";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";

interface Props {
  value: string;
  onChange: (series: string) => void;
  onCoverChange?: (coverImage?: string) => void;
  placeholder?: string;
}

export default function SeriesInput({ value, onChange, onCoverChange, placeholder }: Props) {
  const [options, setOptions] = useState<SeriesBrief[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 按输入过滤已存在的系列
  const filtered = value
    ? options.filter((o) => o.series.toLowerCase().includes(value.toLowerCase()))
    : options;

  // 当前输入是否匹配已有系列
  const isExisting = options.some((o) => o.series === value);

  // 加载系列列表
  const load = useCallback(async () => {
    if (loaded) return;
    const list = await getSeriesList();
    setOptions(list);
    setLoaded(true);
  }, [loaded]);

  // 聚焦时打开 + 加载
  const handleFocus = () => {
    load();
    setOpen(true);
    setHighlightIndex(-1);
  };

  // 选择某个已有系列
  const select = (series: string) => {
    onChange(series);
    const selected = options.find((o) => o.series === series);
    if (selected?.coverImage && onCoverChange) {
      onCoverChange(selected.coverImage);
    }
    setOpen(false);
    inputRef.current?.blur();
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        load();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          select(filtered[highlightIndex].series);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  };

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      const target = e.target as Node;
      if (!ref.current.contains(target) && (!panelRef.current || !panelRef.current.contains(target))) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Series (e.g. Redis学习笔记)"}
        className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50"
      />

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
          className="z-[9999] glass-card !rounded-xl p-1 shadow-xl max-h-48 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-center text-slate-400">
              {value ? "Create new series" : "No series yet"}
            </div>
          ) : (
            filtered.map((opt, i) => {
              const selected = opt.series === value;
              return (
                <button
                  key={opt.series}
                  type="button"
                  onClick={() => select(opt.series)}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-3 ${
                    i === highlightIndex
                      ? "bg-indigo-50 dark:bg-indigo-900/30"
                      : selected
                        ? "bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {opt.coverImage ? (
                    <img src={assetUrl(opt.coverImage)} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-200 to-purple-200 dark:from-indigo-800 dark:to-purple-800 shrink-0" />
                  )}
                  <span className="truncate">{opt.series}</span>
                  {selected && (
                    <svg className="w-4 h-4 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  )}
                </button>
              );
            })
          )}
          {/* 自由输入提示 */}
          {value && !isExisting && (
            <>
              <div className="mx-2 my-1 border-t border-slate-200 dark:border-slate-700" />
              <div className="px-3 py-2 text-xs text-slate-400 italic">
                Custom: "{value}"
              </div>
            </>
          )}
        </motion.div>,
        document.body
      )}
    </div>
  );
}
