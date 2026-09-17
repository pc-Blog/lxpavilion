"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Search, Plus, Star, StarOff, LocateFixed } from "lucide-react";
import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import type { MusicCategory } from "@/lib/types";

interface Props {
  /** 当前播放曲目 id，「定位歌曲」用 */
  currentMusicId: number | null;
  isLive: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  categoryId: number | null;
  onCategoryChange: (v: number | null) => void;
  onlyFavorite: boolean;
  onToggleFavoriteFilter: () => void;
  categories: MusicCategory[];
  onAdd: () => void;
  onLocate: (id: number) => void;
}

/**
 * 曲目区头部。
 *
 * <p>复刻源项目 {@code views/song/com/SongHead.vue}：大封面 + 歌手名 / 歌名 +
 * 播放键 + 搜索 + 分类下拉 + 收藏筛选 + 添加歌曲。
 * 源项目的「批量删除」已按要求整体移除。</p>
 */
export default function TrackHeader({
  currentMusicId,
  isLive,
  title,
  onTitleChange,
  categoryId,
  onCategoryChange,
  onlyFavorite,
  onToggleFavoriteFilter,
  categories,
  onAdd,
  onLocate,
}: Props) {
  const { currentTrack, isPlaying, toggle } = useAudioPlayer();

  // 搜索防抖，对应源项目对搜索条件的 watch
  const [draft, setDraft] = useState(title);
  useEffect(() => {
    const t = setTimeout(() => onTitleChange(draft), 300);
    return () => clearTimeout(t);
  }, [draft, onTitleChange]);

  return (
    <div className="flex items-end gap-5 p-4" style={{ height: 140 }}>
      {/* 大封面 */}
      <div
        className="flex-shrink-0 w-[120px] h-[120px] rounded-xl overflow-hidden transition-transform duration-300 hover:scale-[1.02]"
        style={{
          border: "0.5px solid rgba(120,230,255,0.2)",
          boxShadow:
            "0 4px 12px rgba(0,0,0,0.2), 0 0 8px rgba(120,230,255,0.2)",
        }}
      >
        <img
          src={assetUrl(currentTrack?.singerPictureUrl || siteConfig.defaultSingerCover)}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex flex-col justify-between h-full flex-grow min-w-0">
        {/* 歌手名 + 歌名 */}
        <div className="mb-auto">
          <h1
            className="flex items-center gap-2 m-0 text-2xl font-bold leading-tight"
            style={{
              color: "rgba(220,230,240,0.95)",
              textShadow: "0 0 6px rgba(120,230,255,0.3)",
            }}
          >
            {currentTrack?.singerName || "佚名"}
            <button
              onClick={() => currentMusicId && onLocate(currentMusicId)}
              disabled={!currentMusicId}
              title="定位歌曲"
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 disabled:opacity-40"
              style={{
                backgroundColor: "rgba(65,65,75,0.7)",
                border: "0.5px solid rgba(120,230,255,0.2)",
                color: "rgba(180,220,255,0.9)",
              }}
            >
              <LocateFixed size={15} />
            </button>
          </h1>
          <h2
            className="mt-1 mb-0 text-lg font-normal leading-snug truncate"
            style={{ color: "rgba(200,220,240,0.85)" }}
          >
            {currentTrack?.title}
          </h2>
        </div>

        {/* 操作按钮组 */}
        <div className="flex items-center flex-wrap gap-3 pt-2.5">
          <button
            onClick={toggle}
            className="flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:scale-105"
            style={{
              backgroundColor: isPlaying
                ? "rgba(60,180,120,0.85)"
                : "rgba(70,130,255,0.85)",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(70,130,255,0.4)",
            }}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <div className="relative flex-1 min-w-[100px] max-w-[500px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "rgba(120,230,255,0.7)" }}
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="搜索歌曲..."
              className="w-full h-10 pl-9 pr-3 rounded-md text-sm outline-none transition-all duration-200"
              style={{
                backgroundColor: "rgba(65,65,75,0.7)",
                border: "1px solid rgba(120,230,255,0.2)",
                color: "rgba(220,230,240,0.9)",
                boxShadow: "0 0 8px rgba(120,230,255,0.1)",
              }}
            />
          </div>

          <select
            value={categoryId ?? ""}
            onChange={(e) =>
              onCategoryChange(e.target.value === "" ? null : Number(e.target.value))
            }
            className="h-10 px-2 rounded-md text-sm outline-none w-[100px]"
            style={{
              backgroundColor: "rgba(65,65,75,0.7)",
              border: "1px solid rgba(120,230,255,0.2)",
              color: "rgba(220,230,240,0.9)",
            }}
          >
            <option value="">分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={onToggleFavoriteFilter}
            className="flex items-center gap-1.5 h-10 px-4 rounded-md text-sm transition-all duration-200"
            style={{
              backgroundColor: onlyFavorite
                ? "rgba(220,80,80,0.75)"
                : "rgba(70,70,80,0.6)",
              border: "1px solid rgba(120,230,255,0.2)",
              color: "rgba(220,230,240,0.9)",
            }}
          >
            {onlyFavorite ? <Star size={15} /> : <StarOff size={15} />}
            <span>收藏</span>
          </button>

          {/* 添加歌曲：仅本地 */}
          {isLive && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 h-10 px-4 rounded-md text-sm transition-all duration-200 hover:-translate-y-px"
              style={{
                backgroundColor: "rgba(70,165,255,0.8)",
                border: "1px solid rgba(120,230,255,0.3)",
                color: "#fff",
              }}
            >
              <Plus size={15} />
              <span>添加歌曲</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
