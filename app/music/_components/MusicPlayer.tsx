"use client";

import { useEffect, useState, type ChangeEvent, type CSSProperties } from "react";
import {
  useAudioPlayer,
  setPlayContext,
  resetPlayContext,
} from "@/lib/useAudioPlayer";
import { useMusicStore } from "@/stores/musicStore";
import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";
import { modeLabel, type CycleMode } from "@/lib/music-prefs";
import type { MusicQuery } from "@/lib/api/music";
import {
  CaretLeft,
  CaretRight,
  Refresh,
  RefreshRight,
  Sort,
  VideoPause,
  VideoPlay,
  VolumeDown,
  VolumeOff,
  VolumeUp,
} from "./icons";
import Tooltip from "./Tooltip";

/**
 * 音乐页的悬浮播放器，对应源项目 {@code components/MusicPlayer.vue}。
 *
 * <p>由 {@code FloatingDraggable} 包住后挂在页面里（源 {@code views/main/index.vue:28-30}
 * 也是这个结构）。左侧封面 + 歌名/歌手、中间上一首/播放暂停/下一首/播放模式 +
 * 进度条、右侧音量条 + 音量图标，逐块对着源模板 {@code MusicPlayer.vue:92-183}
 * 与样式 {@code :193-518} 复刻；768px 以下竖排（{@code :521-554}）。</p>
 *
 * <h3>与源项目的差异（有意为之）</h3>
 * <ul>
 *   <li><b>封面取歌手图</b>：源用 {@code currentMusic?.pictureUrl}（曲目自带封面），
 *       Blog 的 {@code t_music} 没有封面字段，只有 {@code singerPictureUrl}，
 *       与曲目列表 / 曲目区头部的取值保持一致。</li>
 *   <li><b>播放模式按钮的提示用原生 {@code title}</b>：源用 {@code el-tooltip}，
 *       音乐模块里没有对应组件，且 EP 的 tooltip 是另一套皮肤。</li>
 *   <li><b>模式按钮底色生效</b>：源 {@code MusicPlayer.vue:274-293} 把
 *       {@code .mode-order/.mode-random/.mode-loop} 嵌在 {@code .player-info} 里，
 *       而按钮实际在 {@code .player-controls .buttons} 下，选择器永远匹配不到——
 *       即源项目里这三个底色是不生效的。这里按意图接上了。</li>
 * </ul>
 *
 * <h3>播放模式与音量</h3>
 * <p>源项目把 {@code {currentMusicId, playMode, volume, playDuration}} 存在后端
 * （{@code musicPlayStore} 的 getPlayArg/setPlayArg）。Blog 后端没有 play-arg 接口，
 * 因此播放模式与音量改存 localStorage（见 {@code lib/music-prefs.ts}）。</p>
 *
 * <p>选曲范围跟随页面当前筛选条件：源 {@code getNextMusic} 的 query 默认取
 * {@code pageQuery.value.query}，这里由 {@code MusicClient} 把查询条件下发成
 * {@code scope} 属性。</p>
 */

/** 播放模式 → 图标，与源 playModeIcon 一致（顺序 Refresh / 随机 Sort / 单曲 RefreshRight） */
const MODE_ICON: Record<CycleMode, typeof Refresh> = {
  loop: Refresh,
  random: Sort,
  single: RefreshRight,
};

/** 源 formatTime：分钟不补零，秒补零 */
function fmt(seconds: number) {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export default function MusicPlayer({ scope }: { scope: MusicQuery }) {
  const {
    currentTrack,
    isPlaying,
    progress,
    currentTime,
    duration,
    volume,
    toggle,
    step,
    seek,
    handleVolumeChange,
  } = useAudioPlayer();

  const playMode = useMusicStore((s) => s.playMode);
  const cyclePlayMode = useMusicStore((s) => s.cyclePlayMode);

  // 让自动切歌跟随本页的播放模式与筛选范围；离开页面复位为首页行为
  useEffect(() => {
    setPlayContext({ mode: playMode, query: scope });
    return () => resetPlayContext();
  }, [playMode, scope]);

  // 拖动进度条时只更新本地值，松手才真正 seek（源 el-slider 的 @input / @change）
  const [dragPct, setDragPct] = useState<number | null>(null);
  const shownPct = dragPct ?? progress;

  const commitSeek = () => {
    if (dragPct === null) return;
    seek(dragPct);
    setDragPct(null);
  };

  const ModeIcon = MODE_ICON[playMode];
  const VolumeIcon = volume > 0.5 ? VolumeUp : volume > 0 ? VolumeDown : VolumeOff;

  const onProgressInput = (e: ChangeEvent<HTMLInputElement>) => {
    setDragPct(Number(e.target.value));
  };

  return (
    <div className={`mt-player${isPlaying ? " is-playing" : ""}`}>
      {/* 左：封面与基本信息（源 .player-info） */}
      <div className="mt-player-info">
        <div className="mt-player-cover">
          <img
            src={assetUrl(currentTrack?.singerPictureUrl || siteConfig.defaultSingerCover)}
            alt=""
          />
        </div>
        <div className="mt-player-meta">
          <h4 className="mt-player-title">{currentTrack?.title || "暂无歌曲"}</h4>
          <p className="mt-player-artist">{currentTrack?.singerName || "未知艺术家"}</p>
        </div>
      </div>

      {/* 中：控制按钮与进度条（源 .player-controls） */}
      <div className="mt-player-controls">
        <div className="mt-player-buttons">
          <Tooltip content="上一首">
            <button
              className="mt-player-btn"
              onClick={() => step("prev", playMode, scope)}
              aria-label="上一首"
            >
              <CaretLeft size={14} />
            </button>
          </Tooltip>

          <Tooltip content={isPlaying ? "暂停" : "播放"}>
            <button
              className="mt-player-btn is-primary"
              onClick={toggle}
              disabled={!currentTrack}
              aria-label={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? <VideoPause size={20} /> : <VideoPlay size={20} />}
            </button>
          </Tooltip>

          <Tooltip content="下一首">
            <button
              className="mt-player-btn"
              onClick={() => step("next", playMode, scope)}
              aria-label="下一首"
            >
              <CaretRight size={14} />
            </button>
          </Tooltip>

          <Tooltip content={modeLabel(playMode)}>
            <button
              className={`mt-player-btn mode-${playMode}`}
              onClick={cyclePlayMode}
              aria-label={modeLabel(playMode)}
            >
              <ModeIcon size={14} />
            </button>
          </Tooltip>
        </div>

        <div className="mt-player-progress">
          <span className="mt-time">{fmt(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={shownPct}
            onChange={onProgressInput}
            onPointerUp={commitSeek}
            onKeyUp={commitSeek}
            onBlur={commitSeek}
            className="mt-player-slider"
            style={{ "--mt-fill": `${shownPct}%` } as CSSProperties}
            aria-label="播放进度"
          />
          <span className="mt-time">{fmt(duration)}</span>
        </div>
      </div>

      {/* 右：音量（源 .player-extra） */}
      <div className="mt-player-extra">
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={Math.round(volume * 100)}
          onChange={handleVolumeChange}
          className="mt-player-slider"
          style={{ "--mt-fill": `${Math.round(volume * 100)}%` } as CSSProperties}
          aria-label="音量"
        />
        <span className="mt-player-volume-icon">
          <VolumeIcon size={20} />
        </span>
      </div>
    </div>
  );
}
