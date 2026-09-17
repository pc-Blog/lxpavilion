"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMusicStore } from "@/stores/musicStore";
import { nextRandom } from "@/lib/api/music";
import { assetUrl } from "@/lib/asset-url";

let _sharedAudio: HTMLAudioElement | null = null;
let _endedAttached = false;

export function useAudioPlayer() {
  const currentTrack = useMusicStore((s) => s.currentTrack);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const toggle = useMusicStore((s) => s.toggle);
  const setTrack = useMusicStore((s) => s.setTrack);
  const play = useMusicStore((s) => s.play);

  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isCoverSpinning, setIsCoverSpinning] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLInputElement>(null);

  const getAudio = useCallback(() => {
    if (!_sharedAudio) {
      _sharedAudio = new Audio();
      _sharedAudio.volume = volume;
    }
    if (!_endedAttached) {
      _endedAttached = true;
      _sharedAudio.addEventListener("ended", () => {
        // 自动切歌：计入播放次数与累计时长
        const cur = useMusicStore.getState().currentTrack;
        nextRandom(cur?.id, true).then((t) => {
          if (t && _sharedAudio) {
            useMusicStore.getState().setTrack(t);
            useMusicStore.getState().play();
            _sharedAudio.src = assetUrl(t.fileUrl);
            _sharedAudio.play().catch(() => {});
          }
        }).catch(() => {});
      });
    }
    audioRef.current = _sharedAudio;
    return _sharedAudio;
  }, [volume]);

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
  }, [currentTrack?.id, getAudio, isPlaying]);

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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    setVolume(v);
    setPrevVolume(v || 0.8);
  };

  const handleMuteToggle = useCallback(() => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume);
    }
  }, [volume, prevVolume]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    setProgress(pct);
    if (audioRef.current && duration) {
      audioRef.current.currentTime = (pct / 100) * duration;
    }
  };

  // 手动切歌：不计入播放次数，只更新 last_played
  const handleNext = useCallback(() => {
    const cur = useMusicStore.getState().currentTrack;
    nextRandom(cur?.id, false).then((t) => { if (t) { setTrack(t); play(); } }).catch(() => {});
  }, [setTrack, play]);

  return {
    currentTrack, isPlaying,
    progress, currentTime, duration, volume, isCoverSpinning,
    audioRef, progressRef,
    toggle, handleNext,
    handleVolumeChange, handleMuteToggle, handleSeek,
  };
}
