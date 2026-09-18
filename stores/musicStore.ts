import { create } from "zustand";
import type { Music } from "@/lib/types";
import {
  DEFAULT_PLAY_MODE,
  DEFAULT_VOLUME,
  MODE_CYCLE,
  readPlayMode,
  readVolume,
  writeLastTrackId,
  writePlayMode,
  writeVolume,
  type CycleMode,
} from "@/lib/music-prefs";

interface MusicState {
  currentTrack: Music | null;
  isPlaying: boolean;
  /**
   * 播放模式，音乐页悬浮播放器用。
   *
   * <p>首页播放器不读这个字段（它的「下一首」固定随机、自动切歌固定随机收藏曲目），
   * 因此这里默认「顺序」不会改变首页表现。</p>
   */
  playMode: CycleMode;
  /** 音量 0~1，全局共享（音频元素是模块级单例，音量本就只有一个） */
  volume: number;
  /** 静音前的音量，仅内存不持久化 */
  prevVolume: number;

  /**
   * 切歌。顺带把曲目 id 记进 localStorage，供音乐页刷新后恢复
   * （首页不恢复，见 {@code useAudioPlayer} 的初始曲目逻辑）。
   */
  setTrack: (track: Music) => void;
  toggle: () => void;
  pause: () => void;
  play: () => void;

  setPlayMode: (mode: CycleMode) => void;
  /** 顺序 → 随机 → 单曲 → 顺序（对应源项目 changePlayMode） */
  cyclePlayMode: () => void;

  setVolume: (volume: number) => void;
  toggleMute: () => void;

  /** 从 localStorage 恢复播放模式与音量；组件挂载时调用，避免 SSR 期读不到 */
  hydratePrefs: () => void;
}

export const useMusicStore = create<MusicState>()((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  playMode: DEFAULT_PLAY_MODE,
  volume: DEFAULT_VOLUME,
  prevVolume: DEFAULT_VOLUME,

  setTrack: (track) => {
    // 记下曲目 id：音乐页刷新后按 id 恢复上次播放的曲目
    writeLastTrackId(track.id);
    set({ currentTrack: track });
  },
  toggle: () => set((s) => ({ isPlaying: !s.isPlaying })),
  pause: () => set({ isPlaying: false }),
  play: () => set({ isPlaying: true }),

  setPlayMode: (mode) => {
    writePlayMode(mode);
    set({ playMode: mode });
  },

  cyclePlayMode: () => {
    const idx = MODE_CYCLE.indexOf(get().playMode);
    get().setPlayMode(MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]);
  },

  setVolume: (volume) => {
    const v = Math.min(1, Math.max(0, volume));
    writeVolume(v);
    set((s) => ({ volume: v, prevVolume: v > 0 ? v : s.prevVolume }));
  },

  toggleMute: () => {
    const { volume, prevVolume } = get();
    get().setVolume(volume > 0 ? 0 : prevVolume || DEFAULT_VOLUME);
  },

  hydratePrefs: () => {
    const mode = readPlayMode();
    const volume = readVolume();
    if (mode) set({ playMode: mode });
    if (volume !== null) {
      set({ volume, prevVolume: volume > 0 ? volume : DEFAULT_VOLUME });
    }
  },
}));
