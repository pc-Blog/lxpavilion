"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * 音乐模块自己的悬浮提示，对应源项目的 {@code el-tooltip}。
 *
 * <p>源项目在音乐模块里用了四处 {@code el-tooltip}（{@code MusicPlayer.vue:140}
 * 的播放模式、{@code SongHead.vue:189} 的定位歌曲、{@code SongHead.vue:369}
 * 上传弹窗的移除、{@code SettingButton.vue:47/74} 的设置与检查文件完整性），
 * 都是 Element Plus 自己的浮层，没有复用别处的皮肤。</p>
 *
 * <h3>为什么不复用博客的 Tooltip</h3>
 * <p>{@code app/_components/common/Tooltip.tsx} 把浮层写成触发器子树里的
 * {@code absolute} 元素、不 portal：悬浮播放器这条链上有三层
 * {@code overflow: hidden}（{@code .mt-player} 源项目自带、
 * {@code .mt-floating-content}、{@code .mt-floating-container}），
 * 浮层放到按钮上方会伸出播放器外而被裁掉；而且它的皮肤是博客的
 * {@code glass-card}（跟随博客明暗主题），与音乐模块的深色霓虹玻璃不是一套。
 * 因此这里单独实现，并沿用 {@code Select.tsx} 的 portal + fixed 定位套路。</p>
 *
 * <h3>定位</h3>
 * <p>浮层挂到 {@code document.body}（脱离裁剪链），用触发器的 rect 算 fixed 坐标：
 * 优先放上方，上方放不下且下方更宽裕时翻到下方；水平以触发器中心对齐，
 * 用 {@code translate(-50%, -100%)} 让「浮层底边」而不是「顶边」落在
 * 间距线上，因此不需要预先量出浮层高度。</p>
 *
 * <h3>与源项目的差异</h3>
 * <ul>
 *   <li>皮肤用音乐模块的霓虹玻璃（与 {@code .mt-el-select-panel} 一致），
 *       源项目是 EP 默认的 {@code .el-popper.is-dark}（#303133 纯色 + 白色 12px 字）。</li>
 *   <li>z-index 取 10100，高于悬浮播放器的 9999/10000。源项目里 tooltip 走 EP 的
 *       popper（2000 上下），会被 z-index 9999 的播放器盖住箭头那一角。</li>
 * </ul>
 */

/** 触发器与浮层之间的间距（源 el-tooltip 的默认 offset 同样是 12） */
const OFFSET = 12;
/** 单行浮层的估算高度，只用于判断上方是否放得下；实际定位靠 translateY(-100%)，不依赖它 */
const PANEL_HEIGHT = 31;
/** 视口边缘留白 */
const EDGE = 4;
/** 12px 字号下中文按 1em 估宽，用于把浮层夹在视口内 */
const CHAR_WIDTH = 12;
/** 浮层左右内边距 + 边框的估算值 */
const PANEL_CHROME = 24;

/** useSyncExternalStore 的订阅函数：状态永不变，仅用于区分 SSR / 客户端 */
const subscribeNoop = () => () => {};

interface Props {
  /** 提示文字 */
  content: string;
  children: ReactNode;
  /** 附加到包裹层，便于在 flex 布局里传递尺寸 */
  className?: string;
}

interface Box {
  placement: "top" | "bottom";
  left: number;
  top: number;
}

export default function Tooltip({ content, children, className = "" }: Props) {
  // portal 需要 document.body，SSR 期不渲染
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;

    // 触发器本身可能是 fixed/absolute 的子元素（悬浮播放器的抓手就是这样），
    // 此时包裹层量出来是 0×0，退回量它的第一个元素子节点
    const own = el.getBoundingClientRect();
    const r =
      own.width || own.height
        ? own
        : (el.firstElementChild?.getBoundingClientRect() ?? own);

    const roomAbove = r.top - OFFSET - EDGE;
    const roomBelow = window.innerHeight - r.bottom - OFFSET - EDGE;
    const placement: Box["placement"] =
      roomAbove >= PANEL_HEIGHT || roomAbove >= roomBelow ? "top" : "bottom";

    const half = (content.length * CHAR_WIDTH + PANEL_CHROME) / 2;
    const center = r.left + r.width / 2;
    const left = Math.min(
      Math.max(center, EDGE + half),
      Math.max(EDGE + half, window.innerWidth - EDGE - half),
    );

    setBox({
      placement,
      left,
      top: placement === "top" ? r.top - OFFSET : r.bottom + OFFSET,
    });
  }, [content]);

  const hide = useCallback(() => setBox(null), []);

  // 浮层是 fixed 定位，触发器随页面滚动或窗口变化时要重新贴合
  useEffect(() => {
    if (!box) return;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [box, place]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`mt-tooltip-trigger${className ? ` ${className}` : ""}`}
        onMouseEnter={place}
        onMouseLeave={hide}
        onMouseDown={hide}
        onFocus={place}
        onBlur={hide}
      >
        {children}
      </span>

      {isClient &&
        box &&
        createPortal(
          <span
            className={`mt-tooltip is-${box.placement}`}
            role="tooltip"
            style={{
              left: box.left,
              top: box.top,
              transform:
                box.placement === "top"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)",
            }}
          >
            {content}
            <span className="mt-tooltip-arrow" />
          </span>,
          document.body,
        )}
    </>
  );
}
