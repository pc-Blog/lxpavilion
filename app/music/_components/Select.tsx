"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, CircleClose } from "./icons";

/** 选项。值统一用字符串承载，"" 保留给「未选择」，与原生 select 的语义一致。 */
export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** 未选中时显示的灰字（源 el-select 的 placeholder） */
  placeholder?: string;
  /** 源 el-select 的 clearable：悬停且已有选中值时，把箭头换成清除按钮 */
  clearable?: boolean;
  /** 附加到触发器上的类名，用于 flex-1 / 固定宽度等布局 */
  className?: string;
  ariaLabel?: string;
}

/** 源 .el-select-dropdown__item 的固定行高；浮层高度与键盘滚动都依赖它 */
const ITEM_HEIGHT = 34;
/** 源 .el-select-dropdown__list 的上下内边距 */
const LIST_PADDING = 6;
/** 源 .el-select-dropdown__wrap 的 max-height */
const WRAP_MAX_HEIGHT = 274;
/** 源 select.mjs 的 offset 默认值：浮层与触发器相距 12px */
const OFFSET = 12;
/** 空数据行（源 .el-select-dropdown__empty）的高度，仅用于翻转判断 */
const EMPTY_HEIGHT = 41;

type Placement = "bottom" | "top";

interface PanelBox {
  placement: Placement;
  top: number;
  left: number;
  minWidth: number;
}

/**
 * 下拉选择器。
 *
 * <p>等价于源项目的 {@code el-select}（单选）。音乐页原来直接用原生
 * {@code <select>}：收起状态还能用 CSS 修饰，但展开的选项列表由操作系统绘制，
 * {@code option} 的 background-color 在多数浏览器也不生效，无法做霓虹磨砂，
 * 所以这里自绘浮层，样式取自 {@code index.scss:708-871} 的
 * {@code .el-select} / {@code .el-select-dropdown}。</p>
 *
 * <p>定位与源项目一致：{@code placement="bottom-start"} + {@code offset=12}，
 * 空间不够时翻到上方（源 {@code fallbackPlacements} 的前两项）。
 * 浮层用 portal 挂到 body，既不继承 {@code .music-theme} 的 CSS 变量，
 * 也不会被弹窗的 {@code overflow} 裁掉。</p>
 *
 * <p>未实现源项目的 {@code filterable}（下拉内搜索）：原生 select 本来也没有，
 * 不属于本次「换掉原生下拉」的范围。</p>
 */
export default function Select({
  value,
  options,
  onChange,
  placeholder = "",
  clearable = false,
  className = "",
  ariaLabel,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [box, setBox] = useState<PanelBox | null>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  // 源 useSelect.mjs:98 —— clearable && !disabled && 悬停中 && 有值
  const showClear = clearable && hovered && selected !== null;

  // 浮层最大可能高度，只用来判断朝上还是朝下；实际高度由 CSS 决定
  const contentHeight =
    options.length === 0
      ? EMPTY_HEIGHT
      : options.length * ITEM_HEIGHT + LIST_PADDING * 2;
  const panelHeight = Math.min(WRAP_MAX_HEIGHT, contentHeight) + 1;

  /**
   * 量出触发器位置并算出浮层坐标。
   *
   * <p>锚点是触发器的外接矩形：浮层默认贴在下方 12px 处、左右对齐并至少和触发器
   * 等宽（源 select-dropdown.mjs 的 {@code minWidth = selectRef.offsetWidth}）；
   * 下方放不下且上方更宽裕时翻到上方。</p>
   */
  const measure = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - OFFSET;
    const above = r.top - OFFSET;
    const placement: Placement = panelHeight > below && above > below ? "top" : "bottom";
    const anchor = placement === "bottom" ? r.bottom + OFFSET : r.top - OFFSET - panelHeight;
    setBox({
      placement,
      left: r.left,
      // 视口太矮时上下都放不下，兜底贴到顶（源 popper 的 preventOverflow 位移）
      top: Math.max(4, Math.min(anchor, window.innerHeight - panelHeight - 4)),
      minWidth: r.width,
    });
  }, [panelHeight]);

  /** 打开。定位在同一帧内算好，避免浮层先出现在旧位置再跳。 */
  const openPanel = useCallback(() => {
    setHoverIndex(selectedIndex);
    measure();
    setOpen(true);
  }, [measure, selectedIndex]);

  const closePanel = useCallback(() => setOpen(false), []);

  const commit = useCallback(
    (v: string) => {
      onChange(v);
      closePanel();
    },
    [closePanel, onChange],
  );

  // 弹窗内部滚动 / 窗口缩放时重新定位（音乐页自身不滚动，body 被 overflow:hidden）
  useEffect(() => {
    if (!open) return;
    const reposition = () => measure();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [measure, open]);

  // 点击浮层与触发器之外关闭（源 el-select 的 v-click-outside）
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (wrapRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 键盘移动高亮项时把该项滚进可视区；行高固定，直接算即可
  useEffect(() => {
    if (!open || hoverIndex < 0) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const top = hoverIndex * ITEM_HEIGHT + LIST_PADDING;
    const bottom = top + ITEM_HEIGHT;
    if (top < wrap.scrollTop) wrap.scrollTop = top;
    else if (bottom > wrap.scrollTop + wrap.clientHeight)
      wrap.scrollTop = bottom - wrap.clientHeight;
  }, [hoverIndex, open]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      if (!open) return;
      // 音乐页的弹窗在 window 上监听 Esc，这里先拦下，避免连弹窗一起关掉
      e.stopPropagation();
      closePanel();
      return;
    }
    if (e.key === "Tab") {
      closePanel();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openPanel();
        return;
      }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const from = hoverIndex >= 0 ? hoverIndex : selectedIndex;
      const base = from >= 0 ? from : dir === 1 ? -1 : options.length;
      setHoverIndex(Math.min(options.length - 1, Math.max(0, base + dir)));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        openPanel();
        return;
      }
      const target = options[hoverIndex];
      if (target) commit(target.value);
    }
  };

  return (
    <div
      ref={rootRef}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listId : undefined}
      aria-label={ariaLabel}
      tabIndex={0}
      className={`mt-select${focused || open ? " is-focus" : ""} ${className}`.trim()}
      onClick={() => (open ? closePanel() : openPanel())}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <span className={`mt-select-text${selected ? "" : " is-placeholder"}`}>
        {selected ? selected.label : placeholder}
      </span>

      {showClear ? (
        <span
          role="button"
          aria-label="清空"
          className="mt-select-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onChange("");
          }}
        >
          <CircleClose size={14} />
        </span>
      ) : (
        <span className="mt-select-caret">
          <ArrowDown size={14} />
        </span>
      )}

      {open &&
        box &&
        createPortal(
          <div
            className="mt-el-select-panel"
            data-placement={box.placement}
            style={{ top: box.top, left: box.left, minWidth: box.minWidth }}
          >
            {/* 源 .el-popper__arrow：水平居中于触发器 */}
            <span
              aria-hidden
              className="mt-el-select-arrow"
              style={{ left: box.minWidth / 2 - 5 }}
            />
            <div className="mt-el-select-panel-wrap" ref={wrapRef}>
              <ul id={listId} role="listbox" className="mt-el-select-panel-list">
                {options.length === 0 ? (
                  <li className="mt-el-select-panel-empty">No data</li>
                ) : (
                  options.map((o, i) => (
                    <li
                      key={o.value}
                      role="option"
                      aria-selected={o.value === value}
                      className={`mt-el-select-panel-item${
                        o.value === value ? " is-selected" : ""
                      }${i === hoverIndex ? " is-hovering" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHoverIndex(i)}
                      onClick={(e) => {
                        // 浮层在 React 树里仍是本组件的子节点，事件会冒到触发器上，
                        // 那里会当成「再点一次触发器」把浮层收起来，这里先拦掉
                        e.stopPropagation();
                        commit(o.value);
                      }}
                    >
                      {o.label}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
