"use client";

import { CaretLeft, CaretRight } from "./icons";

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
 * <p>复刻源项目 {@code views/song/com/SongPagination.vue} 的
 * {@code layout="total, sizes, prev, pager, next, jumper"}，
 * 并在窄屏精简为「上一页 / 页码 / 下一页」（源项目在 &lt;768px 时的处理）。</p>
 *
 * <p>样式取自 {@code index.scss} 的 {@code .el-pagination} 段：32px 高按钮、
 * 悬浮上移 1px 并加文字辉光、active 态外发光 + 内高光。</p>
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
  const compact = typeof window !== "undefined" && window.innerWidth < 768;

  // 当前页附近的页码
  const pages: number[] = [];
  const start = Math.max(1, Math.min(pageNum - 2, pageCount - 4));
  for (let i = start; i < start + 5 && i <= pageCount; i++) pages.push(i);

  return (
    <div className="mt-pagination flex items-center justify-center gap-1 mt-5">
      <span className="mt-pagination-total">共 {total} 首</span>

      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="mt-pagination-sizes"
      >
        {pageSizeOptions.map((s) => (
          <option key={s} value={s}>
            {s} 首/页
          </option>
        ))}
      </select>

      <button
        onClick={() => onPageChange(Math.max(1, pageNum - 1))}
        disabled={pageNum <= 1}
        className="mt-page-nav flex items-center justify-center"
        aria-label="上一页"
      >
        <CaretLeft size={14} />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`mt-page-btn${p === pageNum ? " active" : ""}`}
        >
          {p}
        </button>
      ))}

      {compact && (
        <span className="mt-pagination-total" style={{ margin: "0 6px" }}>
          {pageNum} / {pageCount}
        </span>
      )}

      <button
        onClick={() => onPageChange(Math.min(pageCount, pageNum + 1))}
        disabled={pageNum >= pageCount}
        className="mt-page-nav flex items-center justify-center"
        aria-label="下一页"
      >
        <CaretRight size={14} />
      </button>
    </div>
  );
}
