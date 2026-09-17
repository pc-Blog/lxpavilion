"use client";

import { useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  DArrowLeft,
  DArrowRight,
  MoreFilled,
} from "./icons";

interface Props {
  pageNum: number;
  pageSize: number;
  total: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/** Element Plus 分页器默认页码容量（pagination.mjs: pagerCount default 7）。 */
const PAGER_COUNT = 7;

/** 源项目 SongPagination.vue 的三档断点。 */
type Tier = "sm" | "md" | "lg";

function readTier(): Tier {
  const w = window.innerWidth;
  return w < 768 ? "sm" : w < 992 ? "md" : "lg";
}

function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const serverTier = (): Tier => "lg";

/**
 * 页码序列与两个省略号开关。
 *
 * <p>逐条照搬 element-plus 2.9.9 {@code pagination/src/components/pager.mjs}
 * 的 {@code pagers} / {@code showPrevMore} / {@code showNextMore} 计算：
 * {@code halfPagerCount = (pagerCount - 1) / 2}，首尾页永远渲染，
 * 中间最多 {@code pagerCount - 2} 个页码。</p>
 */
function buildPager(pageNum: number, pageCount: number) {
  const halfPagerCount = (PAGER_COUNT - 1) / 2;
  let showPrevMore = false;
  let showNextMore = false;
  if (pageCount > PAGER_COUNT) {
    if (pageNum > PAGER_COUNT - halfPagerCount) showPrevMore = true;
    if (pageNum < pageCount - halfPagerCount) showNextMore = true;
  }

  const pagers: number[] = [];
  if (showPrevMore && !showNextMore) {
    const startPage = pageCount - (PAGER_COUNT - 2);
    for (let i = startPage; i < pageCount; i++) pagers.push(i);
  } else if (!showPrevMore && showNextMore) {
    for (let i = 2; i < PAGER_COUNT; i++) pagers.push(i);
  } else if (showPrevMore && showNextMore) {
    const offset = Math.floor(PAGER_COUNT / 2) - 1;
    for (let i = pageNum - offset; i <= pageNum + offset; i++) pagers.push(i);
  } else {
    for (let i = 2; i < pageCount; i++) pagers.push(i);
  }

  return { pagers, showPrevMore, showNextMore };
}

/**
 * 分页条。
 *
 * <p>复刻源项目 {@code views/song/com/SongPagination.vue}
 * 的 {@code layout="total, sizes, prev, pager, next, jumper"}，并按源项目
 * 的三档断点切换 layout：&lt;768px 只留「上一页 / 页码 / 下一页」，
 * &lt;992px 加回总数，≥992px 全量。</p>
 *
 * <p>文案沿用源项目实测结果：源项目没有引入 Element Plus 的 locale，
 * 因此分页器走默认英文（{@code Total {total}} / {@code {size}/page} /
 * {@code Go to}），而不是中文。</p>
 *
 * <p>样式取自 {@code index.scss} 的 {@code .el-pagination} 段：32px 高按钮、
 * 悬浮上移 1px 并加文字辉光、active 态外发光 + 内高光；跳页输入框 60px、
 * 每页条数选择器 128px。</p>
 */
export default function MusicPagination({
  pageNum,
  pageSize,
  total,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const tier = useSyncExternalStore(subscribeResize, readTier, serverTier);
  const [quickPrevActive, setQuickPrevActive] = useState(false);
  const [quickNextActive, setQuickNextActive] = useState(false);
  // 跳页输入框的草稿值；null 表示跟随当前页（对应源项目的 userInput）
  const [jumpValue, setJumpValue] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const { pagers, showPrevMore, showNextMore } = buildPager(pageNum, pageCount);

  const showTotal = tier !== "sm";
  const showSizes = tier === "lg";
  const showJumper = tier === "lg";

  /** 翻页；边界收敛与 element-plus currentPageBridge 的 setter 一致。 */
  const goTo = (page: number) => {
    if (!Number.isFinite(page)) return;
    const next = Math.min(pageCount, Math.max(1, Math.trunc(page)));
    if (next !== pageNum) onPageChange(next);
  };

  /** 省略号快进/快退：源项目为 currentPage ∓ (pagerCount - 2) 页。 */
  const quickJump = (dir: -1 | 1) => {
    goTo(pageNum + dir * (PAGER_COUNT - 2));
  };

  /** 跳页输入提交（源项目 jumper 的 handleChange：Math.trunc(+val) 后交给 setter 收敛）。 */
  const commitJump = (raw: string) => {
    setJumpValue(null);
    if (raw.trim() === "") return goTo(pageNum);
    goTo(Math.trunc(Number(raw)));
  };

  /** 源项目 pager 的 onEnter：在页码/省略号上用回车键触发。 */
  const handlePagerKeyUp = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "Enter") return;
    const el = e.target as HTMLElement;
    if (el.tagName.toLowerCase() !== "li") return;
    if (el.classList.contains("number")) goTo(Number(el.textContent));
    else if (el.classList.contains("more"))
      quickJump(el.classList.contains("quickprev") ? -1 : 1);
  };

  const pageItemClass = (page: number) =>
    `mt-page-btn number${page === pageNum ? " is-active" : ""}`;

  return (
    <div className="mt-pagination-container">
      <div className="mt-pagination">
        {showTotal && (
          <span className="mt-pagination-total is-first">Total {total}</span>
        )}

        {showSizes && (
          <span className="mt-pagination-sizes">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="mt-pagination-select"
              aria-label="page size"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}/page
                </option>
              ))}
            </select>
          </span>
        )}

        <button
          type="button"
          onClick={() => goTo(pageNum - 1)}
          disabled={pageNum <= 1}
          className={`mt-page-nav btn-prev${showTotal ? "" : " is-first"}`}
          aria-label="Go to previous page"
        >
          <ArrowLeft size={12} />
        </button>

        <ul className="mt-pager" onKeyUp={handlePagerKeyUp}>
          {pageCount > 0 && (
            <li
              onClick={() => goTo(1)}
              className={pageItemClass(1)}
              aria-current={pageNum === 1}
              tabIndex={0}
            >
              1
            </li>
          )}

          {showPrevMore && (
            <li
              className="mt-page-btn more btn-quickprev"
              onClick={() => quickJump(-1)}
              onMouseEnter={() => setQuickPrevActive(true)}
              onMouseLeave={() => setQuickPrevActive(false)}
              onFocus={() => setQuickPrevActive(true)}
              onBlur={() => setQuickPrevActive(false)}
              aria-label={`Previous ${PAGER_COUNT - 2} pages`}
              tabIndex={0}
            >
              {quickPrevActive ? <DArrowLeft size={14} /> : <MoreFilled size={14} />}
            </li>
          )}

          {pagers.map((p) => (
            <li
              key={p}
              onClick={() => goTo(p)}
              className={pageItemClass(p)}
              aria-current={pageNum === p}
              tabIndex={0}
            >
              {p}
            </li>
          ))}

          {showNextMore && (
            <li
              className="mt-page-btn more btn-quicknext"
              onClick={() => quickJump(1)}
              onMouseEnter={() => setQuickNextActive(true)}
              onMouseLeave={() => setQuickNextActive(false)}
              onFocus={() => setQuickNextActive(true)}
              onBlur={() => setQuickNextActive(false)}
              aria-label={`Next ${PAGER_COUNT - 2} pages`}
              tabIndex={0}
            >
              {quickNextActive ? <DArrowRight size={14} /> : <MoreFilled size={14} />}
            </li>
          )}

          {pageCount > 1 && (
            <li
              onClick={() => goTo(pageCount)}
              className={pageItemClass(pageCount)}
              aria-current={pageNum === pageCount}
              tabIndex={0}
            >
              {pageCount}
            </li>
          )}
        </ul>

        <button
          type="button"
          onClick={() => goTo(pageNum + 1)}
          disabled={pageNum >= pageCount}
          className="mt-page-nav btn-next"
          aria-label="Go to next page"
        >
          <ArrowRight size={12} />
        </button>

        {showJumper && (
          <span className="mt-pagination-jump">
            <span className="mt-pagination-goto">Go to</span>
            <span className="mt-pagination-editor">
              <input
                className="mt-pagination-editor-inner"
                type="number"
                min={1}
                max={pageCount}
                value={jumpValue ?? String(pageNum)}
                aria-label="Page"
                onChange={(e) => setJumpValue(e.target.value)}
                onBlur={(e) => commitJump(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitJump(e.currentTarget.value);
                }}
              />
            </span>
            <span className="mt-pagination-classifier" />
          </span>
        )}
      </div>
    </div>
  );
}
