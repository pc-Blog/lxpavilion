"use client";

import { Star, Play, Pause, Pencil } from "lucide-react";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { useMusicStore } from "@/stores/musicStore";
import type { Music } from "@/lib/types";

interface Props {
  music: Music;
  isLive: boolean;
  onEdit: () => void;
  onToggleFavorite: () => void;
}

function formatDuration(seconds?: number) {
  if (!seconds && seconds !== 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * 单条曲目。
 *
 * <p>复刻源项目 {@code views/song/com/SongCard.vue}：标题 / 歌手 / 分类 / 时长 +
 * 悬停浮现的播放、编辑、收藏按钮。源项目的批量选择态（is-deleteMode）
 * 随批量删除一并移除。</p>
 */
export default function TrackCard({ music, isLive, onEdit, onToggleFavorite }: Props) {
  const { currentTrack, isPlaying, toggle } = useAudioPlayer();
  const setTrack = useMusicStore((s) => s.setTrack);
  const playFromStore = useMusicStore((s) => s.play);
  const isCurrent = currentTrack?.id === music.id;
  const isPlayingThis = isCurrent && isPlaying;

  const handlePlay = () => {
    if (isCurrent) {
      toggle();
    } else {
      setTrack(music);
      playFromStore();
    }
  };

  return (
    <div
      className="group flex items-center justify-between px-4 py-3 my-1.5 rounded-md transition-all duration-300 hover:-translate-y-px"
      style={{
        backgroundColor: isPlayingThis
          ? "rgba(70,165,255,0.2)"
          : "rgba(60,60,70,0.02)",
        backdropFilter: "blur(8px)",
        border: `0.5px solid ${
          isPlayingThis ? "rgba(120,230,255,0.3)" : "rgba(120,230,255,0.15)"
        }`,
        boxShadow: isPlayingThis
          ? "0 0 15px rgba(70,165,255,0.2), inset 0 0 10px rgba(120,230,255,0.1)"
          : "0 2px 8px rgba(0,0,0,0.1), inset 0 0 6px rgba(120,230,255,0.05)",
      }}
    >
      <div className="flex items-center flex-1 min-w-0 gap-4">
        <span
          className="w-[30%] min-w-[150px] font-medium truncate transition-all duration-300"
          style={{
            color: isPlayingThis
              ? "rgba(220,240,255,0.95)"
              : "rgba(220,230,240,0.9)",
            textShadow: isPlayingThis ? "0 0 6px rgba(120,230,255,0.4)" : "none",
          }}
        >
          {music.title}
        </span>
        <span
          className="w-[25%] min-w-[120px] truncate"
          style={{ color: "rgba(180,200,220,0.8)" }}
        >
          {music.singerName || "--"}
        </span>
        <span
          className="w-[20%] min-w-[100px] truncate"
          style={{ color: "rgba(180,200,220,0.8)" }}
        >
          {music.categoryName || "--"}
        </span>
        <span
          className="w-[15%] min-w-[60px] text-right"
          style={{ color: "rgba(160,180,200,0.7)" }}
        >
          {formatDuration(music.duration)}
        </span>
      </div>

      {/* 悬停浮现的操作 */}
      <div className="flex gap-2 ml-4 opacity-0 translate-x-2.5 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
        <button
          onClick={handlePlay}
          title={isPlayingThis ? "暂停" : "播放"}
          className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:scale-105"
          style={{
            backgroundColor: isPlayingThis
              ? "rgba(60,180,120,0.85)"
              : "rgba(70,130,255,0.85)",
            color: "#fff",
          }}
        >
          {isPlayingThis ? <Pause size={13} /> : <Play size={13} />}
        </button>

        {isLive && (
          <button
            onClick={onEdit}
            title="编辑"
            className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:scale-105"
            style={{ backgroundColor: "rgba(220,150,60,0.85)", color: "#fff" }}
          >
            <Pencil size={13} />
          </button>
        )}

        {isLive && (
          <button
            onClick={onToggleFavorite}
            title={music.isFavorite ? "取消收藏" : "收藏"}
            className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:scale-105"
            style={{
              backgroundColor: music.isFavorite
                ? "rgba(220,80,80,0.85)"
                : "rgba(100,100,120,0.6)",
              color: "#fff",
            }}
          >
            <Star size={13} fill={music.isFavorite ? "#fff" : "none"} />
          </button>
        )}
      </div>
    </div>
  );
}
