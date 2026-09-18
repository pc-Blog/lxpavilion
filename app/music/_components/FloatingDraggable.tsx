"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import Tooltip from "./Tooltip";

/**
 * 可拖拽的悬浮容器，对应源项目 {@code components/FloatingDraggable.vue}。
 *
 * <p>行为逐条对齐源文件：</p>
 * <ul>
 *   <li>24px 圆形抓手（源 {@code .drag-handle}），静止时 {@code grab}、拖拽中 {@code grabbing}</li>
 *   <li>抓手按下后监听挂在 window 上，鼠标移出元素也能跟手（源 onMounted 的做法）</li>
 *   <li>松手时若速度超过阈值则进入惯性滑行：每帧位置累加速度、速度 ×0.95 衰减、
 *       撞视口边界 ×-0.4 反弹（源 {@code animateInertia}）</li>
 *   <li>按下到松手位移不足 10px 视为「点击」，切换展开/收起（源 {@code toggle}）；
 *       默认收起，页面上只露出一个抓手圆点（源 {@code isShow = ref(false)}）</li>
 *   <li>展开/收起用 0fr → 1fr 的 grid 行高过渡，等价于源项目用的
 *       {@code el-collapse-transition}</li>
 * </ul>
 *
 * <p>用 portal 挂到 {@code document.body}：音乐页的容器是
 * {@code overflow: hidden}（{@code MusicClient} 的 100vh 盒子），而抓手与面板都要
 * {@code position: fixed} + {@code z-index: 9999/10000}（源同样的值）。
 * 挂到 body 后层级关系与源项目一致——它会盖住页面内的弹窗与下拉，
 * 这一点源项目也是如此。</p>
 *
 * <p>相对源文件的三处修正，都会在交付说明里单独列出：</p>
 * <ul>
 *   <li>源文件的边界约束用的是从未被赋值的 {@code containerSize}（恒为 0，
 *       等于不约束，可以把面板拖到屏幕外），这里改成实测容器宽 / 内容高；</li>
 *   <li>源文件给 {@code left/top} 定位的元素声明了
 *       {@code transition: transform 0.3s ease-out}，不产生任何效果，这里不写；</li>
 *   <li>没有照搬源 {@code .floating-container} 的 {@code min-height: 50px}：
 *       源项目收起时整个容器是 {@code v-show} 的 {@code display: none}，
 *       而这里用 grid 行高折叠，留着 50px 会在页面上留出一块看不见的点击区。</li>
 * </ul>
 */

/** 抓手直径（源 .drag-handle 24×24） */
const HANDLE_SIZE = 24;
/** 抓手相对容器左上角的偏移：源为 {@code left: x - 10} */
const HANDLE_OFFSET = 10;
/** 初始位置（源 position = { x: 50, y: 50 }） */
const INITIAL_X = 50;
const INITIAL_Y = 50;
/** 位移小于它算点击而非拖拽（源 toggle 的 10px 判定） */
const CLICK_SLOP = 10;
/** 松手速度超过它才启动惯性（源 stopDrag 的 2） */
const INERTIA_MIN_SPEED = 2;
/** 每帧速度衰减（源 0.95） */
const INERTIA_DECAY = 0.95;
/** 撞边反弹系数（源 -0.4） */
const BOUNCE = -0.4;
/** 速度采样倍率（源 1.5） */
const VELOCITY_SCALE = 1.5;

/** useSyncExternalStore 的订阅函数：状态永不变，仅用于区分 SSR / 客户端 */
const subscribeNoop = () => () => {};

function pointOf(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ("touches" in e) {
    const t = e.touches.length > 0 ? e.touches[0] : e.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  return { x: e.clientX, y: e.clientY };
}

export default function FloatingDraggable({
  children,
  initialOpen = false,
}: {
  children: ReactNode;
  /** 初始展开状态；源项目默认收起，只露出抓手圆点 */
  initialOpen?: boolean;
}) {
  // portal 需要 document.body，SSR 期不渲染；用 useSyncExternalStore 而不是
  // effect + setState，避免 react-hooks/set-state-in-effect 与 hydration 不一致
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const [pos, setPos] = useState({ x: INITIAL_X, y: INITIAL_Y });
  const posRef = useRef(pos);
  const [open, setOpen] = useState(initialOpen);
  const [dragging, setDragging] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    offX: 0,
    offY: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
  });

  const applyPos = useCallback((x: number, y: number) => {
    posRef.current = { x, y };
    setPos({ x, y });
  }, []);

  /** 约束用的尺寸：宽度取容器，高度取内容（收起时容器高度为 0，量不到内容高） */
  const measure = useCallback(
    () => ({
      w: wrapRef.current?.offsetWidth ?? 0,
      h: innerRef.current?.scrollHeight ?? 0,
    }),
    [],
  );

  const clampTo = useCallback(
    (x: number, y: number) => {
      const { w, h } = measure();
      const maxX = Math.max(0, window.innerWidth - w);
      const maxY = Math.max(0, window.innerHeight - h);
      return {
        x: Math.min(Math.max(0, x), maxX),
        y: Math.min(Math.max(0, y), maxY),
      };
    },
    [measure],
  );

  /** 惯性滑行（源 animateInertia） */
  const runInertia = useCallback(() => {
    const tick = () => {
      const v = velocityRef.current;
      if (Math.abs(v.x) < 0.1 && Math.abs(v.y) < 0.1) {
        velocityRef.current = { x: 0, y: 0 };
        rafRef.current = null;
        return;
      }
      const { w, h } = measure();
      let nx = posRef.current.x + v.x;
      let ny = posRef.current.y + v.y;
      if (nx <= 0 || nx >= window.innerWidth - w) v.x *= BOUNCE;
      if (ny <= 0 || ny >= window.innerHeight - h) v.y *= BOUNCE;
      const next = clampTo(nx, ny);
      applyPos(next.x, next.y);
      v.x *= INERTIA_DECAY;
      v.y *= INERTIA_DECAY;
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [applyPos, clampTo, measure]);

  // 拖拽期间监听 window：源项目也是挂在 window 上，保证鼠标移出元素仍跟手
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      const p = pointOf(e);
      if (!p) return;

      // 速度采样：源为 (当前位置 - 上次位置) × 1.5，且首帧不采样
      if (d.lastX || d.lastY) {
        velocityRef.current = {
          x: (p.x - d.lastX) * VELOCITY_SCALE,
          y: (p.y - d.lastY) * VELOCITY_SCALE,
        };
      }
      d.lastX = p.x;
      d.lastY = p.y;
      if (
        Math.abs(p.x - d.startX) >= CLICK_SLOP ||
        Math.abs(p.y - d.startY) >= CLICK_SLOP
      ) {
        d.moved = true;
      }

      const next = clampTo(p.x - d.offX, p.y - d.offY);
      applyPos(next.x, next.y);
      e.preventDefault();
    };

    const onUp = () => {
      const d = dragRef.current;
      if (!d.active) return;
      d.active = false;
      setDragging(false);

      const v = velocityRef.current;
      if (Math.abs(v.x) > INERTIA_MIN_SPEED || Math.abs(v.y) > INERTIA_MIN_SPEED) {
        rafRef.current = requestAnimationFrame(runInertia);
      } else {
        velocityRef.current = { x: 0, y: 0 };
      }

      // 没怎么动就是「点击抓手」：展开 / 收起
      if (!d.moved) setOpen((o) => !o);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [applyPos, clampTo, runInertia]);

  const onHandleDown = (e: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
    const p = pointOf(e.nativeEvent);
    if (!p) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    velocityRef.current = { x: 0, y: 0 };
    dragRef.current = {
      active: true,
      offX: p.x - posRef.current.x,
      offY: p.y - posRef.current.y,
      startX: p.x,
      startY: p.y,
      lastX: 0,
      lastY: 0,
      moved: false,
    };
    setDragging(true);

    // React 的 touchstart 是 passive 监听，preventDefault 会告警；
    // 触摸滚动由 CSS 的 touch-action: none 拦住，这里只处理鼠标的选中行为
    if (e.type === "mousedown") e.preventDefault();
  };

  if (!isClient) return null;

  return createPortal(
    <div className="mt-floating-wrapper">
      <Tooltip content={open ? "收起播放器" : "展开播放器"}>
        <div
          className="mt-drag-handle"
          style={{
            left: pos.x - HANDLE_OFFSET,
            top: pos.y - HANDLE_OFFSET,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            cursor: dragging ? "grabbing" : "grab",
          }}
          onMouseDown={onHandleDown}
          onTouchStart={onHandleDown}
        />
      </Tooltip>

      <div
        className="mt-floating-container"
        ref={wrapRef}
        style={{ left: pos.x, top: pos.y }}
      >
        <div className={`mt-floating-collapse${open ? " is-open" : ""}`}>
          <div className="mt-floating-content" ref={innerRef}>
            {/* padding 必须在这一层：放在 .mt-floating-content 上会让 grid 行收不到 0 */}
            <div className="mt-floating-pad">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
