"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMusicStore } from "@/stores/musicStore";
import {
  nextRandom,
  selectTrack,
  type MusicQuery,
  type PlayDirection,
} from "@/lib/api/music";
import type { CycleMode } from "@/lib/music-prefs";
import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";
import type { Music } from "@/lib/types";

let _sharedAudio: HTMLAudioElement | null = null;
let _endedAttached = false;

/** 自动切歌时的选曲上下文：播放模式 + 选曲范围 */
export interface PlayContext {
  mode: CycleMode;
  query: MusicQuery;
}

/**
 * 首页播放器的上下文：随机 + 只播收藏。
 *
 * <p>这与改动前的行为完全一致（原先自动切歌固定调
 * {@code nextRandom}，即 {@code play(..., FAVORITE_ONLY, "random")}）。</p>
 */
const HOME_CONTEXT: PlayContext = { mode: "random", query: { onlyFavorite: true } };

/**
 * 当前选曲上下文，模块级单例。
 *
 * <p>音频元素是模块级单例，它的 ended 回调只能挂在模块作用域里，
 * 拿不到任何组件的 props，因此用这个可变的上下文把「当前是谁在播」
 * 传进去。音乐页的播放器挂载时设置、卸载时复位，首页播放器从不设置，
 * 于是两边的自动切歌互不干扰。</p>
 */
let _context: PlayContext = HOME_CONTEXT;

/** 音乐页挂载时调用：让自动切歌跟随页面的播放模式与筛选范围 */
export function setPlayContext(ctx: PlayContext) {
  _context = ctx;
}

/** 音乐页卸载时调用：把自动切歌还原为首页行为 */
export function resetPlayContext() {
  _context = HOME_CONTEXT;
}

/** 偏好只恢复一次（一个页面里可能有几十个 hook 实例） */
let _prefsHydrated = false;

function hydratePrefsOnce() {
  if (_prefsHydrated) return;
  _prefsHydrated = true;
  useMusicStore.getState().hydratePrefs();
}

/** 懒创建共享音频元素（模块级单例，首页音乐卡片与音乐页悬浮播放器共用它） */
function ensureAudio(): HTMLAudioElement {
  if (!_sharedAudio) {
    _sharedAudio = new Audio();
    _sharedAudio.volume = useMusicStore.getState().volume;
  }
  return _sharedAudio;
}

/** 媒体会话只接入一次 */
let _mediaSessionReady = false;

/**
 * 把当前曲目写进浏览器的媒体会话元数据。
 *
 * <p>不写的话，Chrome 右上角的媒体控件只会回退成页面标题 + 站点图标，
 * 没有封面、歌名与歌手；系统级控件（Windows 音量叠加层、锁屏、多媒体键）
 * 同样取不到曲目信息。</p>
 *
 * <p>封面沿用列表与播放器的取值：Blog 没有曲目封面字段，只有歌手图，
 * 缺失时退回 {@code siteConfig.defaultSingerCover}。{@code sizes} 只是给
 * 浏览器在多张候选图之间挑选用的提示，这里只有一张。</p>
 */
function updateMediaMetadata(track: Music | null) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }
  const cover = track.singerPictureUrl || siteConfig.defaultSingerCover;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.singerName || "未知艺术家",
    album: track.categoryName || undefined,
    artwork: [{ src: assetUrl(cover), sizes: "512x512" }],
  });
}

/** 同步播放状态，媒体控件据此显示播放/暂停图标 */
function syncMediaPlaybackState(isPlaying: boolean) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  } catch {
    /* 个别浏览器对 playbackState 赋值敏感，忽略即可 */
  }
}

/**
 * 媒体控件上的上一首/下一首。
 *
 * <p>模式与选曲范围取模块级的 {@code _context}：音乐页挂载时是页面的播放模式
 * 与筛选条件，首页是「随机 + 只播收藏」，与两处「下一首」按钮的既有行为一致；
 * 单曲模式原地重播、不请求服务端（与 {@code step} 同构）。</p>
 */
function stepByContext(dir: PlayDirection) {
  const audio = ensureAudio();
  const st = useMusicStore.getState();
  if (_context.mode === "single") {
    audio.currentTime = 0;
    st.play();
    audio.play().catch(() => {});
    return;
  }
  selectTrack({
    currentMusicId: st.currentTrack?.id,
    mode: _context.mode,
    dir,
    addPlay: false,
    query: _context.query,
  })
    .then((t) => {
      if (!t) return;
      // 先写 data-track-id 再换源，最后更新 store：这样已挂载的 hook 里那个
      // 「切歌 → 换源」effect 会因 id 相同而跳过，不会把同一个源重复加载一遍
      audio.setAttribute("data-track-id", String(t.id));
      audio.src = assetUrl(t.fileUrl);
      const s = useMusicStore.getState();
      s.setTrack(t);
      s.play();
      audio.play().catch(() => {});
    })
    .catch(() => {});
}

/** 按秒相对跳转，供媒体控件的快退/快进 */
function seekBy(offset: number) {
  const audio = ensureAudio();
  const total = audio.duration;
  if (!total || !isFinite(total)) return;
  audio.currentTime = Math.min(Math.max(audio.currentTime + offset, 0), total);
}

/**
 * 接入浏览器媒体会话：右上角媒体控件的封面/歌名/歌手，以及它上面的播放暂停、
 * 上一首下一首与进度跳转按钮。
 *
 * <p>挂在模块级而非某个组件里：音频元素与播放状态本就是模块级单例，挂一次即可
 * 同时驱动首页音乐卡片与音乐页悬浮播放器；而且离开页面后音频仍在播放，处理器也
 * 不该随组件卸载而移除，故此处不做清理。</p>
 *
 * <p>处理器一律「回写 store + 直接操作元素」两件事都做：回写 store 是为了让两个播放
 * UI 的图标与声音一致（浏览器在没有处理器时会自行 play/pause 元素，那样 store 里的
 * {@code isPlaying} 就与元素实际状态脱节）；直接操作元素则是因为离开首页/音乐页后
 * 可能没有任何 hook 实例挂载，此时音频仍在响，而 store 的变化不会再触发任何 effect。</p>
 */
function attachMediaSession() {
  if (_mediaSessionReady) return;
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  _mediaSessionReady = true;

  const ms = navigator.mediaSession;
  const audio = ensureAudio();

  const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
    try {
      ms.setActionHandler(action, handler);
    } catch {
      /* Safari 对个别 action 抛 NotSupportedError，能挂几个是几个 */
    }
  };

  safeSet("play", () => {
    useMusicStore.getState().play();
    audio.play().catch(() => {});
  });
  safeSet("pause", () => {
    useMusicStore.getState().pause();
    audio.pause();
  });
  safeSet("stop", () => {
    useMusicStore.getState().pause();
    audio.pause();
    audio.currentTime = 0;
  });
  safeSet("previoustrack", () => stepByContext("prev"));
  safeSet("nexttrack", () => stepByContext("next"));
  safeSet("seekbackward", (d) => seekBy(-(d.seekOffset ?? 10)));
  safeSet("seekforward", (d) => seekBy(d.seekOffset ?? 10));
  safeSet("seekto", (d) => {
    if (d.seekTime === undefined) return;
    const total = audio.duration;
    audio.currentTime = total && isFinite(total) ? Math.min(d.seekTime, total) : d.seekTime;
  });

  // 进度：duration 无效时必须跳过，否则 setPositionState 会抛异常
  const syncPosition = () => {
    const duration = audio.duration;
    if (!duration || !isFinite(duration) || duration <= 0) return;
    if (typeof ms.setPositionState !== "function") return;
    try {
      ms.setPositionState({
        duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(Math.max(audio.currentTime, 0), duration),
      });
    } catch {
      /* 参数边界或调用时序问题，忽略 */
    }
  };
  audio.addEventListener("timeupdate", syncPosition);
  audio.addEventListener("loadedmetadata", syncPosition);
  audio.addEventListener("durationchange", syncPosition);

  // 元数据与播放状态从 store 订阅，不依赖任何组件是否已挂载
  const initial = useMusicStore.getState();
  updateMediaMetadata(initial.currentTrack);
  syncMediaPlaybackState(initial.isPlaying);
  useMusicStore.subscribe((state, prev) => {
    if (state.currentTrack !== prev.currentTrack) updateMediaMetadata(state.currentTrack);
    if (state.isPlaying !== prev.isPlaying) syncMediaPlaybackState(state.isPlaying);
  });
}

export function useAudioPlayer() {
  const currentTrack = useMusicStore((s) => s.currentTrack);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const toggle = useMusicStore((s) => s.toggle);
  const setTrack = useMusicStore((s) => s.setTrack);
  const play = useMusicStore((s) => s.play);
  // 音量提升到 store：音频元素本就是全局单例，且音乐页悬浮播放器要与首页共用一份
  const volume = useMusicStore((s) => s.volume);
  const setVolume = useMusicStore((s) => s.setVolume);
  const toggleMute = useMusicStore((s) => s.toggleMute);

  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCoverSpinning, setIsCoverSpinning] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLInputElement>(null);

  // 恢复 localStorage 里的播放模式与音量。放在 hook 里而不是音乐页组件里，
  // 首页播放器同样受益（它不读播放模式，但共用音量）
  // 同时接入浏览器媒体会话——同样是全局一次，两个播放 UI 一起生效
  useEffect(() => {
    hydratePrefsOnce();
    attachMediaSession();
  }, []);

  const getAudio = useCallback(() => {
    // 捕获成局部常量：_sharedAudio 是模块级可变变量，闭包里无法保留非空收窄
    const audio = ensureAudio();
    if (!_endedAttached) {
      _endedAttached = true;
      audio.addEventListener("ended", () => {
        // 自动切歌：按当前上下文（模式 + 范围）选下一首，计入播放次数与累计时长
        const cur = useMusicStore.getState().currentTrack;
        const { mode, query } = _context;
        const startNext = (t: NonNullable<typeof cur> | null) => {
          if (!t) return;
          useMusicStore.getState().setTrack(t);
          useMusicStore.getState().play();
          audio.src = assetUrl(t.fileUrl);
          audio.play().catch(() => {});
        };
        if (mode === "single") {
          // 单曲循环：原地重播，不需要请求
          audio.currentTime = 0;
          audio.play().catch(() => {});
          return;
        }
        selectTrack({ currentMusicId: cur?.id, mode, dir: "next", addPlay: true, query })
          .then(startNext)
          .catch(() => {});
      });
    }
    audioRef.current = audio;
    return audio;
  }, []);

  // 初始加载曲目（首次播放，无 currentMusicId，不计入播放次数）
  useEffect(() => {
    if (currentTrack) return;
    nextRandom(undefined, false).then((t) => t && setTrack(t)).catch(() => {});
  }, [currentTrack, setTrack]);

  // 封面旋转
  useEffect(() => {
    if (isPlaying) {
      setIsCoverSpinning(true);
    } else {
      const timer = setTimeout(() => setIsCoverSpinning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isPlaying]);

  // 切歌 → 换源
  useEffect(() => {
    if (!currentTrack) return;
    const a = getAudio();
    if (a.getAttribute("data-track-id") === String(currentTrack.id)) return;
    a.setAttribute("data-track-id", String(currentTrack.id));
    a.src = assetUrl(currentTrack.fileUrl);
    if (isPlaying) {
      const onReady = () => { a.play().catch(() => {}); a.removeEventListener("canplay", onReady); };
      a.addEventListener("canplay", onReady);
      a.load();
    }
  }, [currentTrack, getAudio, isPlaying]);

  // 播放/暂停
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !currentTrack) return;
    if (isPlaying) a.play().catch(() => {});
    else a.pause();
  }, [isPlaying, currentTrack]);

  // 音量
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // 进度更新
  useEffect(() => {
    const a = getAudio();
    const onTime = () => {
      setCurrentTime(a.currentTime);
      setDuration(a.duration || 0);
      setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onTime);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onTime);
    };
  }, [getAudio]);

  /** 按百分比定位（0~100），供自定义进度条用 */
  const seek = useCallback((pct: number) => {
    const a = getAudio();
    const total = a.duration || 0;
    if (total) a.currentTime = (pct / 100) * total;
    setProgress(pct);
  }, [getAudio]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value) / 100);
  };

  const handleMuteToggle = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  /** 手动切歌：不计入播放次数，只更新 last_played（首页按钮用，固定随机收藏曲目） */
  const handleNext = useCallback(() => {
    const cur = useMusicStore.getState().currentTrack;
    nextRandom(cur?.id, false).then((t) => { if (t) { setTrack(t); play(); } }).catch(() => {});
  }, [setTrack, play]);

  /**
   * 音乐页的上一首/下一首：按给定模式与范围向服务端取曲。
   *
   * <p>单曲循环模式下不请求，直接原地重播（对应源项目
   * {@code playNext → getNextMusic(..., 'loop')} 拿到自身后重新播放）。</p>
   */
  const step = useCallback(
    (dir: PlayDirection, mode: CycleMode, query: MusicQuery) => {
      const cur = useMusicStore.getState().currentTrack;
      if (mode === "single") {
        const a = getAudio();
        a.currentTime = 0;
        useMusicStore.getState().play();
        a.play().catch(() => {});
        return;
      }
      selectTrack({ currentMusicId: cur?.id, mode, dir, addPlay: false, query })
        .then((t) => {
          if (!t) return;
          setTrack(t);
          play();
        })
        .catch(() => {});
    },
    [getAudio, setTrack, play],
  );

  return {
    currentTrack, isPlaying,
    progress, currentTime, duration, volume, isCoverSpinning,
    audioRef, progressRef,
    toggle, handleNext, step, seek,
    handleVolumeChange, handleMuteToggle, handleSeek,
  };
}
