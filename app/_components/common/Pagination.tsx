"use client";

import SelectDropdown from "@/app/_components/admin/SelectDropdown";

interface PaginationProps {
  total: number;
  pageNum: number;
  pageSize: number;
  onChange: (pageNum: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** 显示用的总数（如文章数），不传则用 total */
  displayTotal?: number;
}

export default function Pagination({ total, pageNum, pageSize, onChange, onPageSizeChange, displayTotal }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (pageNum > 3) pages.push("...");
    for (let i = Math.max(2, pageNum - 1); i <= Math.min(totalPages - 1, pageNum + 1); i++) pages.push(i);
    if (pageNum < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
      <span className="text-xs text-slate-400">{displayTotal ?? total} items</span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(pageNum - 1)}
          disabled={pageNum <= 1}
          className="w-7 h-7 rounded-lg text-xs font-bold text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-300">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                p === pageNum
                  ? "bg-indigo-500 text-white"
                  : "text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(pageNum + 1)}
          disabled={pageNum >= totalPages}
          className="w-7 h-7 rounded-lg text-xs font-bold text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ›
        </button>
      </div>

      {onPageSizeChange ? (
        <div className="w-28">
          <SelectDropdown
            options={[10, 20, 50]}
            value={pageSize}
            onChange={(v) => onPageSizeChange(Number(v))}
            placeholder="Per page"
            renderOption={(v) => `${v} / page`}
            getValue={(v) => v}
          />
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}
