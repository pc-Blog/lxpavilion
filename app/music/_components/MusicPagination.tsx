"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  pageNum: number;
  pageSize: number;
  total: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * 分页条。
 *
 * <p>复刻源项目 {@code views/song/com/SongPagination.vue}，含响应式精简：
 * 窄屏只留「上一页 / 下一页」，宽屏展示页码与每页条数。</p>
 */
export default function MusicPagination({
  pageNum,
  pageSize,
  total,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // 当前页附近的页码
  const pages: number[] = [];
  const start = Math.max(1, Math.min(pageNum - 2, pageCount - 4));
  for (let i = start; i < start + 5 && i <= pageCount; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-3 mt-5 py-1">
      {!compact && (
        <span className="text-xs" style={{ color: "rgba(180,200,220,0.7)" }}>
          共 {total} 首
        </span>
      )}

      {!compact && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 px-2 rounded text-xs outline-none"
          style={{
            backgroundColor: "rgba(65,65,75,0.7)",
            border: "1px solid rgba(120,230,255,0.2)",
            color: "rgba(220,230,240,0.9)",
          }}
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>
              {s} 首/页
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() => onPageChange(Math.max(1, pageNum - 1))}
        disabled={pageNum <= 1}
        className="flex items-center justify-center w-8 h-8 rounded transition-all duration-200 disabled:opacity-30"
        style={{
          backgroundColor: "rgba(65,65,75,0.7)",
          border: "1px solid rgba(120,230,255,0.2)",
          color: "rgba(220,230,240,0.9)",
        }}
      >
        <ChevronLeft size={14} />
      </button>

      {!compact &&
        pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className="w-8 h-8 rounded text-xs transition-all duration-200"
            style={{
              backgroundColor:
                p === pageNum ? "rgba(70,165,255,0.5)" : "rgba(65,65,75,0.7)",
              border: `1px solid ${
                p === pageNum ? "rgba(120,230,255,0.5)" : "rgba(120,230,255,0.2)"
              }`,
              color: p === pageNum ? "#fff" : "rgba(220,230,240,0.9)",
            }}
          >
            {p}
          </button>
        ))}

      {compact && (
        <span className="text-xs" style={{ color: "rgba(180,200,220,0.8)" }}>
          {pageNum} / {pageCount}
        </span>
      )}

      <button
        onClick={() => onPageChange(Math.min(pageCount, pageNum + 1))}
        disabled={pageNum >= pageCount}
        className="flex items-center justify-center w-8 h-8 rounded transition-all duration-200 disabled:opacity-30"
        style={{
          backgroundColor: "rgba(65,65,75,0.7)",
          border: "1px solid rgba(120,230,255,0.2)",
          color: "rgba(220,230,240,0.9)",
        }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
