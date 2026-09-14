"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { getSubcategories } from "@/lib/api/diary";

/**
 * 小分类选择器
 *
 * 与源项目 SubcategorySelect.vue 的差异：**Enter 只填入当前行，不再调创建接口**。
 * 选项列表由后端从活动条目里 DISTINCT 推导（没有 t_subcategory 表），
 * 所以新值要等这篇日记保存后才会进入建议列表——也就不会产生孤儿值。
 */
export default function SubcategoryPicker({
  value,
  category,
  onChange,
}: {
  value?: string | null;
  /** 当前行的分类，用于拉取该分类下已用过的小分类 */
  category: number;
  onChange: (v: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 展开时拉取；分类变化后重新拉取
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getSubcategories(category)
      .then((list) => {
        if (alive) setItems(list ?? []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [open, category]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setKeyword("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((i) => i.toLowerCase().includes(kw));
  }, [items, keyword]);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setKeyword("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const name = keyword.trim();
      if (name) pick(name);
    } else if (e.key === "Escape") {
      setOpen(false);
      setKeyword("");
    }
  };

  return (
    <div ref={boxRef} className="relative w-[140px] shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setTimeout(() => inputRef.current?.focus(), 30);
        }}
        className="flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white/70 px-2 text-xs text-slate-700 transition-colors hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:border-slate-500"
      >
        <span className={`truncate ${value ? "" : "text-slate-400 dark:text-slate-500"}`}>
          {value || "小分类"}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {value && (
            <X
              size={12}
              className="text-slate-400 hover:text-rose-500"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
            />
          )}
          <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <div className="border-b border-slate-100 p-1.5 dark:border-slate-700">
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 dark:border-slate-600 dark:bg-slate-900/50">
              <Search size={12} className="shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索或输入创建..."
                className="h-6 w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick(name)}
                  className={`block w-full truncate px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 ${
                    value === name
                      ? "font-bold text-indigo-600 dark:text-indigo-400"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {name}
                </button>
              ))
            ) : (
              <p className="px-2.5 py-3 text-center text-xs text-slate-400">
                {keyword.trim() ? "按 Enter 填入" : "暂无小分类"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
