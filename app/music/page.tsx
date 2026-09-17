import type { Metadata } from "next";
import MusicClient from "./MusicClient";

export const metadata: Metadata = {
  title: "音乐",
  description: "音乐播放器",
};

/**
 * 音乐模块独立页面。
 *
 * <p>位于顶层路由（与 {@code (main)} 平级），因此不渲染 Header/Footer，
 * 是一个完全独立的页面。</p>
 */
export default function MusicPage() {
  return <MusicClient />;
}
