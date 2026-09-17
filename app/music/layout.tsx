import type { ReactNode } from "react";
import "./music-theme.css";

/**
 * 音乐模块的独立外壳。
 *
 * <p>不继承 {@code app/(main)/layout.tsx} 的 Header/Footer —— {@code /music} 位于
 * 顶层路由，与 {@code (main)} 平级，因此是一个完全独立的页面。</p>
 *
 * <h3>背景遮蔽</h3>
 * <p>根布局 {@code app/layout.tsx} 会渲染博客自己的图片轮播背景
 * （{@code BackgroundSlider}，位于 {@code fixed inset-0 z-[-1]} 容器内，
 * 子层 z-index 依次为 -10 / -9 / -8 / -7）。音乐页要的是纯黑 canvas，
 * 因此需要把这一层图片盖住。</p>
 *
 * <p>做法：整个音乐页被包进一个 {@code isolation:isolate} 的定位容器，
 * 它自身建立层叠上下文。容器内的相对层级因此完全自洽，不依赖
 * 根布局里其它元素的位置：</p>
 *
 * <pre>
 *   音乐页容器（isolation:isolate, z-index:0）
 *     ├─ z-index:-5  黑色遮罩（不透明，盖住下方一切）
 *     ├─ z-index:-1  &lt;WaveBackground /&gt; canvas 动态风景
 *     └─ z-index:0   页面内容
 *
 *   根布局的图片轮播层（z-index:-10 ~ -7，被困在 fixed z-[-1] 容器内）
 *     始终位于音乐页容器之下 → 被遮罩盖住，看不到
 * </pre>
 */
export default function MusicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="music-theme relative isolate" style={{ zIndex: 0 }}>
      {/* 遮住博客的图片轮播背景，让 canvas 独占视野 */}
      <div
        aria-hidden
        className="fixed inset-0 bg-black"
        style={{ zIndex: -5, pointerEvents: "none" }}
      />
      {children}
    </div>
  );
}
