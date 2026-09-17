"use client";

import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { useMusicStore } from "@/stores/musicStore";
import { VideoPlay, VideoPause, Star, StarFilled, Edit } from "./icons";
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
 * <p>复刻源项目 {@code views/song/com/SongCard.vue}：标题 30% / 歌手 25% /
 * 分类 20% / 时长 15% 的四段布局，右侧悬停浮现的圆形操作按钮
 * （播放、编辑、收藏）。</p>
 *
 * <p>样式取自源文件 {@code .song-item} / {@code .song-actions} / {@code .action-btn}：
 * 行悬浮上移 1px、播放中行背景转蓝并加霓虹辉光、操作区初始
 * {@code opacity:0; translateX(10px)}，悬浮时滑入。</p>
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
    <div className={`mt-song-item flex items-center justify-between px-4 py-3 my-1.5${isPlayingThis ? " is-playing" : ""}`}>
      {/* 四段信息列 */}
      <div className="flex items-center flex-1 min-w-0 gap-4">
        <span className="mt-song-title w-[30%] min-w-[150px] font-medium truncate transition-all duration-300"
          style={{ color: "rgba(220,230,240,0.9)" }}>
          {music.title}
        </span>
        <span className="w-[25%] min-w-[120px] truncate"
          style={{ color: "rgba(180,200,220,0.8)" }}>
          {music.singerName || "--"}
        </span>
        <span className="w-[20%] min-w-[100px] truncate"
          style={{ color: "rgba(180,200,220,0.8)" }}>
          {music.categoryName || "--"}
        </span>
        <span className="w-[15%] min-w-[60px] text-right"
          style={{ color: "rgba(160,180,200,0.7)" }}>
          {formatDuration(music.duration)}
        </span>
      </div>

      {/* 悬停浮现的操作（源 .song-actions + .action-btn） */}
      <div className="mt-song-actions flex gap-2 ml-4">
        <button
          onClick={handlePlay}
          title={isPlayingThis ? "暂停" : "播放"}
          className={`mt-btn mt-btn-circle ${
            isPlayingThis ? "mt-btn-success" : "mt-btn-primary"
          }`}
        >
          {isPlayingThis ? <VideoPause size={13} /> : <VideoPlay size={13} />}
        </button>

        {isLive && (
          <button
            onClick={onEdit}
            title="编辑"
            className="mt-btn mt-btn-warning mt-btn-circle"
          >
            <Edit size={13} />
          </button>
        )}

        {isLive && (
          <button
            onClick={onToggleFavorite}
            title={music.isFavorite ? "取消收藏" : "收藏"}
            className={`mt-btn mt-btn-circle ${
              music.isFavorite ? "mt-btn-danger" : "mt-btn-info"
            }`}
          >
            {music.isFavorite ? <StarFilled size={13} /> : <Star size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
