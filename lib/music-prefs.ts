"use client";

/**
 * 音乐播放偏好（播放模式、音量）的本地持久化。
 *
 * <p>源头是源项目的 {@code musicPlayStore}：它把
 * {@code {currentMusicId, playMode, volume, playDuration}} 通过
 * {@code playApi.getPlayArg/setPlayArg} 存在服务端，并在
 * {@code views/main/index.vue:11-24} 的 beforeunload 时回写。
 * Blog 后端没有 play-arg 接口（{@code MusicController} 只有
 * page / detail / play-duration / batch / delete / favorite / play），
 * 因此这两项改为存浏览器 localStorage。</p>
 *
 * <p>{@code currentMusicId} 也存本地（只存 id），但<b>只在音乐页恢复</b>：
 * 首页播放器依赖 {@code useAudioPlayer} 挂载即随机取一首的行为，恢复上次曲目
 * 会改变首页表现。所以恢复与否不在这里判断，由 {@code useAudioPlayer} 的初始
 * 曲目逻辑按当前路由决定。</p>
 */

const MODE_KEY = "music_play_mode";
const VOLUME_KEY = "music_volume";
const TRACK_KEY = "music_last_track_id";

/** 默认音量，与 useAudioPlayer 原默认值一致 */
export const DEFAULT_VOLUME = 0.8;

/**
 * UI 上的播放模式。
 *
 * <p>刻意沿用后端 {@code PlayRequest.playMode} 的命名，避免两层词汇表：
 * {@code loop} 顺序往后、{@code random} 随机、{@code single} 单曲循环。
 * 只有「上一首」用的 {@code reverse} 不在循环里，由请求时推导。</p>
 *
 * <p>注意与源项目不同名：源项目 {@code musicPlayStore.ts:87} 的 {@code loop}
 * 是<b>单曲循环</b>，Blog 后端的单曲循环叫 {@code single}。</p>
 */
export type CycleMode = "loop" | "random" | "single";

/** 循环顺序与源项目 changePlayMode 一致：顺序 → 随机 → 单曲 → 顺序 */
export const MODE_CYCLE: CycleMode[] = ["loop", "random", "single"];

export const DEFAULT_PLAY_MODE: CycleMode = "loop";

const MODE_LABEL: Record<CycleMode, string> = {
  loop: "顺序播放",
  random: "随机播放",
  single: "单曲循环",
};

export function modeLabel(mode: CycleMode): string {
  return MODE_LABEL[mode] ?? MODE_LABEL.loop;
}

function isCycleMode(v: unknown): v is CycleMode {
  return v === "loop" || v === "random" || v === "single";
}

/** 读取播放模式；无 localStorage 或值非法时返回 null，由调用方决定默认值 */
export function readPlayMode(): CycleMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MODE_KEY);
    return isCycleMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writePlayMode(mode: CycleMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* 隐私模式等场景下写入失败，忽略即可 */
  }
}

/** 读取音量（0~1）；缺失或非法返回 null */
export function readVolume(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw === null) return null;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
  } catch {
    return null;
  }
}

export function writeVolume(volume: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    /* 同上 */
  }
}

/**
 * 读取上次播放的曲目 id；缺失或非法返回 null。
 *
 * <p>只存 id 不存整个曲目对象：曲目信息会变（改名、换歌手、被删、被取消收藏），
 * 恢复时按 id 重新取一次拿到的才是当前状态，取不到就退回随机。</p>
 */
export function readLastTrackId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TRACK_KEY);
    if (raw === null) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function writeLastTrackId(id: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRACK_KEY, String(id));
  } catch {
    /* 同上 */
  }
}
