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
  useEffect(() => {
    hydratePrefsOnce();
  }, []);

  const getAudio = useCallback(() => {
    if (!_sharedAudio) {
      _sharedAudio = new Audio();
      _sharedAudio.volume = useMusicStore.getState().volume;
    }
    // 捕获成局部常量：_sharedAudio 是模块级可变变量，闭包里无法保留非空收窄
    const audio = _sharedAudio;
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
